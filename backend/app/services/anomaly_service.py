"""
Anomaly Detection Service — 5 detection algorithms run on each data ingestion cycle.
Uses in-memory buffers (per farm) for sliding window calculations.
"""
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Optional
from app.supabase_client import get_supabase_admin
from app.logging_config import logger

# ── Configuration ──────────────────────────────────────────────
DETECTOR_CONFIG = {
    "z_score": {
        "window_size": 50,
        "default_threshold": 3.0,
        "column_thresholds": {
            "soil_moisture_pct": 2.5,
            "zone_flow_lpm": 2.5,
            "air_temperature_c": 3.5,
            "reservoir_level_pct": 3.0,
        },
    },
    "sudden_change": {
        "window_size": 10,
        "multiplier": 4.0,
        "column_config": {
            "soil_moisture_pct": {"multiplier": 3.0, "min_delta": 5.0},
            "air_temperature_c": {"multiplier": 4.0, "min_delta": 3.0},
            "reservoir_level_pct": {"multiplier": 3.0, "min_delta": 8.0},
            "zone_flow_lpm": {"multiplier": 3.0, "min_delta": 1.5},
        },
    },
    "stuck_sensor": {
        "consecutive_readings": 8,
        "epsilon": {
            "soil_moisture_pct": 0.05,
            "air_temperature_c": 0.1,
            "air_humidity_pct": 0.1,
            "zone_flow_lpm": 0.01,
        },
    },
    "drift": {
        "short_window_hours": 1,
        "long_window_hours": 24,
        "thresholds": {
            "soil_moisture_pct": 10.0,
            "air_temperature_c": 5.0,
            "reservoir_level_pct": 15.0,
        },
    },
    "correlation": {
        "time_window_minutes": 30,
        "rules": [
            {
                "name": "possible_leak",
                "conditions": ["zone_flow_lpm_anomaly", "soil_moisture_pct_anomaly"],
                "same_zone": True,
                "severity": "high",
                "message": "Flow anomaly + moisture anomaly in same zone = possible leak",
            },
            {
                "name": "pump_or_filter_issue",
                "conditions": ["main_pressure_anomaly", "multi_zone_flow_anomaly"],
                "same_zone": False,
                "severity": "critical",
                "message": "Pressure drop + multi-zone flow anomaly = pump/filter issue",
            },
            {
                "name": "sensor_placement_issue",
                "conditions": ["air_temperature_c_spike", "air_humidity_pct_drop"],
                "same_zone": False,
                "severity": "medium",
                "message": "Temperature spike + humidity drop may indicate sensor exposed to direct sunlight",
            },
        ],
    },
}

# ── In-memory buffers (per farm) ──────────────────────────────
# Structure: _buffers[farm_id][column_key] = deque of (timestamp, value)
_buffers: dict[str, dict[str, deque]] = defaultdict(lambda: defaultdict(lambda: deque(maxlen=200)))


# ── Main entry point ──────────────────────────────────────────

async def analyze_reading_batch(farm_id: str, readings: list[dict]) -> list[dict]:
    """
    Run all 5 detectors on a batch of readings (one per zone).
    Called from iot_service.ingest_batch() after successful insertion.
    Returns list of created anomaly_events.
    """
    all_anomalies = []

    for reading in readings:
        zone_id = reading.get("zone_id")  # integer zone number

        # Update sliding window buffers
        _update_buffers(farm_id, zone_id, reading)

        # Run each detector
        anomalies = []
        anomalies.extend(_detect_z_score(farm_id, zone_id, reading))
        anomalies.extend(_detect_sudden_change(farm_id, zone_id, reading))
        anomalies.extend(_detect_stuck_sensor(farm_id, zone_id, reading))
        anomalies.extend(_detect_drift(farm_id, zone_id, reading))

        all_anomalies.extend(anomalies)

    # Run correlation detector across all zones (cross-sensor)
    all_anomalies.extend(_detect_correlations(farm_id, all_anomalies))

    # Persist anomalies to database
    if all_anomalies:
        await _persist_anomalies(farm_id, all_anomalies)

        # Auto-alert for high/critical
        await _auto_alert(farm_id, [a for a in all_anomalies if a["severity"] in ("high", "critical")])

    return all_anomalies


def _update_buffers(farm_id: str, zone_id, reading: dict):
    """Push new reading values into the per-column sliding windows."""
    ts = reading.get("timestamp", datetime.now(timezone.utc).isoformat())
    columns = ["soil_moisture_pct", "air_temperature_c", "air_humidity_pct",
               "zone_flow_lpm", "reservoir_level_pct", "main_pressure_mpa"]
    for col in columns:
        val = reading.get(col)
        if val is not None:
            key = f"z{zone_id}_{col}" if zone_id else col
            _buffers[farm_id][key].append((ts, float(val)))


# ── Detector 1: Z-Score ───────────────────────────────────────

def _detect_z_score(farm_id: str, zone_id, reading: dict) -> list[dict]:
    """Flag readings where the current value has a z-score above threshold."""
    config = DETECTOR_CONFIG["z_score"]
    anomalies = []

    for col, threshold in config["column_thresholds"].items():
        val = reading.get(col)
        if val is None:
            continue

        key = f"z{zone_id}_{col}" if zone_id else col
        buf = _buffers[farm_id].get(key)
        if not buf or len(buf) < 10:
            continue

        values = [v for _, v in buf]
        mean = sum(values) / len(values)
        std = _std(values)
        if std < 1e-6:
            continue

        z = abs(val - mean) / std
        if z >= threshold:
            anomalies.append({
                "zone_id": zone_id,
                "anomaly_type": "z_score",
                "severity": "critical" if z > threshold * 1.5 else "high" if z > threshold * 1.2 else "medium",
                "target_columns": [col],
                "details": {
                    "z_score": round(z, 2),
                    "value": round(val, 2),
                    "mean": round(mean, 2),
                    "std": round(std, 2),
                    "threshold": threshold,
                },
            })

    return anomalies


# ── Detector 2: Sudden Change ─────────────────────────────────

def _detect_sudden_change(farm_id: str, zone_id, reading: dict) -> list[dict]:
    """Flag readings where the change from previous is abnormally large."""
    config = DETECTOR_CONFIG["sudden_change"]
    anomalies = []

    for col, col_config in config["column_config"].items():
        val = reading.get(col)
        if val is None:
            continue

        key = f"z{zone_id}_{col}" if zone_id else col
        buf = _buffers[farm_id].get(key)
        if not buf or len(buf) < 3:
            continue

        values = [v for _, v in buf]
        # Current delta from previous
        delta = abs(values[-1] - values[-2]) if len(values) >= 2 else 0

        if delta < col_config["min_delta"]:
            continue

        # Historical deltas
        deltas = [abs(values[i] - values[i - 1]) for i in range(1, len(values) - 1)]
        if not deltas:
            continue

        delta_std = _std(deltas) if len(deltas) > 1 else delta
        delta_mean = sum(deltas) / len(deltas)

        if delta_std > 0 and delta > delta_mean + col_config["multiplier"] * delta_std:
            anomalies.append({
                "zone_id": zone_id,
                "anomaly_type": "sudden_change",
                "severity": "high" if delta > col_config["min_delta"] * 3 else "medium",
                "target_columns": [col],
                "details": {
                    "delta": round(delta, 2),
                    "delta_mean": round(delta_mean, 2),
                    "delta_std": round(delta_std, 2),
                    "current_value": round(val, 2),
                },
            })

    return anomalies


# ── Detector 3: Stuck Sensor ──────────────────────────────────

def _detect_stuck_sensor(farm_id: str, zone_id, reading: dict) -> list[dict]:
    """Flag when a sensor reports near-identical values for too many consecutive readings."""
    config = DETECTOR_CONFIG["stuck_sensor"]
    anomalies = []

    for col, epsilon in config["epsilon"].items():
        val = reading.get(col)
        if val is None:
            continue

        key = f"z{zone_id}_{col}" if zone_id else col
        buf = _buffers[farm_id].get(key)
        if not buf or len(buf) < config["consecutive_readings"]:
            continue

        recent = [v for _, v in list(buf)[-config["consecutive_readings"]:]]
        variance = _std(recent) if len(recent) > 1 else 0

        if variance < epsilon:
            anomalies.append({
                "zone_id": zone_id,
                "anomaly_type": "stuck_sensor",
                "severity": "medium",
                "target_columns": [col],
                "details": {
                    "variance": round(variance, 6),
                    "epsilon": epsilon,
                    "consecutive_count": config["consecutive_readings"],
                    "stuck_value": round(recent[-1], 2),
                },
            })

    return anomalies


# ── Detector 4: Drift ─────────────────────────────────────────

def _detect_drift(farm_id: str, zone_id, reading: dict) -> list[dict]:
    """Flag when a sensor's recent average diverges from its long-term average."""
    config = DETECTOR_CONFIG["drift"]
    anomalies = []

    for col, threshold in config["thresholds"].items():
        key = f"z{zone_id}_{col}" if zone_id else col
        buf = _buffers[farm_id].get(key)
        if not buf or len(buf) < 20:
            continue

        all_values = [v for _, v in buf]

        # Short window: last ~12 readings (1 hour at 5-min intervals)
        short_count = min(12, len(all_values))
        short_avg = sum(all_values[-short_count:]) / short_count

        # Long window: all available (up to 200 readings = ~16 hours)
        long_avg = sum(all_values) / len(all_values)

        drift = abs(short_avg - long_avg)
        if drift > threshold:
            anomalies.append({
                "zone_id": zone_id,
                "anomaly_type": "drift",
                "severity": "low" if drift < threshold * 1.5 else "medium",
                "target_columns": [col],
                "details": {
                    "short_avg": round(short_avg, 2),
                    "long_avg": round(long_avg, 2),
                    "drift": round(drift, 2),
                    "threshold": threshold,
                },
            })

    return anomalies


# ── Detector 5: Correlation ───────────────────────────────────

def _detect_correlations(farm_id: str, recent_anomalies: list[dict]) -> list[dict]:
    """Cross-reference anomalies to detect compound issues (leaks, pump failure, etc.)."""
    config = DETECTOR_CONFIG["correlation"]
    correlations = []

    for rule in config["rules"]:
        if rule["name"] == "possible_leak":
            zones_with_flow = {a["zone_id"] for a in recent_anomalies
                               if "zone_flow_lpm" in a.get("target_columns", [])}
            zones_with_moisture = {a["zone_id"] for a in recent_anomalies
                                   if "soil_moisture_pct" in a.get("target_columns", [])}
            overlap = zones_with_flow & zones_with_moisture
            for z in overlap:
                correlations.append({
                    "zone_id": z,
                    "anomaly_type": "correlation",
                    "severity": rule["severity"],
                    "target_columns": ["zone_flow_lpm", "soil_moisture_pct"],
                    "details": {"correlation_rule": rule["name"], "message": rule["message"]},
                })

        elif rule["name"] == "pump_or_filter_issue":
            has_pressure = any("main_pressure_mpa" in a.get("target_columns", []) for a in recent_anomalies)
            zones_with_flow = {a["zone_id"] for a in recent_anomalies
                               if "zone_flow_lpm" in a.get("target_columns", [])}
            if has_pressure and len(zones_with_flow) >= 2:
                correlations.append({
                    "zone_id": None,
                    "anomaly_type": "correlation",
                    "severity": rule["severity"],
                    "target_columns": ["main_pressure_mpa", "zone_flow_lpm"],
                    "details": {"correlation_rule": rule["name"], "message": rule["message"],
                                "affected_zones": list(zones_with_flow)},
                })

    return correlations


# ── Persistence & Alerting ────────────────────────────────────

async def _persist_anomalies(farm_id: str, anomalies: list[dict]):
    """Insert anomaly events into the database."""
    supabase = get_supabase_admin()

    # Map zone_number to zone UUID
    zones = supabase.table("zones").select("id, zone_number").eq("farm_id", farm_id).execute()
    zone_map = {z["zone_number"]: z["id"] for z in (zones.data or [])}

    rows = []
    for a in anomalies:
        zone_uuid = zone_map.get(a.get("zone_id")) if a.get("zone_id") else None
        rows.append({
            "farm_id": farm_id,
            "zone_id": zone_uuid,
            "anomaly_type": a["anomaly_type"],
            "severity": a["severity"],
            "target_columns": a["target_columns"],
            "details": a["details"],
        })

    if rows:
        try:
            supabase.table("anomaly_events").insert(rows).execute()
        except Exception as e:
            logger.error(f"Failed to persist anomalies: {e}")


async def _auto_alert(farm_id: str, critical_anomalies: list[dict]):
    """Send WhatsApp alerts for high/critical anomalies."""
    if not critical_anomalies:
        return

    try:
        from app.services.whatsapp_service import get_whatsapp_service
        ws = get_whatsapp_service()
        if not ws.enabled:
            return
    except Exception:
        return

    supabase = get_supabase_admin()
    farm = supabase.table("farms").select("owner_id").eq("id", farm_id).limit(1).execute()
    if not farm.data:
        return
    owner = supabase.table("users").select("phone").eq("id", farm.data[0]["owner_id"]).limit(1).execute()
    if not owner.data or not owner.data[0].get("phone"):
        return

    phone = owner.data[0]["phone"]
    for a in critical_anomalies[:3]:  # max 3 alerts per cycle
        msg = f"⚠️ *{a['severity'].upper()} Anomaly*\n\nType: {a['anomaly_type']}\n"
        if a.get("zone_id"):
            msg += f"Zone: {a['zone_id']}\n"
        msg += f"Columns: {', '.join(a['target_columns'])}\n"
        details = a.get("details", {})
        if "message" in details:
            msg += f"\n{details['message']}"

        try:
            await ws.send_message(phone, msg)
        except Exception as e:
            logger.error(f"Failed to send anomaly alert: {e}")


# ── Query Functions ───────────────────────────────────────────

async def get_anomaly_dashboard(farm_id: str) -> dict:
    """Get summary dashboard for anomalies."""
    supabase = get_supabase_admin()

    unacked = supabase.table("anomaly_events").select(
        "id, anomaly_type, severity, zone_id, target_columns, details, created_at"
    ).eq("farm_id", farm_id).eq("acknowledged", False).order(
        "created_at", desc=True
    ).limit(100).execute()

    events = unacked.data or []

    by_severity = defaultdict(int)
    by_type = defaultdict(int)
    zone_counts = defaultdict(int)
    for e in events:
        by_severity[e["severity"]] += 1
        by_type[e["anomaly_type"]] += 1
        if e.get("zone_id"):
            zone_counts[e["zone_id"]] += 1

    return {
        "total_unacknowledged": len(events),
        "by_severity": dict(by_severity),
        "by_type": dict(by_type),
        "recent": events[:20],
        "zone_anomaly_counts": dict(zone_counts),
    }


async def acknowledge_anomalies(farm_id: str, anomaly_ids: list[str], user_id: str):
    """Mark anomalies as acknowledged."""
    supabase = get_supabase_admin()
    for aid in anomaly_ids:
        supabase.table("anomaly_events").update({
            "acknowledged": True,
            "acknowledged_by": user_id,
            "resolved_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", aid).eq("farm_id", farm_id).execute()


async def list_anomalies(farm_id: str, anomaly_type=None, severity=None,
                         zone_id=None, acknowledged=None, limit=50, offset=0) -> list[dict]:
    """Query anomaly events with filters."""
    supabase = get_supabase_admin()
    q = supabase.table("anomaly_events").select("*").eq("farm_id", farm_id)
    if anomaly_type:
        q = q.eq("anomaly_type", anomaly_type)
    if severity:
        q = q.eq("severity", severity)
    if zone_id:
        q = q.eq("zone_id", zone_id)
    if acknowledged is not None:
        q = q.eq("acknowledged", acknowledged)
    result = q.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return result.data or []


def _std(values: list[float]) -> float:
    """Standard deviation."""
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((x - mean) ** 2 for x in values) / (len(values) - 1)
    return variance ** 0.5
