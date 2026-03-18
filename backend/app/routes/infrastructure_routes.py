"""
Infrastructure Routes - Map, Zones, Reservoirs, Pipes, IoT Devices
/api/infrastructure/*
"""
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from app.auth import get_current_user, get_current_farm_id
from app.supabase_client import get_supabase_admin

router = APIRouter(prefix="/api/infrastructure", tags=["Infrastructure"])


# ─── Pydantic Schemas ────────────────────────────────────────────

class ZoneGeometry(BaseModel):
    type: str = "Polygon"
    coordinates: List[List[List[float]]]


class ZoneCreate(BaseModel):
    zone_number: int
    name: str
    area_hectares: Optional[float] = None
    geometry: Optional[dict] = None
    center_latitude: Optional[float] = None
    center_longitude: Optional[float] = None


class ZoneUpdate(BaseModel):
    name: Optional[str] = None
    area_hectares: Optional[float] = None
    geometry: Optional[dict] = None
    center_latitude: Optional[float] = None
    center_longitude: Optional[float] = None


class ZoneResponse(BaseModel):
    id: str
    farm_id: str
    zone_number: int
    name: str
    area_hectares: Optional[float] = None
    geometry: Optional[dict] = None
    center_latitude: Optional[float] = None
    center_longitude: Optional[float] = None
    is_active: bool = True


class ReservoirCreate(BaseModel):
    name: str
    capacity_liters: Optional[float] = 100000
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class ReservoirUpdate(BaseModel):
    name: Optional[str] = None
    capacity_liters: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class ReservoirResponse(BaseModel):
    id: str
    farm_id: str
    name: str
    capacity_liters: float = 100000
    current_level_pct: float = 100
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_active: bool = True


class PipeCreate(BaseModel):
    name: str
    pipe_type: Optional[str] = "main"
    diameter_mm: Optional[float] = None
    length_meters: Optional[float] = None
    from_latitude: Optional[float] = None
    from_longitude: Optional[float] = None
    to_latitude: Optional[float] = None
    to_longitude: Optional[float] = None
    from_zone_id: Optional[str] = None
    to_zone_id: Optional[str] = None
    from_reservoir_id: Optional[str] = None


class PipeUpdate(BaseModel):
    name: Optional[str] = None
    pipe_type: Optional[str] = None
    diameter_mm: Optional[float] = None
    length_meters: Optional[float] = None
    from_latitude: Optional[float] = None
    from_longitude: Optional[float] = None
    to_latitude: Optional[float] = None
    to_longitude: Optional[float] = None


class PipeResponse(BaseModel):
    id: str
    farm_id: str
    name: str
    pipe_type: str = "main"
    diameter_mm: Optional[float] = None
    length_meters: Optional[float] = None
    from_latitude: Optional[float] = None
    from_longitude: Optional[float] = None
    to_latitude: Optional[float] = None
    to_longitude: Optional[float] = None
    from_zone_id: Optional[str] = None
    to_zone_id: Optional[str] = None
    from_reservoir_id: Optional[str] = None
    is_active: bool = True


class IoTDeviceCreate(BaseModel):
    device_type: str
    name: str
    model: Optional[str] = None
    serial_number: Optional[str] = None
    mac_address: Optional[str] = None
    ip_address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    zone_id: Optional[str] = None
    reservoir_id: Optional[str] = None


class IoTDeviceUpdate(BaseModel):
    name: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    mac_address: Optional[str] = None
    ip_address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    zone_id: Optional[str] = None
    reservoir_id: Optional[str] = None
    status: Optional[str] = None


class IoTDeviceResponse(BaseModel):
    id: str
    farm_id: str
    device_type: str
    name: Optional[str] = None
    device_id: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    mac_address: Optional[str] = None
    ip_address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    zone_id: Optional[str] = None
    reservoir_id: Optional[str] = None
    status: str = "active"
    last_reading_at: Optional[str] = None
    last_battery_pct: Optional[float] = None
    is_active: bool = True


class InfrastructureMapResponse(BaseModel):
    zones: List[ZoneResponse]
    reservoirs: List[ReservoirResponse]
    pipes: List[PipeResponse]
    devices: List[IoTDeviceResponse]


# ─── Helper Functions ─────────────────────────────────────────────

def get_farm_id_param(farm_id: str, user: dict = Depends(get_current_farm_id)) -> str:
    return farm_id


# ─── Zone Routes ──────────────────────────────────────────────────

@router.get("/zones", response_model=List[ZoneResponse])
async def list_zones(
    farm_id: str = Depends(get_current_farm_id),
):
    """List all zones for a farm"""
    supabase = get_supabase_admin()
    result = supabase.table("zones").select("*").eq("farm_id", farm_id).eq("is_active", True).execute()
    return result.data or []


@router.post("/zones", response_model=ZoneResponse, status_code=status.HTTP_201_CREATED)
async def create_zone(
    zone: ZoneCreate,
    farm_id: str = Depends(get_current_farm_id),
):
    """Create a new zone"""
    supabase = get_supabase_admin()
    data = zone.model_dump()
    data["farm_id"] = farm_id
    result = supabase.table("zones").insert(data).execute()
    if result.data:
        return result.data[0]
    raise HTTPException(status_code=500, detail="Failed to create zone")


@router.get("/zones/{zone_id}", response_model=ZoneResponse)
async def get_zone(
    zone_id: str,
    farm_id: str = Depends(get_current_farm_id),
):
    """Get a zone by ID"""
    supabase = get_supabase_admin()
    result = supabase.table("zones").select("*").eq("id", zone_id).eq("farm_id", farm_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Zone not found")
    return result.data[0]


@router.put("/zones/{zone_id}", response_model=ZoneResponse)
async def update_zone(
    zone_id: str,
    zone: ZoneUpdate,
    farm_id: str = Depends(get_current_farm_id),
):
    """Update a zone"""
    supabase = get_supabase_admin()
    data = zone.model_dump(exclude_unset=True)
    data["updated_at"] = "now()"
    result = supabase.table("zones").update(data).eq("id", zone_id).eq("farm_id", farm_id).execute()
    if result.data:
        return result.data[0]
    raise HTTPException(status_code=404, detail="Zone not found")


@router.delete("/zones/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_zone(
    zone_id: str,
    farm_id: str = Depends(get_current_farm_id),
):
    """Soft-delete a zone"""
    supabase = get_supabase_admin()
    result = supabase.table("zones").update({"is_active": False, "updated_at": "now()"}).eq("id", zone_id).eq("farm_id", farm_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Zone not found")


# ─── Reservoir Routes ─────────────────────────────────────────────

@router.get("/reservoirs", response_model=List[ReservoirResponse])
async def list_reservoirs(
    farm_id: str = Depends(get_current_farm_id),
):
    """List all reservoirs for a farm"""
    supabase = get_supabase_admin()
    result = supabase.table("reservoirs").select("*").eq("farm_id", farm_id).eq("is_active", True).execute()
    return result.data or []


@router.post("/reservoirs", response_model=ReservoirResponse, status_code=status.HTTP_201_CREATED)
async def create_reservoir(
    reservoir: ReservoirCreate,
    farm_id: str = Depends(get_current_farm_id),
):
    """Create a new reservoir"""
    supabase = get_supabase_admin()
    data = reservoir.model_dump()
    data["farm_id"] = farm_id
    result = supabase.table("reservoirs").insert(data).execute()
    if result.data:
        return result.data[0]
    raise HTTPException(status_code=500, detail="Failed to create reservoir")


@router.get("/reservoirs/{reservoir_id}", response_model=ReservoirResponse)
async def get_reservoir(
    reservoir_id: str,
    farm_id: str = Depends(get_current_farm_id),
):
    """Get a reservoir by ID"""
    supabase = get_supabase_admin()
    result = supabase.table("reservoirs").select("*").eq("id", reservoir_id).eq("farm_id", farm_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Reservoir not found")
    return result.data[0]


@router.put("/reservoirs/{reservoir_id}", response_model=ReservoirResponse)
async def update_reservoir(
    reservoir_id: str,
    reservoir: ReservoirUpdate,
    farm_id: str = Depends(get_current_farm_id),
):
    """Update a reservoir"""
    supabase = get_supabase_admin()
    data = reservoir.model_dump(exclude_unset=True)
    data["updated_at"] = "now()"
    result = supabase.table("reservoirs").update(data).eq("id", reservoir_id).eq("farm_id", farm_id).execute()
    if result.data:
        return result.data[0]
    raise HTTPException(status_code=404, detail="Reservoir not found")


@router.delete("/reservoirs/{reservoir_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reservoir(
    reservoir_id: str,
    farm_id: str = Depends(get_current_farm_id),
):
    """Soft-delete a reservoir"""
    supabase = get_supabase_admin()
    result = supabase.table("reservoirs").update({"is_active": False, "updated_at": "now()"}).eq("id", reservoir_id).eq("farm_id", farm_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Reservoir not found")


# ─── Pipe Routes ───────────────────────────────────────────────────

@router.get("/pipes", response_model=List[PipeResponse])
async def list_pipes(
    farm_id: str = Depends(get_current_farm_id),
):
    """List all pipes for a farm"""
    supabase = get_supabase_admin()
    result = supabase.table("pipes").select("*").eq("farm_id", farm_id).eq("is_active", True).execute()
    return result.data or []


@router.post("/pipes", response_model=PipeResponse, status_code=status.HTTP_201_CREATED)
async def create_pipe(
    pipe: PipeCreate,
    farm_id: str = Depends(get_current_farm_id),
):
    """Create a new pipe"""
    supabase = get_supabase_admin()
    data = pipe.model_dump()
    data["farm_id"] = farm_id
    result = supabase.table("pipes").insert(data).execute()
    if result.data:
        return result.data[0]
    raise HTTPException(status_code=500, detail="Failed to create pipe")


@router.get("/pipes/{pipe_id}", response_model=PipeResponse)
async def get_pipe(
    pipe_id: str,
    farm_id: str = Depends(get_current_farm_id),
):
    """Get a pipe by ID"""
    supabase = get_supabase_admin()
    result = supabase.table("pipes").select("*").eq("id", pipe_id).eq("farm_id", farm_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Pipe not found")
    return result.data[0]


@router.put("/pipes/{pipe_id}", response_model=PipeResponse)
async def update_pipe(
    pipe_id: str,
    pipe: PipeUpdate,
    farm_id: str = Depends(get_current_farm_id),
):
    """Update a pipe"""
    supabase = get_supabase_admin()
    data = pipe.model_dump(exclude_unset=True)
    data["updated_at"] = "now()"
    result = supabase.table("pipes").update(data).eq("id", pipe_id).eq("farm_id", farm_id).execute()
    if result.data:
        return result.data[0]
    raise HTTPException(status_code=404, detail="Pipe not found")


@router.delete("/pipes/{pipe_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pipe(
    pipe_id: str,
    farm_id: str = Depends(get_current_farm_id),
):
    """Soft-delete a pipe"""
    supabase = get_supabase_admin()
    result = supabase.table("pipes").update({"is_active": False, "updated_at": "now()"}).eq("id", pipe_id).eq("farm_id", farm_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Pipe not found")


# ─── IoT Device Routes ────────────────────────────────────────────

@router.get("/devices", response_model=List[IoTDeviceResponse])
async def list_devices(
    farm_id: str = Depends(get_current_farm_id),
    status: Optional[str] = None,
    device_type: Optional[str] = None,
):
    """List all IoT devices for a farm"""
    supabase = get_supabase_admin()
    query = supabase.table("iot_devices").select("*").eq("farm_id", farm_id).eq("is_active", True)
    
    if status:
        query = query.eq("status", status)
    if device_type:
        query = query.eq("device_type", device_type)
    
    result = query.execute()
    return result.data or []


@router.post("/devices", response_model=IoTDeviceResponse, status_code=status.HTTP_201_CREATED)
async def create_device(
    device: IoTDeviceCreate,
    farm_id: str = Depends(get_current_farm_id),
):
    """Create a new IoT device"""
    supabase = get_supabase_admin()
    data = device.model_dump()
    data["farm_id"] = farm_id
    result = supabase.table("iot_devices").insert(data).execute()
    if result.data:
        return result.data[0]
    raise HTTPException(status_code=500, detail="Failed to create device")


@router.get("/devices/{device_id}", response_model=IoTDeviceResponse)
async def get_device(
    device_id: str,
    farm_id: str = Depends(get_current_farm_id),
):
    """Get an IoT device by ID"""
    supabase = get_supabase_admin()
    result = supabase.table("iot_devices").select("*").eq("id", device_id).eq("farm_id", farm_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Device not found")
    return result.data[0]


@router.put("/devices/{device_id}", response_model=IoTDeviceResponse)
async def update_device(
    device_id: str,
    device: IoTDeviceUpdate,
    farm_id: str = Depends(get_current_farm_id),
):
    """Update an IoT device"""
    supabase = get_supabase_admin()
    data = device.model_dump(exclude_unset=True)
    data["updated_at"] = "now()"
    result = supabase.table("iot_devices").update(data).eq("id", device_id).eq("farm_id", farm_id).execute()
    if result.data:
        return result.data[0]
    raise HTTPException(status_code=404, detail="Device not found")


@router.delete("/devices/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_device(
    device_id: str,
    farm_id: str = Depends(get_current_farm_id),
):
    """Soft-delete an IoT device"""
    supabase = get_supabase_admin()
    result = supabase.table("iot_devices").update({"is_active": False, "updated_at": "now()"}).eq("id", device_id).eq("farm_id", farm_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Device not found")


# ─── Map Data Route ────────────────────────────────────────────────

@router.get("/map", response_model=InfrastructureMapResponse)
async def get_map_data(
    farm_id: str = Depends(get_current_farm_id),
):
    """Get all infrastructure data for map visualization"""
    supabase = get_supabase_admin()
    
    zones = supabase.table("zones").select("*").eq("farm_id", farm_id).eq("is_active", True).execute()
    reservoirs = supabase.table("reservoirs").select("*").eq("farm_id", farm_id).eq("is_active", True).execute()
    pipes = supabase.table("pipes").select("*").eq("farm_id", farm_id).eq("is_active", True).execute()
    devices = supabase.table("iot_devices").select("*").eq("farm_id", farm_id).eq("is_active", True).execute()
    
    return {
        "zones": zones.data or [],
        "reservoirs": reservoirs.data or [],
        "pipes": pipes.data or [],
        "devices": devices.data or [],
    }
