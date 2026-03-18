"""
Prediction Service — Olive Irrigation Forecasting
Linear regression forecasting, z-score anomaly detection,
trend analysis with olive-specific recommendations.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
from app.supabase_client import get_supabase_admin
from app.logging_config import logger, debug, debug_service_call

# Column units for display
COLUMN_UNITS = {
    "air_temperature_c": "°C",
    "air_humidity_pct": "%",
    "air_pressure_hpa": "hPa",
    "light_intensity_lux": "lux",
    "reservoir_level_pct": "%",
    "main_pressure_mpa": "MPa",
    "zone_flow_lpm": "L/min",
    "zone_pressure_mpa": "MPa",
    "soil_moisture_pct": "%",
    "solar_radiation_wm2": "W/m²",
    "precipitation_mm": "mm",
    "wind_speed_kmh": "km/h",
    "cloud_cover_pct": "%",
    "stress_score": "0-1",
    "health_score": "0-10",
}

# Map columns to their v3 table
_ENV_COLS = {"air_temperature_c", "air_humidity_pct", "air_pressure_hpa",
             "light_intensity_lux", "solar_radiation_wm2", "precipitation_mm",
             "wind_speed_kmh", "cloud_cover_pct"}
_INFRA_COLS = {"reservoir_level_pct", "main_pressure_mpa", "main_pump_flow_lpm", "filter_status"}
_ZONE_HEALTH_COLS = {"stress_score", "health_score", "avg_soil_moisture_pct",
                     "water_efficiency_pct", "leak_count"}


def _table_for_column(col: str) -> str:
    """Return the v3 table name for a given column."""
    if col in _ENV_COLS:
        return "environment_readings"
    if col in _INFRA_COLS:
        return "infrastructure_readings"
    if col in _ZONE_HEALTH_COLS:
        return "zone_health_readings"
    # Fallback — try environment
    return "environment_readings"

# Olive thresholds for recommendation context
OLIVE_LIMITS = {
    "soil_moisture_pct": (30, 55),
    "air_temperature_c": (15, 30),
    "air_humidity_pct": (40, 70),
    "reservoir_level_pct": (40, 100),
    "stress_score": (0, 0.4),
    "health_score": (6, 10),
}


async def forecast(
    farm_id: str,
    target_column: str,
    zone_id: Optional[int],
    lookback_hours: int,
    forecast_hours: int,
) -> dict:
    """Linear regression forecast on a time-series column"""
    debug(f"[Prediction Service] Forecast request: farm={farm_id[:8]}, column={target_column}, zone={zone_id}, lookback={lookback_hours}h, forecast={forecast_hours}h")
    supabase = get_supabase_admin()
    since = (datetime.now(timezone.utc) - timedelta(hours=lookback_hours)).isoformat()

    table = _table_for_column(target_column)
    query = (
        supabase.table(table)
        .select(f"timestamp,{target_column}")
        .eq("farm_id", farm_id)
        .gte("timestamp", since)
        .order("timestamp", desc=False)
        .limit(5000)
    )
    if zone_id is not None and table == "zone_health_readings":
        query = query.eq("zone_id", zone_id)

    result = query.execute()
    rows = [r for r in (result.data or []) if r.get(target_column) is not None]
    debug(f"[Prediction Service] Fetched {len(rows)} rows for forecast")

    if len(rows) < 6:
        return {
            "target_column": target_column,
            "zone_id": zone_id,
            "model": "insufficient_data",
            "accuracy_r2": None,
            "trend_direction": "unknown",
            "trend_slope_per_hour": 0,
            "current_value": None,
            "forecast": [],
            "recommendations": [f"Need at least 6 data points. Only found {len(rows)}."],
        }

    # Prepare time-indexed values
    t0 = datetime.fromisoformat(rows[0]["timestamp"].replace("Z", "+00:00"))
    xs = []  # hours since t0
    ys = []
    for r in rows:
        ts = datetime.fromisoformat(r["timestamp"].replace("Z", "+00:00"))
        xs.append((ts - t0).total_seconds() / 3600)
        ys.append(r[target_column])

    # Linear regression
    n = len(xs)
    sum_x = sum(xs)
    sum_y = sum(ys)
    sum_xy = sum(x * y for x, y in zip(xs, ys))
    sum_x2 = sum(x * x for x in xs)

    denom = n * sum_x2 - sum_x * sum_x
    if abs(denom) < 1e-12:
        slope = 0.0
        intercept = sum_y / n
    else:
        slope = (n * sum_xy - sum_x * sum_y) / denom
        intercept = (sum_y - slope * sum_x) / n

    # R² score
    y_mean = sum_y / n
    ss_tot = sum((y - y_mean) ** 2 for y in ys)
    ss_res = sum((y - (slope * x + intercept)) ** 2 for x, y in zip(xs, ys))
    r2 = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0.0

    # Residual std for confidence bands
    residuals = [y - (slope * x + intercept) for x, y in zip(xs, ys)]
    res_std = _std(residuals)

    # Trend direction
    if abs(slope) < 0.01:
        trend = "stable"
    elif slope > 0:
        trend = "rising"
    else:
        trend = "falling"

    # Generate forecast points
    last_x = xs[-1]
    last_ts = datetime.fromisoformat(rows[-1]["timestamp"].replace("Z", "+00:00"))
    forecast_points = []
    for h in range(1, forecast_hours + 1):
        x_pred = last_x + h
        y_pred = slope * x_pred + intercept
        pred_ts = last_ts + timedelta(hours=h)
        forecast_points.append({
            "timestamp": pred_ts.isoformat(),
            "predicted_value": round(y_pred, 4),
            "lower_bound": round(y_pred - 1.96 * res_std, 4),
            "upper_bound": round(y_pred + 1.96 * res_std, 4),
        })

    # Recommendations
    unit = COLUMN_UNITS.get(target_column, "")
    recs = []
    limits = OLIVE_LIMITS.get(target_column)
    final_pred = forecast_points[-1]["predicted_value"] if forecast_points else ys[-1]

    if limits:
        lo, hi = limits
        if final_pred < lo:
            recs.append(f"📉 Forecast shows {target_column.replace('_', ' ')} dropping to "
                       f"{final_pred:.2f}{unit} (below optimal {lo}{unit}). Take preventive action.")
        elif final_pred > hi:
            recs.append(f"📈 Forecast shows {target_column.replace('_', ' ')} rising to "
                       f"{final_pred:.2f}{unit} (above optimal {hi}{unit}). Monitor closely.")

    if r2 < 0.3:
        recs.append(f"⚠️ Model accuracy is low (R²={r2:.3f}). Data may be too noisy for reliable linear forecast.")
    elif r2 > 0.8:
        recs.append(f"✅ High confidence forecast (R²={r2:.3f}).")

    # Save prediction
    try:
        supabase.table("predictions").insert({
            "farm_id": farm_id,
            "prediction_type": "forecast",
            "target_column": target_column,
            "zone_id": zone_id,
            "model_used": "linear_regression",
            "accuracy_score": round(r2, 4),
            "result": {
                "trend": trend,
                "slope_per_hour": round(slope, 6),
                "forecast_hours": forecast_hours,
                "r2": round(r2, 4),
            },
        }).execute()
    except Exception as e:
        logger.error("Failed to save prediction", error=str(e))

    debug(f"[Prediction Service] Forecast complete: trend={trend}, r2={r2:.4f}, slope={slope:.6f}, current={ys[-1]:.4f}, forecast_points={len(forecast_points)}")
    return {
        "target_column": target_column,
        "zone_id": zone_id,
        "model": "linear_regression",
        "accuracy_r2": round(r2, 4),
        "trend_direction": trend,
        "trend_slope_per_hour": round(slope, 6),
        "current_value": round(ys[-1], 4),
        "forecast": forecast_points,
        "recommendations": recs,
    }


async def detect_anomalies(
    farm_id: str,
    target_column: str,
    zone_id: Optional[int],
    lookback_hours: int,
    z_threshold: float,
) -> dict:
    """Z-score anomaly detection"""
    debug(f"[Prediction Service] Anomaly detection: farm={farm_id[:8]}, column={target_column}, zone={zone_id}, lookback={lookback_hours}h, z_threshold={z_threshold}")
    supabase = get_supabase_admin()
    since = (datetime.now(timezone.utc) - timedelta(hours=lookback_hours)).isoformat()

    table = _table_for_column(target_column)
    query = (
        supabase.table(table)
        .select(f"timestamp,{target_column}")
        .eq("farm_id", farm_id)
        .gte("timestamp", since)
        .order("timestamp", desc=False)
        .limit(5000)
    )
    if zone_id is not None and table == "zone_health_readings":
        query = query.eq("zone_id", zone_id)

    result = query.execute()
    rows = [r for r in (result.data or []) if r.get(target_column) is not None]
    debug(f"[Prediction Service] Fetched {len(rows)} rows for anomaly detection")

    if len(rows) < 10:
        return {
            "target_column": target_column,
            "zone_id": zone_id,
            "total_checked": len(rows),
            "anomalies_found": 0,
            "anomaly_rate_pct": 0,
            "z_threshold": z_threshold,
            "anomalies": [],
            "recommendations": [f"Need at least 10 data points. Only found {len(rows)}."],
        }

    values = [r[target_column] for r in rows]
    mean = sum(values) / len(values)
    std = _std(values)

    anomalies = []
    if std > 0:
        for r, v in zip(rows, values):
            z = abs(v - mean) / std
            if z >= z_threshold:
                anomalies.append({
                    "timestamp": r["timestamp"],
                    "value": round(v, 4),
                    "z_score": round(z, 3),
                    "expected_range": {
                        "min": round(mean - z_threshold * std, 4),
                        "max": round(mean + z_threshold * std, 4),
                    },
                })

    recs = []
    rate = len(anomalies) / len(rows) * 100
    if rate > 10:
        recs.append(f"🚨 High anomaly rate ({rate:.1f}%). Sensor may be malfunctioning.")
    elif rate > 3:
        recs.append(f"⚠️ Elevated anomaly rate ({rate:.1f}%). Review sensor calibration.")
    elif anomalies:
        recs.append(f"ℹ️ {len(anomalies)} anomalies found. Check timestamps for patterns.")
    else:
        recs.append("✅ No anomalies detected. Sensor data appears normal.")

    # Save prediction
    try:
        supabase.table("predictions").insert({
            "farm_id": farm_id,
            "prediction_type": "anomaly",
            "target_column": target_column,
            "zone_id": zone_id,
            "model_used": "z_score",
            "accuracy_score": None,
            "result": {
                "z_threshold": z_threshold,
                "anomalies_found": len(anomalies),
                "rate_pct": round(rate, 2),
            },
        }).execute()
    except Exception as e:
        logger.error("Failed to save anomaly prediction", error=str(e))

    return {
        "target_column": target_column,
        "zone_id": zone_id,
        "total_checked": len(rows),
        "anomalies_found": len(anomalies),
        "anomaly_rate_pct": round(rate, 2),
        "z_threshold": z_threshold,
        "anomalies": anomalies[:50],  # Cap at 50
        "recommendations": recs,
    }


async def get_prediction_history(farm_id: str, limit: int = 20) -> list[dict]:
    """Get past predictions"""
    supabase = get_supabase_admin()
    result = (
        supabase.table("predictions")
        .select("*")
        .eq("farm_id", farm_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []


def _std(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((x - mean) ** 2 for x in values) / (len(values) - 1)
    return variance ** 0.5
