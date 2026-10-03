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
    size: 4, color: '#ffdd44', damage: 10, speed: 1100, life: 0,
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
    this.pool = new Pool(createBullet, resetBullet, 120);
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
      if (!camera.isVisible(b.x, b.y, 40)) continue;
      const [sx, sy] = camera.worldToScreen(b.x, b.y);

      // Angle of travel
      const angle = Math.atan2(b.vy, b.vx);
      const isShotgun = b.weaponType === 'shotgun';
      const bulletLen = isShotgun ? 13 : Math.max(16, b.size * 3.8);
      const bulletThick = isShotgun ? 2.2 : Math.max(2.5, b.size * 0.7);

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(angle);

      // ─── 1. High-Velocity Luminous Tracer Streak ───
      const tailLen = bulletLen * 2.2;
      const tailGrad = ctx.createLinearGradient(-tailLen, 0, 0, 0);
      tailGrad.addColorStop(0, 'rgba(255, 220, 50, 0)');
      tailGrad.addColorStop(0.5, b.color);
      tailGrad.addColorStop(1, '#ffffff');

      ctx.strokeStyle = tailGrad;
      ctx.lineWidth = bulletThick * 1.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-tailLen, 0);
      ctx.lineTo(0, 0);
      ctx.stroke();

      // ─── 2. Elongated Aerodynamic Bullet Slug Body ───
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.moveTo(-bulletLen * 0.45, -bulletThick);
      ctx.lineTo(bulletLen * 0.35, -bulletThick);
      ctx.quadraticCurveTo(bulletLen * 0.75, 0, bulletLen * 0.35, bulletThick);
      ctx.lineTo(-bulletLen * 0.45, bulletThick);
      ctx.closePath();
      ctx.fill();

      // ─── 3. White-Hot Incandescent Core ───
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-bulletLen * 0.25, -bulletThick * 0.45);
      ctx.lineTo(bulletLen * 0.25, -bulletThick * 0.45);
      ctx.quadraticCurveTo(bulletLen * 0.55, 0, bulletLen * 0.25, bulletThick * 0.45);
      ctx.lineTo(-bulletLen * 0.25, bulletThick * 0.45);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  }
}
