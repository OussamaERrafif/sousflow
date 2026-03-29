// Zone data for the SVG farm schematic map
// Based on a 6-zone olive farm layout in the Souss-Massa region

export interface Zone {
  id: number;
  poste: string;
  bloc: string;
  surface: number;
  debit: number;
  color: string;
}

export const zones: Zone[] = [
  { id: 1, poste: "P1", bloc: "A", surface: 4.2, debit: 45, color: "#22c55e" },
  { id: 2, poste: "P2", bloc: "A", surface: 3.8, debit: 40, color: "#3b82f6" },
  { id: 3, poste: "P3", bloc: "B", surface: 5.1, debit: 55, color: "#f59e0b" },
  { id: 4, poste: "P4", bloc: "B", surface: 3.5, debit: 38, color: "#ef4444" },
  { id: 5, poste: "P5", bloc: "C", surface: 4.7, debit: 50, color: "#8b5cf6" },
  { id: 6, poste: "P6", bloc: "C", surface: 3.2, debit: 35, color: "#ec4899" },
];

// Farm outer boundary vertices
export const farmVertices: [number, number][] = [
  [50, 50],
  [450, 30],
  [780, 60],
  [800, 350],
  [750, 580],
  [400, 600],
  [60, 560],
  [30, 300],
];

// Zone polygon vertices keyed by zone id
export const zoneVertices: Record<number, [number, number][]> = {
  1: [
    [50, 50],
    [250, 40],
    [260, 200],
    [240, 300],
    [30, 300],
  ],
  2: [
    [250, 40],
    [450, 30],
    [460, 190],
    [260, 200],
  ],
  3: [
    [450, 30],
    [780, 60],
    [800, 350],
    [460, 190],
  ],
  4: [
    [460, 190],
    [800, 350],
    [750, 580],
    [500, 420],
  ],
  5: [
    [240, 300],
    [460, 190],
    [500, 420],
    [400, 600],
    [200, 500],
  ],
  6: [
    [30, 300],
    [240, 300],
    [200, 500],
    [400, 600],
    [60, 560],
  ],
};

// Label positions (center of each zone)
export const zoneLabels: Record<number, { x: number; y: number }> = {
  1: { x: 155, y: 160 },
  2: { x: 355, y: 115 },
  3: { x: 620, y: 160 },
  4: { x: 630, y: 390 },
  5: { x: 380, y: 400 },
  6: { x: 180, y: 440 },
};

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
