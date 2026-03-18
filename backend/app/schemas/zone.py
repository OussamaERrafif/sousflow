from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ZoneCreate(BaseModel):
    zone_number: int = Field(..., ge=1, le=50)
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    area_hectares: Optional[float] = Field(None, ge=0)
    plant_type: str = "olive"
    plant_species: str = "Olea europaea"
    is_active: bool = True


class ZoneUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    area_hectares: Optional[float] = Field(None, ge=0)
    plant_type: Optional[str] = None
    plant_species: Optional[str] = None
    is_active: Optional[bool] = None


class ZoneResponse(BaseModel):
    id: str
    farm_id: str
    zone_number: int
    name: str
    description: Optional[str] = None
    area_hectares: Optional[float] = None
    plant_type: str
    plant_species: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class BranchCreate(BaseModel):
    branch_number: int = Field(..., ge=1, le=50)
    name: str = Field(..., min_length=1, max_length=100)
    length_meters: Optional[float] = Field(None, ge=0)
    emitter_count: Optional[int] = Field(None, ge=0)
    emitter_flow_lph: float = 4.0
    is_active: bool = True


class BranchUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    length_meters: Optional[float] = Field(None, ge=0)
    emitter_count: Optional[int] = Field(None, ge=0)
    emitter_flow_lph: Optional[float] = None
    is_active: Optional[bool] = None


class BranchResponse(BaseModel):
    id: str
    zone_id: str
    branch_number: int
    name: str
    length_meters: Optional[float] = None
    emitter_count: Optional[int] = None
    emitter_flow_lph: float
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ZoneWithBranches(ZoneResponse):
    branches: List[BranchResponse] = []


class ZoneListResponse(BaseModel):
    zones: List[ZoneResponse] = []
    total: int = 0


class BranchListResponse(BaseModel):
    branches: List[BranchResponse] = []
    total: int = 0
