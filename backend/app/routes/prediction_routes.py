"""
Prediction Routes — Forecasting & Anomaly Detection
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from app.auth import get_current_user
from app.schemas.prediction import (
    ForecastRequest, ForecastResponse,
    AnomalyRequest, AnomalyResponse,
    FORECASTABLE_COLUMNS,
)
from app.services import prediction_service

router = APIRouter(prefix="/api/predictions", tags=["Predictions"])


def _get_farm_id(user: dict) -> str:
    """Extract farm_id from user context"""
    return user.get("active_farm_id") or user.get("farm_ids", [None])[0]


@router.post("/forecast", response_model=ForecastResponse, summary="Forecast a sensor column")
async def forecast(req: ForecastRequest, user=Depends(get_current_user)):
    farm_id = _get_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm. Please select a farm first.")
    if req.target_column not in FORECASTABLE_COLUMNS:
        raise HTTPException(400, f"Column '{req.target_column}' is not forecastable. "
                                 f"Valid: {FORECASTABLE_COLUMNS}")
    return await prediction_service.forecast(
        farm_id=farm_id,
        target_column=req.target_column,
        zone_id=req.zone_id,
        lookback_hours=req.lookback_hours,
        forecast_hours=req.forecast_hours,
    )


@router.post("/anomalies", response_model=AnomalyResponse, summary="Detect anomalies in sensor data")
async def detect_anomalies(req: AnomalyRequest, user=Depends(get_current_user)):
    farm_id = _get_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm. Please select a farm first.")
    if req.target_column not in FORECASTABLE_COLUMNS:
        raise HTTPException(400, f"Column '{req.target_column}' not supported. "
                                 f"Valid: {FORECASTABLE_COLUMNS}")
    return await prediction_service.detect_anomalies(
        farm_id=farm_id,
        target_column=req.target_column,
        zone_id=req.zone_id,
        lookback_hours=req.lookback_hours,
        z_threshold=req.z_threshold,
    )


@router.get("/history", summary="Get prediction history")
async def get_history(
    limit: int = Query(20, ge=1, le=100),
    user=Depends(get_current_user),
):
    farm_id = _get_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm. Please select a farm first.")
    return await prediction_service.get_prediction_history(farm_id, limit)
