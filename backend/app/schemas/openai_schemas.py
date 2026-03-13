"""
OpenAI integration schemas
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class ChatRequest(BaseModel):
    """Chat request with IoT context awareness"""
    message: str = Field(..., min_length=1, max_length=4096)
    include_iot_context: bool = Field(default=True, description="Whether to include recent IoT data in AI context")
    sensor_types: Optional[List[str]] = Field(default=None, description="Specific sensor types to include as context")
    device_id: Optional[str] = None
    conversation_id: Optional[str] = None


class ChatMessage(BaseModel):
    """Single chat message"""
    role: str  # "user", "assistant", "system"
    content: str


class ChatResponse(BaseModel):
    """AI chat response"""
    response: str
    conversation_id: str
    context_used: Optional[Dict[str, Any]] = None
    tokens_used: Optional[int] = None


class AnalysisRequest(BaseModel):
    """Request AI analysis of IoT data"""
    analysis_type: str = Field(..., description="e.g. 'soil_health', 'irrigation_advice', 'crop_disease', 'general'")
    device_id: Optional[str] = None
    sensor_types: Optional[List[str]] = None
    time_range_hours: int = Field(default=24)
    custom_prompt: Optional[str] = None


class AnalysisResponse(BaseModel):
    """AI analysis result"""
    analysis_type: str
    summary: str
    insights: List[str]
    recommendations: List[str]
    risk_level: Optional[str] = None  # "low", "medium", "high", "critical"
    data_snapshot: Optional[Dict[str, Any]] = None


class SmartAlertRequest(BaseModel):
    """Generate a smart alert via AI"""
    sensor_type: str
    current_value: float
    historical_context: Optional[Dict[str, Any]] = None
    severity: Optional[str] = None
