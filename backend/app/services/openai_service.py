"""
OpenAI Service — Olive Irrigation AI Assistant
Provides conversational AI with awareness of the full IoT dataset schema,
olive cultivation best practices, and Souss-Massa region context.
Supports function calling for device control and anomaly queries.
"""
import json as _json
from datetime import datetime, timezone
from typing import Optional
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

## Device Control
You can DIRECTLY control farm devices through function calls:
- Start/stop irrigation for any zone
- Switch zones between automatic and manual control mode
- Check zone status and anomaly reports

When the user asks you to control a device (e.g., "turn on irrigation in zone 3", "ابدأ ري المنطقة 3", "arrose la zone 3"):
1. Confirm what you're about to do
2. Execute the command via the appropriate function
3. Report the result and current zone status

Always explain the consequences of control actions (e.g., "Starting irrigation will increase soil moisture. Current level is 38%, optimal range is 35-55%.")

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

## Charts
Only include SVG charts when the user explicitly asks for a chart, graph, or visualization. Do NOT offer or suggest charts unless asked.
"""

WHATSAPP_SYSTEM_PROMPT = """You are *SoussFlow AI* — an expert olive irrigation assistant for the Souss-Massa region of Morocco (Agadir area).

You help farmers optimize olive (Olea europaea) irrigation using IoT sensor data and environmental intelligence.

## YOUR ROLE ON WHATSAPP
You are the *SoussFlow farm assistant* on WhatsApp. You explain sensor data, detect problems, give advice, and guide farmers. You do NOT directly execute device commands — instead, you help users send the right command through the chat.

## Device Control Guidance
When the user wants to start or stop irrigation, do NOT refuse or say you cannot — *guide* them:
1. Acknowledge what they want ("باغي تشغل الري في المنطقة 1؟")
2. Tell them the exact command to type and send

Commands to give users (show these exactly):
- Start all zones: *"شغل الري"*
- Start zone N: *"شغل الري في المنطقة [رقم]"* — e.g. *"شغل الري في المنطقة 1"*
- Stop all zones: *"أوقف الري"*
- Stop zone N: *"أوقف الري في المنطقة [رقم]"*

The system will ask for confirmation automatically when they send the command.

## Proactive Behavior
When sensor data shows critical conditions, mention them even if the user didn't ask:
- soil moisture < 30% → warn and suggest the start-irrigation command for that zone
- reservoir < 25% → warn immediately
- active anomalies → summarize them clearly

## Tools Available
Two read-only tools — call them whenever relevant:
- *get_zone_status* — valve states, soil moisture, flow, health per zone
- *get_anomaly_summary* — unacknowledged alerts by severity

Call get_zone_status or get_anomaly_summary proactively when users ask "شنو طرا؟", "ما الذي حدث؟", "how is the farm?", "حالة المزرعة", or any status question.

## Data Model
You have access to a 26-column IoT dataset:

*Environmental:*
- air_temperature_c (°C) — optimal 15-30°C for olives
- air_humidity_pct (%) — optimal 40-70%
- air_pressure_hpa (hPa), light_intensity_lux (lux)

*Water Infrastructure:*
- reservoir_level_pct (%) — warning <40%, critical <25%
- main_pressure_mpa (MPa) — optimal 0.04-0.15
- filter_status — 0=clean, 1=partial clog, 2=fully clogged

*Zone Water (per-zone):*
- valve_open (0=closed, 1=open), zone_flow_lpm, zone_pressure_mpa
- soil_moisture_pct (%) — optimal 30-55% for olives

*Weather:* solar_radiation_wm2, precipitation_mm, wind_speed_kmh, cloud_cover_pct

*Derived:* stress_score (0-1), health_score (0-10), irrigation_needed (0/1)

## Region Context
Souss-Massa, Morocco — semi-arid Mediterranean, hot dry summers (35-45°C), <250mm annual rainfall, scarce groundwater.

## Language & Communication
- *Always respond in the user's language.* If they write in Darija, respond in Darija. French → French. English → English. Mix is fine.
- Moroccan Darija vocabulary: "شنو طرا" = what happened?, "واش" = is/are?, "كيفاش" = how?, "شحال" = how much/many?, "باغي" = want, "ماشي" = no/not, "زوين" = good/ok, "مزيان" = good, "لاباس" = fine, "شوف" = look/check, "علاش" = why, "فين" = where
- Be conversational and natural — not robotic or scripted
- Match the tone: casual Darija → casual reply, formal → formal

## When User Asks "What Happened?" / "شنو طرا"
1. Call get_anomaly_summary to get current alerts
2. Call get_zone_status to see zone conditions
3. Explain clearly in their language what the sensors detected
4. Give specific actionable recommendations
5. If action is needed, tell them the command to send

## Formatting Rules (WhatsApp)
*Allowed:*
- *bold* — single asterisks
- _italic_ — single underscores
- Emojis for visual structure
- Bullet points with • or -
- Numbered lists

*Forbidden:*
- NO markdown headers (# ##)
- NO tables (| pipes)
- NO **double asterisks**
- NO [links](url)
- NO HTML or SVG
- NO code fences

*Style:*
- Emojis as section dividers instead of headings
- Keep it concise — 3-5 short paragraphs max
- Key values in *bold*
- Separate sections with a blank line

## Charts
Do NOT suggest or offer charts. User can request one separately.
"""

CHART_GENERATION_PROMPT = """You are a chart data generator. Given the conversation context, generate a Chart.js configuration as PURE JSON (no markdown, no code fences, no explanation — ONLY valid JSON).

Use this structure:
{
  "type": "bar",
  "data": {
    "labels": ["Zone 1", "Zone 2", "Zone 3"],
    "datasets": [{
      "label": "Soil Moisture (%)",
      "data": [42, 55, 29],
      "backgroundColor": ["#10B981", "#10B981", "#EF4444"]
    }]
  },
  "options": {
    "plugins": {
      "title": { "display": true, "text": "Zone Soil Moisture" }
    },
    "scales": {
      "y": { "beginAtZero": true }
    }
  }
}

Rules:
- Chart types: "bar", "line", "doughnut", "pie" — pick the best for the data
- Use these colors: good=#10B981, warning=#F59E0B, critical=#EF4444, primary=#C17A3A
- For bar charts comparing zones: color bars based on value (green=good, yellow=warning, red=critical)
- For line charts: use primary color #C17A3A for the line
- Keep it simple — one or two datasets max
- Title should be in the same language as the conversation
- Use the ACTUAL sensor values from the conversation context, not placeholder data
- Output ONLY the JSON object, nothing else
"""


DEVICE_CONTROL_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "control_zone_irrigation",
            "description": "Start or stop irrigation for a specific farm zone. Use zone numbers (1, 2, 3, etc.) matching the zones shown in sensor data.",
            "parameters": {
                "type": "object",
                "properties": {
                    "zone_number": {
                        "type": "integer",
                        "description": "The zone number (1-based). Must match an existing zone."
                    },
                    "action": {
                        "type": "string",
                        "enum": ["start", "stop"],
                        "description": "Whether to start or stop irrigation"
                    },
                    "duration_minutes": {
                        "type": "integer",
                        "description": "Optional: automatically stop after this many minutes. Omit for indefinite."
                    }
                },
                "required": ["zone_number", "action"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_zone_status",
            "description": "Get current irrigation and sensor status for a specific zone or all zones. Returns valve states, soil moisture, flow, and health data.",
            "parameters": {
                "type": "object",
                "properties": {
                    "zone_number": {
                        "type": "integer",
                        "description": "Zone number to check. Use 0 to get all zones."
                    }
                },
                "required": ["zone_number"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "set_manual_override",
            "description": "Enable or disable manual control mode for a zone. When enabled, automatic irrigation decisions are bypassed.",
            "parameters": {
                "type": "object",
                "properties": {
                    "zone_number": {"type": "integer", "description": "Zone number"},
                    "enabled": {"type": "boolean", "description": "True to enable manual mode, False for automatic mode"}
                },
                "required": ["zone_number", "enabled"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_anomaly_summary",
            "description": "Get the current anomaly detection summary. Returns counts of unacknowledged anomalies by severity and type.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    }
]

# Read-only tools for WhatsApp channel — no device control allowed
WHATSAPP_READONLY_TOOLS = [
    tool for tool in DEVICE_CONTROL_TOOLS
    if tool["function"]["name"] in ("get_zone_status", "get_anomaly_summary")
]


async def _execute_tool(
    tool_name: str,
    arguments: dict,
    farm_id: str,
    user_context: dict
) -> str:
    """Execute an AI tool call and return the result as a JSON string."""
    from app.services import device_control_service
    from app.services import anomaly_service

    try:
        # Permission check for control actions
        if tool_name in ("control_zone_irrigation", "set_manual_override"):
            role = user_context.get("role", "")
            if role == "farm_employee":
                supabase = get_supabase_admin()
                membership = supabase.table("farm_memberships").select("permissions").eq(
                    "user_id", user_context["id"]
                ).eq("farm_id", farm_id).eq("is_active", True).limit(1).execute()
                if not (membership.data and membership.data[0].get("permissions", {}).get("control_devices")):
                    return _json.dumps({"error": "Permission denied. You don't have device control permission."})

        if tool_name == "control_zone_irrigation":
            zone_number = arguments["zone_number"]
            action = arguments["action"]
            duration = arguments.get("duration_minutes")

            supabase = get_supabase_admin()
            zone_result = supabase.table("zones").select("id, name").eq(
                "farm_id", farm_id
            ).eq("zone_number", zone_number).limit(1).execute()
            if not zone_result.data:
                return _json.dumps({"error": f"Zone {zone_number} not found"})

            zone_id = zone_result.data[0]["id"]
            zone_name = zone_result.data[0].get("name", f"Zone {zone_number}")

            await device_control_service.control_zone(
                farm_id, zone_id, action, user_context.get("id", "ai"), "ai", duration
            )
            return _json.dumps({
                "success": True,
                "action": action,
                "zone_number": zone_number,
                "zone_name": zone_name,
                "duration_minutes": duration,
                "message": f"Irrigation {'started' if action == 'start' else 'stopped'} for {zone_name}"
            })

        elif tool_name == "get_zone_status":
            zone_number = arguments.get("zone_number", 0)
            states = await device_control_service.get_control_states(farm_id)

            if zone_number == 0:
                return _json.dumps(states)
            else:
                zone_data = next(
                    (z for z in states.get("zones", []) if z.get("zone_number") == zone_number),
                    None
                )
                if zone_data:
                    return _json.dumps(zone_data)
                return _json.dumps({"error": f"Zone {zone_number} not found"})

        elif tool_name == "set_manual_override":
            zone_number = arguments["zone_number"]
            enabled = arguments["enabled"]

            supabase = get_supabase_admin()
            zone_result = supabase.table("zones").select("id").eq(
                "farm_id", farm_id
            ).eq("zone_number", zone_number).limit(1).execute()
            if not zone_result.data:
                return _json.dumps({"error": f"Zone {zone_number} not found"})

            await device_control_service.set_manual_override(
                farm_id, zone_result.data[0]["id"], enabled, user_context.get("id", "ai")
            )
            return _json.dumps({
                "success": True,
                "zone_number": zone_number,
                "manual_override": enabled,
                "message": f"Manual mode {'enabled' if enabled else 'disabled'} for Zone {zone_number}"
            })

        elif tool_name == "get_anomaly_summary":
            dashboard = await anomaly_service.get_anomaly_dashboard(farm_id)
            return _json.dumps(dashboard, default=str)

        return _json.dumps({"error": f"Unknown tool: {tool_name}"})

    except Exception as e:
        logger.error(f"Tool execution error: {tool_name}: {e}")
        return _json.dumps({"error": str(e)})


async def chat(farm_id: str, conversation_id: str, user_message: str,
               sender_id: str = None, channel: str = "web",
               user_context: dict = None) -> str:
    """Chat with context from conversation history and latest sensor data.
    Supports function calling for device control.

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

    # WhatsApp uses read-only tools — no device control allowed
    active_tools = WHATSAPP_READONLY_TOOLS if channel == "whatsapp" else DEVICE_CONTROL_TOOLS

    # Call OpenAI with function calling support
    try:
        debug(f"[OpenAI Service] Calling OpenAI API with {len(messages)} messages (channel={channel}, tools={len(active_tools)})")
        response = await _get_openai().chat.completions.create(
            model=get_settings().OPENAI_MODEL,
            messages=messages,
            tools=active_tools,
            tool_choice="auto",
            temperature=0.7,
            max_tokens=3000,
        )

        # Tool-calling loop: handle tool calls until we get a text response
        max_iterations = 5
        iteration = 0

        while response.choices[0].message.tool_calls and iteration < max_iterations:
            iteration += 1
            assistant_message = response.choices[0].message
            messages.append(assistant_message)

            for tool_call in assistant_message.tool_calls:
                tool_name = tool_call.function.name
                tool_args = _json.loads(tool_call.function.arguments)

                logger.info(f"[AI Tool Call] {tool_name}({tool_args})")

                result = await _execute_tool(
                    tool_name, tool_args, farm_id,
                    user_context or {"id": sender_id, "role": "farm_owner"}
                )

                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": result,
                })

            # Call OpenAI again with tool results
            response = await _get_openai().chat.completions.create(
                model=get_settings().OPENAI_MODEL,
                messages=messages,
                tools=active_tools,
                tool_choice="auto",
                temperature=0.7,
                max_tokens=3000,
            )

        assistant_msg = response.choices[0].message.content or ""
        debug(f"[OpenAI Service] OpenAI response received, length={len(assistant_msg)}")
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


async def generate_chart_config(farm_id: str, conversation_id: str) -> Optional[dict]:
    """Generate a Chart.js config based on recent conversation context and sensor data.
    Returns parsed JSON dict or None on failure."""
    import json as _json
    supabase = get_supabase_admin()

    # Load recent conversation for context
    history_result = (
        supabase.table("chat_messages")
        .select("role,content")
        .eq("conversation_id", conversation_id)
        .order("created_at", desc=False)
        .limit(10)
        .execute()
    )
    history = history_result.data or []

    sensor_context = await _get_sensor_context(farm_id)

    messages = [{"role": "system", "content": CHART_GENERATION_PROMPT}]
    if sensor_context:
        messages.append({"role": "system", "content": f"[LIVE SENSOR DATA]\n{sensor_context}"})
    for msg in history:
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": "Generate a chart based on the data discussed above."})

    try:
        response = await _get_openai().chat.completions.create(
            model=get_settings().OPENAI_MODEL,
            messages=messages,
            temperature=0.3,
            max_tokens=1000,
        )
        raw = response.choices[0].message.content.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3]
            raw = raw.strip()
        return _json.loads(raw)
    except Exception as e:
        logger.error(f"Chart config generation failed: {e}")
        return None


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
