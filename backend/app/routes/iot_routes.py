"""
IoT Routes — Olive Irrigation Endpoints
Ingest, query, analyze, dashboard, alert rules.
"""
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException
from app.auth import get_current_user, _extract_farm_id
from app.schemas.iot import (
    IoTReadingCreate, IoTReadingResponse, IoTBatchCreate, IoTBatchResponse,
    AlertRuleCreate, AlertRuleResponse,
)
from app.services import iot_service
from app.services.iot_simulator import (
    start_iot_simulator,
    stop_iot_simulator,
    is_simulator_running,
)

router = APIRouter(prefix="/api/iot", tags=["IoT — Olive Irrigation"])


# ─── Ingest ─────────────────────────────────────────────────────

@router.post("/readings", response_model=dict, summary="Ingest a single IoT reading")
async def create_reading(reading: IoTReadingCreate, user=Depends(get_current_user)):
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm. Please select a farm first.")
    result = await iot_service.ingest_reading(farm_id, reading.model_dump(mode="json"))

    # Check alert rules against this reading
    alerts = await iot_service.check_alert_rules(farm_id, reading.model_dump())
    return {"reading": result, "alerts_triggered": len(alerts), "alerts": alerts}


@router.post("/readings/batch", response_model=IoTBatchResponse, summary="Ingest batch of readings (max 1000)")
async def create_batch(batch: IoTBatchCreate, user=Depends(get_current_user)):
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm. Please select a farm first.")
    rows = [r.model_dump(mode="json") for r in batch.readings]
    result = await iot_service.ingest_batch(farm_id, rows)
    return result


# ─── Query ──────────────────────────────────────────────────────

@router.get("/readings", summary="Query readings with filters")
async def get_readings(
    user=Depends(get_current_user),
    zone_id: Optional[int] = Query(None, description="Filter by zone"),
    start_date: Optional[datetime] = Query(None, description="ISO datetime start"),
    end_date: Optional[datetime] = Query(None, description="ISO datetime end"),
    columns: Optional[str] = Query(None, description="Comma-separated column names"),
    anomalies_only: bool = Query(False),
    irrigation_only: bool = Query(False),
    limit: int = Query(100, ge=1, le=5000),
    offset: int = Query(0, ge=0),
):
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm. Please select a farm first.")
    col_list = columns.split(",") if columns else None
    data = await iot_service.query_readings(
        farm_id=farm_id,
        zone_id=zone_id,
        start_date=start_date,
        end_date=end_date,
        columns=col_list,
        anomalies_only=anomalies_only,
        irrigation_only=irrigation_only,
        limit=limit,
        offset=offset,
    )
    return {"count": len(data), "data": data}


@router.get("/readings/latest", summary="Latest reading per zone")
async def latest_per_zone(user=Depends(get_current_user)):
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm. Please select a farm first.")
    data = await iot_service.get_latest_per_zone(farm_id)
    return {"zones": len(data), "data": data}


# ─── Analysis ───────────────────────────────────────────────────

@router.get("/analyze/{zone_id}", summary="Analyze a zone (stats, anomalies, recommendations)")
async def analyze_zone(
    zone_id: int,
    hours: int = Query(24, ge=1, le=720, description="Lookback period in hours"),
    user=Depends(get_current_user),
):
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm. Please select a farm first.")
    return await iot_service.analyze_zone(farm_id, zone_id, hours)


@router.get("/dashboard", summary="Dashboard snapshot (all zones, 24h summary)")
async def get_dashboard(user=Depends(get_current_user)):
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm. Please select a farm first.")
    return await iot_service.get_dashboard(farm_id)


# ─── Alert Rules ────────────────────────────────────────────────

@router.post("/alerts/rules", summary="Create an alert rule")
async def create_alert_rule(rule: AlertRuleCreate, user=Depends(get_current_user)):
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm. Please select a farm first.")
    from app.schemas.iot import ALERTABLE_COLUMNS
    if rule.target_column not in ALERTABLE_COLUMNS:
        raise HTTPException(400, f"Column '{rule.target_column}' is not alertable. "
                                 f"Valid: {ALERTABLE_COLUMNS}")
    result = await iot_service.create_alert_rule(farm_id, rule.model_dump())
    return result


@router.get("/alerts/rules", response_model=List[AlertRuleResponse], summary="List alert rules")
async def list_alert_rules(user=Depends(get_current_user)):
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm. Please select a farm first.")
    return await iot_service.list_alert_rules(farm_id)


@router.delete("/alerts/rules/{rule_id}", summary="Delete an alert rule")
async def delete_alert_rule(rule_id: str, user=Depends(get_current_user)):
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm. Please select a farm first.")
    deleted = await iot_service.delete_alert_rule(farm_id, rule_id)
    if not deleted:
        raise HTTPException(404, "Alert rule not found")
    return {"deleted": True}


# ─── Simulator Control ───────────────────────────────────────────

@router.get("/simulator/status", summary="Get IoT simulator status")
async def get_simulator_status(user=Depends(get_current_user)):
    """Check if the IoT simulator is running"""
    farm_id = _extract_farm_id(user)
    running = is_simulator_running()
    return {"running": running, "farm_id": farm_id}


@router.post("/simulator/start", summary="Start IoT simulator")
async def start_simulator(
    zones: int = Query(4, ge=1, le=20, description="Number of zones"),
    interval: float = Query(5.0, ge=0.5, le=60, description="Seconds between readings"),
    user=Depends(get_current_user),
):
    """Start the IoT data simulator"""
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm. Please select a farm first.")
    await start_iot_simulator(
        n_zones=zones,
        interval_seconds=interval,
        farm_id=farm_id,
    )
    return {"status": "started", "zones": zones, "interval": interval}


@router.post("/simulator/stop", summary="Stop IoT simulator")
async def stop_simulator(user=Depends(get_current_user)):
    """Stop the IoT data simulator"""
    await stop_iot_simulator()
    return {"status": "stopped"}
