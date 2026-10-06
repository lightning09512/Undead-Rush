// ─── Survival Score Shard Entity ───

import { Pool } from '../core/pool';
import { Camera } from '../core/camera';
import { SCORE_SHARDS } from '../data/items';
import { LightingRenderer } from '../graphics/lighting';

export interface ScoreShard {
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

function createShard(): ScoreShard {
  return {
    x: 0, y: 0, size: 5, color: '#73b9cf', glowColor: '#3d859d',
    value: 5, magnetized: false, wobble: 0,
  };
}

function resetShard(g: ScoreShard): void {
  g.magnetized = false;
  g.wobble = 0;
}

export class ScoreShardSystem {
  pool: Pool<ScoreShard>;

  constructor() {
    this.pool = new Pool(createShard, resetShard, 200);
  }

  /** Drop collectible score fragments at a kill location. */
  drop(x: number, y: number, totalScore: number): void {
    // Scatter offset
    const scatter = 20;

    while (totalScore > 0) {
      // Pick shard size
      let shardDef;
      if (totalScore >= 50) {
        shardDef = SCORE_SHARDS[2]; // large
      } else if (totalScore >= 15) {
        shardDef = SCORE_SHARDS[1]; // medium
      } else {
        shardDef = SCORE_SHARDS[0]; // small
      }

      const shard = this.pool.acquire();
      shard.x = x + (Math.random() - 0.5) * scatter;
      shard.y = y + (Math.random() - 0.5) * scatter;
      shard.size = shardDef.size;
      shard.color = shardDef.color;
      shard.glowColor = shardDef.glowColor;
      shard.value = Math.min(shardDef.value, totalScore);
      shard.wobble = Math.random() * Math.PI * 2;

      totalScore -= shard.value;
    }
  }

  /** Pull all score shards toward the player. */
  magnetizeAll(): void {
    for (const shard of this.pool.getActive()) {
      shard.magnetized = true;
    }
  }

  update(dt: number, playerX: number, playerY: number, pickupRadius: number): ScoreShard[] {
    const collected: ScoreShard[] = [];

    this.pool.forEach((shard) => {
      shard.wobble += dt * 3;

      // Pull toward player if magnetized or in pickup range
      const dx = playerX - shard.x;
      const dy = playerY - shard.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (shard.magnetized || dist < pickupRadius) {
        shard.magnetized = true;
        const speed = 400;
        if (dist > 5) {
          shard.x += (dx / dist) * speed * dt;
          shard.y += (dy / dist) * speed * dt;
        }
      }

      // Collect
      if (dist < 15) {
        collected.push(shard);
        return true; // release
      }

      return false;
    });

    return collected;
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const active = this.pool.getActive();
    for (const shard of active) {
      if (!camera.isVisible(shard.x, shard.y)) continue;
      const [sx, sy] = camera.worldToScreen(shard.x, shard.y);

      const wobbleY = Math.sin(shard.wobble) * 1.5;
      const tier = shard.value >= 50 ? 2 : shard.value >= 15 ? 1 : 0;
      const radius = tier === 2 ? 12 : tier === 1 ? 9 : 7;

      LightingRenderer.get().drawGlow(ctx, sx, sy + wobbleY, radius * 2.5, shard.glowColor, 0.34);
      ctx.save();
      ctx.translate(sx, sy + wobbleY);
      ctx.rotate(Math.sin(shard.wobble * 0.45) * 0.12);

      // Ground shadow and crisp, tiered shard silhouette.
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath(); ctx.ellipse(1, radius * 0.82, radius * 0.95, radius * 0.32, 0, 0, Math.PI * 2); ctx.fill();
      ctx.shadowColor = shard.glowColor;
      ctx.shadowBlur = 8;
      ctx.fillStyle = shard.color;
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
