// ─── Enemy Projectiles: spitter poison, boss attacks ───

import { Pool } from '../core/pool';
import { Camera } from '../core/camera';

export interface EnemyProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  damage: number;
  life: number;
  type: 'poison' | 'boss_orb' | 'boss_wave' | 'boss_acid' | 'boss_shard' | 'gun_round' | 'gun_round_orange' | 'gun_round_red';
}

function createProj(): EnemyProjectile {
  return {
    x: 0, y: 0, vx: 0, vy: 0,
    size: 5, color: '#44ff44', damage: 10, life: 0,
    type: 'poison',
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

  fire(x: number, y: number, angle: number, speed: number, damage: number, type: EnemyProjectile['type'] = 'poison'): void {
    const p = this.pool.acquire();
    p.x = x;
    p.y = y;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.damage = damage;
    p.life = type.startsWith('gun_round') ? 0.95 : 4.0;
    p.type = type;

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
        p.color = '#a7c568';
        break;
      case 'boss_shard':
        p.size = 8;
        p.color = '#c8c5b7';
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

  fireFan(x:number,y:number,angle:number,count:number,spread:number,speed:number,damage:number,type:'boss_acid'|'boss_shard'):void {
    if(count<=0)return;
    for(let i=0;i<count;i++){
      const t=count===1?0:i/(count-1)-.5;
      this.fire(x,y,angle+t*spread,speed*(1-Math.abs(t)*.12),damage,type);
    }
  }

  /** Fire a ring of projectiles (boss pattern) */
  fireRing(x: number, y: number, count: number, speed: number, damage: number,
    type: EnemyProjectile['type'] = 'boss_orb', angleOffset = 0): void {
    for (let i = 0; i < count; i++) {
      const angle = angleOffset + (i / count) * Math.PI * 2;
      this.fire(x, y, angle, speed, damage, type);
    }
  }

  /** Fire a spiral burst (boss pattern) */
  fireBurst(x: number, y: number, count: number, speed: number, damage: number, baseAngle: number): void {
    for (let i = 0; i < count; i++) {
      const angle = baseAngle + (i / count) * Math.PI * 2;
      this.fire(x, y, angle, speed * (0.8 + Math.random() * 0.4), damage, 'boss_orb');
    }
  }

  update(dt: number): void {
    this.pool.forEach((p) => {
      p.life -= dt;
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

      const angle=Math.atan2(p.vy,p.vx);
      ctx.save();ctx.translate(sx,sy);ctx.rotate(angle);
      if(p.type==='boss_acid'){
        ctx.fillStyle='#46583a';ctx.beginPath();ctx.ellipse(-2,2,p.size*1.18,p.size*.86,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#b5cf6c';ctx.beginPath();ctx.ellipse(0,0,p.size*.82,p.size*.58,-.15,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='rgba(237,231,174,.8)';ctx.beginPath();ctx.ellipse(p.size*.23,-p.size*.2,p.size*.21,p.size*.12,-.25,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='rgba(115,133,68,.58)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-p.size*1.9,0);ctx.lineTo(-p.size*.82,0);ctx.stroke();
      }else if(p.type==='boss_shard'){
        ctx.fillStyle='#686e68';ctx.beginPath();ctx.moveTo(-p.size*1.5,0);ctx.lineTo(p.size*.2,-p.size*.62);ctx.lineTo(p.size*1.45,-p.size*.15);ctx.lineTo(p.size*.05,p.size*.7);ctx.closePath();ctx.fill();
        ctx.strokeStyle='#ddd5bd';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-p.size*.7,p.size*.1);ctx.lineTo(p.size,p.size*-.1);ctx.stroke();
      }else if(p.type.startsWith('gun_round')){
        ctx.strokeStyle=p.type==='gun_round_red'?'rgba(239,101,87,.52)':p.type==='gun_round_orange'?'rgba(243,162,74,.5)':'rgba(234,216,164,.48)';
        ctx.lineWidth=p.size*.9;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-p.size*3.8,0);ctx.lineTo(p.size*.2,0);ctx.stroke();
        ctx.fillStyle=p.color;ctx.beginPath();ctx.ellipse(p.size*.3,0,p.size*1.15,p.size*.62,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#fff5d9';ctx.beginPath();ctx.arc(p.size*.45,-p.size*.12,p.size*.32,0,Math.PI*2);ctx.fill();
      }else{
        ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(0,0,p.size,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#f2e8d8';ctx.globalAlpha=.62;ctx.beginPath();ctx.arc(-p.size*.12,-p.size*.12,p.size*.4,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
      }
      ctx.restore();
    }
  }
}
