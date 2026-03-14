"""
Supabase-based Authentication module
Replaces manual JWT handling with Supabase Auth
Enhanced with role and farm context for multi-role model
"""
from typing import Optional, List
from uuid import UUID
from fastapi import Depends, HTTPException, status, Request, Header
from app.supabase_client import get_supabase, get_supabase_admin
from app.logging_config import logger


async def get_current_user(request: Request) -> dict:
    """
    Extract and verify the Supabase JWT from the Authorization header.
    Returns the authenticated user object with role and farm context.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = auth_header.split(" ")[1]

    try:
        supabase = get_supabase()
        user_response = supabase.auth.get_user(token)
        if user_response is None or user_response.user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )

        user_id = user_response.user.id

        # Fetch user profile to get role
        profile_response = get_supabase_admin().from_("user_profiles").select("*").eq("id", user_id).execute()
        profile = profile_response.data[0] if profile_response.data else {"role": "farm_employee", "full_name": None}

        # Get farms owned by user
        owned_farms_response = get_supabase_admin().from_("farms").select("id").eq("owner_id", user_id).execute()
        owned_farm_ids = [farm["id"] for farm in owned_farms_response.data] if owned_farms_response.data else []

        # Get farms where user is a member
        membership_response = get_supabase_admin().from_("farm_memberships").select("farm_id").eq("user_id", user_id).eq("is_active", True).execute()
        member_farm_ids = [m["farm_id"] for m in membership_response.data] if membership_response.data else []

        # Combine all farm IDs (owned + member)
        all_farm_ids = list(set(owned_farm_ids + member_farm_ids))

        # Determine active farm
        x_farm_id = request.headers.get("X-Farm-ID")
        active_farm_id = None
        if x_farm_id and x_farm_id in all_farm_ids:
            active_farm_id = x_farm_id
        elif all_farm_ids:
            active_farm_id = all_farm_ids[0]

        return {
            "id": user_id,
            "email": user_response.user.email,
            "role": profile.get("role", "farm_employee"),
            "full_name": profile.get("full_name"),
            "user_metadata": user_response.user.user_metadata,
            "farm_ids": all_farm_ids,
            "owned_farm_ids": owned_farm_ids,
            "active_farm_id": active_farm_id,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Auth error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )


def get_current_farm_id(request: Request, current_user: dict = Depends(get_current_user)) -> str:
    """
    Resolve the farm_id from the request.
    Uses the already-validated active_farm_id from get_current_user (which checked
    the X-Farm-ID header against the user's farm list). Falls back to first farm.
    """
    if current_user.get("active_farm_id"):
        return current_user["active_farm_id"]

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="No farm selected. Provide X-Farm-ID header or join/create a farm.",
    )


def _extract_farm_id(user: dict) -> Optional[str]:
    """Extract active farm_id from user context dict (for use inside route handlers)."""
    return user.get("active_farm_id") or (user.get("farm_ids") or [None])[0]


def require_farm_owner(current_user: dict = Depends(get_current_user)) -> dict:
    """
    Dependency that requires the current user to be a farm owner.
    """
    if current_user.get("role") != "farm_owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This action requires farm owner privileges",
        )
    return current_user


def require_farm_access(farm_id: str, current_user: dict = Depends(get_current_user)) -> dict:
    """
    Dependency that checks if the user has access to the specified farm.
    """
    if farm_id not in current_user.get("farm_ids", []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this farm",
        )
    return current_user


class OptionalFarm:
    """
    Dependency that optionally gets the farm_id from header.
    Returns None if no farm is specified.
    """
    def __init__(self, required: bool = False):
        self.required = required
    
    def __call__(self, request: Request, current_user: dict = Depends(get_current_user)) -> Optional[str]:
        x_farm_id = request.headers.get("X-Farm-ID")
        
        if x_farm_id:
            if x_farm_id not in current_user.get("farm_ids", []):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You don't have access to this farm",
                )
            return x_farm_id
        
        if self.required:
            if not current_user.get("active_farm_id"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No farm selected. Provide X-Farm-ID header or join/create a farm.",
                )
            return current_user["active_farm_id"]
        
        return current_user.get("active_farm_id")
