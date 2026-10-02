// ─── Bullet Entity ───

import { Pool } from '../core/pool';
import { Camera } from '../core/camera';

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  damage: number;
  speed: number;
  life: number;
  pierceLeft: number;
  /** Hits tracked to avoid double-hit on same zombie */
  hitIds: Set<number>;
  // Effects
  explosive: number;  // radius, 0 = none
  burn: number;
  slow: number;
  // Weapon type
  weaponType: string;
}

function createBullet(): Bullet {
  return {
    x: 0, y: 0, vx: 0, vy: 0,
    size: 4, color: '#ffdd44', damage: 10, speed: 450, life: 0,
    pierceLeft: 0, hitIds: new Set(),
    explosive: 0, burn: 0, slow: 0,
    weaponType: 'pistol',
  };
}

function resetBullet(b: Bullet): void {
  b.life = 0;
  b.pierceLeft = 0;
  b.hitIds.clear();
  b.explosive = 0;
  b.burn = 0;
  b.slow = 0;
}

export class BulletSystem {
  pool: Pool<Bullet>;

  constructor() {
    this.pool = new Pool(createBullet, resetBullet, 100);
  }

  fire(
    x: number, y: number, angle: number,
    damage: number, speed: number, size: number, color: string,
    pierce = 0, explosive = 0, burn = 0, slow = 0,
    weaponType = 'pistol'
  ): Bullet {
    const b = this.pool.acquire();
    b.x = x;
    b.y = y;
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
    b.damage = damage;
    b.speed = speed;
    b.size = size;
    b.color = color;
    b.life = 2.0; // seconds
    b.pierceLeft = pierce;
    b.explosive = explosive;
    b.burn = burn;
    b.slow = slow;
    b.weaponType = weaponType;
    return b;
  }

  update(dt: number): void {
    this.pool.forEach((b) => {
      b.life -= dt;
      if (b.life <= 0) return true; // release

      b.x += b.vx * dt;
      b.y += b.vy * dt;
      return false;
    });
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const active = this.pool.getActive();
    for (const b of active) {
      if (!camera.isVisible(b.x, b.y)) continue;
      const [sx, sy] = camera.worldToScreen(b.x, b.y);

      // Glow
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(sx, sy, b.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Trail
      const trailX = sx - b.vx * 0.02;
      const trailY = sy - b.vy * 0.02;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.arc(trailX, trailY, b.size * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}
