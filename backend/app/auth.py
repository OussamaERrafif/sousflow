"""
Self-managed JWT Authentication module
Uses bcrypt for password hashing and python-jose for JWT tokens.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt as _bcrypt

from fastapi import Depends, HTTPException, status, Request
from jose import JWTError, jwt

from app.config import get_settings
from app.supabase_client import get_supabase_admin
from app.logging_config import logger, debug, debug_obj, debug_db_query, debug_request


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return _bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except Exception as e:
        logger.warning(f"Password verification error: {e}")
        return False


def hash_password(password: str) -> str:
    return _bcrypt.hashpw(
        password.encode("utf-8"),
        _bcrypt.gensalt(),
    ).decode("utf-8")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    settings = get_settings()
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.JWT_EXPIRATION_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    settings = get_settings()
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


async def get_current_user(request: Request) -> dict:
    """
    Extract and verify JWT from the Authorization header.
    Returns the authenticated user dict with role and farm context.
    """
    debug("=== Get Current User Start ===")
    debug_request("GET", request.url.path if request.url else "unknown")
    
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        debug("Auth failed: Missing or invalid Authorization header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = auth_header.split(" ")[1]

    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if not user_id:
            debug("Auth failed: Invalid token - no user_id")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except JWTError as e:
        debug(f"Auth failed: JWTError - {str(e)}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    try:
        admin = get_supabase_admin()

        # Fetch user from users table
        debug_db_query("SELECT", "users", user_id=user_id[:8] if user_id else None)
        user_response = admin.from_("users").select("*").eq("id", user_id).eq("is_active", True).execute()
        if not user_response.data:
            debug("Auth failed: User not found or inactive")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

        user = user_response.data[0]
        debug("Auth success", user_id=user_id[:8], role=user.get("role"))

        # Get farms owned by user
        owned_farms_response = admin.from_("farms").select("id").eq("owner_id", user_id).execute()
        owned_farm_ids = [farm["id"] for farm in owned_farms_response.data] if owned_farms_response.data else []

        # Get farms where user is a member
        membership_response = admin.from_("farm_memberships").select("farm_id").eq("user_id", user_id).eq("is_active", True).execute()
        member_farm_ids = [m["farm_id"] for m in membership_response.data] if membership_response.data else []

        # Combine all farm IDs (owned + member)
        all_farm_ids = list(set(owned_farm_ids + member_farm_ids))

        # Determine active farm from X-Farm-ID header
        x_farm_id = request.headers.get("X-Farm-ID")
        active_farm_id = None
        if x_farm_id and x_farm_id in all_farm_ids:
            active_farm_id = x_farm_id
        elif all_farm_ids:
            active_farm_id = all_farm_ids[0]

        return {
            "id": user["id"],
            "username": user["username"],
            "role": user["role"],
            "full_name": user.get("full_name"),
            "phone": user.get("phone"),
            "farm_ids": all_farm_ids,
            "owned_farm_ids": owned_farm_ids,
            "active_farm_id": active_farm_id,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Auth error: {e}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")


def get_current_farm_id(request: Request, current_user: dict = Depends(get_current_user)) -> str:
    """Resolve the farm_id from the request."""
    if current_user.get("active_farm_id"):
        return current_user["active_farm_id"]

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="No farm selected. Provide X-Farm-ID header or join/create a farm.",
    )


def _extract_farm_id(user: dict) -> Optional[str]:
    """Extract active farm_id from user context dict."""
    return user.get("active_farm_id") or (user.get("farm_ids") or [None])[0]


def require_farm_owner(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency that requires the current user to be a farm owner."""
    if current_user.get("role") != "farm_owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This action requires farm owner privileges",
        )
    return current_user


def require_superadmin(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency that requires the current user to be a superadmin."""
    if current_user.get("role") != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This action requires superadmin privileges",
        )
    return current_user


def require_farm_access(farm_id: str, current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency that checks if the user has access to the specified farm."""
    if farm_id not in current_user.get("farm_ids", []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this farm",
        )
    return current_user


class OptionalFarm:
    """Dependency that optionally gets the farm_id from header."""
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
