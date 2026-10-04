// ─── Supply Crates: Destructible wooden crates that drop items ───

import { Pool } from '../core/pool';
import { Camera } from '../core/camera';
import { MAP_CONFIG } from '../data/items';
import { campaignSpawnPosition, getCampaignBounds } from './map-geometry';
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
    if (!getCampaignBounds()) {
      x = Math.max(50, Math.min(MAP_CONFIG.width - 50, x));
      y = Math.max(50, Math.min(MAP_CONFIG.height - 50, y));
    }
    [x, y] = campaignSpawnPosition(playerX, playerY, x, y, 28);

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
      const tierStyle = c.tier === 'legendary'
        ? { body: '#75513d', trim: '#edb46a', glow: '#df754f', mark: 'L' }
        : c.tier === 'rare'
          ? { body: '#455963', trim: '#a9d0d2', glow: '#6ca3b0', mark: 'R' }
          : { body: '#644535', trim: '#bd8960', glow: '#a6543c', mark: 'C' };
      const size = c.size;
      if (c.tier !== 'common') {
        LightingRenderer.get().drawGlow(ctx, sx, sy + wobbleY, size * 2.6, tierStyle.glow, c.tier === 'legendary' ? 0.34 : 0.25);
      }

      ctx.save();
      ctx.translate(sx, sy + wobbleY);
      ctx.rotate(Math.sin(c.wobble * 0.5) * 0.025);
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.beginPath(); ctx.ellipse(2, size * 0.82, size * 1.14, size * 0.38, 0, 0, Math.PI * 2); ctx.fill();

      // Heavy metal/wood composite crate with reinforced corners and hazard seals.
      ctx.fillStyle = c.flashTimer > 0 ? '#f0d9d0' : tierStyle.body;
      ctx.strokeStyle = c.flashTimer > 0 ? '#ffffff' : tierStyle.trim;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-size + 5, -size); ctx.lineTo(size - 5, -size); ctx.lineTo(size, -size + 5);
      ctx.lineTo(size, size - 5); ctx.lineTo(size - 5, size); ctx.lineTo(-size + 5, size);
      ctx.lineTo(-size, size - 5); ctx.lineTo(-size, -size + 5); ctx.closePath();
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = 'rgba(12,14,17,0.38)';
      ctx.fillRect(-size * 0.64, -size * 0.62, size * 1.28, size * 1.24);
      ctx.strokeStyle = 'rgba(245,226,206,0.36)'; ctx.lineWidth = 1;
      ctx.strokeRect(-size * 0.64, -size * 0.62, size * 1.28, size * 1.24);
      ctx.fillStyle = tierStyle.trim;
      ctx.fillRect(-size * 0.13, -size, size * 0.26, size * 2);
      ctx.fillRect(-size, -size * 0.13, size * 2, size * 0.26);

      for (const corner of [-1, 1]) {
        for (const vertical of [-1, 1]) {
          ctx.fillStyle = '#d1b99a';
          ctx.beginPath(); ctx.arc(corner * size * 0.78, vertical * size * 0.78, 1.8, 0, Math.PI * 2); ctx.fill();
        }
      }

      // Center seal communicates quality without relying on tiny text.
      ctx.fillStyle = '#211c1a';
      ctx.strokeStyle = tierStyle.trim;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(-9, -9, 18, 18, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = c.hasStar ? '#f3d8b3' : tierStyle.trim;
      ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(c.hasStar ? '★' : tierStyle.mark, 0, 0);
      ctx.restore();

      // HP bar for damaged crates
      if (c.hp < c.maxHp) {
        const barW = size * 2;
        const barH = 4;
        const hpRatio = c.hp / c.maxHp;
        
        ctx.fillStyle = '#23191a';
        ctx.fillRect(sx - size, sy - size - 20 + wobbleY, barW, barH);
        ctx.strokeStyle = '#ab5956'; ctx.lineWidth = 1;
        ctx.strokeRect(sx - size, sy - size - 20 + wobbleY, barW, barH);
        ctx.fillStyle = hpRatio > 0.5 ? '#bfa267' : hpRatio > 0.25 ? '#d0794e' : '#d43b43';
        ctx.fillRect(sx - size, sy - size - 20 + wobbleY, barW * hpRatio, barH);
      }
    }
  }

  reset(): void {
    this.pool.releaseAll();
    this.spawnTimer = 30; // first crate after 30 seconds
  }
}
