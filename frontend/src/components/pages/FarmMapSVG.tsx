"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import {
  circlePolygonPoints,
  farmVertices,
  getGridPolylinesByZone,
  pointsToString,
  zoneLabels,
  zoneVertices,
  zones,
  type Zone,
} from "./zonesData";
import { getHealthColor } from "@/components/ZoneRiskOverlay";

export interface ZoneHealthData {
  zone_id: string;
  health_score?: number;
  anomaly_count?: number;
}

interface FarmMapSVGProps {
  zoneHealth?: ZoneHealthData[];
}

function polylinePairToPointsString(pair: [number, number][]) {
  return pointsToString([pair[0], pair[1]]);
}

export default function FarmMapSVG({ zoneHealth = [] }: FarmMapSVGProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width: 900, height: 650 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => zones.find((z) => z.id === selectedId) ?? null,
    [selectedId]
  );

  const gridByZone = useMemo(() => getGridPolylinesByZone(), []);
  const compassRing = useMemo(() => circlePolygonPoints(850, 100, 45, 72), []);

  const zoneHealthMap = useMemo(() => {
    const map: Record<number, ZoneHealthData> = {};
    for (const zh of zoneHealth) {
      const zoneNum = parseInt(zh.zone_id.replace(/\D/g, "") || "0", 10);
      if (zoneNum >= 1 && zoneNum <= 6) {
        map[zoneNum] = zh;
      }
    }
    return map;
  }, [zoneHealth]);

  const getZoneFill = (zoneId: number) => {
    const health = zoneHealthMap[zoneId];
    if (health?.health_score !== undefined) {
      return getHealthColor(health.health_score);
    }
    return zones.find((z) => z.id === zoneId)?.color || "#22c55e";
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      const dx =
        (e.clientX - dragStart.x) *
        (viewBox.width / (containerRef.current?.clientWidth || 900));
      const dy =
        (e.clientY - dragStart.y) *
        (viewBox.height / (containerRef.current?.clientHeight || 650));
      setViewBox((v) => ({ ...v, x: v.x - dx, y: v.y - dy }));
      setDragStart({ x: e.clientX, y: e.clientY });
    },
    [isDragging, dragStart, viewBox]
  );

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(0.5, Math.min(3, z * delta)));
    const factor = 1 / delta;
    setViewBox((v) => ({
      x: v.x + (v.width * (1 - factor)) / 2,
      y: v.y + (v.height * (1 - factor)) / 2,
      width: v.width * factor,
      height: v.height * factor,
    }));
  }, []);

  const resetView = () => {
    setZoom(1);
    setViewBox({ x: 0, y: 0, width: 900, height: 650 });
  };

  return (
    <div className="relative w-full h-full bg-gray-950 rounded-2xl overflow-hidden">
      <div
        ref={containerRef}
        className="relative w-full h-full"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
      >
        <svg
          ref={svgRef}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full"
        >
          <defs>
            <clipPath id="farm-map-clip" clipPathUnits="userSpaceOnUse">
              <rect
                x={viewBox.x}
                y={viewBox.y}
                width={viewBox.width}
                height={viewBox.height}
              />
            </clipPath>
            {[1, 2, 3, 4, 5, 6].map((id) => (
              <clipPath key={`cp-def-${id}`} id={`zone-grid-clip-${id}`}>
                <polygon points={pointsToString(zoneVertices[id])} />
              </clipPath>
            ))}
          </defs>

          <g clipPath="url(#farm-map-clip)">
            {/* Farm boundary */}
            <polygon
              points={pointsToString(farmVertices)}
              fill="none"
              stroke="#ffffff"
              strokeWidth={2 / zoom}
              strokeLinejoin="round"
              style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }}
            />

            {/* Zone polygons */}
              {[1, 2, 3, 4, 5, 6].map((id) => {
              const z = zones.find((x) => x.id === id)!;
              const isSel = selectedId === id;
              const isHov = hoveredId === id;
              const pts = zoneVertices[id];
              const baseOp = isSel ? 0.6 : isHov ? 0.5 : 0.4;
              const health = zoneHealthMap[id];
              const zoneColor = health?.health_score !== undefined 
                ? getHealthColor(health.health_score) 
                : z.color;
              return (
                <polygon
                  key={id}
                  points={pointsToString(pts)}
                  fill={zoneColor}
                  fillOpacity={baseOp}
                  stroke="#ffffff"
                  strokeWidth={
                    isSel ? 3 / zoom : isHov ? 2.5 / zoom : 1.5 / zoom
                  }
                  strokeLinejoin="round"
                  onMouseEnter={() => setHoveredId(id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => setSelectedId(isSel ? null : id)}
                  style={{ cursor: "pointer" }}
                />
              );
            })}

            {/* Grid overlay */}
            {showGrid &&
              [1, 2, 3, 4, 5, 6].map((zid) => (
                <g
                  key={`grid-wrap-${zid}`}
                  clipPath={`url(#zone-grid-clip-${zid})`}
                >
                  {(gridByZone[zid] ?? []).map((pair, i) => (
                    <polyline
                      key={`grid-${zid}-${i}`}
                      points={polylinePairToPointsString(pair)}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth={0.5 / zoom}
                      strokeOpacity={0.3}
                    />
                  ))}
                </g>
              ))}

            {/* Zone labels */}
            {[1, 2, 3, 4, 5, 6].map((id) => {
              const lb = zoneLabels[id];
              const z = zones.find((x) => x.id === id)!;
              return (
                <g key={`lbl-${id}`}>
                  <text
                    x={lb.x}
                    y={lb.y - 8}
                    textAnchor="middle"
                    fill="white"
                    fontSize={12 / zoom}
                    fontWeight="bold"
                    style={{
                      textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                      pointerEvents: "none",
                    }}
                  >
                    {z.poste}
                  </text>
                  <text
                    x={lb.x}
                    y={lb.y + 8}
                    textAnchor="middle"
                    fill="white"
                    fontSize={10 / zoom}
                    opacity={0.9}
                    style={{
                      textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                      pointerEvents: "none",
                    }}
                  >
                    {z.surface} ha
                  </text>
                </g>
              );
            })}

            {/* Compass rose */}
            <polygon
              points={pointsToString(compassRing)}
              fill="rgba(255,255,255,0.1)"
              stroke="#ffffff"
              strokeWidth={1 / zoom}
              opacity={0.8}
            />
            <polygon points="850,58 860,88 840,88" fill="#ffffff" />
            <text
              x={850}
              y={110}
              textAnchor="middle"
              fill="white"
              fontSize={8 / zoom}
              fontWeight="bold"
              style={{ pointerEvents: "none" }}
            >
              HAUT
            </text>
            <text
              x={850}
              y={48}
              textAnchor="middle"
              fill="white"
              fontSize={11 / zoom}
              fontWeight="bold"
              style={{ pointerEvents: "none" }}
            >
              N
            </text>
            <text
              x={898}
              y={106}
              textAnchor="middle"
              fill="white"
              fontSize={11 / zoom}
              fontWeight="bold"
              style={{ pointerEvents: "none" }}
            >
              E
            </text>
            <text
              x={850}
              y={162}
              textAnchor="middle"
              fill="white"
              fontSize={11 / zoom}
              fontWeight="bold"
              style={{ pointerEvents: "none" }}
            >
              S
            </text>
            <text
              x={802}
              y={106}
              textAnchor="middle"
              fill="white"
              fontSize={11 / zoom}
              fontWeight="bold"
              style={{ pointerEvents: "none" }}
            >
              O
            </text>
          </g>
        </svg>

        {/* Zone info panel */}
        {selected && (
          <div className="absolute bottom-4 left-4 bg-card rounded-xl p-4 shadow-2xl min-w-[200px] border border-border">
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: selected.color }}
              />
              <span className="font-bold text-foreground">
                Poste {selected.poste}
              </span>
            </div>
            <div className="text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">Bloc:</span>{" "}
                {selected.bloc}
              </p>
              <p>
                <span className="text-muted-foreground">Surface:</span>{" "}
                {selected.surface} ha
              </p>
              <p>
                <span className="text-muted-foreground">Débit:</span>{" "}
                {selected.debit} m³/h
              </p>
            </div>
            <button
              onClick={() => setSelectedId(null)}
              className="mt-3 w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Fermer
            </button>
          </div>
        )}

        {/* Controls */}
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          <button
            onClick={resetView}
            className="w-10 h-10 bg-card rounded-lg shadow-lg flex items-center justify-center hover:bg-muted border border-border transition-colors"
            title="Reset view"
          >
            <span className="text-foreground text-lg">↺</span>
          </button>
          <button
            onClick={() => setShowGrid((g) => !g)}
            className={`w-10 h-10 rounded-lg shadow-lg flex items-center justify-center border transition-colors ${
              showGrid
                ? "bg-emerald-500 text-white border-emerald-600"
                : "bg-card text-muted-foreground hover:bg-muted border-border"
            }`}
            title="Toggle grid"
          >
            #
          </button>
        </div>
      </div>
    </div>
  );
}
