// ─── Supply Crates: Destructible wooden crates that drop items ───

import { Pool } from '../core/pool';
import { Camera } from '../core/camera';
import { MAP_CONFIG } from '../data/items';
import { EntityRenderer } from '../graphics/entity-renderer';
import { LightingRenderer } from '../graphics/lighting';

export interface SupplyCrate {
  x: number;
  y: number;
  size: number;
  hp: number;
  maxHp: number;
  flashTimer: number;
  wobble: number;
  hasStar: boolean;  // ★ indicator like Monster Breakout
  tier: 'common' | 'rare' | 'legendary';
}

function createCrate(): SupplyCrate {
  return {
    x: 0, y: 0, size: 20, hp: 30, maxHp: 30,
    flashTimer: 0, wobble: 0, hasStar: true,
    tier: 'common',
  };
}

function resetCrate(c: SupplyCrate): void {
  c.hp = 0;
}

export class SupplyCrateSystem {
  pool: Pool<SupplyCrate>;
  private spawnTimer = 0;

  constructor() {
    this.pool = new Pool(createCrate, resetCrate, 15);
  }

  update(dt: number, gameTime: number, playerX: number, playerY: number): void {
    // Spawn crates periodically
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && gameTime > 30) {
      this.spawnTimer = 20 + Math.random() * 15; // every 20-35 seconds
      this.spawnCrate(playerX, playerY, gameTime);
    }

    // Update flash timers
    this.pool.forEach((c) => {
      if (c.flashTimer > 0) c.flashTimer -= dt;
      c.wobble += dt * 2;
      if (c.hp <= 0) return true; // release
      return false;
    });
  }

  private spawnCrate(playerX: number, playerY: number, gameTime: number): void {
    // Spawn nearby but not too close
    const angle = Math.random() * Math.PI * 2;
    const dist = 250 + Math.random() * 350;
    let x = playerX + Math.cos(angle) * dist;
    let y = playerY + Math.sin(angle) * dist;

    // Clamp to map
    x = Math.max(50, Math.min(MAP_CONFIG.width - 50, x));
    y = Math.max(50, Math.min(MAP_CONFIG.height - 50, y));

    const c = this.pool.acquire();
    c.x = x;
    c.y = y;
    c.hp = 30;
    c.maxHp = 30;
    c.wobble = Math.random() * Math.PI * 2;
    c.hasStar = true;

    // Tier based on game time
    if (gameTime > 180) {
      c.tier = Math.random() < 0.2 ? 'legendary' : 'rare';
    } else if (gameTime > 90) {
      c.tier = Math.random() < 0.3 ? 'rare' : 'common';
    } else {
      c.tier = 'common';
    }

    // Higher HP for better tiers
    if (c.tier === 'rare') {
      c.hp = 50;
      c.maxHp = 50;
    } else if (c.tier === 'legendary') {
      c.hp = 80;
      c.maxHp = 80;
    }
  }

  damageCrate(x: number, y: number, damage: number): boolean {
    // Check if bullet hit any crate
    for (const c of this.pool.getActive()) {
      const dx = x - c.x;
      const dy = y - c.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < c.size) {
        c.hp -= damage;
        c.flashTimer = 0.1;
        if (c.hp <= 0) {
          return true; // destroyed
        }
      }
    }
    return false;
  }

  getCrateAt(x: number, y: number): SupplyCrate | null {
    for (const c of this.pool.getActive()) {
      const dx = x - c.x;
      const dy = y - c.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < c.size) {
        return c;
      }
    }
    return null;
  }

  getDropType(crate: SupplyCrate): string {
    // Drop based on tier
    const rand = Math.random();
    
    if (crate.tier === 'legendary') {
      if (rand < 0.4) return 'weapon_part';
      if (rand < 0.7) return 'health_pack';
      return 'xp_chest';
    } else if (crate.tier === 'rare') {
      if (rand < 0.3) return 'weapon_part';
      if (rand < 0.6) return 'health_pack';
      if (rand < 0.8) return 'shield';
      return 'magnet';
    } else {
      // Common
      if (rand < 0.4) return 'health_pack';
      if (rand < 0.6) return 'xp_chest';
      if (rand < 0.75) return 'magnet';
      return 'weapon_part';
    }
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    for (const c of this.pool.getActive()) {
      if (!camera.isVisible(c.x, c.y, 50)) continue;
      const [sx, sy] = camera.worldToScreen(c.x, c.y);

      const wobbleY = Math.sin(c.wobble) * 2;

      // Flash when hit
      if (c.flashTimer > 0) {
        ctx.fillStyle = '#ffffff';
      } else {
        // Color based on tier
        switch (c.tier) {
          case 'common': ctx.fillStyle = '#8B4513'; break; // Brown
          case 'rare': ctx.fillStyle = '#4169E1'; break; // Royal Blue
          case 'legendary': ctx.fillStyle = '#FFD700'; break; // Gold
        }
      }

      // Draw crate (wooden box)
      const size = c.size;
      ctx.fillRect(sx - size, sy - size + wobbleY, size * 2, size * 2);

      // Crate border
      ctx.strokeStyle = c.tier === 'common' ? '#5D3A1A' : c.tier === 'rare' ? '#1E3A5F' : '#B8860B';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx - size, sy - size + wobbleY, size * 2, size * 2);

      // Cross pattern on crate
      ctx.beginPath();
      ctx.moveTo(sx - size, sy - size + wobbleY);
      ctx.lineTo(sx + size, sy + size + wobbleY);
      ctx.moveTo(sx + size, sy - size + wobbleY);
      ctx.lineTo(sx - size, sy + size + wobbleY);
      ctx.stroke();

      // ★ indicator (like Monster Breakout)
      if (c.hasStar) {
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', sx, sy - size - 10 + wobbleY);
      }

      // HP bar for damaged crates
      if (c.hp < c.maxHp) {
        const barW = size * 2;
        const barH = 4;
        const hpRatio = c.hp / c.maxHp;
        
        ctx.fillStyle = '#333333';
        ctx.fillRect(sx - size, sy - size - 20 + wobbleY, barW, barH);
        
        ctx.fillStyle = hpRatio > 0.5 ? '#44ff44' : hpRatio > 0.25 ? '#ffaa00' : '#ff4444';
        ctx.fillRect(sx - size, sy - size - 20 + wobbleY, barW * hpRatio, barH);
      }

      // Glow for rare/legendary
      if (c.tier !== 'common') {
        const glowColor = c.tier === 'rare' ? '#4169E1' : '#FFD700';
        LightingRenderer.get().drawGlow(ctx, sx, sy + wobbleY, size * 3, glowColor, 0.3);
      }
    }
  }

  reset(): void {
    this.pool.releaseAll();
    this.spawnTimer = 30; // first crate after 30 seconds
  }
}
