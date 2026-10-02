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
  type: 'poison' | 'boss_orb' | 'boss_wave';
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
    p.life = 4.0;
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
    }
  }

  /** Fire a ring of projectiles (boss pattern) */
  fireRing(x: number, y: number, count: number, speed: number, damage: number, type: EnemyProjectile['type'] = 'boss_orb'): void {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
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

      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
      ctx.fill();

      // Inner glow
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(sx, sy, p.size * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }
  }
}
