"""
WhatsApp integration service via WaSenderAPI
https://wasenderapi.com/api-docs
"""
import hashlib
import httpx
import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any

from app.config import get_settings
from app.supabase_client import get_supabase_admin
from app.logging_config import logger, debug

# ─── WhatsApp Command Constants ──────────────────────────────────

HELP_MENU = (
    "📱 *SoussFlow — قائمة الأوامر*\n\n"
    "💧 *التحكم في الري:*\n"
    '• "شغل الري" / "turn on irrigation"\n'
    '• "أوقف الري" / "turn off irrigation"\n\n'
    "🌱 *حالة المزرعة والمستشعرات:*\n"
    '• "حالة المزرعة" / "farm status" — ملخص شامل\n'
    '• "رطوبة التربة" / "soil moisture" — رطوبة كل منطقة\n'
    '• "الطقس" / "weather" — حرارة، رياح، أمطار\n'
    '• "الخزان" / "reservoir" — مستوى الماء والفلتر\n'
    '• "شنو طرا؟" — آش وقع بالمزرعة\n\n'
    "📊 *أسئلة وتحليل:*\n"
    "• سولني على المناطق، المستشعرات، التوقعات...\n"
    "• نصائح زراعة الزيتون\n"
    '• طلب رسم بياني: "رسم" / "chart"\n\n'
    '🔄 *تغيير المزرعة:* "تغيير المزرعة"\n'
    '📋 *هاد القائمة:* "help" أو "مساعدة"\n\n'
    "_تقدر تكلمني بالدارجة، العربية، الفرنسية، أو الإنجليزية._"
)

_IRRIGATION_ON_KEYWORDS = {
    "turn on irrigation", "start irrigation", "open irrigation",
    "ابدأ الري", "شغل الري", "افتح الري", "بدا الري", "بدأ الري",
    "sقل الري", "دير الري", "حول الري",
    "activer irrigation", "démarrer irrigation", "ouvrir irrigation",
    "irrigate", "water the farm", "water farm",
}

_IRRIGATION_OFF_KEYWORDS = {
    "turn off irrigation", "stop irrigation", "close irrigation",
    "أوقف الري", "اوقف الري", "اقفل الري", "أغلق الري", "اغلق الري",
    "وقف الري", "قف الري", "سد الري",
    "désactiver irrigation", "arrêter irrigation", "fermer irrigation",
    "stop watering",
}

_SOIL_MOISTURE_KEYWORDS = {
    "soil moisture", "check moisture", "moisture level", "check soil",
    "رطوبة التربة", "حالة التربة",
    "humidité du sol", "vérifier humidité",
}

_HELP_KEYWORDS = {
    "help", "menu", "what can you do", "مساعدة", "مساعده",
    "aide", "commands", "options", "قائمة", "ماذا تستطيع",
    "واش تقدر", "علاش",
}

_FARM_SWITCH_KEYWORDS = {
    "تغيير المزرعة", "changer ferme", "switch farm", "تغيير",
}

_CHART_KEYWORDS = {
    "رسم", "رسم بياني", "بياني", "chart", "graph", "plot",
    "graphique", "diagramme",
}

_FARM_STATUS_KEYWORDS = {
    "حالة المزرعة", "حالة الري", "zone status", "farm status",
    "état ferme", "état irrigation", "شنو طرا", "واش كولشي مزيان",
    "شنو واقع", "status", "حالة",
}

_WEATHER_KEYWORDS = {
    "الطقس", "حرارة", "رياح", "درجة الحرارة", "weather", "temperature",
    "météo", "température", "wind", "vent", "rain", "مطر", "pluie",
    "شحال الحرارة", "واش غادي يصب الشتا",
}

_RESERVOIR_KEYWORDS = {
    "الخزان", "المضخة", "الفلتر", "reservoir", "pump", "filter",
    "réservoir", "pompe", "filtre", "ضغط الماء", "حالة الخزان",
    "water level", "niveau eau", "شحال فالخزان",
}

_CONFIRM_YES = {
    "yes", "oui", "نعم", "أيوا", "اه", "ya", "yeah", "yep", "ok",
    "d'accord", "sure", "confirm", "aywa", "ايوا", "ايه", "واخا", "wakha",
    "نعم نعم", "أكد", "اكد",
}
_CONFIRM_NO = {
    "no", "non", "لا", "nope", "cancel", "إلغاء", "annuler", "لا شكرا",
    "لا لا", "ماشي", "machi", "لأ", "la",
}

# Confirmation timeout — pending actions expire after this duration
_CONFIRMATION_TTL = timedelta(minutes=5)

# ─── Per-phone rate limiting (in-memory, resets on restart) ──────
_RATE_LIMIT_MAX = 20  # max messages per window
_RATE_LIMIT_WINDOW = 60  # seconds
_rate_limit_log: Dict[str, List[float]] = defaultdict(list)


def _is_rate_limited(phone: str) -> bool:
    """Check if a phone number has exceeded the rate limit."""
    now = datetime.now(timezone.utc).timestamp()
    cutoff = now - _RATE_LIMIT_WINDOW
    _rate_limit_log[phone] = [t for t in _rate_limit_log[phone] if t > cutoff]
    if len(_rate_limit_log[phone]) >= _RATE_LIMIT_MAX:
        return True
    _rate_limit_log[phone].append(now)
    return False


class WhatsAppService:
    """Service for sending and receiving WhatsApp messages via WaSenderAPI"""

    def __init__(self):
        settings = get_settings()
        self.enabled = settings.WASSENDER_ENABLED
        self.api_url = settings.WASSENDER_API_URL if self.enabled else None
        self.api_key = settings.WASSENDER_API_KEY if self.enabled else None
        self.device_id = settings.WASSENDER_DEVICE_ID if self.enabled else None
        self.webhook_secret = settings.WASSENDER_WEBHOOK_SECRET if self.enabled else None
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}" if self.api_key else "",
        }
        logger.info(f"[WhatsApp Init] enabled={self.enabled}, api_url={self.api_url}, device_id={self.device_id}, api_key_set={bool(self.api_key)}")

        # Warn if webhook secret is empty (endpoint is wide open)
        if self.enabled and not self.webhook_secret:
            logger.warning(
                "[WhatsApp Init] WASSENDER_WEBHOOK_SECRET is empty — "
                "webhook endpoint is unauthenticated. Set this in production!"
            )

    # ─── Intent Router ────────────────────────────────────────────
    # Each handler returns True if it handled the message, False to pass.
    # Checked in priority order — first match wins.

    async def _intent_farm_switch(self, phone: str, msg_lower: str, session: dict) -> bool:
        if msg_lower not in _FARM_SWITCH_KEYWORDS:
            return False
        await self._update_ai_session(session["id"], state="awaiting_farm_name", farm_id=None, conversation_id=None)
        await self.send_message(
            phone,
            "🔄 *تغيير المزرعة*\n\nأرسل اسم المزرعة الجديدة.\n_Envoyez le nom de la nouvelle ferme._"
        )
        return True

    async def _intent_help(self, phone: str, msg_lower: str, session: dict) -> bool:
        if msg_lower not in _HELP_KEYWORDS:
            return False
        await self.send_message(phone, HELP_MENU)
        return True

    async def _intent_pending_confirmation(self, phone: str, msg_lower: str, session: dict) -> bool:
        """Handle pending irrigation confirmation from DB."""
        pending_action = session.get("pending_action")
        pending_expires = session.get("pending_expires_at")
        if not pending_action:
            return False

        # Check expiry
        expired = False
        if pending_expires:
            try:
                expires_dt = datetime.fromisoformat(pending_expires.replace("Z", "+00:00"))
                if datetime.now(timezone.utc) > expires_dt:
                    expired = True
            except (ValueError, TypeError):
                expired = True

        # Always clear pending state
        await self._clear_pending_action(session["id"])

        if expired:
            await self.send_message(phone, "⏰ انتهت صلاحية التأكيد. عاود من الأول.\n_La confirmation a expiré._")
            return True

        if msg_lower in _CONFIRM_YES:
            await self._execute_irrigation_command(phone, pending_action, session)
        elif msg_lower in _CONFIRM_NO:
            await self.send_message(phone, "✅ واخا، ما دير والو.\n_Aucune modification effectuée._")
        else:
            # Not a clear yes/no — re-ask and re-set the pending action
            action_label = "تشغيل" if pending_action == "start" else "إيقاف"
            await self._set_pending_action(session["id"], pending_action)
            await self.send_message(
                phone,
                f"⚠️ من فضلك أكد: هل تريد *{action_label}* الري؟\n"
                "• أرسل *نعم* / *واخا* للتأكيد\n"
                "• أرسل *لا* / *ماشي* للإلغاء"
            )
        return True

    async def _intent_irrigation_on(self, phone: str, msg_lower: str, session: dict) -> bool:
        if not any(k in msg_lower for k in _IRRIGATION_ON_KEYWORDS):
            return False
        await self._set_pending_action(session["id"], "start")
        await self.send_message(
            phone,
            "💧 *تأكيد تشغيل الري*\n\n"
            "واش بغيت تشغل الري فجميع المناطق؟\n\n"
            "• أرسل *نعم* / *واخا* للتأكيد\n"
            "• أرسل *لا* / *ماشي* للإلغاء"
        )
        return True

    async def _intent_irrigation_off(self, phone: str, msg_lower: str, session: dict) -> bool:
        if not any(k in msg_lower for k in _IRRIGATION_OFF_KEYWORDS):
            return False
        await self._set_pending_action(session["id"], "stop")
        await self.send_message(
            phone,
            "🛑 *تأكيد إيقاف الري*\n\n"
            "واش بغيت توقف الري فجميع المناطق؟\n\n"
            "• أرسل *نعم* / *واخا* للتأكيد\n"
            "• أرسل *لا* / *ماشي* للإلغاء"
        )
        return True

    async def _intent_soil_moisture(self, phone: str, msg_lower: str, session: dict) -> bool:
        if not any(k in msg_lower for k in _SOIL_MOISTURE_KEYWORDS):
            return False
        await self._handle_soil_moisture_check(phone, session)
        return True

    async def _intent_farm_status(self, phone: str, msg_lower: str, session: dict) -> bool:
        if not any(k in msg_lower for k in _FARM_STATUS_KEYWORDS):
            return False
        await self._handle_farm_status_check(phone, session)
        return True

    async def _intent_weather(self, phone: str, msg_lower: str, session: dict) -> bool:
        if not any(k in msg_lower for k in _WEATHER_KEYWORDS):
            return False
        await self._handle_weather_check(phone, session)
        return True

    async def _intent_reservoir(self, phone: str, msg_lower: str, session: dict) -> bool:
        if not any(k in msg_lower for k in _RESERVOIR_KEYWORDS):
            return False
        await self._handle_reservoir_check(phone, session)
        return True

    async def _intent_chart(self, phone: str, msg_lower: str, session: dict) -> bool:
        words = set(msg_lower.split())
        if not (words & _CHART_KEYWORDS):
            return False
        farm_id = session["farm_id"]
        conversation_id = session["conversation_id"]
        await self._handle_chart_request(phone, farm_id, conversation_id)
        return True

    async def _intent_ai_chat(self, phone: str, msg_lower: str, session: dict) -> bool:
        """Fallback: route to OpenAI. Always returns True."""
        await self._handle_openai_chat(phone, msg_lower, session)
        return True

    # Ordered intent handlers — first match wins
    def _get_intent_handlers(self):
        return [
            self._intent_farm_switch,
            self._intent_help,
            self._intent_pending_confirmation,
            self._intent_irrigation_on,
            self._intent_irrigation_off,
            self._intent_soil_moisture,
            self._intent_farm_status,
            self._intent_weather,
            self._intent_reservoir,
            self._intent_chart,
            self._intent_ai_chat,  # fallback — always matches
        ]

    # ─── Sending Messages ─────────────────────────────────────────

    async def send_message(self, phone: str, message: str) -> Dict[str, Any]:
        """Send a text message via WhatsApp using WaSenderAPI"""
        logger.info(f"[WA SEND] Attempting to send to {phone}, enabled={self.enabled}, api_url={self.api_url}, msg_len={len(message)}")
        if not self.enabled:
            logger.warning(f"[WA SEND] DISABLED — not sending to {phone}")
            return {
                "success": False,
                "status": "disabled",
                "detail": "WhatsApp integration is disabled",
            }

        payload = {
            "to": phone,
            "text": message,
        }

        url = f"{self.api_url}/api/send-message"
        logger.info(f"[WA SEND] POST {url} | to={phone}")

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    url,
                    json=payload,
                    headers=self.headers,
                    timeout=30.0,
                )
                logger.info(f"[WA SEND] Response: status={response.status_code}, body={response.text[:500]}")
                response.raise_for_status()
                result = response.json()

                # Log to Supabase
                msg_id = None
                if isinstance(result, dict):
                    data = result.get("data", {})
                    msg_id = str(data.get("msgId", "")) if isinstance(data, dict) else None

                await self._log_message(
                    phone=phone,
                    message=message,
                    direction="outbound",
                    status="sent",
                    external_id=msg_id,
                )

                logger.info(f"[WA SEND] SUCCESS to {phone}, msg_id={msg_id}")
                return {
                    "success": True,
                    "message_id": msg_id,
                    "status": "sent",
                }
            except httpx.HTTPStatusError as e:
                logger.error(f"[WA SEND] HTTP ERROR: {e.response.status_code} - {e.response.text}")
                return {
                    "success": False,
                    "status": "failed",
                    "detail": f"API error: {e.response.status_code}",
                }
            except Exception as e:
                logger.error(f"[WA SEND] EXCEPTION: {type(e).__name__}: {e}")
                return {
                    "success": False,
                    "status": "error",
                    "detail": str(e),
                }

    async def _send_multi_message(self, phone: str, text: str) -> None:
        """Split long messages at paragraph boundaries instead of hard truncation."""
        max_len = 4000

        if len(text) <= max_len:
            await self.send_message(phone, text)
            return

        paragraphs = text.split("\n\n")
        chunks: List[str] = []
        current = ""

        for para in paragraphs:
            candidate = f"{current}\n\n{para}" if current else para
            if len(candidate) <= max_len:
                current = candidate
            else:
                if current:
                    chunks.append(current)
                if len(para) > max_len:
                    lines = para.split("\n")
                    current = ""
                    for line in lines:
                        line_candidate = f"{current}\n{line}" if current else line
                        if len(line_candidate) <= max_len:
                            current = line_candidate
                        else:
                            if current:
                                chunks.append(current)
                            current = line[:max_len]
                else:
                    current = para

        if current:
            chunks.append(current)

        for chunk in chunks:
            await self.send_message(phone, chunk)

    async def get_messages(
        self,
        page: int = 1,
        page_size: int = 50,
        phone: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get WhatsApp messages from Supabase log"""
        supabase = get_supabase_admin()

        query = supabase.table("whatsapp_messages").select("*", count="exact")

        if phone:
            query = query.eq("phone", phone)

        query = query.order("created_at", desc=True)
        query = query.range((page - 1) * page_size, page * page_size - 1)

        result = query.execute()

        return {
            "messages": result.data,
            "total": result.count or 0,
            "page": page,
            "page_size": page_size,
        }

    async def get_device_status(self) -> Dict[str, Any]:
        """Check WhatsApp device connection status via WaSenderAPI"""
        if not self.enabled:
            return {"status": "disabled", "detail": "WhatsApp integration is disabled"}

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.api_url}/api/whatsapp-sessions/{self.device_id}",
                    headers=self.headers,
                    timeout=15.0,
                )
                response.raise_for_status()
                return response.json()
            except Exception as e:
                logger.error(f"Device status check failed: {e}")
                return {"status": "error", "detail": str(e)}

    # ─── Alerts (with deduplication) ──────────────────────────────

    async def send_alert(
        self,
        phone: str,
        alert_type: str,
        sensor_id: Optional[str] = None,
        value: Optional[float] = None,
        threshold: Optional[float] = None,
        custom_message: Optional[str] = None,
        cooldown_minutes: int = 30,
    ) -> Dict[str, Any]:
        """Send an automated alert via WhatsApp with deduplication."""
        alert_hash = hashlib.md5(f"{alert_type}:{sensor_id or ''}".encode()).hexdigest()
        if await self._is_alert_on_cooldown(phone, alert_hash):
            logger.info(f"[WA ALERT] Skipping duplicate alert {alert_type} for {phone} (on cooldown)")
            return {"success": False, "status": "cooldown", "detail": "Alert on cooldown"}

        if custom_message:
            message = custom_message
        else:
            message = self._build_alert_message(alert_type, sensor_id, value, threshold)

        result = await self.send_message(phone, message)

        if result.get("success"):
            await self._record_alert_cooldown(phone, alert_hash, cooldown_minutes)

        return result

    async def _is_alert_on_cooldown(self, phone: str, alert_hash: str) -> bool:
        """Check if an alert is still within its cooldown window."""
        try:
            supabase = get_supabase_admin()
            now = datetime.now(timezone.utc).isoformat()
            result = (
                supabase.table("whatsapp_alert_log")
                .select("id")
                .eq("phone", phone)
                .eq("alert_hash", alert_hash)
                .gt("cooldown_until", now)
                .limit(1)
                .execute()
            )
            return bool(result.data)
        except Exception as e:
            logger.error(f"[WA ALERT] Cooldown check failed: {e}")
            return False  # Fail open — send the alert

    async def _record_alert_cooldown(self, phone: str, alert_hash: str, cooldown_minutes: int) -> None:
        """Record an alert send with cooldown expiry."""
        try:
            supabase = get_supabase_admin()
            cooldown_until = (datetime.now(timezone.utc) + timedelta(minutes=cooldown_minutes)).isoformat()
            supabase.table("whatsapp_alert_log").insert({
                "phone": phone,
                "alert_hash": alert_hash,
                "cooldown_until": cooldown_until,
            }).execute()
        except Exception as e:
            logger.error(f"[WA ALERT] Failed to record cooldown: {e}")

    def _build_alert_message(
        self,
        alert_type: str,
        sensor_id: Optional[str],
        value: Optional[float],
        threshold: Optional[float],
    ) -> str:
        """Build a formatted alert message"""
        emoji_map = {
            "high_temperature": "🌡️🔴",
            "low_humidity": "💧🔴",
            "soil_moisture_low": "🌱🔴",
            "ph_anomaly": "⚗️🟡",
            "prediction_warning": "📊⚠️",
            "device_offline": "📡❌",
        }
        emoji = emoji_map.get(alert_type, "⚠️")

        lines = [
            f"{emoji} *SoussFlow Alert*",
            f"Type: {alert_type.replace('_', ' ').title()}",
        ]
        if sensor_id:
            lines.append(f"Sensor: {sensor_id}")
        if value is not None:
            lines.append(f"Current Value: {value}")
        if threshold is not None:
            lines.append(f"Threshold: {threshold}")
        lines.append(f"Time: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")

        return "\n".join(lines)

    # ─── WhatsApp Formatting ─────────────────────────────────────

    @staticmethod
    def _convert_to_whatsapp_format(text: str) -> str:
        """Convert markdown to WhatsApp-compatible formatting"""
        # Remove SVG blocks
        text = re.sub(r'<svg[\s\S]*?</svg>', '', text)
        # Remove any remaining HTML tags
        text = re.sub(r'<[^>]+>', '', text)

        # Convert **bold** to *bold* (WhatsApp uses single asterisks)
        text = re.sub(r'\*\*(.+?)\*\*', r'*\1*', text)

        # Convert ### heading to bold with emoji line
        text = re.sub(r'^###\s*(.+)$', r'*\1*', text, flags=re.MULTILINE)
        text = re.sub(r'^##\s*(.+)$', r'*\1*', text, flags=re.MULTILINE)
        text = re.sub(r'^#\s*(.+)$', r'*\1*', text, flags=re.MULTILINE)

        # Convert `code` to plain text (no backtick support for inline in WhatsApp)
        text = re.sub(r'`([^`\n]+)`', r'\1', text)

        # Convert markdown links [text](url) to just text
        text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)

        # Convert blockquotes > text to plain text
        text = re.sub(r'^>\s*', '', text, flags=re.MULTILINE)

        # Convert markdown tables to simple lines
        text = re.sub(r'^\|[-: |]+\|$', '', text, flags=re.MULTILINE)
        def _convert_table_row(m):
            cells = [c.strip() for c in m.group(0).strip('|').split('|')]
            return ' | '.join(cells)
        text = re.sub(r'^\|(.+)\|$', _convert_table_row, text, flags=re.MULTILINE)

        # Clean up multiple blank lines
        text = re.sub(r'\n{3,}', '\n\n', text)

        return text.strip()

    # ─── AI WhatsApp Assistant ───────────────────────────────────

    async def handle_incoming_message(self, sender_phone: str, message_body: str) -> None:
        """
        Handle an incoming WhatsApp message with AI assistant flow:
        1. Rate limit check
        2. If no session exists -> ask for farm name
        3. If awaiting farm name -> look up farm, connect
        4. If connected -> route through intent handlers
        5. If disconnected (zombie session) -> re-onboard
        """
        try:
            logger.info(f"[WA AI] >>> Incoming from {sender_phone}: {message_body[:100]}")

            # Rate limiting
            if _is_rate_limited(sender_phone):
                logger.warning(f"[WA AI] Rate limited: {sender_phone}")
                await self.send_message(
                    sender_phone,
                    "⚠️ بزاف ديال الرسائل. تسنا شوية.\n_Trop de messages. Patientez._"
                )
                return

            # Log inbound message
            await self._log_message(
                phone=sender_phone,
                message=message_body,
                direction="inbound",
                status="received",
            )

            # Get or create AI session for this phone
            session = await self._get_ai_session(sender_phone)
            logger.info(f"[WA AI] Session for {sender_phone}: {session}")

            if session is None:
                # New user — create session, ask for farm name
                await self._create_ai_session(sender_phone)
                await self.send_message(
                    sender_phone,
                    "🌿 *مرحبا بك في SoussFlow!*\n\n"
                    "أنا مساعدك الذكي لإدارة الري.\n"
                    "من فضلك، أخبرني باسم مزرعتك للبدء.\n\n"
                    "🇫🇷 _Bienvenue sur SoussFlow! Quel est le nom de votre ferme?_"
                )
                return

            # Detect zombie "connected" sessions with null farm_id
            if session["state"] == "connected" and not session.get("farm_id"):
                logger.warning(f"[WA AI] Zombie session for {sender_phone}: connected but farm_id is NULL")
                await self._update_ai_session(session["id"], state="disconnected", farm_id=None, conversation_id=None)
                session["state"] = "disconnected"

            if session["state"] == "awaiting_farm_name":
                await self._handle_farm_lookup(sender_phone, message_body, session)
            elif session["state"] == "connected":
                await self._handle_ai_chat(sender_phone, message_body, session)
            elif session["state"] == "disconnected":
                # Graceful re-onboarding
                await self._update_ai_session(session["id"], state="awaiting_farm_name", farm_id=None, conversation_id=None)
                await self.send_message(
                    sender_phone,
                    "🔄 المزرعة السابقة لم تعد متاحة. من فضلك، أخبرني باسم مزرعتك.\n"
                    "_Your previous farm is no longer available. Please provide your farm name._"
                )
            else:
                # Unknown state — reset
                await self._update_ai_session(session["id"], state="awaiting_farm_name", farm_id=None, conversation_id=None)
                await self.send_message(
                    sender_phone,
                    "من فضلك، أخبرني باسم مزرعتك.\n_Quel est le nom de votre ferme?_"
                )
        except Exception as e:
            import traceback
            logger.error(f"[WA AI] ERROR from {sender_phone}: {type(e).__name__}: {e}\n{traceback.format_exc()}")
            try:
                await self.send_message(
                    sender_phone,
                    "⚠️ عذراً، حدث خطأ. حاول مرة أخرى.\n_Erreur, réessayez._"
                )
            except Exception:
                pass

    async def _handle_farm_lookup(self, phone: str, farm_name: str, session: dict) -> None:
        """Look up farm by name and connect the user"""
        supabase = get_supabase_admin()
        farm_name_clean = farm_name.strip()

        # Search for farm by name (case-insensitive via ilike)
        result = supabase.table("farms").select("id, name, owner_id").ilike("name", f"%{farm_name_clean}%").execute()
        logger.info(f"[WA AI] Farm lookup for '{farm_name_clean}': found {len(result.data)} results: {result.data}")

        if not result.data:
            await self.send_message(
                phone,
                f"❌ لم أجد مزرعة باسم *\"{farm_name_clean}\"*.\n"
                "حاول مرة أخرى بالاسم الصحيح.\n\n"
                f"_Ferme \"{farm_name_clean}\" introuvable. Réessayez._"
            )
            return

        if len(result.data) > 1:
            farm_list = "\n".join([f"• {f['name']}" for f in result.data[:5]])
            await self.send_message(
                phone,
                f"🔍 وجدت عدة مزارع:\n{farm_list}\n\n"
                "من فضلك أرسل الاسم الدقيق.\n"
                "_Plusieurs fermes trouvées. Envoyez le nom exact._"
            )
            return

        farm = result.data[0]
        farm_id = farm["id"]

        conv_result = supabase.table("conversations").insert({
            "user_id": farm["owner_id"],
            "farm_id": farm_id,
            "title": f"WhatsApp - {phone}",
        }).execute()
        conversation_id = conv_result.data[0]["id"]

        await self._update_ai_session(
            session["id"],
            state="connected",
            farm_id=farm_id,
            conversation_id=conversation_id,
        )

        await self.send_message(
            phone,
            f"✅ تم الاتصال بمزرعة *{farm['name']}*!\n\n"
            "يمكنك الآن سؤالي عن:\n"
            "• 💧 حالة الري والتربة\n"
            "• 🌡️ الطقس والمناخ\n"
            "• 📊 بيانات المستشعرات\n"
            "• 🌿 نصائح زراعة الزيتون\n\n"
            "أرسل *\"تغيير المزرعة\"* للتبديل لمزرعة أخرى.\n\n"
            f"_Connecté à {farm['name']}! Posez vos questions._"
        )

    async def _handle_ai_chat(self, phone: str, message: str, session: dict) -> None:
        """Route message through priority-ordered intent handlers."""
        msg_lower = message.strip().lower()

        for handler in self._get_intent_handlers():
            if await handler(phone, msg_lower, session):
                return

    async def _handle_chart_request(self, phone: str, farm_id: str, conversation_id: str) -> None:
        """Use QuickChart POST endpoint for short URLs instead of query param."""
        try:
            from app.services.openai_service import generate_chart_config
            config = await generate_chart_config(farm_id, conversation_id)

            if not config:
                await self.send_message(phone, "⚠️ لم أتمكن من إنشاء الرسم البياني. حاول مرة أخرى.\n_Impossible de générer le graphique._")
                return

            # POST to QuickChart to get a short URL (avoids URL length limits)
            async with httpx.AsyncClient() as client:
                qc_response = await client.post(
                    "https://quickchart.io/chart/create",
                    json={
                        "chart": config,
                        "width": 600,
                        "height": 400,
                        "backgroundColor": "white",
                    },
                    timeout=15.0,
                )
                qc_response.raise_for_status()
                chart_url = qc_response.json().get("url")

            if not chart_url:
                await self.send_message(phone, "⚠️ خطأ في إنشاء الرسم البياني.\n_Erreur lors de la génération du graphique._")
                return

            logger.info(f"[WA CHART] Sending chart to {phone}, url={chart_url}")
            await self._send_image(phone, chart_url, "📊 SoussFlow Chart")

        except Exception as e:
            logger.error(f"WhatsApp chart error: {e}")
            await self.send_message(phone, "⚠️ خطأ في إنشاء الرسم البياني.\n_Erreur lors de la génération du graphique._")

    async def _handle_openai_chat(self, phone: str, message: str, session: dict) -> None:
        """Route message to OpenAI for full AI conversation."""
        farm_id = session["farm_id"]
        conversation_id = session["conversation_id"]

        try:
            from app.services.openai_service import chat
            user_context = None
            try:
                _supabase = get_supabase_admin()
                _farm = _supabase.table("farms").select("owner_id").eq("id", farm_id).limit(1).execute()
                if _farm.data:
                    _owner = _supabase.table("users").select("id, role").eq("id", _farm.data[0]["owner_id"]).limit(1).execute()
                    if _owner.data:
                        user_context = {"id": _owner.data[0]["id"], "role": _owner.data[0]["role"]}
            except Exception:
                pass

            ai_response = await chat(
                farm_id=farm_id,
                conversation_id=conversation_id,
                user_message=message,
                channel="whatsapp",
                user_context=user_context,
            )

            # Convert any remaining markdown to WhatsApp format
            ai_response = self._convert_to_whatsapp_format(ai_response)

            # Split at paragraph boundaries instead of hard truncation
            await self._send_multi_message(phone, ai_response)

        except Exception as e:
            logger.error(f"WhatsApp AI chat error: {e}")
            await self.send_message(
                phone,
                "⚠️ حدث خطأ، عاود المحاولة.\n_Erreur, réessayez._"
            )

    async def _execute_irrigation_command(self, phone: str, action: str, session: dict) -> None:
        """Execute irrigation start/stop for all active farm zones after user confirmation."""
        farm_id = session.get("farm_id")
        if not farm_id:
            await self.send_message(phone, "⚠️ ما لقيتش المزرعة. عاود الاتصال بالمزرعة.\n_Ferme introuvable. Reconnectez-vous._")
            return

        try:
            from app.services import device_control_service
            supabase = get_supabase_admin()
            zones = supabase.table("zones").select("id, zone_number, name").eq("farm_id", farm_id).eq("is_active", True).order("zone_number").execute()

            if not zones.data:
                await self.send_message(phone, "⚠️ ما كاين تا منطقة نشطة.\n_Aucune zone active trouvée._")
                return

            farm = supabase.table("farms").select("owner_id").eq("id", farm_id).limit(1).execute()
            user_id = farm.data[0]["owner_id"] if farm.data else "whatsapp"

            succeeded = []
            failed = []
            for zone in zones.data:
                try:
                    await device_control_service.control_zone(
                        farm_id, zone["id"], action, user_id, "whatsapp", None
                    )
                    zone_label = zone.get("name") or f"المنطقة {zone['zone_number']}"
                    succeeded.append(zone_label)
                except Exception as e:
                    logger.error(f"[WA AI] Failed to {action} zone {zone['zone_number']}: {e}")
                    failed.append(f"المنطقة {zone['zone_number']}")

            if action == "start":
                action_ar = "تشغيل"
                action_fr = "démarré"
                emoji = "💧"
            else:
                action_ar = "إيقاف"
                action_fr = "arrêté"
                emoji = "🛑"

            lines = [f"{emoji} *تم {action_ar} الري بنجاح*\n"]
            for z in succeeded:
                lines.append(f"✅ {z}")
            if failed:
                lines.append(f"\n⚠️ فشل في: {', '.join(failed)}")
            lines.append(f"\n_Irrigation {action_fr} avec succès._")

            await self.send_message(phone, "\n".join(lines))

        except Exception as e:
            logger.error(f"[WA AI] Irrigation execution error: {e}")
            await self.send_message(phone, "⚠️ فشل التحكم في الري. حاول مرة أخرى.\n_Échec du contrôle de l'irrigation._")

    async def _handle_farm_status_check(self, phone: str, session: dict) -> None:
        """Fetch full farm IoT status and send a summary."""
        farm_id = session.get("farm_id")
        if not farm_id:
            await self.send_message(phone, "⚠️ ما لقيتش المزرعة. عاود الاتصال بالمزرعة.\n_Ferme introuvable._")
            return

        try:
            supabase = get_supabase_admin()
            three_hours_ago = (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat()

            # Fetch zones, environment, infrastructure, zone health in parallel
            zones = supabase.table("zones").select("id, zone_number, name").eq("farm_id", farm_id).eq("is_active", True).order("zone_number").execute()
            env = supabase.table("environment_readings").select("air_temperature_c, air_humidity_pct, solar_radiation_wm2, wind_speed_kmh, precipitation_mm").eq("farm_id", farm_id).gte("timestamp", three_hours_ago).order("timestamp", desc=True).limit(1).execute()
            infra = supabase.table("infrastructure_readings").select("reservoir_level_pct, filter_status, main_pressure_mpa, main_pump_flow_lpm").eq("farm_id", farm_id).gte("timestamp", three_hours_ago).order("timestamp", desc=True).limit(1).execute()
            health = supabase.table("zone_health_readings").select("zone_id, avg_soil_moisture_pct, stress_score, health_score, water_efficiency_pct, is_anomaly").eq("farm_id", farm_id).gte("timestamp", three_hours_ago).order("timestamp", desc=True).limit(50).execute()

            lines = ["🏡 *حالة المزرعة — Farm Status*\n"]

            # Environment
            if env.data:
                e = env.data[0]
                lines.append("🌤️ *الطقس:*")
                lines.append(f"• الحرارة: *{e.get('air_temperature_c', '—')}°C*")
                lines.append(f"• الرطوبة: *{e.get('air_humidity_pct', '—')}%*")
                wind = e.get('wind_speed_kmh')
                if wind:
                    lines.append(f"• الرياح: *{wind} km/h*")
                rain = e.get('precipitation_mm', 0)
                if rain and rain > 0:
                    lines.append(f"• 🌧️ أمطار: *{rain} mm*")
                lines.append("")

            # Infrastructure
            if infra.data:
                i = infra.data[0]
                reservoir = i.get('reservoir_level_pct')
                if reservoir is not None:
                    r_emoji = "🔴" if reservoir < 25 else "🟡" if reservoir < 40 else "🟢"
                    lines.append(f"💧 *الخزان:* {r_emoji} *{reservoir:.0f}%*")
                filt = i.get('filter_status')
                if filt is not None:
                    f_label = {0: "🟢 نظيف", 1: "🟡 جزئي", 2: "🔴 مسدود"}.get(filt, "—")
                    lines.append(f"🔧 *الفلتر:* {f_label}")
                pressure = i.get('main_pressure_mpa')
                if pressure:
                    lines.append(f"• الضغط: *{pressure:.3f} MPa*")
                lines.append("")

            # Zone health
            if zones.data:
                latest = {}
                for r in (health.data or []):
                    if r["zone_id"] not in latest:
                        latest[r["zone_id"]] = r

                lines.append("🌱 *المناطق:*")
                anomaly_zones = []
                for z in zones.data:
                    r = latest.get(z["id"])
                    name = z.get("name") or f"المنطقة {z['zone_number']}"
                    if r:
                        moisture = r.get("avg_soil_moisture_pct")
                        health_s = r.get("health_score")
                        stress = r.get("stress_score")
                        m_str = f"{moisture:.0f}%" if moisture is not None else "—"
                        h_str = f"{health_s:.1f}/10" if health_s is not None else "—"
                        emoji = "🔴" if (health_s or 0) < 4 else "🟡" if (health_s or 0) < 7 else "🟢"
                        lines.append(f"  {emoji} *{name}:* رطوبة {m_str} | صحة {h_str}")
                        if r.get("is_anomaly"):
                            anomaly_zones.append(name)
                    else:
                        lines.append(f"  ⚪ *{name}:* لا توجد بيانات حديثة")

                if anomaly_zones:
                    lines.append(f"\n⚠️ شذوذ في: *{', '.join(anomaly_zones)}*")

            if not env.data and not infra.data and not zones.data:
                lines.append("لا توجد بيانات حديثة في آخر 3 ساعات.")

            await self.send_message(phone, "\n".join(lines))

        except Exception as e:
            logger.error(f"[WA AI] Farm status check error: {e}")
            await self.send_message(phone, "⚠️ فشل جلب حالة المزرعة. عاود المحاولة.\n_Échec de récupération._")

    async def _handle_weather_check(self, phone: str, session: dict) -> None:
        """Fetch and return current weather data."""
        farm_id = session.get("farm_id")
        if not farm_id:
            await self.send_message(phone, "⚠️ ما لقيتش المزرعة.\n_Ferme introuvable._")
            return

        try:
            supabase = get_supabase_admin()
            three_hours_ago = (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat()

            env = supabase.table("environment_readings").select(
                "air_temperature_c, air_humidity_pct, solar_radiation_wm2, wind_speed_kmh, precipitation_mm, cloud_cover_pct, timestamp"
            ).eq("farm_id", farm_id).gte("timestamp", three_hours_ago).order("timestamp", desc=True).limit(5).execute()

            if not env.data:
                await self.send_message(phone, "⚠️ ما كاين تا قراءة ديال الطقس فآخر 3 ساعات.\n_Pas de données météo récentes._")
                return

            latest = env.data[0]
            temp = latest.get("air_temperature_c")
            humidity = latest.get("air_humidity_pct")
            solar = latest.get("solar_radiation_wm2")
            wind = latest.get("wind_speed_kmh")
            rain = latest.get("precipitation_mm", 0)
            clouds = latest.get("cloud_cover_pct")

            # Temperature advice for olives
            temp_advice = ""
            if temp is not None:
                if temp > 40:
                    temp_advice = "🔴 _حرارة مرتفعة بزاف — خطر على الزيتون_"
                elif temp > 35:
                    temp_advice = "🟡 _حرارة مرتفعة — راقب الإجهاد_"
                elif temp < 5:
                    temp_advice = "🔴 _خطر الصقيع!_"
                elif temp < 10:
                    temp_advice = "🟡 _حرارة منخفضة_"
                else:
                    temp_advice = "🟢 _حرارة مناسبة للزيتون_"

            lines = [
                "🌤️ *حالة الطقس — Weather*\n",
                f"🌡️ *الحرارة:* {temp:.1f}°C" if temp is not None else "🌡️ *الحرارة:* —",
            ]
            if temp_advice:
                lines.append(f"   {temp_advice}")
            lines.extend([
                f"💧 *الرطوبة:* {humidity:.0f}%" if humidity is not None else "💧 *الرطوبة:* —",
                f"☀️ *الإشعاع الشمسي:* {solar:.0f} W/m²" if solar is not None else "",
                f"💨 *الرياح:* {wind:.1f} km/h" if wind is not None else "",
                f"☁️ *الغيوم:* {clouds:.0f}%" if clouds is not None else "",
            ])
            if rain and rain > 0:
                lines.append(f"🌧️ *أمطار:* {rain:.1f} mm")

            # Show trend from recent readings
            if len(env.data) >= 3:
                temps = [r.get("air_temperature_c") for r in env.data if r.get("air_temperature_c") is not None]
                if len(temps) >= 3:
                    trend = "📈 ترتافع" if temps[0] > temps[-1] + 1 else "📉 تنخافض" if temps[0] < temps[-1] - 1 else "➡️ مستقرة"
                    lines.append(f"\n📊 *اتجاه الحرارة:* {trend}")

            # Filter empty lines
            lines = [l for l in lines if l]
            await self.send_message(phone, "\n".join(lines))

        except Exception as e:
            logger.error(f"[WA AI] Weather check error: {e}")
            await self.send_message(phone, "⚠️ فشل جلب بيانات الطقس.\n_Échec météo._")

    async def _handle_reservoir_check(self, phone: str, session: dict) -> None:
        """Fetch and return reservoir/infrastructure status."""
        farm_id = session.get("farm_id")
        if not farm_id:
            await self.send_message(phone, "⚠️ ما لقيتش المزرعة.\n_Ferme introuvable._")
            return

        try:
            supabase = get_supabase_admin()
            three_hours_ago = (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat()

            infra = supabase.table("infrastructure_readings").select(
                "reservoir_level_pct, filter_status, main_pressure_mpa, main_pump_flow_lpm, timestamp"
            ).eq("farm_id", farm_id).gte("timestamp", three_hours_ago).order("timestamp", desc=True).limit(5).execute()

            if not infra.data:
                await self.send_message(phone, "⚠️ ما كاين تا قراءة ديال البنية التحتية فآخر 3 ساعات.\n_Pas de données infrastructure._")
                return

            latest = infra.data[0]
            reservoir = latest.get("reservoir_level_pct")
            filt = latest.get("filter_status")
            pressure = latest.get("main_pressure_mpa")
            flow = latest.get("main_pump_flow_lpm")

            lines = ["💧 *حالة البنية التحتية — Infrastructure*\n"]

            # Reservoir
            if reservoir is not None:
                if reservoir < 25:
                    r_status = "🔴 *حرج! — CRITICAL*"
                    r_advice = "⚠️ _يجب ملء الخزان فوراً_"
                elif reservoir < 40:
                    r_status = "🟡 *منخفض — LOW*"
                    r_advice = "⚠️ _خطط لملء الخزان قريباً_"
                else:
                    r_status = "🟢 *جيد — OK*"
                    r_advice = ""
                lines.append(f"🏊 *مستوى الخزان:* {reservoir:.0f}% {r_status}")
                if r_advice:
                    lines.append(f"   {r_advice}")
            else:
                lines.append("🏊 *الخزان:* لا توجد بيانات")

            lines.append("")

            # Filter
            if filt is not None:
                f_info = {
                    0: ("🟢 نظيف — Clean", ""),
                    1: ("🟡 انسداد جزئي — Partial Clog", "⚠️ _خطط لتنظيف الفلتر_"),
                    2: ("🔴 مسدود — Clogged!", "🚨 _يجب تنظيف الفلتر فوراً!_"),
                }.get(filt, (f"غير معروف ({filt})", ""))
                lines.append(f"🔧 *الفلتر:* {f_info[0]}")
                if f_info[1]:
                    lines.append(f"   {f_info[1]}")
            lines.append("")

            # Pressure & flow
            if pressure is not None:
                p_emoji = "🟢" if 0.04 <= pressure <= 0.15 else "🟡" if pressure <= 0.2 else "🔴"
                lines.append(f"📊 *الضغط الرئيسي:* {p_emoji} {pressure:.3f} MPa")
            if flow is not None:
                lines.append(f"🚿 *تدفق المضخة:* {flow:.1f} L/min")

            # Show reservoir trend
            if len(infra.data) >= 3:
                levels = [r.get("reservoir_level_pct") for r in infra.data if r.get("reservoir_level_pct") is not None]
                if len(levels) >= 3:
                    trend = "📈 يرتفع" if levels[0] > levels[-1] + 2 else "📉 ينخفض" if levels[0] < levels[-1] - 2 else "➡️ مستقر"
                    lines.append(f"\n📊 *اتجاه الخزان:* {trend}")

            lines = [l for l in lines if l]
            await self.send_message(phone, "\n".join(lines))

        except Exception as e:
            logger.error(f"[WA AI] Reservoir check error: {e}")
            await self.send_message(phone, "⚠️ فشل جلب حالة البنية التحتية.\n_Échec infrastructure._")

    async def _handle_soil_moisture_check(self, phone: str, session: dict) -> None:
        """Fetch and return soil moisture for all farm zones."""
        farm_id = session.get("farm_id")
        if not farm_id:
            await self.send_message(phone, "⚠️ ما لقيتش المزرعة. عاود الاتصال بالمزرعة.\n_Ferme introuvable._")
            return

        try:
            supabase = get_supabase_admin()
            three_hours_ago = (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat()

            zones = supabase.table("zones").select("id, zone_number, name").eq("farm_id", farm_id).eq("is_active", True).order("zone_number").execute()
            if not zones.data:
                await self.send_message(phone, "⚠️ ما كاين تا منطقة نشطة.\n_Aucune zone active._")
                return

            health = supabase.table("zone_health_readings").select("zone_id, avg_soil_moisture_pct, health_score").eq("farm_id", farm_id).gte("timestamp", three_hours_ago).order("timestamp", desc=True).limit(50).execute()

            latest = {}
            for r in (health.data or []):
                if r["zone_id"] not in latest:
                    latest[r["zone_id"]] = r

            needs_irrigation = []
            lines = ["🌱 *رطوبة التربة — Soil Moisture*\n"]
            for z in zones.data:
                r = latest.get(z["id"])
                name = z.get("name") or f"المنطقة {z['zone_number']}"
                if r and r.get("avg_soil_moisture_pct") is not None:
                    moisture = r["avg_soil_moisture_pct"]
                    if moisture < 30:
                        status = "🔴 _منخفضة — تحتاج ري_"
                        needs_irrigation.append(name)
                    elif moisture < 40:
                        status = "🟡 _معقولة_"
                    elif moisture > 65:
                        status = "🔵 _مرتفعة_"
                    else:
                        status = "🟢 _جيدة_"
                    lines.append(f"• *{name}:* {moisture:.1f}% {status}")
                else:
                    lines.append(f"• *{name}:* ما كاين تا قراءة حديثة")

            if needs_irrigation:
                lines.append(f'\n⚠️ *{", ".join(needs_irrigation)}* تحتاج ري.')
                lines.append('أرسل *"شغل الري"* إذا بغيت تبدأ.')
            else:
                lines.append("\n✅ جميع المناطق في حالة جيدة.")

            await self.send_message(phone, "\n".join(lines))

        except Exception as e:
            logger.error(f"[WA AI] Soil moisture check error: {e}")
            await self.send_message(phone, "⚠️ فشل جلب بيانات الرطوبة. عاود المحاولة.\n_Échec de récupération des données._")

    async def _send_image(self, phone: str, image_url: str, caption: str = "") -> Dict[str, Any]:
        """Send an image via WaSenderAPI"""
        if not self.enabled:
            return {"success": False, "status": "disabled"}

        payload = {
            "to": phone,
            "imageUrl": image_url,
        }
        if caption:
            payload["text"] = caption

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.api_url}/api/send-message",
                    json=payload,
                    headers=self.headers,
                    timeout=30.0,
                )
                logger.info(f"[WA IMAGE] Response: {response.status_code} - {response.text[:300]}")
                response.raise_for_status()
                return {"success": True, "status": "sent"}
            except Exception as e:
                logger.error(f"[WA IMAGE] Error: {e}")
                return {"success": False, "status": "error", "detail": str(e)}

    # ─── AI Session Management (Supabase) ────────────────────────

    async def _get_ai_session(self, phone: str) -> Optional[dict]:
        """Get the AI session for a phone number"""
        supabase = get_supabase_admin()
        result = supabase.table("whatsapp_ai_sessions").select("*").eq("phone", phone).execute()
        return result.data[0] if result.data else None

    async def _create_ai_session(self, phone: str) -> dict:
        """Create a new AI session for a phone number"""
        supabase = get_supabase_admin()
        result = supabase.table("whatsapp_ai_sessions").insert({
            "phone": phone,
            "state": "awaiting_farm_name",
        }).execute()
        return result.data[0]

    async def _update_ai_session(
        self,
        session_id: str,
        state: Optional[str] = None,
        farm_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
    ) -> None:
        """Update an AI session"""
        supabase = get_supabase_admin()
        update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
        if state is not None:
            update_data["state"] = state
        if farm_id is not None:
            update_data["farm_id"] = farm_id
        elif state in ("awaiting_farm_name", "disconnected"):
            update_data["farm_id"] = None
        if conversation_id is not None:
            update_data["conversation_id"] = conversation_id
        elif state in ("awaiting_farm_name", "disconnected"):
            update_data["conversation_id"] = None
        # Clear pending action when switching states
        if state in ("awaiting_farm_name", "disconnected"):
            update_data["pending_action"] = None
            update_data["pending_expires_at"] = None

        supabase.table("whatsapp_ai_sessions").update(update_data).eq("id", session_id).execute()

    async def _set_pending_action(self, session_id: str, action: str) -> None:
        """Store pending irrigation confirmation in DB."""
        supabase = get_supabase_admin()
        expires = (datetime.now(timezone.utc) + _CONFIRMATION_TTL).isoformat()
        supabase.table("whatsapp_ai_sessions").update({
            "pending_action": action,
            "pending_expires_at": expires,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", session_id).execute()

    async def _clear_pending_action(self, session_id: str) -> None:
        """Clear pending irrigation confirmation."""
        supabase = get_supabase_admin()
        supabase.table("whatsapp_ai_sessions").update({
            "pending_action": None,
            "pending_expires_at": None,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", session_id).execute()

    # ─── Message Logging ─────────────────────────────────────────

    async def _log_message(
        self,
        phone: str,
        message: str,
        direction: str,
        status: str,
        external_id: Optional[str] = None,
    ) -> None:
        """Log message to Supabase"""
        try:
            supabase = get_supabase_admin()
            supabase.table("whatsapp_messages").insert({
                "phone": phone,
                "message": message,
                "direction": direction,
                "status": status,
                "external_id": external_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
        except Exception as e:
            logger.error(f"Failed to log message: {e}")


# Singleton instance
_whatsapp_service: Optional[WhatsAppService] = None


def get_whatsapp_service() -> WhatsAppService:
    global _whatsapp_service
    if _whatsapp_service is None:
        _whatsapp_service = WhatsAppService()
    return _whatsapp_service
