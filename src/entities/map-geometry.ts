import { MAP_CONFIG } from '../data/items';

export interface SolidBuilding {
  x: number;
  y: number;
  halfWidth: number;
  halfHeight: number;
  kind: 'warehouse' | 'ruin';
  rotation: number;
  large?: boolean;
}

const cx = MAP_CONFIG.width / 2;
const cy = MAP_CONFIG.height / 2;

export const SOLID_BUILDINGS: SolidBuilding[] = [
  { x: 520, y: 720, halfWidth: 426, halfHeight: 294, kind: 'warehouse', rotation: 0, large: true },
  { x: 1680, y: 430, halfWidth: 112, halfHeight: 82, kind: 'ruin', rotation: 0.12 },
  { x: 3060, y: 970, halfWidth: 426, halfHeight: 294, kind: 'warehouse', rotation: 0, large: true },
  { x: 900, y: 1810, halfWidth: 112, halfHeight: 82, kind: 'ruin', rotation: -0.1 },
  { x: 3160, y: 2030, halfWidth: 112, halfHeight: 82, kind: 'ruin', rotation: 0.08 },
  { x: 480, y: 3070, halfWidth: 426, halfHeight: 294, kind: 'warehouse', rotation: 0, large: true },
  { x: 1840, y: 3540, halfWidth: 112, halfHeight: 82, kind: 'ruin', rotation: -0.12 },
  { x: 3410, y: 3160, halfWidth: 142, halfHeight: 98, kind: 'warehouse', rotation: 0.04 },
];

interface SolidRect { x: number; y: number; halfWidth: number; halfHeight: number; }

function createSolidRects(building: SolidBuilding): SolidRect[] {
  const { x, y, halfWidth: hw, halfHeight: hh } = building;
  if (!building.large) return [{ x, y, halfWidth: hw, halfHeight: hh }];

  // Large warehouses have three solid walls and two short lower wall sections,
  // leaving a wide doorway at the bottom so the interior can be entered.
  const wall = 24;
  const doorwayHalfWidth = 126;
  const segmentHalfWidth = (hw - doorwayHalfWidth) / 2;
  const segmentOffset = doorwayHalfWidth + segmentHalfWidth;
  return [
    { x: x - hw + wall / 2, y, halfWidth: wall / 2, halfHeight: hh },
    { x: x + hw - wall / 2, y, halfWidth: wall / 2, halfHeight: hh },
    { x, y: y - hh + wall / 2, halfWidth: hw, halfHeight: wall / 2 },
    { x: x - segmentOffset, y: y + hh - wall / 2, halfWidth: segmentHalfWidth, halfHeight: wall / 2 },
    { x: x + segmentOffset, y: y + hh - wall / 2, halfWidth: segmentHalfWidth, halfHeight: wall / 2 },
    // Door jambs prevent squeezing through the corners of the opening.
    { x: x - doorwayHalfWidth, y: y + hh - wall / 2, halfWidth: wall / 2, halfHeight: wall / 2 },
    { x: x + doorwayHalfWidth, y: y + hh - wall / 2, halfWidth: wall / 2, halfHeight: wall / 2 },
  ];
}

// Building geometry never changes during a run. Build these rectangles once
// instead of recreating their arrays and rectangles for every entity collision.
const BUILDING_SOLID_RECTS = SOLID_BUILDINGS.map(createSolidRects);

export function resolveBuildingCollision(x: number, y: number, radius: number): [number, number] {
  for (const solids of BUILDING_SOLID_RECTS) {
    for (const solid of solids) {
      const left = solid.x - solid.halfWidth;
      const right = solid.x + solid.halfWidth;
      const top = solid.y - solid.halfHeight;
      const bottom = solid.y + solid.halfHeight;
      const nearestX = Math.max(left, Math.min(right, x));
      const nearestY = Math.max(top, Math.min(bottom, y));
      const dx = x - nearestX;
      const dy = y - nearestY;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq >= radius * radius) continue;

      if (distanceSq > 0.001) {
        const distance = Math.sqrt(distanceSq);
        x += (dx / distance) * (radius - distance);
        y += (dy / distance) * (radius - distance);
      } else {
        const pushLeft = x - left;
        const pushRight = right - x;
        const pushTop = y - top;
        const pushBottom = bottom - y;
        const nearestEdge = Math.min(pushLeft, pushRight, pushTop, pushBottom);
        if (nearestEdge === pushLeft) x = left - radius;
        else if (nearestEdge === pushRight) x = right + radius;
        else if (nearestEdge === pushTop) y = top - radius;
        else y = bottom + radius;
      }
    }
  }
  return [x, y];
}

export function isInsideBuilding(x: number, y: number): boolean {
  for (const solids of BUILDING_SOLID_RECTS) {
    for (const solid of solids) {
      if (
        x >= solid.x - solid.halfWidth && x <= solid.x + solid.halfWidth &&
        y >= solid.y - solid.halfHeight && y <= solid.y + solid.halfHeight
      ) return true;
    }
  }
  return false;
}

/** Slab intersection for melee sight lines, including thin warehouse walls. */
export function segmentHitsBuilding(x1: number, y1: number, x2: number, y2: number): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  for (const solids of BUILDING_SOLID_RECTS) {
    for (const s of solids) {
      let near = 0;
      let far = 1;
      if (Math.abs(dx) < 0.00001) {
        if (x1 < s.x - s.halfWidth || x1 > s.x + s.halfWidth) continue;
      } else {
        const a = (s.x - s.halfWidth - x1) / dx;
        const b = (s.x + s.halfWidth - x1) / dx;
        near = Math.max(near, Math.min(a, b));
        far = Math.min(far, Math.max(a, b));
      }
      if (Math.abs(dy) < 0.00001) {
        if (y1 < s.y - s.halfHeight || y1 > s.y + s.halfHeight) continue;
      } else {
        const a = (s.y - s.halfHeight - y1) / dy;
        const b = (s.y + s.halfHeight - y1) / dy;
        near = Math.max(near, Math.min(a, b));
        far = Math.min(far, Math.max(a, b));
      }
      if (near <= far) return true;
    }
  }
  return false;
}

export const MAP_CENTER = { x: cx, y: cy };
