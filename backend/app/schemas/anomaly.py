"""Anomaly detection schemas."""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class AnomalyEvent(BaseModel):
    id: str
    farm_id: str
    zone_id: Optional[str] = None
    branch_id: Optional[str] = None
    anomaly_type: str
    severity: str             # low, medium, high, critical
    target_columns: list[str]
    details: dict
    correlated_anomalies: list[str] = []
    # v4 extended fields
    confidence_score: Optional[float] = None
    detection_method: Optional[str] = None
    baseline_value: Optional[float] = None
    actual_value: Optional[float] = None
    resolution_notes: Optional[str] = None
    false_positive: bool = False
    auto_alert_sent: bool = False
    acknowledged: bool = False
    created_at: datetime


class AnomalyType(BaseModel):
    code: str
    domain: str               # hydraulic, agronomic, equipment, data
    display_name: str
    description: Optional[str] = None
    default_severity: str
    recommended_action: Optional[str] = None
    documentation_url: Optional[str] = None


class AnomalyDashboard(BaseModel):
    total_unacknowledged: int
    by_severity: dict[str, int]
    by_type: dict[str, int]
    recent: list[dict]
    zone_anomaly_counts: dict[str, int]


class AnomalyAcknowledge(BaseModel):
    anomaly_ids: list[str]
    resolution_notes: Optional[str] = None


class AnomalyFilters(BaseModel):
    anomaly_type: Optional[str] = None
    severity: Optional[str] = None
    zone_id: Optional[str] = None
    acknowledged: Optional[bool] = None
    false_positive: Optional[bool] = None
    limit: int = 50
    offset: int = 0
