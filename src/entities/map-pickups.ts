// ─── Map Pickups: health, magnet, chest, buffs, bomb, airdrop ───

import { Pool } from '../core/pool';
import { Camera } from '../core/camera';
import { MAP_ITEMS, ItemDef, MAP_CONFIG } from '../data/items';

export interface MapPickup {
  x: number;
  y: number;
  size: number;
  color: string;
  glowColor: string;
  itemId: string;
  duration: number;
  value: number;
  life: number;       // despawn timer
  wobble: number;
  // Airdrop
  isAirdrop: boolean;
  airdropTimer: number;
  airdropLanded: boolean;
  warningY: number;
}

function createPickup(): MapPickup {
  return {
    x: 0, y: 0, size: 12, color: '#ffffff', glowColor: '#cccccc',
    itemId: '', duration: 0, value: 0, life: 0, wobble: 0,
    isAirdrop: false, airdropTimer: 0, airdropLanded: false, warningY: 0,
  };
}

function resetPickup(p: MapPickup): void {
  p.life = 0;
  p.isAirdrop = false;
  p.airdropLanded = false;
}

export class MapPickupSystem {
  pool: Pool<MapPickup>;
  private spawnTimer = 0;
  private airdropTimer = 0;

  constructor() {
    this.pool = new Pool(createPickup, resetPickup, 20);
  }

  update(dt: number, gameTime: number, playerX: number, playerY: number): MapPickup[] {
    const collected: MapPickup[] = [];

    // Spawn random items periodically
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 12 + Math.random() * 8; // every 12-20 seconds
      this.spawnRandomItem(gameTime, playerX, playerY);
    }

    // Airdrop
    this.airdropTimer -= dt;
    if (this.airdropTimer <= 0 && gameTime > 60) {
      this.airdropTimer = 45 + Math.random() * 30; // every 45-75 seconds
      this.spawnAirdrop(playerX, playerY);
    }

    // Update all pickups
    this.pool.forEach((p) => {
      p.wobble += dt * 3;
      p.life -= dt;

      // Airdrop falling
      if (p.isAirdrop && !p.airdropLanded) {
        p.airdropTimer -= dt;
        if (p.airdropTimer <= 0) {
          p.airdropLanded = true;
        }
      }

      // Despawn
      if (p.life <= 0) return true;

      // Can't pick up airdrops that haven't landed
      if (p.isAirdrop && !p.airdropLanded) return false;

      // Collection check
      const dx = playerX - p.x;
      const dy = playerY - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < p.size + 20) {
        collected.push(p);
        return true; // release
      }

      return false;
    });

    return collected;
  }

  private spawnRandomItem(gameTime: number, playerX: number, playerY: number): void {
    const available = MAP_ITEMS.filter(item => gameTime >= item.minTime);
    if (available.length === 0) return;

    // Weighted random
    const totalWeight = available.reduce((sum, item) => sum + item.weight, 0);
    let r = Math.random() * totalWeight;
    let chosen: ItemDef | null = null;
    for (const item of available) {
      r -= item.weight;
      if (r <= 0) { chosen = item; break; }
    }
    if (!chosen) chosen = available[available.length - 1];

    // Spawn position: nearby but not too close, create risk/reward
    const angle = Math.random() * Math.PI * 2;
    const dist = 200 + Math.random() * 400;
    let x = playerX + Math.cos(angle) * dist;
    let y = playerY + Math.sin(angle) * dist;

    // Clamp to map
    x = Math.max(50, Math.min(MAP_CONFIG.width - 50, x));
    y = Math.max(50, Math.min(MAP_CONFIG.height - 50, y));

    const p = this.pool.acquire();
    p.x = x;
    p.y = y;
    p.size = chosen.size;
    p.color = chosen.color;
    p.glowColor = chosen.glowColor;
    p.itemId = chosen.id;
    p.duration = chosen.duration;
    p.value = chosen.value;
    p.life = 30; // 30 seconds to pick up
    p.wobble = Math.random() * Math.PI * 2;
  }

  private spawnAirdrop(playerX: number, playerY: number): void {
    // Spawn in a dangerous area (far from player)
    const angle = Math.random() * Math.PI * 2;
    const dist = 400 + Math.random() * 300;
    let x = playerX + Math.cos(angle) * dist;
    let y = playerY + Math.sin(angle) * dist;

    x = Math.max(100, Math.min(MAP_CONFIG.width - 100, x));
    y = Math.max(100, Math.min(MAP_CONFIG.height - 100, y));

    const p = this.pool.acquire();
    p.x = x;
    p.y = y;
    p.size = 16;
    p.color = '#ffaa00';
    p.glowColor = '#ff8800';
    p.itemId = 'airdrop';
    p.duration = 0;
    p.value = 150; // big XP
    p.life = 25;
    p.isAirdrop = true;
    p.airdropTimer = 3.0; // 3 seconds to land
    p.airdropLanded = false;
    p.warningY = y - 200;
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    for (const p of this.pool.getActive()) {
      if (!camera.isVisible(p.x, p.y, 40)) continue;
      const [sx, sy] = camera.worldToScreen(p.x, p.y);

      // Airdrop warning marker (before landing)
      if (p.isAirdrop && !p.airdropLanded) {
        // Warning circle on ground
        ctx.strokeStyle = '#ff440088';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(sx, sy, 30, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Falling crate
        const fallProgress = 1 - (p.airdropTimer / 3.0);
        const crateY = sy - 150 * (1 - fallProgress);
        ctx.fillStyle = '#ffaa00';
        ctx.fillRect(crateY > sy ? sx - 8 : sx - 8, crateY - 8, 16, 16);
        ctx.strokeStyle = '#cc8800';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx - 8, crateY - 8, 16, 16);

        // Parachute
        if (fallProgress < 0.8) {
          ctx.strokeStyle = '#ffffff88';
          ctx.beginPath();
          ctx.arc(sx, crateY - 20, 15, Math.PI, 0);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(sx - 15, crateY - 20);
          ctx.lineTo(sx - 5, crateY - 5);
          ctx.moveTo(sx + 15, crateY - 20);
          ctx.lineTo(sx + 5, crateY - 5);
          ctx.stroke();
        }

        // "AIRDROP" text
        ctx.fillStyle = '#ffaa00';
        ctx.font = `bold 10px 'Segoe UI', Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('AIRDROP', sx, sy - 40);
        continue;
      }

      // Blinking when about to despawn
      if (p.life < 5 && Math.floor(p.life * 4) % 2 === 0) {
        ctx.globalAlpha = 0.4;
      }

      const wobbleY = Math.sin(p.wobble) * 3;

      // Glow
      ctx.shadowColor = p.glowColor;
      ctx.shadowBlur = 12;

      // Item shape depends on type
      if (p.itemId === 'health_pack') {
        // Red cross
        ctx.fillStyle = p.color;
        ctx.fillRect(sx - 3, sy - p.size / 2 + wobbleY, 6, p.size);
        ctx.fillRect(sx - p.size / 2, sy - 3 + wobbleY, p.size, 6);
        // White bg
        ctx.fillStyle = '#ffffff44';
        ctx.beginPath();
        ctx.arc(sx, sy + wobbleY, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.itemId === 'magnet') {
        // U shape
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(sx, sy + wobbleY, p.size * 0.6, 0, Math.PI);
        ctx.stroke();
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(sx - p.size * 0.6 - 2, sy + wobbleY - 8, 4, 8);
        ctx.fillStyle = '#0000ff';
        ctx.fillRect(sx + p.size * 0.6 - 2, sy + wobbleY - 8, 4, 8);
      } else if (p.itemId === 'xp_chest') {
        // Chest shape
        ctx.fillStyle = '#8B6914';
        ctx.fillRect(sx - p.size * 0.7, sy - p.size * 0.4 + wobbleY, p.size * 1.4, p.size * 0.8);
        ctx.fillStyle = p.color;
        ctx.fillRect(sx - p.size * 0.7, sy - p.size * 0.4 + wobbleY, p.size * 1.4, p.size * 0.3);
        // Lock
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx - 2, sy - 2 + wobbleY, 4, 4);
      } else if (p.itemId === 'bomb') {
        // Bomb circle with fuse
        ctx.fillStyle = '#222222';
        ctx.beginPath();
        ctx.arc(sx, sy + wobbleY, p.size * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(sx, sy + wobbleY, p.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
        // Fuse spark
        ctx.fillStyle = '#ffff00';
        const sparkX = sx + Math.cos(p.wobble * 2) * 2;
        const sparkY = sy - p.size * 0.7 + wobbleY;
        ctx.beginPath();
        ctx.arc(sparkX, sparkY, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.itemId === 'airdrop') {
        // Crate
        ctx.fillStyle = '#ffaa00';
        ctx.fillRect(sx - p.size * 0.6, sy - p.size * 0.6 + wobbleY, p.size * 1.2, p.size * 1.2);
        ctx.strokeStyle = '#cc8800';
        ctx.lineWidth = 2;
        ctx.strokeRect(sx - p.size * 0.6, sy - p.size * 0.6 + wobbleY, p.size * 1.2, p.size * 1.2);
        // Star
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', sx, sy + wobbleY);
      } else {
        // Generic circle
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(sx, sy + wobbleY, p.size * 0.7, 0, Math.PI * 2);
        ctx.fill();
        // Inner highlight
        ctx.fillStyle = '#ffffff44';
        ctx.beginPath();
        ctx.arc(sx - 2, sy - 2 + wobbleY, p.size * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      // Label (for non-obvious items)
      if (p.itemId !== 'health_pack' && p.itemId !== 'xp_chest') {
        ctx.fillStyle = '#ffffff88';
        ctx.font = `9px 'Segoe UI', Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const label = MAP_ITEMS.find(i => i.id === p.itemId)?.name || p.itemId;
        ctx.fillText(label, sx, sy + p.size + 4 + wobbleY);
      }
    }
  }

  reset(): void {
    this.pool.releaseAll();
    this.spawnTimer = 5; // first spawn after 5 seconds
    this.airdropTimer = 60;
  }
}
