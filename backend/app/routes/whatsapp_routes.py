"""
WhatsApp routes — send/receive messages via Wassender API
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional
from app.auth import get_current_user
from app.services.whatsapp_service import get_whatsapp_service
from app.schemas.whatsapp import (
    SendMessageRequest,
    WhatsAppMessageResponse,
    WhatsAppMessagesListResponse,
    WhatsAppAlert,
)
from app.logging_config import logger

router = APIRouter(prefix="/api/whatsapp", tags=["WhatsApp"])


@router.post("/send", response_model=WhatsAppMessageResponse)
async def send_message(
    request: SendMessageRequest,
    current_user: dict = Depends(get_current_user),
):
    """Send a WhatsApp message"""
    service = get_whatsapp_service()
    result = await service.send_message(request.phone, request.message)
    return result


@router.get("/messages", response_model=WhatsAppMessagesListResponse)
async def get_messages(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    phone: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """Get WhatsApp message history"""
    service = get_whatsapp_service()
    result = await service.get_messages(
        page=page,
        page_size=page_size,
        phone=phone,
    )
    return result


@router.get("/status")
async def get_device_status(
    current_user: dict = Depends(get_current_user),
):
    """Check WhatsApp device connection status"""
    service = get_whatsapp_service()
    return await service.get_device_status()


@router.post("/alert", response_model=WhatsAppMessageResponse)
async def send_alert(
    alert: WhatsAppAlert,
    current_user: dict = Depends(get_current_user),
):
    """Send an automated alert via WhatsApp"""
    service = get_whatsapp_service()
    result = await service.send_alert(
        phone=alert.phone,
        alert_type=alert.alert_type,
        sensor_id=alert.sensor_id,
        value=alert.value,
        threshold=alert.threshold,
        custom_message=alert.message,
    )
    return result
