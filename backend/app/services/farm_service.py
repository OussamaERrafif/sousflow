"""
Farm Service - Business logic for farm CRUD and membership management
"""
from typing import List, Optional
from uuid import UUID
from app.supabase_client import get_supabase_admin
from app.logging_config import logger


class FarmService:
    def __init__(self):
        self.supabase = get_supabase_admin()

    def list_farms(self, user_id: str) -> List[dict]:
        """List all farms accessible to a user (owned + member)"""
        # Get owned farms
        owned = self.supabase.from_("farms").select("*").eq("owner_id", user_id).execute()
        
        # Get farms where user is a member
        memberships = self.supabase.from_("farm_memberships").select("farm_id").eq("user_id", user_id).eq("is_active", True).execute()
        member_farm_ids = [m["farm_id"] for m in memberships.data] if memberships.data else []
        
        member_farms = []
        if member_farm_ids:
            member = self.supabase.from_("farms").select("*").in_("id", member_farm_ids).execute()
            member_farms = member.data if member.data else []
        
        return (owned.data or []) + member_farms

    def get_farm(self, farm_id: str, user_id: str) -> Optional[dict]:
        """Get a single farm if user has access"""
        farms = self.list_farms(user_id)
        for farm in farms:
            if str(farm["id"]) == str(farm_id):
                return farm
        return None

    def create_farm(self, owner_id: str, name: str, location: str = None, total_zones: int = 4, description: str = None) -> dict:
        """Create a new farm (user becomes owner)"""
        data = {
            "owner_id": owner_id,
            "name": name,
            "total_zones": total_zones,
        }
        if location:
            data["location"] = location
        if description:
            data["description"] = description
            
        response = self.supabase.from_("farms").insert(data).execute()
        
        if response.data:
            return response.data[0]
        raise Exception("Failed to create farm")

    def update_farm(self, farm_id: str, owner_id: str, **updates) -> dict:
        """Update a farm (owner only)"""
        # Verify ownership
        farm = self.supabase.from_("farms").select("owner_id").eq("id", farm_id).execute()
        if not farm.data or farm.data[0]["owner_id"] != owner_id:
            raise PermissionError("Not authorized to update this farm")
        
        if "owner_id" in updates:
            del updates["owner_id"]
            
        response = self.supabase.from_("farms").update(updates).eq("id", farm_id).execute()
        
        if response.data:
            return response.data[0]
        raise Exception("Failed to update farm")

    def delete_farm(self, farm_id: str, owner_id: str) -> bool:
        """Delete a farm (owner only)"""
        # Verify ownership
        farm = self.supabase.from_("farms").select("owner_id").eq("id", farm_id).execute()
        if not farm.data or farm.data[0]["owner_id"] != owner_id:
            raise PermissionError("Not authorized to delete this farm")
        
        self.supabase.from_("farms").delete().eq("id", farm_id).execute()
        return True

    def list_members(self, farm_id: str, owner_id: str) -> List[dict]:
        """List members of a farm (owner only)"""
        # Verify ownership
        farm = self.supabase.from_("farms").select("owner_id").eq("id", farm_id).execute()
        if not farm.data or farm.data[0]["owner_id"] != owner_id:
            raise PermissionError("Not authorized to view members")
        
        # Get memberships with user details
        memberships = self.supabase.from_("farm_memberships").select("*").eq("farm_id", farm_id).execute()
        
        if not memberships.data:
            return []
        
        # Batch-fetch user profiles for all members in one query
        member_ids = [m["user_id"] for m in memberships.data]
        profiles_response = (
            self.supabase.from_("user_profiles")
            .select("id, full_name")
            .in_("id", member_ids)
            .execute()
        )
        profiles_by_id = {p["id"]: p for p in (profiles_response.data or [])}

        # Batch-fetch emails via admin API
        email_by_id = {}
        for uid in member_ids:
            try:
                auth_resp = self.supabase.auth.admin.get_user_by_id(uid)
                if auth_resp.user:
                    email_by_id[uid] = auth_resp.user.email
            except Exception:
                pass

        members = []
        for membership in memberships.data:
            uid = membership["user_id"]
            profile = profiles_by_id.get(uid, {})
            members.append({
                **membership,
                "user_email": email_by_id.get(uid, ""),
                "user_full_name": profile.get("full_name"),
            })
        
        return members

    def add_member(self, farm_id: str, owner_id: str, user_email: str, permissions: dict = None) -> dict:
        """Add a member to a farm (owner only)"""
        # Verify ownership
        farm = self.supabase.from_("farms").select("owner_id").eq("id", farm_id).execute()
        if not farm.data or farm.data[0]["owner_id"] != owner_id:
            raise PermissionError("Not authorized to add members")
        
        # Find user by email
        # Note: This requires a direct auth lookup - we'll use a workaround
        # In production, you'd use admin API or a users table with email index
        
        # For now, we'll create the membership and rely on the user signing up
        # The actual user_id resolution happens when they accept the invite
        
        raise NotImplementedError("Email-based invites require additional setup. Use user_id directly.")

    def add_member_by_id(self, farm_id: str, owner_id: str, user_id: str, invited_by: str, permissions: dict = None) -> dict:
        """Add a member by user ID (owner only)"""
        # Verify ownership
        farm = self.supabase.from_("farms").select("owner_id").eq("id", farm_id).execute()
        if not farm.data or farm.data[0]["owner_id"] != owner_id:
            raise PermissionError("Not authorized to add members")
        
        # Check if already a member
        existing = self.supabase.from_("farm_memberships").select("*").eq("farm_id", farm_id).eq("user_id", user_id).execute()
        if existing.data:
            raise ValueError("User is already a member of this farm")
        
        data = {
            "farm_id": farm_id,
            "user_id": user_id,
            "invited_by": invited_by,
            "permissions": permissions or {"read": True, "write_readings": True},
        }
        
        response = self.supabase.from_("farm_memberships").insert(data).execute()
        
        if response.data:
            return response.data[0]
        raise Exception("Failed to add member")

    def update_member(self, farm_id: str, owner_id: str, user_id: str, **updates) -> dict:
        """Update member permissions (owner only)"""
        # Verify ownership
        farm = self.supabase.from_("farms").select("owner_id").eq("id", farm_id).execute()
        if not farm.data or farm.data[0]["owner_id"] != owner_id:
            raise PermissionError("Not authorized to update members")
        
        if "permissions" in updates:
            updates["permissions"] = updates["permissions"]
            
        response = self.supabase.from_("farm_memberships").update(updates).eq("farm_id", farm_id).eq("user_id", user_id).execute()
        
        if response.data:
            return response.data[0]
        raise Exception("Failed to update member")

    def remove_member(self, farm_id: str, owner_id: str, user_id: str) -> bool:
        """Remove a member from a farm (owner only)"""
        # Verify ownership
        farm = self.supabase.from_("farms").select("owner_id").eq("id", farm_id).execute()
        if not farm.data or farm.data[0]["owner_id"] != owner_id:
            raise PermissionError("Not authorized to remove members")
        
        self.supabase.from_("farm_memberships").delete().eq("farm_id", farm_id).eq("user_id", user_id).execute()
        return True


def get_farm_service() -> FarmService:
    return FarmService()
