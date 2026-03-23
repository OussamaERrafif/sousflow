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

    supabase = get_supabase_admin()

    _SEVERITY_EMOJI_MAP = {"low": "⚠️", "medium": "🟠", "high": "🔴", "critical": "🚨"}
    _TYPE_AR_MAP = {
        "z_score": "قراءة شاذة",
        "sudden_change": "تغيير مفاجئ",
        "stuck_sensor": "مستشعر متعطل",
        "drift": "انجراف تدريجي",
        "correlation": "ارتباط مشبوه",
        "injected": "تنبيه يدوي",
    }
    _TYPE_ACTION_MAP = {
        "z_score": "راجع المستشعرات للتأكد من القراءات.",
        "sudden_change": "تحقق من حالة الري والتربة.",
        "stuck_sensor": "افحص اتصالات المستشعر.",
        "drift": "راقب التطور خلال الساعة القادمة.",
        "correlation": "افحص المضخة والصمامات.",
    }

    # Build a zone name cache to avoid UUIDs in messages
    zone_name_cache: dict[str, str] = {}
    try:
        zone_ids = list({a["zone_id"] for a in critical_anomalies if a.get("zone_id")})
        if zone_ids:
            zr = supabase.table("zones").select("id, zone_number, name").in_("id", zone_ids).execute()
            for z in (zr.data or []):
                zone_name_cache[z["id"]] = z.get("name") or f"المنطقة {z['zone_number']}"
    except Exception:
        pass

    for a in critical_anomalies[:3]:  # max 3 alerts per cycle
        sev = a["severity"]
        sev_emoji = _SEVERITY_EMOJI_MAP.get(sev, "⚠️")
        atype_ar = _TYPE_AR_MAP.get(a["anomaly_type"], a["anomaly_type"])
        action_hint = _TYPE_ACTION_MAP.get(a["anomaly_type"], "")
        details = a.get("details", {})
        detail_msg = details.get("message", "")

        msg = f"{sev_emoji} *تنبيه — {atype_ar}*\n\n"
        if a.get("zone_id"):
            zone_label = zone_name_cache.get(a["zone_id"], "منطقة غير معروفة")
            msg += f"📍 {zone_label}\n"
        if detail_msg:
            msg += f"{detail_msg}\n"
        if action_hint:
            msg += f"\n💡 {action_hint}"
        msg += '\n\nأرسل *"شنو طرا؟"* لمزيد من التفاصيل.'

        for phone in phones:
            try:
                await ws.send_message(phone, msg)
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
        "low_soil_moisture": {
            "columns": ["avg_soil_moisture_pct"],
            "details": {"message": "Soil moisture dropped below critical threshold. Check irrigation system."},
        },
        "irrigation_failure": {
            "columns": ["main_pump_flow_lpm", "zone_flow_lpm"],
            "details": {"message": "Irrigation system not delivering expected flow. Check pump and valves."},
        },
        "sensor_error": {
            "columns": ["avg_soil_moisture_pct", "air_temperature_c"],
            "details": {"message": "Sensor readings out of expected range. May require calibration or replacement."},
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
        "anomaly_type": "injected",
        "severity": severity,
        "target_columns": meta["columns"],
        "details": {**meta["details"], "injected": True, "anomaly_label": anomaly_type},
    }

    result = supabase.table("anomaly_events").insert(row).execute()
    event_id = result.data[0]["id"] if result.data else None

    # Resolve zone name
    zone_label = None
    if zone_id:
        try:
            zr = supabase.table("zones").select("zone_number, name").eq("id", zone_id).limit(1).execute()
            if zr.data:
                zone_label = zr.data[0].get("name") or f"المنطقة {zr.data[0]['zone_number']}"
        except Exception:
            pass

    # Build alert message (Arabic/Darija)
    _SEVERITY_EMOJI = {"low": "⚠️", "medium": "🟠", "critical": "🚨"}
    _TYPE_AR = {
        "low_soil_moisture": "رطوبة التربة منخفضة",
        "irrigation_failure": "عطل في نظام الري",
        "sensor_error": "خطأ في المستشعر",
    }
    _ACTION_AR = {
        "low_soil_moisture": "راجع نظام الري.",
        "irrigation_failure": "افحص المضخة والصمامات.",
        "sensor_error": "تحقق من توصيلات المستشعرات.",
    }
    _SUGGEST_CMD = {
        "low_soil_moisture": 'أرسل *"شغل الري"* إذا بغيت تبدأ الري فوراً.',
        "irrigation_failure": 'أرسل *"شنو طرا؟"* لمزيد من التفاصيل.',
        "sensor_error": 'أرسل *"شنو طرا؟"* لمزيد من التفاصيل.',
    }

    emoji = _SEVERITY_EMOJI.get(severity, "⚠️")
    label_ar = _TYPE_AR.get(anomaly_type, anomaly_type.replace("_", " "))
    action_ar = _ACTION_AR.get(anomaly_type, "راجع المزرعة.")
    suggest = _SUGGEST_CMD.get(anomaly_type, 'أرسل *"شنو طرا؟"* لمزيد من التفاصيل.')

    zone_line = f"📍 {zone_label}\n" if zone_label else ""

    if severity == "critical":
        msg = (
            f"🚨 *تنبيه حرج — {label_ar}*\n\n"
            f"{zone_line}"
            f"🔴 *الإجراء المطلوب:* {action_ar}\n\n"
            f"💡 {suggest}"
        )
    else:
        msg = (
            f"{emoji} *تنبيه — {label_ar}*\n\n"
            f"{zone_line}"
            f"💡 *التوصية:* {action_ar}\n\n"
            f"{suggest}"
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
