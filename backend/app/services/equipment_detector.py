"""
Equipment Anomaly Detector
Detects pump degradation, pump failure imminent, reservoir issues.
Uses trend analysis over recent infrastructure readings.
"""
from typing import Optional
from app.logging_config import logger

# ── Thresholds ──────────────────────────────────────────────────────
PUMP_DEGRADATION_WINDOW = 20        # readings to compute degradation trend
PUMP_DEGRADATION_SLOPE = -0.3       # LPM per reading = declining

PUMP_FAILURE_WINDOW = 6             # ~30 min at 5-min intervals
PUMP_FAILURE_PRESSURE_SLOPE = -0.01  # MPA per reading
PUMP_FAILURE_FLOW_SLOPE = -0.5       # LPM per reading

RESERVOIR_CRITICAL_PCT = 15.0        # below this = critical
RESERVOIR_LEAK_SLOPE = -0.5          # % per reading when no zones active


def _linear_slope(values: list[float]) -> float:
    n = len(values)
    if n < 2:
        return 0.0
    x_mean = (n - 1) / 2.0
    y_mean = sum(values) / n
    num = sum((i - x_mean) * (v - y_mean) for i, v in enumerate(values))
    den = sum((i - x_mean) ** 2 for i in range(n))
    return num / den if den > 0 else 0.0


def _make_event(
    anomaly_type: str,
    severity: str,
    confidence_score: float,
    zone_id: Optional[str],
    target_columns: list[str],
    details: dict,
    actual_value: Optional[float] = None,
    baseline_value: Optional[float] = None,
) -> dict:
    return {
        "anomaly_type": anomaly_type,
        "severity": severity,
        "confidence_score": round(confidence_score, 3),
        "detection_method": "equipment_rule",
        "zone_id": zone_id,
        "branch_id": None,
        "target_columns": target_columns,
        "details": details,
        "actual_value": actual_value,
        "baseline_value": baseline_value,
    }


# ── Detector 1: Pump Degradation ────────────────────────────────────

def detect_pump_degradation(infra_readings: list[dict]) -> list[dict]:
    """
    Gradual decline in pump flow output across many readings.
    Requires PUMP_DEGRADATION_WINDOW readings.
    """
    if len(infra_readings) < PUMP_DEGRADATION_WINDOW:
        return []

    recent = infra_readings[-PUMP_DEGRADATION_WINDOW:]
    flows = [r.get("main_pump_flow_lpm") for r in recent if r.get("main_pump_flow_lpm") is not None]

    if len(flows) < PUMP_DEGRADATION_WINDOW // 2:
        return []

    slope = _linear_slope(flows)
    avg_flow = sum(flows) / len(flows)

    if slope < PUMP_DEGRADATION_SLOPE and avg_flow > 5.0:
        # Normalize confidence: worse slope = higher confidence
        confidence = min(abs(slope) / (abs(PUMP_DEGRADATION_SLOPE) * 5), 1.0)
        return [_make_event(
            anomaly_type="PUMP_DEGRADATION",
            severity="medium",
            confidence_score=confidence,
            zone_id=None,
            target_columns=["main_pump_flow_lpm"],
            details={
                "flow_slope_lpm_per_reading": round(slope, 4),
                "avg_flow_lpm": round(avg_flow, 2),
                "window_readings": PUMP_DEGRADATION_WINDOW,
                "first_flow_lpm": round(flows[0], 2),
                "last_flow_lpm": round(flows[-1], 2),
            },
            actual_value=round(flows[-1], 2),
            baseline_value=round(flows[0], 2),
        )]

    return []


# ── Detector 2: Pump Failure Imminent ───────────────────────────────

def detect_pump_failure_imminent(infra_readings: list[dict]) -> list[dict]:
    """
    Both flow AND pressure simultaneously declining — imminent failure.
    Short window (30 min) for fast response.
    """
    if len(infra_readings) < PUMP_FAILURE_WINDOW:
        return []

    recent = infra_readings[-PUMP_FAILURE_WINDOW:]
    flows = [r.get("main_pump_flow_lpm") for r in recent if r.get("main_pump_flow_lpm") is not None]
    pressures = [r.get("main_pressure_mpa") for r in recent if r.get("main_pressure_mpa") is not None]

    if len(flows) < 3 or len(pressures) < 3:
        return []

    flow_slope = _linear_slope(flows)
    pressure_slope = _linear_slope(pressures)

    if flow_slope < PUMP_FAILURE_FLOW_SLOPE and pressure_slope < PUMP_FAILURE_PRESSURE_SLOPE:
        confidence = min(
            (abs(flow_slope) / abs(PUMP_FAILURE_FLOW_SLOPE) * 0.5)
            + (abs(pressure_slope) / abs(PUMP_FAILURE_PRESSURE_SLOPE) * 0.5),
            1.0,
        )
        return [_make_event(
            anomaly_type="PUMP_FAILURE_IMMINENT",
            severity="critical",
            confidence_score=confidence,
            zone_id=None,
            target_columns=["main_pump_flow_lpm", "main_pressure_mpa"],
            details={
                "flow_slope_lpm_per_reading": round(flow_slope, 4),
                "pressure_slope_mpa_per_reading": round(pressure_slope, 6),
                "current_flow_lpm": round(flows[-1], 2),
                "current_pressure_mpa": round(pressures[-1], 3),
            },
            actual_value=round(flows[-1], 2),
        )]

    return []


# ── Detector 3: Reservoir Critical ──────────────────────────────────

def detect_reservoir_critical(infra_reading: dict) -> list[dict]:
    """
    Reservoir level below critical operational threshold.
    """
    level = infra_reading.get("reservoir_level_pct")
    if level is None:
        return []

    if level < RESERVOIR_CRITICAL_PCT:
        severity = "critical" if level < 5.0 else "high"
        confidence = min((RESERVOIR_CRITICAL_PCT - level) / RESERVOIR_CRITICAL_PCT, 1.0)
        return [_make_event(
            anomaly_type="RESERVOIR_CRITICAL",
            severity=severity,
            confidence_score=confidence,
            zone_id=None,
            target_columns=["reservoir_level_pct"],
            details={
                "level_pct": round(level, 1),
                "threshold_pct": RESERVOIR_CRITICAL_PCT,
            },
            actual_value=round(level, 1),
            baseline_value=RESERVOIR_CRITICAL_PCT,
        )]

    return []


# ── Detector 4: Reservoir Leak ───────────────────────────────────────

def detect_reservoir_leak(infra_readings: list[dict], active_zones_count: int) -> list[dict]:
    """
    Reservoir level dropping when no irrigation is active — possible leak.
    """
    if active_zones_count > 0:
        return []  # Normal: level drops during active irrigation

    if len(infra_readings) < 6:
        return []

    recent = infra_readings[-12:]
    levels = [r.get("reservoir_level_pct") for r in recent if r.get("reservoir_level_pct") is not None]

    if len(levels) < 4:
        return []

    slope = _linear_slope(levels)

    if slope < RESERVOIR_LEAK_SLOPE:
        confidence = min(abs(slope) / abs(RESERVOIR_LEAK_SLOPE * 3), 1.0)
        return [_make_event(
            anomaly_type="RESERVOIR_LEAK",
            severity="high",
            confidence_score=confidence,
            zone_id=None,
            target_columns=["reservoir_level_pct"],
            details={
                "level_slope_pct_per_reading": round(slope, 4),
                "active_zones": active_zones_count,
                "current_level_pct": round(levels[-1], 1),
            },
            actual_value=round(slope, 4),
            baseline_value=0.0,
        )]

    return []


# ── Main entry point ─────────────────────────────────────────────────

async def run_equipment_detectors(
    farm_id: str,
    infra_readings: list[dict],
    active_zones_count: int = 0,
) -> list[dict]:
    """
    Run all equipment detectors and return combined anomaly list.
    Called from anomaly_service.analyze_reading_batch().
    """
    anomalies: list[dict] = []

    try:
        anomalies.extend(detect_pump_degradation(infra_readings))
    except Exception as e:
        logger.warning(f"[EquipmentDetector] pump_degradation error: {e}")

    try:
        anomalies.extend(detect_pump_failure_imminent(infra_readings))
    except Exception as e:
        logger.warning(f"[EquipmentDetector] pump_failure_imminent error: {e}")

    try:
        if infra_readings:
            anomalies.extend(detect_reservoir_critical(infra_readings[-1]))
    except Exception as e:
        logger.warning(f"[EquipmentDetector] reservoir_critical error: {e}")

    try:
        anomalies.extend(detect_reservoir_leak(infra_readings, active_zones_count))
    except Exception as e:
        logger.warning(f"[EquipmentDetector] reservoir_leak error: {e}")

    if anomalies:
        logger.info(
            f"[EquipmentDetector] {len(anomalies)} anomaly(s) detected for farm {farm_id[:8]}",
            extra={"farm_id": farm_id, "count": len(anomalies)},
        )

    return anomalies
