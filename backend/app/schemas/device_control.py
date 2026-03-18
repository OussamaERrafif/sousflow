"""Device control schemas for irrigation valve and pump management."""
from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime


class ZoneControlRequest(BaseModel):
    """Control irrigation for an entire zone"""
    action: Literal["start_irrigation", "stop_irrigation"]
    duration_minutes: Optional[int] = None  # auto-stop after N minutes (None = indefinite)


class DeviceCommandCreate(BaseModel):
    """Generic device command"""
    command_type: Literal["valve_open", "valve_close", "pump_start", "pump_stop"]
    parameters: Optional[dict] = {}


class ManualOverrideRequest(BaseModel):
    """Enable/disable manual override for a zone"""
    enabled: bool  # True = manual mode (no auto-irrigation), False = back to auto


class DeviceCommandResponse(BaseModel):
    id: str
    farm_id: str
    zone_id: Optional[str] = None
    device_id: Optional[str] = None
    command_type: str
    target_type: str
    status: str
    source: str
    created_at: datetime
    executed_at: Optional[datetime] = None
    result: dict = {}


class ZoneControlState(BaseModel):
    """Current control state for a zone"""
    zone_id: str
    zone_number: int
    zone_name: str
    valve_open: bool
    mode: Literal["auto", "manual"]  # auto = simulator decides, manual = user decides
    irrigation_active: bool


class FarmControlStates(BaseModel):
    """All control states for a farm"""
    zones: list[ZoneControlState]
    pump_active: bool
    reservoir_level_pct: float
    filter_status: int


class CommandHistoryResponse(BaseModel):
    commands: list[DeviceCommandResponse]
    total: int
