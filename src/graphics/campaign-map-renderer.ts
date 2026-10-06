import type { Camera } from '../core/camera';
import type { StageDef, StageBuildingDef, CampaignLayout, CampaignZone, Point } from '../data/meta';
import type { GameLanguage } from '../data/localization';

export interface CampaignSpawnCue {
  zoneIndex: number;
  portalPoints: readonly Point[];
  sealedPortalPoints?: readonly boolean[];
  portalHp?: readonly number[];
  portalMaxHp?: number;
  portalDestructible?: readonly boolean[];
  warningTimer: number;
  activePortalPoint?: Point;
  activePortalTimer?: number;
  gameTime?: number;
  playerX?: number;
  playerY?: number;
}

export interface CampaignObjectiveCue {
  playerX: number;
  playerY: number;
  gameTime: number;
  holdStarted: boolean;
  exitInteractable: boolean;
  nestCharge?: {
    pickupPoint: Point;
    targetPoint: Point;
    status: 'available' | 'carried' | 'planted' | 'destroyed' | 'cancelled';
    fuseRemaining: number;
    fuseDuration: number;
  };
}

interface CampaignBoundarySegment {
  axis: 'horizontal' | 'vertical';
  coordinate: number;
  start: number;
  end: number;
  outward: -1 | 1;
}

/** Small, code-drawn Campaign landmarks and readable objective routes. */
export class CampaignMapRenderer {
  private readonly boundarySegments = new WeakMap<CampaignLayout, readonly CampaignBoundarySegment[]>();

  draw(ctx: CanvasRenderingContext2D, camera: Camera, stage: StageDef, activeNode: number, bossSpawned: boolean, exitActive = false, exitActivated = false, spawnCue?: CampaignSpawnCue, objectiveCue?: CampaignObjectiveCue, language: GameLanguage = 'vi'): void {
    const route: Point[] = [stage.playerStart, ...stage.objectiveNodes, stage.bossSpawn];
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (!stage.layout) for (let i = 0; i < route.length - 1; i++) {
      const [ax, ay] = camera.worldToScreen(route[i].x, route[i].y);
      const [bx, by] = camera.worldToScreen(route[i + 1].x, route[i + 1].y);
      ctx.strokeStyle = 'rgba(12, 15, 16, 0.42)'; ctx.lineWidth = 190;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.strokeStyle = 'rgba(143, 139, 119, 0.10)'; ctx.lineWidth = 148;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.strokeStyle = 'rgba(198, 185, 142, 0.12)'; ctx.lineWidth = 2;
      ctx.setLineDash([14, 22]); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]);
    }
    // Older layouts without Campaign zones still draw architecture in this pass,
    // after their route underlay and before objective/encounter markers.
    if (!stage.layout) this.drawArchitecture(ctx, camera, stage);
    const holdZone = stage.layout?.zones.find(zone => zone.role === 'hold');
    if (holdZone && activeNode === stage.objectiveHoldAt && !bossSpawned) {
      const pulse = .5 + .5 * Math.sin((objectiveCue?.gameTime ?? 0) * 5.5);
      this.drawHoldZoneBoundary(ctx, camera, holdZone, objectiveCue?.gameTime ?? 0, pulse);
    }
    for (let i = 0; i < stage.objectiveNodes.length; i++) {
      const p = stage.objectiveNodes[i];
      const [x, y] = camera.worldToScreen(p.x, p.y);
      if (!camera.isVisible(p.x, p.y, 90)) continue;
      const done = i < activeNode;
      const active = i === activeNode && !done && !bossSpawned;
      const isHold = stage.objectiveHoldAt === i;
      const canInteract = active && (!isHold || stage.id === 9 && !objectiveCue?.holdStarted);
      const distance = objectiveCue ? Math.hypot(objectiveCue.playerX - p.x, objectiveCue.playerY - p.y) : Infinity;
      const pulse = objectiveCue ? .5 + .5 * Math.sin(objectiveCue.gameTime * 4.2) : 0;
      if (active) this.drawObjectiveBeacon(ctx, x, y, pulse, stage.accentColor);
      this.drawObjectiveFeature(ctx, x, y, stage.id, i, stage.accentColor);
      if (done) {
        ctx.fillStyle = '#d1e0bd'; ctx.font = 'bold 13px Segoe UI, Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('✓', x + 24, y - 23);
      } else if (active) {
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.font = 'bold 10px Segoe UI, Arial';
        ctx.fillStyle = '#fff1d3';
        ctx.fillText(isHold ? language === 'en' ? `Hold for ${stage.objectiveHoldSeconds ?? 5}s` : `Giữ vị trí ${stage.objectiveHoldSeconds ?? 5} giây`
          : language === 'en' ? 'Objective' : 'Mục tiêu', x, y - 37);
        if (canInteract && distance <= 82) this.drawInteractKey(ctx, x + 32, y - 30, pulse, distance <= 74);
      }
    }
    if (spawnCue) this.drawSpawnCue(ctx, camera, spawnCue, language);
    if (objectiveCue?.nestCharge) this.drawNestChargeCue(ctx, camera, objectiveCue.nestCharge, objectiveCue, language);
    if (bossSpawned) {
      const [x, y] = camera.worldToScreen(stage.bossSpawn.x, stage.bossSpawn.y);
      if (camera.isVisible(stage.bossSpawn.x, stage.bossSpawn.y, 140)) {
        // Static, subdued arena stain. Attack telegraphs use brighter moving red.
        ctx.fillStyle = 'rgba(91,49,45,.08)'; ctx.strokeStyle = 'rgba(155,91,79,.38)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, 48, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }
    if (exitActive && stage.exitSpawn) {
      const [x, y] = camera.worldToScreen(stage.exitSpawn.x, stage.exitSpawn.y);
      if (camera.isVisible(stage.exitSpawn.x, stage.exitSpawn.y, 70)) {
        const distance = objectiveCue ? Math.hypot(objectiveCue.playerX - stage.exitSpawn.x, objectiveCue.playerY - stage.exitSpawn.y) : Infinity;
        ctx.strokeStyle = exitActivated ? '#90ad9e' : '#86c7bd'; ctx.fillStyle = 'rgba(68,126,117,.18)'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(x, y, 25, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x-10,y); ctx.lineTo(x+10,y); ctx.moveTo(x,y-10); ctx.lineTo(x,y+10); ctx.stroke();
        ctx.fillStyle = '#dce7d8'; ctx.font = 'bold 10px Segoe UI, Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(language === 'en' ? 'Exit' : 'Thoát',x,y-30);
        if (!exitActivated && objectiveCue?.exitInteractable && distance <= 88) this.drawInteractKey(ctx, x + 31, y - 24, .8, true);
      }
    }
    ctx.restore();
  }

  /** Draw static buildings before Campaign lighting so the flashlight shades their walls. */
  drawArchitecture(ctx: CanvasRenderingContext2D, camera: Camera, stage: StageDef): void {
    ctx.save();
    if (stage.layout) this.drawLayoutBoundaryWalls(ctx, camera, stage, stage.layout);
    for (const building of stage.buildings) this.drawBuilding(ctx, camera, building, stage.accentColor, stage.id);
    ctx.restore();
  }

  /**
   * Campaign rooms used to stop at a sharp floor edge, leaving the gray
   * backdrop to read like an unfinished wall. Draw a raised, location-specific
   * perimeter just outside the same walkable rectangle union used by movement.
   * The geometry is cached per layout and only visible segments are painted.
   */
  private drawLayoutBoundaryWalls(ctx: CanvasRenderingContext2D, camera: Camera, stage: StageDef, layout: CampaignLayout): void {
    const palette = this.boundaryPalette(stage.id);
    for (const segment of this.getBoundarySegments(layout)) {
      const mid = (segment.start + segment.end) / 2;
      const length = segment.end - segment.start;
      const worldX = segment.axis === 'horizontal' ? mid : segment.coordinate;
      const worldY = segment.axis === 'horizontal' ? segment.coordinate : mid;
      if (!camera.isVisible(worldX, worldY, length / 2 + 90)) continue;

      const point = (along: number, across: number): [number, number] => segment.axis === 'horizontal'
        ? camera.worldToScreen(along, segment.coordinate + segment.outward * across)
        : camera.worldToScreen(segment.coordinate + segment.outward * across, along);
      const strokeBand = (alongStart: number, alongEnd: number, across: number, width: number,
        color: string | CanvasGradient): void => {
        const [x1, y1] = point(alongStart, across);
        const [x2, y2] = point(alongEnd, across);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      };

      ctx.save();
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'bevel';
      // Cast edge shadow, dark structural core, then a bevelled material face.
      strokeBand(segment.start, segment.end, 25, 47, 'rgba(0,0,0,.52)');
      strokeBand(segment.start, segment.end, 18, 40, palette.edge);
      const [shadeX1, shadeY1] = point(mid, 2);
      const [shadeX2, shadeY2] = point(mid, 34);
      const wallShader = ctx.createLinearGradient(shadeX1, shadeY1, shadeX2, shadeY2);
      wallShader.addColorStop(0, palette.face);
      wallShader.addColorStop(.58, palette.lowlight);
      wallShader.addColorStop(1, palette.edge);
      strokeBand(segment.start, segment.end, 18, 32, wallShader);
      strokeBand(segment.start, segment.end, 18, 2, palette.lowlight);
      // A steady highlight follows the inside lip; map lighting is composited
      // after architecture, so the flashlight naturally shades this geometry.
      strokeBand(segment.start, segment.end, -2, 2.2, palette.rim);

      const inset = 14;
      const firstJoint = Math.ceil((segment.start + inset) / 82) * 82;
      for (let along = firstJoint; along < segment.end - inset; along += 82) {
        const [x1, y1] = point(along, 2);
        const [x2, y2] = point(along, 34);
        ctx.strokeStyle = palette.seam; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        const [bx, by] = point(along, 10);
        ctx.fillStyle = palette.bolt;
        ctx.beginPath(); ctx.arc(bx, by, 1.9, 0, Math.PI * 2); ctx.fill();
        if (stage.id === 3 && Math.round(along / 82) % 3 === 0) {
          // Small, readable emergency-status lens on hospital wall panels.
          const [lx, ly] = point(along + 11, 10);
          ctx.fillStyle = 'rgba(140,220,198,.78)';
          ctx.beginPath(); ctx.arc(lx, ly, 2.2, 0, Math.PI * 2); ctx.fill();
        }
        if ([2, 4, 5, 7].includes(stage.id) && Math.round(along / 82) % 4 === 0) {
          const [hx1, hy1] = point(along + 8, 13);
          const [hx2, hy2] = point(along + 17, 24);
          ctx.strokeStyle = palette.warning; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(hx1, hy1); ctx.lineTo(hx2, hy2); ctx.stroke();
        }
      }

      // Subtle material-specific scars break long gray runs without a tiled
      // texture. Their placement is tied to world coordinates and cannot swim.
      if (length > 120) {
        const scarAt = segment.start + length * .63;
        const [sx1, sy1] = point(scarAt, 8);
        const [sx2, sy2] = point(scarAt + (segment.axis === 'horizontal' ? 13 : 5), 20);
        const [sx3, sy3] = point(scarAt + (segment.axis === 'horizontal' ? 22 : 9), 15);
        ctx.strokeStyle = palette.scar; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(sx1, sy1); ctx.lineTo(sx2, sy2); ctx.lineTo(sx3, sy3); ctx.stroke();
        const [shineX, shineY] = point(scarAt + (segment.axis === 'horizontal' ? 2 : 1), 8);
        ctx.fillStyle = palette.chip; ctx.fillRect(shineX, shineY, 5, 2);
      }
      ctx.restore();
    }
  }

  private getBoundarySegments(layout: CampaignLayout): readonly CampaignBoundarySegment[] {
    const cached = this.boundarySegments.get(layout);
    if (cached) return cached;

    const rects = [...layout.zones, ...layout.corridors];
    const xs = [...new Set(rects.flatMap(rect => [rect.x, rect.x + rect.w]))].sort((a, b) => a - b);
    const ys = [...new Set(rects.flatMap(rect => [rect.y, rect.y + rect.h]))].sort((a, b) => a - b);
    const occupied = (column: number, row: number): boolean => {
      if (column < 0 || row < 0 || column >= xs.length - 1 || row >= ys.length - 1) return false;
      const x = (xs[column] + xs[column + 1]) / 2;
      const y = (ys[row] + ys[row + 1]) / 2;
      return rects.some(rect => x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h);
    };

    const raw: CampaignBoundarySegment[] = [];
    for (let row = 0; row < ys.length - 1; row++) for (let column = 0; column < xs.length - 1; column++) {
      if (!occupied(column, row)) continue;
      if (!occupied(column, row - 1)) raw.push({ axis: 'horizontal', coordinate: ys[row], start: xs[column], end: xs[column + 1], outward: -1 });
      if (!occupied(column, row + 1)) raw.push({ axis: 'horizontal', coordinate: ys[row + 1], start: xs[column], end: xs[column + 1], outward: 1 });
      if (!occupied(column - 1, row)) raw.push({ axis: 'vertical', coordinate: xs[column], start: ys[row], end: ys[row + 1], outward: -1 });
      if (!occupied(column + 1, row)) raw.push({ axis: 'vertical', coordinate: xs[column + 1], start: ys[row], end: ys[row + 1], outward: 1 });
    }

    raw.sort((a, b) => a.axis.localeCompare(b.axis) || a.coordinate - b.coordinate || a.outward - b.outward || a.start - b.start);
    const merged: CampaignBoundarySegment[] = [];
    for (const edge of raw) {
      const previous = merged.at(-1);
      if (previous && previous.axis === edge.axis && previous.coordinate === edge.coordinate &&
        previous.outward === edge.outward && edge.start <= previous.end + .001) previous.end = Math.max(previous.end, edge.end);
      else merged.push({ ...edge });
    }
    this.boundarySegments.set(layout, merged);
    return merged;
  }

  private boundaryPalette(stageId: number): {
    edge: string; face: string; lowlight: string; rim: string; seam: string;
    bolt: string; warning: string; scar: string; chip: string;
  } {
    const palettes = [
      { edge: '#28312e', face: '#596258', lowlight: '#3c443e', rim: '#bab18c', seam: 'rgba(31,38,33,.78)', bolt: '#9a967a', warning: '#c5a65e', scar: 'rgba(29,35,31,.8)', chip: 'rgba(214,204,166,.54)' },
      { edge: '#352c23', face: '#68563d', lowlight: '#483a2c', rim: '#d4b575', seam: 'rgba(38,30,23,.78)', bolt: '#c19c5b', warning: '#dfb354', scar: 'rgba(32,27,21,.82)', chip: 'rgba(232,200,135,.58)' },
      { edge: '#293431', face: '#687670', lowlight: '#46544e', rim: '#bed1c5', seam: 'rgba(34,45,41,.8)', bolt: '#a9bcae', warning: '#ba6e63', scar: 'rgba(42,53,49,.8)', chip: 'rgba(208,226,210,.58)' },
      { edge: '#1b2924', face: '#405b4d', lowlight: '#2b4037', rim: '#829a80', seam: 'rgba(18,31,26,.84)', bolt: '#78917c', warning: '#a99968', scar: 'rgba(17,27,24,.84)', chip: 'rgba(153,178,146,.52)' },
      { edge: '#302f29', face: '#5f6257', lowlight: '#41453c', rim: '#c5b57e', seam: 'rgba(31,34,30,.82)', bolt: '#aaa077', warning: '#d0ad59', scar: 'rgba(32,33,29,.84)', chip: 'rgba(218,202,153,.56)' },
      { edge: '#312d32', face: '#686369', lowlight: '#464148', rim: '#c9b6b7', seam: 'rgba(35,31,36,.82)', bolt: '#a99a9b', warning: '#c88372', scar: 'rgba(34,29,33,.82)', chip: 'rgba(223,201,198,.56)' },
      { edge: '#252d30', face: '#58666a', lowlight: '#3b4649', rim: '#aebeb9', seam: 'rgba(26,34,36,.84)', bolt: '#9bacaa', warning: '#d0a35e', scar: 'rgba(24,32,35,.84)', chip: 'rgba(201,215,205,.54)' },
      { edge: '#203233', face: '#4e6c6b', lowlight: '#344a4a', rim: '#99ceca', seam: 'rgba(24,41,41,.84)', bolt: '#86bdb7', warning: '#91c3b7', scar: 'rgba(23,39,40,.84)', chip: 'rgba(190,227,212,.58)' },
      { edge: '#34282a', face: '#66514e', lowlight: '#483738', rim: '#c18a7b', seam: 'rgba(37,26,28,.84)', bolt: '#ad786e', warning: '#cb7461', scar: 'rgba(38,24,26,.84)', chip: 'rgba(224,163,144,.56)' },
      { edge: '#302123', face: '#694344', lowlight: '#472d30', rim: '#c27b72', seam: 'rgba(35,20,23,.86)', bolt: '#b26b66', warning: '#d05c53', scar: 'rgba(39,18,23,.86)', chip: 'rgba(230,130,120,.5)' },
    ];
    return palettes[Math.max(0, Math.min(palettes.length - 1, stageId - 1))];
  }

  private drawHoldZoneBoundary(ctx: CanvasRenderingContext2D, camera: Camera, zone: CampaignZone, gameTime: number, pulse: number): void {
    const centerX = zone.x + zone.w / 2;
    const centerY = zone.y + zone.h / 2;
    if (!camera.isVisible(centerX, centerY, Math.hypot(zone.w, zone.h) / 2 + 40)) return;
    const [x1, y1] = camera.worldToScreen(zone.x, zone.y);
    const [x2, y2] = camera.worldToScreen(zone.x + zone.w, zone.y + zone.h);
    const width = x2 - x1;
    const height = y2 - y1;
    ctx.save();
    ctx.shadowColor = '#ffcf73';
    ctx.shadowBlur = 9 + pulse * 13;
    ctx.strokeStyle = `rgba(255, 207, 115, ${.55 + pulse * .4})`;
    ctx.lineWidth = 4 + pulse * 1.5;
    ctx.setLineDash([30, 18]);
    ctx.lineDashOffset = -(gameTime * 36) % 48;
    ctx.beginPath();
    ctx.roundRect(x1 - 12, y1 - 12, width + 24, height + 24, 20);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(255, 241, 198, ${.3 + pulse * .35})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x1 - 20, y1 - 20, width + 40, height + 40, 25);
    ctx.stroke();
    ctx.restore();
  }

  private drawSpawnCue(ctx: CanvasRenderingContext2D, camera: Camera, cue: CampaignSpawnCue, language: GameLanguage): void {
    const warning = cue.warningTimer > 0;
    const pulse = .5 + .5 * Math.sin((cue.gameTime ?? 0) * 5.5);
    let activeIsListed = false;
    if (cue.activePortalPoint) for (const point of cue.portalPoints) {
      if (point.x === cue.activePortalPoint.x && point.y === cue.activePortalPoint.y) { activeIsListed = true; break; }
    }
    const portalCount = cue.portalPoints.length + (cue.activePortalPoint && !activeIsListed ? 1 : 0);
    for (let i = 0; i < portalCount; i++) {
      const point = i < cue.portalPoints.length ? cue.portalPoints[i] : cue.activePortalPoint!;
      if (!camera.isVisible(point.x, point.y, 100)) continue;
      const [x, y] = camera.worldToScreen(point.x, point.y);
      ctx.save(); ctx.translate(x, y);
      const sealed = cue.sealedPortalPoints?.[i] ?? false;
      const destructible = cue.portalDestructible?.[i] ?? false;
      const flashing = !warning && !!cue.activePortalPoint && cue.activePortalPoint.x === point.x && cue.activePortalPoint.y === point.y && (cue.activePortalTimer ?? 0) > 0;
      const hpMax = cue.portalMaxHp ?? 1;
      const hp = Math.max(0, cue.portalHp?.[i] ?? hpMax);
      const hpRatio = Math.max(0, Math.min(1, hp / Math.max(1, hpMax)));
      const intensity = sealed ? .38 : warning ? .86 + pulse * .14 : flashing ? .9 + pulse * .1 : .82;
      const woundColor = sealed ? '#555451' : warning ? '#d69a66' : '#b84e47';

      // Fixed world-space infected breach. Large target brackets and its own
      // health bar communicate that the portal is a destructible object.
      if (!sealed && destructible) {
        ctx.strokeStyle = `rgba(209,93,76,${.62 + pulse * .25})`;
        ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.ellipse(0, 2, 49 + pulse * 2, 35 + pulse, -.12, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = `rgba(224,190,148,${.72 + (warning || flashing ? pulse * .24 : 0)})`;
        ctx.lineWidth = 3;
        for (let corner = 0; corner < 4; corner++) {
          const sx = corner % 2 ? 1 : -1, sy = corner > 1 ? 1 : -1;
          ctx.beginPath(); ctx.moveTo(sx * 57, sy * 20); ctx.lineTo(sx * 57, sy * 31); ctx.lineTo(sx * 45, sy * 31); ctx.stroke();
        }
      }
      ctx.fillStyle = sealed ? '#18191a' : '#241617';
      ctx.strokeStyle = woundColor; ctx.globalAlpha = intensity; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-35, 6); ctx.lineTo(-29, -12); ctx.lineTo(-17, -10); ctx.lineTo(-9, -24);
      ctx.lineTo(2, -18); ctx.lineTo(16, -23); ctx.lineTo(31, -13); ctx.lineTo(36, 2); ctx.lineTo(25, 15);
      ctx.lineTo(13, 12); ctx.lineTo(2, 24); ctx.lineTo(-12, 17); ctx.lineTo(-25, 20); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.globalAlpha = 1;
      if (!sealed && destructible) {
        ctx.fillStyle = '#090b0c'; ctx.beginPath(); ctx.ellipse(0, 0, 22 + pulse * 2, 13 + pulse, -.12, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = warning ? '#e3ad74' : '#e27c65'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-27, 3); ctx.lineTo(-13, -2); ctx.lineTo(-5, 6); ctx.lineTo(5, -9); ctx.lineTo(19, -11);
        ctx.moveTo(-12, -4); ctx.lineTo(-17, -13); ctx.moveTo(4, -8); ctx.lineTo(11, 4); ctx.moveTo(-3, 9); ctx.lineTo(-12, 14); ctx.stroke();
        ctx.fillStyle = `rgba(172,45,42,${.3 + pulse * .2})`; ctx.beginPath(); ctx.ellipse(0, 0, 14 + pulse * 2, 7 + pulse, -.12, 0, Math.PI * 2); ctx.fill();
      } else if (sealed) {
        ctx.strokeStyle = '#93918a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-15,-14); ctx.lineTo(15,14); ctx.moveTo(15,-14); ctx.lineTo(-15,14); ctx.stroke();
      }
      if (!sealed && destructible) {
        ctx.fillStyle = 'rgba(12,14,15,.96)'; ctx.strokeStyle = '#d19c77'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(-58, -82, 116, 26, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#f0ddd0'; ctx.font = '900 10px Segoe UI, Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(language === 'en' ? 'Boss nest · shoot to destroy' : 'Ổ sinh quái · bắn để phá', 0, -74, 108);
        ctx.fillStyle = '#171718'; ctx.fillRect(-51, -63, 102, 10);
        ctx.fillStyle = '#83312f'; ctx.fillRect(-49, -61, 98, 6);
        ctx.fillStyle = '#d44d45'; ctx.fillRect(-49, -61, 98 * hpRatio, 6);
        ctx.strokeStyle = '#eed8c5'; ctx.lineWidth = 1; ctx.strokeRect(-51, -63, 102, 10);
        ctx.fillStyle = '#f4e8de'; ctx.font = 'bold 9px Segoe UI, Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.ceil(hp)} / ${hpMax} HP`, 0, -47);
      }
      ctx.restore();
    }
  }

  private drawNestChargeCue(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    charge: NonNullable<CampaignObjectiveCue['nestCharge']>,
    objective: CampaignObjectiveCue,
    language: GameLanguage,
  ): void {
    if (charge.status === 'cancelled') return;
    const pulse = .5 + .5 * Math.sin(objective.gameTime * 6);
    const targetNear = Math.hypot(objective.playerX - charge.targetPoint.x, objective.playerY - charge.targetPoint.y) <= 92;

    if (charge.status === 'destroyed') {
      if (!camera.isVisible(charge.targetPoint.x, charge.targetPoint.y, 72)) return;
      const [x, y] = camera.worldToScreen(charge.targetPoint.x, charge.targetPoint.y);
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = 'rgba(24,18,18,.78)'; ctx.strokeStyle = '#76534a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 4, 34, 23, -.16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#a66557'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-13,-9); ctx.lineTo(13,9); ctx.moveTo(13,-9); ctx.lineTo(-13,9); ctx.stroke();
      ctx.restore();
      return;
    }

    if (camera.isVisible(charge.targetPoint.x, charge.targetPoint.y, 88)) {
      const [x, y] = camera.worldToScreen(charge.targetPoint.x, charge.targetPoint.y);
      ctx.save(); ctx.translate(x, y);
      ctx.strokeStyle = charge.status === 'planted' ? '#ff865f'
        : `rgba(245,194,100,${charge.status === 'carried' ? .8 + pulse * .2 : .42 + pulse * .25})`;
      ctx.lineWidth = charge.status === 'carried' ? 3 : 2;
      ctx.setLineDash(charge.status === 'carried' ? [] : [7, 5]);
      ctx.beginPath(); ctx.arc(0, 0, 34 + pulse * 4, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      for (let corner = 0; corner < 4; corner++) {
        const sx = corner % 2 ? 1 : -1, sy = corner > 1 ? 1 : -1;
        ctx.beginPath(); ctx.moveTo(sx * 42, sy * 15); ctx.lineTo(sx * 42, sy * 24); ctx.lineTo(sx * 32, sy * 24); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(13,16,16,.92)'; ctx.strokeStyle = '#d6b376'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.roundRect(-62, -66, 124, 20, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff0d0'; ctx.font = '900 9px Segoe UI, Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const label = charge.status === 'planted'
        ? language === 'en' ? `Detonates in · ${charge.fuseRemaining.toFixed(1)}s` : `Kích nổ sau · ${charge.fuseRemaining.toFixed(1)}s`
        : charge.status === 'carried' ? targetNear
          ? language === 'en' ? 'Press E · plant charge' : 'Nhấn E · đặt thuốc nổ'
          : language === 'en' ? 'Target spawn nest' : 'Ổ sinh quái mục tiêu'
          : language === 'en' ? 'Target spawn nest' : 'Ổ sinh quái mục tiêu';
      ctx.fillText(label, 0, -56, 118);
      if (charge.status === 'planted') {
        ctx.fillStyle = '#201a19'; ctx.fillRect(-48, -42, 96, 5);
        ctx.fillStyle = '#ed694f'; ctx.fillRect(-48, -42, 96 * Math.max(0, Math.min(1, charge.fuseRemaining / charge.fuseDuration)), 5);
      }
      ctx.restore();
    }

    if (charge.status !== 'available' || !camera.isVisible(charge.pickupPoint.x, charge.pickupPoint.y, 64)) return;
    const [x, y] = camera.worldToScreen(charge.pickupPoint.x, charge.pickupPoint.y);
    const nearPickup = Math.hypot(objective.playerX - charge.pickupPoint.x, objective.playerY - charge.pickupPoint.y) <= 82;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = `rgba(250,163,75,${.08 + pulse * .12})`; ctx.beginPath(); ctx.arc(0, 0, 34 + pulse * 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(255,193,104,${.66 + pulse * .3})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 22 + pulse * 2, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#45402d'; ctx.strokeStyle = '#e5b867'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-14, -12, 28, 24, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#b74737'; ctx.fillRect(-10, -3, 20, 6);
    ctx.fillStyle = '#f0d797'; ctx.beginPath(); ctx.arc(9, -10, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(13,16,16,.94)'; ctx.strokeStyle = '#d6b376'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(-48, -43, 96, 18, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff0d0'; ctx.font = '900 9px Segoe UI, Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(nearPickup ? language === 'en' ? 'Press E · take charge' : 'Nhấn E · nhặt thuốc nổ'
      : language === 'en' ? 'Explosive charge' : 'Thuốc nổ', 0, -34, 92);
    ctx.restore();
  }

  private drawObjectiveBeacon(ctx: CanvasRenderingContext2D, x: number, y: number, pulse: number, accent: string): void {
    ctx.save();
    ctx.fillStyle = `rgba(255,205,119,${.09 + pulse * .07})`;
    ctx.beginPath(); ctx.ellipse(x, y, 48 + pulse * 6, 35 + pulse * 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(255,221,163,${.52 + pulse * .28})`; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, y, 34 + pulse * 3, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = accent; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, 43 + pulse * 4, -.82, -.28); ctx.stroke();
    ctx.strokeStyle = `rgba(255,225,178,${.58 + pulse * .25})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y - 31); ctx.lineTo(x, y - 47 - pulse * 5); ctx.stroke();
    ctx.restore();
  }

  private drawInteractKey(ctx: CanvasRenderingContext2D, x: number, y: number, pulse: number, close: boolean): void {
    const w = close ? 30 : 26, h = close ? 29 : 25;
    ctx.save();
    ctx.fillStyle = `rgba(18,22,22,${.94})`; ctx.strokeStyle = `rgba(255,222,158,${.72 + pulse * .28})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff0cc'; ctx.font = `900 ${close ? 17 : 15}px Segoe UI, Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('E', x, y + .5);
    ctx.restore();
  }

  private drawObjectiveFeature(ctx: CanvasRenderingContext2D, x: number, y: number, stageId: number, nodeIndex: number, accent: string): void {
    ctx.save(); ctx.translate(x, y); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.fillStyle = '#292e30'; ctx.strokeStyle = '#88877b'; ctx.lineWidth = 3;
    if (stageId === 1) { // radio relay
      ctx.fillRect(-12,-9,24,18); ctx.strokeRect(-12,-9,24,18); ctx.strokeStyle = accent; ctx.beginPath(); ctx.moveTo(0,-9); ctx.lineTo(0,-34); ctx.moveTo(-8,-28); ctx.lineTo(8,-28); ctx.stroke();
    } else if (stageId === 2) { // fuel pump
      ctx.fillRect(-12,-19,24,38); ctx.strokeRect(-12,-19,24,38); ctx.fillStyle = '#d39b47'; ctx.fillRect(-7,-13,14,9); ctx.beginPath(); ctx.moveTo(12,-8); ctx.bezierCurveTo(27,-12,24,15,13,12); ctx.stroke();
    } else if (stageId === 3) { // power relay, triage cot, medical supplies
      if (nodeIndex === 0) {
        ctx.fillRect(-18,-20,36,40); ctx.strokeRect(-18,-20,36,40);
        ctx.strokeStyle = accent; ctx.beginPath(); ctx.moveTo(4,-13); ctx.lineTo(-4,0); ctx.lineTo(3,0); ctx.lineTo(-4,13); ctx.stroke();
      } else if (nodeIndex === 1) {
        ctx.fillRect(-25,-11,50,22); ctx.strokeRect(-25,-11,50,22); ctx.strokeStyle = accent; ctx.beginPath(); ctx.moveTo(-17,0); ctx.lineTo(17,0); ctx.moveTo(0,-7); ctx.lineTo(0,7); ctx.stroke();
      } else {
        ctx.fillRect(-22,-17,44,34); ctx.strokeRect(-22,-17,44,34); ctx.strokeStyle = accent; ctx.beginPath(); ctx.moveTo(-12,0); ctx.lineTo(12,0); ctx.moveTo(0,-12); ctx.lineTo(0,12); ctx.stroke();
      }
    } else if (stageId === 4) { // sewer valve
      ctx.beginPath(); ctx.arc(0,0,22,0,Math.PI*2); ctx.stroke(); ctx.beginPath(); ctx.arc(0,0,12,0,Math.PI*2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-17,-17); ctx.lineTo(17,17); ctx.moveTo(17,-17); ctx.lineTo(-17,17); ctx.stroke();
    } else if (stageId === 5) { // checkpoint gate control
      ctx.fillRect(-21,-10,42,20); ctx.strokeRect(-21,-10,42,20); ctx.strokeStyle = accent; ctx.beginPath(); ctx.moveTo(-14,-8); ctx.lineTo(-14,8); ctx.moveTo(-5,-8); ctx.lineTo(-5,8); ctx.moveTo(4,-8); ctx.lineTo(4,8); ctx.moveTo(13,-8); ctx.lineTo(13,8); ctx.stroke();
    } else if (stageId === 6) { // mall atrium tiles
      ctx.fillRect(-27,-27,54,54); ctx.strokeRect(-27,-27,54,54); ctx.strokeStyle = accent; ctx.beginPath(); ctx.moveTo(-9,-27); ctx.lineTo(-9,27); ctx.moveTo(9,-27); ctx.lineTo(9,27); ctx.moveTo(-27,-9); ctx.lineTo(27,-9); ctx.moveTo(-27,9); ctx.lineTo(27,9); ctx.stroke();
    } else if (stageId === 7) { // rail switch
      ctx.strokeStyle = accent; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-35,-12); ctx.lineTo(35,-12); ctx.moveTo(-35,12); ctx.lineTo(35,12); ctx.moveTo(0,12); ctx.lineTo(28,-12); ctx.stroke(); ctx.lineWidth = 2; for (let i=-3;i<=3;i++) { ctx.beginPath(); ctx.moveTo(i*9,-17); ctx.lineTo(i*9,17); ctx.stroke(); }
    } else if (stageId === 8) { // containment chamber
      ctx.fillStyle = 'rgba(89,149,151,.2)'; ctx.fillRect(-24,-24,48,48); ctx.strokeStyle = accent; ctx.strokeRect(-24,-24,48,48); ctx.beginPath(); ctx.moveTo(-21,19); ctx.lineTo(18,-20); ctx.stroke();
    } else if (stageId === 9) { // infection nest
      ctx.strokeStyle = '#884644'; ctx.lineWidth = 5; for (let i=0;i<7;i++) { const a=i*Math.PI*2/7; ctx.beginPath(); ctx.moveTo(Math.cos(a)*9,Math.sin(a)*9); ctx.lineTo(Math.cos(a)*30,Math.sin(a)*30); ctx.stroke(); }
      ctx.fillStyle = '#593537'; ctx.beginPath(); ctx.arc(0,0,13,0,Math.PI*2); ctx.fill();
    } else { // fleshy core
      ctx.fillStyle = '#643b3c'; ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-24,-8); ctx.bezierCurveTo(-28,-27,-3,-29,0,-12); ctx.bezierCurveTo(12,-30,30,-12,17,1); ctx.bezierCurveTo(35,16,10,31,0,15); ctx.bezierCurveTo(-14,32,-31,12,-17,0); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  private drawBuilding(ctx: CanvasRenderingContext2D, camera: Camera, b: StageBuildingDef, accent: string, stageId: number): void {
    if (!camera.isVisible(b.x, b.y, Math.max(b.halfWidth, b.halfHeight) + 40)) return;
    const [x, y] = camera.worldToScreen(b.x, b.y);
    const w = b.halfWidth * 2, h = b.halfHeight * 2;
    ctx.save(); ctx.translate(x, y); ctx.rotate(b.rotation);
    ctx.fillStyle = 'rgba(0,0,0,.42)'; ctx.fillRect(-w / 2 + 12, -h / 2 + 14, w, h);
    const floorByVariant: Record<string, string> = {
      suburb: '#3d433e', fuel: '#454033', medical: '#46514e', sewer: '#2e3935', military: '#343834',
      mall: '#3b3a38', rail: '#353738', lab: '#303a3b', quarantine: '#3a3534', hive: '#3b3032',
    };
    const floor = b.variant ? floorByVariant[b.variant] : b.kind === 'warehouse' ? '#303638' : '#2b3031';
    const exteriorByVariant: Record<string,string> = { suburb:'#626b5d', fuel:'#806844', medical:'#72817b' };
    ctx.fillStyle = exteriorByVariant[b.variant ?? ''] ?? (b.variant === 'hive' ? '#513a3b' : b.variant === 'lab' || b.variant === 'mall' ? '#474947' : b.kind === 'warehouse' ? '#444744' : '#383b3b'); ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = floor;
    ctx.fillRect(-w / 2 + 18, -h / 2 + 18, w - 36, h - 36);
    if (b.variant === 'suburb') {
      // Broken, broad floorboards are fixed to the house, never to the camera.
      ctx.save();
      ctx.beginPath(); ctx.rect(-w/2+19,-h/2+19,w-38,h-38); ctx.clip();
      ctx.strokeStyle = 'rgba(157,159,138,.18)'; ctx.lineWidth = 2;
      for (let py = -h/2 + 38; py < h/2 - 12; py += 34) {
        ctx.beginPath(); ctx.moveTo(-w/2+21,py); ctx.lineTo(w/2-21,py); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(17,27,27,.24)';
      ctx.beginPath(); ctx.ellipse(-w*.2,h*.12,w*.19,h*.14,-.24,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*.24,-h*.18,w*.14,h*.09,.18,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
    this.drawBuildingWalls(ctx, b, w, h, accent, stageId);
    if (b.variant === 'suburb') {
      // Distinct boarded windows sit above the wall band, fixed to the building.
      ctx.fillStyle = '#1b292b';
      ctx.fillRect(-w*.26,-h/2+3,w*.2,10);
      ctx.fillRect(w*.12,-h/2+3,w*.2,10);
      ctx.fillStyle = '#87a6a4';
      ctx.fillRect(-w*.25,-h/2+5,w*.18,4);
      ctx.fillRect(w*.13,-h/2+5,w*.18,4);
    }
    // A doorway remains visibly open and matches the collision geometry.
    if (b.large) {
      // Draw the jambs inside their exact 28x28 collision footprints so there is
      // no apparent wall beyond the solid boundary at the doorway corners.
      ctx.fillStyle = '#252c2a'; ctx.fillRect(-140, h / 2 - 28, 28, 28); ctx.fillRect(112, h / 2 - 28, 28, 28);
      ctx.fillStyle = b.variant === 'fuel' ? '#c39450' : b.variant === 'medical' ? '#9aafa3' : '#9ca58b';
      ctx.fillRect(-137, h / 2 - 27, 3, 23); ctx.fillRect(134, h / 2 - 27, 3, 23);
      ctx.fillStyle = accent; ctx.globalAlpha = .5; ctx.fillRect(-38, h / 2 - 17, 76, 5); ctx.globalAlpha = 1;
      if(b.variant==='suburb'){
        ctx.fillStyle='rgba(14,24,24,.45)'; ctx.fillRect(-122,h/2-10,244,9);
        ctx.fillStyle='#a99b78'; ctx.fillRect(-118,h/2-6,236,3);
        ctx.fillStyle='rgba(116,91,64,.68)';ctx.beginPath();ctx.moveTo(-w*.36,-h*.31);ctx.lineTo(-w*.10,-h*.36);ctx.lineTo(-w*.06,-h*.08);ctx.lineTo(-w*.33,-h*.03);ctx.closePath();ctx.fill();
        ctx.fillStyle='#6d695a';ctx.fillRect(-w*.39,-h*.42,w*.29,h*.17);ctx.strokeStyle='#a69b7f';ctx.lineWidth=3;ctx.strokeRect(-w*.39,-h*.42,w*.29,h*.17);
        ctx.fillStyle='#b9ae96';ctx.fillRect(-w*.37,-h*.4,w*.08,h*.09);ctx.fillStyle='#5c574a';ctx.fillRect(-w*.3,-h*.24,w*.14,h*.06);
        ctx.fillStyle='#69665b';ctx.fillRect(w*.12,-h*.34,w*.25,h*.16);ctx.strokeStyle='#393d3a';ctx.lineWidth=3;ctx.strokeRect(w*.12,-h*.34,w*.25,h*.16);ctx.fillStyle='#b6ad96';ctx.fillRect(w*.15,-h*.3,w*.08,h*.07);ctx.fillStyle='#827960';ctx.fillRect(w*.23,-h*.27,w*.11,h*.09);
        ctx.fillStyle='#857b65';ctx.fillRect(-w*.1,h*.13,w*.2,h*.12);ctx.strokeStyle='#423f38';ctx.lineWidth=3;ctx.strokeRect(-w*.1,h*.13,w*.2,h*.12);ctx.fillStyle='#c2b69c';ctx.fillRect(-w*.045,h*.145,w*.09,h*.065);
        ctx.strokeStyle='rgba(205,186,140,.72)';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-w*.23,h*.18);ctx.lineTo(-w*.13,h*.18);ctx.moveTo(w*.12,h*.18);ctx.lineTo(w*.22,h*.18);ctx.stroke();
      }else if(b.variant==='fuel'){
        ctx.strokeStyle='rgba(201,160,91,.55)';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-w*.39,h*.25);ctx.lineTo(-w*.19,h*.25);ctx.moveTo(w*.19,h*.25);ctx.lineTo(w*.39,h*.25);ctx.stroke();
        ctx.fillStyle='#5b5548';ctx.fillRect(-w*.34,-h*.28,w*.16,h*.23);ctx.fillRect(w*.18,-h*.28,w*.16,h*.23);ctx.strokeStyle='#a98045';ctx.lineWidth=3;ctx.strokeRect(-w*.34,-h*.28,w*.16,h*.23);ctx.strokeRect(w*.18,-h*.28,w*.16,h*.23);
        ctx.fillStyle='#c99a52';ctx.fillRect(-w*.31,-h*.24,w*.10,h*.06);ctx.fillRect(w*.21,-h*.24,w*.10,h*.06);
      }else if(b.variant==='medical'){
        ctx.strokeStyle='rgba(181,196,185,.42)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-w*.38,-h*.1);ctx.lineTo(-w*.18,-h*.1);ctx.moveTo(w*.18,-h*.1);ctx.lineTo(w*.38,-h*.1);ctx.stroke();
      }else{
        ctx.strokeStyle = 'rgba(190,184,160,.18)'; ctx.lineWidth = 2;
        for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 34, -h / 2 + 28); ctx.lineTo(i * 34, h / 2 - 38); ctx.stroke(); }
      }
    } else {
      ctx.strokeStyle = '#202425'; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(-w * .35, -h * .2); ctx.lineTo(-w * .12, h * .05); ctx.lineTo(w * .2, -h * .12); ctx.stroke();
      ctx.fillStyle = 'rgba(156,121,89,.28)'; ctx.fillRect(w * .1, h * .18, w * .2, 8);
    }
    this.drawBuildingSetDressing(ctx, b, w, h, accent);
    ctx.restore();
  }

  /** Heavy, beveled wall bands use the same 28px footprint as collision. */
  private drawBuildingWalls(ctx: CanvasRenderingContext2D, b: StageBuildingDef, w: number, h: number, accent: string, stageId: number): void {
    const left = -w / 2, right = w / 2, top = -h / 2, bottom = h / 2;
    const x0 = left + 14, x1 = right - 14;
    const y0 = -h / 2 + 14, y1 = h / 2 - 14;
    const wallPath = (path: CanvasRenderingContext2D) => {
      path.beginPath();
      if (b.large) {
        // Center lines follow the rotated collision boxes exactly, including
        // the corner overlaps and the two lower wall segments.
        path.moveTo(left, y0); path.lineTo(right, y0);
        path.moveTo(x0, top); path.lineTo(x0, bottom);
        path.moveTo(x1, top); path.lineTo(x1, bottom);
        path.moveTo(left, y1); path.lineTo(-126, y1);
        path.moveTo(126, y1); path.lineTo(right, y1);
      } else path.rect(-w / 2 + 14, -h / 2 + 14, w - 28, h - 28);
    };
    const palettes: Record<number, { face: string; shade: string; rim: string; seam: string }> = {
      1: { face: '#737b6b', shade: '#3b433e', rim: '#d5cba5', seam: 'rgba(28,34,29,.82)' },
      2: { face: '#95794f', shade: '#493b2b', rim: '#e2bd73', seam: 'rgba(39,29,19,.82)' },
      3: { face: '#81928a', shade: '#394944', rim: '#d0e0cb', seam: 'rgba(25,36,33,.82)' },
      4: { face: '#526b5f', shade: '#25352e', rim: '#a5c19a', seam: 'rgba(15,28,23,.86)' },
      5: { face: '#737766', shade: '#353b32', rim: '#d3be78', seam: 'rgba(24,29,24,.86)' },
      6: { face: '#7b7479', shade: '#403b42', rim: '#d3babe', seam: 'rgba(31,27,32,.84)' },
      7: { face: '#6c7a7e', shade: '#30383b', rim: '#c1d0cc', seam: 'rgba(23,29,31,.86)' },
      8: { face: '#5c8281', shade: '#293f40', rim: '#a5e0d8', seam: 'rgba(21,39,39,.86)' },
      9: { face: '#806967', shade: '#443335', rim: '#d39687', seam: 'rgba(36,24,26,.86)' },
      10: { face: '#754c4c', shade: '#3a272a', rim: '#ce8179', seam: 'rgba(36,22,24,.88)' },
    };
    const palette = b.variant === 'fuel' ? palettes[2] : b.variant === 'medical' ? palettes[3]
      : b.variant === 'suburb' ? palettes[1] : palettes[stageId] ?? palettes[1];
    const { face, shade, rim, seam } = palette;

    ctx.save(); ctx.lineJoin = 'bevel'; ctx.lineCap = 'butt';
    // A short cast extrusion makes the wall visibly rise off the floor. It is
    // a painted shadow only; its footprint stays aligned with existing collision.
    ctx.save(); ctx.translate(9, 12);
    wallPath(ctx); ctx.strokeStyle = 'rgba(0,0,0,.64)'; ctx.lineWidth = 35; ctx.stroke();
    wallPath(ctx); ctx.strokeStyle = shade; ctx.lineWidth = 31; ctx.stroke();
    ctx.restore();

    wallPath(ctx); ctx.strokeStyle = 'rgba(9,13,13,.92)'; ctx.lineWidth = 32; ctx.stroke();
    const faceGradient = ctx.createLinearGradient(left, top, right, bottom);
    faceGradient.addColorStop(0, rim);
    faceGradient.addColorStop(.18, face);
    faceGradient.addColorStop(.72, face);
    faceGradient.addColorStop(1, shade);
    wallPath(ctx); ctx.strokeStyle = faceGradient; ctx.lineWidth = 27; ctx.stroke();
    wallPath(ctx); ctx.strokeStyle = seam; ctx.lineWidth = 1.5; ctx.stroke();

    // Top and left bevel catches a steady overhead light; the inner edge is
    // darker, so walls read as raised geometry instead of another floor patch.
    ctx.strokeStyle = rim; ctx.globalAlpha = .92; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(left + 7, y0 - 7); ctx.lineTo(right - 7, y0 - 7);
    ctx.moveTo(x0 - 7, top + 7); ctx.lineTo(x0 - 7, bottom - 7);
    ctx.moveTo(x1 + 7, top + 7); ctx.lineTo(x1 + 7, bottom - 7);
    ctx.moveTo(left + 7, y1 + 7); ctx.lineTo(-142, y1 + 7);
    ctx.moveTo(142, y1 + 7); ctx.lineTo(right - 7, y1 + 7);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(13,18,18,.7)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(left + 12, y0 + 8); ctx.lineTo(right - 12, y0 + 8);
    ctx.moveTo(x0 + 8, top + 12); ctx.lineTo(x0 + 8, bottom - 12);
    ctx.moveTo(x1 - 8, top + 12); ctx.lineTo(x1 - 8, bottom - 12);
    ctx.stroke();

    // Staggered joints and inset plates add readable surface relief at normal zoom.
    ctx.strokeStyle = seam; ctx.lineWidth = 2;
    for (let px = x0 + 42; px < x1 - 24; px += 48) {
      ctx.beginPath(); ctx.moveTo(px, y0 - 10); ctx.lineTo(px, y0 + 10); ctx.stroke();
      if (px < -146 || px > 146) { ctx.beginPath(); ctx.moveTo(px, y1 - 10); ctx.lineTo(px, y1 + 10); ctx.stroke(); }
      ctx.fillStyle = 'rgba(220,222,199,.23)'; ctx.fillRect(px - 1, y0 - 8, 2, 5);
    }
    for (let py = y0 + 42; py < y1 - 25; py += 48) {
      ctx.beginPath(); ctx.moveTo(x0 - 10, py); ctx.lineTo(x0 + 10, py); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x1 - 10, py); ctx.lineTo(x1 + 10, py); ctx.stroke();
    }

    const plateSize = b.large ? 22 : 15;
    const corners: Array<[number, number]> = b.large
      ? [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]
      : [[left + 14, top + 14], [right - 14, top + 14], [left + 14, bottom - 14], [right - 14, bottom - 14]];
    for (const [cx, cy] of corners) {
      ctx.fillStyle = shade; ctx.strokeStyle = seam; ctx.lineWidth = 1.5;
      ctx.fillRect(cx - plateSize / 2, cy - plateSize / 2, plateSize, plateSize);
      ctx.strokeRect(cx - plateSize / 2 + .5, cy - plateSize / 2 + .5, plateSize - 1, plateSize - 1);
      ctx.fillStyle = rim; ctx.globalAlpha = .75;
      for (const boltX of [-1, 1]) for (const boltY of [-1, 1]) {
        ctx.beginPath(); ctx.arc(cx + boltX * (plateSize * .31), cy + boltY * (plateSize * .31), b.large ? 1.7 : 1.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Deterministic chipped concrete / scorched seams, fixed in building space.
    ctx.strokeStyle = b.variant === 'hive' ? 'rgba(35,12,15,.78)' : 'rgba(23,27,25,.76)';
    ctx.lineWidth = 2.5;
    for (const [cx, cy] of [[x0 + 35, y0 + 4], [x1 - 42, y0 + 5], [x0 + 7, y1 - 62]] as const) {
      ctx.beginPath(); ctx.moveTo(cx - 5, cy - 5); ctx.lineTo(cx + 1, cy); ctx.lineTo(cx - 3, cy + 6); ctx.lineTo(cx + 7, cy + 12); ctx.stroke();
      ctx.strokeStyle = 'rgba(231,223,194,.42)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx - 4, cy - 4); ctx.lineTo(cx, cy - 1); ctx.stroke();
      ctx.strokeStyle = b.variant === 'hive' ? 'rgba(35,12,15,.78)' : 'rgba(23,27,25,.76)'; ctx.lineWidth = 2.5;
    }
    ctx.restore();
  }

  private drawBuildingSetDressing(ctx: CanvasRenderingContext2D, b: StageBuildingDef, w: number, h: number, accent: string): void {
    const variant = b.variant;
    if (!variant) return;
    const sx = Math.min(1, w / 380), sy = Math.min(1, h / 250);
    ctx.save(); ctx.scale(sx, sy); ctx.globalAlpha = .74;
    ctx.lineWidth = 2; ctx.strokeStyle = accent; ctx.fillStyle = 'rgba(18,22,23,.42)';
    if (variant === 'fuel') {
      for (const px of [-80, 80]) { ctx.fillRect(px-19,-20,38,54); ctx.strokeRect(px-19,-20,38,54); ctx.fillStyle='#c6944b'; ctx.fillRect(px-12,-13,24,12); ctx.fillStyle='rgba(18,22,23,.42)'; }
      ctx.strokeStyle='#c6944b'; ctx.beginPath(); ctx.moveTo(-142,58); ctx.lineTo(142,58); ctx.stroke();
    } else if (variant === 'medical') {
      ctx.fillStyle='#7a4b48'; ctx.fillRect(-36,-24,72,48); ctx.strokeRect(-36,-24,72,48);
      ctx.fillStyle='#b77c70'; ctx.fillRect(-5,-17,10,34); ctx.fillRect(-17,-5,34,10);
      ctx.strokeStyle='#a79b86'; ctx.beginPath(); ctx.moveTo(-130,68); ctx.lineTo(130,68); ctx.stroke();
    } else if (variant === 'sewer') {
      ctx.strokeStyle='#71806e'; ctx.beginPath(); ctx.moveTo(-145,-35); ctx.lineTo(145,-35); ctx.moveTo(-145,35); ctx.lineTo(145,35); ctx.stroke();
      for (let px=-120;px<=120;px+=24) { ctx.beginPath(); ctx.moveTo(px,-27); ctx.lineTo(px,27); ctx.stroke(); }
      ctx.fillStyle='rgba(101,139,116,.16)'; ctx.fillRect(-130,-22,260,44);
    } else if (variant === 'military') {
      ctx.fillStyle='#68634e'; for (let px=-132;px<=132;px+=44) ctx.fillRect(px,-82,32,17);
      ctx.strokeStyle='#b39962'; ctx.setLineDash([9,6]); ctx.beginPath(); ctx.moveTo(-142,66); ctx.lineTo(142,66); ctx.stroke(); ctx.setLineDash([]);
    } else if (variant === 'mall') {
      ctx.strokeStyle='rgba(196,190,169,.42)';
      for(let px=-140;px<=140;px+=35){ctx.beginPath();ctx.moveTo(px,-83);ctx.lineTo(px,83);ctx.stroke();}
      for(let py=-70;py<=70;py+=35){ctx.beginPath();ctx.moveTo(-145,py);ctx.lineTo(145,py);ctx.stroke();}
    } else if (variant === 'rail') {
      ctx.strokeStyle='#8e897b'; ctx.lineWidth=6; ctx.beginPath(); ctx.moveTo(-150,-27); ctx.lineTo(150,-27); ctx.moveTo(-150,27); ctx.lineTo(150,27); ctx.stroke(); ctx.lineWidth=2;
      for(let px=-135;px<=135;px+=27){ctx.beginPath();ctx.moveTo(px,-38);ctx.lineTo(px,38);ctx.stroke();}
    } else if (variant === 'lab') {
      ctx.fillStyle='rgba(103,158,159,.18)'; ctx.fillRect(-110,-68,88,136); ctx.fillRect(22,-68,88,136);
      ctx.strokeStyle='#76a9a4'; ctx.strokeRect(-110,-68,88,136); ctx.strokeRect(22,-68,88,136);
      ctx.beginPath(); ctx.moveTo(-98,52); ctx.lineTo(-32,-34); ctx.moveTo(34,54); ctx.lineTo(98,-38); ctx.stroke();
    } else if (variant === 'quarantine') {
      ctx.fillStyle='rgba(158,75,66,.25)'; ctx.fillRect(-148,-80,296,17);
      ctx.strokeStyle='#a75b50'; ctx.setLineDash([12,8]); ctx.beginPath(); ctx.moveTo(-144,64); ctx.lineTo(144,64); ctx.stroke(); ctx.setLineDash([]);
    } else if (variant === 'hive') {
      ctx.strokeStyle='#965455'; ctx.lineWidth=5; ctx.beginPath(); ctx.moveTo(-135,-70); ctx.bezierCurveTo(-36,-20,40,-68,142,-22); ctx.moveTo(-142,64); ctx.bezierCurveTo(-42,18,40,82,138,48); ctx.stroke();
      ctx.fillStyle='rgba(128,55,58,.42)'; ctx.beginPath(); ctx.ellipse(0,0,58,35,.25,0,Math.PI*2); ctx.fill();
    } else { // suburb roof scars and walkway
      ctx.strokeStyle='rgba(180,166,139,.28)'; ctx.beginPath(); ctx.moveTo(-130,48); ctx.lineTo(130,48); ctx.moveTo(-78,-62); ctx.lineTo(48,18); ctx.stroke();
    }
    ctx.restore();
  }
}
