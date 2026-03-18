"""
Zone Routes - CRUD for zones and branches
/api/zones, /api/zones/{zone_id}/branches
"""
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from app.auth import get_current_user, require_farm_owner
from app.services.zone_service import get_zone_service, ZoneService
from app.services.farm_service import get_farm_service, FarmService
from app.schemas.zone import (
    ZoneCreate,
    ZoneUpdate,
    ZoneResponse,
    ZoneListResponse,
    ZoneWithBranches,
    BranchCreate,
    BranchUpdate,
    BranchResponse,
    BranchListResponse,
)
from app.logging_config import logger

router = APIRouter(prefix="/api/zones", tags=["zones"])


@router.get("", response_model=ZoneListResponse)
async def list_zones(
    farm_id: str,
    current_user: dict = Depends(get_current_user),
    zone_service: ZoneService = Depends(get_zone_service),
):
    """List all zones for a farm"""
    farm_service = get_farm_service()
    farm = farm_service.get_farm(farm_id, current_user["id"])
    if not farm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm not found or access denied",
        )

    zones = zone_service.list_zones(farm_id)
    return {"zones": zones, "total": len(zones)}


@router.get("/all-with-branches", response_model=List[ZoneWithBranches])
async def get_all_zones_with_branches(
    farm_id: str,
    current_user: dict = Depends(get_current_user),
    zone_service: ZoneService = Depends(get_zone_service),
):
    """Get all zones with their branches (for hierarchical view)"""
    farm_service = get_farm_service()
    farm = farm_service.get_farm(farm_id, current_user["id"])
    if not farm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm not found or access denied",
        )

    return zone_service.get_all_zones_with_branches(farm_id)


@router.get("/{zone_id}", response_model=ZoneWithBranches)
async def get_zone(
    farm_id: str,
    zone_id: str,
    current_user: dict = Depends(get_current_user),
    zone_service: ZoneService = Depends(get_zone_service),
):
    """Get a zone with its branches"""
    farm_service = get_farm_service()
    farm = farm_service.get_farm(farm_id, current_user["id"])
    if not farm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm not found or access denied",
        )

    zone = zone_service.get_zone_with_branches(farm_id, zone_id)
    if not zone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Zone not found",
        )
    return zone


@router.post("", response_model=ZoneResponse, status_code=status.HTTP_201_CREATED)
async def create_zone(
    farm_id: str,
    zone_data: ZoneCreate,
    current_user: dict = Depends(require_farm_owner),
    zone_service: ZoneService = Depends(get_zone_service),
):
    """Create a new zone"""
    farm_service = get_farm_service()
    farm = farm_service.get_farm(farm_id, current_user["id"])
    if not farm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm not found or access denied",
        )

    zone = zone_service.create_zone(
        farm_id=farm_id,
        zone_number=zone_data.zone_number,
        name=zone_data.name,
        description=zone_data.description,
        area_hectares=zone_data.area_hectares,
        plant_type=zone_data.plant_type,
        plant_species=zone_data.plant_species,
    )
    return zone


@router.put("/{zone_id}", response_model=ZoneResponse)
async def update_zone(
    farm_id: str,
    zone_id: str,
    zone_data: ZoneUpdate,
    current_user: dict = Depends(require_farm_owner),
    zone_service: ZoneService = Depends(get_zone_service),
):
    """Update a zone"""
    updates = zone_data.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid fields to update",
        )

    zone = zone_service.update_zone(farm_id, zone_id, **updates)
    if not zone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Zone not found",
        )
    return zone


@router.delete("/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_zone(
    farm_id: str,
    zone_id: str,
    current_user: dict = Depends(require_farm_owner),
    zone_service: ZoneService = Depends(get_zone_service),
):
    """Delete a zone (soft delete)"""
    try:
        zone_service.delete_zone(farm_id, zone_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Zone not found: {str(e)}",
        )


@router.get("/{zone_id}/branches", response_model=BranchListResponse)
async def list_branches(
    farm_id: str,
    zone_id: str,
    current_user: dict = Depends(get_current_user),
    zone_service: ZoneService = Depends(get_zone_service),
):
    """List all branches for a zone"""
    farm_service = get_farm_service()
    farm = farm_service.get_farm(farm_id, current_user["id"])
    if not farm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm not found or access denied",
        )

    zone = zone_service.get_zone(farm_id, zone_id)
    if not zone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Zone not found",
        )

    branches = zone_service.list_branches(farm_id, zone_id)
    return {"branches": branches, "total": len(branches)}


@router.post("/{zone_id}/branches", response_model=BranchResponse, status_code=status.HTTP_201_CREATED)
async def create_branch(
    farm_id: str,
    zone_id: str,
    branch_data: BranchCreate,
    current_user: dict = Depends(require_farm_owner),
    zone_service: ZoneService = Depends(get_zone_service),
):
    """Create a new branch within a zone"""
    farm_service = get_farm_service()
    farm = farm_service.get_farm(farm_id, current_user["id"])
    if not farm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm not found or access denied",
        )

    try:
        branch = zone_service.create_branch(
            farm_id=farm_id,
            zone_id=zone_id,
            branch_number=branch_data.branch_number,
            name=branch_data.name,
            length_meters=branch_data.length_meters,
            emitter_count=branch_data.emitter_count,
            emitter_flow_lph=branch_data.emitter_flow_lph,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create branch: {str(e)}",
        )

    return branch


@router.put("/{zone_id}/branches/{branch_id}", response_model=BranchResponse)
async def update_branch(
    farm_id: str,
    zone_id: str,
    branch_id: str,
    branch_data: BranchUpdate,
    current_user: dict = Depends(require_farm_owner),
    zone_service: ZoneService = Depends(get_zone_service),
):
    """Update a branch"""
    updates = branch_data.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid fields to update",
        )

    try:
        branch = zone_service.update_branch(farm_id, branch_id, **updates)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to update branch: {str(e)}",
        )

    return branch


@router.delete("/{zone_id}/branches/{branch_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_branch(
    farm_id: str,
    zone_id: str,
    branch_id: str,
    current_user: dict = Depends(require_farm_owner),
    zone_service: ZoneService = Depends(get_zone_service),
):
    """Delete a branch (soft delete)"""
    try:
        zone_service.delete_branch(farm_id, branch_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
