"""
WhatsApp integration service via Wassender API
https://app.wassenger.com/docs/api
"""
import httpx
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from app.config import get_settings
from app.supabase_client import get_supabase_admin
from app.logging_config import logger


class WhatsAppService:
    """Service for sending and receiving WhatsApp messages via Wassender"""

    def __init__(self):
        settings = get_settings()
        self.enabled = settings.WASSENDER_ENABLED
        self.api_url = settings.WASSENDER_API_URL if self.enabled else None
        self.api_key = settings.WASSENDER_API_KEY if self.enabled else None
        self.device_id = settings.WASSENDER_DEVICE_ID if self.enabled else None
        self.headers = {
            "Content-Type": "application/json",
            "Token": self.api_key or "",
        }

    async def send_message(self, phone: str, message: str) -> Dict[str, Any]:
        """Send a text message via WhatsApp"""
        if not self.enabled:
            return {
                "success": False,
                "status": "disabled",
                "detail": "WhatsApp integration is disabled",
            }
        
        payload = {
            "phone": phone,
            "message": message,
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.api_url}/messages",
                    json=payload,
                    headers=self.headers,
                    timeout=30.0,
                )
                response.raise_for_status()
                result = response.json()

                # Log to Supabase
                await self._log_message(
                    phone=phone,
                    message=message,
                    direction="outbound",
                    status="sent",
                    external_id=result.get("id"),
                )

                logger.info(f"WhatsApp message sent to {phone}")
                return {
                    "success": True,
                    "message_id": result.get("id"),
                    "status": "sent",
                }
            except httpx.HTTPStatusError as e:
                logger.error(f"Wassender API error: {e.response.status_code} - {e.response.text}")
                return {
                    "success": False,
                    "status": "failed",
                    "detail": f"API error: {e.response.status_code}",
                }
            except Exception as e:
                logger.error(f"WhatsApp send error: {e}")
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
        """Check WhatsApp device connection status"""
        if not self.enabled:
            return {"status": "disabled", "detail": "WhatsApp integration is disabled"}
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.api_url}/devices/{self.device_id}",
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
