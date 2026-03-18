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

    async def _handle_ai_chat(self, phone: str, message: str, session: dict) -> None:
        """Route message to OpenAI with farm context"""
        # Check for farm switch command
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

        try:
            from app.services.openai_service import chat
            ai_response = await chat(
                farm_id=farm_id,
                conversation_id=conversation_id,
                user_message=message,
                channel="whatsapp",
            )

            # Force-convert markdown to WhatsApp formatting
            ai_response = self._convert_to_whatsapp_format(ai_response)

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
