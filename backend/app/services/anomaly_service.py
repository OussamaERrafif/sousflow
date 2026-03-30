"""
Anomaly Detection Service — 8 detection algorithms run on each data ingestion cycle.
5 statistical algorithms + 3 new rule-based detectors (hydraulic, equipment, agronomic).
Uses in-memory buffers (per farm) for sliding window calculations.
"""
from collections import defaultdict, deque
from datetime import datetime, timezone, timedelta
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

# ── In-memory infra reading window (per farm) for equipment/hydraulic detectors
# Structure: _infra_window[farm_id] = deque of infra reading dicts
_infra_window: dict[str, deque] = defaultdict(lambda: deque(maxlen=50))


# ── Main entry point ──────────────────────────────────────────

async def analyze_reading_batch(
    farm_id: str,
    readings: list[dict],
    branch_readings: list[dict] | None = None,
    zone_readings: list[dict] | None = None,
    infra_reading: dict | None = None,
    control_states: dict | None = None,
) -> list[dict]:
    """
    Run all 8 detectors on a batch of readings.
    Called from iot_service.ingest_batch() after successful insertion.

    Args:
        readings:        flat zone readings (legacy — statistical detectors)
        branch_readings: branch_flow_readings for hydraulic detector
        zone_readings:   zone_health_readings for valve/agronomic detection
        infra_reading:   latest infrastructure_reading for pressure/pump detection
        control_states:  {zone_id: {valve_open: bool}} — from simulator/device_control
    Returns list of created anomaly_events.
    """
    all_anomalies = []

    baselines: dict[str, dict] = {}
    try:
        from app.services.baseline_service import get_baselines_for_farm
        import uuid
        baselines_raw = await get_baselines_for_farm(uuid.UUID(farm_id))
        for b in baselines_raw:
            key = f"z{b.get('zone_id')}_{b.get('column_name')}" if b.get("zone_id") else b.get("column_name")
            if key not in baselines:
                baselines[key] = {}
            baselines[key][b.get("column_name")] = b
    except Exception:
        pass

    # ── Statistical detectors (existing 5) ─────────────────────
    for reading in readings:
        zone_id = reading.get("zone_id")

        _update_buffers(farm_id, zone_id, reading)

        reading_baseline = {}
        if zone_id:
            for col in ["soil_moisture_pct", "air_temperature_c", "air_humidity_pct", "zone_flow_lpm", "reservoir_level_pct"]:
                key = f"z{zone_id}_{col}"
                if key in baselines:
                    reading_baseline[col] = baselines[key][col]

        anomalies = []
        anomalies.extend(_detect_z_score(farm_id, zone_id, reading, reading_baseline if reading_baseline else None))
        anomalies.extend(_detect_sudden_change(farm_id, zone_id, reading, reading_baseline if reading_baseline else None))
        anomalies.extend(_detect_stuck_sensor(farm_id, zone_id, reading))
        anomalies.extend(_detect_drift(farm_id, zone_id, reading))
        all_anomalies.extend(anomalies)

    all_anomalies.extend(_detect_correlations(farm_id, all_anomalies))

    # ── Hydraulic detector (NEW) ────────────────────────────────
    if branch_readings or zone_readings or infra_reading:
        try:
            from app.services.hydraulic_detector import run_hydraulic_detectors

            # Maintain infra window
            if infra_reading:
                _infra_window[farm_id].append(infra_reading)

            hydraulic_anomalies = await run_hydraulic_detectors(
                farm_id=farm_id,
                branch_readings=branch_readings or [],
                zone_readings=zone_readings or [],
                infra_readings=list(_infra_window[farm_id]),
                control_states=control_states or {},
            )
            all_anomalies.extend(hydraulic_anomalies)
        except Exception as e:
            logger.warning(f"[AnomalyService] Hydraulic detector failed: {e}")

    # ── Equipment detector (NEW) ────────────────────────────────
    if infra_reading or _infra_window.get(farm_id):
        try:
            from app.services.equipment_detector import run_equipment_detectors

            active_zones = 0
            if zone_readings:
                active_zones = sum(1 for z in zone_readings if (z.get("total_inlet_flow_lpm") or 0) > 0.5)

            equipment_anomalies = await run_equipment_detectors(
                farm_id=farm_id,
                infra_readings=list(_infra_window.get(farm_id, [])),
                active_zones_count=active_zones,
            )
            all_anomalies.extend(equipment_anomalies)
        except Exception as e:
            logger.warning(f"[AnomalyService] Equipment detector failed: {e}")

    # ── ML Isolation Forest detector (Phase 4) ─────────────────
    if readings:
        try:
            from app.services.ml_anomaly_service import detect_ml_anomalies

            ml_anomalies = await detect_ml_anomalies(farm_id, readings)
            all_anomalies.extend(ml_anomalies)
        except Exception as e:
            logger.warning(f"[AnomalyService] ML detector failed: {e}")

    # ── Persist and alert ───────────────────────────────────────
    if all_anomalies:
        await _persist_anomalies(farm_id, all_anomalies)
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

def _detect_z_score(farm_id: str, zone_id, reading: dict, baseline: Optional[dict] = None) -> list[dict]:
    """Flag readings where the current value has a z-score above threshold.
    
    If baseline is provided (from sensor_baselines table), use it instead of in-memory window.
    """
    config = DETECTOR_CONFIG["z_score"]
    anomalies = []

    for col, threshold in config["column_thresholds"].items():
        val = reading.get(col)
        if val is None:
            continue

        if baseline and col in baseline:
            mean = baseline[col].get("mean")
            std = baseline[col].get("std_dev")
            source = "baseline"
        else:
            key = f"z{zone_id}_{col}" if zone_id else col
            buf = _buffers[farm_id].get(key)
            if not buf or len(buf) < 10:
                continue
            values = [v for _, v in buf]
            mean = sum(values) / len(values)
            std = _std(values)
            source = "window"

        if std is None or std < 1e-6 or mean is None:
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
                    "source": source,
                },
                "baseline_value": mean,
                "actual_value": val,
            })

    return anomalies


# ── Detector 2: Sudden Change ─────────────────────────────────

def _detect_sudden_change(farm_id: str, zone_id, reading: dict, baseline: Optional[dict] = None) -> list[dict]:
    """Flag readings where the change from previous is abnormally large.
    
    If baseline is provided, uses p95/p5 from baseline for threshold instead of historical window.
    """
    config = DETECTOR_CONFIG["sudden_change"]
    anomalies = []

    for col, col_config in config["column_config"].items():
        val = reading.get(col)
        if val is None:
            continue

        if baseline and col in baseline:
            b = baseline[col]
            p95 = b.get("p95")
            p5 = b.get("p5")
            if p95 is not None and p5 is not None and (p95 - p5) > 0:
                delta_threshold = (p95 - p5) * 0.5
            else:
                delta_threshold = col_config["min_delta"]
            source = "baseline"
            prev_val = None
        else:
            key = f"z{zone_id}_{col}" if zone_id else col
            buf = _buffers[farm_id].get(key)
            if not buf or len(buf) < 3:
                continue
            values = [v for _, v in buf]
            prev_val = values[-2] if len(values) >= 2 else None
            delta = abs(val - prev_val) if prev_val is not None else 0
            
            deltas = [abs(values[i] - values[i - 1]) for i in range(1, len(values) - 1)]
            if not deltas:
                continue
            delta_std = _std(deltas) if len(deltas) > 1 else delta
            delta_mean = sum(deltas) / len(deltas)
            delta_threshold = delta_mean + col_config["multiplier"] * delta_std
            source = "window"

        delta = abs(val - prev_val) if prev_val is not None else 0

        if delta < col_config["min_delta"]:
            continue

        if delta > delta_threshold:
            anomalies.append({
                "zone_id": zone_id,
                "anomaly_type": "sudden_change",
                "severity": "high" if delta > col_config["min_delta"] * 3 else "medium",
                "target_columns": [col],
                "details": {
                    "delta": round(delta, 2),
                    "threshold": round(delta_threshold, 2),
                    "current_value": round(val, 2),
                    "source": source,
                },
                "baseline_value": baseline.get(col, {}).get("mean") if baseline else None,
                "actual_value": val,
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
        row: dict = {
            "farm_id": farm_id,
            "zone_id": zone_uuid,
            "branch_id": a.get("branch_id"),
            "anomaly_type": a["anomaly_type"],
            "severity": a["severity"],
            "target_columns": a.get("target_columns", []),
            "details": a.get("details", {}),
        }
        # New v4 columns (nullable — won't break if absent)
        if a.get("confidence_score") is not None:
            row["confidence_score"] = a["confidence_score"]
        if a.get("detection_method"):
            row["detection_method"] = a["detection_method"]
        if a.get("baseline_value") is not None:
            row["baseline_value"] = a["baseline_value"]
        if a.get("actual_value") is not None:
            row["actual_value"] = a["actual_value"]
        rows.append(row)

    if rows:
        try:
            supabase.table("anomaly_events").insert(rows).execute()
        except Exception as e:
            logger.error(f"Failed to persist anomalies: {e}")


async def _get_farm_user_phones(farm_id: str) -> list[str]:
    """Return all phone numbers for users linked to a farm (owner + active members + WhatsApp AI sessions)."""
    supabase = get_supabase_admin()
    phones: list[str] = []

    # Farm owner
    farm = supabase.table("farms").select("owner_id").eq("id", farm_id).limit(1).execute()
    if farm.data:
        owner = supabase.table("users").select("phone").eq("id", farm.data[0]["owner_id"]).limit(1).execute()
        if owner.data and owner.data[0].get("phone"):
            phones.append(owner.data[0]["phone"])

    # Active farm members
    memberships = supabase.table("farm_memberships").select("user_id").eq("farm_id", farm_id).eq("is_active", True).execute()
    member_ids = [m["user_id"] for m in (memberships.data or [])]
    if member_ids:
        members = supabase.table("users").select("phone").in_("id", member_ids).execute()
        for m in (members.data or []):
            if m.get("phone") and m["phone"] not in phones:
                phones.append(m["phone"])

    # All WhatsApp AI sessions linked to this farm (connected or previously connected)
    wa_sessions = supabase.table("whatsapp_ai_sessions").select("phone").eq("farm_id", farm_id).execute()
    for s in (wa_sessions.data or []):
        if s.get("phone") and s["phone"] not in phones:
            phones.append(s["phone"])

    if not phones:
        logger.warning(f"[Anomaly Alert] No recipients found for farm {farm_id}")
    return phones


async def _auto_alert(farm_id: str, critical_anomalies: list[dict]):
    """Send WhatsApp alerts for high/critical anomalies to ALL farm users."""
    if not critical_anomalies:
        return

    try:
        from app.services.whatsapp_service import get_whatsapp_service
        ws = get_whatsapp_service()
        if not ws.enabled:
            return
    except Exception:
        return

    phones = await _get_farm_user_phones(farm_id)
    if not phones:
        return

    _SEVERITY_EMOJI_MAP = {"low": "⚠️", "medium": "🟠", "high": "🔴", "critical": "🚨"}
    _TYPE_AR_MAP = {
        # Statistical
        "z_score": "قراءة شاذة",
        "sudden_change": "تغيير مفاجئ",
        "stuck_sensor": "مستشعر متعطل",
        "drift": "انجراف تدريجي",
        "correlation": "ارتباط مشبوه",
        "injected": "تنبيه يدوي",
        # Hydraulic
        "LEAK_BRANCH": "تسرب في الفرع",
        "LEAK_ZONE": "تسرب في المنطقة",
        "PIPE_BURST": "انكسار الأنبوب",
        "DRIPPER_CLOG_PARTIAL": "انسداد جزئي للقطارات",
        "DRIPPER_CLOG_SEVERE": "انسداد حاد للقطارات",
        "FILTER_CLOG_EARLY": "انسداد مبكر للمرشح",
        "FILTER_CLOG_CRITICAL": "انسداد حرج للمرشح",
        "VALVE_STUCK_OPEN": "الصمام عالق مفتوحاً",
        "VALVE_STUCK_CLOSED": "الصمام عالق مغلقاً",
        "PRESSURE_ANOMALY_LOW": "ضغط منخفض في الشبكة",
        "PRESSURE_ANOMALY_HIGH": "ضغط مرتفع في الشبكة",
        # Equipment
        "PUMP_DEGRADATION": "تدهور أداء المضخة",
        "PUMP_FAILURE_IMMINENT": "خطر عطل وشيك للمضخة",
        "PUMP_CAVITATION": "تكهف في المضخة",
        "RESERVOIR_CRITICAL": "مستوى الخزان حرج",
        "RESERVOIR_LEAK": "تسرب في الخزان",
        "SENSOR_COMMUNICATION_LOSS": "انقطاع اتصال المستشعر",
        # Agronomic
        "OVER_IRRIGATION": "ري مفرط",
        "UNDER_IRRIGATION": "ري غير كافٍ",
        "UNEVEN_ZONE": "توزيع غير متساوٍ للمياه",
        "WATERLOGGING_RISK": "خطر تشبع التربة بالماء",
        "ROOT_ZONE_DRY": "جفاف منطقة الجذور",
        "STRESS_SPIKE": "ارتفاع مفاجئ في الإجهاد",
        "YIELD_RISK_HEAT": "خطر انخفاض الإنتاج بسبب الحرارة",
    }

    for a in critical_anomalies[:3]:  # max 3 alerts per cycle
        sev = a["severity"]
        sev_emoji = _SEVERITY_EMOJI_MAP.get(sev, "⚠️")
        atype_ar = _TYPE_AR_MAP.get(a["anomaly_type"], a["anomaly_type"])
        details = a.get("details", {})
        detail_msg = details.get("message", "")

        msg = f"{sev_emoji} *تنبيه — {atype_ar}*\n\n"
        if a.get("zone_id"):
            msg += f"📍 المنطقة: {a['zone_id'][:8]}...\n"
        if detail_msg:
            msg += f"{detail_msg}\n"
        msg += '\nأرسل *"شنو طرا؟"* لمزيد من التفاصيل.\nأرسل *"help"* لقائمة الأوامر.'

        sensor_id = a.get("zone_id")
        for phone in phones:
            try:
                await ws.send_alert(
                    phone=phone,
                    alert_type=a["anomaly_type"],
                    sensor_id=sensor_id,
                    custom_message=msg,
                    cooldown_minutes=30,
                )
            except Exception as e:
                logger.error(f"Failed to send anomaly alert to {phone}: {e}")


async def inject_anomaly_manual(
    farm_id: str,
    anomaly_type: str,
    severity: str = "medium",
    zone_id: Optional[str] = None,
) -> dict:
    """
    Manually inject an anomaly event for a farm (admin action).
    Persists to DB and sends WhatsApp alerts to all farm users.

    anomaly_type: low_soil_moisture | irrigation_failure | sensor_error
    severity: low | medium | critical
    """
    _TYPE_META = {
        # ── Agronomic ──────────────────────────────────────────────────────────────────
        "low_soil_moisture": {
            "columns": ["avg_soil_moisture_pct"],
            "details": {"message": "Soil moisture dropped below critical threshold. Check irrigation system."},
        },
        "high_soil_moisture": {
            "columns": ["avg_soil_moisture_pct"],
            "details": {"message": "Soil moisture above safe level — risk of root asphyxiation and disease. Reduce irrigation."},
        },
        "irrigation_failure": {
            "columns": ["main_pump_flow_lpm", "zone_flow_lpm"],
            "details": {"message": "Irrigation system not delivering expected flow. Check pump and valves."},
        },
        "soil_moisture_drift": {
            "columns": ["avg_soil_moisture_pct"],
            "details": {"message": "Gradual soil moisture drift detected. Sensor may need recalibration or repositioning."},
        },
        # ── Hydraulic ──────────────────────────────────────────────────────────────────
        "LEAK_BRANCH": {
            "columns": ["zone_flow_lpm", "zone_pressure_mpa"],
            "details": {"message": "Abnormal flow detected in irrigation branch. Possible pipe or fitting leak."},
        },
        "PIPE_BURST": {
            "columns": ["zone_flow_lpm", "zone_pressure_mpa", "main_pressure_mpa"],
            "details": {"message": "Sudden pressure drop with abnormally high flow — possible pipe burst. Shut off water immediately."},
        },
        "FILTER_CLOG_EARLY": {
            "columns": ["main_pressure_mpa"],
            "details": {"message": "Filter showing early signs of clogging. Schedule a backwash or manual cleaning."},
        },
        "FILTER_CLOG_SEVERE": {
            "columns": ["main_pressure_mpa", "main_pump_flow_lpm"],
            "details": {"message": "Filter severely clogged — significantly reduced flow. Immediate cleaning required."},
        },
        "VALVE_STUCK_OPEN": {
            "columns": ["valve_open", "zone_flow_lpm"],
            "details": {"message": "Valve appears stuck open while it should be closed — water is flowing uncontrolled."},
        },
        "VALVE_STUCK_CLOSED": {
            "columns": ["valve_open", "zone_flow_lpm"],
            "details": {"message": "Valve appears stuck closed — no water reaching the irrigation zone."},
        },
        "PRESSURE_ANOMALY_LOW": {
            "columns": ["main_pressure_mpa", "zone_pressure_mpa"],
            "details": {"message": "System pressure below operating range. Check pump status, open valves, and main supply."},
        },
        "PRESSURE_ANOMALY_HIGH": {
            "columns": ["main_pressure_mpa", "zone_pressure_mpa"],
            "details": {"message": "System pressure above safe operating range. Risk of pipe or fitting damage."},
        },
        "DRIPPER_CLOG_PARTIAL": {
            "columns": ["zone_flow_lpm"],
            "details": {"message": "Partial dripper clogging detected — reduced water delivery to plants. Flush drip lines."},
        },
        "DRIPPER_CLOG_SEVERE": {
            "columns": ["zone_flow_lpm"],
            "details": {"message": "Severe dripper clogging — minimal water delivery. Immediate flushing or replacement required."},
        },
        # ── Equipment ──────────────────────────────────────────────────────────────────
        "PUMP_DEGRADATION": {
            "columns": ["main_pump_flow_lpm", "main_pressure_mpa"],
            "details": {"message": "Pump performance degrading — reduced flow and pressure over time. Schedule maintenance."},
        },
        "PUMP_FAILURE_IMMINENT": {
            "columns": ["main_pump_flow_lpm", "main_pressure_mpa"],
            "details": {"message": "Pump failure imminent — critically low output. Immediate inspection required."},
        },
        "RESERVOIR_CRITICAL": {
            "columns": ["reservoir_level_pct"],
            "details": {"message": "Reservoir at critically low level. Refill immediately to avoid irrigation interruption."},
        },
        "RESERVOIR_LEAK": {
            "columns": ["reservoir_level_pct"],
            "details": {"message": "Abnormal reservoir level drop detected. Possible leak in tank or feed lines."},
        },
        # ── Data / Statistical ─────────────────────────────────────────────────────────
        "sensor_error": {
            "columns": ["avg_soil_moisture_pct", "air_temperature_c"],
            "details": {"message": "Sensor readings out of expected range. May require calibration or replacement."},
        },
        "stuck_sensor": {
            "columns": ["avg_soil_moisture_pct"],
            "details": {"message": "Sensor reporting identical values repeatedly. Possible sensor fault or communication issue."},
        },
        "z_score": {
            "columns": ["avg_soil_moisture_pct"],
            "details": {"message": "Statistical anomaly detected — reading deviates significantly from historical baseline."},
        },
        "sudden_change": {
            "columns": ["avg_soil_moisture_pct"],
            "details": {"message": "Sudden unexpected change in sensor reading detected. Verify physical conditions."},
        },
        "drift": {
            "columns": ["avg_soil_moisture_pct", "air_temperature_c"],
            "details": {"message": "Gradual sensor drift detected over time. Calibration or replacement may be needed."},
        },
        "correlation": {
            "columns": ["zone_flow_lpm", "avg_soil_moisture_pct"],
            "details": {"message": "Correlated anomalies detected across multiple sensors — possible compound system issue."},
        },
    }

    meta = _TYPE_META.get(anomaly_type, {
        "columns": [anomaly_type],
        "details": {"message": f"Manual anomaly injection: {anomaly_type}"},
    })

    supabase = get_supabase_admin()
    row = {
        "farm_id": farm_id,
        "zone_id": zone_id,
        "anomaly_type": anomaly_type,
        "severity": severity,
        "target_columns": meta["columns"],
        "details": {**meta["details"], "injected": True},
    }

    result = supabase.table("anomaly_events").insert(row).execute()
    event_id = result.data[0]["id"] if result.data else None

    # Build alert message
    _SEVERITY_EMOJI = {"low": "ℹ️", "medium": "⚠️", "high": "🔶", "critical": "🚨"}
    _TYPE_LABEL = {
        # Agronomic
        "low_soil_moisture":    "Low Soil Moisture",
        "high_soil_moisture":   "High Soil Moisture",
        "irrigation_failure":   "Irrigation Failure",
        "soil_moisture_drift":  "Soil Moisture Drift",
        # Hydraulic
        "LEAK_BRANCH":          "Branch Leak Detected",
        "PIPE_BURST":           "Pipe Burst",
        "FILTER_CLOG_EARLY":    "Filter Clogging (Early)",
        "FILTER_CLOG_SEVERE":   "Filter Severely Clogged",
        "VALVE_STUCK_OPEN":     "Valve Stuck Open",
        "VALVE_STUCK_CLOSED":   "Valve Stuck Closed",
        "PRESSURE_ANOMALY_LOW": "Low Pressure Anomaly",
        "PRESSURE_ANOMALY_HIGH":"High Pressure Anomaly",
        "DRIPPER_CLOG_PARTIAL": "Partial Dripper Clog",
        "DRIPPER_CLOG_SEVERE":  "Severe Dripper Clog",
        # Equipment
        "PUMP_DEGRADATION":       "Pump Degradation",
        "PUMP_FAILURE_IMMINENT":  "Pump Failure Imminent",
        "RESERVOIR_CRITICAL":     "Reservoir Critical Level",
        "RESERVOIR_LEAK":         "Reservoir Leak",
        # Data / Statistical
        "sensor_error":   "Sensor Error",
        "stuck_sensor":   "Stuck Sensor",
        "z_score":        "Statistical Anomaly",
        "sudden_change":  "Sudden Value Change",
        "drift":          "Sensor Drift",
        "correlation":    "Correlated Anomalies",
    }
    _ACTION_HINTS = {
        # Agronomic
        "low_soil_moisture":    "Check irrigation system and open valves.",
        "high_soil_moisture":   "Reduce irrigation frequency or duration.",
        "irrigation_failure":   "Inspect pump and valves immediately.",
        "soil_moisture_drift":  "Recalibrate or reposition soil sensor.",
        # Hydraulic
        "LEAK_BRANCH":          "Inspect irrigation branch for cracks or loose fittings.",
        "PIPE_BURST":           "Shut off main valve and inspect pipes immediately.",
        "FILTER_CLOG_EARLY":    "Schedule filter backwash or manual cleaning.",
        "FILTER_CLOG_SEVERE":   "Clean or replace filter immediately.",
        "VALVE_STUCK_OPEN":     "Manually close valve and inspect solenoid.",
        "VALVE_STUCK_CLOSED":   "Manually open valve and inspect solenoid.",
        "PRESSURE_ANOMALY_LOW": "Check pump status and all valve positions.",
        "PRESSURE_ANOMALY_HIGH":"Check pressure regulator and main supply.",
        "DRIPPER_CLOG_PARTIAL": "Flush drip lines and check emitters.",
        "DRIPPER_CLOG_SEVERE":  "Flush or replace clogged drippers immediately.",
        # Equipment
        "PUMP_DEGRADATION":      "Schedule pump maintenance and inspection.",
        "PUMP_FAILURE_IMMINENT": "Inspect pump immediately — consider replacement.",
        "RESERVOIR_CRITICAL":    "Refill reservoir immediately.",
        "RESERVOIR_LEAK":        "Inspect reservoir tank and supply lines for leaks.",
        # Data / Statistical
        "sensor_error":   "Check sensor connections, power, and calibration.",
        "stuck_sensor":   "Inspect sensor for faults or communication issues.",
        "z_score":        "Review recent readings and check physical conditions.",
        "sudden_change":  "Verify sensor and check for sudden environmental changes.",
        "drift":          "Recalibrate sensor or schedule replacement.",
        "correlation":    "Investigate linked sensors and system components together.",
    }

    emoji = _SEVERITY_EMOJI.get(severity, "⚠️")
    label = _TYPE_LABEL.get(anomaly_type, anomaly_type.replace("_", " ").title())
    action = _ACTION_HINTS.get(anomaly_type, "Check your farm system.")

    _SEVERITY_AR = {"low": "منخفضة", "medium": "متوسطة", "high": "عالية", "critical": "حرجة"}
    _TYPE_AR = {
        # Agronomic
        "low_soil_moisture":    "رطوبة التربة منخفضة",
        "high_soil_moisture":   "رطوبة التربة مرتفعة",
        "irrigation_failure":   "عطل في نظام الري",
        "soil_moisture_drift":  "انجراف في مستشعر الرطوبة",
        # Hydraulic
        "LEAK_BRANCH":          "تسرب في فرع الري",
        "PIPE_BURST":           "انفجار أنبوب",
        "FILTER_CLOG_EARLY":    "انسداد مبكر في الفلتر",
        "FILTER_CLOG_SEVERE":   "انسداد شديد في الفلتر",
        "VALVE_STUCK_OPEN":     "صمام عالق مفتوحاً",
        "VALVE_STUCK_CLOSED":   "صمام عالق مغلقاً",
        "PRESSURE_ANOMALY_LOW": "ضغط منخفض بشكل غير طبيعي",
        "PRESSURE_ANOMALY_HIGH":"ضغط مرتفع بشكل غير طبيعي",
        "DRIPPER_CLOG_PARTIAL": "انسداد جزئي في القطارات",
        "DRIPPER_CLOG_SEVERE":  "انسداد شديد في القطارات",
        # Equipment
        "PUMP_DEGRADATION":      "تدهور أداء المضخة",
        "PUMP_FAILURE_IMMINENT": "المضخة على وشك العطل",
        "RESERVOIR_CRITICAL":    "مستوى الخزان حرج",
        "RESERVOIR_LEAK":        "تسرب في الخزان",
        # Data / Statistical
        "sensor_error":   "خطأ في المستشعر",
        "stuck_sensor":   "مستشعر متوقف",
        "z_score":        "شذوذ إحصائي",
        "sudden_change":  "تغيير مفاجئ في القراءة",
        "drift":          "انجراف في المستشعر",
        "correlation":    "شذوذات متزامنة في عدة مستشعرات",
    }
    # Specific per-anomaly description shown in the WhatsApp message body
    _DESC_AR = {
        # Agronomic
        "low_soil_moisture":    "انخفضت رطوبة التربة دون الحد الحرج — النباتات في خطر الجفاف.",
        "high_soil_moisture":   "رطوبة التربة تجاوزت المستوى الآمن — خطر اختناق الجذور والأمراض الفطرية.",
        "irrigation_failure":   "لم يصل تدفق الماء المتوقع إلى المنطقة — احتمال عطل في المضخة أو الصمام.",
        "soil_moisture_drift":  "تغير تدريجي وغير مبرر في قراءات رطوبة التربة — المستشعر بحاجة إلى معايرة.",
        # Hydraulic
        "LEAK_BRANCH":          "رُصد تدفق شاذ في فرع الري — احتمال تسرب في الأنبوب أو التوصيلات.",
        "PIPE_BURST":           "انهيار مفاجئ في الضغط مع ارتفاع حاد في التدفق — احتمال كبير لانفجار أنبوب.",
        "FILTER_CLOG_EARLY":    "بدأ الضغط يرتفع قبل الفلتر — بوادر انسداد تستوجب التنظيف قريباً.",
        "FILTER_CLOG_SEVERE":   "انخفاض كبير في التدفق مع ارتفاع حاد في الضغط — الفلتر مسدود بشكل خطير.",
        "VALVE_STUCK_OPEN":     "يتدفق الماء في المنطقة رغم إغلاق الصمام — الصمام عالق في وضع الفتح.",
        "VALVE_STUCK_CLOSED":   "لا يصل ماء إلى المنطقة رغم فتح الصمام — الصمام عالق في وضع الإغلاق.",
        "PRESSURE_ANOMALY_LOW": "ضغط النظام أقل من الحد الأدنى التشغيلي — قد تعاني بعض المناطق من نقص في الري.",
        "PRESSURE_ANOMALY_HIGH":"ضغط النظام تجاوز الحد الأقصى الآمن — خطر تلف الأنابيب والتوصيلات.",
        "DRIPPER_CLOG_PARTIAL": "تدفق منخفض في خطوط التنقيط — انسداد جزئي يقلل كمية الماء الواصلة للنباتات.",
        "DRIPPER_CLOG_SEVERE":  "توقف شبه تام لتدفق القطارات — الانسداد الشديد يهدد النباتات بالجفاف.",
        # Equipment
        "PUMP_DEGRADATION":      "تراجع ملحوظ في أداء المضخة على مدى الوقت — التدفق والضغط في انخفاض مستمر.",
        "PUMP_FAILURE_IMMINENT": "المضخة تعطي مخرجات حرجة جداً — وشيك حدوث عطل كامل إن لم يتم التدخل.",
        "RESERVOIR_CRITICAL":    "مستوى المياه في الخزان وصل إلى درجة حرجة — استمرار الري مهدد.",
        "RESERVOIR_LEAK":        "انخفاض غير مبرر في منسوب الخزان دون استخدام نشط للري — احتمال تسرب.",
        # Data / Statistical
        "sensor_error":   "قراءات خارج النطاق المنطقي تماماً — المستشعر قد يكون معطوباً أو محتاجاً لمعايرة.",
        "stuck_sensor":   "المستشعر يرسل نفس القيمة بشكل متكرر — احتمال عطل أو انقطاع في الاتصال.",
        "z_score":        "قراءة تنحرف انحرافاً كبيراً عن القيم التاريخية المعتادة للمزرعة.",
        "sudden_change":  "تغيير مفاجئ وغير مبرر في قراءة المستشعر — تحقق من الظروف الميدانية.",
        "drift":          "انجراف تدريجي في قراءات المستشعر بمرور الوقت — بحاجة إلى معايرة.",
        "correlation":    "شذوذات متزامنة رُصدت في عدة مستشعرات — مشكلة مركبة محتملة في النظام.",
    }
    _ACTION_AR = {
        # Agronomic
        "low_soil_moisture":    "راجع نظام الري وتأكد من ضخ الماء.",
        "high_soil_moisture":   "قلل من تكرار أو مدة الري.",
        "irrigation_failure":   "افحص المضخة والصمامات فوراً.",
        "soil_moisture_drift":  "أعد معايرة مستشعر الرطوبة أو أعد وضعه.",
        # Hydraulic
        "LEAK_BRANCH":          "افحص فرع الري بحثاً عن شقوق أو توصيلات مفكوكة.",
        "PIPE_BURST":           "أغلق الصمام الرئيسي وافحص الأنابيب فوراً.",
        "FILTER_CLOG_EARLY":    "جدول تنظيف الفلتر أو غسيله العكسي.",
        "FILTER_CLOG_SEVERE":   "نظف الفلتر أو استبدله فوراً.",
        "VALVE_STUCK_OPEN":     "أغلق الصمام يدوياً وافحص الملف الكهربائي.",
        "VALVE_STUCK_CLOSED":   "افتح الصمام يدوياً وافحص الملف الكهربائي.",
        "PRESSURE_ANOMALY_LOW": "تحقق من حالة المضخة ووضعية جميع الصمامات.",
        "PRESSURE_ANOMALY_HIGH":"تحقق من منظم الضغط والتغذية الرئيسية.",
        "DRIPPER_CLOG_PARTIAL": "انفخ خطوط التنقيط وتحقق من القطارات.",
        "DRIPPER_CLOG_SEVERE":  "انفخ القطارات المسدودة أو استبدلها فوراً.",
        # Equipment
        "PUMP_DEGRADATION":      "جدول صيانة وفحص المضخة.",
        "PUMP_FAILURE_IMMINENT": "افحص المضخة فوراً — فكر في الاستبدال.",
        "RESERVOIR_CRITICAL":    "أعد ملء الخزان فوراً.",
        "RESERVOIR_LEAK":        "افحص خزان المياه وخطوط التغذية بحثاً عن تسرب.",
        # Data / Statistical
        "sensor_error":   "تحقق من توصيلات المستشعر وإعداداته.",
        "stuck_sensor":   "افحص المستشعر بحثاً عن عطل أو مشكلة في الاتصال.",
        "z_score":        "راجع القراءات الأخيرة وتحقق من الظروف الميدانية.",
        "sudden_change":  "تحقق من المستشعر وابحث عن تغييرات بيئية مفاجئة.",
        "drift":          "أعد معايرة المستشعر أو جدول استبداله.",
        "correlation":    "افحص المستشعرات المرتبطة ومكونات النظام معاً.",
    }

    severity_ar = _SEVERITY_AR.get(severity, severity)
    label_ar = _TYPE_AR.get(anomaly_type, label)
    desc_ar = _DESC_AR.get(anomaly_type, meta["details"].get("message", ""))
    action_ar = _ACTION_AR.get(anomaly_type, action)

    if severity == "critical":
        msg = (
            f"🚨 *تنبيه حرج — {label_ar}*\n\n"
            f"📋 {desc_ar}\n\n"
            f"*الإجراء المطلوب فوراً:* {action_ar}\n\n"
            f"أرسل *\"شنو طرا؟\"* لمزيد من التفاصيل.\n"
            f"أرسل *\"help\"* لقائمة الأوامر."
        )
    elif severity == "high":
        msg = (
            f"🔶 *تنبيه عالي — {label_ar}*\n\n"
            f"📋 {desc_ar}\n\n"
            f"*الإجراء الموصى به:* {action_ar}\n\n"
            f"أرسل *\"شنو طرا؟\"* لمزيد من التفاصيل.\n"
            f"أرسل *\"help\"* لقائمة الأوامر."
        )
    elif severity == "medium":
        msg = (
            f"⚠️ *تنبيه — {label_ar}*\n\n"
            f"📋 {desc_ar}\n\n"
            f"*التوصية:* {action_ar}\n\n"
            f"أرسل *\"شنو طرا؟\"* لمزيد من التفاصيل.\n"
            f"أرسل *\"help\"* لقائمة الأوامر."
        )
    else:
        msg = (
            f"ℹ️ *ملاحظة — {label_ar}*\n\n"
            f"📋 {desc_ar}\n\n"
            f"*التوصية:* {action_ar}\n\n"
            f"أرسل *\"شنو طرا؟\"* لمزيد من التفاصيل.\n"
            f"أرسل *\"help\"* لقائمة الأوامر."
        )

    # Send to all farm users
    alerts_sent = 0
    phones = await _get_farm_user_phones(farm_id)
    if phones:
        try:
            from app.services.whatsapp_service import get_whatsapp_service
            ws = get_whatsapp_service()
            if ws.enabled:
                for phone in phones:
                    try:
                        await ws.send_message(phone, msg)
                        alerts_sent += 1
                    except Exception as e:
                        logger.error(f"Failed to send injection alert to {phone}: {e}")
        except Exception as e:
            logger.error(f"WhatsApp service unavailable for injection alert: {e}")
    else:
        logger.warning(f"[Anomaly Inject] No recipients for farm {farm_id}")

    return {
        "event_id": event_id,
        "farm_id": farm_id,
        "anomaly_type": anomaly_type,
        "severity": severity,
        "alerts_sent": alerts_sent,
        "recipients": phones,
    }


# ── Query Functions ───────────────────────────────────────────

async def get_anomaly_timeline(farm_id: str, days: int = 7) -> list[dict]:
    """Get anomaly counts grouped by day for charting."""
    supabase = get_supabase_admin()
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    result = supabase.table("anomaly_events").select(
        "created_at, severity"
    ).eq("farm_id", farm_id).gte("created_at", cutoff.isoformat()).execute()

    daily_counts: dict[str, dict] = defaultdict(lambda: {"total": 0, "high": 0, "medium": 0, "low": 0, "critical": 0})

    for row in result.data or []:
        created_at = row.get("created_at")
        if created_at:
            date_key = created_at[:10]
            daily_counts[date_key]["total"] += 1
            severity = row.get("severity", "medium")
            daily_counts[date_key][severity] += 1

    timeline = [
        {"date": date, "total": counts["total"], "high": counts["high"], "medium": counts["medium"], "low": counts["low"], "critical": counts["critical"]}
        for date, counts in sorted(daily_counts.items())
    ]
    return timeline


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


async def acknowledge_anomalies(
    farm_id: str,
    anomaly_ids: list[str],
    user_id: str,
    resolution_notes: str | None = None,
):
    """Mark anomalies as acknowledged, optionally with resolution notes."""
    supabase = get_supabase_admin()
    update_payload: dict = {
        "acknowledged": True,
        "acknowledged_by": user_id,
        "resolved_at": datetime.now(timezone.utc).isoformat(),
    }
    if resolution_notes:
        update_payload["resolution_notes"] = resolution_notes
    for aid in anomaly_ids:
        supabase.table("anomaly_events").update(update_payload).eq("id", aid).eq("farm_id", farm_id).execute()


async def mark_false_positive(farm_id: str, anomaly_id: str) -> bool:
    """Flag an anomaly event as a false positive."""
    supabase = get_supabase_admin()
    result = supabase.table("anomaly_events").update({
        "false_positive": True,
        "acknowledged": True,
    }).eq("id", anomaly_id).eq("farm_id", farm_id).execute()
    return bool(result.data)


async def list_anomalies(
    farm_id: str,
    anomaly_type=None,
    severity=None,
    zone_id=None,
    acknowledged=None,
    false_positive=None,
    limit=50,
    offset=0,
) -> list[dict]:
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
    if false_positive is not None:
        q = q.eq("false_positive", false_positive)
    result = q.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return result.data or []


async def get_anomaly_types() -> list[dict]:
    """Return the full anomaly_types catalog."""
    supabase = get_supabase_admin()
    result = supabase.table("anomaly_types").select("*").order("domain").order("code").execute()
    return result.data or []


def _std(values: list[float]) -> float:
    """Standard deviation."""
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((x - mean) ** 2 for x in values) / (len(values) - 1)
    return variance ** 0.5
