"""
ML Retrain Worker — Retrains Isolation Forest models for all farms weekly.
Runs once at startup (after a 5-minute delay) then every 7 days.
Only active when ML_ANOMALY_ENABLED=true.
"""
import asyncio

from app.config import get_settings
from app.logging_config import logger


async def run_ml_retrain_worker(interval_days: int = 7) -> None:
    settings = get_settings()
    if not settings.ML_ANOMALY_ENABLED:
        logger.info("ML retrain worker disabled (ML_ANOMALY_ENABLED=false)")
        return

    logger.info(f"Starting ML retrain worker (interval={interval_days}d)")

    # Wait for the server to stabilise and collect initial readings before first train
    await asyncio.sleep(300)

    while True:
        try:
            from app.services.ml_anomaly_service import retrain_all_models
            logger.info("ML retrain worker: starting model refresh for all farms")
            await retrain_all_models()
            logger.info("ML retrain worker: complete")
        except Exception as e:
            logger.error(f"ML retrain worker error: {e}")

        await asyncio.sleep(interval_days * 86_400)
