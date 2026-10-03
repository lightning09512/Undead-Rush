import type { Camera } from '../core/camera';
import type { StageDef, StageBuildingDef, Point } from '../data/meta';

/** Small, code-drawn Campaign landmarks and readable objective routes. */
export class CampaignMapRenderer {
  draw(ctx: CanvasRenderingContext2D, camera: Camera, stage: StageDef, activeNode: number, bossSpawned: boolean, exitActive = false, exitActivated = false): void {
    const route: Point[] = [stage.playerStart, ...stage.objectiveNodes, stage.bossSpawn];
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < route.length - 1; i++) {
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
    for (let i = 0; i < stage.objectiveNodes.length; i++) {
      const p = stage.objectiveNodes[i];
      const [x, y] = camera.worldToScreen(p.x, p.y);
      if (!camera.isVisible(p.x, p.y, 90)) continue;
      const done = i < activeNode;
      this.drawObjectiveFeature(ctx, x, y, stage.id, i, stage.accentColor);
      ctx.fillStyle = done ? 'rgba(76, 131, 91, .20)' : 'rgba(207, 154, 67, .18)';
      ctx.strokeStyle = done ? '#83ad82' : stage.accentColor;
      ctx.lineWidth = done ? 2 : 2.5;
      ctx.beginPath(); ctx.arc(x, y, 27, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = done ? '#a5c99d' : '#f1d29a';
      ctx.font = 'bold 11px Segoe UI, Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      const isHold = stage.objectiveHoldAt === i;
      ctx.fillText(done ? '✓' : isHold ? `GIỮ ${i + 1}` : `Q  ${i + 1}`, x, y - 34);
    }
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
        ctx.strokeStyle = exitActivated ? '#90ad9e' : '#86c7bd'; ctx.fillStyle = 'rgba(68,126,117,.18)'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(x, y, 25, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x-10,y); ctx.lineTo(x+10,y); ctx.moveTo(x,y-10); ctx.lineTo(x,y+10); ctx.stroke();
        ctx.fillStyle = '#dce7d8'; ctx.font = 'bold 10px Segoe UI, Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText('THOÁT',x,y-30);
      }
    }
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
      suburb: '#303638', fuel: '#393732', medical: '#333a39', sewer: '#2e3935', military: '#343834',
      mall: '#3b3a38', rail: '#353738', lab: '#303a3b', quarantine: '#3a3534', hive: '#3b3032',
    };
    const floor = b.variant ? floorByVariant[b.variant] : b.kind === 'warehouse' ? '#303638' : '#2b3031';
    ctx.fillStyle = b.variant === 'hive' ? '#513a3b' : b.variant === 'lab' || b.variant === 'mall' ? '#474947' : b.kind === 'warehouse' ? '#444744' : '#383b3b'; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = floor;
    ctx.fillRect(-w / 2 + 18, -h / 2 + 18, w - 36, h - 36);
    ctx.strokeStyle = '#77766b'; ctx.lineWidth = b.large ? 20 : 13;
    if (b.large) {
      ctx.beginPath();
      ctx.moveTo(-w/2+5,-h/2+5); ctx.lineTo(w/2-5,-h/2+5);
      ctx.moveTo(-w/2+5,-h/2+5); ctx.lineTo(-w/2+5,h/2-5);
      ctx.moveTo(w/2-5,-h/2+5); ctx.lineTo(w/2-5,h/2-5);
      ctx.moveTo(-w/2+5,h/2-5); ctx.lineTo(-126,h/2-5);
      ctx.moveTo(126,h/2-5); ctx.lineTo(w/2-5,h/2-5); ctx.stroke();
    } else ctx.strokeRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10);
    // A doorway remains visibly open and matches the collision geometry.
    if (b.large) {
      ctx.strokeStyle = '#282c2d'; ctx.lineWidth = 25;
      ctx.beginPath(); ctx.moveTo(-126, h / 2 - 3); ctx.lineTo(-126, h / 2 - 32); ctx.moveTo(126, h / 2 - 3); ctx.lineTo(126, h / 2 - 32); ctx.stroke();
      ctx.fillStyle = accent; ctx.globalAlpha = .5; ctx.fillRect(-38, h / 2 - 17, 76, 5); ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(190,184,160,.18)'; ctx.lineWidth = 2;
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 34, -h / 2 + 28); ctx.lineTo(i * 34, h / 2 - 38); ctx.stroke(); }
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
