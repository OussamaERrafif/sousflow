"""
Farm Routes - CRUD for farms, membership management, and employee creation
/api/farms, /api/farms/{farm_id}/members, /api/farms/{farm_id}/employees
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from app.auth import get_current_user, require_farm_owner, hash_password
from app.supabase_client import get_supabase_admin
from app.services.farm_service import get_farm_service, FarmService
from app.schemas.farm import (
    FarmCreate,
    FarmUpdate,
    FarmResponse,
    FarmListResponse,
    MemberUpdate,
    MemberResponse,
    MemberListResponse,
)
from app.schemas.auth import CreateEmployeeRequest, UserResponse
from app.logging_config import logger

router = APIRouter(prefix="/api/farms", tags=["farms"])


@router.get("", response_model=FarmListResponse)
async def list_farms(
    current_user: dict = Depends(get_current_user),
    farm_service: FarmService = Depends(get_farm_service),
):
    """List all farms accessible to the current user"""
    farms = farm_service.list_farms(current_user["id"])
    return {"farms": farms, "total": len(farms)}


@router.post("", response_model=FarmResponse, status_code=status.HTTP_201_CREATED)
async def create_farm(
    farm_data: FarmCreate,
    current_user: dict = Depends(get_current_user),
    farm_service: FarmService = Depends(get_farm_service),
):
    """Create a new farm (becomes owner)"""
    if current_user.get("role") == "farm_employee":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employees cannot create farms",
        )

    farm = farm_service.create_farm(
        owner_id=current_user["id"],
        name=farm_data.name,
        location=farm_data.location,
        total_zones=farm_data.total_zones,
        description=farm_data.description,
    )
    return farm


@router.get("/{farm_id}", response_model=FarmResponse)
async def get_farm(
    farm_id: str,
    current_user: dict = Depends(get_current_user),
    farm_service: FarmService = Depends(get_farm_service),
):
    """Get farm details"""
    farm = farm_service.get_farm(farm_id, current_user["id"])
    if not farm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm not found or access denied",
        )
    return farm


@router.put("/{farm_id}", response_model=FarmResponse)
async def update_farm(
    farm_id: str,
    farm_data: FarmUpdate,
    current_user: dict = Depends(require_farm_owner),
    farm_service: FarmService = Depends(get_farm_service),
):
    """Update farm (owner only)"""
    try:
        updates = farm_data.model_dump(exclude_unset=True)
        farm = farm_service.update_farm(farm_id, current_user["id"], **updates)
        return farm
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )


@router.delete("/{farm_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_farm(
    farm_id: str,
    current_user: dict = Depends(require_farm_owner),
    farm_service: FarmService = Depends(get_farm_service),
):
    """Delete farm (owner only)"""
    try:
        farm_service.delete_farm(farm_id, current_user["id"])
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )


# ─── Employee creation ─────────────────────────────────────────

@router.post("/{farm_id}/employees", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    farm_id: str,
    request: CreateEmployeeRequest,
    current_user: dict = Depends(require_farm_owner),
):
    """Create an employee user and add them to this farm (owner only)"""
    # Verify farm ownership
    admin = get_supabase_admin()
    farm_resp = admin.from_("farms").select("owner_id").eq("id", farm_id).execute()
    if not farm_resp.data or farm_resp.data[0]["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this farm")

    # Check username uniqueness
    existing = admin.from_("users").select("id").eq("username", request.username).execute()
    if existing.data:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")

    # Create employee user
    user_data = {
        "username": request.username,
        "password_hash": hash_password(request.password),
        "role": "farm_employee",
        "full_name": request.full_name,
        "phone": request.phone,
    }
    user_resp = admin.from_("users").insert(user_data).execute()
    if not user_resp.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create employee")

    user = user_resp.data[0]

    # Add membership
    membership_data = {
        "farm_id": farm_id,
        "user_id": user["id"],
        "invited_by": current_user["id"],
        "permissions": {"read": True, "write_readings": True, "manage_alerts": False, "manage_employees": False},
    }
    admin.from_("farm_memberships").insert(membership_data).execute()

    logger.info(f"Owner '{current_user['username']}' created employee '{request.username}' for farm {farm_id}")
    return {
        "id": user["id"],
        "username": user["username"],
        "role": user["role"],
        "full_name": user.get("full_name"),
        "phone": user.get("phone"),
        "is_active": user["is_active"],
    }


@router.get("/{farm_id}/employees", response_model=List[UserResponse])
async def list_employees(
    farm_id: str,
    current_user: dict = Depends(require_farm_owner),
):
    """List employees of a farm (owner only)"""
    admin = get_supabase_admin()

    # Verify farm ownership
    farm_resp = admin.from_("farms").select("owner_id").eq("id", farm_id).execute()
    if not farm_resp.data or farm_resp.data[0]["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this farm")

    memberships = admin.from_("farm_memberships").select("user_id").eq("farm_id", farm_id).eq("is_active", True).execute()
    if not memberships.data:
        return []

    user_ids = [m["user_id"] for m in memberships.data]
    users_resp = admin.from_("users").select("id, username, role, full_name, phone, is_active").in_("id", user_ids).execute()
    return users_resp.data or []


# ─── Membership endpoints ─────────────────────────────────────

@router.get("/{farm_id}/members", response_model=MemberListResponse)
async def list_members(
    farm_id: str,
    current_user: dict = Depends(require_farm_owner),
    farm_service: FarmService = Depends(get_farm_service),
):
    """List farm members (owner only)"""
    try:
        members = farm_service.list_members(farm_id, current_user["id"])
        return {"members": members, "total": len(members)}
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )


@router.post("/{farm_id}/members/{user_id}", response_model=MemberResponse)
async def add_member_by_id(
    farm_id: str,
    user_id: str,
    current_user: dict = Depends(require_farm_owner),
    farm_service: FarmService = Depends(get_farm_service),
):
    """Add a member by user ID (owner only)"""
    try:
        member = farm_service.add_member_by_id(
            farm_id=farm_id,
            owner_id=current_user["id"],
            user_id=user_id,
            invited_by=current_user["id"],
            permissions={"read": True, "write_readings": True},
        )
        return member
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.put("/{farm_id}/members/{user_id}", response_model=MemberResponse)
async def update_member(
    farm_id: str,
    user_id: str,
    member_data: MemberUpdate,
    current_user: dict = Depends(require_farm_owner),
    farm_service: FarmService = Depends(get_farm_service),
):
    """Update member permissions (owner only)"""
    try:
        updates = member_data.model_dump(exclude_unset=True)
        member = farm_service.update_member(farm_id, current_user["id"], user_id, **updates)
        return member
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )


@router.delete("/{farm_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    farm_id: str,
    user_id: str,
    current_user: dict = Depends(require_farm_owner),
    farm_service: FarmService = Depends(get_farm_service),
):
    """Remove member from farm (owner only)"""
    try:
        farm_service.remove_member(farm_id, current_user["id"], user_id)
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )
