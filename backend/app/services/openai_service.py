"""
OpenAI Service — Olive Irrigation AI Assistant
Provides conversational AI with awareness of the full IoT dataset schema,
olive cultivation best practices, and Souss-Massa region context.
"""
from datetime import datetime, timezone
from app.supabase_client import get_supabase_admin
from app.config import get_settings
from app.logging_config import logger, debug, debug_service_call

_openai_client = None


def _get_openai():
    global _openai_client
    if _openai_client is None:
        from openai import AsyncOpenAI
        _openai_client = AsyncOpenAI(api_key=get_settings().OPENAI_API_KEY)
    return _openai_client

_BASE_PROMPT = """You are *SoussFlow AI* — an expert olive irrigation assistant for the Souss-Massa region of Morocco (Agadir area).

You help farmers and agronomists optimize olive (Olea europaea) irrigation using IoT sensor data and environmental intelligence.

## Data Model
You have access to a 26-column IoT dataset with hourly readings:

*Environmental (shared sensors):*
- air_temperature_c (°C) — BME280, optimal 15-30°C for olives
- air_humidity_pct (%) — BME280/DHT11, optimal 40-70%
- air_pressure_hpa (hPa) — BME280
- light_intensity_lux (lux) — BH1750

*Water Infrastructure (shared):*
- reservoir_level_pct (%) — HC-SR04 ultrasonic, warning <40%, critical <25%
- main_pressure_mpa (MPa) — after filter, optimal 0.04-0.15
- filter_status — 0=clean, 1=partial clog, 2=fully clogged

*Zone Water (per-zone, 4 zones):*
- valve_open — solenoid: 0=closed, 1=open
- zone_flow_lpm (L/min) — YF-S201 flow sensor
- zone_pressure_mpa (MPa) — zone pressure inlet

*Zone Soil (per-zone):*
- soil_moisture_pct (%) — capacitive sensor, optimal 30-55% for olives

*Weather Context (Open-Meteo):*
- solar_radiation_wm2 (W/m²) — shortwave radiation
- precipitation_mm (mm) — hourly rainfall
- wind_speed_kmh (km/h) — at 10m height
- cloud_cover_pct (%) — total cloud cover

*Derived Metrics:*
- is_anomaly — 0/1 sensor fault flag
- stress_score — 0.0-1.0 (mild <0.2, moderate <0.4, severe ≥0.6)
- stress_class — none/mild/moderate/severe
- health_score — 0.0-10.0 (poor <4, fair <6, good <8, excellent ≥8)
- irrigation_needed — 0/1 irrigation decision flag

## Region Context
- Souss-Massa, Morocco (semi-arid Mediterranean)
- Hot dry summers (35-45°C), mild winters, <250mm annual rainfall
- Sandy loam to clay loam, calcareous soils
- Scarce groundwater (overexploited Souss aquifer)
- Picholine marocaine, Haouzia, Menara olive varieties

## Your Capabilities
1. Interpret sensor data and explain readings in agricultural context
2. Identify patterns and anomalies
3. Recommend irrigation schedules based on soil moisture, weather, and plant stress
4. Explain olive-specific agronomic concepts
5. Alert on critical conditions (frost, heat stress, drought, waterlogging)
6. Provide water conservation strategies specific to the Souss region

## Core Response Style
- Concise, actionable advice
- Use metric units
- Reference specific sensor values when available
- Acknowledge uncertainty in forecasts
- Prefer Moroccan Darija/French agricultural terms when relevant to the user
- Always consider water scarcity as a primary constraint
- Match the user's language (Arabic → Arabic, French → French, English → English)
"""

SYSTEM_PROMPT = _BASE_PROMPT + """
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

WHATSAPP_SYSTEM_PROMPT = _BASE_PROMPT + """
## Formatting Rules (WhatsApp)
You are responding via WhatsApp. Use ONLY WhatsApp-compatible formatting:

*Allowed formatting:*
- *bold* → wrap with single asterisks: *text*
- _italic_ → wrap with single underscores: _text_
- ~strikethrough~ → wrap with tildes: ~text~
- ```monospace``` → wrap with triple backticks
- Use line breaks freely for readability
- Use emojis for visual structure (🌡️ 💧 🌿 📊 ⚠️ ✅ ❌)
- Use bullet points with • or -

*Strictly forbidden:*
- NO markdown headers (no # or ##)
- NO markdown tables (no | pipes)
- NO **double asterisks** — use *single* for bold
- NO [links](url) syntax
- NO HTML or SVG tags
- NO code blocks with language identifiers
- NO blockquotes with >

*Structure tips:*
- Use emojis as section headers instead of # headings
- Separate sections with a blank line
- Keep responses concise — max 3-4 short paragraphs
- Use numbered or bulleted lists for multiple items
- Put key values in *bold* with single asterisks

*Example response:*
🌡️ *حالة الطقس الحالية*

الحرارة: *28.5°C* (جيدة للزيتون)
الرطوبة: *45%* (ضمن المعدل)
الإشعاع: *620 W/m²*

💧 *حالة الري*

• المنطقة 1: رطوبة التربة *38%* — _تحتاج ري_
• المنطقة 2: رطوبة التربة *52%* — ✅ جيدة
• المنطقة 3: رطوبة التربة *29%* — ⚠️ _منخفضة جداً_

🌿 *التوصيات*

1. ابدأ ري المنطقة 3 فوراً
2. المنطقة 1 تحتاج ري خلال ساعتين
3. المنطقة 2 لا تحتاج ري حالياً
"""


async def chat(farm_id: str, conversation_id: str, user_message: str, sender_id: str = None, channel: str = "web") -> str:
    """Chat with context from conversation history and latest sensor data.

    channel: "web" for dashboard (rich markdown + SVG), "whatsapp" for WhatsApp formatting
    """
    supabase = get_supabase_admin()
    debug(f"[OpenAI Service] Chat request: farm={farm_id[:8]}, conv={conversation_id[:8]}, channel={channel}, msg_len={len(user_message)}")

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
    debug(f"[OpenAI Service] Loaded {len(history)} messages from history")

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
    debug(f"[OpenAI Service] Sensor context length: {len(sensor_context) if sensor_context else 0} chars")

    # Build messages — pick prompt based on channel
    prompt = WHATSAPP_SYSTEM_PROMPT if channel == "whatsapp" else SYSTEM_PROMPT
    messages = [{"role": "system", "content": prompt}]

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
        debug(f"[OpenAI Service] Calling OpenAI API with {len(messages)} messages")
        response = await _get_openai().chat.completions.create(
            model=get_settings().OPENAI_MODEL,
            messages=messages,
            temperature=0.7,
            max_tokens=3000,
        )
        assistant_msg = response.choices[0].message.content
        debug(f"[OpenAI Service] OpenAI response received, length={len(assistant_msg) if assistant_msg else 0}")
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
        
        # Get latest environment reading
        env_result = (
            supabase.table("environment_readings")
            .select("*")
            .eq("farm_id", farm_id)
            .gte("timestamp", three_hours_ago)
            .order("timestamp", desc=True)
            .limit(1)
            .execute()
        )

        # Get latest infrastructure reading
        infra_result = (
            supabase.table("infrastructure_readings")
            .select("*")
            .eq("farm_id", farm_id)
            .gte("timestamp", three_hours_ago)
            .order("timestamp", desc=True)
            .limit(1)
            .execute()
        )

        # Get latest zone health readings
        zone_health_result = (
            supabase.table("zone_health_readings")
            .select("*")
            .eq("farm_id", farm_id)
            .gte("timestamp", three_hours_ago)
            .order("timestamp", desc=True)
            .limit(50)
            .execute()
        )

        if not env_result.data and not zone_health_result.data:
            return ""

        latest_env = env_result.data[0] if env_result.data else {}
        latest_infra = infra_result.data[0] if infra_result.data else {}

        # Group zone health by zone_id, take latest per zone
        zones = {}
        for r in (zone_health_result.data or []):
            zid = r["zone_id"]
            if zid not in zones:
                zones[zid] = r

        # Build comprehensive context
        lines = ["=== LIVE SENSOR DATA ==="]

        # Weather context from environment reading
        weather_parts = []
        if latest_env.get("air_temperature_c") is not None:
            weather_parts.append(f"Temp: {latest_env['air_temperature_c']:.1f}°C")
        if latest_env.get("air_humidity_pct") is not None:
            weather_parts.append(f"RH: {latest_env['air_humidity_pct']:.0f}%")
        if latest_env.get("solar_radiation_wm2") is not None:
            weather_parts.append(f"Solar: {latest_env['solar_radiation_wm2']:.0f}W/m²")
        if latest_env.get("wind_speed_kmh") is not None:
            weather_parts.append(f"Wind: {latest_env['wind_speed_kmh']:.1f}km/h")
        if latest_env.get("precipitation_mm") is not None and latest_env['precipitation_mm'] > 0:
            weather_parts.append(f"Rain: {latest_env['precipitation_mm']:.1f}mm")
        if latest_env.get("cloud_cover_pct") is not None:
            weather_parts.append(f"Clouds: {latest_env['cloud_cover_pct']:.0f}%")

        if weather_parts:
            lines.append(f"Weather: {' | '.join(weather_parts)}")

        # Zone data — current snapshot from zone_health_readings
        lines.append("")
        lines.append("--- CURRENT (per zone) ---")
        for zid in sorted(zones):
            r = zones[zid]
            parts = [f"Zone {zid[:8]}:"]
            if r.get("avg_soil_moisture_pct") is not None:
                parts.append(f"soil={r['avg_soil_moisture_pct']:.1f}%")
            if r.get("stress_score") is not None:
                parts.append(f"stress={r['stress_score']:.3f}")
            if r.get("health_score") is not None:
                parts.append(f"health={r['health_score']:.1f}/10")
            if r.get("water_efficiency_pct") is not None:
                parts.append(f"efficiency={r['water_efficiency_pct']:.0f}%")
            if r.get("leak_count") is not None and r['leak_count'] > 0:
                parts.append(f"LEAKS={r['leak_count']}")
            if r.get("is_anomaly") is not None and r['is_anomaly'] == 1:
                parts.append("ANOMALY!")
            lines.append(" | ".join(parts))

        # Infrastructure from infrastructure_readings
        infra = []
        if latest_infra.get("reservoir_level_pct") is not None:
            level = latest_infra['reservoir_level_pct']
            tag = "CRITICAL" if level < 25 else "LOW" if level < 40 else "OK"
            infra.append(f"reservoir={level:.0f}% [{tag}]")
        if latest_infra.get("filter_status") is not None:
            infra.append(f"filter={['clean','partial','CLOGGED'][latest_infra['filter_status']]}")
        if latest_infra.get("main_pressure_mpa") is not None:
            infra.append(f"main_pressure={latest_infra['main_pressure_mpa']:.3f}MPa")
        if latest_infra.get("main_pump_flow_lpm") is not None:
            infra.append(f"pump_flow={latest_infra['main_pump_flow_lpm']:.1f}L/min")
        if infra:
            lines.append(f"Infra: {' | '.join(infra)}")

        # Recent history — from environment readings
        lines.append("")
        lines.append("--- RECENT HISTORY ---")
        recent_env = (
            supabase.table("environment_readings")
            .select("timestamp,air_temperature_c,air_humidity_pct,solar_radiation_wm2")
            .eq("farm_id", farm_id)
            .gte("timestamp", three_hours_ago)
            .order("timestamp", desc=True)
            .limit(8)
            .execute()
        )
        for r in reversed(recent_env.data or []):
            ts = r.get("timestamp", "")
            time_str = ""
            if ts:
                try:
                    dt_val = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                    time_str = dt_val.strftime("%H:%M")
                except Exception:
                    pass
            vals = []
            if r.get("air_temperature_c") is not None:
                vals.append(f"temp={r['air_temperature_c']:.1f}")
            if r.get("air_humidity_pct") is not None:
                vals.append(f"hum={r['air_humidity_pct']:.0f}%")
            if r.get("solar_radiation_wm2") is not None:
                vals.append(f"solar={r['solar_radiation_wm2']:.0f}")
            lines.append(f"{time_str}: {', '.join(vals)}")

        return "\n".join(lines)

    except Exception as e:
        logger.error("Failed to fetch sensor context", error=str(e))
        return ""
