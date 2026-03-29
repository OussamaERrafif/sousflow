"""
Baseline Computation Service — Computes statistical baselines from historical sensor data.
Runs hourly to update sensor_baselines table with mean, std_dev, min, max, p5, p95.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
from app.supabase_client import get_supabase_admin
from app.logging_config import logger


WINDOW_HOURS = 168


COLUMNS_TO_TRACK = [
    "soil_moisture_pct",
    "air_temperature_c",
    "air_humidity_pct",
    "zone_flow_lpm",
    "reservoir_level_pct",
]


async def compute_baselines_for_farm(
    farm_id: uuid.UUID,
    window_hours: int = WINDOW_HOURS,
) -> int:
    """
    Compute statistical baselines for all zones/branches in a farm.
    Returns number of baselines computed.
    """
    supabase = get_supabase_admin()
    cutoff = datetime.now(timezone.utc) - timedelta(hours=window_hours)

    readings = supabase.table("iot_readings").select(
        "zone_id, branch_id, soil_moisture_pct, air_temperature_c, air_humidity_pct, zone_flow_lpm, reservoir_level_pct, recorded_at"
    ).eq("farm_id", str(farm_id)).gte("recorded_at", cutoff.isoformat()).execute()

    if not readings.data:
        logger.info(f"No readings found for farm {farm_id} in last {window_hours}h")
        return 0

    from collections import defaultdict
    by_zone_branch: dict[tuple[Optional[uuid.UUID], Optional[uuid.UUID]], list[dict]] = defaultdict(list)

    for r in readings.data:
        zone_id = uuid.UUID(r["zone_id"]) if r.get("zone_id") else None
        branch_id = uuid.UUID(r["branch_id"]) if r.get("branch_id") else None
        by_zone_branch[(zone_id, branch_id)].append(r)

    baselines_created = 0

    for (zone_id, branch_id), rows in by_zone_branch.items():
        for col in COLUMNS_TO_TRACK:
            values = [r[col] for r in rows if r.get(col) is not None]
            if len(values) < 10:
                continue

            values_sorted = sorted(values)
            n = len(values_sorted)
            mean_val = sum(values) / n
            variance = sum((x - mean_val) ** 2 for x in values) / (n - 1) if n > 1 else 0
            std_dev = variance ** 0.5
            min_val = min(values)
            max_val = max(values)
            p5 = values_sorted[int(n * 0.05)]
            p95 = values_sorted[int(n * 0.95)]

            baseline = {
                "farm_id": str(farm_id),
                "zone_id": str(zone_id) if zone_id else None,
                "branch_id": str(branch_id) if branch_id else None,
                "column_name": col,
                "window_hours": window_hours,
                "mean": round(mean_val, 4),
                "std_dev": round(std_dev, 4),
                "min_val": round(min_val, 4),
                "max_val": round(max_val, 4),
                "p5": round(p5, 4),
                "p95": round(p95, 4),
                "sample_count": n,
                "computed_at": datetime.now(timezone.utc).isoformat(),
            }

            supabase.table("sensor_baselines").upsert(
                baseline,
                on_conflict="farm_id,zone_id,branch_id,column_name,window_hours"
            ).execute()
            baselines_created += 1

    logger.info(f"Computed {baselines_created} baselines for farm {farm_id}")
    return baselines_created


async def get_baseline(
    farm_id: uuid.UUID,
    column_name: str,
    zone_id: Optional[uuid.UUID] = None,
    branch_id: Optional[uuid.UUID] = None,
    window_hours: int = WINDOW_HOURS,
) -> Optional[dict]:
    """Fetch a single baseline for a sensor column."""
    supabase = get_supabase_admin()
    query = supabase.table("sensor_baselines").select("*").eq("farm_id", str(farm_id)).eq("column_name", column_name).eq("window_hours", window_hours)

    if zone_id:
        query = query.eq("zone_id", str(zone_id))
    else:
        query = query.is_("zone_id", "null")

    if branch_id:
        query = query.eq("branch_id", str(branch_id))
    else:
        query = query.is_("branch_id", "null")

    result = query.limit(1).execute()
    return result.data[0] if result.data else None


async def get_baselines_for_farm(farm_id: uuid.UUID) -> list[dict]:
    """Fetch all baselines for a farm."""
    supabase = get_supabase_admin()
    result = supabase.table("sensor_baselines").select("*").eq("farm_id", str(farm_id)).execute()
    return result.data or []


async def compute_all_farms_baselines() -> dict[str, int]:
    """Compute baselines for all active farms. Returns {farm_id: count}."""
    supabase = get_supabase_admin()
    farms = supabase.table("farms").select("id").execute()
    results = {}
    for farm in farms.data or []:
        farm_id = uuid.UUID(farm["id"])
        count = await compute_baselines_for_farm(farm_id)
        results[str(farm_id)] = count
    return results
