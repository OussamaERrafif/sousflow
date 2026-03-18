"""
Admin Routes — Superadmin management (create farm owners + farms, list owners)
/api/admin
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from app.auth import require_superadmin, hash_password
from app.supabase_client import get_supabase_admin
from app.schemas.auth import (
    CreateOwnerRequest,
    OwnerWithFarmResponse,
    UserResponse,
)
from app.logging_config import logger, debug, debug_service_call

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.post("/owners", response_model=OwnerWithFarmResponse, status_code=status.HTTP_201_CREATED)
async def create_owner_with_farm(
    request: CreateOwnerRequest,
    current_user: dict = Depends(require_superadmin),
):
    """Create a new farm owner and their farm (superadmin only)"""
    debug(f"[Admin Routes] Creating owner: username={request.username}, farm={request.farm_name}")
    admin = get_supabase_admin()

    # Check username uniqueness
    existing = admin.from_("users").select("id").eq("username", request.username).execute()
    if existing.data:
        debug(f"[Admin Routes] Username already exists: {request.username}")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")

    # Create user
    user_data = {
        "username": request.username,
        "password_hash": hash_password(request.password),
        "role": "farm_owner",
        "full_name": request.full_name,
        "phone": request.phone,
    }
    user_resp = admin.from_("users").insert(user_data).execute()
    if not user_resp.data:
        debug(f"[Admin Routes] Failed to create user: {request.username}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create user")

    user = user_resp.data[0]
    debug(f"[Admin Routes] User created: id={user['id']}")

    # Create farm
    farm_data = {
        "owner_id": user["id"],
        "name": request.farm_name,
        "location": request.farm_location,
        "total_zones": request.farm_total_zones,
        "description": request.farm_description,
    }
    farm_resp = admin.from_("farms").insert(farm_data).execute()
    if not farm_resp.data:
        # Rollback user creation
        admin.from_("users").delete().eq("id", user["id"]).execute()
        debug(f"[Admin Routes] Failed to create farm for user: {user['id']}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create farm")

    farm = farm_resp.data[0]
    debug(f"[Admin Routes] Farm created: id={farm['id']}")

    # Auto-create zones and branches for the farm
    total_zones = request.farm_total_zones or 4
    branches_per_zone = 3
    for zone_num in range(1, total_zones + 1):
        zone_data = {
            "farm_id": farm["id"],
            "zone_number": zone_num,
            "name": f"Zone {zone_num}",
            "plant_type": "olive",
            "plant_species": "Olea europaea",
        }
        try:
            zone_resp = admin.from_("zones").insert(zone_data).execute()
            if zone_resp.data:
                zone_id = zone_resp.data[0]["id"]
                # Create branches for each zone
                for branch_num in range(1, branches_per_zone + 1):
                    branch_data = {
                        "zone_id": zone_id,
                        "branch_number": branch_num,
                        "name": f"Zone {zone_num} - Branch {branch_num}",
                        "emitter_flow_lph": 4.0,
                    }
                    try:
                        admin.from_("branches").insert(branch_data).execute()
                    except Exception as e:
                        logger.warning(f"Failed to create branch {branch_num} for zone {zone_id}: {e}")
        except Exception as e:
            logger.warning(f"Failed to create zone {zone_num} for farm {farm['id']}: {e}")

    logger.info(f"Superadmin created owner '{request.username}' with farm '{request.farm_name}' ({total_zones} zones, {branches_per_zone} branches each)")
    debug(f"[Admin Routes] Owner creation complete: username={request.username}, farm={request.farm_name}, zones={total_zones}")
    return {
        "user": {
            "id": user["id"],
            "username": user["username"],
            "role": user["role"],
            "full_name": user.get("full_name"),
            "phone": user.get("phone"),
            "is_active": user["is_active"],
        },
        "farm": farm,
    }


@router.get("/owners", response_model=List[UserResponse])
async def list_owners(current_user: dict = Depends(require_superadmin)):
    """List all farm owners (superadmin only)"""
    admin = get_supabase_admin()
    result = admin.from_("users").select("id, username, role, full_name, phone, is_active").eq("role", "farm_owner").execute()
    return result.data or []


@router.get("/owners/{owner_id}")
async def get_owner_detail(owner_id: str, current_user: dict = Depends(require_superadmin)):
    """Get owner detail with their farms (superadmin only)"""
    admin = get_supabase_admin()

    user_resp = admin.from_("users").select("id, username, role, full_name, phone, is_active").eq("id", owner_id).eq("role", "farm_owner").execute()
    if not user_resp.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Owner not found")

    farms_resp = admin.from_("farms").select("*").eq("owner_id", owner_id).execute()

    return {
        "user": user_resp.data[0],
        "farms": farms_resp.data or [],
    }


@router.put("/owners/{owner_id}/toggle-active")
async def toggle_owner_active(owner_id: str, current_user: dict = Depends(require_superadmin)):
    """Enable/disable a farm owner (superadmin only)"""
    admin = get_supabase_admin()

    user_resp = admin.from_("users").select("id, is_active").eq("id", owner_id).eq("role", "farm_owner").execute()
    if not user_resp.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Owner not found")

    new_status = not user_resp.data[0]["is_active"]
    admin.from_("users").update({"is_active": new_status}).eq("id", owner_id).execute()

    return {"id": owner_id, "is_active": new_status}


@router.delete("/owners/{owner_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_owner(owner_id: str, current_user: dict = Depends(require_superadmin)):
    """Delete a farm owner and all their data (superadmin only)"""
    admin = get_supabase_admin()

    user_resp = admin.from_("users").select("id").eq("id", owner_id).eq("role", "farm_owner").execute()
    if not user_resp.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Owner not found")

    # Delete farms first (CASCADE will handle memberships, readings, etc.)
    admin.from_("farms").delete().eq("owner_id", owner_id).execute()
    # Then delete the user
    admin.from_("users").delete().eq("id", owner_id).execute()

    logger.info(f"Superadmin deleted owner {owner_id}")


@router.post("/seed-devices/{farm_id}", status_code=status.HTTP_201_CREATED)
async def seed_iot_devices(
    farm_id: str,
    current_user: dict = Depends(require_superadmin),
):
    """Seed IoT devices for all branches in a farm (3 flow meters + 2 soil moisture per branch)"""
    admin = get_supabase_admin()

    farm = admin.from_("farms").select("id").eq("id", farm_id).execute()
    if not farm.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found")

    zones = admin.from_("zones").select("id").eq("farm_id", farm_id).eq("is_active", True).execute()
    if not zones.data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No zones found in farm")

    total_devices = 0
    for zone in zones.data:
        branches = admin.from_("branches").select("id,branch_number").eq("zone_id", zone["id"]).execute()
        for branch in branches.data:
            branch_number = branch["branch_number"]
            for i in range(1, 4):
                device_data = {
                    "farm_id": farm_id,
                    "zone_id": zone["id"],
                    "device_type": "flow_meter",
                    "name": f"Flow Meter {branch_number}-{i}",
                    "model": "FM-100",
                    "serial_number": f"FM{branch_number:02d}{i:02d}001",
                    "mac_address": f"00:1B:44:11:{branch_number:02X}:{i:X0}",
                    "status": "online",
                }
                admin.from_("iot_devices").insert(device_data).execute()
                total_devices += 1

            for i in range(1, 3):
                device_data = {
                    "farm_id": farm_id,
                    "zone_id": zone["id"],
                    "device_type": "moisture_sensor",
                    "name": f"Soil Moisture {branch_number}-{i}",
                    "model": "SM-200",
                    "serial_number": f"SM{branch_number:02d}{i:02d}001",
                    "mac_address": f"00:1B:44:22:{branch_number:02X}:{i:X0}",
                    "status": "online",
                }
                admin.from_("iot_devices").insert(device_data).execute()
                total_devices += 1

    logger.info(f"Superadmin seeded {total_devices} IoT devices for farm {farm_id}")
    return {"message": f"Created {total_devices} IoT devices", "count": total_devices}
