// ─── Particle System ───

import { Pool } from '../core/pool';
import { Camera } from '../core/camera';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  alpha: number;
  shrink: boolean;
}

function createParticle(): Particle {
  return { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, size: 0, color: '', alpha: 1, shrink: true };
}

function resetParticle(p: Particle): void {
  p.life = 0;
  p.alpha = 1;
}

export class ParticleSystem {
  pool: Pool<Particle>;

  constructor() {
    this.pool = new Pool(createParticle, resetParticle, 200);
  }

  emit(x: number, y: number, count: number, color: string, speed = 100, life = 0.5, size = 3): void {
    for (let i = 0; i < count; i++) {
      const p = this.pool.acquire();
      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.5 + Math.random() * 0.5);
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd;
      p.life = life * (0.5 + Math.random() * 0.5);
      p.maxLife = p.life;
      p.size = size * (0.5 + Math.random() * 0.5);
      p.color = color;
      p.alpha = 1;
      p.shrink = true;
    }
  }

  /** Directional burst */
  burst(x: number, y: number, count: number, color: string, angle: number, spread: number, speed = 120, life = 0.4): void {
    for (let i = 0; i < count; i++) {
      const p = this.pool.acquire();
      const a = angle + (Math.random() - 0.5) * spread;
      const spd = speed * (0.3 + Math.random() * 0.7);
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * spd;
      p.vy = Math.sin(a) * spd;
      p.life = life * (0.5 + Math.random() * 0.5);
      p.maxLife = p.life;
      p.size = 2 + Math.random() * 2;
      p.color = color;
      p.alpha = 1;
      p.shrink = true;
    }
  }

  update(dt: number): void {
    this.pool.forEach((p) => {
      p.life -= dt;
      if (p.life <= 0) return true; // release
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.97;
      p.vy *= 0.97;
      const ratio = p.life / p.maxLife;
      p.alpha = ratio;
      if (p.shrink) {
        p.size *= 0.99;
      }
      return false;
    });
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const active = this.pool.getActive();
    for (const p of active) {
      if (!camera.isVisible(p.x, p.y)) continue;
      const [sx, sy] = camera.worldToScreen(p.x, p.y);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }
}
