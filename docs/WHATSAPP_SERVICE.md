# SoussFlow WhatsApp Service — Full Breakdown

## Overview

The WhatsApp service connects the SoussFlow irrigation platform to WhatsApp, enabling farm owners and employees to interact with their farms via a familiar chat interface. It is built around **WaSenderAPI** (`https://wasenderapi.com`), an external WhatsApp Business API provider, and features an **AI-powered conversational assistant** backed by OpenAI.

The service lives entirely in the FastAPI backend at:
- `backend/app/services/whatsapp_service.py` — core service logic
- `backend/app/routes/whatsapp_routes.py` — HTTP API endpoints
- `backend/app/schemas/whatsapp.py` — Pydantic request/response models

---

## Architecture Diagram

```
                                    ┌─────────────────────────────────────────┐
                                    │           SoussFlow Backend             │
  WhatsApp User                     │  FastAPI + Supabase + OpenAI            │
      │                             │                                         │
      │  sends message              │  ┌───────────────────────────────────┐ │
      │ ─────────────────────────────────►  POST /api/whatsapp/webhook   │ │
      │                             │  │  (WaSenderAPI calls this on      │ │
      │                             │  │   every incoming message)       │ │
      │                             │  └───────────────┬─────────────────┘ │
      │                             │                  │                   │
      │                             │  ┌───────────────▼─────────────────┐ │
      │                             │  │  WhatsAppService                │ │
      │                             │  │  handle_incoming_message()       │ │
      │                             │  │                                  │ │
      │                             │  │  1. Log inbound message         │ │
      │                             │  │  2. Get/create AI session       │ │
      │                             │  │  3. Route by state:             │ │
      │                             │  │     - awaiting_farm_name        │ │
      │                             │  │     - connected → AI flow      │ │
      │                             │  └───────────────┬─────────────────┘ │
      │                             │                  │                   │
      │                             │  ┌───────────────▼─────────────────┐ │
      │                             │  │  OpenAI chat()                  │ │
      │                             │  │  (full conversation context)     │ │
      │                             │  └───────────────┬─────────────────┘ │
      │                             │                  │                   │
      │   receives reply            │  ┌───────────────▼─────────────────┐ │
      │ ◄─────────────────────────────────  WaSenderAPI send-message    │ │
      │                             │  │  POST /api/send-message        │ │
      │                             │  └───────────────────────────────────┘ │
      │                             │                                         │
      │                             │  ┌───────────────────────────────────┐ │
      │  sends alert (outbound)    │  │  AnomalyService                  │ │
      │ ◄─────────────────────────────────  _auto_alert()               │ │
      │                             │  │  (triggers on sensor anomalies)  │ │
      │                             │  └───────────────────────────────────┘ │
      │                             │                                         │
      └─────────────────────────────┘   WaSenderAPI (external)              │
                                    └─────────────────────────────────────────┘
                                              │
                                              ▼
                                    https://wasenderapi.com
```

---

## Configuration

All settings live in `app/config.py` via **Pydantic Settings**. They are loaded from environment variables (`.env`).

| Environment Variable | Default | Description |
|---|---|---|
| `WASSENDER_ENABLED` | `False` | Master toggle — set to `true` to enable the service |
| `WASSENDER_API_URL` | `https://www.wasenderapi.com` | Base URL for WaSenderAPI |
| `WASSENDER_API_KEY` | `""` | Bearer token for WaSenderAPI authentication |
| `WASSENDER_DEVICE_ID` | `""` | The specific WhatsApp device/session to use |
| `WASSENDER_WEBHOOK_SECRET` | `""` | Secret token used by WaSenderAPI to sign webhook payloads |

```bash
# Example .env entry
WASSENDER_ENABLED=true
WASSENDER_API_KEY=your_api_key_here
WASSENDER_DEVICE_ID=your_device_id
WASSENDER_WEBHOOK_SECRET=your_webhook_secret
```

When `WASSENDER_ENABLED=False`, all outbound send operations are skipped silently and return `{"success": false, "status": "disabled"}`.

---

## Database Tables

Two Supabase tables support the WhatsApp service:

### 1. `whatsapp_messages` — Message Audit Log

Every inbound and outbound message is stored here. Created in `supabase_schema_v2.sql`.

```sql
CREATE TABLE whatsapp_messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone           TEXT NOT NULL,            -- E.164 format, e.g. +212612345678
    message         TEXT NOT NULL,
    direction       TEXT NOT NULL DEFAULT 'outbound',  -- 'inbound' or 'outbound'
    status          TEXT DEFAULT 'sent',       -- 'sent', 'received', 'failed', 'simulated'
    external_id     TEXT,                     -- WaSenderAPI's msgId for sent messages
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Indexes:
- `idx_wa_phone` on `phone` — fast lookup by phone number
- `idx_wa_created` on `created_at DESC` — reverse-chronological listing

### 2. `whatsapp_ai_sessions` — Per-Phone AI Session State

Tracks the conversation state for each unique WhatsApp phone number. Created via migration `add_whatsapp_ai_sessions.sql`.

```sql
CREATE TABLE whatsapp_ai_sessions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    phone           text NOT NULL UNIQUE,
    state           text NOT NULL DEFAULT 'awaiting_farm_name',
        -- 'awaiting_farm_name' | 'connected'
    farm_id         uuid REFERENCES farms(id) ON DELETE SET NULL,
    conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);
```

Index:
- `idx_whatsapp_ai_sessions_phone` on `phone` — fast O(1) lookup

**State Machine:**

```
  [New user sends message]
         │
         ▼
  ┌─────────────────────┐
  │ awaiting_farm_name   │◄──────────────────────────┐
  └──────────┬──────────┘                           │
             │ user replies with farm name           │ user says "تغيير المزرعة"
             ▼                                      │
  ┌─────────────────────┐                           │
  │ connected           │───────────────────────────┘
  │ (farm + conversation_id set)
  └─────────────────────┘
```

---

## API Endpoints

All endpoints are under `/api/whatsapp`. All require JWT authentication (`get_current_user` dependency) except the webhook.

### `POST /api/whatsapp/send`

Send a freeform text message to any phone number.

**Request:**
```json
{
  "phone": "+212612345678",
  "message": "Hello from SoussFlow!"
}
```

**Response:**
```json
{
  "success": true,
  "message_id": "msg_abc123",
  "status": "sent"
}
```

### `GET /api/whatsapp/messages`

Retrieve paginated message history from the `whatsapp_messages` log.

| Query Param | Type | Default | Description |
|---|---|---|---|
| `page` | int | 1 | Page number |
| `page_size` | int | 50 | Items per page (max 100) |
| `phone` | string | null | Filter by phone number |

### `GET /api/whatsapp/status`

Query WaSenderAPI for the current device connection status (online/offline/disconnected).

### `POST /api/whatsapp/alert`

Send an automated alert formatted with the appropriate emoji and data.

**Request:**
```json
{
  "phone": "+212612345678",
  "alert_type": "soil_moisture_low",
  "sensor_id": "SM-Z1-001",
  "value": 22.5,
  "threshold": 30.0
}
```

Supported `alert_type` values:
- `high_temperature` 🌡️🔴
- `low_humidity` 💧🔴
- `soil_moisture_low` 🌱🔴
- `ph_anomaly` ⚗️🟡
- `prediction_warning` 📊⚠️
- `device_offline` 📡❌

### `POST /api/whatsapp/webhook`

WaSenderAPI calls this endpoint when a WhatsApp message is received. **No auth required** (validated by webhook signature header instead).

Flow:
1. Validate `x-webhook-signature` header matches `WASSENDER_WEBHOOK_SECRET`
2. Parse `payload.data.messages` from WaSenderAPI format
3. Extract `sender_phone` and `messageBody`
4. Skip messages sent *by* the bot (`fromMe: true`)
5. Normalize phone to E.164 format (`+XXXXXXXXX`)
6. Delegate to `service.handle_incoming_message(sender_phone, message_body)`
7. Return `{"status": "ok"}` immediately (must not await long-running tasks on Vercel)

### `POST /api/whatsapp/test/simulate`

**Development/testing only.** Simulates an incoming message and runs the full AI flow without needing WaSenderAPI. Monkey-patches `send_message` to capture replies instead of actually sending them.

Used for testing the AI assistant during development when WhatsApp is not configured.

---

## AI Assistant Flow

The AI assistant is the core UX feature. It lives in `WhatsAppService.handle_incoming_message()`.

### First-Time User Flow

```
User → "Hello"
  │
  ├─ No session found → create session (state = awaiting_farm_name)
  │
  └─ Bot responds:
     "🌿 مرحبا بك في SoussFlow!
      أنا مساعدك الذكي لإدارة الري.
      من فضلك، أخبرني باسم مزرعتك للبدء.

      🇫🇷 Bienvenue sur SoussFlow! Quel est le nom de votre ferme?"
```

### Farm Connection Flow

```
User → "Ferme Atlas"
  │
  ├─ Farm lookup (case-insensitive ILIKE on farms.name)
  │    ├─ 0 results → "❌ لم أجد مزرعة..."
  │    ├─ 1 result  → proceed
  │    └─ 2+ results → "🔍 وجدت عدة مزارع: ..." (ask user to pick exact name)
  │
  ├─ Create conversation: { user_id: farm_owner, farm_id, title: "WhatsApp - +212..." }
  ├─ Update session state → "connected"
  │
  └─ Bot responds:
     "✅ تم الاتصال بمزرعة Ferme Atlas!
      يمكنك الآن سؤالي عن:
      • 💧 حالة الري والتربة
      • 🌡️ الطقس والمناخ
      • 📊 بيانات المستشعرات
      • 🌿 نصائح زراعة الزيتون

      أرسل \"تغيير المزرعة\" للتبديل."
```

### Connected User Flow

When a connected user sends a message, it passes through `handle_incoming_message()` → `_handle_ai_chat()`. The routing order is:

```
1. Farm switch command  → "تغيير المزرعة" / "switch farm"
2. Help menu           → "help" / "مساعدة"
3. Pending irrigation  → user previously said "turn on irrigation", now answering YES/NO
4. Irrigation ON       → "turn on irrigation" / "شغل الري" (asks confirmation first)
5. Irrigation OFF      → "turn off irrigation" / "أوقف الري" (asks confirmation first)
6. Soil moisture       → "soil moisture" / "رطوبة التربة" (fast path, no OpenAI)
7. Chart request       → "رسم بياني" / "chart" (generates QuickChart.io image)
8. Everything else      → OpenAI chat() with full farm context
```

### Keyword Sets

All keyword matching is **case-insensitive** and supports **Arabic, Darija, French, and English**.

| Category | Keywords |
|---|---|
| **Irrigation ON** | `turn on irrigation`, `start irrigation`, `شغل الري`, `ابدأ الري`, `activer irrigation`, ... |
| **Irrigation OFF** | `turn off irrigation`, `stop irrigation`, `أوقف الري`, `اقفل الري`, `désactiver irrigation`, ... |
| **Soil Moisture** | `soil moisture`, `check moisture`, `رطوبة التربة`, `حالة التربة`, `humidité du sol`, ... |
| **Help** | `help`, `menu`, `مساعدة`, `aide`, `قائمة`, ... |
| **Farm Switch** | `تغيير المزرعة`, `changer ferme`, `switch farm` |
| **Chart** | `رسم بياني`, `chart`, `graph`, `graphique`, `diagramme` |

### Irrigation Safety — Two-Step Confirmation

**Critical design decision:** Irrigation commands are **never executed directly**. The bot always asks for confirmation first.

```
User: "Turn on irrigation"
Bot:  "🔔 Are you sure you want to turn on the irrigation?"

User: "yes"  → _pending_confirmations["+212..."] deleted → _execute_irrigation_command("start")
User: "no"   → _pending_confirmations["+212..."] deleted → "✅ Okay, no changes were made."
```

The pending confirmation is stored in a **module-level dict** (`_pending_confirmations: Dict[str, str]`). This is ephemeral — if the user says something else first, the pending action is cancelled.

After confirmation, `_execute_irrigation_command()` iterates **all active zones** for the farm and calls `device_control_service.control_zone()` for each one with the action (`start` or `stop`).

### Soil Moisture Fast Path

Rather than spinning up an OpenAI round-trip, soil moisture requests hit the database directly:

1. Fetch all active zones for the farm
2. Query `zone_health_readings` for the last 3 hours
3. Return the latest moisture reading per zone with a status emoji:
   - `< 30%` → ⚠️ _Low — needs irrigation_
   - `> 60%` → 💧 _High_
   - `30–60%` → ✅ _Good_
   - No data → _No recent data_

### Chart Generation

Triggered by explicit chart keywords. Flow:

```
1. Call openai_service.generate_chart_config(farm_id, conversation_id)
   → returns a chart config dict (e.g. { type: 'line', data: {...} })
2. Serialize to JSON, build QuickChart.io URL:
   https://quickchart.io/chart?c={config_json}&w=600&h=400&bkg=white
3. Send as image via _send_image() → WaSenderAPI
```

The `_is_chart_request()` method uses a set intersection on word tokens, so "yes" and "ok" are **not** matched as chart requests (a past bug where affirmatives triggered chart generation was fixed).

### OpenAI Integration

For everything else, the message is sent to `openai_service.chat()` with:
- `farm_id` — so the AI knows which farm context to load
- `conversation_id` — for conversation memory/history
- `user_message` — the raw text from WhatsApp
- `channel="whatsapp"` — so the AI knows to respond in a WhatsApp-friendly style
- `user_context` — `{id, role}` of the farm owner

The AI response is then passed through `_convert_to_whatsapp_format()` before sending:

| Markdown | WhatsApp |
|---|---|
| `**bold**` | `*bold*` |
| `# Heading` | `*Heading*` (bold) |
| `**bold**` | `*bold*` |
| `` `code` `` | plain text |
| `[text](url)` | `text` |
| `> quote` | plain text |
| Tables | `col1 \| col2 \| col3` rows |
| SVG/HTML | stripped entirely |

Messages longer than **4096 chars** are truncated to 3990 + `"..."`.

---

## Anomaly Alert Integration

The `anomaly_service.py` has a `_auto_alert()` function that is called when critical sensor anomalies are detected. It sends WhatsApp alerts to:

1. **Farm owner** (from `farms.owner_id`)
2. **Farm employees** with phone numbers (from `farm_memberships` + `users.phone`)
3. **Any WhatsApp user connected to this farm** (from `whatsapp_ai_sessions` where `state='connected'`)

The alert is capped at **3 per cycle** to avoid spamming.

```python
# Inside anomaly_service.py
async def _auto_alert(farm_id: str, critical_anomalies: list):
    phones = await _get_farm_user_phones(farm_id)
    for anomaly in critical_anomalies[:3]:
        msg = f"⚠️ *{severity} Anomaly*\n\nType: {anomaly_type}\n..."
        for phone in phones:
            await ws.send_message(phone, msg)
```

---

## WaSenderAPI Integration

The service wraps the **WaSenderAPI** (https://wasenderapi.com/api-docs) REST API.

### Sending Messages

```
POST {WASSENDER_API_URL}/api/send-message
Authorization: Bearer {WASSENDER_API_KEY}
Content-Type: application/json

{
  "to": "+212612345678",
  "text": "Hello from SoussFlow!"
}
```

### Sending Images

```
POST {WASSENDER_API_URL}/api/send-message
Authorization: Bearer {WASSENDER_API_KEY}
Content-Type: application/json

{
  "to": "+212612345678",
  "imageUrl": "https://quickchart.io/chart?c=...",
  "text": "📊 SoussFlow Chart"
}
```

### Checking Device Status

```
GET {WASSENDER_API_URL}/api/whatsapp-sessions/{WASSENDER_DEVICE_ID}
Authorization: Bearer {WASSENDER_API_KEY}
```

---

## Webhook Security

The webhook is protected by a **signature check**:

```python
signature = request.headers.get("x-webhook-signature", "")
if signature != settings.WASSENDER_WEBHOOK_SECRET:
    raise HTTPException(status_code=401, detail="Invalid webhook signature")
```

WaSenderAPI sends this header with every webhook call. If the secret is empty (not configured), the check is skipped — useful for local development.

---

## Singleton Pattern

`WhatsAppService` uses a **module-level singleton** to avoid re-reading environment variables and re-creating HTTP clients on every request:

```python
_whatsapp_service: Optional[WhatsAppService] = None

def get_whatsapp_service() -> WhatsAppService:
    global _whatsapp_service
    if _whatsapp_service is None:
        _whatsapp_service = WhatsAppService()
    return _whatsapp_service
```

---

## Error Handling

Every method that sends or processes a message has comprehensive try/except with logging:

```python
except httpx.HTTPStatusError as e:
    logger.error(f"[WA SEND] HTTP ERROR: {e.response.status_code} - {e.response.text}")
    return {"success": False, "status": "failed", "detail": f"API error: {e.response.status_code}"}
except Exception as e:
    logger.error(f"[WA SEND] EXCEPTION: {type(e).__name__}: {e}")
    return {"success": False, "status": "error", "detail": str(e)}
```

Failed outbound sends are logged to `whatsapp_messages` with `status="failed"` so the audit log is complete even for errors.

---

## Testing

The `/api/whatsapp/test/simulate` endpoint allows full AI flow testing without WaSenderAPI:

1. Accepts a `{phone, message}` body
2. Monkey-patches `service.send_message` to capture replies instead of sending
3. Calls `handle_incoming_message()` with the full flow
4. Returns captured replies + recent message log from Supabase

This enables CI testing and manual debugging without a live WhatsApp device.

---

## Message Flow Summary

```
WhatsApp User
     │
     ▼
POST /api/whatsapp/webhook  (WaSenderAPI calls this)
     │
     ▼
handle_incoming_message()
     │
     ├── Log inbound message
     │
     ├── _get_ai_session(phone)
     │     │
     │     ├── No session → _create_ai_session() → send "welcome + ask farm name"
     │     │
     │     ├── state = awaiting_farm_name → _handle_farm_lookup()
     │     │     │
     │     │     └── Farm found → create conversation, update state = connected
     │     │
     │     └── state = connected → _handle_ai_chat()
     │           │
     │           ├── farm switch → reset to awaiting_farm_name
     │           ├── help → send HELP_MENU
     │           ├── pending confirmation → execute/cancel irrigation
     │           ├── irrigation ON/OFF → add to pending, ask confirmation
     │           ├── soil moisture → _handle_soil_moisture_check()
     │           ├── chart request → _handle_chart_request()
     │           └── anything else → openai_service.chat() → _convert_to_whatsapp_format() → send
     │
     └── send reply via WaSenderAPI POST /api/send-message
             │
             └── Log outbound message
```

---

## Help Menu (Multilingual)

```text
📱 SoussFlow - قائمة الأوامر

💧 التحكم في الري:
• "Turn on irrigation" / "شغل الري"
• "Turn off irrigation" / "أوقف الري"

🌱 حالة المزرعة:
• "Check soil moisture" / "رطوبة التربة"
• Ask about weather, zones, sensors...

📊 بيانات ونصائح:
• Ask any question about your farm
• Get olive cultivation advice
• Ask for a chart / رسم بياني

🔄 "تغيير المزرعة" - Switch farm
📋 "help" - Show this menu

_You can talk in Arabic, Darija, French, or English._
```
