// Zone data for the SVG farm schematic map
// Based on a 6-zone olive farm layout in the Souss-Massa region
// Designed for a 900x650 SVG canvas

export interface Zone {
  id: number;
  poste: string;
  bloc: string;
  surface: number;
  debit: number;
  color: string;
  gradient: string;
}

export const zones: Zone[] = [
  { id: 1, poste: "P1", bloc: "A", surface: 4.2, debit: 45, color: "#22c55e", gradient: "rgba(34,197,94,0.15)" },
  { id: 2, poste: "P2", bloc: "A", surface: 3.8, debit: 40, color: "#3b82f6", gradient: "rgba(59,130,246,0.15)" },
  { id: 3, poste: "P3", bloc: "B", surface: 5.1, debit: 55, color: "#f59e0b", gradient: "rgba(245,158,11,0.15)" },
  { id: 4, poste: "P4", bloc: "B", surface: 3.5, debit: 38, color: "#ef4444", gradient: "rgba(239,68,68,0.15)" },
  { id: 5, poste: "P5", bloc: "C", surface: 4.7, debit: 50, color: "#8b5cf6", gradient: "rgba(139,92,246,0.15)" },
  { id: 6, poste: "P6", bloc: "C", surface: 3.2, debit: 35, color: "#ec4899", gradient: "rgba(236,72,153,0.15)" },
];

// Farm outer boundary - represents the entire farm area
export const farmVertices: [number, number][] = [
  [50, 50],
  [850, 50],
  [850, 600],
  [50, 600],
];

// Zone polygon vertices keyed by zone id
// Each zone is a contiguous block with proper irrigation layout
export const zoneVertices: Record<number, [number, number][]> = {
  // Zone 1: Northwest corner - largest block
  1: [
    [50, 50],
    [280, 50],
    [280, 220],
    [180, 280],
    [50, 250],
  ],
  // Zone 2: Northeast - top right
  2: [
    [280, 50],
    [510, 50],
    [510, 180],
    [400, 220],
    [280, 220],
  ],
  // Zone 3: Far east strip
  3: [
    [510, 50],
    [850, 50],
    [850, 280],
    [600, 280],
    [510, 180],
  ],
  // Zone 4: Southeast - bottom right
  4: [
    [510, 180],
    [850, 280],
    [850, 450],
    [680, 500],
    [510, 450],
  ],
  // Zone 5: Center south - bottom middle
  5: [
    [280, 220],
    [510, 450],
    [400, 520],
    [200, 520],
    [50, 450],
    [180, 280],
  ],
  // Zone 6: Southwest - bottom left
  6: [
    [50, 250],
    [180, 280],
    [50, 450],
    [50, 600],
    [280, 600],
    [280, 520],
    [50, 520],
  ],
};

// Label positions (center of each zone)
export const zoneLabels: Record<number, { x: number; y: number }> = {
  1: { x: 155, y: 150 },
  2: { x: 395, y: 130 },
  3: { x: 680, y: 160 },
  4: { x: 680, y: 360 },
  5: { x: 350, y: 380 },
  6: { x: 165, y: 430 },
};

// Reservoir position (center of farm - north)
export const reservoirPosition = { x: 450, y: 30 };
export const reservoirSize = { width: 120, height: 50 };

// Main pipe path - horizontal line through center
export const mainPipeY = 300;
export const mainPipeX = { start: 50, end: 850 };

// Branch pipe connections from main to each zone
export const branchPipes: Record<number, { x1: number; y1: number; x2: number; y2: number }> = {
  1: { x1: 150, y1: mainPipeY, x2: 165, y2: 250 },
  2: { x1: 395, y1: mainPipeY, x2: 395, y2: 220 },
  3: { x1: 680, y1: mainPipeY, x2: 680, y2: 280 },
  4: { x1: 680, y1: mainPipeY, x2: 680, y2: 450 },
  5: { x1: 350, y1: mainPipeY, x2: 350, y2: 450 },
  6: { x1: 150, y1: mainPipeY, x2: 150, y2: 450 },
};

// Reservoir outlet pipe
export const reservoirOutletPipe = { x: 450, y1: 80, y2: mainPipeY };

// Convert point array to SVG points string
export function pointsToString(pts: [number, number][]): string {
  return pts.map(([x, y]) => `${x},${y}`).join(" ");
}

// Generate a circle as a polygon (for compass rose)
export function circlePolygonPoints(
  cx: number,
  cy: number,
  r: number,
  segments: number
): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (2 * Math.PI * i) / segments - Math.PI / 2;
    pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return pts;
}

// Generate grid polylines clipped per zone
export function getGridPolylinesByZone(): Record<
  number,
  [number, number][][]
> {
  const result: Record<number, [number, number][][]> = {};
  const spacing = 25;

  for (const zid of [1, 2, 3, 4, 5, 6]) {
    const lines: [number, number][][] = [];
    const verts = zoneVertices[zid];
    const xs = verts.map((v) => v[0]);
    const ys = verts.map((v) => v[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    // Horizontal lines
    for (let y = minY; y <= maxY; y += spacing) {
      lines.push([
        [minX, y],
        [maxX, y],
      ]);
    }
    // Vertical lines
    for (let x = minX; x <= maxX; x += spacing) {
      lines.push([
        [x, minY],
        [x, maxY],
      ]);
    }

    result[zid] = lines;
  }

  return result;
}
