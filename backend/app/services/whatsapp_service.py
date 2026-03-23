"""
WhatsApp integration service via WaSenderAPI
https://wasenderapi.com/api-docs
"""
import httpx
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from app.config import get_settings
from app.supabase_client import get_supabase_admin
from app.logging_config import logger, debug

# ─── WhatsApp Command Constants ──────────────────────────────────

HELP_MENU = (
    "📱 *SoussFlow — قائمة الأوامر*\n\n"
    "💧 *التحكم في الري:*\n"
    '• "شغل الري" / "turn on irrigation"\n'
    '• "أوقف الري" / "turn off irrigation"\n\n'
    "🌱 *حالة المزرعة:*\n"
    '• "شنو طرا؟" — آش وقع بالمزرعة\n'
    '• "رطوبة التربة" / "check soil moisture"\n'
    '• "حالة الري" / "zone status"\n\n'
    "📊 *أسئلة وتحليل:*\n"
    "• سولني على الطقس، المناطق، المستشعرات...\n"
    "• نصائح زراعة الزيتون\n"
    "• طلب رسم بياني: \"رسم\" / \"chart\"\n\n"
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

_CONFIRM_YES = {
    "yes", "oui", "نعم", "أيوا", "اه", "ya", "yeah", "yep", "ok",
    "d'accord", "sure", "confirm", "aywa", "ايوا", "ايه", "واخا", "wakha",
    "نعم نعم", "أكد", "اكد",
}
_CONFIRM_NO = {
    "no", "non", "لا", "nope", "cancel", "إلغاء", "annuler", "لا شكرا",
    "لا لا", "ماشي", "machi", "لأ", "la",
}

# In-memory pending irrigation confirmations: phone -> "start" or "stop"
_pending_confirmations: Dict[str, str] = {}


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

    async def send_alert(
        self,
        phone: str,
        alert_type: str,
        sensor_id: Optional[str] = None,
        value: Optional[float] = None,
        threshold: Optional[float] = None,
        custom_message: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send an automated alert via WhatsApp"""
        if custom_message:
            message = custom_message
        else:
            message = self._build_alert_message(alert_type, sensor_id, value, threshold)

        return await self.send_message(phone, message)

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
        import re

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
        # Remove table separator rows (|---|---|)
        text = re.sub(r'^\|[-: |]+\|$', '', text, flags=re.MULTILINE)
        # Convert table rows |a|b|c| to "a | b | c"
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
        1. If no session exists → ask for farm name
        2. If awaiting farm name → look up farm, connect
        3. If connected → route to OpenAI with farm context
        """
        try:
            logger.info(f"[WA AI] >>> Incoming from {sender_phone}: {message_body[:100]}")

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
            elif session["state"] == "awaiting_farm_name":
                # User is responding with farm name
                await self._handle_farm_lookup(sender_phone, message_body, session)
            elif session["state"] == "connected":
                # User is connected — route to AI
                await self._handle_ai_chat(sender_phone, message_body, session)
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
            # Multiple matches — let user pick
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

        # Create a conversation for this WhatsApp session
        # user_id is required — use the farm owner as the conversation owner
        conv_result = supabase.table("conversations").insert({
            "user_id": farm["owner_id"],
            "farm_id": farm_id,
            "title": f"WhatsApp - {phone}",
        }).execute()
        conversation_id = conv_result.data[0]["id"]

        # Update session to connected
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

    # Explicit chart keywords — only trigger on real chart requests, NOT generic
    # affirmatives like "yes", "ok", "نعم" which were causing false positives
    _CHART_KEYWORDS = {
        "رسم", "رسم بياني", "بياني", "chart", "graph", "plot",
        "graphique", "diagramme",
    }

    async def _handle_ai_chat(self, phone: str, message: str, session: dict) -> None:
        """
        Full AI assistant:
        - Irrigation commands require explicit confirmation (safety gate)
        - Help menu on demand
        - Chart generation only when explicitly requested
        - Everything else routed to OpenAI (read-only tools on WhatsApp — no auto-actions)
        """
        msg_lower = message.strip().lower()

        # 1. Farm switch command
        if msg_lower in ("تغيير المزرعة", "changer ferme", "switch farm", "تغيير"):
            await self._update_ai_session(session["id"], state="awaiting_farm_name", farm_id=None, conversation_id=None)
            await self.send_message(
                phone,
                "🔄 *تغيير المزرعة*\n\nأرسل اسم المزرعة الجديدة.\n_Envoyez le nom de la nouvelle ferme._"
            )
            return

        # 2. Help menu
        if msg_lower in _HELP_KEYWORDS:
            await self.send_message(phone, HELP_MENU)
            return

        # 3. Pending irrigation confirmation — handle BEFORE keyword detection
        if phone in _pending_confirmations:
            pending_action = _pending_confirmations[phone]
            if msg_lower in _CONFIRM_YES:
                del _pending_confirmations[phone]
                await self._execute_irrigation_command(phone, pending_action, session)
            elif msg_lower in _CONFIRM_NO:
                del _pending_confirmations[phone]
                await self.send_message(phone, "✅ واخا، ما دير والو.\n_Aucune modification effectuée._")
            else:
                # Not a clear yes/no — re-ask
                action_label = "تشغيل" if pending_action == "start" else "إيقاف"
                await self.send_message(
                    phone,
                    f"⚠️ من فضلك أكد: هل تريد *{action_label}* الري؟\n"
                    "• أرسل *نعم* / *واخا* للتأكيد\n"
                    "• أرسل *لا* / *ماشي* للإلغاء"
                )
            return

        # 4. Irrigation ON → confirmation gate (NEVER execute directly)
        if any(k in msg_lower for k in _IRRIGATION_ON_KEYWORDS):
            _pending_confirmations[phone] = "start"
            await self.send_message(
                phone,
                "💧 *تأكيد تشغيل الري*\n\n"
                "واش بغيت تشغل الري فجميع المناطق؟\n\n"
                "• أرسل *نعم* / *واخا* للتأكيد\n"
                "• أرسل *لا* / *ماشي* للإلغاء"
            )
            return

        # 5. Irrigation OFF → confirmation gate (NEVER execute directly)
        if any(k in msg_lower for k in _IRRIGATION_OFF_KEYWORDS):
            _pending_confirmations[phone] = "stop"
            await self.send_message(
                phone,
                "🛑 *تأكيد إيقاف الري*\n\n"
                "واش بغيت توقف الري فجميع المناطق؟\n\n"
                "• أرسل *نعم* / *واخا* للتأكيد\n"
                "• أرسل *لا* / *ماشي* للإلغاء"
            )
            return

        # 6. Soil moisture quick-check (faster than OpenAI round-trip)
        if any(k in msg_lower for k in _SOIL_MOISTURE_KEYWORDS):
            await self._handle_soil_moisture_check(phone, session)
            return

        farm_id = session["farm_id"]
        conversation_id = session["conversation_id"]

        # 7. Explicit chart request
        if self._is_chart_request(msg_lower):
            await self._handle_chart_request(phone, farm_id, conversation_id)
            return

        # 8. Route everything else to OpenAI (WhatsApp = read-only, no device control)
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

            # WhatsApp 4096 char limit
            if len(ai_response) > 4000:
                ai_response = ai_response[:3990] + "\n\n_...الرسالة طويلة، اسأل عن جزء محدد._"

            await self.send_message(phone, ai_response)

        except Exception as e:
            logger.error(f"WhatsApp AI chat error: {e}")
            await self.send_message(
                phone,
                "⚠️ حدث خطأ، عاود المحاولة.\n_Erreur, réessayez._"
            )

    def _is_chart_request(self, msg_lower: str) -> bool:
        """Check if the message is an explicit request for a chart.
        Only matches real chart words — NOT generic affirmatives like 'yes'."""
        words = set(msg_lower.split())
        return bool(words & self._CHART_KEYWORDS)

    async def _handle_chart_request(self, phone: str, farm_id: str, conversation_id: str) -> None:
        """Generate a chart image and send it via WhatsApp"""
        import json as _json
        from urllib.parse import quote

        try:
            from app.services.openai_service import generate_chart_config
            config = await generate_chart_config(farm_id, conversation_id)

            if not config:
                await self.send_message(phone, "⚠️ لم أتمكن من إنشاء الرسم البياني. حاول مرة أخرى.\n_Impossible de générer le graphique._")
                return

            # Build QuickChart.io URL
            chart_json = _json.dumps(config, ensure_ascii=False)
            chart_url = f"https://quickchart.io/chart?c={quote(chart_json)}&w=600&h=400&bkg=white"

            logger.info(f"[WA CHART] Sending chart to {phone}, url_len={len(chart_url)}")

            # Send as image via WaSenderAPI
            await self._send_image(phone, chart_url, "📊 SoussFlow Chart")

        except Exception as e:
            logger.error(f"WhatsApp chart error: {e}")
            await self.send_message(phone, "⚠️ خطأ في إنشاء الرسم البياني.\n_Erreur lors de la génération du graphique._")

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

            # Get farm owner id for audit log
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

    async def _handle_soil_moisture_check(self, phone: str, session: dict) -> None:
        """Fetch and return soil moisture for all farm zones."""
        farm_id = session.get("farm_id")
        if not farm_id:
            await self.send_message(phone, "⚠️ Farm not found. Please reconnect.")
            return

        try:
            from datetime import timedelta
            supabase = get_supabase_admin()
            three_hours_ago = (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat()

            # Get zones with names
            zones = supabase.table("zones").select("id, zone_number, name").eq("farm_id", farm_id).eq("is_active", True).order("zone_number").execute()
            if not zones.data:
                await self.send_message(phone, "⚠️ No active zones found.")
                return

            # Get latest zone health readings
            zone_ids = [z["id"] for z in zones.data]
            health = supabase.table("zone_health_readings").select("zone_id, avg_soil_moisture_pct, health_score").eq("farm_id", farm_id).gte("timestamp", three_hours_ago).order("timestamp", desc=True).limit(50).execute()

            # Latest reading per zone
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
            await self.send_message(phone, "⚠️ Failed to fetch soil moisture. Please try again.")

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
        elif state == "awaiting_farm_name":
            update_data["farm_id"] = None
        if conversation_id is not None:
            update_data["conversation_id"] = conversation_id
        elif state == "awaiting_farm_name":
            update_data["conversation_id"] = None

        supabase.table("whatsapp_ai_sessions").update(update_data).eq("id", session_id).execute()

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
