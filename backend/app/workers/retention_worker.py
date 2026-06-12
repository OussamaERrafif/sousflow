"""
Retention Worker — Periodically purges IoT readings older than IOT_DATA_RETENTION_DAYS.
Runs once at startup (with a brief initial delay) then every 24 hours.
"""
import asyncio
from datetime import datetime, timezone, timedelta

from app.config import get_settings
from app.supabase_client import get_supabase_admin
from app.logging_config import logger


async def run_retention_worker(interval_hours: int = 24, enabled: bool = True) -> None:
    if not enabled:
        logger.info("Retention worker disabled")
        return

    settings = get_settings()
    retention_days = settings.IOT_DATA_RETENTION_DAYS
    logger.info(f"Starting retention worker (retention={retention_days}d, interval={interval_hours}h)")

    # Small initial delay so startup isn't flooded with DB activity
    await asyncio.sleep(60)

    while True:
        try:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=retention_days)).isoformat()
            supabase = get_supabase_admin()

            tables = [
                "iot_readings",
                "environment_readings",
                "infrastructure_readings",
                "branch_flow_readings",
                "soil_moisture_readings",
                "zone_health_readings",
            ]

            for table in tables:
                try:
                    result = supabase.table(table).delete().lt("recorded_at", cutoff).execute()
                    count = len(result.data) if result.data else 0
                    if count:
                        logger.info(f"Retention: deleted {count} rows from {table} older than {retention_days}d")
                except Exception as table_err:
                    # Table may not exist in all deployments — log and continue
                    logger.debug(f"Retention: skipped {table}: {table_err}")

        except Exception as e:
            logger.error(f"Retention worker error: {e}")

        await asyncio.sleep(interval_hours * 3600)
