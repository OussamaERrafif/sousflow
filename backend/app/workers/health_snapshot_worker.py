"""
Health Snapshot Worker — Hourly task to compute and store farm health snapshots.
"""
import asyncio
from datetime import datetime, timezone
from app.services.health_service import compute_health_scores
from app.supabase_client import get_supabase_admin
from app.logging_config import logger


async def run_health_worker(interval_hours: int = 1, enabled: bool = True):
    """
    Background worker that computes health snapshots every `interval_hours`.
    """
    if not enabled:
        logger.info("Health snapshot worker is disabled")
        return

    logger.info(f"Starting health snapshot worker (interval={interval_hours}h)")

    while True:
        try:
            supabase = get_supabase_admin()
            farms = supabase.table("farms").select("id").execute()

            for farm in farms.data or []:
                farm_id = farm["id"]
                logger.info(f"Computing health snapshot for farm {farm_id}...")
                await compute_health_scores(farm_id)
                logger.info(f"Health snapshot complete for farm {farm_id}")

            logger.info("All health snapshots computed")
        except Exception as e:
            logger.error(f"Health snapshot worker error: {e}")

        await asyncio.sleep(interval_hours * 3600)
