import type { Camera } from '../core/camera';
import type { StageDef, StageBuildingDef, CampaignZone, Point } from '../data/meta';

export interface CampaignSpawnCue {
  zoneIndex: number;
  portalPoints: readonly Point[];
  sealedPortalPoints?: readonly boolean[];
  portalHp?: readonly number[];
  portalMaxHp?: number;
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
}

/** Small, code-drawn Campaign landmarks and readable objective routes. */
export class CampaignMapRenderer {
  draw(ctx: CanvasRenderingContext2D, camera: Camera, stage: StageDef, activeNode: number, bossSpawned: boolean, exitActive = false, exitActivated = false, objectiveHp = 0, spawnCue?: CampaignSpawnCue, objectiveCue?: CampaignObjectiveCue): void {
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
    for (const building of stage.buildings) this.drawBuilding(ctx, camera, building, stage.accentColor);
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
      const shoot = stage.id === 10 || stage.id === 9 && i < 2;
      const canInteract = active && !shoot && (!isHold || stage.id === 9 && !objectiveCue?.holdStarted);
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
        ctx.fillText(shoot ? 'BẮN PHÁ' : isHold ? `GIỮ VỊ TRÍ ${stage.objectiveHoldSeconds ?? 5} GIÂY` : 'MỤC TIÊU', x, y - 37);
        if (canInteract && distance <= 82) this.drawInteractKey(ctx, x + 32, y - 30, pulse, distance <= 74);
      }
      if (shoot && i === activeNode) {
        ctx.fillStyle = '#181e1e'; ctx.fillRect(x - 28, y + 35, 56, 5);
        ctx.fillStyle = '#bd6e5b'; ctx.fillRect(x - 28, y + 35, 56 * Math.max(0, Math.min(1, objectiveHp / (150 + (stage.id - 1) * 12 + i * 30))), 5);
      }
    }
    if (spawnCue) this.drawSpawnCue(ctx, camera, spawnCue);
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
        ctx.fillStyle = '#dce7d8'; ctx.font = 'bold 10px Segoe UI, Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText('THOÁT',x,y-30);
        if (!exitActivated && objectiveCue?.exitInteractable && distance <= 88) this.drawInteractKey(ctx, x + 31, y - 24, .8, true);
      }
    }
    ctx.restore();
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

  private drawSpawnCue(ctx: CanvasRenderingContext2D, camera: Camera, cue: CampaignSpawnCue): void {
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
      const destructible = cue.portalHp?.[i] !== undefined && cue.portalMaxHp !== undefined;
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
        ctx.fillText('Ổ SPAWN · BẮN ĐỂ PHÁ', 0, -74, 108);
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

  private drawBuilding(ctx: CanvasRenderingContext2D, camera: Camera, b: StageBuildingDef, accent: string): void {
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
    const exteriorByVariant: Record<string,string> = { suburb:'#596057', fuel:'#735d3f', medical:'#697873' };
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
    ctx.strokeStyle = b.variant === 'suburb' ? '#303a39' : '#77766b'; ctx.lineWidth = b.large ? 20 : 13;
    if (b.large) {
      ctx.beginPath();
      ctx.moveTo(-w/2+5,-h/2+5); ctx.lineTo(w/2-5,-h/2+5);
      ctx.moveTo(-w/2+5,-h/2+5); ctx.lineTo(-w/2+5,h/2-5);
      ctx.moveTo(w/2-5,-h/2+5); ctx.lineTo(w/2-5,h/2-5);
      ctx.moveTo(-w/2+5,h/2-5); ctx.lineTo(-126,h/2-5);
      ctx.moveTo(126,h/2-5); ctx.lineTo(w/2-5,h/2-5); ctx.stroke();
    } else ctx.strokeRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10);
    if (b.variant === 'suburb') {
      // Pale top edges and a dark inner seam give each solid wall a clear height.
      ctx.strokeStyle = '#a3aa99'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-w/2+11,-h/2+10); ctx.lineTo(w/2-11,-h/2+10);
      ctx.moveTo(-w/2+11,-h/2+10); ctx.lineTo(-w/2+11,h/2-14);
      ctx.moveTo(w/2-11,-h/2+10); ctx.lineTo(w/2-11,h/2-14);
      ctx.moveTo(-w/2+11,h/2-10); ctx.lineTo(-126,h/2-10);
      ctx.moveTo(126,h/2-10); ctx.lineTo(w/2-11,h/2-10); ctx.stroke();
      ctx.fillStyle = '#1b292b';
      ctx.fillRect(-w*.26,-h/2+3,w*.2,10);
      ctx.fillRect(w*.12,-h/2+3,w*.2,10);
      ctx.fillStyle = '#87a6a4';
      ctx.fillRect(-w*.25,-h/2+5,w*.18,4);
      ctx.fillRect(w*.13,-h/2+5,w*.18,4);
    }
    // A doorway remains visibly open and matches the collision geometry.
    if (b.large) {
      ctx.strokeStyle = '#282c2d'; ctx.lineWidth = 25;
      ctx.beginPath(); ctx.moveTo(-126, h / 2 - 3); ctx.lineTo(-126, h / 2 - 32); ctx.moveTo(126, h / 2 - 3); ctx.lineTo(126, h / 2 - 32); ctx.stroke();
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
