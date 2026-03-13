"""
Auth routes — Supabase Auth (sign up, sign in, refresh, profile)
"""
from fastapi import APIRouter, HTTPException, status, Depends
from app.supabase_client import get_supabase
from app.auth import get_current_user
from app.schemas.auth import (
    SignUpRequest,
    SignInRequest,
    AuthResponse,
    RefreshTokenRequest,
    UserProfile,
)
from app.logging_config import logger

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/signup", response_model=AuthResponse)
async def sign_up(request: SignUpRequest):
    """Register a new user with Supabase Auth"""
    try:
        supabase = get_supabase()
        result = supabase.auth.sign_up({
            "email": request.email,
            "password": request.password,
            "options": {
                "data": {
                    "full_name": request.full_name,
                    "phone": request.phone,
                },
            },
        })

        if result.user is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create account",
            )

        logger.info(f"New user signup: {request.email}")

        return {
            "access_token": result.session.access_token if result.session else "",
            "refresh_token": result.session.refresh_token if result.session else "",
            "token_type": "bearer",
            "user": {
                "id": result.user.id,
                "email": result.user.email,
                "role": result.user.role,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Signup error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/signin", response_model=AuthResponse)
async def sign_in(request: SignInRequest):
    """Sign in with email/password"""
    try:
        supabase = get_supabase()
        result = supabase.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password,
        })

        if result.user is None or result.session is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        logger.info(f"User signed in: {request.email}")

        return {
            "access_token": result.session.access_token,
            "refresh_token": result.session.refresh_token,
            "token_type": "bearer",
            "user": {
                "id": result.user.id,
                "email": result.user.email,
                "role": result.user.role,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Signin error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )


@router.post("/refresh", response_model=AuthResponse)
async def refresh_token(request: RefreshTokenRequest):
    """Refresh an expired access token"""
    try:
        supabase = get_supabase()
        result = supabase.auth.refresh_session(request.refresh_token)

        if result.session is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )

        return {
            "access_token": result.session.access_token,
            "refresh_token": result.session.refresh_token,
            "token_type": "bearer",
            "user": {
                "id": result.user.id,
                "email": result.user.email,
                "role": result.user.role,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token refresh error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not refresh token",
        )


@router.get("/profile", response_model=UserProfile)
async def get_profile(current_user: dict = Depends(get_current_user)):
    """Get current user profile"""
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "full_name": current_user.get("user_metadata", {}).get("full_name"),
        "phone": current_user.get("user_metadata", {}).get("phone"),
        "role": current_user.get("role"),
    }


@router.post("/signout")
async def sign_out(current_user: dict = Depends(get_current_user)):
    """Sign out the current user"""
    logger.info(f"User signed out: {current_user['email']}")
    return {"message": "Signed out successfully"}
