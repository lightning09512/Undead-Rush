// ─── Enemy Projectiles: spitter poison, boss attacks ───

import { Pool } from '../core/pool';
import { Camera } from '../core/camera';
import { getBossSignature, type BossProjectileType } from '../data/boss-signatures';

export interface EnemyProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  damage: number;
  life: number;
  type: 'poison' | 'boss_orb' | 'boss_wave' | BossProjectileType | 'gun_round' | 'gun_round_orange' | 'gun_round_red';
  age: number;
  bossId: number;
  flightCuePlayed: boolean;
}

function createProj(): EnemyProjectile {
  return {
    x: 0, y: 0, vx: 0, vy: 0,
    size: 5, color: '#44ff44', damage: 10, life: 0,
    type: 'poison', age: 0, bossId: 0, flightCuePlayed: false,
  };
}

function resetProj(p: EnemyProjectile): void {
  p.life = 0;
}

export class EnemyProjectileSystem {
  pool: Pool<EnemyProjectile>;

  constructor() {
    this.pool = new Pool(createProj, resetProj, 50);
  }

  fire(x: number, y: number, angle: number, speed: number, damage: number, type: EnemyProjectile['type'] = 'poison', bossId = 0): void {
    const p = this.pool.acquire();
    p.x = x;
    p.y = y;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.damage = damage;
    p.life = type.startsWith('gun_round') ? 0.95 : 4.0;
    p.type = type;
    p.age = 0;
    p.bossId = bossId;
    p.flightCuePlayed = false;
    const signature = getBossSignature(bossId);

    switch (type) {
      case 'poison':
        p.size = 5;
        p.color = '#44ff66';
        break;
      case 'boss_orb':
        p.size = 8;
        p.color = '#ff44ff';
        break;
      case 'boss_wave':
        p.size = 12;
        p.color = '#ff2222';
        break;
      case 'boss_acid':
        p.size = 10;
        p.color = signature.colors.core;
        break;
      case 'boss_shard':
        p.size = 8;
        p.color = signature.colors.core;
        break;
      case 'boss_fire':
        p.size = 10;
        p.color = signature.colors.core;
        break;
      case 'boss_arcane':
        p.size = 9;
        p.color = signature.colors.core;
        break;
      case 'boss_blood':
        p.size = 12;
        p.color = signature.colors.core;
        break;
      case 'gun_round':
        p.size = 3.5;
        p.color = '#ead8a4';
        break;
      case 'gun_round_orange':
        p.size = 4;
        p.color = '#f3a24a';
        break;
      case 'gun_round_red':
        p.size = 4.4;
        p.color = '#ef6557';
        break;
    }
  }

  fireFan(x:number,y:number,angle:number,count:number,spread:number,speed:number,damage:number,type:BossProjectileType,bossId = 0):void {
    if(count<=0)return;
    for(let i=0;i<count;i++){
      const t=count===1?0:i/(count-1)-.5;
      this.fire(x,y,angle+t*spread,speed*(1-Math.abs(t)*.12),damage,type,bossId);
    }
  }

  /** Fire a ring of projectiles (boss pattern) */
  fireRing(x: number, y: number, count: number, speed: number, damage: number,
    type: EnemyProjectile['type'] = 'boss_orb', angleOffset = 0, bossId = 0): void {
    for (let i = 0; i < count; i++) {
      const angle = angleOffset + (i / count) * Math.PI * 2;
      this.fire(x, y, angle, speed, damage, type, bossId);
    }
  }

  /** Fire a spiral burst (boss pattern) */
  fireBurst(x: number, y: number, count: number, speed: number, damage: number, baseAngle: number, type: EnemyProjectile['type'] = 'boss_orb', bossId = 0): void {
    for (let i = 0; i < count; i++) {
      const angle = baseAngle + (i / count) * Math.PI * 2;
      this.fire(x, y, angle, speed * (0.8 + Math.random() * 0.4), damage, type, bossId);
    }
  }

  update(dt: number): void {
    this.pool.forEach((p) => {
      p.life -= dt;
      p.age += dt;
      if (p.life <= 0) return true;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      return false;
    });
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    for (const p of this.pool.getActive()) {
      if (!camera.isVisible(p.x, p.y)) continue;
      const [sx, sy] = camera.worldToScreen(p.x, p.y);

      const angle = Math.atan2(p.vy, p.vx);
      if (p.type.startsWith('boss_')) {
        const signature = getBossSignature(p.bossId);
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(angle);
        this.drawBossProjectile(ctx, p, signature);
        ctx.restore();
      } else if(p.type.startsWith('gun_round')){
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(angle);
        ctx.strokeStyle=p.type==='gun_round_red'?'rgba(239,101,87,.52)':p.type==='gun_round_orange'?'rgba(243,162,74,.5)':'rgba(234,216,164,.48)';
        ctx.lineWidth=p.size*.9;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-p.size*3.8,0);ctx.lineTo(p.size*.2,0);ctx.stroke();
        ctx.fillStyle=p.color;ctx.beginPath();ctx.ellipse(p.size*.3,0,p.size*1.15,p.size*.62,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#fff5d9';ctx.beginPath();ctx.arc(p.size*.45,-p.size*.12,p.size*.32,0,Math.PI*2);ctx.fill();
        ctx.restore();
      }else{
        ctx.save(); ctx.translate(sx, sy);
        ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(0,0,p.size,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#f2e8d8';ctx.globalAlpha=.62;ctx.beginPath();ctx.arc(-p.size*.12,-p.size*.12,p.size*.4,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
        ctx.restore();
      }
    }
  }

  private drawBossProjectile(ctx: CanvasRenderingContext2D, p: EnemyProjectile,
    signature: ReturnType<typeof getBossSignature>): void {
    const { core, glow, edge } = signature.colors;
    const pulse = .86 + Math.sin(p.age * 17 + signature.id) * .14;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    if (p.type === 'boss_fire') {
      // A hot core wrapped in a ragged, moving flame tail.
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = .45; ctx.strokeStyle = glow; ctx.lineWidth = p.size * 1.7;
      ctx.beginPath(); ctx.moveTo(-p.size * 4.7, Math.sin(p.age * 16) * p.size * .25); ctx.lineTo(-p.size * .25, 0); ctx.stroke();
      ctx.globalAlpha = .83; ctx.strokeStyle = '#ffbf68'; ctx.lineWidth = p.size * .7;
      ctx.beginPath(); ctx.moveTo(-p.size * 3.9, Math.sin(p.age * 19 + 1) * p.size * .2);
      ctx.lineTo(-p.size * .18, 0); ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const flick = Math.sin(p.age * 21 + i * 2.1);
        ctx.fillStyle = i === 0 ? '#ffe9a0' : glow; ctx.globalAlpha = .72 - i * .13;
        ctx.beginPath(); ctx.moveTo(-p.size * (.55 + i * .38), 0);
        ctx.lineTo(-p.size * (1.45 + i * .3), flick * p.size * .6);
        ctx.lineTo(-p.size * (.62 + i * .34), p.size * .17); ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = .92; ctx.fillStyle = core;
      ctx.beginPath(); ctx.ellipse(0, 0, p.size * .88 * pulse, p.size * .59 * pulse, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }

    if (p.type === 'boss_arcane' || p.type === 'boss_orb') {
      // Twisting twin stream and a faceted, orbiting energy seed.
      ctx.globalCompositeOperation = 'lighter';
      for (let strand = 0; strand < 2; strand++) {
        ctx.strokeStyle = strand ? core : glow; ctx.globalAlpha = strand ? .54 : .34;
        ctx.lineWidth = strand ? 1.5 : 2.4; ctx.beginPath();
        for (let i = 0; i <= 6; i++) {
          const t = i / 6, x = -p.size * (4.2 - t * 3.2);
          const y = Math.sin(p.age * 12 + t * 8 + strand * Math.PI) * p.size * .45 * (1 - t * .3);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = .66; ctx.strokeStyle = glow; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(0, 0, p.size * 1.16 * pulse, p.size * .65, p.age * 2, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = edge; ctx.globalAlpha = .96;
      ctx.beginPath(); ctx.moveTo(p.size * .9, 0); ctx.lineTo(0, -p.size * .78); ctx.lineTo(-p.size * .55, 0);
      ctx.lineTo(0, p.size * .78); ctx.closePath(); ctx.fill();
      ctx.fillStyle = core; ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.moveTo(p.size * .56, 0); ctx.lineTo(0, -p.size * .45); ctx.lineTo(-p.size * .28, 0);
      ctx.lineTo(0, p.size * .45); ctx.closePath(); ctx.fill();
      for (let i = 0; i < 2; i++) {
        const a = p.age * 3.2 + i * Math.PI;
        ctx.fillStyle = i ? core : glow; ctx.globalAlpha = .82;
        ctx.beginPath(); ctx.arc(Math.cos(a) * p.size * 1.25, Math.sin(a) * p.size * .82, p.size * .13, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      return;
    }

    if (p.type === 'boss_blood' || p.type === 'boss_wave') {
      // A dense, pulsing clot with a torn trail and bright fissures.
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = .48; ctx.strokeStyle = glow; ctx.lineWidth = p.size * 1.15;
      ctx.beginPath(); ctx.moveTo(-p.size * 4.1, Math.sin(p.age * 13) * p.size * .16); ctx.lineTo(-p.size * .35, 0); ctx.stroke();
      ctx.globalAlpha = 1; ctx.fillStyle = edge;
      ctx.beginPath(); ctx.moveTo(p.size * 1.05, 0); ctx.lineTo(p.size * .28, -p.size * .78 * pulse);
      ctx.lineTo(-p.size * .72, -p.size * .48); ctx.lineTo(-p.size * .95, p.size * .15);
      ctx.lineTo(-p.size * .27, p.size * .74); ctx.lineTo(p.size * .63, p.size * .49); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = core; ctx.lineWidth = Math.max(1.2, p.size * .13); ctx.globalAlpha = .92;
      ctx.beginPath(); ctx.moveTo(-p.size * .5, p.size * .1); ctx.lineTo(-p.size * .05, -p.size * .15);
      ctx.lineTo(p.size * .34, p.size * .23); ctx.stroke(); ctx.globalAlpha = 1;
      return;
    }

    if (p.type === 'boss_acid') {
      // Uneven bile sac, inner membrane and two trailing beads.
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = .22; ctx.fillStyle = glow;
      ctx.beginPath(); ctx.ellipse(-p.size * 1.2, 0, p.size * 2.8, p.size * 1.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = .9; ctx.fillStyle = edge;
      ctx.beginPath(); ctx.ellipse(-p.size * .08, p.size * .12, p.size * 1.04, p.size * .8, .18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(p.size * .16, 0, p.size * .77, p.size * .52, -.12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = core; ctx.globalAlpha = .87;
      ctx.beginPath(); ctx.ellipse(p.size * .35, -p.size * .2, p.size * .23, p.size * .13, -.2, 0, Math.PI * 2); ctx.fill();
      for (let i = 1; i <= 2; i++) { ctx.globalAlpha = .48; ctx.beginPath(); ctx.arc(-p.size * (1.25 + i * .56), Math.sin(p.age * 10 + i) * p.size * .32, p.size * .12, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
      return;
    }

    // Physical shrapnel keeps a hard silhouette and catches one sharp edge light.
    ctx.globalAlpha = .35; ctx.strokeStyle = glow; ctx.lineWidth = p.size * .9;
    ctx.beginPath(); ctx.moveTo(-p.size * 3.2, 0); ctx.lineTo(p.size * .1, 0); ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = edge;
    ctx.beginPath(); ctx.moveTo(-p.size * 1.3, -p.size * .37); ctx.lineTo(p.size * .28, -p.size * .56);
    ctx.lineTo(p.size * 1.45, -p.size * .08); ctx.lineTo(p.size * .16, p.size * .32);
    ctx.lineTo(-p.size * .9, p.size * .57); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = core; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-p.size * .66, p.size * .18); ctx.lineTo(p.size * .92, -p.size * .1); ctx.stroke();
  }
}
