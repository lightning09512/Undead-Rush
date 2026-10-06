// ─── Bullet Entity ───

import { Pool } from '../core/pool';
import { Camera } from '../core/camera';
import { segmentHitsBuilding, segmentLeavesCampaignWalkable } from './map-geometry';

const GUN_PROJECTILE_SPEED_MULTIPLIER = 1.25;

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

interface BulletVisual {
  canvas: HTMLCanvasElement;
  originX: number;
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
  private readonly visuals = new Map<string, BulletVisual>();
  private static readonly MAX_CACHED_VISUALS = 48;

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
    const projectileSpeed = weaponType === 'grenade' || weaponType === 'mine' || weaponType === 'drone'
      ? speed
      : speed * GUN_PROJECTILE_SPEED_MULTIPLIER;
    b.x = x;
    b.y = y;
    b.vx = Math.cos(angle) * projectileSpeed;
    b.vy = Math.sin(angle) * projectileSpeed;
    b.damage = damage;
    b.speed = projectileSpeed;
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

  update(dt: number, collideBuildings = true): void {
    this.pool.forEach((b) => {
      b.life -= dt;
      if (b.life <= 0) return true; // release

      const nextX = b.x + b.vx * dt;
      const nextY = b.y + b.vy * dt;
      // Sweep the complete projectile path against the same rotated solid
      // geometry used by actors; endpoint-only checks can miss thin corners.
      if (collideBuildings && (segmentHitsBuilding(b.x, b.y, nextX, nextY) ||
          segmentLeavesCampaignWalkable(b.x, b.y, nextX, nextY))) return true;
      b.x = nextX;
      b.y = nextY;
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
      const visual = this.getVisual(b, bulletLen, bulletThick);

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(angle);
      ctx.drawImage(visual.canvas, -visual.originX, -visual.canvas.height / 2);

      ctx.restore();
    }
  }

  get performanceStats(): { activeBullets: number; cachedBulletVisuals: number } {
    return { activeBullets: this.pool.activeCount, cachedBulletVisuals: this.visuals.size };
  }

  private getVisual(bullet: Bullet, bulletLen: number, bulletThick: number): BulletVisual {
    const len = Math.round(bulletLen * 2) / 2;
    const thick = Math.round(bulletThick * 2) / 2;
    const key = `${bullet.weaponType}|${bullet.color}|${len}|${thick}`;
    const cached = this.visuals.get(key);
    if (cached) {
      this.visuals.delete(key);
      this.visuals.set(key, cached);
      return cached;
    }

    const tailLen = len * 2.2;
    const padding = 10;
    const width = Math.ceil(tailLen + len * .75 + padding * 2);
    const height = Math.ceil(thick * 2 + 12);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const spriteCtx = canvas.getContext('2d')!;
    const originX = tailLen + padding;
    spriteCtx.save();
    spriteCtx.translate(originX, height / 2);

    const tailGrad = spriteCtx.createLinearGradient(-tailLen, 0, 0, 0);
    tailGrad.addColorStop(0, 'rgba(255, 220, 50, 0)');
    tailGrad.addColorStop(.5, bullet.color);
    tailGrad.addColorStop(1, '#ffffff');
    spriteCtx.strokeStyle = tailGrad;
    spriteCtx.lineWidth = thick * 1.4;
    spriteCtx.lineCap = 'round';
    spriteCtx.beginPath();
    spriteCtx.moveTo(-tailLen, 0);
    spriteCtx.lineTo(0, 0);
    spriteCtx.stroke();

    spriteCtx.shadowColor = bullet.color;
    spriteCtx.shadowBlur = 8;
    spriteCtx.fillStyle = bullet.color;
    spriteCtx.beginPath();
    spriteCtx.moveTo(-len * .45, -thick);
    spriteCtx.lineTo(len * .35, -thick);
    spriteCtx.quadraticCurveTo(len * .75, 0, len * .35, thick);
    spriteCtx.lineTo(-len * .45, thick);
    spriteCtx.closePath();
    spriteCtx.fill();

    spriteCtx.shadowBlur = 0;
    spriteCtx.fillStyle = '#ffffff';
    spriteCtx.beginPath();
    spriteCtx.moveTo(-len * .25, -thick * .45);
    spriteCtx.lineTo(len * .25, -thick * .45);
    spriteCtx.quadraticCurveTo(len * .55, 0, len * .25, thick * .45);
    spriteCtx.lineTo(-len * .25, thick * .45);
    spriteCtx.closePath();
    spriteCtx.fill();
    spriteCtx.restore();

    const visual = { canvas, originX };
    this.visuals.set(key, visual);
    while (this.visuals.size > BulletSystem.MAX_CACHED_VISUALS) {
      const oldest = this.visuals.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.visuals.delete(oldest);
    }
    return visual;
  }
}
