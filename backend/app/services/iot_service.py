"""
IoT Service — Olive Irrigation Data Processing
Handles ingestion, querying, zone analysis, dashboard snapshots,
and alert rule evaluation for the 26-column sensor dataset.
Farm-scoped version (farm_id instead of user_id).
"""
from datetime import datetime, timedelta, timezone
from typing import Optional, List
from app.supabase_client import get_supabase_admin
from app.logging_config import logger

ENV_COLUMNS = [
    "timestamp", "air_temperature_c", "air_humidity_pct", "air_pressure_hpa",
    "light_intensity_lux", "solar_radiation_wm2", "precipitation_mm",
    "wind_speed_kmh", "cloud_cover_pct",
]

NUMERIC_COLUMNS = [
    "air_temperature_c", "air_humidity_pct", "air_pressure_hpa", "light_intensity_lux",
    "reservoir_level_pct", "main_pressure_mpa",
    "solar_radiation_wm2", "precipitation_mm", "wind_speed_kmh", "cloud_cover_pct",
    "stress_score", "health_score",
]

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


async def ingest_reading(farm_id: str, reading: dict, recorded_by: Optional[str] = None) -> dict:
    """Insert a single IoT reading into normalized v3 tables"""
    supabase = get_supabase_admin()

    ts_raw = reading.get("timestamp", datetime.now(timezone.utc).isoformat())
    if isinstance(ts_raw, str):
        ts_raw = datetime.fromisoformat(ts_raw.replace("Z", "+00:00"))
    ts_str = ts_raw.isoformat()

    # Environment reading
    env_data = {"farm_id": farm_id, "timestamp": ts_str}
    for col in ["air_temperature_c", "air_humidity_pct", "air_pressure_hpa",
                "light_intensity_lux", "solar_radiation_wm2", "precipitation_mm",
                "wind_speed_kmh", "cloud_cover_pct"]:
        if col in reading:
            env_data[col] = reading[col]
    supabase.table("environment_readings").insert(env_data).execute()

    # Infrastructure reading
    infra_data = {"farm_id": farm_id, "timestamp": ts_str}
    for col in ["reservoir_level_pct", "main_pump_flow_lpm", "main_pressure_mpa", "filter_status"]:
        if col in reading:
            infra_data[col] = reading[col]
    supabase.table("infrastructure_readings").insert(infra_data).execute()

    logger.info("IoT reading inserted (v3)", farm=farm_id[:8])
    return {"farm_id": farm_id, "timestamp": ts_str, **reading}


async def ingest_batch(farm_id: str, readings: list[dict], recorded_by: Optional[str] = None) -> dict:
    """Insert batch of readings into v3 normalized tables"""
    supabase = get_supabase_admin()
    inserted = 0
    failed = 0
    errors = []

    env_rows = []
    infra_rows = []
    zone_health_rows = []

    # Look up zone UUID mapping (integer zone_number → UUID)
    zone_map = {}
    try:
        zones_result = (
            supabase.table("zones")
            .select("id, zone_number")
            .eq("farm_id", farm_id)
            .execute()
        )
        for z in (zones_result.data or []):
            zone_map[z["zone_number"]] = z["id"]
    except Exception:
        pass

    for i, r in enumerate(readings):
        try:
            ts_raw = r.get("timestamp", datetime.now(timezone.utc).isoformat())
            if isinstance(ts_raw, str):
                ts_raw = datetime.fromisoformat(ts_raw.replace("Z", "+00:00"))
            ts_str = ts_raw.isoformat()

            env_data = {"farm_id": farm_id, "timestamp": ts_str}
            for col in ["air_temperature_c", "air_humidity_pct", "air_pressure_hpa",
                        "light_intensity_lux", "solar_radiation_wm2", "precipitation_mm",
                        "wind_speed_kmh", "cloud_cover_pct"]:
                if col in r:
                    env_data[col] = r[col]
            env_rows.append(env_data)

            infra_data = {"farm_id": farm_id, "timestamp": ts_str}
            for col in ["reservoir_level_pct", "main_pump_flow_lpm", "main_pressure_mpa", "filter_status"]:
                if col in r:
                    infra_data[col] = r[col]
            infra_rows.append(infra_data)

            # Zone health reading (per-zone data)
            zone_num = r.get("zone_id")
            zone_uuid = zone_map.get(zone_num) if zone_num is not None else None
            if zone_uuid:
                zone_health_rows.append({
                    "farm_id": farm_id,
                    "zone_id": zone_uuid,
                    "timestamp": ts_str,
                    "avg_soil_moisture_pct": r.get("soil_moisture_pct"),
                    "stress_score": r.get("stress_score"),
                    "stress_class": r.get("stress_class"),
                    "health_score": r.get("health_score"),
                    "irrigation_needed": r.get("irrigation_needed", 0),
                    "is_anomaly": r.get("is_anomaly", 0),
                    "total_inlet_flow_lpm": r.get("zone_flow_lpm"),
                    "water_efficiency_pct": None,
                    "leak_count": 0,
                })

        except Exception as e:
            failed += 1
            errors.append(f"Row {i}: {str(e)}")

    # Deduplicate env rows by timestamp (one per farm per cycle)
    seen_ts = set()
    unique_env = []
    for row in env_rows:
        ts = row["timestamp"]
        if ts not in seen_ts:
            seen_ts.add(ts)
            unique_env.append(row)

    seen_ts_infra = set()
    unique_infra = []
    for row in infra_rows:
        ts = row["timestamp"]
        if ts not in seen_ts_infra:
            seen_ts_infra.add(ts)
            unique_infra.append(row)

    chunk_size = 200
    for start in range(0, len(unique_env), chunk_size):
        chunk = unique_env[start:start + chunk_size]
        try:
            result = supabase.table("environment_readings").insert(chunk).execute()
            inserted += len(result.data) if result.data else 0
        except Exception as e:
            failed += len(chunk)
            errors.append(f"Env chunk {start}: {str(e)}")

    for start in range(0, len(unique_infra), chunk_size):
        chunk = unique_infra[start:start + chunk_size]
        try:
            supabase.table("infrastructure_readings").insert(chunk).execute()
        except Exception as e:
            errors.append(f"Infra chunk {start}: {str(e)}")

    # Persist zone health readings
    for start in range(0, len(zone_health_rows), chunk_size):
        chunk = zone_health_rows[start:start + chunk_size]
        try:
            supabase.table("zone_health_readings").insert(chunk).execute()
        except Exception as e:
            errors.append(f"Zone health chunk {start}: {str(e)}")

    logger.info("Batch ingest complete (v3)", inserted=inserted, failed=failed, farm=farm_id[:8])
    return {"inserted": inserted, "failed": failed, "errors": errors[:10]}


async def query_readings(
    farm_id: str,
    zone_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    columns: Optional[List[str]] = None,
    anomalies_only: bool = False,
    irrigation_only: bool = False,
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    """Query environment readings with filters (v3 schema)"""
    supabase = get_supabase_admin()

    query = supabase.table("environment_readings").select("*").eq("farm_id", farm_id)

    if start_date:
        query = query.gte("timestamp", start_date.isoformat())
    if end_date:
        query = query.lte("timestamp", end_date.isoformat())

    query = query.order("timestamp", desc=True).range(offset, offset + limit - 1)
    result = query.execute()
    return result.data or []


async def get_latest_per_zone(farm_id: str) -> list[dict]:
    """Get the most recent zone health reading for each zone (v3)"""
    return await get_latest_per_zone_health(farm_id)


async def analyze_zone(
    farm_id: str,
    zone_id,
    hours: int = 24,
) -> dict:
    """Analyze a zone over the last N hours (v3 — delegates to hierarchical analysis).
    zone_id can be an int (legacy) or UUID string (v3).
    """
    supabase = get_supabase_admin()

    # If zone_id is an integer (legacy), look up the UUID
    if isinstance(zone_id, int):
        zone_result = (
            supabase.table("zones")
            .select("id")
            .eq("farm_id", farm_id)
            .eq("zone_number", zone_id)
            .limit(1)
            .execute()
        )
        if not zone_result.data:
            return {"zone_id": zone_id, "readings": 0, "message": "Zone not found"}
        zone_uuid = zone_result.data[0]["id"]
    else:
        zone_uuid = str(zone_id)

    return await analyze_zone_hierarchical(farm_id, zone_uuid, hours)


async def get_dashboard(farm_id: str) -> dict:
    """Get a dashboard snapshot (v3 — delegates to hierarchical dashboard)"""
    return await get_hierarchical_dashboard(farm_id)


async def check_alert_rules(farm_id: str, reading: dict) -> list[dict]:
    """Check a reading against active alert rules, return triggered alerts"""
    supabase = get_supabase_admin()

    rules_result = (
        supabase.table("alert_rules")
        .select("*")
        .eq("farm_id", farm_id)
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
                "farm_id": farm_id,
                "rule_id": rule["id"],
                "alert_type": f"{col}_{condition}",
                "zone_id": reading.get("zone_id"),
                "target_column": col,
                "value": val,
                "threshold": threshold,
                "message": _format_alert_message(rule, val, reading),
            }
            try:
                supabase.table("alert_history").insert(alert).execute()
            except Exception as e:
                logger.error("Failed to store alert", error=str(e))
            triggered.append(alert)

    return triggered


async def create_alert_rule(farm_id: str, rule: dict, created_by: Optional[str] = None) -> dict:
    supabase = get_supabase_admin()
    data = {**rule, "farm_id": farm_id}
    if created_by:
        data["created_by"] = created_by
    result = supabase.table("alert_rules").insert(data).execute()
    return result.data[0] if result.data else {}


async def list_alert_rules(farm_id: str) -> list[dict]:
    supabase = get_supabase_admin()
    result = (
        supabase.table("alert_rules")
        .select("*")
        .eq("farm_id", farm_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


async def delete_alert_rule(farm_id: str, rule_id: str) -> bool:
    supabase = get_supabase_admin()
    result = (
        supabase.table("alert_rules")
        .delete()
        .eq("id", rule_id)
        .eq("farm_id", farm_id)
        .execute()
    )
    return bool(result.data)


def _std(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((x - mean) ** 2 for x in values) / (len(values) - 1)
    return variance ** 0.5


def _generate_recommendations(stats: dict, rows: list[dict]) -> list[str]:
    recs = []
    th = OLIVE_THRESHOLDS

    sm = stats.get("soil_moisture_pct", {})
    if sm:
        if sm.get("mean", 50) < th["soil_moisture_pct"]["optimal_min"]:
            recs.append(f"⚠️ Soil moisture low ({sm['mean']:.1f}%). Consider increasing irrigation duration.")
        elif sm.get("mean", 50) > th["soil_moisture_pct"]["optimal_max"]:
            recs.append(f"💧 Soil moisture high ({sm['mean']:.1f}%). Reduce irrigation to prevent root rot.")

    temp = stats.get("air_temperature_c", {})
    if temp:
        if temp.get("max", 0) > th["air_temperature_c"]["danger_max"]:
            recs.append(f"🌡️ Extreme heat detected ({temp['max']:.1f}°C). Activate shading/misting.")
        elif temp.get("min", 20) < th["air_temperature_c"]["danger_min"]:
            recs.append(f"❄️ Frost risk ({temp['min']:.1f}°C). Consider frost protection measures.")

    res = stats.get("reservoir_level_pct", {})
    if res:
        if res.get("mean", 100) < th["reservoir_level_pct"]["critical"]:
            recs.append(f"🚨 Reservoir critically low ({res['mean']:.0f}%). Refill urgently.")
        elif res.get("mean", 100) < th["reservoir_level_pct"]["warning"]:
            recs.append(f"⚠️ Reservoir level dropping ({res['mean']:.0f}%). Plan refill soon.")

    pres = stats.get("main_pressure_mpa", {})
    if pres and pres.get("mean", 0.05) < th["main_pressure_mpa"]["optimal_min"]:
        recs.append("🔧 Main pressure below optimal. Check pump and filter.")

    filter_vals = [r.get("filter_status", 0) for r in rows if r.get("filter_status") is not None]
    if filter_vals and max(filter_vals) >= 2:
        recs.append("🔴 Filter is CLOGGED. Clean or replace immediately.")
    elif filter_vals and max(filter_vals) >= 1:
        recs.append("🟡 Filter partially clogged. Schedule maintenance.")

    stress = stats.get("stress_score", {})
    if stress and stress.get("mean", 0) > th["stress_score"]["moderate"]:
        recs.append(f"🌿 Plant stress elevated (avg {stress['mean']:.3f}). Review all environmental conditions.")

    health = stats.get("health_score", {})
    if health and health.get("mean", 10) < th["health_score"]["poor"]:
        recs.append(f"🔴 Health score POOR ({health['mean']:.1f}/10). Investigate root cause immediately.")
    elif health and health.get("mean", 10) < th["health_score"]["fair"]:
        recs.append(f"🟡 Health score fair ({health['mean']:.1f}/10). Monitor closely.")

    if not recs:
        recs.append("✅ All parameters within optimal ranges for olive cultivation.")

    return recs


def _format_alert_message(rule: dict, value: float, reading: dict) -> str:
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


# =============================================================================
# Hierarchical IoT Functions (v3 Schema)
# =============================================================================


async def ingest_environment_reading(farm_id: str, reading: dict, recorded_by: Optional[str] = None) -> dict:
    """Insert an environment reading (weather station data)"""
    supabase = get_supabase_admin()
    data = {**reading, "farm_id": farm_id}

    if recorded_by:
        data["recorded_by"] = recorded_by

    if "timestamp" in data:
        ts = data["timestamp"]
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        data["timestamp"] = ts.isoformat()

    result = supabase.table("environment_readings").insert(data).execute()
    logger.info("Environment reading inserted", farm=farm_id[:8])
    return result.data[0] if result.data else {}


async def ingest_infrastructure_reading(farm_id: str, reading: dict, recorded_by: Optional[str] = None) -> dict:
    """Insert an infrastructure reading (reservoir, pump, filter)"""
    supabase = get_supabase_admin()
    data = {**reading, "farm_id": farm_id}

    if recorded_by:
        data["recorded_by"] = recorded_by

    if "timestamp" in data:
        ts = data["timestamp"]
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        data["timestamp"] = ts.isoformat()

    result = supabase.table("infrastructure_readings").insert(data).execute()
    logger.info("Infrastructure reading inserted", farm=farm_id[:8])
    return result.data[0] if result.data else {}


async def ingest_branch_flow_reading(farm_id: str, branch_id: str, zone_id: str, reading: dict, recorded_by: Optional[str] = None) -> dict:
    """Insert a branch flow reading (inlet + outlet per branch)"""
    supabase = get_supabase_admin()
    data = {
        **reading,
        "farm_id": farm_id,
        "branch_id": branch_id,
        "zone_id": zone_id,
    }

    if recorded_by:
        data["recorded_by"] = recorded_by

    if "timestamp" in data:
        ts = data["timestamp"]
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        data["timestamp"] = ts.isoformat()

    inlet = reading.get("inlet_flow_lpm", 0) or 0
    outlet = reading.get("outlet_flow_lpm", 0) or 0
    data["leak_detected"] = (inlet - outlet) > 0.5

    result = supabase.table("branch_flow_readings").insert(data).execute()
    logger.info("Branch flow reading inserted", branch=branch_id[:8], farm=farm_id[:8])
    return result.data[0] if result.data else {}


async def ingest_soil_moisture_reading(farm_id: str, branch_id: str, zone_id: str, reading: dict, recorded_by: Optional[str] = None) -> dict:
    """Insert a soil moisture reading (3 sensors per branch)"""
    supabase = get_supabase_admin()
    data = {
        **reading,
        "farm_id": farm_id,
        "branch_id": branch_id,
        "zone_id": zone_id,
    }

    if recorded_by:
        data["recorded_by"] = recorded_by

    if "timestamp" in data:
        ts = data["timestamp"]
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        data["timestamp"] = ts.isoformat()

    start = reading.get("moisture_start_pct") or 0
    middle = reading.get("moisture_middle_pct") or 0
    end = reading.get("moisture_end_pct") or 0

    if start and middle and end:
        max_diff = max(start, middle, end) - min(start, middle, end)
        data["uniformity_coefficient"] = max(0, 100 - (max_diff / max(start, middle, end) * 100)) if max(start, middle, end) > 0 else 100

    result = supabase.table("soil_moisture_readings").insert(data).execute()
    logger.info("Soil moisture reading inserted", branch=branch_id[:8], farm=farm_id[:8])
    return result.data[0] if result.data else {}


async def ingest_zone_health_reading(farm_id: str, zone_id: str, reading: dict, recorded_by: Optional[str] = None) -> dict:
    """Insert a zone health reading (aggregated per zone)"""
    supabase = get_supabase_admin()
    data = {
        **reading,
        "farm_id": farm_id,
        "zone_id": zone_id,
    }

    if recorded_by:
        data["recorded_by"] = recorded_by

    if "timestamp" in data:
        ts = data["timestamp"]
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        data["timestamp"] = ts.isoformat()

    result = supabase.table("zone_health_readings").insert(data).execute()
    logger.info("Zone health reading inserted", zone=zone_id[:8], farm=farm_id[:8])
    return result.data[0] if result.data else {}


async def get_latest_environment(farm_id: str) -> Optional[dict]:
    """Get the most recent environment reading"""
    supabase = get_supabase_admin()
    result = (
        supabase.table("environment_readings")
        .select("*")
        .eq("farm_id", farm_id)
        .order("timestamp", desc=True)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


async def get_latest_infrastructure(farm_id: str) -> Optional[dict]:
    """Get the most recent infrastructure reading"""
    supabase = get_supabase_admin()
    result = (
        supabase.table("infrastructure_readings")
        .select("*")
        .eq("farm_id", farm_id)
        .order("timestamp", desc=True)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


async def get_latest_per_branch(farm_id: str, zone_id: Optional[str] = None) -> list[dict]:
    """Get the most recent branch flow reading for each branch in a zone/farm"""
    supabase = get_supabase_admin()

    query = (
        supabase.table("branch_flow_readings")
        .select("branch_id, zone_id")
        .eq("farm_id", farm_id)
    )

    if zone_id:
        query = query.eq("zone_id", zone_id)

    branches_result = query.execute()

    if not branches_result.data:
        return []

    branch_ids = sorted(set(r["branch_id"] for r in branches_result.data))
    latest = []

    for bid in branch_ids:
        result = (
            supabase.table("branch_flow_readings")
            .select("*")
            .eq("branch_id", bid)
            .order("timestamp", desc=True)
            .limit(1)
            .execute()
        )
        if result.data:
            latest.append(result.data[0])

    return latest


async def get_latest_per_zone_health(farm_id: str) -> list[dict]:
    """Get the most recent zone health reading for each zone"""
    supabase = get_supabase_admin()

    zones_result = (
        supabase.table("zones")
        .select("id")
        .eq("farm_id", farm_id)
        .eq("is_active", True)
        .execute()
    )

    if not zones_result.data:
        return []

    zone_ids = sorted(set(r["id"] for r in zones_result.data))
    latest = []

    for zid in zone_ids:
        result = (
            supabase.table("zone_health_readings")
            .select("*")
            .eq("zone_id", zid)
            .order("timestamp", desc=True)
            .limit(1)
            .execute()
        )
        if result.data:
            latest.append(result.data[0])

    return latest


async def get_hierarchical_dashboard(farm_id: str) -> dict:
    """Get a dashboard snapshot with hierarchical data"""
    supabase = get_supabase_admin()

    env = await get_latest_environment(farm_id)
    infra = await get_latest_infrastructure(farm_id)
    branch_flows = await get_latest_per_branch(farm_id)
    zone_healths = await get_latest_per_zone_health(farm_id)

    zones_result = (
        supabase.table("zones")
        .select("id, name, zone_number")
        .eq("farm_id", farm_id)
        .eq("is_active", True)
        .execute()
    )
    zones = zones_result.data or []

    total_zones = len(zones)
    total_branches = len(branch_flows)
    active_valves = sum(1 for b in branch_flows if b.get("valve_open") == 1)
    leaks_detected = sum(1 for b in branch_flows if b.get("leak_detected") == True)

    avg_moisture = None
    if zone_healths:
        moistures = [z.get("avg_soil_moisture_pct") for z in zone_healths if z.get("avg_soil_moisture_pct")]
        if moistures:
            avg_moisture = round(sum(moistures) / len(moistures), 1)

    avg_efficiency = None
    if zone_healths:
        efficiencies = [z.get("water_efficiency_pct") for z in zone_healths if z.get("water_efficiency_pct")]
        if efficiencies:
            avg_efficiency = round(sum(efficiencies) / len(efficiencies), 1)

    # Compute legacy-compatible fields for frontend fallback
    health_scores = [z.get("health_score") for z in zone_healths if z.get("health_score") is not None]
    stress_scores = [z.get("stress_score") for z in zone_healths if z.get("stress_score") is not None]
    avg_health = round(sum(health_scores) / len(health_scores), 2) if health_scores else None
    avg_stress = round(sum(stress_scores) / len(stress_scores), 4) if stress_scores else None
    reservoir_pct = infra.get("reservoir_level_pct") if infra else None
    filter_st = infra.get("filter_status") if infra else None

    return {
        "environment": env,
        "infrastructure": infra,
        "total_zones": total_zones,
        "total_branches": total_branches,
        "active_valves": active_valves,
        "leaks_detected": leaks_detected,
        "avg_soil_moisture_pct": avg_moisture,
        "avg_water_efficiency_pct": avg_efficiency,
        "zones": total_zones,
        "branch_flows": branch_flows,
        "zone_healths": zone_healths,
        "last_reading_at": (env or infra or {}).get("timestamp"),
        # Legacy compat fields for frontend StatsRow/StatusBanner
        "avg_health_score": avg_health,
        "avg_stress_score": avg_stress,
        "reservoir_level_pct": reservoir_pct,
        "filter_status": filter_st,
    }


async def analyze_zone_hierarchical(
    farm_id: str,
    zone_id: str,
    hours: int = 24,
) -> dict:
    """Analyze a zone with hierarchical data over the last N hours"""
    supabase = get_supabase_admin()
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()

    zone_healths = (
        supabase.table("zone_health_readings")
        .select("*")
        .eq("farm_id", farm_id)
        .eq("zone_id", zone_id)
        .gte("timestamp", since)
        .order("timestamp", desc=False)
        .limit(5000)
        .execute()
    )

    branch_flows = (
        supabase.table("branch_flow_readings")
        .select("*")
        .eq("farm_id", farm_id)
        .eq("zone_id", zone_id)
        .gte("timestamp", since)
        .order("timestamp", desc=False)
        .limit(5000)
        .execute()
    )

    soil_moistures = (
        supabase.table("soil_moisture_readings")
        .select("*")
        .eq("farm_id", farm_id)
        .eq("zone_id", zone_id)
        .gte("timestamp", since)
        .order("timestamp", desc=False)
        .limit(5000)
        .execute()
    )

    zone_health_rows = zone_healths.data or []
    branch_flow_rows = branch_flows.data or []
    soil_moisture_rows = soil_moistures.data or []

    if not zone_health_rows:
        return {"zone_id": zone_id, "readings": 0, "message": "No data in this period"}

    avg_moisture = [r["avg_soil_moisture_pct"] for r in zone_health_rows if r.get("avg_soil_moisture_pct")]
    avg_efficiency = [r["water_efficiency_pct"] for r in zone_health_rows if r.get("water_efficiency_pct")]
    leak_counts = [r["leak_count"] for r in zone_health_rows if r.get("leak_count")]
    stress_scores = [r["stress_score"] for r in zone_health_rows if r.get("stress_score")]

    total_leaks = sum(leak_counts)

    recommendations = []
    if avg_moisture:
        avg = sum(avg_moisture) / len(avg_moisture)
        if avg < 25:
            recommendations.append("⚠️ Soil moisture critically low. Increase irrigation immediately.")
        elif avg < 35:
            recommendations.append("⚠️ Soil moisture below optimal. Consider extending irrigation.")
        elif avg > 60:
            recommendations.append("💧 Soil moisture high. Reduce irrigation to prevent root rot.")

    if avg_efficiency:
        avg_eff = sum(avg_efficiency) / len(avg_efficiency)
        if avg_eff < 70:
            recommendations.append(f"⚠️ Water efficiency low ({avg_eff:.0f}%). Check for leaks or blockages.")
        elif avg_eff > 95:
            recommendations.append("✅ Excellent water efficiency!")

    if total_leaks > 5:
        recommendations.append(f"🔴 {total_leaks} leak events detected. Inspect irrigation lines.")

    if not recommendations:
        recommendations.append("✅ All parameters within optimal ranges.")

    return {
        "zone_id": zone_id,
        "period_hours": hours,
        "zone_health_readings": len(zone_health_rows),
        "branch_flow_readings": len(branch_flow_rows),
        "soil_moisture_readings": len(soil_moisture_rows),
        "avg_soil_moisture_pct": round(sum(avg_moisture) / len(avg_moisture), 1) if avg_moisture else None,
        "avg_water_efficiency_pct": round(sum(avg_efficiency) / len(avg_efficiency), 1) if avg_efficiency else None,
        "total_leak_events": total_leaks,
        "avg_stress_score": round(sum(stress_scores) / len(stress_scores), 3) if stress_scores else None,
        "recommendations": recommendations,
    }
