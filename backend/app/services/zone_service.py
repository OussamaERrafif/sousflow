"""
Zone Service - Business logic for Zone and Branch CRUD operations
"""
from typing import List, Optional
from uuid import UUID
from app.supabase_client import get_supabase_admin
from app.logging_config import logger


class ZoneService:
    def __init__(self):
        self.supabase = get_supabase_admin()

    def list_zones(self, farm_id: str) -> List[dict]:
        """List all zones for a farm"""
        result = (
            self.supabase.table("zones")
            .select("*")
            .eq("farm_id", farm_id)
            .eq("is_active", True)
            .order("zone_number")
            .execute()
        )
        return result.data or []

    def get_zone(self, farm_id: str, zone_id: str) -> Optional[dict]:
        """Get a single zone by ID"""
        result = (
            self.supabase.table("zones")
            .select("*")
            .eq("id", zone_id)
            .eq("farm_id", farm_id)
            .execute()
        )
        return result.data[0] if result.data else None

    def create_zone(self, farm_id: str, zone_number: int, name: str, **extra) -> dict:
        """Create a new zone"""
        data = {
            "farm_id": farm_id,
            "zone_number": zone_number,
            "name": name,
            **extra,
        }
        result = self.supabase.table("zones").insert(data).execute()
        if result.data:
            return result.data[0]
        raise Exception(f"Failed to create zone: {result}")

    def update_zone(self, farm_id: str, zone_id: str, **updates) -> dict:
        """Update a zone"""
        updates["updated_at"] = "now()"
        result = (
            self.supabase.table("zones")
            .update(updates)
            .eq("id", zone_id)
            .eq("farm_id", farm_id)
            .execute()
        )
        if result.data:
            return result.data[0]
        raise Exception("Failed to update zone")

    def delete_zone(self, farm_id: str, zone_id: str) -> bool:
        """Soft-delete a zone (set is_active=False)"""
        result = (
            self.supabase.table("zones")
            .update({"is_active": False, "updated_at": "now()"})
            .eq("id", zone_id)
            .eq("farm_id", farm_id)
            .execute()
        )
        return bool(result.data)

    def list_branches(self, farm_id: str, zone_id: str) -> List[dict]:
        """List all branches for a zone"""
        result = (
            self.supabase.table("branches")
            .select("*")
            .eq("zone_id", zone_id)
            .eq("is_active", True)
            .order("branch_number")
            .execute()
        )
        return result.data or []

    def get_branch(self, farm_id: str, branch_id: str) -> Optional[dict]:
        """Get a single branch by ID"""
        result = (
            self.supabase.table("branches")
            .select("branches.*, zones.farm_id")
            .eq("branches.id", branch_id)
            .eq("zones.farm_id", farm_id)
            .execute()
        )
        return result.data[0] if result.data else None

    def create_branch(self, farm_id: str, zone_id: str, branch_number: int, name: str, create_devices: bool = True, **extra) -> dict:
        """Create a new branch within a zone"""
        zone = self.get_zone(farm_id, zone_id)
        if not zone:
            raise ValueError("Zone not found")

        data = {
            "zone_id": zone_id,
            "branch_number": branch_number,
            "name": name,
            **extra,
        }
        result = self.supabase.table("branches").insert(data).execute()
        if result.data:
            branch = result.data[0]
            if create_devices:
                self._create_iot_devices_for_branch(farm_id, zone_id, branch["id"], branch_number)
            return branch
        raise Exception(f"Failed to create branch: {result}")

    def update_branch(self, farm_id: str, branch_id: str, **updates) -> dict:
        """Update a branch"""
        branch = self.get_branch(farm_id, branch_id)
        if not branch:
            raise ValueError("Branch not found")

        updates["updated_at"] = "now()"
        result = (
            self.supabase.table("branches")
            .update(updates)
            .eq("id", branch_id)
            .execute()
        )
        if result.data:
            return result.data[0]
        raise Exception("Failed to update branch")

    def delete_branch(self, farm_id: str, branch_id: str) -> bool:
        """Soft-delete a branch"""
        branch = self.get_branch(farm_id, branch_id)
        if not branch:
            raise ValueError("Branch not found")

        result = (
            self.supabase.table("branches")
            .update({"is_active": False, "updated_at": "now()"})
            .eq("id", branch_id)
            .execute()
        )
        return bool(result.data)

    def get_zone_with_branches(self, farm_id: str, zone_id: str) -> Optional[dict]:
        """Get a zone with all its branches"""
        zone = self.get_zone(farm_id, zone_id)
        if not zone:
            return None

        branches = self.list_branches(farm_id, zone_id)
        zone["branches"] = branches
        return zone

    def get_all_zones_with_branches(self, farm_id: str) -> List[dict]:
        """Get all zones with their branches"""
        zones = self.list_zones(farm_id)
        for zone in zones:
            zone["branches"] = self.list_branches(farm_id, zone["id"])
        return zones

    def create_default_zones_and_branches(
        self, farm_id: str, num_zones: int, branches_per_zone: int
    ) -> List[dict]:
        """Create default zones with branches for a farm"""
        created_zones = []
        for zone_num in range(1, num_zones + 1):
            zone = self.create_zone(
                farm_id=farm_id,
                zone_number=zone_num,
                name=f"Zone {zone_num}",
            )
            created_branches = []
            for branch_num in range(1, branches_per_zone + 1):
                branch = self.create_branch(
                    farm_id=farm_id,
                    zone_id=zone["id"],
                    branch_number=branch_num,
                    name=f"Branch {branch_num}",
                    length_meters=100.0,
                    emitter_count=50,
                    emitter_flow_lph=4.0,
                )
                self._create_iot_devices_for_branch(farm_id, zone["id"], branch["id"], branch_num)
                created_branches.append(branch)
            zone["branches"] = created_branches
            created_zones.append(zone)
            logger.info(f"Created zone {zone_num} with {branches_per_zone} branches")
        return created_zones

    def _create_iot_devices_for_branch(
        self, farm_id: str, zone_id: str, branch_id: str, branch_number: int
    ) -> List[dict]:
        """Create IoT devices for a branch: 3 flow meters + 2 soil moisture sensors"""
        devices = []
        
        for i in range(1, 4):
            device_data = {
                "farm_id": farm_id,
                "zone_id": zone_id,
                "device_type": "flow_meter",
                "name": f"Flow Meter {branch_number}-{i}",
                "model": "FM-100",
                "serial_number": f"FM{branch_number:02d}{i:02d}001",
                "mac_address": f"00:1B:44:11:{branch_number:02X}:{i:X0}",
                "status": "online",
            }
            result = self.supabase.table("iot_devices").insert(device_data).execute()
            if result.data:
                devices.append(result.data[0])
        
        for i in range(1, 3):
            device_data = {
                "farm_id": farm_id,
                "zone_id": zone_id,
                "device_type": "moisture_sensor",
                "name": f"Soil Moisture {branch_number}-{i}",
                "model": "SM-200",
                "serial_number": f"SM{branch_number:02d}{i:02d}001",
                "mac_address": f"00:1B:44:22:{branch_number:02X}:{i:X0}",
                "status": "online",
            }
            result = self.supabase.table("iot_devices").insert(device_data).execute()
            if result.data:
                devices.append(result.data[0])
        
        logger.info(f"Created {len(devices)} IoT devices for branch {branch_number}")
        return devices


def get_zone_service() -> ZoneService:
    return ZoneService()
