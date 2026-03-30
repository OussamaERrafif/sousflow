"""Anomaly Detection Routes — dashboard, listing, acknowledgement, and manual injection."""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from pydantic import BaseModel
from app.auth import get_current_user, _extract_farm_id
from app.schemas.anomaly import AnomalyAcknowledge
from app.services import anomaly_service, baseline_service, health_service
from app.supabase_client import get_supabase_admin

router = APIRouter(prefix="/api/anomalies", tags=["Anomaly Detection"])


class AnomalyInjectRequest(BaseModel):
    farm_id: str
    anomaly_type: str  # See /api/anomalies/inject for full list of valid types
    severity: str = "medium"  # low | medium | high | critical
    zone_id: Optional[str] = None


class FalsePositiveRequest(BaseModel):
    anomaly_id: str


@router.get("/types")
async def list_anomaly_types():
    """Return the full anomaly_types catalog (32 standardized types across 4 domains)."""
    return await anomaly_service.get_anomaly_types()


@router.get("/baselines")
async def get_baselines(user=Depends(get_current_user)):
    """Get statistical baselines for the active farm."""
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm")
    return await baseline_service.get_baselines_for_farm(uuid.UUID(farm_id))


@router.get("/health")
async def get_health(user=Depends(get_current_user)):
    """Get farm health scores — returns latest snapshot, computing one fresh if none exists."""
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm")
    result = await health_service.get_latest_health(uuid.UUID(farm_id))
    if result is None:
        result = await health_service.compute_health_scores(uuid.UUID(farm_id))
    return result


@router.get("/timeline")
async def get_anomaly_timeline(
    days: int = 7,
    user=Depends(get_current_user),
):
    """Get anomaly counts over time for charting (default 7 days)."""
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm")
    return await anomaly_service.get_anomaly_timeline(farm_id, days)


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
    false_positive: Optional[bool] = None,
    limit: int = 50,
    offset: int = 0,
    user=Depends(get_current_user),
):
    """List anomaly events with optional filters."""
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm")
    return await anomaly_service.list_anomalies(
        farm_id, anomaly_type, severity, zone_id, acknowledged, false_positive, limit, offset
    )


@router.post("/acknowledge")
async def acknowledge(request: AnomalyAcknowledge, user=Depends(get_current_user)):
    """Mark anomalies as acknowledged, optionally with resolution notes."""
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm")
    await anomaly_service.acknowledge_anomalies(
        farm_id, request.anomaly_ids, user["id"], request.resolution_notes
    )
    return {"acknowledged": len(request.anomaly_ids)}


@router.post("/false-positive")
async def report_false_positive(request: FalsePositiveRequest, user=Depends(get_current_user)):
    """Flag an anomaly event as a false positive."""
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm")
    success = await anomaly_service.mark_false_positive(farm_id, request.anomaly_id)
    if not success:
        raise HTTPException(404, "Anomaly not found")
    return {"flagged": True, "anomaly_id": request.anomaly_id}


@router.delete("/clear")
async def clear_anomalies(user=Depends(get_current_user)):
    """Permanently delete all anomaly events for the active farm."""
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm")
    deleted = await anomaly_service.clear_all_anomalies(farm_id)
    return {"deleted": deleted}


@router.post("/inject")
async def inject_anomaly(
    request: AnomalyInjectRequest,
    user=Depends(get_current_user),
):
    """
    Manually inject an anomaly for a farm (superadmin or farm owner).
    Sends WhatsApp alert to all farm users.

    **anomaly_type** — one of:
    - Agronomic: `low_soil_moisture`, `high_soil_moisture`, `irrigation_failure`, `soil_moisture_drift`
    - Hydraulic: `LEAK_BRANCH`, `PIPE_BURST`, `FILTER_CLOG_EARLY`, `FILTER_CLOG_SEVERE`,
      `VALVE_STUCK_OPEN`, `VALVE_STUCK_CLOSED`, `PRESSURE_ANOMALY_LOW`, `PRESSURE_ANOMALY_HIGH`,
      `DRIPPER_CLOG_PARTIAL`, `DRIPPER_CLOG_SEVERE`
    - Equipment: `PUMP_DEGRADATION`, `PUMP_FAILURE_IMMINENT`, `RESERVOIR_CRITICAL`, `RESERVOIR_LEAK`
    - Statistical: `sensor_error`, `stuck_sensor`, `z_score`, `sudden_change`, `drift`, `correlation`

    **severity**: `low` | `medium` | `high` | `critical`
    """
    VALID_TYPES = {
        # ── Agronomic ──────────────────────────────────────────
        "low_soil_moisture",
        "high_soil_moisture",
        "irrigation_failure",
        "soil_moisture_drift",
        # ── Hydraulic ──────────────────────────────────────────
        "LEAK_BRANCH",
        "PIPE_BURST",
        "FILTER_CLOG_EARLY",
        "FILTER_CLOG_SEVERE",
        "VALVE_STUCK_OPEN",
        "VALVE_STUCK_CLOSED",
        "PRESSURE_ANOMALY_LOW",
        "PRESSURE_ANOMALY_HIGH",
        "DRIPPER_CLOG_PARTIAL",
        "DRIPPER_CLOG_SEVERE",
        # ── Equipment ──────────────────────────────────────────
        "PUMP_DEGRADATION",
        "PUMP_FAILURE_IMMINENT",
        "RESERVOIR_CRITICAL",
        "RESERVOIR_LEAK",
        # ── Data / Statistical ─────────────────────────────────
        "sensor_error",
        "stuck_sensor",
        "z_score",
        "sudden_change",
        "drift",
        "correlation",
    }
    VALID_SEVERITIES = {"low", "medium", "high", "critical"}

    if request.anomaly_type not in VALID_TYPES:
        raise HTTPException(400, f"Invalid anomaly_type. Valid: {sorted(VALID_TYPES)}")
    if request.severity not in VALID_SEVERITIES:
        raise HTTPException(400, f"Invalid severity. Valid: {sorted(VALID_SEVERITIES)}")

    # Verify requester has access to this farm
    role = user.get("role", "")
    if role != "superadmin":
        farm_ids = user.get("farm_ids", [])
        if request.farm_id not in farm_ids:
            raise HTTPException(403, "Access denied to this farm")

    # Verify farm exists
    supabase = get_supabase_admin()
    farm = supabase.table("farms").select("id, name").eq("id", request.farm_id).limit(1).execute()
    if not farm.data:
        raise HTTPException(404, "Farm not found")

    result = await anomaly_service.inject_anomaly_manual(
        farm_id=request.farm_id,
        anomaly_type=request.anomaly_type,
        severity=request.severity,
        zone_id=request.zone_id,
    )
    return result
