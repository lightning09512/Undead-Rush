// ─── XP Gem Entity ───

import { Pool } from '../core/pool';
import { Camera } from '../core/camera';
import { XP_GEMS } from '../data/items';
import { LightingRenderer } from '../graphics/lighting';
import { EntityRenderer } from '../graphics/entity-renderer';

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
    x: 0, y: 0, size: 5, color: '#44bbff', glowColor: '#2299dd',
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

      const wobbleY = Math.sin(g.wobble) * 2;

      // Glow using LightingRenderer (cached)
      LightingRenderer.get().drawGlow(ctx, sx, sy + wobbleY, g.size * 5, g.glowColor, 0.6);

      let assetKey = 'gem_blue';
      if (g.value >= 50) assetKey = 'gem_yellow';
      else if (g.value >= 15) assetKey = 'gem_green';

      EntityRenderer.drawSprite(
        ctx,
        assetKey,
        sx, sy,
        0, // angle
        1, // scaleMult
        1, // alpha
        wobbleY
      );
    }
  }
}
