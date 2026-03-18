"""
Conversation Routes - CRUD for chat conversations
/api/conversations
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from app.auth import get_current_user, _extract_farm_id
from app.supabase_client import get_supabase_admin
from app.schemas.farm import (
    ConversationCreate,
    ConversationUpdate,
    ConversationResponse,
    ConversationListResponse,
    ChatMessageResponse,
)
from app.logging_config import debug

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


def _own_conversation(admin, conversation_id: str, user_id: str) -> dict:
    """Fetch a conversation and verify it belongs to the user. Returns the row or raises 404."""
    result = (
        admin.from_("conversations")
        .select("*")
        .eq("id", conversation_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return result.data[0]


@router.get("", response_model=ConversationListResponse)
async def list_conversations(
    current_user: dict = Depends(get_current_user),
    farm_id: str = Query(None, description="Filter by farm (optional)"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """List user's conversations, sorted by most recently updated."""
    debug(f"Listing conversations for user {current_user['id']}, farm_id: {farm_id}, page: {page}", "conversation_routes.list_conversations")
    admin = get_supabase_admin()
    offset = (page - 1) * limit

    query = admin.from_("conversations").select("*", count="exact").eq("user_id", current_user["id"])

    active_farm = farm_id or _extract_farm_id(current_user)
    if active_farm:
        query = query.eq("farm_id", active_farm)

    count_resp = query.execute()
    total = count_resp.count or 0

    response = (
        admin.from_("conversations")
        .select("*")
        .eq("user_id", current_user["id"])
        .order("updated_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    debug(f"Found {total} conversations", "conversation_routes.list_conversations")
    return {"conversations": response.data or [], "total": total}


@router.post("", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    conv_data: ConversationCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a new conversation (farm context is resolved from active farm)."""
    debug(f"Creating conversation for user {current_user['id']}: {conv_data.model_dump()}", "conversation_routes.create_conversation")
    admin = get_supabase_admin()
    farm_id = _extract_farm_id(current_user)

    data = {
        "user_id": current_user["id"],
        "farm_id": farm_id or str(conv_data.farm_id) if conv_data.farm_id else farm_id,
        "title": conv_data.title,
    }

    response = admin.from_("conversations").insert(data).execute()

    if response.data:
        debug(f"Conversation created: {response.data[0]}", "conversation_routes.create_conversation")
        return response.data[0]
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to create conversation")


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get conversation metadata."""
    admin = get_supabase_admin()
    return _own_conversation(admin, conversation_id, current_user["id"])


@router.put("/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    conversation_id: str,
    conv_data: ConversationUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Rename or update a conversation (owner only)."""
    admin = get_supabase_admin()
    _own_conversation(admin, conversation_id, current_user["id"])

    updates = conv_data.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No updates provided")

    response = (
        admin.from_("conversations")
        .update(updates)
        .eq("id", conversation_id)
        .eq("user_id", current_user["id"])
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    return response.data[0]


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete a conversation (cascades to messages)."""
    admin = get_supabase_admin()
    _own_conversation(admin, conversation_id, current_user["id"])
    admin.from_("conversations").delete().eq("id", conversation_id).eq("user_id", current_user["id"]).execute()


@router.get("/{conversation_id}/messages", response_model=List[ChatMessageResponse])
async def get_messages(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    """Get messages in a conversation (owner only, paginated)."""
    admin = get_supabase_admin()
    _own_conversation(admin, conversation_id, current_user["id"])

    offset = (page - 1) * limit
    response = (
        admin.from_("chat_messages")
        .select("*")
        .eq("conversation_id", conversation_id)
        .order("created_at", desc=False)
        .range(offset, offset + limit - 1)
        .execute()
    )

    return response.data or []
