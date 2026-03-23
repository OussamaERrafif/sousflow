"""Anomaly Detection Routes — dashboard, listing, acknowledgement, and manual injection."""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from pydantic import BaseModel
from app.auth import get_current_user, _extract_farm_id
from app.schemas.anomaly import AnomalyAcknowledge
from app.services import anomaly_service
from app.supabase_client import get_supabase_admin

router = APIRouter(prefix="/api/anomalies", tags=["Anomaly Detection"])


class AnomalyInjectRequest(BaseModel):
    farm_id: str
    anomaly_type: str  # low_soil_moisture | irrigation_failure | sensor_error
    severity: str = "medium"  # low | medium | critical
    zone_id: Optional[str] = None


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


@router.post("/inject")
async def inject_anomaly(
    request: AnomalyInjectRequest,
    user=Depends(get_current_user),
):
    """
    Manually inject an anomaly for a farm (superadmin or farm owner).
    Sends WhatsApp alert to all users linked to the farm.

    anomaly_type: low_soil_moisture | irrigation_failure | sensor_error
    severity: low | medium | critical
    """
    VALID_TYPES = {"low_soil_moisture", "irrigation_failure", "sensor_error"}
    VALID_SEVERITIES = {"low", "medium", "critical"}

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
