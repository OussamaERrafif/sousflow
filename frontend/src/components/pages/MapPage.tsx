"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { MapContainer, TileLayer, Polygon, Polyline, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  Leaf, Droplets, Waves, Network, Plus, ChevronDown, ChevronRight,
  Map, Grid3X3, WifiOff,
} from "lucide-react";
import FarmMapSVG from "./FarmMapSVG";
import {
  useGetMapDataApiInfrastructureMapGetQuery,
  useCreateZoneApiInfrastructureZonesPostMutation,
  useCreateReservoirApiInfrastructureReservoirsPostMutation,
  useCreatePipeApiInfrastructurePipesPostMutation,
} from "@/lib/store/generated/api";
import { useAppSelector } from "@/lib/store/hooks";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function MapBoundsSetter({ bounds }: { bounds: number[][] }) {
  const map = useMap();
  useEffect(() => {
    if (bounds?.length >= 2) map.fitBounds(bounds as [number, number][]);
  }, [map, bounds]);
  return null;
}

const ZONE_COLORS = [
  "#22c55e", "#3b82f6", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
];
const getZoneColor = (i: number) => ZONE_COLORS[i % ZONE_COLORS.length];

// ─── Component ────────────────────────────────────────────────────────────────
export default function MapPage() {
  const t = useTranslations("MapPage");
  const { activeFarmId }       = useAppSelector((state) => state.auth);
  const { zones: sseZones }    = useAppSelector((state) => state.iot);

  const [mapView, setMapView]         = useState<"geographic" | "schematic">("geographic");
  const [mapInstanceId]              = useState(() => `leaflet-map-${Date.now()}`);
  const [mounted, setMounted]         = useState(false);
  const [showAddZone, setShowAddZone] = useState(false);
  const [showAddReservoir, setShowAddReservoir] = useState(false);
  const [showAddPipe, setShowAddPipe] = useState(false);
  const [newZoneName, setNewZoneName] = useState("");
  const [newReservoirName, setNewReservoirName] = useState("");
  const [newPipeName, setNewPipeName] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: mapData, isLoading, error } = useGetMapDataApiInfrastructureMapGetQuery(
    undefined, { skip: !activeFarmId }
  );

  const [createZone]      = useCreateZoneApiInfrastructureZonesPostMutation();
  const [createReservoir] = useCreateReservoirApiInfrastructureReservoirsPostMutation();
  const [createPipe]      = useCreatePipeApiInfrastructurePipesPostMutation();

  // Layer visibility
  const [selZones,      setSelZones]      = useState<Set<string>>(new Set());
  const [selReservoirs, setSelReservoirs] = useState<Set<string>>(new Set());
  const [selDevices,    setSelDevices]    = useState<Set<string>>(new Set());
  const [selPipes,      setSelPipes]      = useState<Set<string>>(new Set());
  const [zonesExp,      setZonesExp]      = useState(true);
  const [reservoirsExp, setReservoirsExp] = useState(true);
  const [devicesExp,    setDevicesExp]    = useState(true);
  const [pipesExp,      setPipesExp]      = useState(true);
  const [initialized,   setInitialized]  = useState(false);

  useEffect(() => {
    if (mapData && !initialized) {
      setSelZones(new Set((mapData.zones ?? []).map((z: any) => z.id)));
      setSelReservoirs(new Set((mapData.reservoirs ?? []).map((r: any) => r.id)));
      setSelDevices(new Set((mapData.devices ?? []).map((d: any) => d.id)));
      setSelPipes(new Set((mapData.pipes ?? []).map((p: any) => p.id)));
      setInitialized(true);
    }
  }, [mapData, initialized]);

  const toggle = (set: Set<string>, setFn: (s: Set<string>) => void, id: string) => {
    const n = new Set(set);
    n.has(id) ? n.delete(id) : n.add(id);
    setFn(n);
  };

  const toggleAll = (items: any[], set: Set<string>, setFn: (s: Set<string>) => void) => {
    const ids = items.map((i: any) => i.id);
    setFn(ids.every(id => set.has(id)) ? new Set() : new Set(ids));
  };

  if (!activeFarmId) return (
    <div className="w-full">
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <p className="text-amber-600 dark:text-amber-400 font-medium text-sm">{t("no_farm_selected")}</p>
      </div>
    </div>
  );

  if (isLoading) return (
    <div className="w-full space-y-4">
      <div className="h-7 bg-muted rounded-xl animate-pulse w-40" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-muted rounded-2xl animate-pulse" />)}
      </div>
      <div className="h-[600px] bg-muted rounded-2xl animate-pulse" />
    </div>
  );

  if (error) return (
    <div className="w-full">
      <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
        <p className="text-red-600 dark:text-red-400 font-medium text-sm">{t("error_loading")}</p>
      </div>
    </div>
  );

  const zones      = mapData?.zones      ?? [];
  const reservoirs = mapData?.reservoirs ?? [];
  const pipes      = mapData?.pipes      ?? [];
  const devices    = mapData?.devices    ?? [];

  // Collect all coords for map bounds
  const allCoords: number[][] = [];
  zones.forEach((z: any) => {
    (z.geometry?.coordinates ?? []).forEach((ring: number[][]) =>
      ring.forEach(c => allCoords.push(c))
    );
    if (z.center_latitude && z.center_longitude)
      allCoords.push([z.center_latitude, z.center_longitude]);
  });
  reservoirs.forEach((r: any) => {
    if (r.latitude && r.longitude) allCoords.push([r.latitude, r.longitude]);
  });

  // Handlers
  const handleAddZone = async () => {
    if (!newZoneName || !activeFarmId) return;
    try {
      await createZone({ appRoutesInfrastructureRoutesZoneCreate: { zone_number: zones.length + 1, name: newZoneName } });
      setNewZoneName(""); setShowAddZone(false);
    } catch (e) { console.error(e); }
  };
  const handleAddReservoir = async () => {
    if (!newReservoirName || !activeFarmId) return;
    try {
      await createReservoir({ reservoirCreate: { name: newReservoirName } });
      setNewReservoirName(""); setShowAddReservoir(false);
    } catch (e) { console.error(e); }
  };
  const handleAddPipe = async () => {
    if (!newPipeName || !activeFarmId) return;
    try {
      await createPipe({ pipeCreate: { name: newPipeName, pipe_type: "main" } });
      setNewPipeName(""); setShowAddPipe(false);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="w-full">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
          {/* View toggle */}
          <div className="flex items-center gap-1 mt-3 bg-muted rounded-lg p-1 w-fit">
            {(["geographic", "schematic"] as const).map(view => (
              <button key={view}
                onClick={() => setMapView(view)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  mapView === view
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {view === "geographic" ? <Map className="w-4 h-4" /> : <Grid3X3 className="w-4 h-4" />}
                {view === "geographic" ? (t("geographic_view") ?? "Geographic") : (t("schematic_view") ?? "Schematic")}
              </button>
            ))}
          </div>
        </div>

        {/* Add buttons */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowAddZone(!showAddZone)}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-xl text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" />{t("add_zone")}
          </button>
          <button onClick={() => setShowAddReservoir(!showAddReservoir)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 rounded-xl text-sm font-medium transition-colors">
            <Waves className="w-4 h-4" />{t("add_reservoir")}
          </button>
          <button onClick={() => setShowAddPipe(!showAddPipe)}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 rounded-xl text-sm font-medium transition-colors">
            <Network className="w-4 h-4" />{t("add_pipe")}
          </button>
        </div>
      </div>

      {/* ── Add forms ──────────────────────────────────────────────────── */}
      {(showAddZone || showAddReservoir || showAddPipe) && (
        <div className="mb-5 p-4 bg-card rounded-xl border border-border space-y-2">
          {showAddZone && (
            <div className="flex gap-2">
              <input type="text" placeholder={t("zone_name_placeholder")} value={newZoneName}
                onChange={e => setNewZoneName(e.target.value)}
                className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              <button onClick={handleAddZone} className="px-4 py-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-lg text-sm font-medium hover:bg-emerald-500/20 transition-colors">{t("save")}</button>
              <button onClick={() => setShowAddZone(false)} className="px-4 py-2 bg-muted rounded-lg text-sm">{t("cancel")}</button>
            </div>
          )}
          {showAddReservoir && (
            <div className="flex gap-2">
              <input type="text" placeholder={t("reservoir_name_placeholder")} value={newReservoirName}
                onChange={e => setNewReservoirName(e.target.value)}
                className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              <button onClick={handleAddReservoir} className="px-4 py-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-lg text-sm font-medium hover:bg-blue-500/20 transition-colors">{t("save")}</button>
              <button onClick={() => setShowAddReservoir(false)} className="px-4 py-2 bg-muted rounded-lg text-sm">{t("cancel")}</button>
            </div>
          )}
          {showAddPipe && (
            <div className="flex gap-2">
              <input type="text" placeholder={t("pipe_name_placeholder")} value={newPipeName}
                onChange={e => setNewPipeName(e.target.value)}
                className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              <button onClick={handleAddPipe} className="px-4 py-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-lg text-sm font-medium hover:bg-amber-500/20 transition-colors">{t("save")}</button>
              <button onClick={() => setShowAddPipe(false)} className="px-4 py-2 bg-muted rounded-lg text-sm">{t("cancel")}</button>
            </div>
          )}
        </div>
      )}

      {/* ── Stats row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { icon: Leaf,     color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20", label: t("zones"),      value: zones.length      },
          { icon: Waves,    color: "text-blue-500",    bg: "bg-blue-500/10 border-blue-500/20",       label: t("reservoirs"), value: reservoirs.length },
          { icon: Network,  color: "text-amber-500",   bg: "bg-amber-500/10 border-amber-500/20",     label: t("pipes"),      value: pipes.length      },
          { icon: Droplets, color: "text-purple-500",  bg: "bg-purple-500/10 border-purple-500/20",   label: t("devices"),    value: devices.length    },
        ].map(({ icon: Icon, color, bg, label, value }) => (
          <div key={label} className="bg-card rounded-xl p-4 border border-border flex items-center gap-3 hover:shadow-md hover:shadow-black/5 transition-shadow">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 ${bg}`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground leading-none">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Schematic view ─────────────────────────────────────────────── */}
      {mapView === "schematic" ? (
        <div className="rounded-2xl border border-border overflow-hidden" style={{ height: 620 }}>
          <FarmMapSVG
            zones={zones.map((z: any) => ({
              id: z.id,
              name: z.name,
              zone_number: z.zone_number,
              area_hectares: z.area_hectares,
            }))}
            devices={devices.map((d: any) => ({
              id: d.id,
              name: d.name,
              device_type: d.device_type,
              status: d.status,
              zone_id: d.zone_id ?? null,
            }))}
            reservoirs={reservoirs.map((r: any) => ({
              id: r.id,
              name: r.name,
              current_level_pct: r.current_level_pct,
              capacity_liters: r.capacity_liters,
            }))}
            liveZones={sseZones}
          />
        </div>
      ) : mounted ? (
        /* ── Geographic view ─────────────────────────────────────────── */
        <div className="flex gap-4" style={{ height: 620 }} key={`geo-view-${mapInstanceId}`}>
          {/* Layer panel */}
          <div className="w-60 shrink-0 bg-card rounded-2xl border border-border overflow-y-auto">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">{t("layers")}</p>
            </div>

            {/* Zones */}
            {zones.length > 0 && (
              <LayerSection
                label={`${t("zones")} (${zones.length})`}
                icon={<Leaf className="w-3.5 h-3.5 text-emerald-500" />}
                expanded={zonesExp}
                onToggle={() => setZonesExp(v => !v)}
              >
                <button onClick={() => toggleAll(zones, selZones, setSelZones)}
                  className="text-xs text-primary hover:underline mb-2 font-medium">
                  {zones.every((z: any) => selZones.has(z.id)) ? t("deselect_all") : t("select_all")}
                </button>
                {zones.map((zone: any, i: number) => (
                  <LayerItem key={zone.id}
                    checked={selZones.has(zone.id)}
                    onChange={() => toggle(selZones, setSelZones, zone.id)}
                    dotColor={getZoneColor(i)}
                    label={zone.name}
                  />
                ))}
              </LayerSection>
            )}

            {/* Reservoirs */}
            {reservoirs.length > 0 && (
              <LayerSection
                label={`${t("reservoirs")} (${reservoirs.length})`}
                icon={<Waves className="w-3.5 h-3.5 text-blue-500" />}
                expanded={reservoirsExp}
                onToggle={() => setReservoirsExp(v => !v)}
              >
                <button onClick={() => toggleAll(reservoirs, selReservoirs, setSelReservoirs)}
                  className="text-xs text-primary hover:underline mb-2 font-medium">
                  {reservoirs.every((r: any) => selReservoirs.has(r.id)) ? t("deselect_all") : t("select_all")}
                </button>
                {reservoirs.map((r: any) => (
                  <LayerItem key={r.id}
                    checked={selReservoirs.has(r.id)}
                    onChange={() => toggle(selReservoirs, setSelReservoirs, r.id)}
                    dotColor="#3b82f6"
                    label={r.name}
                    sub={r.current_level_pct != null ? `${r.current_level_pct.toFixed(0)}%` : undefined}
                  />
                ))}
              </LayerSection>
            )}

            {/* Devices */}
            {devices.length > 0 && (
              <LayerSection
                label={`${t("devices")} (${devices.length})`}
                icon={<Droplets className="w-3.5 h-3.5 text-purple-500" />}
                expanded={devicesExp}
                onToggle={() => setDevicesExp(v => !v)}
              >
                <button onClick={() => toggleAll(devices, selDevices, setSelDevices)}
                  className="text-xs text-primary hover:underline mb-2 font-medium">
                  {devices.every((d: any) => selDevices.has(d.id)) ? t("deselect_all") : t("select_all")}
                </button>
                {devices.map((d: any) => (
                  <LayerItem key={d.id}
                    checked={selDevices.has(d.id)}
                    onChange={() => toggle(selDevices, setSelDevices, d.id)}
                    dotColor={d.status === "online" ? "#22c55e" : d.status === "error" ? "#ef4444" : "#6b7280"}
                    label={d.name}
                    sub={d.device_type?.replace(/_/g, " ")}
                  />
                ))}
              </LayerSection>
            )}

            {/* Pipes */}
            {pipes.length > 0 && (
              <LayerSection
                label={`${t("pipes")} (${pipes.length})`}
                icon={<Network className="w-3.5 h-3.5 text-amber-500" />}
                expanded={pipesExp}
                onToggle={() => setPipesExp(v => !v)}
              >
                <button onClick={() => toggleAll(pipes, selPipes, setSelPipes)}
                  className="text-xs text-primary hover:underline mb-2 font-medium">
                  {pipes.every((p: any) => selPipes.has(p.id)) ? t("deselect_all") : t("select_all")}
                </button>
                {pipes.map((p: any) => (
                  <LayerItem key={p.id}
                    checked={selPipes.has(p.id)}
                    onChange={() => toggle(selPipes, setSelPipes, p.id)}
                    dotColor={p.pipe_type === "main" ? "#f59e0b" : "#a855f7"}
                    label={p.name}
                    sub={p.pipe_type}
                  />
                ))}
              </LayerSection>
            )}

            {zones.length === 0 && reservoirs.length === 0 && devices.length === 0 && (
              <div className="p-4 text-center">
                <WifiOff className="w-6 h-6 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-xs text-muted-foreground">No layers yet</p>
              </div>
            )}
          </div>

          {/* Leaflet map */}
          <div className="flex-1 rounded-2xl border border-border overflow-hidden" key={`map-container-${mapView}`}>
            <MapContainer
              id={mapInstanceId}
              center={[30.0, -9.5]}
              zoom={14}
              style={{ height: "100%", width: "100%" }}
              className="z-0"
              preferCanvas={true}
              whenReady={() => console.log("Map ready")}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {allCoords.length > 0 && <MapBoundsSetter bounds={allCoords} />}

              {zones.filter((z: any) => selZones.has(z.id)).map((zone: any) => {
                const idx = zones.indexOf(zone);
                const color = getZoneColor(idx);
                if (zone.geometry?.coordinates?.length > 0) {
                  return (
                    <Polygon key={`zone-${zone.id}`}
                      positions={zone.geometry.coordinates[0] as [number, number][]}
                      pathOptions={{ color, fillColor: color, fillOpacity: 0.28, weight: 2 }}>
                      <Popup>
                        <div className="p-1.5">
                          <p className="font-semibold">{zone.name}</p>
                          <p className="text-xs text-gray-500">Zone {zone.zone_number}</p>
                          {zone.area_hectares && <p className="text-xs">{zone.area_hectares} ha</p>}
                        </div>
                      </Popup>
                    </Polygon>
                  );
                }
                if (zone.center_latitude && zone.center_longitude) {
                  return (
                    <CircleMarker key={`zone-pt-${zone.id}`}
                      center={[zone.center_latitude, zone.center_longitude]} radius={20}
                      pathOptions={{ color, fillColor: color, fillOpacity: 0.45 }}>
                      <Popup>
                        <div className="p-1.5">
                          <p className="font-semibold">{zone.name}</p>
                          <p className="text-xs text-gray-500">Zone {zone.zone_number}</p>
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                }
                return null;
              })}

              {reservoirs.filter((r: any) => selReservoirs.has(r.id)).map((r: any) =>
                r.latitude && r.longitude ? (
                  <CircleMarker key={`res-${r.id}`}
                    center={[r.latitude, r.longitude]} radius={14}
                    pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.65 }}>
                    <Popup>
                      <div className="p-1.5">
                        <p className="font-semibold text-blue-600">{r.name}</p>
                        <p className="text-xs">Level: {r.current_level_pct?.toFixed(0)}%</p>
                        {r.capacity_liters && <p className="text-xs">{r.capacity_liters.toLocaleString()} L</p>}
                      </div>
                    </Popup>
                  </CircleMarker>
                ) : null
              )}

              {pipes.filter((p: any) => selPipes.has(p.id)).map((p: any) =>
                (p.from_latitude && p.from_longitude && p.to_latitude && p.to_longitude) ? (
                  <Polyline key={`pipe-${p.id}`}
                    positions={[[p.from_latitude, p.from_longitude], [p.to_latitude, p.to_longitude]]}
                    pathOptions={{ color: p.pipe_type === "main" ? "#f59e0b" : "#a855f7", weight: p.pipe_type === "main" ? 4 : 2, opacity: 0.75 }}>
                    <Popup>
                      <div className="p-1.5">
                        <p className="font-semibold text-amber-600">{p.name}</p>
                        <p className="text-xs capitalize">{p.pipe_type} pipe</p>
                        {p.diameter_mm && <p className="text-xs">{p.diameter_mm} mm</p>}
                      </div>
                    </Popup>
                  </Polyline>
                ) : null
              )}

              {devices.filter((d: any) => selDevices.has(d.id)).map((d: any) =>
                d.latitude && d.longitude ? (
                  <CircleMarker key={`dev-${d.id}`}
                    center={[d.latitude, d.longitude]} radius={7}
                    pathOptions={{
                      color:       d.status === "online" ? "#22c55e" : d.status === "error" ? "#ef4444" : "#6b7280",
                      fillColor:   d.status === "online" ? "#22c55e" : d.status === "error" ? "#ef4444" : "#6b7280",
                      fillOpacity: 0.85,
                    }}>
                    <Popup>
                      <div className="p-1.5">
                        <p className="font-semibold">{d.name}</p>
                        <p className="text-xs capitalize">{d.device_type?.replace(/_/g, " ")}</p>
                        <p className="text-xs">
                          Status: <span className={d.status === "online" ? "text-green-600" : "text-red-600"}>{d.status}</span>
                        </p>
                        {d.last_battery_pct != null && <p className="text-xs">Battery: {d.last_battery_pct}%</p>}
                      </div>
                    </Popup>
                  </CircleMarker>
                ) : null
              )}
            </MapContainer>
          </div>
        </div>
      ) : null}

      {/* Empty farm prompt */}
      {zones.length === 0 && reservoirs.length === 0 && pipes.length === 0 && (
        <div className="mt-5 p-8 bg-muted/20 rounded-xl border border-dashed border-border text-center">
          <Leaf className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <h3 className="text-base font-semibold text-foreground mb-1">{t("empty_title")}</h3>
          <p className="text-sm text-muted-foreground">{t("empty_description")}</p>
        </div>
      )}
    </div>
  );
}

// ─── Small reusable sub-components ────────────────────────────────────────────
function LayerSection({
  label, icon, expanded, onToggle, children,
}: {
  label: string; icon: React.ReactNode;
  expanded: boolean; onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border last:border-b-0">
      <button onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
        {expanded
          ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>
      {expanded && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

function LayerItem({
  checked, onChange, dotColor, label, sub,
}: {
  checked: boolean; onChange: () => void;
  dotColor: string; label: string; sub?: string;
}) {
  return (
    <label className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
      checked ? "bg-muted/60" : "hover:bg-muted/30 opacity-55"
    }`}>
      <input type="checkbox" checked={checked} onChange={onChange} className="rounded border-border shrink-0" />
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
      <div className="min-w-0">
        <span className="text-sm font-medium text-foreground truncate block">{label}</span>
        {sub && <span className="text-xs text-muted-foreground capitalize">{sub}</span>}
      </div>
    </label>
  );
}
