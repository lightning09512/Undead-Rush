// ─── XP Gem Entity ───

import { Pool } from '../core/pool';
import { Camera } from '../core/camera';
import { XP_GEMS } from '../data/items';
import { LightingRenderer } from '../graphics/lighting';

export interface XpGem {
  x: number;
  y: number;
  size: number;
  color: string;
  glowColor: string;
  value: number;
  /** When being pulled toward player */
  magnetized: boolean;
  wobble: number;
}

function createGem(): XpGem {
  return {
    x: 0, y: 0, size: 5, color: '#73b9cf', glowColor: '#3d859d',
    value: 5, magnetized: false, wobble: 0,
  };
}

function resetGem(g: XpGem): void {
  g.magnetized = false;
  g.wobble = 0;
}

export class XpGemSystem {
  pool: Pool<XpGem>;

  constructor() {
    this.pool = new Pool(createGem, resetGem, 200);
  }

  /** Drop gems at position based on XP value */
  drop(x: number, y: number, totalXp: number): void {
    // Scatter offset
    const scatter = 20;

    while (totalXp > 0) {
      // Pick gem size
      let gemDef;
      if (totalXp >= 50) {
        gemDef = XP_GEMS[2]; // large
      } else if (totalXp >= 15) {
        gemDef = XP_GEMS[1]; // medium
      } else {
        gemDef = XP_GEMS[0]; // small
      }

      const g = this.pool.acquire();
      g.x = x + (Math.random() - 0.5) * scatter;
      g.y = y + (Math.random() - 0.5) * scatter;
      g.size = gemDef.size;
      g.color = gemDef.color;
      g.glowColor = gemDef.glowColor;
      g.value = gemDef.value;
      g.wobble = Math.random() * Math.PI * 2;

      totalXp -= gemDef.value;
    }
  }

  /** Magnetize all gems on screen */
  magnetizeAll(): void {
    for (const g of this.pool.getActive()) {
      g.magnetized = true;
    }
  }

  update(dt: number, playerX: number, playerY: number, pickupRadius: number): XpGem[] {
    const collected: XpGem[] = [];

    this.pool.forEach((g) => {
      g.wobble += dt * 3;

      // Pull toward player if magnetized or in pickup range
      const dx = playerX - g.x;
      const dy = playerY - g.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (g.magnetized || dist < pickupRadius) {
        g.magnetized = true;
        const speed = 400;
        if (dist > 5) {
          g.x += (dx / dist) * speed * dt;
          g.y += (dy / dist) * speed * dt;
        }
      }

      // Collect
      if (dist < 15) {
        collected.push(g);
        return true; // release
      }

      return false;
    });

    return collected;
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const active = this.pool.getActive();
    for (const g of active) {
      if (!camera.isVisible(g.x, g.y)) continue;
      const [sx, sy] = camera.worldToScreen(g.x, g.y);

      const wobbleY = Math.sin(g.wobble) * 1.5;
      const tier = g.value >= 50 ? 2 : g.value >= 15 ? 1 : 0;
      const radius = tier === 2 ? 12 : tier === 1 ? 9 : 7;

      LightingRenderer.get().drawGlow(ctx, sx, sy + wobbleY, radius * 2.5, g.glowColor, 0.34);
      ctx.save();
      ctx.translate(sx, sy + wobbleY);
      ctx.rotate(Math.sin(g.wobble * 0.45) * 0.12);

      // Ground shadow and crisp, tiered crystal silhouette.
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath(); ctx.ellipse(1, radius * 0.82, radius * 0.95, radius * 0.32, 0, 0, Math.PI * 2); ctx.fill();
      ctx.shadowColor = g.glowColor;
      ctx.shadowBlur = 8;
      ctx.fillStyle = g.color;
      ctx.strokeStyle = tier === 2 ? '#fff1d2' : '#e7fbff';
      ctx.lineWidth = tier === 2 ? 1.8 : 1.3;
      ctx.beginPath();
      ctx.moveTo(0, -radius);
      ctx.lineTo(radius * 0.72, -radius * 0.18);
      ctx.lineTo(radius * 0.54, radius * 0.62);
      ctx.lineTo(0, radius);
      ctx.lineTo(-radius * 0.54, radius * 0.62);
      ctx.lineTo(-radius * 0.72, -radius * 0.18);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;

      // Facets catch light; higher-value crystals gain a second cut line.
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.moveTo(0, -radius * 0.78);
      ctx.lineTo(radius * 0.37, -radius * 0.14);
      ctx.lineTo(0, radius * 0.25);
      ctx.lineTo(-radius * 0.14, -radius * 0.12);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(20,25,35,0.58)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -radius * 0.72); ctx.lineTo(0, radius * 0.82);
      ctx.moveTo(-radius * 0.65, -radius * 0.1); ctx.lineTo(radius * 0.65, -radius * 0.1);
      ctx.stroke();
      ctx.restore();
    }
  }
}
