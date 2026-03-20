"""Anomaly Detection Routes — dashboard, listing, acknowledgement, and injection."""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from app.auth import get_current_user, _extract_farm_id
from app.schemas.anomaly import AnomalyAcknowledge, AnomalyInjectRequest
from app.services import anomaly_service
from app.logging_config import logger

router = APIRouter(prefix="/api/anomalies", tags=["Anomaly Detection"])


@router.get("/dashboard")
async def anomaly_dashboard(user=Depends(get_current_user)):
    """Get anomaly detection summary dashboard."""
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm")
    return await anomaly_service.get_anomaly_dashboard(farm_id)


@router.get("/")
async def list_anomalies(
    anomaly_type: Optional[str] = None,
    severity: Optional[str] = None,
    zone_id: Optional[str] = None,
    acknowledged: Optional[bool] = None,
    limit: int = 50,
    offset: int = 0,
    user=Depends(get_current_user),
):
    """List anomaly events with optional filters."""
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm")
    return await anomaly_service.list_anomalies(
        farm_id, anomaly_type, severity, zone_id, acknowledged, limit, offset
    )


@router.post("/acknowledge")
async def acknowledge(request: AnomalyAcknowledge, user=Depends(get_current_user)):
    """Mark anomalies as acknowledged."""
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm")
    await anomaly_service.acknowledge_anomalies(farm_id, request.anomaly_ids, user["id"])
    return {"acknowledged": len(request.anomaly_ids)}


@router.post("/inject", summary="Inject an anomaly into a farm (admin/testing)")
async def inject_anomaly(
    request: AnomalyInjectRequest,
    user=Depends(get_current_user),
):
    """
    Inject an anomaly for a farm. This will:
    1. Record the anomaly in the anomaly_events table
    2. Optionally trigger the IoT simulator anomaly (if running)
    3. Send WhatsApp alerts to all users linked to the farm (if send_alerts=True)

    Anomaly types: low_soil_moisture, irrigation_failure, sensor_error,
                   sensor_fault, pipe_burst, pressure_drop, flow_spike
    Severity: low, medium, high, critical
    """
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm")

    # Validate severity
    valid_severities = ["low", "medium", "high", "critical"]
    if request.severity not in valid_severities:
        raise HTTPException(400, f"Invalid severity. Valid: {valid_severities}")

    # Validate anomaly type
    valid_types = [
        "low_soil_moisture", "irrigation_failure", "sensor_error",
        "sensor_fault", "pipe_burst", "pressure_drop", "flow_spike",
        "high_temperature", "low_humidity",
    ]
    if request.anomaly_type not in valid_types:
        raise HTTPException(400, f"Invalid anomaly type. Valid: {valid_types}")

    # Get zone name if zone_id is provided
    zone_name = None
    if request.zone_id:
        try:
            from app.supabase_client import get_supabase_admin
            supabase = get_supabase_admin()
            zone = supabase.table("zones").select("name, zone_number").eq("id", request.zone_id).limit(1).execute()
            if zone.data:
                zone_name = zone.data[0].get("name") or f"Zone {zone.data[0].get('zone_number', '?')}"
        except Exception:
            pass

    # 1. Persist anomaly to database
    anomaly_record = None
    try:
        from app.supabase_client import get_supabase_admin
        supabase = get_supabase_admin()

        # Map user-friendly types to target columns
        type_columns = {
            "low_soil_moisture": ["soil_moisture_pct"],
            "irrigation_failure": ["valve_open", "zone_flow_lpm"],
            "sensor_error": ["is_anomaly"],
            "sensor_fault": ["air_temperature_c", "air_humidity_pct"],
            "pipe_burst": ["zone_flow_lpm", "zone_pressure_mpa"],
            "pressure_drop": ["main_pressure_mpa"],
            "flow_spike": ["zone_flow_lpm"],
            "high_temperature": ["air_temperature_c"],
            "low_humidity": ["air_humidity_pct"],
        }

        row = {
            "farm_id": farm_id,
            "zone_id": request.zone_id,
            "anomaly_type": request.anomaly_type,
            "severity": request.severity,
            "target_columns": type_columns.get(request.anomaly_type, [request.anomaly_type]),
            "details": {
                "source": "manual_injection",
                "injected_by": user["id"],
                "message": request.details or f"Manually injected {request.anomaly_type} anomaly",
            },
        }
        result = supabase.table("anomaly_events").insert(row).execute()
        anomaly_record = result.data[0] if result.data else None
    except Exception as e:
        logger.error(f"Failed to persist injected anomaly: {e}")
        raise HTTPException(500, f"Failed to record anomaly: {e}")

    # 2. Optionally trigger simulator anomaly
    simulator_injected = False
    try:
        from app.services.iot_simulator import get_simulator
        sim = get_simulator()
        # Map anomaly types to simulator types
        sim_type_map = {
            "sensor_fault": "sensor_fault",
            "pipe_burst": "pipe_burst",
            "pressure_drop": "pressure_drop",
            "flow_spike": "flow_spike",
            "sensor_error": "sensor_fault",
        }
        sim_type = sim_type_map.get(request.anomaly_type)
        if sim and sim.running and sim_type:
            # Get zone_number from zone_id, default to zone 1
            zone_number = 1
            if request.zone_id:
                zone = supabase.table("zones").select("zone_number").eq("id", request.zone_id).limit(1).execute()
                if zone.data:
                    zone_number = zone.data[0]["zone_number"]
            sim.inject_anomaly(zone_number, sim_type, 3)
            simulator_injected = True
    except Exception as e:
        logger.warning(f"Could not inject into simulator: {e}")

    # 3. Send WhatsApp alerts to all farm users
    alert_result = None
    if request.send_alerts:
        try:
            from app.services.whatsapp_service import get_whatsapp_service
            ws = get_whatsapp_service()
            alert_result = await ws.broadcast_anomaly_alert(
                farm_id=farm_id,
                anomaly_type=request.anomaly_type,
                severity=request.severity,
                zone_name=zone_name,
                details=request.details,
            )
        except Exception as e:
            logger.error(f"Failed to send anomaly alerts: {e}")
            alert_result = {"error": str(e)}

    return {
        "status": "injected",
        "anomaly": anomaly_record,
        "simulator_injected": simulator_injected,
        "alerts": alert_result,
    }
