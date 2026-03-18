"""Anomaly Detection Routes — dashboard, listing, and acknowledgement."""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from app.auth import get_current_user, _extract_farm_id
from app.schemas.anomaly import AnomalyAcknowledge
from app.services import anomaly_service

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
