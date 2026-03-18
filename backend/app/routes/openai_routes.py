"""
OpenAI routes — AI chat with olive irrigation context
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, List
from app.auth import get_current_user, _extract_farm_id
from app.services import openai_service
from app.logging_config import logger, debug

router = APIRouter(prefix="/api/ai", tags=["AI — SoussFlow Assistant"])


# ─── Schemas ────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4096)
    conversation_id: Optional[str] = Field(None, description="Thread ID for multi-turn")


class ChatResponse(BaseModel):
    response: str
    conversation_id: str


class ChatMessage(BaseModel):
    role: str
    content: str
    created_at: Optional[str] = None


# ─── Endpoints ──────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse, summary="Chat with SoussFlow AI")
async def chat(request: ChatRequest, user=Depends(get_current_user)):
    """Chat with the olive irrigation AI — automatically enriched with live sensor data"""
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm. Please select a farm first.")
    debug(f"[OpenAI Routes] Chat request: user={user.get('username')}, farm={farm_id[:8]}, msg_len={len(request.message)}")

    conv_id = request.conversation_id
    if not conv_id:
        # Auto-create a conversation so chat_messages FK is satisfied
        from app.supabase_client import get_supabase_admin
        import uuid
        conv_id = str(uuid.uuid4())
        get_supabase_admin().table("conversations").insert({
            "id": conv_id,
            "user_id": user["id"],
            "farm_id": farm_id,
            "title": request.message[:50],
        }).execute()

    try:
        reply = await openai_service.chat(
            farm_id=farm_id,
            conversation_id=conv_id,
            user_message=request.message,
            sender_id=user["id"],
            channel="web",
            user_context=user,
        )
        return {"response": reply, "conversation_id": conv_id}
    except Exception as e:
        import traceback
        logger.error(f"AI chat error: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI service error: {type(e).__name__}: {str(e)}",
        )


@router.get("/chat/{conversation_id}", response_model=List[ChatMessage],
            summary="Get conversation history")
async def get_chat_history(
    conversation_id: str,
    user=Depends(get_current_user),
):
    """Retrieve a chat thread's message history"""
    farm_id = _extract_farm_id(user)
    if not farm_id:
        raise HTTPException(400, "No active farm. Please select a farm first.")
    return await openai_service.get_history(conversation_id)
