"""
WhatsApp / Wassender API schemas
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class SendMessageRequest(BaseModel):
    """Send a WhatsApp message"""
    phone: str = Field(..., description="Recipient phone number with country code, e.g. +212612345678")
    message: str = Field(..., min_length=1, max_length=4096)


class SendTemplateMessageRequest(BaseModel):
    """Send a WhatsApp template message"""
    phone: str
    template_name: str
    template_params: Optional[dict] = None


class WhatsAppMessage(BaseModel):
    """WhatsApp message model"""
    id: Optional[str] = None
    phone: str
    message: str
    direction: str = "outbound"  # inbound / outbound
    status: Optional[str] = None
    timestamp: Optional[datetime] = None
    metadata: Optional[dict] = None


class WhatsAppMessageResponse(BaseModel):
    """Response after sending a message"""
    success: bool
    message_id: Optional[str] = None
    status: str
    detail: Optional[str] = None


class WhatsAppMessagesListResponse(BaseModel):
    """Paginated list of messages"""
    messages: List[WhatsAppMessage]
    total: int
    page: int
    page_size: int


class WhatsAppAlert(BaseModel):
    """Alert to send via WhatsApp"""
    phone: str
    alert_type: str  # e.g. "high_temperature", "low_humidity", "prediction_warning"
    sensor_id: Optional[str] = None
    value: Optional[float] = None
    threshold: Optional[float] = None
    message: Optional[str] = None
