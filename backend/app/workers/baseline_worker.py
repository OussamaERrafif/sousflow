"""
Baseline Worker — Hourly task to recompute statistical baselines for all farms.
"""
import asyncio
from datetime import datetime, timezone
from app.services.baseline_service import compute_all_farms_baselines
from app.logging_config import logger


async def run_baseline_worker(interval_hours: int = 1, enabled: bool = True):
    """
    Background worker that recomputes baselines every `interval_hours`.
    Run via: await run_baseline_worker(interval_hours=1)
    """
    if not enabled:
        logger.info("Baseline worker is disabled")
        return

    logger.info(f"Starting baseline worker (interval={interval_hours}h)")

    while True:
        try:
            start = datetime.now(timezone.utc)
            logger.info("Running baseline computation for all farms...")
            results = await compute_all_farms_baselines()
            elapsed = (datetime.now(timezone.utc) - start).total_seconds()
            logger.info(f"Baseline computation complete in {elapsed:.1f}s. Results: {results}")
        except Exception as e:
            logger.error(f"Baseline worker error: {e}")

        await asyncio.sleep(interval_hours * 3600)
