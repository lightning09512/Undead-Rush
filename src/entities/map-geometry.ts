import { MAP_CONFIG } from '../data/items';
import type { CampaignLayout, CampaignRect } from '../data/meta';

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

const SURVIVAL_BUILDINGS: SolidBuilding[] = [
  { x: 520, y: 720, halfWidth: 426, halfHeight: 294, kind: 'warehouse', rotation: 0, large: true },
  { x: 1680, y: 430, halfWidth: 112, halfHeight: 82, kind: 'ruin', rotation: 0.12 },
  { x: 3060, y: 970, halfWidth: 426, halfHeight: 294, kind: 'warehouse', rotation: 0, large: true },
  { x: 900, y: 1810, halfWidth: 112, halfHeight: 82, kind: 'ruin', rotation: -0.1 },
  { x: 3160, y: 2030, halfWidth: 112, halfHeight: 82, kind: 'ruin', rotation: 0.08 },
  { x: 480, y: 3070, halfWidth: 426, halfHeight: 294, kind: 'warehouse', rotation: 0, large: true },
  { x: 1840, y: 3540, halfWidth: 112, halfHeight: 82, kind: 'ruin', rotation: -0.12 },
  { x: 3410, y: 3160, halfWidth: 142, halfHeight: 98, kind: 'warehouse', rotation: 0.04 },
];
export const SOLID_BUILDINGS: SolidBuilding[] = [...SURVIVAL_BUILDINGS];

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

// Geometry is swapped only when entering/leaving a Campaign stage; collision
// checks continue to use precomputed wall rectangles during the game loop.
let BUILDING_SOLID_RECTS = SOLID_BUILDINGS.map(createSolidRects);
let campaignLayout: CampaignLayout | null = null;
let campaignObjectiveCount = 0;
let campaignBossActive = false;
let campaignBossDead = false;
let campaignWaveZones: ReadonlySet<number> = new Set<number>();
export function getCampaignBounds(): CampaignRect | null { return campaignLayout?.bounds ?? null; }

export function setCampaignGeometry(buildings?: readonly SolidBuilding[], layout?: CampaignLayout): void {
  campaignLayout = layout ?? null;
  campaignObjectiveCount = 0;
  campaignBossActive = false;
  campaignBossDead = false;
  campaignWaveZones = new Set<number>();
  const next = buildings ?? SURVIVAL_BUILDINGS;
  SOLID_BUILDINGS.splice(0, SOLID_BUILDINGS.length, ...next);
  BUILDING_SOLID_RECTS = SOLID_BUILDINGS.map(createSolidRects);
  if (campaignLayout) for (const prop of campaignLayout.decorations) {
    if (prop.solid) BUILDING_SOLID_RECTS.push([{ x: prop.x + prop.w / 2, y: prop.y + prop.h / 2,
      halfWidth: prop.w / 2, halfHeight: prop.h / 2 }]);
  }
}

export function setCampaignGateState(objectives: number, bossActive: boolean, bossDead: boolean, activeWaveZones?: ReadonlySet<number>): void {
  campaignObjectiveCount = objectives;
  campaignBossActive = bossActive;
  campaignBossDead = bossDead;
  if (activeWaveZones) campaignWaveZones = activeWaveZones;
}

export function isCampaignGateClosed(index: number): boolean {
  const gate = campaignLayout?.gates[index];
  if (!gate) return false;
  if (index === campaignLayout!.gates.length - 1 && campaignBossActive && !campaignBossDead) return true;
  if (campaignWaveZones.has(gate.afterZone)) return true;
  return campaignObjectiveCount < gate.requiredObjectives;
}

function inRect(x: number, y: number, r: CampaignRect): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function onWalkable(x: number, y: number): boolean {
  if (!campaignLayout) return x >= 0 && y >= 0 && x <= MAP_CONFIG.width && y <= MAP_CONFIG.height;
  return campaignLayout.zones.some(r => inRect(x, y, r)) || campaignLayout.corridors.some(r => inRect(x, y, r));
}

export function isCampaignWalkable(x: number, y: number, radius = 0): boolean {
  if (!campaignLayout) return true;
  if (!onWalkable(x, y) || !onWalkable(x - radius, y) || !onWalkable(x + radius, y) ||
      !onWalkable(x, y - radius) || !onWalkable(x, y + radius)) return false;
  for (let i = 0; i < campaignLayout.gates.length; i++) {
    if (isCampaignGateClosed(i)) {
      const g = campaignLayout.gates[i];
      if (x + radius > g.x && x - radius < g.x + g.w && y + radius > g.y && y - radius < g.y + g.h) return false;
    }
  }
  return true;
}

export function campaignSpawnPosition(playerX: number, playerY: number, wantedX: number, wantedY: number, radius: number): [number, number] {
  if (!campaignLayout) return [wantedX, wantedY];
  if (isCampaignWalkable(wantedX, wantedY, radius) && !isInsideBuilding(wantedX, wantedY)) return [wantedX, wantedY];
  for (const distance of [170, 230, 290, 110]) {
    for (let i = 0; i < 16; i++) {
      const angle = i * Math.PI / 8;
      const x = playerX + Math.cos(angle) * distance;
      const y = playerY + Math.sin(angle) * distance;
      if (isCampaignWalkable(x, y, radius) && !isInsideBuilding(x, y)) return [x, y];
    }
  }
  return [playerX, playerY];
}

/** Sweep in short increments so a dash or low-FPS movement cannot skip walls. */
export function resolveCampaignMovement(fromX: number, fromY: number, toX: number, toY: number, radius: number): [number, number] {
  if (!campaignLayout) return [toX, toY];
  let x = fromX, y = fromY;
  const steps = Math.max(1, Math.ceil(Math.hypot(toX - fromX, toY - fromY) / 18));
  const dx = (toX - fromX) / steps, dy = (toY - fromY) / steps;
  for (let i = 0; i < steps; i++) {
    if (isCampaignWalkable(x + dx, y, radius)) x += dx;
    if (isCampaignWalkable(x, y + dy, radius)) y += dy;
    const [clearX, clearY] = resolveBuildingCollision(x, y, radius);
    if (isCampaignWalkable(clearX, clearY, radius)) { x = clearX; y = clearY; }
  }
  return [x, y];
}

export function nearestCampaignZone(x: number, y: number): number {
  if (!campaignLayout) return -1;
  let best = 0, distance = Infinity;
  for (let i = 0; i < campaignLayout.zones.length; i++) {
    const z = campaignLayout.zones[i];
    const dx = x - (z.x + z.w / 2), dy = y - (z.y + z.h / 2);
    const d = dx * dx + dy * dy;
    if (d < distance) { distance = d; best = i; }
  }
  return best;
}

export function campaignSteeringTarget(x: number, y: number, playerX: number, playerY: number): [number, number] {
  if (!campaignLayout) return [playerX, playerY];
  const from = nearestCampaignZone(x, y), to = nearestCampaignZone(playerX, playerY);
  if (from === to || from < 0 || to < 0) return [playerX, playerY];
  const next = from < to ? from + 1 : from - 1;
  const gateIndex = Math.min(from, next);
  if (isCampaignGateClosed(gateIndex)) {
    const gate = campaignLayout.gates[gateIndex];
    // A corridor can be closest to the next room's centre before its gate.
    // Both actors on the same physical side must keep chasing each other.
    const leftOfGate = x < gate.x && playerX < gate.x;
    const rightOfGate = x > gate.x + gate.w && playerX > gate.x + gate.w;
    if (leftOfGate || rightOfGate) return [playerX, playerY];
    // When genuinely separated, approach the closed gate instead of freezing
    // at the spawn point. Collision still prevents passing through it.
    const approachX = x < gate.x ? gate.x - 55 : gate.x + gate.w + 55;
    return [approachX, gate.y + gate.h / 2];
  }
  const here = campaignLayout.zones[from], there = campaignLayout.zones[next];
  const bendX = (here.x + here.w / 2 + there.x + there.w / 2) / 2;
  const hereY = here.y + here.h / 2, thereY = there.y + there.h / 2;
  if (Math.abs(x - bendX) > 65) return [bendX, hereY];
  if (Math.abs(y - thereY) > 70) return [bendX, thereY];
  return [there.x + there.w / 2, thereY];
}

/** Find a visible corner around the solid blocking a stalled Campaign zombie. */
export function campaignDetourTarget(x: number, y: number, targetX: number, targetY: number, radius: number): [number, number] | null {
  if (!campaignLayout || !segmentHitsBuilding(x, y, targetX, targetY)) return null;
  let best: [number, number] | null = null;
  let bestScore = Infinity;
  for (const solids of BUILDING_SOLID_RECTS) for (const solid of solids) {
    const margin = radius + 26;
    for (const cornerX of [solid.x - solid.halfWidth - margin, solid.x + solid.halfWidth + margin])
      for (const cornerY of [solid.y - solid.halfHeight - margin, solid.y + solid.halfHeight + margin]) {
        if (!isCampaignWalkable(cornerX, cornerY, radius) || isInsideBuilding(cornerX, cornerY) ||
            segmentHitsBuilding(x, y, cornerX, cornerY)) continue;
        const distance = Math.hypot(cornerX - x, cornerY - y);
        if (distance > 520) continue;
        const score = distance + Math.hypot(targetX - cornerX, targetY - cornerY) * .82;
        if (score < bestScore) { bestScore = score; best = [cornerX, cornerY]; }
      }
  }
  return best;
}

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
  if (campaignLayout) for (let i = 0; i < campaignLayout.gates.length; i++) {
    if (isCampaignGateClosed(i) && inRect(x, y, campaignLayout.gates[i])) return true;
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
  if (campaignLayout) for (let i = 0; i < campaignLayout.gates.length; i++) {
    if (!isCampaignGateClosed(i)) continue;
    const gate = campaignLayout.gates[i];
    const left = gate.x, right = gate.x + gate.w, top = gate.y, bottom = gate.y + gate.h;
    let near = 0, far = 1;
    if (Math.abs(dx) < 0.00001) { if (x1 < left || x1 > right) continue; }
    else { const a = (left - x1) / dx, b = (right - x1) / dx; near = Math.max(near, Math.min(a,b)); far = Math.min(far, Math.max(a,b)); }
    if (Math.abs(dy) < 0.00001) { if (y1 < top || y1 > bottom) continue; }
    else { const a = (top - y1) / dy, b = (bottom - y1) / dy; near = Math.max(near, Math.min(a,b)); far = Math.min(far, Math.max(a,b)); }
    if (near <= far) return true;
  }
  return false;
}

export const MAP_CENTER = { x: cx, y: cy };
