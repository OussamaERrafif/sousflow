"""
Farm Routes - CRUD for farms and membership management
/api/farms, /api/farms/{farm_id}/members
"""
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from app.auth import get_current_user, require_farm_owner, require_farm_access
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
    # Users with farm_employee role cannot create farms
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


# Membership endpoints
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
