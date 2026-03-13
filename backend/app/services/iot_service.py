"""
IoT Service — Olive Irrigation Data Processing
Handles ingestion, querying, zone analysis, dashboard snapshots,
and alert rule evaluation for the 26-column sensor dataset.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional, List
from app.supabase_client import get_supabase_admin
from app.logging_config import logger

TABLE = "iot_readings"

# ─── All columns we store (excluding id, user_id, created_at) ───
IOT_COLUMNS = [
    "timestamp", "month", "hour", "zone_id", "plant_type", "plant_species",
    "air_temperature_c", "air_humidity_pct", "air_pressure_hpa", "light_intensity_lux",
    "reservoir_level_pct", "main_pressure_mpa", "filter_status",
    "valve_open", "zone_flow_lpm", "zone_pressure_mpa",
    "soil_moisture_pct",
    "solar_radiation_wm2", "precipitation_mm", "wind_speed_kmh", "cloud_cover_pct",
    "is_anomaly", "stress_score", "stress_class", "health_score", "irrigation_needed",
]

NUMERIC_COLUMNS = [
    "air_temperature_c", "air_humidity_pct", "air_pressure_hpa", "light_intensity_lux",
    "reservoir_level_pct", "main_pressure_mpa",
    "zone_flow_lpm", "zone_pressure_mpa", "soil_moisture_pct",
    "solar_radiation_wm2", "precipitation_mm", "wind_speed_kmh", "cloud_cover_pct",
    "stress_score", "health_score",
]

# Olive-specific thresholds (Olea europaea, Souss-Massa region)
OLIVE_THRESHOLDS = {
    "air_temperature_c": {"optimal_min": 15, "optimal_max": 30, "danger_min": 5, "danger_max": 45},
    "air_humidity_pct": {"optimal_min": 40, "optimal_max": 70, "danger_min": 20, "danger_max": 95},
    "soil_moisture_pct": {"optimal_min": 30, "optimal_max": 55, "danger_min": 20, "danger_max": 80},
    "reservoir_level_pct": {"warning": 40, "critical": 25},
    "main_pressure_mpa": {"optimal_min": 0.04, "optimal_max": 0.15, "danger_max": 0.2},
    "zone_flow_lpm": {"optimal_min": 0.5, "optimal_max": 4.0},
    "stress_score": {"mild": 0.2, "moderate": 0.4, "severe": 0.6},
    "health_score": {"poor": 4.0, "fair": 6.0, "good": 8.0},
}


# ─── Ingest ─────────────────────────────────────────────────────

async def ingest_reading(user_id: str, reading: dict) -> dict:
    """Insert a single IoT reading"""
    supabase = get_supabase_admin()
    data = {**reading, "user_id": user_id}

    # Auto-fill month/hour from timestamp if not provided
    if "timestamp" in data:
        ts = data["timestamp"]
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        if data.get("month") is None:
            data["month"] = ts.month
        if data.get("hour") is None:
            data["hour"] = ts.hour
        data["timestamp"] = ts.isoformat()

    result = supabase.table(TABLE).insert(data).execute()
    logger.info("IoT reading inserted", zone=data.get("zone_id"), user=user_id[:8])
    return result.data[0] if result.data else {}


async def ingest_batch(user_id: str, readings: list[dict]) -> dict:
    """Insert batch of readings (up to 1000)"""
    supabase = get_supabase_admin()
    inserted = 0
    failed = 0
    errors = []

    # Prepare all rows
    rows = []
    for i, r in enumerate(readings):
        try:
            row = {**r, "user_id": user_id}
            if "timestamp" in row:
                ts = row["timestamp"]
                if isinstance(ts, str):
                    ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                if row.get("month") is None:
                    row["month"] = ts.month
                if row.get("hour") is None:
                    row["hour"] = ts.hour
                row["timestamp"] = ts.isoformat()
            rows.append(row)
        except Exception as e:
            failed += 1
            errors.append(f"Row {i}: {str(e)}")

    # Insert in chunks of 200
    chunk_size = 200
    for start in range(0, len(rows), chunk_size):
        chunk = rows[start:start + chunk_size]
        try:
            result = supabase.table(TABLE).insert(chunk).execute()
            inserted += len(result.data) if result.data else 0
        except Exception as e:
            failed += len(chunk)
            errors.append(f"Chunk {start}-{start+len(chunk)}: {str(e)}")

    logger.info("Batch ingest complete", inserted=inserted, failed=failed, user=user_id[:8])
    return {"inserted": inserted, "failed": failed, "errors": errors[:10]}


# ─── Query ──────────────────────────────────────────────────────

async def query_readings(
    user_id: str,
    zone_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    columns: Optional[List[str]] = None,
    anomalies_only: bool = False,
    irrigation_only: bool = False,
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    """Query readings with filters"""
    supabase = get_supabase_admin()

    # Select columns
    select_cols = "*"
    if columns:
        valid = [c for c in columns if c in IOT_COLUMNS]
        if valid:
            select_cols = ",".join(["id", "user_id", "created_at"] + valid)

    query = supabase.table(TABLE).select(select_cols).eq("user_id", user_id)

    if zone_id is not None:
        query = query.eq("zone_id", zone_id)
    if start_date:
        query = query.gte("timestamp", start_date.isoformat())
    if end_date:
        query = query.lte("timestamp", end_date.isoformat())
    if anomalies_only:
        query = query.eq("is_anomaly", 1)
    if irrigation_only:
        query = query.eq("irrigation_needed", 1)

    query = query.order("timestamp", desc=True).range(offset, offset + limit - 1)
    result = query.execute()
    return result.data or []


async def get_latest_per_zone(user_id: str) -> list[dict]:
    """Get the most recent reading for each zone"""
    supabase = get_supabase_admin()
    # Get all zones for this user
    zones_result = (
        supabase.table(TABLE)
        .select("zone_id")
        .eq("user_id", user_id)
        .order("zone_id")
        .execute()
    )

    if not zones_result.data:
        return []

    zone_ids = sorted(set(r["zone_id"] for r in zones_result.data))
    latest = []

    for zid in zone_ids:
        result = (
            supabase.table(TABLE)
            .select("*")
            .eq("user_id", user_id)
            .eq("zone_id", zid)
            .order("timestamp", desc=True)
            .limit(1)
            .execute()
        )
        if result.data:
            latest.append(result.data[0])

    return latest


# ─── Zone Analysis ──────────────────────────────────────────────

async def analyze_zone(
    user_id: str,
    zone_id: int,
    hours: int = 24,
) -> dict:
    """Analyze a zone over the last N hours"""
    supabase = get_supabase_admin()
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()

    result = (
        supabase.table(TABLE)
        .select("*")
        .eq("user_id", user_id)
        .eq("zone_id", zone_id)
        .gte("timestamp", since)
        .order("timestamp", desc=False)
        .limit(5000)
        .execute()
    )

    rows = result.data or []
    if not rows:
        return {"zone_id": zone_id, "readings": 0, "message": "No data in this period"}

    # Compute stats for each numeric column
    stats = {}
    for col in NUMERIC_COLUMNS:
        values = [r[col] for r in rows if r.get(col) is not None]
        if values:
            values_sorted = sorted(values)
            n = len(values_sorted)
            stats[col] = {
                "min": round(values_sorted[0], 4),
                "max": round(values_sorted[-1], 4),
                "mean": round(sum(values) / n, 4),
                "median": round(values_sorted[n // 2], 4),
                "std": round(_std(values), 4),
                "count": n,
            }

    # Count states
    anomaly_count = sum(1 for r in rows if r.get("is_anomaly") == 1)
    irrigation_count = sum(1 for r in rows if r.get("irrigation_needed") == 1)
    valve_open_count = sum(1 for r in rows if r.get("valve_open") == 1)

    # Stress distribution
    stress_dist = {}
    for r in rows:
        sc = r.get("stress_class", "unknown")
        stress_dist[sc] = stress_dist.get(sc, 0) + 1

    # Generate recommendations
    recommendations = _generate_recommendations(stats, rows)

    return {
        "zone_id": zone_id,
        "period_hours": hours,
        "total_readings": len(rows),
        "statistics": stats,
        "anomaly_count": anomaly_count,
        "anomaly_rate_pct": round(anomaly_count / len(rows) * 100, 2),
        "irrigation_needed_count": irrigation_count,
        "valve_open_count": valve_open_count,
        "valve_open_pct": round(valve_open_count / len(rows) * 100, 2),
        "stress_distribution": stress_dist,
        "recommendations": recommendations,
    }


# ─── Dashboard Snapshot ─────────────────────────────────────────

async def get_dashboard(user_id: str) -> dict:
    """Get a dashboard snapshot across all zones"""
    supabase = get_supabase_admin()

    # Get total count
    count_result = (
        supabase.table(TABLE)
        .select("id", count="exact")
        .eq("user_id", user_id)
        .execute()
    )
    total = count_result.count or 0

    if total == 0:
        return {"total_readings": 0, "message": "No data yet"}

    # Get latest readings per zone
    latest = await get_latest_per_zone(user_id)

    # Get last 24h stats
    since_24h = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    recent = (
        supabase.table(TABLE)
        .select("zone_id,soil_moisture_pct,air_temperature_c,air_humidity_pct,"
                "stress_score,health_score,reservoir_level_pct,filter_status,"
                "is_anomaly,irrigation_needed,valve_open")
        .eq("user_id", user_id)
        .gte("timestamp", since_24h)
        .limit(5000)
        .execute()
    )
    recent_rows = recent.data or []

    # Aggregate
    anomalies_24h = sum(1 for r in recent_rows if r.get("is_anomaly") == 1)
    health_scores = [r["health_score"] for r in recent_rows if r.get("health_score") is not None]
    stress_scores = [r["stress_score"] for r in recent_rows if r.get("stress_score") is not None]
    reservoir_vals = [r["reservoir_level_pct"] for r in recent_rows if r.get("reservoir_level_pct") is not None]
    filter_vals = [r["filter_status"] for r in recent_rows if r.get("filter_status") is not None]

    return {
        "total_readings": total,
        "readings_24h": len(recent_rows),
        "zones": len(latest),
        "latest_per_zone": latest,
        "anomalies_24h": anomalies_24h,
        "anomaly_rate_24h_pct": round(anomalies_24h / max(len(recent_rows), 1) * 100, 2),
        "avg_health_score": round(sum(health_scores) / max(len(health_scores), 1), 2) if health_scores else None,
        "avg_stress_score": round(sum(stress_scores) / max(len(stress_scores), 1), 4) if stress_scores else None,
        "reservoir_level_pct": round(reservoir_vals[-1], 1) if reservoir_vals else None,
        "filter_status": filter_vals[-1] if filter_vals else None,
        "last_reading_at": latest[0].get("timestamp") if latest else None,
    }


# ─── Alert Rule Evaluation ──────────────────────────────────────

async def check_alert_rules(user_id: str, reading: dict) -> list[dict]:
    """Check a reading against active alert rules, return triggered alerts"""
    supabase = get_supabase_admin()

    rules_result = (
        supabase.table("alert_rules")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
    )

    if not rules_result.data:
        return []

    triggered = []
    for rule in rules_result.data:
        col = rule["target_column"]
        val = reading.get(col)
        if val is None:
            continue

        # Check zone filter
        if rule.get("zone_id") and reading.get("zone_id") != rule["zone_id"]:
            continue

        threshold = rule["threshold"]
        condition = rule["condition"]
        fire = False

        if condition == "above" and val > threshold:
            fire = True
        elif condition == "below" and val < threshold:
            fire = True
        elif condition == "equals" and val == threshold:
            fire = True

        if fire:
            alert = {
                "user_id": user_id,
                "rule_id": rule["id"],
                "alert_type": f"{col}_{condition}",
                "zone_id": reading.get("zone_id"),
                "target_column": col,
                "value": val,
                "threshold": threshold,
                "message": _format_alert_message(rule, val, reading),
            }
            # Store in history
            try:
                supabase.table("alert_history").insert(alert).execute()
            except Exception as e:
                logger.error("Failed to store alert", error=str(e))
            triggered.append(alert)

    return triggered


# ─── CRUD for Alert Rules ───────────────────────────────────────

async def create_alert_rule(user_id: str, rule: dict) -> dict:
    supabase = get_supabase_admin()
    data = {**rule, "user_id": user_id}
    result = supabase.table("alert_rules").insert(data).execute()
    return result.data[0] if result.data else {}


async def list_alert_rules(user_id: str) -> list[dict]:
    supabase = get_supabase_admin()
    result = (
        supabase.table("alert_rules")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


async def delete_alert_rule(user_id: str, rule_id: str) -> bool:
    supabase = get_supabase_admin()
    result = (
        supabase.table("alert_rules")
        .delete()
        .eq("id", rule_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(result.data)


# ─── Helpers ────────────────────────────────────────────────────

def _std(values: list[float]) -> float:
    """Standard deviation"""
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((x - mean) ** 2 for x in values) / (len(values) - 1)
    return variance ** 0.5


def _generate_recommendations(stats: dict, rows: list[dict]) -> list[str]:
    """Generate agriculture recommendations based on thresholds"""
    recs = []
    th = OLIVE_THRESHOLDS

    # Soil moisture
    sm = stats.get("soil_moisture_pct", {})
    if sm:
        if sm.get("mean", 50) < th["soil_moisture_pct"]["optimal_min"]:
            recs.append(f"⚠️ Soil moisture low ({sm['mean']:.1f}%). Consider increasing irrigation duration.")
        elif sm.get("mean", 50) > th["soil_moisture_pct"]["optimal_max"]:
            recs.append(f"💧 Soil moisture high ({sm['mean']:.1f}%). Reduce irrigation to prevent root rot.")

    # Temperature
    temp = stats.get("air_temperature_c", {})
    if temp:
        if temp.get("max", 0) > th["air_temperature_c"]["danger_max"]:
            recs.append(f"🌡️ Extreme heat detected ({temp['max']:.1f}°C). Activate shading/misting.")
        elif temp.get("min", 20) < th["air_temperature_c"]["danger_min"]:
            recs.append(f"❄️ Frost risk ({temp['min']:.1f}°C). Consider frost protection measures.")

    # Reservoir
    res = stats.get("reservoir_level_pct", {})
    if res:
        if res.get("mean", 100) < th["reservoir_level_pct"]["critical"]:
            recs.append(f"🚨 Reservoir critically low ({res['mean']:.0f}%). Refill urgently.")
        elif res.get("mean", 100) < th["reservoir_level_pct"]["warning"]:
            recs.append(f"⚠️ Reservoir level dropping ({res['mean']:.0f}%). Plan refill soon.")

    # Pressure
    pres = stats.get("main_pressure_mpa", {})
    if pres and pres.get("mean", 0.05) < th["main_pressure_mpa"]["optimal_min"]:
        recs.append("🔧 Main pressure below optimal. Check pump and filter.")

    # Filter
    filter_vals = [r.get("filter_status", 0) for r in rows if r.get("filter_status") is not None]
    if filter_vals and max(filter_vals) >= 2:
        recs.append("🔴 Filter is CLOGGED. Clean or replace immediately.")
    elif filter_vals and max(filter_vals) >= 1:
        recs.append("🟡 Filter partially clogged. Schedule maintenance.")

    # Stress
    stress = stats.get("stress_score", {})
    if stress and stress.get("mean", 0) > th["stress_score"]["moderate"]:
        recs.append(f"🌿 Plant stress elevated (avg {stress['mean']:.3f}). Review all environmental conditions.")

    # Health
    health = stats.get("health_score", {})
    if health and health.get("mean", 10) < th["health_score"]["poor"]:
        recs.append(f"🔴 Health score POOR ({health['mean']:.1f}/10). Investigate root cause immediately.")
    elif health and health.get("mean", 10) < th["health_score"]["fair"]:
        recs.append(f"🟡 Health score fair ({health['mean']:.1f}/10). Monitor closely.")

    if not recs:
        recs.append("✅ All parameters within optimal ranges for olive cultivation.")

    return recs


def _format_alert_message(rule: dict, value: float, reading: dict) -> str:
    """Format alert message for notification"""
    template = rule.get("message_template")
    if template:
        return template.format(
            value=value,
            threshold=rule["threshold"],
            column=rule["target_column"],
            zone=reading.get("zone_id", "?"),
        )

    col = rule["target_column"].replace("_", " ").title()
    cond = rule["condition"]
    return (
        f"🚨 Alert: {col} is {cond} threshold!\n"
        f"Zone {reading.get('zone_id', '?')} | "
        f"Value: {value:.2f} | Threshold: {rule['threshold']:.2f}"
    )
