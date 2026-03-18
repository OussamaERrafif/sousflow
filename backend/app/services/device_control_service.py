"""
Device Control Service — manages irrigation valves and pump commands.
Uses IoT simulator in dev mode; would use MQTT/HTTP for real hardware in production.
"""
import asyncio
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.supabase_client import get_supabase_admin
from app.logging_config import logger, debug


async def control_zone(
    farm_id: str, zone_id: str, action: str,
    user_id: str, source: str = "manual",
    duration_minutes: int = None
) -> dict:
    """
    Start or stop irrigation for a zone.
    action: "start" or "stop"
    """
    supabase = get_supabase_admin()

    # Look up zone_number from zone_id UUID
    zone_result = supabase.table("zones").select("id, zone_number, name").eq(
        "id", zone_id
    ).eq("farm_id", farm_id).limit(1).execute()

    if not zone_result.data:
        raise ValueError(f"Zone {zone_id} not found in farm {farm_id}")

    zone = zone_result.data[0]
    zone_number = zone["zone_number"]

    # Get simulator instance and execute command
    from app.services.iot_simulator import get_simulator
    simulator = get_simulator()
    if simulator:
        simulator.inject_irrigation(zone_number, action)
        debug(f"[DeviceControl] Zone {zone_number} irrigation {action} via simulator")

    # Update device control_state for valve_controllers in this zone
    try:
        devices = supabase.table("iot_devices").select("id").eq(
            "farm_id", farm_id
        ).eq("zone_id", zone_id).eq("device_type", "valve_controller").execute()

        for dev in (devices.data or []):
            supabase.table("iot_devices").update({
                "control_state": {
                    "valve_open": action == "start",
                    "mode": "manual",
                }
            }).eq("id", dev["id"]).execute()
    except Exception as e:
        logger.warning(f"Failed to update device control_state: {e}")

    # Log command to device_commands table
    cmd_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    command_type = "valve_open" if action == "start" else "valve_close"

    cmd_data = {
        "id": cmd_id,
        "farm_id": farm_id,
        "zone_id": zone_id,
        "command_type": command_type,
        "target_type": "zone",
        "target_id": zone_id,
        "parameters": {"duration_minutes": duration_minutes} if duration_minutes else {},
        "source": source,
        "issued_by": user_id,
        "status": "executed",
        "result": {"previous_state": action != "start", "new_state": action == "start"},
        "executed_at": now,
    }

    try:
        supabase.table("device_commands").insert(cmd_data).execute()
    except Exception as e:
        logger.warning(f"Failed to log device command: {e}")

    # Schedule auto-stop if duration is set
    if duration_minutes and action == "start":
        asyncio.get_event_loop().call_later(
            duration_minutes * 60,
            lambda: asyncio.ensure_future(
                control_zone(farm_id, zone_id, "stop", user_id, "auto")
            )
        )

    return {
        "id": cmd_id,
        "farm_id": farm_id,
        "zone_id": zone_id,
        "device_id": None,
        "command_type": command_type,
        "target_type": "zone",
        "status": "executed",
        "source": source,
        "created_at": now,
        "executed_at": now,
        "result": {"action": action, "zone_number": zone_number},
    }


async def control_device(
    farm_id: str, device_id: str, command_type: str,
    user_id: str, source: str = "manual", parameters: dict = {}
) -> dict:
    """Control a specific device (valve or pump)."""
    supabase = get_supabase_admin()

    device = supabase.table("iot_devices").select("*").eq(
        "id", device_id
    ).eq("farm_id", farm_id).limit(1).execute()

    if not device.data:
        raise ValueError(f"Device {device_id} not found")

    dev = device.data[0]

    # For valve controllers, delegate to zone control
    if dev["device_type"] == "valve_controller" and dev.get("zone_id"):
        action = "start" if command_type == "valve_open" else "stop"
        return await control_zone(farm_id, dev["zone_id"], action, user_id, source)

    # Log command
    cmd_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    cmd_data = {
        "id": cmd_id,
        "farm_id": farm_id,
        "device_id": device_id,
        "command_type": command_type,
        "target_type": "device",
        "target_id": device_id,
        "parameters": parameters,
        "source": source,
        "issued_by": user_id,
        "status": "executed",
        "executed_at": now,
    }

    try:
        supabase.table("device_commands").insert(cmd_data).execute()
    except Exception as e:
        logger.warning(f"Failed to log device command: {e}")

    return {
        "id": cmd_id,
        "farm_id": farm_id,
        "zone_id": None,
        "device_id": device_id,
        "command_type": command_type,
        "target_type": "device",
        "status": "executed",
        "source": source,
        "created_at": now,
        "executed_at": now,
        "result": {},
    }


async def set_manual_override(
    farm_id: str, zone_id: str, enabled: bool, user_id: str
) -> dict:
    """
    Enable/disable manual override for a zone.
    When enabled, simulator's auto-irrigation is bypassed.
    """
    supabase = get_supabase_admin()

    zone_result = supabase.table("zones").select("id, zone_number, name").eq(
        "id", zone_id
    ).eq("farm_id", farm_id).limit(1).execute()

    if not zone_result.data:
        raise ValueError(f"Zone {zone_id} not found")

    zone_number = zone_result.data[0]["zone_number"]

    # Set manual override on simulator
    from app.services.iot_simulator import get_simulator
    simulator = get_simulator()
    if simulator:
        simulator.manual_override[zone_number] = enabled
        debug(f"[DeviceControl] Zone {zone_number} manual_override={enabled}")

    # Log command
    cmd_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    try:
        supabase.table("device_commands").insert({
            "id": cmd_id,
            "farm_id": farm_id,
            "zone_id": zone_id,
            "command_type": "set_override",
            "target_type": "zone",
            "target_id": zone_id,
            "parameters": {"enabled": enabled},
            "source": "manual",
            "issued_by": user_id,
            "status": "executed",
            "executed_at": now,
        }).execute()
    except Exception as e:
        logger.warning(f"Failed to log override command: {e}")

    return {
        "success": True,
        "zone_number": zone_number,
        "manual_override": enabled,
    }


async def get_control_states(farm_id: str) -> dict:
    """Get current control states for all zones in a farm."""
    supabase = get_supabase_admin()

    # Get zones
    zones_result = supabase.table("zones").select("id, zone_number, name").eq(
        "farm_id", farm_id
    ).order("zone_number").execute()
    zones = zones_result.data or []

    # Get simulator state
    from app.services.iot_simulator import get_simulator
    simulator = get_simulator()

    zone_states = []
    pump_active = False
    reservoir_level = 0.0
    filter_status = 0

    if simulator:
        pump_active = any(simulator.zone_irrig.values())
        reservoir_level = simulator.reservoir
        filter_status = simulator.filter_st

        for z in zones:
            zn = z["zone_number"]
            zone_states.append({
                "zone_id": z["id"],
                "zone_number": zn,
                "zone_name": z.get("name") or f"Zone {zn}",
                "valve_open": simulator.zone_irrig.get(zn, False),
                "mode": "manual" if simulator.manual_override.get(zn, False) else "auto",
                "irrigation_active": simulator.zone_irrig.get(zn, False),
            })
    else:
        for z in zones:
            zone_states.append({
                "zone_id": z["id"],
                "zone_number": z["zone_number"],
                "zone_name": z.get("name") or f"Zone {z['zone_number']}",
                "valve_open": False,
                "mode": "auto",
                "irrigation_active": False,
            })

    return {
        "zones": zone_states,
        "pump_active": pump_active,
        "reservoir_level_pct": round(reservoir_level, 1),
        "filter_status": filter_status,
    }


async def get_command_history(
    farm_id: str, limit: int = 50, offset: int = 0
) -> dict:
    """Query device_commands table for farm, ordered by created_at DESC."""
    supabase = get_supabase_admin()

    result = supabase.table("device_commands").select(
        "*", count="exact"
    ).eq("farm_id", farm_id).order(
        "created_at", desc=True
    ).range(offset, offset + limit - 1).execute()

    commands = result.data or []
    total = result.count or 0

    return {
        "commands": commands,
        "total": total,
    }
