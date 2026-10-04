import type { Camera } from '../core/camera';
import type { CampaignRect, StageDef } from '../data/meta';

type Random = () => number;

function seeded(seed: number): Random {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function patch(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number,
  color: string, random: Random): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const angle = i * Math.PI * 2 / 9;
    const distance = .76 + random() * .34;
    const px = x + Math.cos(angle) * rx * distance;
    const py = y + Math.sin(angle) * ry * distance;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill();
}

function crack(ctx: CanvasRenderingContext2D, x: number, y: number, length: number,
  angle: number, random: Random, color = 'rgba(22,29,29,.38)'): void {
  ctx.strokeStyle = color; ctx.lineWidth = 1.5 + random() * 1.3;
  const dx = Math.cos(angle), dy = Math.sin(angle);
  ctx.beginPath(); ctx.moveTo(x, y);
  for (let i = 1; i <= 4; i++) {
    const spread = (random() - .5) * length * .2;
    const px = x + dx * length * i / 4 - dy * spread;
    const py = y + dy * length * i / 4 + dx * spread;
    ctx.lineTo(px, py);
    if (i === 2 || i === 3) {
      ctx.moveTo(px, py);
      ctx.lineTo(px - dy * length * .16 + dx * length * .08,
        py + dx * length * .16 + dy * length * .08);
      ctx.moveTo(px, py);
    }
  }
  ctx.stroke();
}

function blood(ctx: CanvasRenderingContext2D, x: number, y: number, random: Random,
  size = 20, fresh = false): void {
  patch(ctx, x, y, size, size * .48,
    fresh ? 'rgba(116,38,35,.42)' : 'rgba(64,30,29,.42)', random);
  ctx.fillStyle = fresh ? 'rgba(128,48,41,.32)' : 'rgba(82,41,37,.32)';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(x + (random() - .5) * size * 2.6, y + (random() - .5) * size,
      2 + random() * 3, 1.4 + random() * 2.2, random(), 0, Math.PI * 2);
    ctx.fill();
  }
}

function grass(ctx: CanvasRenderingContext2D, x: number, y: number, random: Random, moss = false): void {
  ctx.strokeStyle = moss ? 'rgba(53,85,63,.47)' : 'rgba(77,101,67,.55)';
  ctx.lineWidth = 1.5; ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const startX = x + (i - 1.5) * 4;
    ctx.moveTo(startX, y + 5);
    ctx.quadraticCurveTo(startX + (random() - .5) * 8, y - 3,
      startX + (random() - .5) * 11, y - 7 - random() * 8);
  }
  ctx.stroke();
}

function trace(ctx: CanvasRenderingContext2D, x: number, y: number, length: number,
  angle: number, color: string): void {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(length, -5);
  ctx.moveTo(0, 5); ctx.lineTo(length, 5); ctx.stroke();
  ctx.restore();
}

/** World anchored details: paint is baked into the terrain zone cache. */
export class CampaignGroundDetails {
  private readonly bugs = new Map<string, Array<{ x: number; y: number; heading: number }>>();

  paint(ctx: CanvasRenderingContext2D, stage: StageDef, zone: number,
    width: number, height: number, floor: string): void {
    const random = seeded(stage.id * 104729 + (zone + 37) * 92821);
    const role = zone >= 0 ? stage.layout?.zones[zone]?.role : undefined;
    const intensity = zone < 0 ? .38 : role === 'entry' ? .55 : role === 'boss' ? 1.25 : 1;
    const outdoors = [1, 2, 4, 5, 7, 9].includes(stage.id);
    const rect = zone >= 0 ? stage.layout?.zones[zone]
      : stage.layout?.corridors[-zone - 1];
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, width, height); ctx.clip();

    // Broad material changes: few, irregular and subdued, never a uniform grid.
    const broadCount = Math.max(1, Math.round(width * height / 160000 * intensity));
    for (let i = 0; i < broadCount; i++) {
      const x = 45 + random() * Math.max(1, width - 90);
      const y = 45 + random() * Math.max(1, height - 90);
      const colors = [
        'rgba(23,34,32,.14)', 'rgba(23,28,25,.23)', 'rgba(78,95,88,.14)',
        'rgba(24,42,36,.20)', 'rgba(34,31,25,.17)', 'rgba(60,45,40,.13)',
        'rgba(49,38,32,.20)', 'rgba(36,66,62,.13)', 'rgba(31,29,26,.23)',
        'rgba(91,39,42,.18)',
      ];
      patch(ctx, x, y, 42 + random() * 67, 15 + random() * 34, colors[stage.id - 1], random);
    }

    const marks = Math.round(width * height / 25000 * intensity);
    for (let i = 0; i < marks; i++) {
      const edge = random() < .48;
      const x = edge ? (random() < .5 ? 24 + random() * 85 : width - 24 - random() * 85)
        : 45 + random() * Math.max(1, width - 90);
      const y = edge ? 28 + random() * Math.max(1, height - 56)
        : 45 + random() * Math.max(1, height - 90);
      if (this.nearObjective(stage, rect, x, y)) continue;
      this.materialMark(ctx, stage.id, floor, zone, x, y, random);
    }

    // Human-scale evidence grows through each chapter and toward the boss.
    const evidence = Math.round((zone < 0 ? 1 : 2 + Math.max(0, zone) * .9) * intensity);
    for (let i = 0; i < evidence; i++) {
      const x = 60 + random() * Math.max(1, width - 120);
      const y = 60 + random() * Math.max(1, height - 120);
      if (this.nearObjective(stage, rect, x, y)) continue;
      if (stage.id === 4 || stage.id === 8) {
        patch(ctx, x, y, 12 + random() * 15, 5 + random() * 8,
          stage.id === 4 ? 'rgba(43,82,63,.3)' : 'rgba(66,100,88,.27)', random);
      } else blood(ctx, x, y, random, 9 + random() * 12,
        role !== 'entry' && random() < .22);
      if (random() < .4) trace(ctx, x + 9, y + 8, 20 + random() * 28,
        random() * Math.PI * 2, 'rgba(67,35,32,.25)');
    }

    // Debris and grime collect beside authored cover and furniture.
    if (rect && zone >= 0) {
      for (const prop of stage.layout?.decorations ?? []) {
        if (!prop.solid || prop.x < rect.x - prop.w || prop.x > rect.x + width ||
          prop.y < rect.y - prop.h || prop.y > rect.y + height) continue;
        const px = prop.x - rect.x + prop.w * .7;
        const py = prop.y - rect.y + prop.h * .78;
        patch(ctx, px, py, 10 + random() * 13, 4 + random() * 7,
          outdoors ? 'rgba(29,41,34,.28)' : 'rgba(24,30,30,.24)', random);
        if (random() < .5) this.scrap(ctx, px + 13, py + 4, random,
          outdoors ? '#746b58' : '#8e9188');
      }
    }

    if (outdoors) {
      // Vegetation follows zone boundaries and cracks instead of carpetting paths.
      for (let i = 0; i < Math.round(10 * intensity); i++) {
        const side = Math.floor(random() * 4);
        const x = side === 0 ? 18 + random() * 38 : side === 1 ? width - 18 - random() * 38 : random() * width;
        const y = side === 2 ? 18 + random() * 38 : side === 3 ? height - 18 - random() * 38 : random() * height;
        grass(ctx, x, y, random, stage.id === 4 || stage.id === 9);
      }
    }
    ctx.restore();
  }

  private nearObjective(stage: StageDef, rect: CampaignRect | undefined, x: number, y: number): boolean {
    if (!rect) return false;
    const wx = rect.x + x, wy = rect.y + y;
    if (Math.hypot(wx - stage.playerStart.x, wy - stage.playerStart.y) < 90) return true;
    if (Math.hypot(wx - stage.bossSpawn.x, wy - stage.bossSpawn.y) < 115) return true;
    return stage.objectiveNodes.some(node => Math.hypot(wx - node.x, wy - node.y) < 85);
  }

  private materialMark(ctx: CanvasRenderingContext2D, id: number, floor: string, zone: number,
    x: number, y: number, random: Random): void {
    const variant = random();
    if (id === 1) {
      if (variant < .37) crack(ctx,x,y,22+random()*38,random()*6.28,random);
      else if (variant < .62) grass(ctx,x,y,random);
      else if (variant < .8) trace(ctx,x,y,24+random()*42,-.2,'rgba(33,39,38,.23)');
      else this.leaf(ctx,x,y,random);
    } else if (id === 2) {
      if (variant < .4) patch(ctx,x,y,16+random()*22,7+random()*14,'rgba(17,20,19,.39)',random);
      else if (variant < .66) trace(ctx,x,y,30+random()*55,.04,'rgba(28,29,27,.28)');
      else if (variant < .82) this.shards(ctx,x,y,random,'rgba(170,193,178,.42)');
      else patch(ctx,x,y,11+random()*15,8+random()*10,'rgba(71,39,28,.3)',random);
    } else if (id === 3) {
      if (variant < .36) trace(ctx,x,y,22+random()*36,.1,'rgba(66,73,71,.31)');
      else if (variant < .62) this.gauze(ctx,x,y,random);
      else if (variant < .79) this.footprints(ctx,x,y,random,'rgba(91,47,44,.34)');
      else patch(ctx,x,y,17,7,'rgba(104,135,126,.21)',random);
    } else if (id === 4) {
      if (variant < .43) grass(ctx,x,y,random,true);
      else if (variant < .7) patch(ctx,x,y,13+random()*20,5+random()*9,'rgba(37,78,68,.27)',random);
      else if (variant < .85) this.footprints(ctx,x,y,random,'rgba(48,52,42,.36)',.55);
      else this.scrap(ctx,x,y,random,'#756b55');
    } else if (id === 5) {
      if (variant < .34) crack(ctx,x,y,20+random()*32,random()*6.28,random);
      else if (variant < .62) this.casing(ctx,x,y,random);
      else if (variant < .82) this.footprints(ctx,x,y,random,'rgba(35,39,35,.31)');
      else trace(ctx,x,y,33+random()*40,.05,'rgba(32,36,35,.25)');
    } else if (id === 6) {
      if (variant < .4) this.shards(ctx,x,y,random,'rgba(178,200,199,.38)');
      else if (variant < .68) this.leaflet(ctx,x,y,random);
      else if (variant < .84) trace(ctx,x,y,22+random()*40,.3,'rgba(64,48,46,.27)');
      else patch(ctx,x,y,13,8,'rgba(82,57,48,.22)',random);
    } else if (id === 7) {
      if (variant < .37) this.scrap(ctx,x,y,random,'#857762');
      else if (variant < .61) patch(ctx,x,y,17+random()*20,5+random()*9,'rgba(91,51,36,.3)',random);
      else if (variant < .78) this.casing(ctx,x,y,random);
      else grass(ctx,x,y,random);
    } else if (id === 8) {
      if (variant < .32) this.shards(ctx,x,y,random,'rgba(153,197,192,.42)');
      else if (variant < .6) crack(ctx,x,y,21+random()*36,random()*6.28,random,'rgba(42,66,65,.38)');
      else if (variant < .8) patch(ctx,x,y,11+random()*24,6+random()*12,'rgba(46,95,84,.28)',random);
      else trace(ctx,x,y,19+random()*38,.05,'rgba(52,71,70,.27)');
    } else if (id === 9) {
      if (variant < .32) crack(ctx,x,y,25+random()*40,random()*6.28,random);
      else if (variant < .56) this.leaflet(ctx,x,y,random);
      else if (variant < .77) grass(ctx,x,y,random,true);
      else patch(ctx,x,y,13+random()*20,8,'rgba(39,35,33,.3)',random);
    } else {
      if (variant < .45) {
        ctx.strokeStyle='rgba(105,45,47,.4)';ctx.lineWidth=3+random()*3;
        ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x+15,y-17,x+27,y+11,x+42,y-4);ctx.stroke();
      } else if (variant < .7) this.bone(ctx,x,y,random);
      else patch(ctx,x,y,14+random()*18,8+random()*12,'rgba(80,33,37,.35)',random);
    }
    // Material hints are local to each authored floor; no same tile across chapters.
    if (floor === 'rail' && zone >= 0 && variant > .92) trace(ctx,x,y,25,0,'rgba(121,76,49,.28)');
  }

  private scrap(ctx: CanvasRenderingContext2D, x: number, y: number, random: Random, color: string): void {
    ctx.save();ctx.translate(x,y);ctx.rotate((random()-.5)*2);
    ctx.fillStyle=color;ctx.globalAlpha=.45;
    ctx.beginPath();ctx.moveTo(-5,-3);ctx.lineTo(4,-5);ctx.lineTo(8,2);ctx.lineTo(-2,5);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(21,29,28,.32)';ctx.lineWidth=1;ctx.stroke();ctx.restore();
  }

  private leaf(ctx: CanvasRenderingContext2D, x: number, y: number, random: Random): void {
    ctx.save();ctx.translate(x,y);ctx.rotate(random()*6.28);
    ctx.fillStyle='rgba(116,93,55,.55)';ctx.beginPath();ctx.moveTo(0,-6);
    ctx.quadraticCurveTo(8,-2,0,7);ctx.quadraticCurveTo(-7,1,0,-6);ctx.fill();
    ctx.strokeStyle='rgba(63,59,41,.42)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,-5);
    ctx.lineTo(0,9);ctx.stroke();ctx.restore();
  }

  private gauze(ctx: CanvasRenderingContext2D, x: number, y: number, random: Random): void {
    ctx.save();ctx.translate(x,y);ctx.rotate(random()*6.28);
    ctx.fillStyle='rgba(202,199,177,.48)';ctx.fillRect(-8,-4,16,8);
    ctx.strokeStyle='rgba(84,43,39,.34)';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(-1,-4);ctx.lineTo(3,4);ctx.stroke();ctx.restore();
  }

  private leaflet(ctx: CanvasRenderingContext2D, x: number, y: number, random: Random): void {
    ctx.save();ctx.translate(x,y);ctx.rotate((random()-.5)*1.4);
    ctx.fillStyle='rgba(172,163,139,.44)';ctx.beginPath();ctx.moveTo(-8,-7);
    ctx.lineTo(8,-6);ctx.lineTo(6,8);ctx.lineTo(-7,6);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(62,65,59,.35)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(-5,-2);ctx.lineTo(4,-2);ctx.moveTo(-5,1);ctx.lineTo(2,1);
    ctx.stroke();ctx.restore();
  }

  private bone(ctx: CanvasRenderingContext2D, x: number, y: number, random: Random): void {
    ctx.save();ctx.translate(x,y);ctx.rotate(random()*6.28);
    ctx.strokeStyle='rgba(159,147,123,.55)';ctx.lineWidth=3;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(-7,0);ctx.lineTo(7,0);ctx.moveTo(-7,-2);ctx.lineTo(-7,2);
    ctx.moveTo(7,-2);ctx.lineTo(7,2);ctx.stroke();ctx.restore();
  }

  private shards(ctx: CanvasRenderingContext2D, x: number, y: number, random: Random, color: string): void {
    ctx.fillStyle=color;
    for(let i=0;i<3;i++){
      const sx=x+(random()-.5)*24,sy=y+(random()-.5)*18;
      ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(sx+2+random()*7,sy-2);
      ctx.lineTo(sx+random()*4,sy+5+random()*4);ctx.closePath();ctx.fill();
    }
  }

  private casing(ctx: CanvasRenderingContext2D, x: number, y: number, random: Random): void {
    ctx.save();ctx.translate(x,y);ctx.rotate(random()*6.28);
    ctx.fillStyle='rgba(182,145,83,.58)';ctx.fillRect(-4,-1.5,8,3);
    ctx.fillStyle='rgba(58,56,47,.5)';ctx.fillRect(3,-1.5,2,3);ctx.restore();
  }

  private footprints(ctx: CanvasRenderingContext2D, x: number, y: number, random: Random,
    color: string, scale = 1): void {
    ctx.save();ctx.translate(x,y);ctx.rotate((random()-.5)*1.7);ctx.scale(scale,scale);
    ctx.fillStyle=color;
    for(let i=0;i<3;i++){
      const px=i*12,py=(i%2?8:-8);
      ctx.beginPath();ctx.ellipse(px,py,4,7,.3,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }

  drawBugs(ctx: CanvasRenderingContext2D, camera: Camera, stage: StageDef, zone: number,
    rect: CampaignRect, playerX: number, playerY: number, gameTime: number): void {
    if (zone < 0 || ![1, 2, 4, 5, 7, 9].includes(stage.id)) return;
    const key = `${stage.id}:${zone}`;
    let bugs = this.bugs.get(key);
    if (!bugs) {
      bugs = [];
      for (let i = 0; i < 3; i++) {
        const random = seeded(stage.id * 8191 + zone * 131 + i * 197);
        bugs.push({ x: rect.x + 45 + random() * (rect.w - 90),
          y: rect.y + 45 + random() * (rect.h - 90), heading: random() * Math.PI * 2 });
      }
      this.bugs.set(key, bugs);
    }
    for (const bug of bugs) {
      const baseX = bug.x, baseY = bug.y;
      if (!camera.isVisible(baseX, baseY, 18)) continue;
      const dx = baseX - playerX, dy = baseY - playerY;
      const distance = Math.hypot(dx, dy);
      const flee = Math.max(0, 1 - distance / 105);
      const heading = bug.heading;
      const x = baseX + Math.cos(heading + gameTime * .9) * 3 +
        (distance > 1 ? dx / distance : Math.cos(heading)) * flee * 28;
      const y = baseY + Math.sin(heading + gameTime * .9) * 3 +
        (distance > 1 ? dy / distance : Math.sin(heading)) * flee * 28;
      const [sx, sy] = camera.worldToScreen(x, y);
      ctx.save();ctx.translate(sx,sy);ctx.rotate(heading);
      ctx.fillStyle='rgba(15,23,20,.72)';ctx.beginPath();ctx.ellipse(0,0,3,2,0,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='rgba(24,30,25,.7)';ctx.lineWidth=.8;
      ctx.beginPath();ctx.moveTo(-2,-1);ctx.lineTo(-5,-4);ctx.moveTo(2,-1);ctx.lineTo(5,-4);
      ctx.moveTo(-2,1);ctx.lineTo(-5,4);ctx.moveTo(2,1);ctx.lineTo(5,4);ctx.stroke();ctx.restore();
    }
  }
}
