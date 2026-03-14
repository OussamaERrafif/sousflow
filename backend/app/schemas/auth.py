"""
Authentication schemas
"""
from pydantic import BaseModel, Field
from typing import List, Optional


class SignInRequest(BaseModel):
    """Sign in with username and password"""
    username: str
    password: str


class AuthResponse(BaseModel):
    """Auth response with token"""
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserProfile(BaseModel):
    """Enriched user profile with role and farm context."""
    id: str
    username: str
    full_name: Optional[str] = None
    phone: Optional[str] = None
    role: str
    farm_ids: List[str] = []
    owned_farm_ids: List[str] = []
    active_farm_id: Optional[str] = None


class CreateOwnerRequest(BaseModel):
    """Superadmin creates a farm owner + farm"""
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    full_name: Optional[str] = None
    phone: Optional[str] = None
    farm_name: str = Field(..., min_length=1, max_length=255)
    farm_location: Optional[str] = None
    farm_total_zones: int = Field(default=4, ge=1, le=20)
    farm_description: Optional[str] = None


class CreateEmployeeRequest(BaseModel):
    """Farm owner creates an employee"""
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    full_name: Optional[str] = None
    phone: Optional[str] = None


class UserResponse(BaseModel):
    """Basic user info"""
    id: str
    username: str
    role: str
    full_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool


class OwnerWithFarmResponse(BaseModel):
    """Response after creating owner + farm"""
    user: UserResponse
    farm: dict


class ChangePasswordRequest(BaseModel):
    """Change password"""
    old_password: str
    new_password: str = Field(..., min_length=6)
