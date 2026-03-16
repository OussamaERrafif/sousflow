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
- Match the user's language (Arabic → Arabic, French → French, English → English)

## SVG Charts
When the user asks about data, comparisons, trends, or any question where a visual helps — include a simple SVG chart in your response.
Generate inline SVG directly in your markdown (NOT inside code fences — no ``` around it).
Always use `xmlns="http://www.w3.org/2000/svg"` and keep width ≤ 420px.

Keep charts **simple and clean** — basic bars, lines, or arcs. No gradients, no shadows, no animations.

**When to include a chart:**
- User asks "how much" / "what is" a value → simple bar chart showing value vs optimal range
- User asks to compare zones → bar chart with one bar per zone
- User asks about trends or history → line chart with the recent data points
- User asks about overall status → bar chart of all zones side by side

**Chart colors:**
- Good/in-range: #10B981
- Warning: #F59E0B
- Critical: #EF4444
- Primary: #C17A3A
- Dark text: #3D1F0F
- Muted text: #71717A

Simple bar chart example:
<svg width="400" height="220" xmlns="http://www.w3.org/2000/svg">
  <text x="200" y="18" text-anchor="middle" font-size="14" font-weight="bold" fill="#3D1F0F">Zone Moisture (%)</text>
  <rect x="40" y="40" width="60" height="120" rx="4" fill="#C17A3A"/>
  <text x="70" y="175" text-anchor="middle" font-size="11" fill="#666">Z1</text>
  <text x="70" y="35" text-anchor="middle" font-size="10" fill="#C17A3A">48%</text>
</svg>

Simple line chart example:
<svg width="400" height="180" xmlns="http://www.w3.org/2000/svg">
  <text x="200" y="16" text-anchor="middle" font-size="13" font-weight="bold" fill="#3D1F0F">Soil Moisture Trend</text>
  <line x1="40" y1="150" x2="380" y2="150" stroke="#E5E7EB" stroke-width="1"/>
  <polyline points="60,80 120,90 180,70 240,100 300,85 360,95" fill="none" stroke="#C17A3A" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="60" cy="80" r="3" fill="#C17A3A"/>
  <text x="60" y="165" text-anchor="middle" font-size="9" fill="#71717A">10:00</text>
</svg>

The sensor data section includes RECENT HISTORY with timestamped readings — use those real values when building trend charts.

## Markdown Formatting
Use rich markdown in your answers:
- **Bold** for key metrics and values
- Tables for comparing zone data side-by-side
- Bullet lists for recommendations
- `inline code` for sensor field names
- > Blockquotes for important warnings or tips
- ### Headings to organize sections
"""


async def chat(farm_id: str, conversation_id: str, user_message: str, sender_id: str = None) -> str:
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
    user_msg_data = {
        "conversation_id": conversation_id,
        "role": "user",
        "content": user_message,
    }
    if sender_id:
        user_msg_data["sender_id"] = sender_id
    supabase.table("chat_messages").insert(user_msg_data).execute()

    # Fetch latest sensor context for enrichment
    sensor_context = await _get_sensor_context(farm_id)

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
            max_tokens=3000,
        )
        assistant_msg = response.choices[0].message.content
    except Exception as e:
        import traceback
        logger.error("OpenAI API error", error=str(e), traceback=traceback.format_exc())
        assistant_msg = "عذراً، حدث خطأ في خدمة الذكاء الاصطناعي. يرجى المحاولة مرة أخرى لاحقاً."

    # Save assistant message (sender_id is NULL for assistant)
    supabase.table("chat_messages").insert({
        "conversation_id": conversation_id,
        "role": "assistant",
        "content": assistant_msg,
    }).execute()

    # Update conversation's updated_at so it sorts correctly in the list
    supabase.table("conversations").update({
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", conversation_id).execute()

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


async def _get_sensor_context(farm_id: str) -> str:
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
            .eq("farm_id", farm_id)
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
        lines = ["=== LIVE SENSOR DATA ==="]

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

        # Zone data — current snapshot
        lines.append("")
        lines.append("--- CURRENT (per zone) ---")
        for zid in sorted(zones):
            r = zones[zid]
            parts = [f"Zone {zid}:"]
            if r.get("soil_moisture_pct") is not None:
                parts.append(f"soil={r['soil_moisture_pct']:.1f}%")
            if r.get("air_temperature_c") is not None:
                parts.append(f"temp={r['air_temperature_c']:.1f}°C")
            if r.get("stress_class"):
                parts.append(f"stress={r['stress_class']}")
            if r.get("health_score") is not None:
                parts.append(f"health={r['health_score']:.1f}/10")
            if r.get("valve_open") is not None:
                parts.append(f"valve={'OPEN' if r['valve_open'] else 'CLOSED'}")
            if r.get("irrigation_needed") is not None:
                parts.append(f"irr_needed={'YES' if r['irrigation_needed'] else 'no'}")
            if r.get("is_anomaly") is not None and r['is_anomaly'] == 1:
                parts.append("ANOMALY!")
            lines.append(" | ".join(parts))

        # Infrastructure
        r0 = list(zones.values())[0]
        infra = []
        if r0.get("reservoir_level_pct") is not None:
            level = r0['reservoir_level_pct']
            tag = "CRITICAL" if level < 25 else "LOW" if level < 40 else "OK"
            infra.append(f"reservoir={level:.0f}% [{tag}]")
        if r0.get("filter_status") is not None:
            infra.append(f"filter={['clean','partial','CLOGGED'][r0['filter_status']]}")
        if r0.get("main_pressure_mpa") is not None:
            infra.append(f"main_pressure={r0['main_pressure_mpa']:.3f}MPa")
        if infra:
            lines.append(f"Infra: {' | '.join(infra)}")

        # Recent history — for trend / history charts
        lines.append("")
        lines.append("--- RECENT HISTORY (use for charts) ---")
        # Group all readings by zone, show time series
        zone_history: dict[int, list] = {}
        for r in all_readings:
            zid = r["zone_id"]
            if zid not in zone_history:
                zone_history[zid] = []
            zone_history[zid].append(r)

        for zid in sorted(zone_history):
            readings_list = zone_history[zid][:8]  # last 8 readings per zone
            readings_list.reverse()  # oldest first
            entries = []
            for r in readings_list:
                ts = r.get("timestamp", "")
                time_str = ""
                if ts:
                    try:
                        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                        time_str = dt.strftime("%H:%M")
                    except Exception:
                        pass
                vals = []
                if r.get("soil_moisture_pct") is not None:
                    vals.append(f"soil={r['soil_moisture_pct']:.1f}")
                if r.get("air_temperature_c") is not None:
                    vals.append(f"temp={r['air_temperature_c']:.1f}")
                if r.get("health_score") is not None:
                    vals.append(f"health={r['health_score']:.1f}")
                entries.append(f"{time_str}→{','.join(vals)}")
            lines.append(f"Zone {zid}: {' | '.join(entries)}")

        return "\n".join(lines)

    except Exception as e:
        logger.error("Failed to fetch sensor context", error=str(e))
        return ""
