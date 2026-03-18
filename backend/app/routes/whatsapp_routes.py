"""
WhatsApp routes — send/receive messages via WaSenderAPI
Includes webhook endpoint for incoming messages (AI assistant)
"""
import asyncio
from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from typing import Optional
from app.auth import get_current_user
from app.config import get_settings
from app.services.whatsapp_service import get_whatsapp_service
from app.schemas.whatsapp import (
    SendMessageRequest,
    WhatsAppMessageResponse,
    WhatsAppMessagesListResponse,
    WhatsAppAlert,
)
from app.logging_config import logger, debug, debug_request, debug_response

router = APIRouter(prefix="/api/whatsapp", tags=["WhatsApp"])


@router.post("/send", response_model=WhatsAppMessageResponse)
async def send_message(
    request: SendMessageRequest,
    current_user: dict = Depends(get_current_user),
):
    """Send a WhatsApp message"""
    debug(f"Sending WhatsApp message to {request.phone}", "whatsapp_routes.send_message")
    debug_request(request, "whatsapp_routes.send_message")
    service = get_whatsapp_service()
    result = await service.send_message(request.phone, request.message)
    debug_response(result, "whatsapp_routes.send_message")
    return result


@router.get("/messages", response_model=WhatsAppMessagesListResponse)
async def get_messages(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    phone: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """Get WhatsApp message history"""
    debug(f"Fetching WhatsApp messages - page: {page}, page_size: {page_size}, phone: {phone}", "whatsapp_routes.get_messages")
    service = get_whatsapp_service()
    result = await service.get_messages(
        page=page,
        page_size=page_size,
        phone=phone,
    )
    debug_response(result, "whatsapp_routes.get_messages")
    return result


@router.get("/status")
async def get_device_status(
    current_user: dict = Depends(get_current_user),
):
    """Check WhatsApp device connection status"""
    debug("Checking WhatsApp device status", "whatsapp_routes.get_device_status")
    service = get_whatsapp_service()
    result = await service.get_device_status()
    debug_response(result, "whatsapp_routes.get_device_status")
    return result


@router.post("/alert", response_model=WhatsAppMessageResponse)
async def send_alert(
    alert: WhatsAppAlert,
    current_user: dict = Depends(get_current_user),
):
    """Send an automated alert via WhatsApp"""
    debug(f"Sending WhatsApp alert - type: {alert.alert_type}, phone: {alert.phone}", "whatsapp_routes.send_alert")
    debug_request(alert, "whatsapp_routes.send_alert")
    service = get_whatsapp_service()
    result = await service.send_alert(
        phone=alert.phone,
        alert_type=alert.alert_type,
        sensor_id=alert.sensor_id,
        value=alert.value,
        threshold=alert.threshold,
        custom_message=alert.message,
    )
    debug_response(result, "whatsapp_routes.send_alert")
    return result


# ─── Webhook for incoming WhatsApp messages ──────────────────────

@router.post("/webhook")
async def whatsapp_webhook(request: Request):
    """
    WaSenderAPI webhook — receives incoming WhatsApp messages.
    Verifies signature and processes via AI assistant.
    """
    # Verify webhook signature
    settings = get_settings()
    signature = request.headers.get("x-webhook-signature", "")
    if settings.WASSENDER_WEBHOOK_SECRET and signature != settings.WASSENDER_WEBHOOK_SECRET:
        logger.warning("WhatsApp webhook: invalid signature")
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event = payload.get("event", "")
    logger.info(f"[WA WEBHOOK] Event: {event}, payload keys: {list(payload.keys())}")

    # Only process personal received messages
    if event not in ("messages.received", "messages-personal.received", "messages.upsert"):
        logger.info(f"[WA WEBHOOK] Ignoring event: {event}")
        return {"status": "ignored", "event": event}

    # Extract message data
    messages_data = payload.get("data", {}).get("messages")
    if not messages_data:
        logger.warning("[WA WEBHOOK] No messages data in payload")
        return {"status": "no_message_data"}

    key = messages_data.get("key", {})
    logger.info(f"[WA WEBHOOK] Key: {key}")

    # Skip messages sent by us
    if key.get("fromMe", False):
        logger.info("[WA WEBHOOK] Skipping own message")
        return {"status": "skipped_own_message"}

    # Get sender phone number
    sender_phone = key.get("cleanedSenderPn") or key.get("cleanedParticipantPn")
    if not sender_phone:
        logger.warning(f"[WA WEBHOOK] No sender phone. Full key: {key}")
        return {"status": "no_sender"}

    # Normalize to E.164 format
    if not sender_phone.startswith("+"):
        sender_phone = f"+{sender_phone}"

    # Get message text
    message_body = messages_data.get("messageBody", "").strip()
    if not message_body:
        logger.info(f"[WA WEBHOOK] No text content from {sender_phone}")
        return {"status": "no_text_content"}

    logger.info(f"[WA WEBHOOK] Processing: from={sender_phone}, msg={message_body[:100]}")

    # Process asynchronously so we respond 200 quickly
    service = get_whatsapp_service()
    logger.info(f"[WA WEBHOOK] Service enabled={service.enabled}, api_url={service.api_url}")
    asyncio.create_task(service.handle_incoming_message(sender_phone, message_body))

    return {"status": "ok"}
