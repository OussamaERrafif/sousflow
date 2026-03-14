from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field


class PermissionsSchema(BaseModel):
    read: bool = True
    write_readings: bool = True
    manage_alerts: bool = False
    manage_employees: bool = False


class FarmBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    location: Optional[str] = None
    total_zones: int = Field(default=4, ge=1, le=20)
    description: Optional[str] = None


class FarmCreate(FarmBase):
    pass


class FarmUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    location: Optional[str] = None
    total_zones: Optional[int] = Field(None, ge=1, le=20)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class FarmResponse(FarmBase):
    id: UUID
    owner_id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FarmWithMembers(FarmResponse):
    members_count: int = 0
    owner_name: Optional[str] = None


class MemberBase(BaseModel):
    user_email: str = Field(..., description="Email of the user to invite")
    permissions: PermissionsSchema = Field(
        default_factory=PermissionsSchema,
        description="Permissions for the member"
    )


class MemberCreate(MemberBase):
    pass


class MemberUpdate(BaseModel):
    permissions: Optional[PermissionsSchema] = None
    is_active: Optional[bool] = None


class MemberResponse(BaseModel):
    id: UUID
    farm_id: UUID
    user_id: UUID
    user_email: Optional[str] = None
    user_full_name: Optional[str] = None
    permissions: PermissionsSchema
    is_active: bool
    joined_at: datetime

    class Config:
        from_attributes = True


class ConversationBase(BaseModel):
    title: str = "New Conversation"
    farm_id: Optional[UUID] = None


class ConversationCreate(ConversationBase):
    pass


class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    is_active: Optional[bool] = None


class ConversationResponse(BaseModel):
    id: UUID
    user_id: UUID
    farm_id: Optional[UUID] = None
    title: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConversationWithMessages(ConversationResponse):
    messages: List["ChatMessageResponse"] = []


class ChatMessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    sender_id: Optional[UUID] = None
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class FarmListResponse(BaseModel):
    farms: List[FarmResponse]
    total: int


class MemberListResponse(BaseModel):
    members: List[MemberResponse]
    total: int


class ConversationListResponse(BaseModel):
    conversations: List[ConversationResponse]
    total: int
