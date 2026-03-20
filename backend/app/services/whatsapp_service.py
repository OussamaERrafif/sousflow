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


class WhatsAppService:
    """Service for sending and receiving WhatsApp messages via WaSenderAPI"""

    # ─── Help menu ───────────────────────────────────────────────
    HELP_MENU = (
        "Here's what I can help you with:\n\n"
        "• Check soil moisture\n"
        "• Turn irrigation ON\n"
        "• Turn irrigation OFF\n\n"
        "Try:\n"
        '• "What is the soil moisture?"\n'
        '• "Turn on irrigation"\n'
        '• "Turn off irrigation"'
    )

    # ─── Keyword sets ────────────────────────────────────────────
    _HELP_KEYWORDS = {
        "help", "menu", "what can you do",
        "مساعدة", "قائمة", "ماذا تستطيع", "المساعدة",
    }

    _IRRIGATION_START_PHRASES = [
        "turn on irrigation", "turn on the irrigation",
        "start irrigation", "start the irrigation",
        "open irrigation", "begin irrigation",
        "irrigate zone", "water zone", "start watering",
        "ابدأ الري", "شغل الري", "افتح الري", "ابدأ ري",
        "تشغيل الري", "بدء الري",
        "allumer l'irrigation", "démarrer l'irrigation",
        "ouvrir l'irrigation", "activer l'irrigation",
    ]

    _IRRIGATION_STOP_PHRASES = [
        "turn off irrigation", "turn off the irrigation",
        "stop irrigation", "stop the irrigation",
        "close irrigation", "stop watering",
        "أوقف الري", "اطفئ الري", "أطفئ الري",
        "إيقاف الري", "وقف الري", "أغلق الري",
        "arrêter l'irrigation", "éteindre l'irrigation",
        "fermer l'irrigation", "désactiver l'irrigation",
    ]

    _YES_WORDS = {
        "yes", "yeah", "yep", "ok", "okay", "sure", "confirm", "do it",
        "نعم", "أيوا", "اه", "موافق", "تأكيد",
        "oui", "d'accord", "ouais",
    }

    _NO_WORDS = {
        "no", "nope", "cancel", "nevermind", "never mind",
        "لا", "لأ", "إلغاء", "لا تفعل",
        "non", "annuler", "pas",
    }

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
        # In-memory store for pending irrigation confirmations: phone → {action, original_message}
        self._pending_confirmations: Dict[str, Dict[str, str]] = {}
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
            elif session["state"] == "awaiting_confirmation":
                # User is responding to an irrigation confirmation prompt
                await self._handle_confirmation(sender_phone, message_body, session)
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

    # Keywords that mean the user wants a chart
    _CHART_KEYWORDS = {
        "نعم", "أيوا", "اه", "رسم", "رسم بياني", "بياني", "chart", "graph",
        "plot", "oui", "graphique", "yes", "yeah", "ok", "d'accord",
    }

    def _is_help_request(self, msg_lower: str) -> bool:
        return msg_lower.strip() in self._HELP_KEYWORDS or "what can you do" in msg_lower

    def _is_irrigation_start(self, msg_lower: str) -> bool:
        return any(phrase in msg_lower for phrase in self._IRRIGATION_START_PHRASES)

    def _is_irrigation_stop(self, msg_lower: str) -> bool:
        return any(phrase in msg_lower for phrase in self._IRRIGATION_STOP_PHRASES)

    async def _handle_ai_chat(self, phone: str, message: str, session: dict, bypass_confirmation: bool = False) -> None:
        """Route message to OpenAI with farm context, or generate chart if requested"""
        # Check for farm switch command (always checked)
        msg_lower = message.strip().lower()
        if msg_lower in ("تغيير المزرعة", "changer ferme", "switch farm", "تغيير"):
            await self._update_ai_session(session["id"], state="awaiting_farm_name", farm_id=None, conversation_id=None)
            await self.send_message(
                phone,
                "🔄 من فضلك، أخبرني باسم المزرعة الجديدة.\n_Quel est le nom de la nouvelle ferme?_"
            )
            return

        farm_id = session["farm_id"]
        conversation_id = session["conversation_id"]

        if not bypass_confirmation:
            # Help menu
            if self._is_help_request(msg_lower):
                await self.send_message(phone, self.HELP_MENU)
                return

            # Chart request
            if self._is_chart_request(msg_lower):
                await self._handle_chart_request(phone, farm_id, conversation_id)
                return

            # Irrigation confirmation intercept — start
            if self._is_irrigation_start(msg_lower):
                self._pending_confirmations[phone] = {
                    "action": "start",
                    "original_message": message,
                }
                await self._update_ai_session(session["id"], state="awaiting_confirmation")
                await self.send_message(
                    phone,
                    "Are you sure you want to turn *on* the irrigation?\nReply *yes* to confirm or *no* to cancel."
                )
                return

            # Irrigation confirmation intercept — stop
            if self._is_irrigation_stop(msg_lower):
                self._pending_confirmations[phone] = {
                    "action": "stop",
                    "original_message": message,
                }
                await self._update_ai_session(session["id"], state="awaiting_confirmation")
                await self.send_message(
                    phone,
                    "Are you sure you want to turn *off* the irrigation?\nReply *yes* to confirm or *no* to cancel."
                )
                return

        try:
            from app.services.openai_service import chat
            # Look up farm owner as user context for AI tool permission checks
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

            # Force-convert markdown to WhatsApp formatting
            ai_response = self._convert_to_whatsapp_format(ai_response)

            # Handle unsupported request marker from AI
            if "CANNOT_HELP" in ai_response:
                await self.send_message(phone, "Sorry, I can't help with that.\n\n" + self.HELP_MENU)
                return

            # WhatsApp has a 4096 char limit — truncate if needed
            if len(ai_response) > 4000:
                ai_response = ai_response[:3990] + "\n..."

            await self.send_message(phone, ai_response)

        except Exception as e:
            logger.error(f"WhatsApp AI chat error: {e}")
            await self.send_message(
                phone,
                "⚠️ عذراً، حدث خطأ. حاول مرة أخرى.\n_Erreur, réessayez._"
            )

    async def _handle_confirmation(self, phone: str, message: str, session: dict) -> None:
        """Handle user response to an irrigation confirmation prompt"""
        msg_lower = message.strip().lower()
        words = set(msg_lower.split())
        pending = self._pending_confirmations.get(phone)

        if not pending:
            # No pending action — reset to connected and process normally
            await self._update_ai_session(session["id"], state="connected")
            await self._handle_ai_chat(phone, message, {**session, "state": "connected"})
            return

        is_yes = bool(words & self._YES_WORDS) or msg_lower in self._YES_WORDS
        is_no = bool(words & self._NO_WORDS) or msg_lower in self._NO_WORDS

        if is_yes:
            original_message = pending["original_message"]
            self._pending_confirmations.pop(phone, None)
            await self._update_ai_session(session["id"], state="connected")
            # Execute the original command via AI, bypassing confirmation
            await self._handle_ai_chat(
                phone, original_message,
                {**session, "state": "connected"},
                bypass_confirmation=True,
            )
        elif is_no:
            self._pending_confirmations.pop(phone, None)
            await self._update_ai_session(session["id"], state="connected")
            await self.send_message(phone, "Okay, no changes were made.")
        else:
            await self.send_message(
                phone,
                "Please reply with *yes* to confirm or *no* to cancel."
            )

    def _is_chart_request(self, msg_lower: str) -> bool:
        """Check if the message is a request for a chart"""
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

    # ─── Farm → Users → Phone Numbers ───────────────────────────

    async def get_farm_phone_numbers(self, farm_id: str) -> List[str]:
        """
        Get all WhatsApp phone numbers linked to a farm.
        Includes the farm owner + all active farm members with a phone.
        """
        supabase = get_supabase_admin()
        phones: List[str] = []
        seen: set = set()

        # 1. Farm owner
        try:
            farm = supabase.table("farms").select("owner_id").eq("id", farm_id).limit(1).execute()
            if farm.data:
                owner = supabase.table("users").select("phone").eq("id", farm.data[0]["owner_id"]).execute()
                if owner.data and owner.data[0].get("phone"):
                    p = owner.data[0]["phone"]
                    phones.append(p)
                    seen.add(p)
        except Exception as e:
            logger.error(f"[WA PHONES] Failed to get farm owner phone: {e}")

        # 2. All active members
        try:
            members = supabase.table("farm_memberships").select("user_id").eq("farm_id", farm_id).eq("is_active", True).execute()
            if members.data:
                user_ids = [m["user_id"] for m in members.data]
                for uid in user_ids:
                    user = supabase.table("users").select("phone").eq("id", uid).execute()
                    if user.data and user.data[0].get("phone"):
                        p = user.data[0]["phone"]
                        if p not in seen:
                            phones.append(p)
                            seen.add(p)
        except Exception as e:
            logger.error(f"[WA PHONES] Failed to get farm member phones: {e}")

        return phones

    # ─── Anomaly Alert Broadcasting ──────────────────────────────

    async def broadcast_anomaly_alert(
        self,
        farm_id: str,
        anomaly_type: str,
        severity: str = "medium",
        zone_name: Optional[str] = None,
        details: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Send an anomaly alert to ALL users linked to a farm.
        Returns summary of send results.
        """
        phones = await self.get_farm_phone_numbers(farm_id)
        if not phones:
            logger.warning(f"[WA ALERT] No recipients for farm {farm_id}")
            return {"sent": 0, "failed": 0, "warning": "No recipients for this farm"}

        # Build severity emoji
        severity_emoji = {
            "low": "⚠️",
            "medium": "⚠️",
            "high": "🔴",
            "critical": "🚨",
        }
        emoji = severity_emoji.get(severity, "⚠️")

        # Human-readable anomaly type
        type_labels = {
            "low_soil_moisture": "Low Soil Moisture",
            "irrigation_failure": "Irrigation Failure",
            "sensor_error": "Sensor Error",
            "sensor_fault": "Sensor Fault",
            "pipe_burst": "Pipe Burst",
            "pressure_drop": "Pressure Drop",
            "flow_spike": "Flow Spike",
            "high_temperature": "High Temperature",
            "low_humidity": "Low Humidity",
        }
        type_label = type_labels.get(anomaly_type, anomaly_type.replace("_", " ").title())

        # Build message
        msg = f"{emoji} *{severity.upper()} Alert*\n\n"
        msg += f"Type: {type_label}\n"
        if zone_name:
            msg += f"Zone: {zone_name}\n"
        if details:
            msg += f"{details}\n"

        # Action recommendation
        action_map = {
            "low_soil_moisture": "Action: Check irrigation system.",
            "irrigation_failure": "Action: Inspect valves and pump.",
            "sensor_error": "Action: Check sensor connections.",
            "sensor_fault": "Action: Inspect sensor hardware.",
            "pipe_burst": "Action: Check pipes for leaks immediately.",
            "pressure_drop": "Action: Check pump and filter system.",
            "flow_spike": "Action: Inspect zone for blockage or leak.",
            "high_temperature": "Action: Consider increasing irrigation.",
            "low_humidity": "Action: Monitor crop stress levels.",
        }
        msg += f"\n{action_map.get(anomaly_type, 'Action: Check your farm dashboard.')}\n"
        msg += '\nReply "help" for available actions.'

        sent = 0
        failed = 0
        errors = []
        for phone in phones:
            try:
                result = await self.send_message(phone, msg)
                if result.get("success"):
                    sent += 1
                else:
                    failed += 1
                    errors.append({"phone": phone, "error": result.get("detail", "unknown")})
            except Exception as e:
                failed += 1
                errors.append({"phone": phone, "error": str(e)})
                logger.error(f"[WA ALERT] Failed to send to {phone}: {e}")

        return {"sent": sent, "failed": failed, "total_recipients": len(phones), "errors": errors if errors else None}

    # ─── WhatsApp Test Mode ──────────────────────────────────────

    async def simulate_message(
        self,
        phone: str,
        message: str,
        test_mode: bool = True,
    ) -> Dict[str, Any]:
        """
        Simulate a WhatsApp conversation for testing.
        In test_mode=True, messages are NOT sent to real WhatsApp — only logged.
        In test_mode=False (live mode), messages are sent normally.
        Returns the full interaction log.
        """
        log_entry = {
            "test_mode": test_mode,
            "phone": phone,
            "incoming_message": message,
            "ai_response": None,
            "action_taken": None,
            "session_state": None,
            "error": None,
        }

        # Capture the original send_message method
        original_send = self.send_message
        captured_responses: List[str] = []

        if test_mode:
            # In test mode, intercept send_message to capture responses without sending
            async def mock_send(to_phone: str, msg: str) -> Dict[str, Any]:
                captured_responses.append(msg)
                logger.info(f"[WA TEST] Would send to {to_phone}: {msg[:200]}")
                return {"success": True, "message_id": "test_mode", "status": "simulated"}
            self.send_message = mock_send  # type: ignore

        try:
            # Get current session state
            session = await self._get_ai_session(phone)
            log_entry["session_state"] = session["state"] if session else "new_user"

            # Process the message through the normal flow
            await self.handle_incoming_message(phone, message)

            log_entry["ai_response"] = captured_responses if test_mode else "(sent via WhatsApp)"

            # Detect action taken
            if session and session.get("state") == "awaiting_confirmation":
                msg_lower = message.strip().lower()
                words = set(msg_lower.split())
                if words & self._YES_WORDS or msg_lower in self._YES_WORDS:
                    pending = self._pending_confirmations.get(phone)
                    log_entry["action_taken"] = f"irrigation_{pending['action']}" if pending else "confirmed"
                elif words & self._NO_WORDS or msg_lower in self._NO_WORDS:
                    log_entry["action_taken"] = "cancelled"
            elif session and session.get("state") == "connected":
                msg_lower = message.strip().lower()
                if self._is_irrigation_start(msg_lower):
                    log_entry["action_taken"] = "confirmation_requested_start"
                elif self._is_irrigation_stop(msg_lower):
                    log_entry["action_taken"] = "confirmation_requested_stop"
                elif self._is_help_request(msg_lower):
                    log_entry["action_taken"] = "help_menu_shown"

        except Exception as e:
            log_entry["error"] = str(e)
            logger.error(f"[WA TEST] Simulation error: {e}")
        finally:
            if test_mode:
                self.send_message = original_send  # type: ignore

        return log_entry

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
