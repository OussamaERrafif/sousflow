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
from app.logging_config import logger

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.post("/owners", response_model=OwnerWithFarmResponse, status_code=status.HTTP_201_CREATED)
async def create_owner_with_farm(
    request: CreateOwnerRequest,
    current_user: dict = Depends(require_superadmin),
):
    """Create a new farm owner and their farm (superadmin only)"""
    admin = get_supabase_admin()

    # Check username uniqueness
    existing = admin.from_("users").select("id").eq("username", request.username).execute()
    if existing.data:
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
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create user")

    user = user_resp.data[0]

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
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create farm")

    farm = farm_resp.data[0]

    logger.info(f"Superadmin created owner '{request.username}' with farm '{request.farm_name}'")
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
