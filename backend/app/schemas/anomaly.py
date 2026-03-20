"""Anomaly detection schemas."""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class AnomalyEvent(BaseModel):
    id: str
    farm_id: str
    zone_id: Optional[str] = None
    branch_id: Optional[str] = None
    anomaly_type: str         # sudden_change, stuck_sensor, drift, correlation, z_score
    severity: str             # low, medium, high, critical
    target_columns: list[str]
    details: dict             # algorithm-specific: {z_score, value, mean, std, delta, ...}
    correlated_anomalies: list[str] = []
    auto_alert_sent: bool = False
    acknowledged: bool = False
    created_at: datetime


class AnomalyDashboard(BaseModel):
    total_unacknowledged: int
    by_severity: dict[str, int]   # {"critical": 2, "high": 5, "medium": 8, "low": 3}
    by_type: dict[str, int]       # {"stuck_sensor": 3, "z_score": 7, ...}
    recent: list[dict]            # last 20 unacknowledged
    zone_anomaly_counts: dict[str, int]  # {zone_id: count} for badge display


class AnomalyAcknowledge(BaseModel):
    anomaly_ids: list[str]


class AnomalyFilters(BaseModel):
    anomaly_type: Optional[str] = None
    severity: Optional[str] = None
    zone_id: Optional[str] = None
    acknowledged: Optional[bool] = None
    limit: int = 50
    offset: int = 0


class AnomalyInjectRequest(BaseModel):
    """Request to inject an anomaly for a farm (admin/testing)."""
    anomaly_type: str  # low_soil_moisture, irrigation_failure, sensor_error, sensor_fault, pipe_burst, pressure_drop, flow_spike
    severity: str = "medium"  # low, medium, high, critical
    zone_id: Optional[str] = None  # zone UUID (optional, for zone-specific anomalies)
    details: Optional[str] = None  # optional extra details
    send_alerts: bool = True  # whether to send WhatsApp alerts to farm users
