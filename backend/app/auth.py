"""
Supabase-based Authentication module
Replaces manual JWT handling with Supabase Auth
"""
from fastapi import Depends, HTTPException, status, Request
from app.supabase_client import get_supabase, get_supabase_admin
from app.logging_config import logger


async def get_current_user(request: Request) -> dict:
    """
    Extract and verify the Supabase JWT from the Authorization header.
    Returns the authenticated user object.
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
        return {
            "id": user_response.user.id,
            "email": user_response.user.email,
            "role": user_response.user.role,
            "user_metadata": user_response.user.user_metadata,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Auth error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )