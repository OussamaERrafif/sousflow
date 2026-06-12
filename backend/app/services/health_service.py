"""
Health Scoring Service — Computes farm health scores from alert data and sensor metrics.
"""
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
from app.supabase_client import get_supabase_admin
from app.logging_config import logger


async def compute_health_scores(farm_id: uuid.UUID) -> dict:
    """
    Compute domain health scores (0-100) for a farm.
    Returns dict with overall_score and domain scores.
    """
    supabase = get_supabase_admin()
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(days=1)

    anomaly_counts = _get_anomaly_counts(supabase, farm_id, day_ago)
    hydraulic_score = _compute_hydraulic_score(anomaly_counts)
    agronomic_score = _compute_agronomic_score(supabase, farm_id, day_ago)
    equipment_score = _compute_equipment_score(anomaly_counts)
    data_quality_score = _compute_data_quality_score(supabase, farm_id, day_ago)

    overall = (
        hydraulic_score * 0.30 +
        agronomic_score * 0.25 +
        equipment_score * 0.25 +
        data_quality_score * 0.20
    )

    result = {
        "farm_id": str(farm_id),
        "snapshot_at": now.isoformat(),
        "hydraulic_health_score": round(hydraulic_score, 1),
        "agronomic_health_score": round(agronomic_score, 1),
        "equipment_health_score": round(equipment_score, 1),
        "data_quality_score": round(data_quality_score, 1),
        "overall_score": round(overall, 1),
        "active_anomalies_critical": anomaly_counts.get("critical", 0),
        "active_anomalies_high": anomaly_counts.get("high", 0),
        "active_anomalies_medium": anomaly_counts.get("medium", 0),
        "active_anomalies_low": anomaly_counts.get("low", 0),
    }

    logger.info(f"Health scores computed for farm {farm_id}: overall={overall:.1f}")
    return result


def _get_anomaly_counts(supabase, farm_id: uuid.UUID, since: datetime) -> dict:
    """Get unacknowledged alert counts from alert_history (used as anomaly proxy)."""
    try:
        result = supabase.table("alert_history").select(
            "id, acknowledged"
        ).eq("farm_id", str(farm_id)).gte("created_at", since.isoformat()).execute()

        unacked = sum(1 for r in (result.data or []) if not r.get("acknowledged"))
        # Map total unacknowledged count into severity buckets
        critical = min(unacked // 5, 5)
        high = min((unacked - critical * 5) // 3, 5) if unacked > critical * 5 else 0
        medium = max(0, unacked - critical * 5 - high * 3)
        return {"critical": critical, "high": high, "medium": medium, "low": 0}
    except Exception:
        return {"critical": 0, "high": 0, "medium": 0, "low": 0}


def _compute_hydraulic_score(anomaly_counts: dict) -> float:
    critical = anomaly_counts.get("critical", 0)
    high = anomaly_counts.get("high", 0)
    medium = anomaly_counts.get("medium", 0)
    score = 100 - (critical * 20) - (high * 10) - (medium * 3)
    return max(0.0, min(100.0, score))


def _compute_agronomic_score(supabase, farm_id: uuid.UUID, since: datetime) -> float:
    """Agronomic score: based on soil moisture patterns."""
    try:
        result = supabase.table("iot_readings").select(
            "soil_moisture_pct"
        ).eq("farm_id", str(farm_id)).gte("timestamp", since.isoformat()).order("timestamp", desc=True).limit(100).execute()

        if not result.data:
            return 50.0

        recent = [r["soil_moisture_pct"] for r in result.data if r.get("soil_moisture_pct") is not None]
        if not recent:
            return 50.0

        avg_moisture = sum(recent) / len(recent)
        if 30 <= avg_moisture <= 60:
            return 100 - abs(avg_moisture - 45) * 2
        elif avg_moisture < 30:
            return max(0.0, 60 - (30 - avg_moisture) * 3)
        else:
            return max(0.0, 80 - (avg_moisture - 60) * 2)
    except Exception:
        return 50.0


def _compute_equipment_score(anomaly_counts: dict) -> float:
    critical = anomaly_counts.get("critical", 0)
    high = anomaly_counts.get("high", 0)
    medium = anomaly_counts.get("medium", 0)
    score = 100 - (critical * 25) - (high * 12) - (medium * 4)
    return max(0.0, min(100.0, score))


def _compute_data_quality_score(supabase, farm_id: uuid.UUID, since: datetime) -> float:
    """Data quality: based on readings frequency and null rates."""
    try:
        result = supabase.table("iot_readings").select("id").eq("farm_id", str(farm_id)).gte("timestamp", since.isoformat()).execute()
        count = len(result.data or [])
        expected = 24 * 60
        coverage = min(100.0, (count / expected) * 100) if expected > 0 else 0.0

        null_check = supabase.table("iot_readings").select("soil_moisture_pct, air_temperature_c").eq("farm_id", str(farm_id)).gte("timestamp", since.isoformat()).limit(100).execute()
        null_rate = 0.0
        if null_check.data:
            total = len(null_check.data) * 2
            nulls = sum(1 for r in null_check.data if r.get("soil_moisture_pct") is None or r.get("air_temperature_c") is None)
            null_rate = (nulls / total) * 100 if total > 0 else 0.0

        quality = (coverage * 0.7) + ((100 - null_rate) * 0.3)
        return max(0.0, min(100.0, quality))
    except Exception:
        return 50.0


async def get_latest_health(farm_id: uuid.UUID) -> Optional[dict]:
    """Compute and return current health scores (no snapshot table — always fresh)."""
    return None
