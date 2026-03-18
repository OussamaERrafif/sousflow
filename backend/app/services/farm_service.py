"""
Farm Service - Business logic for farm CRUD and membership management
"""
from typing import List, Optional
from app.supabase_client import get_supabase_admin
from app.logging_config import logger
from app.services.zone_service import ZoneService


class FarmService:
    def __init__(self):
        self.supabase = get_supabase_admin()

    def list_farms(self, user_id: str) -> List[dict]:
        """List all farms accessible to a user (owned + member)"""
        owned = self.supabase.from_("farms").select("*").eq("owner_id", user_id).execute()

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

    def create_farm(self, owner_id: str, name: str, location: str = None, total_zones: int = 4, branches_per_zone: int = 5, description: str = None) -> dict:
        """Create a new farm with zones and branches (user becomes owner)"""
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

        if not response.data:
            raise Exception("Failed to create farm")

        farm = response.data[0]
        farm_id = farm["id"]

        zone_service = ZoneService()
        zones = zone_service.create_default_zones_and_branches(farm_id, total_zones, branches_per_zone)
        logger.info(f"Created farm '{name}' with {total_zones} zones and {branches_per_zone} branches each")

        farm["zones"] = zones
        return farm

    def update_farm(self, farm_id: str, owner_id: str, **updates) -> dict:
        """Update a farm (owner only)"""
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
        farm = self.supabase.from_("farms").select("owner_id").eq("id", farm_id).execute()
        if not farm.data or farm.data[0]["owner_id"] != owner_id:
            raise PermissionError("Not authorized to delete this farm")

        self.supabase.from_("farms").delete().eq("id", farm_id).execute()
        return True

    def list_members(self, farm_id: str, owner_id: str) -> List[dict]:
        """List members of a farm (owner only)"""
        farm = self.supabase.from_("farms").select("owner_id").eq("id", farm_id).execute()
        if not farm.data or farm.data[0]["owner_id"] != owner_id:
            raise PermissionError("Not authorized to view members")

        memberships = self.supabase.from_("farm_memberships").select("*").eq("farm_id", farm_id).execute()

        if not memberships.data:
            return []

        # Batch-fetch user profiles from users table
        member_ids = [m["user_id"] for m in memberships.data]
        users_response = (
            self.supabase.from_("users")
            .select("id, username, full_name")
            .in_("id", member_ids)
            .execute()
        )
        users_by_id = {u["id"]: u for u in (users_response.data or [])}

        members = []
        for membership in memberships.data:
            uid = membership["user_id"]
            user_info = users_by_id.get(uid, {})
            members.append({
                **membership,
                "user_username": user_info.get("username", ""),
                "user_full_name": user_info.get("full_name"),
            })

        return members

    def add_member_by_id(self, farm_id: str, owner_id: str, user_id: str, invited_by: str, permissions: dict = None) -> dict:
        """Add a member by user ID (owner only)"""
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
        farm = self.supabase.from_("farms").select("owner_id").eq("id", farm_id).execute()
        if not farm.data or farm.data[0]["owner_id"] != owner_id:
            raise PermissionError("Not authorized to update members")

        response = self.supabase.from_("farm_memberships").update(updates).eq("farm_id", farm_id).eq("user_id", user_id).execute()

        if response.data:
            return response.data[0]
        raise Exception("Failed to update member")

    def remove_member(self, farm_id: str, owner_id: str, user_id: str) -> bool:
        """Remove a member from a farm (owner only)"""
        farm = self.supabase.from_("farms").select("owner_id").eq("id", farm_id).execute()
        if not farm.data or farm.data[0]["owner_id"] != owner_id:
            raise PermissionError("Not authorized to remove members")

        self.supabase.from_("farm_memberships").delete().eq("farm_id", farm_id).eq("user_id", user_id).execute()
        return True


def get_farm_service() -> FarmService:
    return FarmService()
