"""
Hydraulic Rule-Based Anomaly Detector
Tier 1 — pure physics, no ML, no training data required.
Detects: branch leaks, filter clogs, valve stuck open/closed, pressure anomalies.
"""
from typing import Optional
from app.logging_config import logger

# ── Thresholds ──────────────────────────────────────────────────────
LEAK_LOSS_PCT_HIGH = 25.0       # % flow loss = high severity
LEAK_LOSS_PCT_CRITICAL = 50.0   # % flow loss = critical severity

FILTER_PRESSURE_SLOPE = 0.002   # MPA per reading = rising trend
FILTER_FLOW_SLOPE = -0.5        # LPM per reading = falling trend

VALVE_STUCK_OPEN_FLOW = 2.0     # LPM — flow when valve should be closed
VALVE_STUCK_CLOSED_FLOW = 0.5   # LPM — no flow when valve should be open

PRESSURE_MIN_MPA = 0.15         # below this = PRESSURE_ANOMALY_LOW
PRESSURE_MAX_MPA = 0.55         # above this = PRESSURE_ANOMALY_HIGH

DRIPPER_SEVERE_OUTLET_MAX = 0.5   # LPM — near-zero outlet
DRIPPER_CLOG_UNIFORMITY = 0.75    # uniformity coefficient threshold for partial clog

PIPE_BURST_FLOW_CHANGE_PCT = 50   # % sudden flow spike
PIPE_BURST_PRESSURE_CHANGE_PCT = -40  # % sudden pressure drop


def _linear_slope(values: list[float]) -> float:
    """Least-squares slope of a list of values."""
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
    detection_method: str,
    zone_id: Optional[str],
    branch_id: Optional[str],
    target_columns: list[str],
    details: dict,
    actual_value: Optional[float] = None,
    baseline_value: Optional[float] = None,
) -> dict:
    return {
        "anomaly_type": anomaly_type,
        "severity": severity,
        "confidence_score": round(confidence_score, 3),
        "detection_method": detection_method,
        "zone_id": zone_id,
        "branch_id": branch_id,
        "target_columns": target_columns,
        "details": details,
        "actual_value": actual_value,
        "baseline_value": baseline_value,
    }


# ── Detector 1: Branch Leak ─────────────────────────────────────────

def detect_branch_leaks(branch_readings: list[dict]) -> list[dict]:
    """
    Detect leaks by comparing inlet vs outlet flow on each branch.
    Only runs on branches where valve is open.
    """
    anomalies = []
    for r in branch_readings:
        if not r.get("valve_open"):
            continue

        inlet = r.get("inlet_flow_lpm") or 0.0
        outlet = r.get("outlet_flow_lpm") or 0.0

        if inlet <= 0.5:
            continue  # too low to be meaningful

        delta = inlet - outlet
        if delta <= 0:
            continue

        loss_pct = (delta / inlet) * 100.0

        if loss_pct >= LEAK_LOSS_PCT_HIGH:
            severity = "critical" if loss_pct >= LEAK_LOSS_PCT_CRITICAL else "high"
            confidence = min(loss_pct / 50.0, 1.0)
            anomalies.append(_make_event(
                anomaly_type="LEAK_BRANCH",
                severity=severity,
                confidence_score=confidence,
                detection_method="hydraulic_rule",
                zone_id=r.get("zone_id"),
                branch_id=r.get("branch_id"),
                target_columns=["inlet_flow_lpm", "outlet_flow_lpm"],
                details={
                    "inlet_flow_lpm": round(inlet, 2),
                    "outlet_flow_lpm": round(outlet, 2),
                    "flow_delta_lpm": round(delta, 2),
                    "loss_pct": round(loss_pct, 1),
                },
                actual_value=round(delta, 2),
                baseline_value=0.0,
            ))

    return anomalies


# ── Detector 2: Filter Clog ─────────────────────────────────────────

def detect_filter_clog(infra_readings: list[dict]) -> list[dict]:
    """
    Detect filter clog signature: pressure rising while flow falling.
    Needs ≥10 readings to compute trend.
    """
    if len(infra_readings) < 10:
        return []

    recent = infra_readings[-10:]
    pressures = [r.get("main_pressure_mpa") for r in recent if r.get("main_pressure_mpa") is not None]
    flows = [r.get("main_pump_flow_lpm") for r in recent if r.get("main_pump_flow_lpm") is not None]

    if len(pressures) < 5 or len(flows) < 5:
        return []

    pressure_slope = _linear_slope(pressures)
    flow_slope = _linear_slope(flows)

    if pressure_slope > FILTER_PRESSURE_SLOPE and flow_slope < FILTER_FLOW_SLOPE:
        confidence = min(
            (pressure_slope / (FILTER_PRESSURE_SLOPE * 5)) * 0.5
            + (abs(flow_slope) / (abs(FILTER_FLOW_SLOPE) * 5)) * 0.5,
            1.0,
        )
        return [_make_event(
            anomaly_type="FILTER_CLOG_EARLY",
            severity="medium",
            confidence_score=confidence,
            detection_method="hydraulic_rule",
            zone_id=None,
            branch_id=None,
            target_columns=["main_pressure_mpa", "main_pump_flow_lpm"],
            details={
                "pressure_slope_per_reading": round(pressure_slope, 5),
                "flow_slope_per_reading": round(flow_slope, 3),
                "last_pressure_mpa": round(pressures[-1], 3),
                "last_flow_lpm": round(flows[-1], 2),
            },
        )]

    return []


# ── Detector 3: Valve Stuck Open ────────────────────────────────────

def detect_valve_stuck_open(zone_readings: list[dict], control_states: dict) -> list[dict]:
    """
    Flag zones where significant flow is detected but valve should be closed.
    control_states: {zone_id: {"valve_open": bool}}
    """
    anomalies = []
    for z in zone_readings:
        zone_id = str(z.get("zone_id", ""))
        expected_open = control_states.get(zone_id, {}).get("valve_open", True)
        actual_flow = z.get("total_inlet_flow_lpm") or 0.0

        if not expected_open and actual_flow > VALVE_STUCK_OPEN_FLOW:
            anomalies.append(_make_event(
                anomaly_type="VALVE_STUCK_OPEN",
                severity="high",
                confidence_score=min(actual_flow / 10.0, 1.0),
                detection_method="hydraulic_rule",
                zone_id=zone_id or None,
                branch_id=None,
                target_columns=["total_inlet_flow_lpm"],
                details={
                    "expected_state": "closed",
                    "actual_flow_lpm": round(actual_flow, 2),
                },
                actual_value=round(actual_flow, 2),
                baseline_value=0.0,
            ))

    return anomalies


# ── Detector 4: Valve Stuck Closed ─────────────────────────────────

def detect_valve_stuck_closed(zone_readings: list[dict], control_states: dict) -> list[dict]:
    """
    Flag zones where valve should be open but no flow is flowing.
    """
    anomalies = []
    for z in zone_readings:
        zone_id = str(z.get("zone_id", ""))
        expected_open = control_states.get(zone_id, {}).get("valve_open", False)
        actual_flow = z.get("total_inlet_flow_lpm") or 0.0

        if expected_open and actual_flow < VALVE_STUCK_CLOSED_FLOW:
            anomalies.append(_make_event(
                anomaly_type="VALVE_STUCK_CLOSED",
                severity="high",
                confidence_score=0.85,
                detection_method="hydraulic_rule",
                zone_id=zone_id or None,
                branch_id=None,
                target_columns=["total_inlet_flow_lpm"],
                details={
                    "expected_state": "open",
                    "actual_flow_lpm": round(actual_flow, 2),
                },
                actual_value=round(actual_flow, 2),
                baseline_value=None,
            ))

    return anomalies


# ── Detector 5: Pressure Anomaly ────────────────────────────────────

def detect_pressure_anomaly(infra_reading: dict) -> list[dict]:
    """
    Detect main pipeline pressure outside safe operating range.
    """
    anomalies = []
    pressure = infra_reading.get("main_pressure_mpa")
    if pressure is None:
        return []

    if pressure < PRESSURE_MIN_MPA:
        anomalies.append(_make_event(
            anomaly_type="PRESSURE_ANOMALY_LOW",
            severity="high",
            confidence_score=min((PRESSURE_MIN_MPA - pressure) / PRESSURE_MIN_MPA, 1.0),
            detection_method="hydraulic_rule",
            zone_id=None,
            branch_id=None,
            target_columns=["main_pressure_mpa"],
            details={
                "pressure_mpa": round(pressure, 3),
                "threshold_min_mpa": PRESSURE_MIN_MPA,
            },
            actual_value=round(pressure, 3),
            baseline_value=PRESSURE_MIN_MPA,
        ))
    elif pressure > PRESSURE_MAX_MPA:
        anomalies.append(_make_event(
            anomaly_type="PRESSURE_ANOMALY_HIGH",
            severity="high",
            confidence_score=min((pressure - PRESSURE_MAX_MPA) / PRESSURE_MAX_MPA, 1.0),
            detection_method="hydraulic_rule",
            zone_id=None,
            branch_id=None,
            target_columns=["main_pressure_mpa"],
            details={
                "pressure_mpa": round(pressure, 3),
                "threshold_max_mpa": PRESSURE_MAX_MPA,
            },
            actual_value=round(pressure, 3),
            baseline_value=PRESSURE_MAX_MPA,
        ))

    return anomalies


# ── Detector 6: Pipe Burst (multi-sensor) ───────────────────────────

def detect_pipe_burst(prev_infra: dict, curr_infra: dict) -> list[dict]:
    """
    Pipe burst signature: simultaneous extreme flow spike + severe pressure drop.
    Requires two consecutive infrastructure readings.
    """
    if not prev_infra or not curr_infra:
        return []

    prev_flow = prev_infra.get("main_pump_flow_lpm") or 0
    curr_flow = curr_infra.get("main_pump_flow_lpm") or 0
    prev_press = prev_infra.get("main_pressure_mpa") or 0
    curr_press = curr_infra.get("main_pressure_mpa") or 0

    if prev_flow <= 0 or prev_press <= 0:
        return []

    flow_change_pct = ((curr_flow - prev_flow) / prev_flow) * 100
    press_change_pct = ((curr_press - prev_press) / prev_press) * 100

    if flow_change_pct >= PIPE_BURST_FLOW_CHANGE_PCT and press_change_pct <= PIPE_BURST_PRESSURE_CHANGE_PCT:
        return [_make_event(
            anomaly_type="PIPE_BURST",
            severity="critical",
            confidence_score=0.90,
            detection_method="hydraulic_rule",
            zone_id=None,
            branch_id=None,
            target_columns=["main_pump_flow_lpm", "main_pressure_mpa"],
            details={
                "flow_change_pct": round(flow_change_pct, 1),
                "pressure_change_pct": round(press_change_pct, 1),
                "current_flow_lpm": round(curr_flow, 2),
                "current_pressure_mpa": round(curr_press, 3),
            },
        )]

    return []


# ── Detector 7: Severe Dripper Clog ─────────────────────────────────

def detect_dripper_clog(branch_readings: list[dict]) -> list[dict]:
    """
    Detect severe dripper clog: outlet near zero while inlet is normal.
    Detect partial dripper clog: low uniformity coefficient.
    """
    anomalies = []
    for r in branch_readings:
        if not r.get("valve_open"):
            continue

        inlet = r.get("inlet_flow_lpm") or 0.0
        outlet = r.get("outlet_flow_lpm") or 0.0
        uniformity = r.get("uniformity_coefficient")

        # Severe: outlet near zero, inlet normal
        if inlet > 2.0 and outlet <= DRIPPER_SEVERE_OUTLET_MAX:
            anomalies.append(_make_event(
                anomaly_type="DRIPPER_CLOG_SEVERE",
                severity="high",
                confidence_score=min(1.0 - (outlet / inlet), 1.0) if inlet > 0 else 0.9,
                detection_method="hydraulic_rule",
                zone_id=r.get("zone_id"),
                branch_id=r.get("branch_id"),
                target_columns=["outlet_flow_lpm", "inlet_flow_lpm"],
                details={
                    "inlet_flow_lpm": round(inlet, 2),
                    "outlet_flow_lpm": round(outlet, 2),
                },
                actual_value=round(outlet, 2),
                baseline_value=round(inlet, 2),
            ))
        # Partial: low uniformity
        elif uniformity is not None and uniformity < DRIPPER_CLOG_UNIFORMITY and inlet > 1.0:
            anomalies.append(_make_event(
                anomaly_type="DRIPPER_CLOG_PARTIAL",
                severity="medium",
                confidence_score=min((DRIPPER_CLOG_UNIFORMITY - uniformity) / DRIPPER_CLOG_UNIFORMITY, 1.0),
                detection_method="hydraulic_rule",
                zone_id=r.get("zone_id"),
                branch_id=r.get("branch_id"),
                target_columns=["uniformity_coefficient", "outlet_flow_lpm"],
                details={
                    "uniformity_coefficient": round(uniformity, 3),
                    "threshold": DRIPPER_CLOG_UNIFORMITY,
                    "outlet_flow_lpm": round(outlet, 2),
                },
                actual_value=round(uniformity, 3),
                baseline_value=DRIPPER_CLOG_UNIFORMITY,
            ))

    return anomalies


# ── Main entry point ─────────────────────────────────────────────────

async def run_hydraulic_detectors(
    farm_id: str,
    branch_readings: list[dict],
    zone_readings: list[dict],
    infra_readings: list[dict],
    control_states: dict,
) -> list[dict]:
    """
    Run all hydraulic rule-based detectors and return combined anomaly list.
    Called from anomaly_service.analyze_reading_batch().
    """
    anomalies: list[dict] = []

    try:
        anomalies.extend(detect_branch_leaks(branch_readings))
    except Exception as e:
        logger.warning(f"[HydraulicDetector] branch_leak error: {e}")

    try:
        anomalies.extend(detect_filter_clog(infra_readings))
    except Exception as e:
        logger.warning(f"[HydraulicDetector] filter_clog error: {e}")

    try:
        anomalies.extend(detect_valve_stuck_open(zone_readings, control_states))
    except Exception as e:
        logger.warning(f"[HydraulicDetector] valve_stuck_open error: {e}")

    try:
        anomalies.extend(detect_valve_stuck_closed(zone_readings, control_states))
    except Exception as e:
        logger.warning(f"[HydraulicDetector] valve_stuck_closed error: {e}")

    try:
        if infra_readings:
            anomalies.extend(detect_pressure_anomaly(infra_readings[-1]))
    except Exception as e:
        logger.warning(f"[HydraulicDetector] pressure_anomaly error: {e}")

    try:
        if len(infra_readings) >= 2:
            anomalies.extend(detect_pipe_burst(infra_readings[-2], infra_readings[-1]))
    except Exception as e:
        logger.warning(f"[HydraulicDetector] pipe_burst error: {e}")

    try:
        anomalies.extend(detect_dripper_clog(branch_readings))
    except Exception as e:
        logger.warning(f"[HydraulicDetector] dripper_clog error: {e}")

    if anomalies:
        logger.info(
            f"[HydraulicDetector] {len(anomalies)} anomaly(s) detected for farm {farm_id[:8]}",
            extra={"farm_id": farm_id, "count": len(anomalies)},
        )

    return anomalies
