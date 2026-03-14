"""
OpenAI Service — Olive Irrigation AI Assistant
Provides conversational AI with awareness of the full IoT dataset schema,
olive cultivation best practices, and Souss-Massa region context.
"""
from datetime import datetime, timezone
from app.supabase_client import get_supabase_admin
from app.config import get_settings
from app.logging_config import logger

_openai_client = None


def _get_openai():
    global _openai_client
    if _openai_client is None:
        from openai import AsyncOpenAI
        _openai_client = AsyncOpenAI(api_key=get_settings().OPENAI_API_KEY)
    return _openai_client

SYSTEM_PROMPT = """You are **SoussFlow AI** — an expert olive irrigation assistant for the Souss-Massa region of Morocco (Agadir area).

You help farmers and agronomists optimize olive (Olea europaea) irrigation using IoT sensor data and environmental intelligence.

## Data Model
You have access to a 26-column IoT dataset with hourly readings:

**Environmental (shared sensors):**
- air_temperature_c (°C) — BME280, optimal 15-30°C for olives
- air_humidity_pct (%) — BME280/DHT11, optimal 40-70%
- air_pressure_hpa (hPa) — BME280
- light_intensity_lux (lux) — BH1750

**Water Infrastructure (shared):**
- reservoir_level_pct (%) — HC-SR04 ultrasonic, warning <40%, critical <25%
- main_pressure_mpa (MPa) — after filter, optimal 0.04-0.15
- filter_status — 0=clean, 1=partial clog, 2=fully clogged

**Zone Water (per-zone, 4 zones):**
- valve_open — solenoid: 0=closed, 1=open
- zone_flow_lpm (L/min) — YF-S201 flow sensor
- zone_pressure_mpa (MPa) — zone pressure inlet

**Zone Soil (per-zone):**
- soil_moisture_pct (%) — capacitive sensor, optimal 30-55% for olives

**Weather Context (Open-Meteo):**
- solar_radiation_wm2 (W/m²) — shortwave radiation
- precipitation_mm (mm) — hourly rainfall
- wind_speed_kmh (km/h) — at 10m height
- cloud_cover_pct (%) — total cloud cover

**Derived Metrics:**
- is_anomaly — 0/1 sensor fault flag
- stress_score — 0.0-1.0 (mild <0.2, moderate <0.4, severe ≥0.6)
- stress_class — none/mild/moderate/severe
- health_score — 0.0-10.0 (poor <4, fair <6, good <8, excellent ≥8)
- irrigation_needed — 0/1 irrigation decision flag

## Region Context
- **Location:** Souss-Massa, Morocco (semi-arid Mediterranean)
- **Climate:** Hot dry summers (35-45°C), mild winters, <250mm annual rainfall
- **Soils:** Sandy loam to clay loam, calcareous
- **Water:** Scarce groundwater (overexploited Souss aquifer)
- **Crop:** Picholine marocaine, Haouzia, Menara olive varieties

## Your Capabilities
1. Interpret sensor data and explain readings in agricultural context
2. Identify patterns and anomalies
3. Recommend irrigation schedules based on soil moisture, weather, and plant stress
4. Explain olive-specific agronomic concepts
5. Alert on critical conditions (frost, heat stress, drought, waterlogging)
6. Provide water conservation strategies specific to the Souss region

## Response Style
- Concise, actionable advice
- Use metric units
- Reference specific sensor values when available
- Acknowledge uncertainty in forecasts
- Prefer Moroccan Darija/French agricultural terms when relevant to the user
- Always consider water scarcity as a primary constraint
"""


async def chat(user_id: str, conversation_id: str, user_message: str) -> str:
    """Chat with context from conversation history and latest sensor data"""
    supabase = get_supabase_admin()

    # Load conversation history
    history_result = (
        supabase.table("chat_messages")
        .select("role,content")
        .eq("conversation_id", conversation_id)
        .order("created_at", desc=False)
        .limit(20)
        .execute()
    )
    history = history_result.data or []

    # Save user message
    supabase.table("chat_messages").insert({
        "conversation_id": conversation_id,
        "user_id": user_id,
        "role": "user",
        "content": user_message,
    }).execute()

    # Fetch latest sensor context for enrichment
    sensor_context = await _get_sensor_context(user_id)

    # Build messages
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    if sensor_context:
        messages.append({
            "role": "system",
            "content": f"[LIVE SENSOR DATA]\n{sensor_context}",
        })

    for msg in history:
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": user_message})

    # Call OpenAI
    try:
        response = await _get_openai().chat.completions.create(
            model=get_settings().OPENAI_MODEL,
            messages=messages,
            temperature=0.7,
            max_tokens=1500,
        )
        assistant_msg = response.choices[0].message.content
    except Exception as e:
        import traceback
        logger.error("OpenAI API error", error=str(e), traceback=traceback.format_exc())
        assistant_msg = (
            f"[DEBUG] AI error: {type(e).__name__}: {str(e)}"
        )

    # Save assistant message
    supabase.table("chat_messages").insert({
        "conversation_id": conversation_id,
        "user_id": user_id,
        "role": "assistant",
        "content": assistant_msg,
    }).execute()

    return assistant_msg


async def get_history(conversation_id: str) -> list[dict]:
    """Get conversation history"""
    supabase = get_supabase_admin()
    result = (
        supabase.table("chat_messages")
        .select("role,content,created_at")
        .eq("conversation_id", conversation_id)
        .order("created_at", desc=False)
        .execute()
    )
    return result.data or []


async def _get_sensor_context(user_id: str) -> str:
    """Build a concise sensor context string for the AI with latest data (max 3 hours)"""
    try:
        from datetime import timedelta
        supabase = get_supabase_admin()

        # Get latest reading per zone (within last 3 hours)
        three_hours_ago = (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat()
        
        result = (
            supabase.table("iot_readings")
            .select("zone_id,timestamp,air_temperature_c,air_humidity_pct,air_pressure_hpa,"
                    "light_intensity_lux,soil_moisture_pct,reservoir_level_pct,filter_status,"
                    "main_pressure_mpa,valve_open,zone_flow_lpm,zone_pressure_mpa,"
                    "solar_radiation_wm2,precipitation_mm,wind_speed_kmh,cloud_cover_pct,"
                    "stress_score,stress_class,health_score,irrigation_needed,is_anomaly")
            .eq("user_id", user_id)
            .gte("timestamp", three_hours_ago)
            .order("timestamp", desc=True)
            .limit(50)
            .execute()
        )

        if not result.data:
            return ""

        # Group by zone, take latest per zone
        zones = {}
        all_readings = []
        for r in result.data:
            zid = r["zone_id"]
            if zid not in zones:
                zones[zid] = r
            all_readings.append(r)

        # Build comprehensive context
        lines = [f"=== SoussFlow Sensor Data (Last 3 Hours) ==="]
        
        # Weather context from latest reading
        latest = list(zones.values())[0]
        weather_parts = []
        if latest.get("air_temperature_c") is not None:
            weather_parts.append(f"Temp: {latest['air_temperature_c']:.1f}°C")
        if latest.get("air_humidity_pct") is not None:
            weather_parts.append(f"RH: {latest['air_humidity_pct']:.0f}%")
        if latest.get("solar_radiation_wm2") is not None:
            weather_parts.append(f"Solar: {latest['solar_radiation_wm2']:.0f}W/m²")
        if latest.get("wind_speed_kmh") is not None:
            weather_parts.append(f"Wind: {latest['wind_speed_kmh']:.1f}km/h")
        if latest.get("precipitation_mm") is not None and latest['precipitation_mm'] > 0:
            weather_parts.append(f"Rain: {latest['precipitation_mm']:.1f}mm")
        if latest.get("cloud_cover_pct") is not None:
            weather_parts.append(f"Clouds: {latest['cloud_cover_pct']:.0f}%")
        
        if weather_parts:
            lines.append(f"Weather: {' | '.join(weather_parts)}")

        # Zone data
        lines.append("")
        lines.append("--- Zone Status ---")
        for zid in sorted(zones):
            r = zones[zid]
            ts = r.get("timestamp", "")
            ts_str = ""
            if ts:
                try:
                    dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                    age_min = int((datetime.now(timezone.utc) - dt).total_seconds() / 60)
                    ts_str = f" ({age_min}m ago)"
                except Exception:
                    pass
            
            parts = [f"Zone {zid}{ts_str}:"]
            if r.get("soil_moisture_pct") is not None:
                parts.append(f"soil={r['soil_moisture_pct']:.1f}%")
            if r.get("air_temperature_c") is not None:
                parts.append(f"temp={r['air_temperature_c']:.1f}°C")
            if r.get("air_humidity_pct") is not None:
                parts.append(f"rh={r['air_humidity_pct']:.0f}%")
            if r.get("zone_flow_lpm") is not None:
                parts.append(f"flow={r['zone_flow_lpm']:.1f}L/min")
            if r.get("zone_pressure_mpa") is not None:
                parts.append(f"pressure={r['zone_pressure_mpa']:.3f}MPa")
            if r.get("stress_class"):
                parts.append(f"stress={r['stress_class']}")
            if r.get("stress_score") is not None:
                parts.append(f"score={r['stress_score']:.2f}")
            if r.get("health_score") is not None:
                parts.append(f"health={r['health_score']:.1f}/10")
            if r.get("valve_open") is not None:
                parts.append(f"valve={'OPEN' if r['valve_open'] else 'CLOSED'}")
            if r.get("irrigation_needed") is not None:
                parts.append(f"irr_needed={'YES' if r['irrigation_needed'] else 'no'}")
            if r.get("is_anomaly") is not None and r['is_anomaly'] == 1:
                parts.append(f"ANOMALY!")
            lines.append(" | ".join(parts))

        # Add shared infrastructure
        lines.append("")
        lines.append("--- Infrastructure ---")
        r0 = list(zones.values())[0]
        infra = []
        if r0.get("reservoir_level_pct") is not None:
            level = r0['reservoir_level_pct']
            status = "OK"
            if level < 25:
                status = "CRITICAL"
            elif level < 40:
                status = "LOW"
            infra.append(f"reservoir={level:.0f}% [{status}]")
        if r0.get("filter_status") is not None:
            status = ["clean", "partial", "CLOGGED"][r0["filter_status"]]
            infra.append(f"filter={status}")
        if r0.get("main_pressure_mpa") is not None:
            infra.append(f"main_pressure={r0['main_pressure_mpa']:.3f}MPa")
        if r0.get("light_intensity_lux") is not None:
            infra.append(f"light={r0['light_intensity_lux']:.0f}lux")
        
        if infra:
            lines.append(" | ".join(infra))

        # Data quality info
        total_readings = len(all_readings)
        unique_zones = len(zones)
        lines.append(f"")
        lines.append(f"--- Data Quality ---")
        lines.append(f"Total readings (3h): {total_readings} | Zones: {unique_zones}")

        return "\n".join(lines)

    except Exception as e:
        logger.error("Failed to fetch sensor context", error=str(e))
        return ""
