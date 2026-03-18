"""Device Control Routes — manage irrigation valves and pumps."""
from fastapi import APIRouter, Depends, HTTPException
from app.auth import get_current_user, _extract_farm_id
from app.schemas.device_control import (
    ZoneControlRequest, DeviceCommandCreate, ManualOverrideRequest,
    DeviceCommandResponse, FarmControlStates, CommandHistoryResponse,
)
from app.services import device_control_service
from app.logging_config import logger

router = APIRouter(prefix="/api/control", tags=["Device Control"])


@router.post("/zone/{zone_id}", response_model=DeviceCommandResponse)
async def control_zone(zone_id: str, request: ZoneControlRequest, user=Depends(get_current_user)):
    """Start or stop irrigation for a zone."""
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm")

    action = "start" if request.action == "start_irrigation" else "stop"
    try:
        result = await device_control_service.control_zone(
            farm_id, zone_id, action, user["id"], "manual", request.duration_minutes
        )
        return result
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        logger.error(f"Control zone error: {e}")
        raise HTTPException(500, f"Failed to control zone: {e}")


@router.post("/device/{device_id}", response_model=DeviceCommandResponse)
async def control_device(device_id: str, request: DeviceCommandCreate, user=Depends(get_current_user)):
    """Send a command to a specific device."""
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm")

    try:
        result = await device_control_service.control_device(
            farm_id, device_id, request.command_type, user["id"], "manual", request.parameters or {}
        )
        return result
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        logger.error(f"Control device error: {e}")
        raise HTTPException(500, f"Failed to control device: {e}")


@router.post("/zone/{zone_id}/override")
async def set_override(zone_id: str, request: ManualOverrideRequest, user=Depends(get_current_user)):
    """Enable/disable manual control mode for a zone."""
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm")

    try:
        return await device_control_service.set_manual_override(farm_id, zone_id, request.enabled, user["id"])
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.get("/states", response_model=FarmControlStates)
async def get_states(user=Depends(get_current_user)):
    """Get current control states for all zones."""
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm")

    return await device_control_service.get_control_states(farm_id)


@router.get("/history", response_model=CommandHistoryResponse)
async def get_history(limit: int = 50, offset: int = 0, user=Depends(get_current_user)):
    """Get command history for the farm."""
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm")

    return await device_control_service.get_command_history(farm_id, limit, offset)
