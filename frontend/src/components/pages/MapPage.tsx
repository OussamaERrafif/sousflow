"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { MapContainer, TileLayer, Polygon, Polyline, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Leaf, Droplets, Waves, Network, Plus, Pencil, Trash2, ChevronDown, ChevronRight, Eye, EyeOff } from "lucide-react";
import {
    useGetMapDataApiInfrastructureMapGetQuery,
    useCreateZoneApiInfrastructureZonesPostMutation,
    useCreateReservoirApiInfrastructureReservoirsPostMutation,
    useCreatePipeApiInfrastructurePipesPostMutation,
} from "@/lib/store/generated/api";
import { useAppSelector } from "@/lib/store/hooks";

function MapBoundsSetter({ bounds }: { bounds: number[][] }) {
    const map = useMap();
    useEffect(() => {
        if (bounds && bounds.length >= 2) {
            map.fitBounds(bounds as [number, number][]);
        }
    }, [map, bounds]);
    return null;
}

export default function MapPage() {
    const t = useTranslations("MapPage");
    const { activeFarmId } = useAppSelector((state) => state.auth);
    const [showAddZone, setShowAddZone] = useState(false);
    const [showAddReservoir, setShowAddReservoir] = useState(false);
    const [showAddPipe, setShowAddPipe] = useState(false);

    const { data: mapData, isLoading, error } = useGetMapDataApiInfrastructureMapGetQuery(
        undefined,
        { skip: !activeFarmId }
    );

    const [createZone] = useCreateZoneApiInfrastructureZonesPostMutation();
    const [createReservoir] = useCreateReservoirApiInfrastructureReservoirsPostMutation();
    const [createPipe] = useCreatePipeApiInfrastructurePipesPostMutation();

    const [newZoneName, setNewZoneName] = useState("");
    const [newReservoirName, setNewReservoirName] = useState("");
    const [newPipeName, setNewPipeName] = useState("");

    // Layer visibility & selection state
    const [selectedZoneIds, setSelectedZoneIds] = useState<Set<string>>(new Set());
    const [selectedReservoirIds, setSelectedReservoirIds] = useState<Set<string>>(new Set());
    const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(new Set());
    const [selectedPipeIds, setSelectedPipeIds] = useState<Set<string>>(new Set());
    const [zonesExpanded, setZonesExpanded] = useState(true);
    const [reservoirsExpanded, setReservoirsExpanded] = useState(true);
    const [devicesExpanded, setDevicesExpanded] = useState(true);
    const [pipesExpanded, setPipesExpanded] = useState(true);
    const [initialized, setInitialized] = useState(false);

    // Initialize selections when data loads (select all by default)
    useEffect(() => {
        if (mapData && !initialized) {
            const zoneIds = new Set((mapData.zones || []).map((z: any) => z.id));
            const reservoirIds = new Set((mapData.reservoirs || []).map((r: any) => r.id));
            const deviceIds = new Set((mapData.devices || []).map((d: any) => d.id));
            const pipeIds = new Set((mapData.pipes || []).map((p: any) => p.id));
            setSelectedZoneIds(zoneIds);
            setSelectedReservoirIds(reservoirIds);
            setSelectedDeviceIds(deviceIds);
            setSelectedPipeIds(pipeIds);
            setInitialized(true);
        }
    }, [mapData, initialized]);

    const toggleItem = (set: Set<string>, setFn: (s: Set<string>) => void, id: string) => {
        const next = new Set(set);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setFn(next);
    };

    const toggleAll = (items: any[], set: Set<string>, setFn: (s: Set<string>) => void) => {
        const allIds = items.map((i: any) => i.id);
        const allSelected = allIds.every((id: string) => set.has(id));
        if (allSelected) {
            setFn(new Set());
        } else {
            setFn(new Set(allIds));
        }
    };

    const defaultCenter: [number, number] = [30.0, -9.5];
    const defaultZoom = 14;

    if (!activeFarmId) {
        return (
            <div className="w-full">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-amber-800 font-medium">{t("no_farm_selected")}</p>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="w-full">
                <div className="h-8 bg-muted rounded-xl animate-pulse w-48 mb-6"></div>
                <div className="h-96 bg-muted rounded-2xl animate-pulse"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full">
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-red-800 font-medium">{t("error_loading")}</p>
                </div>
            </div>
        );
    }

    const zones = mapData?.zones || [];
    const reservoirs = mapData?.reservoirs || [];
    const pipes = mapData?.pipes || [];
    const devices = mapData?.devices || [];

    const handleAddZone = async () => {
        if (!newZoneName || !activeFarmId) return;
        try {
            await createZone({
                appRoutesInfrastructureRoutesZoneCreate: {
                    zone_number: zones.length + 1,
                    name: newZoneName,
                },
            });
            setNewZoneName("");
            setShowAddZone(false);
        } catch (err) {
            console.error("Failed to create zone:", err);
        }
    };

    const handleAddReservoir = async () => {
        if (!newReservoirName || !activeFarmId) return;
        try {
            await createReservoir({
                reservoirCreate: {
                    name: newReservoirName,
                },
            });
            setNewReservoirName("");
            setShowAddReservoir(false);
        } catch (err) {
            console.error("Failed to create reservoir:", err);
        }
    };

    const handleAddPipe = async () => {
        if (!newPipeName || !activeFarmId) return;
        try {
            await createPipe({
                pipeCreate: {
                    name: newPipeName,
                    pipe_type: "main",
                },
            });
            setNewPipeName("");
            setShowAddPipe(false);
        } catch (err) {
            console.error("Failed to create pipe:", err);
        }
    };

    const allCoords: number[][] = [];
    zones.forEach((zone: any) => {
        if (zone.geometry?.coordinates) {
            zone.geometry.coordinates.forEach((ring: number[][]) => {
                ring.forEach((coord: number[]) => allCoords.push(coord));
            });
        }
        if (zone.center_latitude && zone.center_longitude) {
            allCoords.push([zone.center_latitude, zone.center_longitude]);
        }
    });
    reservoirs.forEach((r: any) => {
        if (r.latitude && r.longitude) {
            allCoords.push([r.latitude, r.longitude]);
        }
    });

    const getZoneColor = (index: number) => {
        const colors = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
        return colors[index % colors.length];
    };

    return (
        <div className="w-full">
            <div className="mb-6 flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-black text-foreground tracking-tight">{t("title")}</h1>
                    <p className="text-muted-foreground font-bold mt-1">{t("subtitle")}</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowAddZone(!showAddZone)}
                        className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        {t("add_zone")}
                    </button>
                    <button
                        onClick={() => setShowAddReservoir(!showAddReservoir)}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                    >
                        <Waves className="w-4 h-4" />
                        {t("add_reservoir")}
                    </button>
                    <button
                        onClick={() => setShowAddPipe(!showAddPipe)}
                        className="flex items-center gap-2 px-3 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium"
                    >
                        <Network className="w-4 h-4" />
                        {t("add_pipe")}
                    </button>
                </div>
            </div>

            {(showAddZone || showAddReservoir || showAddPipe) && (
                <div className="mb-6 p-4 bg-card rounded-xl border border-border">
                    {showAddZone && (
                        <div className="flex gap-2 items-center mb-2">
                            <input
                                type="text"
                                placeholder={t("zone_name_placeholder")}
                                value={newZoneName}
                                onChange={(e) => setNewZoneName(e.target.value)}
                                className="flex-1 px-3 py-2 border border-border rounded-lg"
                            />
                            <button
                                onClick={handleAddZone}
                                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                            >
                                {t("save")}
                            </button>
                            <button
                                onClick={() => setShowAddZone(false)}
                                className="px-4 py-2 bg-muted rounded-lg"
                            >
                                {t("cancel")}
                            </button>
                        </div>
                    )}
                    {showAddReservoir && (
                        <div className="flex gap-2 items-center mb-2">
                            <input
                                type="text"
                                placeholder={t("reservoir_name_placeholder")}
                                value={newReservoirName}
                                onChange={(e) => setNewReservoirName(e.target.value)}
                                className="flex-1 px-3 py-2 border border-border rounded-lg"
                            />
                            <button
                                onClick={handleAddReservoir}
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                            >
                                {t("save")}
                            </button>
                            <button
                                onClick={() => setShowAddReservoir(false)}
                                className="px-4 py-2 bg-muted rounded-lg"
                            >
                                {t("cancel")}
                            </button>
                        </div>
                    )}
                    {showAddPipe && (
                        <div className="flex gap-2 items-center">
                            <input
                                type="text"
                                placeholder={t("pipe_name_placeholder")}
                                value={newPipeName}
                                onChange={(e) => setNewPipeName(e.target.value)}
                                className="flex-1 px-3 py-2 border border-border rounded-lg"
                            />
                            <button
                                onClick={handleAddPipe}
                                className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
                            >
                                {t("save")}
                            </button>
                            <button
                                onClick={() => setShowAddPipe(false)}
                                className="px-4 py-2 bg-muted rounded-lg"
                            >
                                {t("cancel")}
                            </button>
                        </div>
                    )}
                </div>
            )}

            <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-card rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                        <Leaf className="w-4 h-4 text-green-500" />
                        <span className="text-xs font-bold text-muted-foreground uppercase">{t("zones")}</span>
                    </div>
                    <p className="text-2xl font-black text-foreground">{zones.length}</p>
                </div>
                <div className="bg-card rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                        <Waves className="w-4 h-4 text-blue-500" />
                        <span className="text-xs font-bold text-muted-foreground uppercase">{t("reservoirs")}</span>
                    </div>
                    <p className="text-2xl font-black text-foreground">{reservoirs.length}</p>
                </div>
                <div className="bg-card rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                        <Network className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-bold text-muted-foreground uppercase">{t("pipes")}</span>
                    </div>
                    <p className="text-2xl font-black text-foreground">{pipes.length}</p>
                </div>
                <div className="bg-card rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                        <Droplets className="w-4 h-4 text-purple-500" />
                        <span className="text-xs font-bold text-muted-foreground uppercase">{t("devices")}</span>
                    </div>
                    <p className="text-2xl font-black text-foreground">{devices.length}</p>
                </div>
            </div>

            <div className="flex gap-4" style={{ height: "550px" }}>
                {/* Layer Selection Panel */}
                <div className="w-72 shrink-0 bg-card rounded-2xl border border-border overflow-y-auto">
                    <div className="p-3 border-b border-border">
                        <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">{t("layers")}</h3>
                    </div>

                    {/* Zones Section */}
                    {zones.length > 0 && (
                        <div className="border-b border-border">
                            <button
                                onClick={() => setZonesExpanded(!zonesExpanded)}
                                className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <Leaf className="w-4 h-4 text-green-500" />
                                    <span className="text-sm font-bold">{t("zones")} ({zones.length})</span>
                                </div>
                                {zonesExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                            </button>
                            {zonesExpanded && (
                                <div className="px-3 pb-3">
                                    <button
                                        onClick={() => toggleAll(zones, selectedZoneIds, setSelectedZoneIds)}
                                        className="text-xs text-primary hover:underline mb-2 font-medium"
                                    >
                                        {zones.every((z: any) => selectedZoneIds.has(z.id)) ? t("deselect_all") : t("select_all")}
                                    </button>
                                    <div className="space-y-1">
                                        {zones.map((zone: any, index: number) => (
                                            <label
                                                key={zone.id}
                                                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${selectedZoneIds.has(zone.id) ? "bg-muted/70" : "hover:bg-muted/30 opacity-60"}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedZoneIds.has(zone.id)}
                                                    onChange={() => toggleItem(selectedZoneIds, setSelectedZoneIds, zone.id)}
                                                    className="rounded border-border"
                                                />
                                                <span
                                                    className="w-3 h-3 rounded-full shrink-0"
                                                    style={{ backgroundColor: getZoneColor(index) }}
                                                />
                                                <span className="text-sm font-medium truncate">{zone.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Reservoirs Section */}
                    {reservoirs.length > 0 && (
                        <div className="border-b border-border">
                            <button
                                onClick={() => setReservoirsExpanded(!reservoirsExpanded)}
                                className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <Waves className="w-4 h-4 text-blue-500" />
                                    <span className="text-sm font-bold">{t("reservoirs")} ({reservoirs.length})</span>
                                </div>
                                {reservoirsExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                            </button>
                            {reservoirsExpanded && (
                                <div className="px-3 pb-3">
                                    <button
                                        onClick={() => toggleAll(reservoirs, selectedReservoirIds, setSelectedReservoirIds)}
                                        className="text-xs text-primary hover:underline mb-2 font-medium"
                                    >
                                        {reservoirs.every((r: any) => selectedReservoirIds.has(r.id)) ? t("deselect_all") : t("select_all")}
                                    </button>
                                    <div className="space-y-1">
                                        {reservoirs.map((reservoir: any) => (
                                            <label
                                                key={reservoir.id}
                                                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${selectedReservoirIds.has(reservoir.id) ? "bg-muted/70" : "hover:bg-muted/30 opacity-60"}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedReservoirIds.has(reservoir.id)}
                                                    onChange={() => toggleItem(selectedReservoirIds, setSelectedReservoirIds, reservoir.id)}
                                                    className="rounded border-border"
                                                />
                                                <span className="w-3 h-3 rounded-full shrink-0 bg-blue-500" />
                                                <div className="min-w-0">
                                                    <span className="text-sm font-medium truncate block">{reservoir.name}</span>
                                                    {reservoir.current_level_pct != null && (
                                                        <span className="text-xs text-muted-foreground">{reservoir.current_level_pct.toFixed(0)}%</span>
                                                    )}
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Devices Section */}
                    {devices.length > 0 && (
                        <div className="border-b border-border">
                            <button
                                onClick={() => setDevicesExpanded(!devicesExpanded)}
                                className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <Droplets className="w-4 h-4 text-purple-500" />
                                    <span className="text-sm font-bold">{t("devices")} ({devices.length})</span>
                                </div>
                                {devicesExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                            </button>
                            {devicesExpanded && (
                                <div className="px-3 pb-3">
                                    <button
                                        onClick={() => toggleAll(devices, selectedDeviceIds, setSelectedDeviceIds)}
                                        className="text-xs text-primary hover:underline mb-2 font-medium"
                                    >
                                        {devices.every((d: any) => selectedDeviceIds.has(d.id)) ? t("deselect_all") : t("select_all")}
                                    </button>
                                    <div className="space-y-1">
                                        {devices.map((device: any) => (
                                            <label
                                                key={device.id}
                                                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${selectedDeviceIds.has(device.id) ? "bg-muted/70" : "hover:bg-muted/30 opacity-60"}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedDeviceIds.has(device.id)}
                                                    onChange={() => toggleItem(selectedDeviceIds, setSelectedDeviceIds, device.id)}
                                                    className="rounded border-border"
                                                />
                                                <span
                                                    className="w-3 h-3 rounded-full shrink-0"
                                                    style={{
                                                        backgroundColor: device.status === "online" ? "#22c55e" : device.status === "error" ? "#ef4444" : "#6b7280",
                                                    }}
                                                />
                                                <div className="min-w-0">
                                                    <span className="text-sm font-medium truncate block">{device.name}</span>
                                                    <span className="text-xs text-muted-foreground capitalize">{device.device_type?.replace("_", " ")}</span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Pipes Section */}
                    {pipes.length > 0 && (
                        <div>
                            <button
                                onClick={() => setPipesExpanded(!pipesExpanded)}
                                className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <Network className="w-4 h-4 text-amber-500" />
                                    <span className="text-sm font-bold">{t("pipes")} ({pipes.length})</span>
                                </div>
                                {pipesExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                            </button>
                            {pipesExpanded && (
                                <div className="px-3 pb-3">
                                    <button
                                        onClick={() => toggleAll(pipes, selectedPipeIds, setSelectedPipeIds)}
                                        className="text-xs text-primary hover:underline mb-2 font-medium"
                                    >
                                        {pipes.every((p: any) => selectedPipeIds.has(p.id)) ? t("deselect_all") : t("select_all")}
                                    </button>
                                    <div className="space-y-1">
                                        {pipes.map((pipe: any) => (
                                            <label
                                                key={pipe.id}
                                                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${selectedPipeIds.has(pipe.id) ? "bg-muted/70" : "hover:bg-muted/30 opacity-60"}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedPipeIds.has(pipe.id)}
                                                    onChange={() => toggleItem(selectedPipeIds, setSelectedPipeIds, pipe.id)}
                                                    className="rounded border-border"
                                                />
                                                <span
                                                    className="w-3 h-3 rounded-full shrink-0"
                                                    style={{ backgroundColor: pipe.pipe_type === "main" ? "#f59e0b" : "#a855f7" }}
                                                />
                                                <div className="min-w-0">
                                                    <span className="text-sm font-medium truncate block">{pipe.name}</span>
                                                    <span className="text-xs text-muted-foreground capitalize">{pipe.pipe_type}</span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Map */}
                <div className="flex-1 bg-card rounded-2xl border border-border overflow-hidden">
                    <MapContainer
                        center={defaultCenter}
                        zoom={defaultZoom}
                        style={{ height: "100%", width: "100%" }}
                        className="z-0"
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        {allCoords.length > 0 && <MapBoundsSetter bounds={allCoords} />}

                        {zones.filter((z: any) => selectedZoneIds.has(z.id)).map((zone: any, _: number) => {
                            const index = zones.indexOf(zone);
                            return zone.geometry?.coordinates && zone.geometry.coordinates.length > 0 ? (
                                <Polygon
                                    key={`zone-${zone.id}`}
                                    positions={zone.geometry.coordinates[0] as [number, number][]}
                                    pathOptions={{
                                        color: getZoneColor(index),
                                        fillColor: getZoneColor(index),
                                        fillOpacity: 0.3,
                                        weight: 2,
                                    }}
                                >
                                    <Popup>
                                        <div className="p-2">
                                            <h3 className="font-bold">{zone.name}</h3>
                                            <p className="text-sm text-gray-600">Zone {zone.zone_number}</p>
                                            {zone.area_hectares && (
                                                <p className="text-sm">{zone.area_hectares} hectares</p>
                                            )}
                                        </div>
                                    </Popup>
                                </Polygon>
                            ) : zone.center_latitude && zone.center_longitude ? (
                                <CircleMarker
                                    key={`zone-point-${zone.id}`}
                                    center={[zone.center_latitude, zone.center_longitude]}
                                    radius={20}
                                    pathOptions={{
                                        color: getZoneColor(index),
                                        fillColor: getZoneColor(index),
                                        fillOpacity: 0.5,
                                    }}
                                >
                                    <Popup>
                                        <div className="p-2">
                                            <h3 className="font-bold">{zone.name}</h3>
                                            <p className="text-sm text-gray-600">Zone {zone.zone_number}</p>
                                        </div>
                                    </Popup>
                                </CircleMarker>
                            ) : null;
                        })}

                        {reservoirs.filter((r: any) => selectedReservoirIds.has(r.id)).map((reservoir: any) => (
                            reservoir.latitude && reservoir.longitude ? (
                                <CircleMarker
                                    key={`reservoir-${reservoir.id}`}
                                    center={[reservoir.latitude, reservoir.longitude]}
                                    radius={15}
                                    pathOptions={{
                                        color: "#3b82f6",
                                        fillColor: "#3b82f6",
                                        fillOpacity: 0.7,
                                    }}
                                >
                                    <Popup>
                                        <div className="p-2">
                                            <h3 className="font-bold text-blue-600">{reservoir.name}</h3>
                                            <p className="text-sm">Level: {reservoir.current_level_pct?.toFixed(0)}%</p>
                                            <p className="text-sm">Capacity: {reservoir.capacity_liters?.toLocaleString()} L</p>
                                        </div>
                                    </Popup>
                                </CircleMarker>
                            ) : null
                        ))}

                        {pipes.filter((p: any) => selectedPipeIds.has(p.id)).map((pipe: any) => (
                            (pipe.from_latitude && pipe.from_longitude && pipe.to_latitude && pipe.to_longitude) ? (
                                <Polyline
                                    key={`pipe-${pipe.id}`}
                                    positions={[
                                        [pipe.from_latitude, pipe.from_longitude],
                                        [pipe.to_latitude, pipe.to_longitude],
                                    ]}
                                    pathOptions={{
                                        color: pipe.pipe_type === "main" ? "#f59e0b" : "#a855f7",
                                        weight: pipe.pipe_type === "main" ? 4 : 2,
                                        opacity: 0.8,
                                    }}
                                >
                                    <Popup>
                                        <div className="p-2">
                                            <h3 className="font-bold text-amber-600">{pipe.name}</h3>
                                            <p className="text-sm capitalize">{pipe.pipe_type} pipe</p>
                                            {pipe.diameter_mm && <p className="text-sm">{pipe.diameter_mm} mm</p>}
                                            {pipe.length_meters && <p className="text-sm">{pipe.length_meters} m</p>}
                                        </div>
                                    </Popup>
                                </Polyline>
                            ) : null
                        ))}

                        {devices.filter((d: any) => selectedDeviceIds.has(d.id)).map((device: any) => (
                            device.latitude && device.longitude ? (
                                <CircleMarker
                                    key={`device-${device.id}`}
                                    center={[device.latitude, device.longitude]}
                                    radius={8}
                                    pathOptions={{
                                        color: device.status === "online" ? "#22c55e" : device.status === "error" ? "#ef4444" : "#6b7280",
                                        fillColor: device.status === "online" ? "#22c55e" : device.status === "error" ? "#ef4444" : "#6b7280",
                                        fillOpacity: 0.9,
                                    }}
                                >
                                    <Popup>
                                        <div className="p-2">
                                            <h3 className="font-bold">{device.name}</h3>
                                            <p className="text-sm capitalize">{device.device_type?.replace("_", " ")}</p>
                                            <p className="text-sm">Status: <span className={device.status === "online" ? "text-green-600" : "text-red-600"}>{device.status}</span></p>
                                            {device.last_battery_pct && <p className="text-sm">Battery: {device.last_battery_pct}%</p>}
                                        </div>
                                    </Popup>
                                </CircleMarker>
                            ) : null
                        ))}
                    </MapContainer>
                </div>
            </div>

            {zones.length === 0 && reservoirs.length === 0 && pipes.length === 0 && (
                <div className="mt-6 p-8 bg-muted/30 rounded-xl border border-dashed border-border text-center">
                    <Leaf className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-bold text-foreground mb-2">{t("empty_title")}</h3>
                    <p className="text-muted-foreground">{t("empty_description")}</p>
                </div>
            )}
        </div>
    );
}
