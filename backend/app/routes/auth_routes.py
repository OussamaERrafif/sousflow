"""
Auth routes — Self-managed JWT auth (sign in, profile, change password)
"""
from fastapi import APIRouter, HTTPException, status, Depends
from app.supabase_client import get_supabase_admin
from app.auth import get_current_user, verify_password, hash_password, create_access_token
from app.schemas.auth import (
    SignInRequest,
    AuthResponse,
    UserProfile,
    ChangePasswordRequest,
)
from app.logging_config import logger, debug, debug_obj, debug_request, debug_response, debug_db_query

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/signin", response_model=AuthResponse)
async def sign_in(request: SignInRequest):
    """Sign in with username/password"""
    debug_request("POST", "/api/auth/signin")
    debug("Signin attempt", username=request.username)
    
    try:
        admin = get_supabase_admin()
        debug_db_query("SELECT", "users", username=request.username)
        result = admin.from_("users").select("*").eq("username", request.username).execute()

        logger.info(f"Signin attempt for username: {request.username}, found: {len(result.data) if result.data else 0} users")
        
        if not result.data:
            logger.warning(f"No user found with username: {request.username}")
            debug("Signin failed: User not found", username=request.username)
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

        user = result.data[0]
        logger.info(f"User found: {user.get('username')}, is_active: {user.get('is_active')}, role: {user.get('role')}")

        if not user.get("is_active", False):
            logger.warning(f"User {request.username} is not active")
            debug("Signin failed: User inactive", username=request.username)
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

        password_verified = verify_password(request.password, user["password_hash"])
        if not password_verified:
            debug("Signin failed: Wrong password", username=request.username)
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        
        debug("Signin success", username=request.username, role=user.get("role"))

        token = create_access_token({"sub": user["id"], "role": user["role"]})

        logger.info(f"User signed in: {request.username}")
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user["id"],
                "username": user["username"],
                "role": user["role"],
                "full_name": user.get("full_name"),
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Signin error: {e}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")


@router.get("/profile", response_model=UserProfile)
async def get_profile(current_user: dict = Depends(get_current_user)):
    """
    Get enriched current user profile.
    Returns role, accessible farms, and active farm.
    """
    return {
        "id": current_user["id"],
        "username": current_user["username"],
        "full_name": current_user.get("full_name"),
        "phone": current_user.get("phone"),
        "role": current_user.get("role"),
        "farm_ids": current_user.get("farm_ids", []),
        "owned_farm_ids": current_user.get("owned_farm_ids", []),
        "active_farm_id": current_user.get("active_farm_id"),
    }


@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
):
    """Change the current user's password"""
    admin = get_supabase_admin()

    # Fetch current password hash
    user_resp = admin.from_("users").select("password_hash").eq("id", current_user["id"]).execute()
    if not user_resp.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if not verify_password(request.old_password, user_resp.data[0]["password_hash"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

    new_hash = hash_password(request.new_password)
    admin.from_("users").update({"password_hash": new_hash}).eq("id", current_user["id"]).execute()

    logger.info(f"Password changed for user: {current_user['username']}")
    return {"message": "Password changed successfully"}


@router.post("/signout")
async def sign_out(current_user: dict = Depends(get_current_user)):
    """Sign out (client should discard the token)"""
    logger.info(f"User signed out: {current_user['username']}")
    return {"message": "Signed out successfully"}
