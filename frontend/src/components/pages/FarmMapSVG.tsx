"use client";

 import { useState, useRef, useCallback, useMemo } from "react";
 import { useTranslations } from "next-intl";
 import type { ZoneReading } from "@/lib/store/slices/iotSlice";
 import {
   zones as defaultZones,
   zoneVertices as defaultZoneVertices,
   zoneLabels as defaultZoneLabels,
   reservoirPosition,
   reservoirSize,
   mainPipeY,
   mainPipeX,
   branchPipes,
   reservoirOutletPipe,
   type Zone,
 } from "./zonesData";

// ─── Constants ───────────────────────────────────────────────────────────────
const W = 900;
const H = 650;
const PAD = 20;
const HEADER_H = 85;
const ZONE_TOP = HEADER_H + 20;
const PIPE_Y = mainPipeY;

// Device type → colour + 1-2 char abbreviation
const DEV: Record<string, { color: string; abbr: string; label: string }> = {
  soil_moisture_sensor: { color: "#3b82f6", abbr: "S", label: "Moisture"    },
  flow_sensor:          { color: "#06b6d4", abbr: "F", label: "Flow"        },
  pressure_sensor:      { color: "#8b5cf6", abbr: "P", label: "Pressure"    },
  temperature_sensor:   { color: "#f59e0b", abbr: "T", label: "Temperature" },
  pump:                 { color: "#ef4444", abbr: "⊕", label: "Pump"        },
  valve:                { color: "#22c55e", abbr: "V", label: "Valve"       },
  rain_gauge:           { color: "#6366f1", abbr: "R", label: "Rain gauge" },
};

const STATUS_STYLE: Record<string, { fill: string; stroke: string; dot: string; glow: string }> = {
  good:     { fill: "rgba(34,197,94,0.12)",   stroke: "#22c55e", dot: "#22c55e", glow: "rgba(34,197,94,0.3)" },
  warning:  { fill: "rgba(245,158,11,0.15)",  stroke: "#f59e0b", dot: "#f59e0b", glow: "rgba(245,158,11,0.3)" },
  critical: { fill: "rgba(239,68,68,0.18)",   stroke: "#ef4444", dot: "#ef4444", glow: "rgba(239,68,68,0.3)" },
  off:      { fill: "rgba(255,255,255,0.03)", stroke: "#475569", dot: "#6b7280", glow: "rgba(255,255,255,0.05)" },
};

// ─── Types ────────────────────────────────────────────────────────────────────
export interface SchematicZone {
  id: string;
  name: string;
  zone_number: number;
  area_hectares?: number;
  bloc?: string;
  poste?: string;
}

export interface SchematicDevice {
  id: string;
  name: string;
  device_type: string;
  status: string;
  zone_id?: string | null;
}

export interface SchematicReservoir {
  id: string;
  name: string;
  current_level_pct?: number | null;
  capacity_liters?: number | null;
}

interface Props {
  zones?: SchematicZone[];
  devices?: SchematicDevice[];
  reservoirs?: SchematicReservoir[];
  liveZones?: ZoneReading[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getStatus(zone: SchematicZone, live?: ZoneReading): string {
  if (!live) return "off";
  if (live.leak_count > 0) return "critical";
  if ((live.avg_moisture_pct ?? 100) < 40) return "warning";
  return "good";
}

// Convert polygon vertices to SVG points string
function polygonToPoints(vertices: [number, number][]): string {
  return vertices.map(([x, y]) => `${x},${y}`).join(" ");
}

// Calculate centroid of a polygon
function getCentroid(vertices: [number, number][]): { x: number; y: number } {
  let x = 0, y = 0;
  for (const [vx, vy] of vertices) {
    x += vx;
    y += vy;
  }
  return { x: x / vertices.length, y: y / vertices.length };
}

// Get bounding box of polygon
function getBounds(vertices: [number, number][]) {
  const xs = vertices.map(v => v[0]);
  const ys = vertices.map(v => v[1]);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function FarmMapSVG({
  zones = [],
  devices = [],
  reservoirs = [],
  liveZones = [],
}: Props) {
  const t = useTranslations("MapPage");
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId]   = useState<string | null>(null);
  const [vb, setVb]                 = useState({ x: 0, y: 0, w: W, h: H });
  const [dragging, setDragging]     = useState(false);
  const [dragPt, setDragPt]         = useState({ x: 0, y: 0 });
  const containerRef                 = useRef<HTMLDivElement>(null);

  // ── Map zone_number to zone data from zonesData for default shapes
  const zoneDataByNumber = useMemo(() => {
    const m: Record<number, Zone> = {};
    for (const z of defaultZones) m[z.id] = z;
    return m;
  }, []);

  // ── Get vertices for a zone (from default data, keyed by zone_number)
  const getZoneVertices = useCallback((zone: SchematicZone): [number, number][] => {
    const defaultData = zoneDataByNumber[zone.zone_number];
    if (defaultData && defaultZoneVertices[defaultData.id]) {
      return defaultZoneVertices[defaultData.id];
    }
    // Fallback: generate a simple rectangle
    const cols = 3;
    const rows = 2;
    const zoneW = (W - 2 * PAD - (cols - 1) * 20) / cols;
    const zoneH = (H - ZONE_TOP - PAD - (rows - 1) * 20) / rows;
    const idx = zone.zone_number - 1;
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = PAD + col * (zoneW + 20);
    const y = ZONE_TOP + row * (zoneH + 20);
    return [
      [x, y],
      [x + zoneW, y],
      [x + zoneW, y + zoneH],
      [x, y + zoneH],
    ];
  }, [zoneDataByNumber]);

  // ── Get label position for a zone
  const getZoneLabel = useCallback((zone: SchematicZone): { x: number; y: number } => {
    const defaultData = zoneDataByNumber[zone.zone_number];
    if (defaultData && defaultZoneLabels[defaultData.id]) {
      return defaultZoneLabels[defaultData.id];
    }
    const vertices = getZoneVertices(zone);
    return getCentroid(vertices);
  }, [zoneDataByNumber, getZoneVertices]);

  // ── Live zone lookup by zone_number ──────────────────────────────────────
  const liveByNum = useMemo(() => {
    const m: Record<number, ZoneReading> = {};
    for (const z of liveZones) m[z.zone_number] = z;
    return m;
  }, [liveZones]);

  // ── Device lookup by zone_id ─────────────────────────────────────────────
  const devsByZone = useMemo(() => {
    const m: Record<string, SchematicDevice[]> = {};
    for (const d of devices) {
      const key = d.zone_id ?? "__none__";
      (m[key] = m[key] ?? []).push(d);
    }
    return m;
  }, [devices]);

  // ── Pan / zoom ────────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setDragging(true);
    setDragPt({ x: e.clientX, y: e.clientY });
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    const cw = containerRef.current?.clientWidth  ?? W;
    const ch = containerRef.current?.clientHeight ?? H;
    const dx = (e.clientX - dragPt.x) * (vb.w / cw);
    const dy = (e.clientY - dragPt.y) * (vb.h / ch);
    setVb(v => ({ ...v, x: v.x - dx, y: v.y - dy }));
    setDragPt({ x: e.clientX, y: e.clientY });
  }, [dragging, dragPt, vb]);

  const onMouseUp   = useCallback(() => setDragging(false), []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const f = e.deltaY > 0 ? 1 / 0.9 : 0.9;
    setVb(v => ({
      x: v.x + (v.w * (1 - f)) / 2,
      y: v.y + (v.h * (1 - f)) / 2,
      w: v.w * f,
      h: v.h * f,
    }));
  }, []);

  const resetView = () => setVb({ x: 0, y: 0, w: W, h: H });

  // ── Selected zone detail ──────────────────────────────────────────────────
  const selZone  = zones.find(z => z.id === selectedId) ?? null;
  const selLive  = selZone ? liveByNum[selZone.zone_number] : null;
  const selDevs  = selZone ? (devsByZone[selZone.id] ?? []) : [];

  // ── Reservoir ─────────────────────────────────────────────────────────────
  const reservoir = reservoirs[0];
  const resLevel  = Math.min(reservoir?.current_level_pct ?? 0, 100);
  const resX      = reservoirPosition.x - reservoirSize.width / 2;
  const resY      = reservoirPosition.y;
  const resFillH  = reservoirSize.height * resLevel / 100;

  return (
    <div className="relative w-full h-full bg-[#0a0f1a] rounded-2xl overflow-hidden">
      {/* SVG canvas */}
      <div
        ref={containerRef}
        className="relative w-full h-full"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
        style={{ cursor: dragging ? "grabbing" : "grab" }}
      >
        <svg
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full"
        >
          <defs>
            {/* Subtle dot-grid background */}
            <pattern id="smap-dots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.6" fill="rgba(255,255,255,0.04)" />
            </pattern>

            {/* Glow filter for pipes */}
            <filter id="pipe-glow" x="-20%" y="-200%" width="140%" height="500%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>

            {/* Zone glow filter */}
            <filter id="zone-glow" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>

            {/* Reservoir gradient */}
            <linearGradient id="reservoir-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.05" />
            </linearGradient>

            {/* Zone gradients */}
            <linearGradient id="zone-1-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="zone-2-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="zone-3-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="zone-4-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="zone-5-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="zone-6-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ec4899" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#ec4899" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Background */}
          <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="url(#smap-dots)" />

          {/* ── Farm boundary ─────────────────────────────────────────────── */}
          <rect
            x={PAD}
            y={ZONE_TOP - 10}
            width={W - 2 * PAD}
            height={H - ZONE_TOP - PAD + 10}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
            strokeDasharray="8,4"
            rx="4"
          />

          {/* ── Farm title ───────────────────────────────────────────────── */}
          <text x={PAD + 5} y={28} fill="rgba(255,255,255,0.9)" fontSize="14" fontWeight="700" fontFamily="system-ui,sans-serif">
            {t("farm_schematic")}
          </text>
          <text x={PAD + 5} y={45} fill="rgba(255,255,255,0.35)" fontSize="10" fontFamily="system-ui,sans-serif">
            {zones.length} {t("zones")} · {devices.length} {t("devices")}
          </text>

          {/* ── Main irrigation pipe ─────────────────────────────────────── */}
          <line
            x1={mainPipeX.start}
            y1={PIPE_Y}
            x2={mainPipeX.end}
            y2={PIPE_Y}
            stroke="#0ea5e9"
            strokeWidth="3"
            strokeLinecap="round"
            strokeOpacity="0.7"
            filter="url(#pipe-glow)"
          />
          {/* Pipe end caps */}
          <circle cx={mainPipeX.start} cy={PIPE_Y} r="5" fill="#0ea5e9" fillOpacity="0.8" />
          <circle cx={mainPipeX.end} cy={PIPE_Y} r="5" fill="#0ea5e9" fillOpacity="0.8" />

          {/* ── Branch pipes to each zone ────────────────────────────────── */}
          {zones.map((zone) => {
            const branch = branchPipes[zone.zone_number];
            if (!branch) return null;
            return (
              <line
                key={`branch-${zone.id}`}
                x1={branch.x1}
                y1={branch.y1}
                x2={branch.x2}
                y2={branch.y2}
                stroke="#0ea5e9"
                strokeWidth="2"
                strokeOpacity="0.5"
                strokeDasharray="6,4"
              />
            );
          })}

          {/* ── Reservoir ───────────────────────────────────────────────── */}
          {reservoir && (
            <g>
              {/* Reservoir shadow */}
              <rect
                x={resX + 3}
                y={resY + 3}
                width={reservoirSize.width}
                height={reservoirSize.height}
                rx="6"
                fill="rgba(0,0,0,0.3)"
              />
              {/* Reservoir background */}
              <rect
                x={resX}
                y={resY}
                width={reservoirSize.width}
                height={reservoirSize.height}
                rx="6"
                fill="url(#reservoir-grad)"
                stroke="#0ea5e9"
                strokeWidth="1.5"
                strokeOpacity="0.6"
              />
              {/* Water level */}
              <rect
                x={resX + 4}
                y={resY + reservoirSize.height - resFillH - 4}
                width={reservoirSize.width - 8}
                height={resFillH - 4}
                rx="3"
                fill={resLevel < 20 ? "#ef4444" : resLevel < 40 ? "#f59e0b" : "#0ea5e9"}
                fillOpacity="0.5"
              />
              {/* Label */}
              <text
                x={resX + reservoirSize.width / 2}
                y={resY + 18}
                textAnchor="middle"
                fill="rgba(14,165,233,0.8)"
                fontSize="8"
                fontFamily="system-ui,sans-serif"
                fontWeight="600"
                letterSpacing="1"
              >
                {t("reservoir_level").toUpperCase()}
              </text>
              <text
                x={resX + reservoirSize.width / 2}
                y={resY + 36}
                textAnchor="middle"
                fill="rgba(255,255,255,0.95)"
                fontSize="16"
                fontWeight="700"
                fontFamily="system-ui,sans-serif"
              >
                {reservoir.current_level_pct != null ? `${reservoir.current_level_pct.toFixed(0)}%` : "--"}
              </text>
              {/* Pipe from reservoir */}
              <line
                x1={reservoirOutletPipe.x}
                y1={reservoirOutletPipe.y1 + reservoirSize.height}
                x2={reservoirOutletPipe.x}
                y2={PIPE_Y}
                stroke="#0ea5e9"
                strokeWidth="2"
                strokeOpacity="0.4"
                strokeDasharray="5,3"
              />
            </g>
          )}

          {/* ── Zone polygons ────────────────────────────────────────────── */}
          {zones.map((zone) => {
            const vertices = getZoneVertices(zone);
            const live    = liveByNum[zone.zone_number];
            const status  = getStatus(zone, live);
            const sty     = STATUS_STYLE[status];
            const isSel   = selectedId === zone.id;
            const isHov   = hoveredId  === zone.id;
            const moisture = live?.avg_moisture_pct ?? null;
            const zDevs   = devsByZone[zone.id] ?? [];
            const defaultData = zoneDataByNumber[zone.zone_number];
            const zoneColor = defaultData?.color ?? "#22c55e";
            const centroid = getZoneLabel(zone);
            const bounds = getBounds(vertices);
            const zoneW = bounds.maxX - bounds.minX;
            const zoneH = bounds.maxY - bounds.minY;

            return (
              <g key={zone.id}>
                {/* Zone glow on hover/selection */}
                {(isSel || isHov) && (
                  <polygon
                    points={polygonToPoints(vertices)}
                    fill={sty.glow}
                    stroke="none"
                    style={{ pointerEvents: "none" }}
                  />
                )}

                {/* Zone fill */}
                <polygon
                  points={polygonToPoints(vertices)}
                  fill={sty.fill}
                  stroke={sty.stroke}
                  strokeWidth={isSel ? 2.5 : isHov ? 2 : 1.5}
                  strokeOpacity={isSel ? 1 : isHov ? 0.8 : 0.5}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHoveredId(zone.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => setSelectedId(isSel ? null : zone.id)}
                />

                {/* Zone inner border for depth */}
                <polygon
                  points={polygonToPoints(vertices)}
                  fill="none"
                  stroke={zoneColor}
                  strokeWidth="0.5"
                  strokeOpacity="0.2"
                  style={{ pointerEvents: "none" }}
                />

                {/* Zone label background */}
                <rect
                  x={centroid.x - 40}
                  y={centroid.y - 18}
                  width={80}
                  height={36}
                  rx="6"
                  fill="rgba(0,0,0,0.4)"
                  stroke={sty.stroke}
                  strokeWidth="1"
                  strokeOpacity="0.3"
                  style={{ pointerEvents: "none" }}
                />

                {/* Zone name */}
                <text
                  x={centroid.x}
                  y={centroid.y - 2}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.95)"
                  fontSize="11"
                  fontWeight="700"
                  fontFamily="system-ui,sans-serif"
                  style={{ pointerEvents: "none" }}
                >
                  {zone.name || `Zone ${zone.zone_number}`}
                </text>

                {/* Zone number badge */}
                <text
                  x={centroid.x}
                  y={centroid.y + 12}
                  textAnchor="middle"
                  fill={zoneColor}
                  fontSize="9"
                  fontWeight="600"
                  fontFamily="system-ui,sans-serif"
                  style={{ pointerEvents: "none" }}
                >
                  #{zone.zone_number} · {zone.area_hectares?.toFixed(1) ?? defaultData?.surface?.toFixed(1) ?? "?"} ha
                </text>

                {/* Status indicator dot */}
                <circle
                  cx={bounds.maxX - 12}
                  cy={bounds.minY + 12}
                  r="5"
                  fill={sty.dot}
                  fillOpacity="0.9"
                  style={{ pointerEvents: "none" }}
                />
                {status !== "off" && (
                  <circle
                    cx={bounds.maxX - 12}
                    cy={bounds.minY + 12}
                    r="9"
                    fill={sty.dot}
                    fillOpacity="0.2"
                    style={{ pointerEvents: "none" }}
                  />
                )}

                {/* Moisture bar */}
                {moisture !== null && zoneH > 80 && (
                  <g style={{ pointerEvents: "none" }}>
                    <text
                      x={bounds.minX + 8}
                      y={bounds.maxY - 16}
                      fill="rgba(255,255,255,0.5)"
                      fontSize="7"
                      fontFamily="system-ui,sans-serif"
                    >
                      {t("moisture").toUpperCase()}
                    </text>
                    <text
                      x={bounds.maxX - 8}
                      y={bounds.maxY - 16}
                      textAnchor="end"
                      fill={moisture < 40 ? "#ef4444" : moisture < 55 ? "#f59e0b" : "#22c55e"}
                      fontSize="7"
                      fontWeight="600"
                      fontFamily="system-ui,sans-serif"
                    >
                      {moisture.toFixed(0)}%
                    </text>
                    <rect
                      x={bounds.minX + 8}
                      y={bounds.maxY - 10}
                      width={zoneW - 16}
                      height={4}
                      rx="2"
                      fill="rgba(255,255,255,0.1)"
                    />
                    <rect
                      x={bounds.minX + 8}
                      y={bounds.maxY - 10}
                      width={(zoneW - 16) * Math.min(moisture / 100, 1)}
                      height={4}
                      rx="2"
                      fill={moisture < 40 ? "#ef4444" : moisture < 55 ? "#f59e0b" : "#22c55e"}
                      fillOpacity="0.7"
                    />
                  </g>
                )}

                {/* Device badges */}
                {zDevs.slice(0, 4).map((dev, di) => {
                  const dc = (DEV[dev.device_type] ?? { color: "#6b7280", abbr: "?" });
                  const online = dev.status === "online" || dev.status === "active";
                  const badgeX = bounds.minX + 10 + di * 18;
                  const badgeY = bounds.minY + 12;
                  return (
                    <g key={dev.id} style={{ pointerEvents: "none" }}>
                      <circle
                        cx={badgeX}
                        cy={badgeY}
                        r="6"
                        fill={dc.color}
                        fillOpacity={online ? 0.25 : 0.1}
                        stroke={dc.color}
                        strokeWidth="1"
                        strokeOpacity={online ? 0.8 : 0.3}
                      />
                      <text
                        x={badgeX}
                        y={badgeY + 3}
                        textAnchor="middle"
                        fill={dc.color}
                        fontSize="6"
                        fontWeight="700"
                        fontFamily="system-ui,sans-serif"
                        fillOpacity={online ? 1 : 0.5}
                      >
                        {dc.abbr}
                      </text>
                    </g>
                  );
                })}
                {zDevs.length > 4 && (
                  <text
                    x={bounds.minX + 10 + 4 * 18}
                    y={bounds.minY + 16}
                    fill="rgba(255,255,255,0.5)"
                    fontSize="7"
                    fontFamily="system-ui,sans-serif"
                    style={{ pointerEvents: "none" }}
                  >
                    +{zDevs.length - 4}
                  </text>
                )}
              </g>
            );
          })}

          {/* ── Empty state ──────────────────────────────────────────────── */}
          {zones.length === 0 && (
            <g>
              <rect
                x={W / 2 - 180}
                y={H / 2 - 60}
                width={360}
                height={120}
                rx="12"
                fill="rgba(255,255,255,0.04)"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="1"
                strokeDasharray="5,3"
              />
              <text
                x={W / 2}
                y={H / 2 - 15}
                textAnchor="middle"
                fill="rgba(255,255,255,0.45)"
                fontSize="14"
                fontWeight="600"
                fontFamily="system-ui,sans-serif"
              >
                {t("empty_title")}
              </text>
              <text
                x={W / 2}
                y={H / 2 + 12}
                textAnchor="middle"
                fill="rgba(255,255,255,0.25)"
                fontSize="11"
                fontFamily="system-ui,sans-serif"
              >
                {t("empty_description")}
              </text>
            </g>
          )}

          {/* ── Compass rose ─────────────────────────────────────────────── */}
          <g transform={`translate(${W - 45}, ${H - 45})`}>
            <circle cx="0" cy="0" r="18" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
            <polygon points="0,-12 3,-4 0,-7 -3,-4" fill="rgba(255,255,255,0.6)" />
            <polygon points="0,12 3,4 0,7 -3,4" fill="rgba(255,255,255,0.2)" />
            <polygon points="-12,0 -4,3 -7,0 -4,-3" fill="rgba(255,255,255,0.2)" />
            <polygon points="12,0 4,3 7,0 4,-3" fill="rgba(255,255,255,0.2)" />
            <text x="0" y="-14" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="6" fontFamily="system-ui,sans-serif">N</text>
          </g>
        </svg>

        {/* ── Zone detail panel ─────────────────────────────────────────── */}
        {selZone && (
          <div className="absolute bottom-4 left-4 bg-card/95 backdrop-blur-md rounded-xl p-4 shadow-2xl w-60 border border-border/60 text-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: STATUS_STYLE[getStatus(selZone, selLive ?? undefined)].dot }}
                />
                <span className="font-semibold text-sm text-foreground truncate">
                  {selZone.name || `Zone ${selZone.zone_number}`}
                </span>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="text-muted-foreground hover:text-foreground text-base leading-none ml-2 shrink-0"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("zones")} #</span>
                <span className="font-medium text-foreground">{selZone.zone_number}</span>
              </div>
              {selZone.area_hectares != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("area")}</span>
                  <span className="font-medium text-foreground">{selZone.area_hectares.toFixed(1)} {t("hectares")}</span>
                </div>
              )}
              {selLive ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("moisture")}</span>
                    <span className="font-medium text-foreground">{selLive.avg_moisture_pct?.toFixed(0) ?? "--"}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("health")}</span>
                    <span className="font-medium text-foreground">{selLive.health_score?.toFixed(1) ?? "--"}/10</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("flow")}</span>
                    <span className="font-medium text-foreground">{selLive.total_inlet_flow_lpm?.toFixed(1) ?? "--"} L/m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("efficiency")}</span>
                    <span className="font-medium text-foreground">{selLive.water_efficiency_pct?.toFixed(0) ?? "--"}%</span>
                  </div>
                  {selLive.leak_count > 0 && (
                    <p className="text-red-500 font-medium pt-1">
                      ⚠ {selLive.leak_count} {t("leak_detected")}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground italic">{t("no_live_readings")}</p>
              )}

              {selDevs.length > 0 && (
                <div className="pt-2 mt-1 border-t border-border/50">
                  <p className="text-muted-foreground mb-1.5 uppercase tracking-wide text-[10px] font-semibold">
                    {t("devices")} ({selDevs.length})
                  </p>
                  <div className="space-y-1">
                    {selDevs.slice(0, 5).map(d => (
                      <div key={d.id} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: (DEV[d.device_type] ?? { color: "#6b7280" }).color }}
                          />
                          <span className="text-foreground/80 truncate">{d.name}</span>
                        </div>
                        <span className={`shrink-0 ${d.status === "online" ? "text-emerald-500" : "text-muted-foreground"}`}>
                          {t(d.status)}
                        </span>
                      </div>
                    ))}
                    {selDevs.length > 5 && (
                      <p className="text-muted-foreground">{t("more_devices", { count: selDevs.length - 5 })}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Controls ──────────────────────────────────────────────────── */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5">
          <button
            onClick={resetView}
            className="w-8 h-8 bg-card/70 backdrop-blur-sm rounded-lg flex items-center justify-center border border-border/40 hover:bg-card transition-colors text-foreground text-sm"
            title={t("cancel")}
          >
            ↺
          </button>
        </div>

        {/* ── Legend ────────────────────────────────────────────────────── */}
        <div className="absolute bottom-4 right-4 bg-card/75 backdrop-blur-sm rounded-xl px-3 py-2.5 border border-border/40 text-[10px] space-y-1">
          <p className="text-muted-foreground font-semibold uppercase tracking-widest mb-1.5">{t("deviceStatus")}</p>
          {[
            { color: "#22c55e", labelKey: "status_good" },
            { color: "#f59e0b", labelKey: "status_warning" },
            { color: "#ef4444", labelKey: "status_critical" },
            { color: "#6b7280", labelKey: "status_off" },
          ].map(({ color, labelKey }) => (
            <div key={labelKey} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-foreground/65">{t(labelKey as any)}</span>
            </div>
          ))}
          {devices.length > 0 && (
            <>
              <p className="text-muted-foreground font-semibold uppercase tracking-widest mt-2 mb-1.5">{t("devices")}</p>
              {Object.entries(DEV).slice(0, 5).map(([key, { color }]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-foreground/65">{t(`device_${key}` as any)}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
