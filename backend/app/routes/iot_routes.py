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
    get_simulator,
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
    interval: float = Query(300.0, ge=1, le=600, description="Seconds between readings"),
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


# ─── Simulator Injection (Demo/Prototype Controls) ──────────────

@router.post("/simulator/inject/anomaly", summary="Inject anomaly into a zone")
async def inject_anomaly(
    zone_id: int = Query(1, ge=1, le=20, description="Target zone"),
    anomaly_type: str = Query("sensor_fault", description="Type: sensor_fault, pipe_burst, pressure_drop, flow_spike"),
    duration: int = Query(3, ge=1, le=20, description="How many readings the anomaly lasts"),
    user=Depends(get_current_user),
):
    sim = get_simulator()
    if not sim or not sim.running:
        raise HTTPException(400, "Simulator is not running")
    if zone_id > sim.n_zones:
        raise HTTPException(400, f"Zone {zone_id} does not exist (max: {sim.n_zones})")
    valid_types = ["sensor_fault", "pipe_burst", "pressure_drop", "flow_spike"]
    if anomaly_type not in valid_types:
        raise HTTPException(400, f"Invalid type. Valid: {valid_types}")
    sim.inject_anomaly(zone_id, anomaly_type, duration)
    return {"status": "injected", "zone_id": zone_id, "type": anomaly_type, "duration": duration}


@router.post("/simulator/inject/irrigation", summary="Force irrigation on/off")
async def inject_irrigation(
    zone_id: int = Query(1, ge=1, le=20, description="Target zone"),
    action: str = Query("start", description="start or stop"),
    user=Depends(get_current_user),
):
    sim = get_simulator()
    if not sim or not sim.running:
        raise HTTPException(400, "Simulator is not running")
    if zone_id > sim.n_zones:
        raise HTTPException(400, f"Zone {zone_id} does not exist (max: {sim.n_zones})")
    if action not in ("start", "stop"):
        raise HTTPException(400, "Action must be 'start' or 'stop'")
    sim.inject_irrigation(zone_id, action)
    return {"status": "ok", "zone_id": zone_id, "irrigation": action}


@router.post("/simulator/inject/reservoir", summary="Set reservoir level")
async def inject_reservoir(
    level: float = Query(50.0, ge=0, le=100, description="Reservoir level %"),
    user=Depends(get_current_user),
):
    sim = get_simulator()
    if not sim or not sim.running:
        raise HTTPException(400, "Simulator is not running")
    sim.inject_reservoir(level)
    return {"status": "ok", "reservoir_level_pct": sim.reservoir}


@router.post("/simulator/inject/filter", summary="Set filter status")
async def inject_filter(
    status: int = Query(0, ge=0, le=2, description="0=clean, 1=partial, 2=clogged"),
    user=Depends(get_current_user),
):
    sim = get_simulator()
    if not sim or not sim.running:
        raise HTTPException(400, "Simulator is not running")
    sim.inject_filter(status)
    return {"status": "ok", "filter_status": sim.filter_st}


@router.post("/simulator/inject/soil", summary="Set soil moisture for a zone")
async def inject_soil(
    zone_id: int = Query(1, ge=1, le=20, description="Target zone"),
    moisture: float = Query(30.0, ge=5, le=99, description="Soil moisture %"),
    user=Depends(get_current_user),
):
    sim = get_simulator()
    if not sim or not sim.running:
        raise HTTPException(400, "Simulator is not running")
    if zone_id > sim.n_zones:
        raise HTTPException(400, f"Zone {zone_id} does not exist (max: {sim.n_zones})")
    sim.inject_soil_moisture(zone_id, moisture)
    return {"status": "ok", "zone_id": zone_id, "soil_moisture_pct": sim.zone_soil[zone_id]}


# =============================================================================
# Hierarchical IoT Routes (v3 Schema)
# =============================================================================

@router.post("/readings/environment", response_model=dict, summary="Ingest environment reading")
async def create_environment_reading(reading: dict, user=Depends(get_current_user)):
    """Ingest an environment reading (weather station data)"""
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm. Please select a farm first.")
    result = await iot_service.ingest_environment_reading(farm_id, reading)
    return {"reading": result}


@router.get("/readings/environment/latest", summary="Get latest environment reading")
async def get_latest_environment(user=Depends(get_current_user)):
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm. Please select a farm first.")
    result = await iot_service.get_latest_environment(farm_id)
    if not result:
        raise HTTPException(404, "No environment readings found")
    return result


@router.post("/readings/infrastructure", response_model=dict, summary="Ingest infrastructure reading")
async def create_infrastructure_reading(reading: dict, user=Depends(get_current_user)):
    """Ingest an infrastructure reading (reservoir, pump, filter)"""
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm. Please select a farm first.")
    result = await iot_service.ingest_infrastructure_reading(farm_id, reading)
    return {"reading": result}


@router.get("/readings/infrastructure/latest", summary="Get latest infrastructure reading")
async def get_latest_infrastructure(user=Depends(get_current_user)):
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm. Please select a farm first.")
    result = await iot_service.get_latest_infrastructure(farm_id)
    if not result:
        raise HTTPException(404, "No infrastructure readings found")
    return result


@router.post("/readings/branch-flow", response_model=dict, summary="Ingest branch flow reading")
async def create_branch_flow_reading(
    branch_id: str = Query(..., description="Branch UUID"),
    zone_id: str = Query(..., description="Zone UUID"),
    reading: Optional[dict] = None,
    user=Depends(get_current_user),
):
    """Ingest a branch flow reading (inlet + outlet per branch)"""
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm. Please select a farm first.")
    if reading is None:
        raise HTTPException(400, "Reading body is required")
    result = await iot_service.ingest_branch_flow_reading(farm_id, branch_id, zone_id, reading)
    return {"reading": result}


@router.get("/readings/branch-flow/latest", summary="Get latest branch flow readings")
async def get_latest_branch_flow(
    zone_id: str = Query(None, description="Filter by zone UUID"),
    user=Depends(get_current_user),
):
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm. Please select a farm first.")
    result = await iot_service.get_latest_per_branch(farm_id, zone_id)
    return {"branches": len(result), "data": result}


@router.post("/readings/soil-moisture", response_model=dict, summary="Ingest soil moisture reading")
async def create_soil_moisture_reading(
    branch_id: str = Query(..., description="Branch UUID"),
    zone_id: str = Query(..., description="Zone UUID"),
    reading: Optional[dict] = None,
    user=Depends(get_current_user),
):
    """Ingest a soil moisture reading (3 sensors per branch)"""
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm. Please select a farm first.")
    if reading is None:
        raise HTTPException(400, "Reading body is required")
    result = await iot_service.ingest_soil_moisture_reading(farm_id, branch_id, zone_id, reading)
    return {"reading": result}


@router.post("/readings/zone-health", response_model=dict, summary="Ingest zone health reading")
async def create_zone_health_reading(
    zone_id: str = Query(..., description="Zone UUID"),
    reading: Optional[dict] = None,
    user=Depends(get_current_user),
):
    """Ingest a zone health reading (aggregated per zone)"""
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm. Please select a farm first.")
    if reading is None:
        raise HTTPException(400, "Reading body is required")
    result = await iot_service.ingest_zone_health_reading(farm_id, zone_id, reading)
    return {"reading": result}


@router.get("/readings/zone-health/latest", summary="Get latest zone health readings")
async def get_latest_zone_health(user=Depends(get_current_user)):
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm. Please select a farm first.")
    result = await iot_service.get_latest_per_zone_health(farm_id)
    return {"zones": len(result), "data": result}


@router.get("/dashboard/hierarchical", summary="Hierarchical dashboard snapshot")
async def get_hierarchical_dashboard(user=Depends(get_current_user)):
    """Get a dashboard snapshot with hierarchical data (zones, branches, health)"""
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm. Please select a farm first.")
    return await iot_service.get_hierarchical_dashboard(farm_id)


@router.get("/analyze-hierarchical/{zone_id}", summary="Analyze a zone with hierarchical data")
async def analyze_zone_hierarchical(
    zone_id: str,
    hours: int = Query(24, ge=1, le=720, description="Lookback period in hours"),
    user=Depends(get_current_user),
):
    """Analyze a zone with branch-level data"""
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm. Please select a farm first.")
    return await iot_service.analyze_zone_hierarchical(farm_id, zone_id, hours)
