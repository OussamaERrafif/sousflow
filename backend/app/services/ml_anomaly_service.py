"""
ML Anomaly Detection Service — Isolation Forest for detecting multivariate anomalies.
Feature-flagged via ML_ANOMALY_ENABLED config.
"""
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import joblib
import io

from app.supabase_client import get_supabase_admin
from app.logging_config import logger


FEATURE_COLUMNS = [
    "soil_moisture_pct",
    "air_temperature_c",
    "air_humidity_pct",
    "zone_flow_lpm",
    "reservoir_level_pct",
]


class IsolationForestDetector:
    def __init__(self, contamination: float = 0.1, n_estimators: int = 100):
        self.model = IsolationForest(
            contamination=contamination,
            n_estimators=n_estimators,
            random_state=42,
            n_jobs=-1,
        )
        self.scaler = StandardScaler()
        self._fitted = False

    def fit(self, X: np.ndarray):
        """Fit the model on historical data."""
        if len(X) < 20:
            logger.warning(f"Not enough data to train IsolationForest: {len(X)} samples")
            return False
        try:
            X_scaled = self.scaler.fit_transform(X)
            self.model.fit(X_scaled)
            self._fitted = True
            logger.info(f"IsolationForest trained on {len(X)} samples")
            return True
        except Exception as e:
            logger.error(f"Failed to train IsolationForest: {e}")
            return False

    def predict(self, X: np.ndarray) -> np.ndarray:
        """Predict anomalies. Returns -1 for anomalies, 1 for normal."""
        if not self._fitted:
            return np.ones(len(X))
        try:
            X_scaled = self.scaler.transform(X)
            return self.model.predict(X_scaled)
        except Exception as e:
            logger.error(f"IsolationForest prediction failed: {e}")
            return np.ones(len(X))

    def score_samples(self, X: np.ndarray) -> np.ndarray:
        """Get anomaly scores (lower = more anomalous)."""
        if not self._fitted:
            return np.zeros(len(X))
        try:
            X_scaled = self.scaler.transform(X)
            return self.model.score_samples(X_scaled)
        except Exception:
            return np.zeros(len(X))


_models: dict[str, IsolationForestDetector] = {}


async def get_or_train_model(farm_id: str) -> Optional[IsolationForestDetector]:
    """Get cached model or train new one if needed."""
    if farm_id in _models:
        return _models[farm_id]

    supabase = get_supabase_admin()
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)

    result = supabase.table("iot_readings").select(
        ",".join(FEATURE_COLUMNS)
    ).eq("farm_id", farm_id).gte("recorded_at", cutoff.isoformat()).execute()

    if not result.data or len(result.data) < 50:
        logger.info(f"Not enough data for ML detection on farm {farm_id}: {len(result.data or [])} readings")
        return None

    X = []
    for row in result.data:
        values = [row.get(col) for col in FEATURE_COLUMNS]
        if all(v is not None for v in values):
            X.append(values)

    if len(X) < 50:
        return None

    X = np.array(X)
    detector = IsolationForestDetector(contamination=0.1)
    if detector.fit(X):
        _models[farm_id] = detector
        return detector

    return None


async def detect_ml_anomalies(
    farm_id: str,
    readings: list[dict],
) -> list[dict]:
    """
    Run ML anomaly detection on readings.
    Returns list of anomalies with detection_method='isolation_forest'.
    """
    from app.config import get_settings as _gs
    enabled = str(getattr(_gs(), "ML_ANOMALY_ENABLED", "false")).lower() == "true"
    if not enabled:
        return []

    detector = await get_or_train_model(farm_id)
    if not detector:
        return []

    anomalies = []

    X = []
    reading_indices = []
    for i, reading in enumerate(readings):
        values = [reading.get(col) for col in FEATURE_COLUMNS]
        if all(v is not None for v in values):
            X.append(values)
            reading_indices.append(i)

    if not X:
        return []

    X = np.array(X)
    predictions = detector.predict(X)
    scores = detector.score_samples(X)

    for idx, (reading_idx, pred, score) in enumerate(zip(reading_indices, predictions, scores)):
        if pred == -1:
            reading = readings[reading_idx]
            anomalies.append({
                "zone_id": reading.get("zone_id"),
                "anomaly_type": "ml_isolation_forest",
                "severity": "high" if score < -0.5 else "medium",
                "target_columns": FEATURE_COLUMNS,
                "details": {
                    "anomaly_score": round(float(score), 3),
                    "threshold": -0.1,
                },
                "confidence_score": round(float(abs(score)) / 2, 2),  # Normalize to 0-1
                "detection_method": "isolation_forest",
            })

    return anomalies


async def retrain_all_models():
    """Retrain models for all farms. Called weekly."""
    supabase = get_supabase_admin()
    farms = supabase.table("farms").select("id").execute()

    for farm in farms.data or []:
        farm_id = farm["id"]
        if farm_id in _models:
            del _models[farm_id]
        await get_or_train_model(farm_id)
        logger.info(f"Retrained ML model for farm {farm_id}")
