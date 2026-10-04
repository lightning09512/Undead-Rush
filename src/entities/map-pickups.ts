// ─── Map Pickups: health, magnet, chest, buffs, bomb, airdrop ───

import { Pool } from '../core/pool';
import { Camera } from '../core/camera';
import { MAP_ITEMS, ItemDef, MAP_CONFIG } from '../data/items';
import { campaignSpawnPosition, getCampaignBounds } from './map-geometry';
import { LightingRenderer } from '../graphics/lighting';
import { drawGunArt } from '../graphics/campaign-menu-art';

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

const GUN_PICKUP_NAMES: Record<string, string> = {
  p9: 'P-9', ar7: 'AR-7', smg9: 'SMG-9', sg12: 'SG-12', dmr55: 'DMR-55',
  bulldog: 'BULLDOG', lmg6: 'LMG-6', flamer8: 'FLAMER-8', rpg4: 'RPG-4', rail_lance: 'RAIL LANCE',
};

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

function drawLootFrame(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, wobble: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(wobble * 0.45) * 0.06);
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.beginPath(); ctx.ellipse(1, radius * 0.94, radius * 1.08, radius * 0.34, 0, 0, Math.PI * 2); ctx.fill();

  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#17171b';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 4;
    const r = i % 2 === 0 ? radius : radius * 0.82;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-radius * 0.56, -radius * 0.55); ctx.lineTo(radius * 0.4, -radius * 0.55); ctx.stroke();
  ctx.restore();
}

function drawLootIcon(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, radius: number, color: string, wobble: number): void {
  drawLootFrame(ctx, x, y, radius, color, wobble);
  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#fff1e9';
  ctx.fillStyle = '#fff1e9';
  ctx.lineWidth = Math.max(2, radius * 0.19);

  switch (id) {
    case 'health_pack':
      ctx.fillStyle = '#527c4e';
      ctx.fillRect(-radius * 0.55, -radius * 0.42, radius * 1.1, radius * 0.84);
      ctx.strokeStyle = '#d7e1ca'; ctx.lineWidth = 1;
      ctx.strokeRect(-radius * 0.55, -radius * 0.42, radius * 1.1, radius * 0.84);
      ctx.fillStyle = '#fff1e9';
      ctx.fillRect(-radius * 0.12, -radius * 0.31, radius * 0.24, radius * 0.62);
      ctx.fillRect(-radius * 0.34, -radius * 0.09, radius * 0.68, radius * 0.2);
      break;
    case 'magnet':
      ctx.beginPath(); ctx.moveTo(-radius * 0.42, -radius * 0.24); ctx.lineTo(-radius * 0.42, radius * 0.13);
      ctx.arc(0, radius * 0.13, radius * 0.42, Math.PI, 0, true); ctx.lineTo(radius * 0.42, -radius * 0.24);
      ctx.strokeStyle = '#e4d5d1'; ctx.lineWidth = radius * 0.23; ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = radius * 0.12;
      ctx.beginPath(); ctx.moveTo(-radius * 0.42, -radius * 0.3); ctx.lineTo(-radius * 0.42, -radius * 0.08); ctx.moveTo(radius * 0.42, -radius * 0.3); ctx.lineTo(radius * 0.42, -radius * 0.08); ctx.stroke();
      break;
    case 'xp_chest':
    case 'airdrop':
      ctx.fillStyle = id === 'airdrop' ? '#5a513a' : '#735327';
      ctx.fillRect(-radius * 0.58, -radius * 0.37, radius * 1.16, radius * 0.78);
      ctx.strokeStyle = id === 'airdrop' ? '#f2d69a' : '#eacb68'; ctx.lineWidth = 1.5;
      ctx.strokeRect(-radius * 0.58, -radius * 0.37, radius * 1.16, radius * 0.78);
      ctx.fillStyle = id === 'airdrop' ? '#b69c69' : '#d8ae4b';
      ctx.fillRect(-radius * 0.11, -radius * 0.37, radius * 0.22, radius * 0.78);
      ctx.fillRect(-radius * 0.58, -radius * 0.08, radius * 1.16, radius * 0.13);
      ctx.fillStyle = '#fff1b1';
      ctx.fillRect(-radius * 0.055, -radius * 0.04, radius * 0.11, radius * 0.1);
      break;
    case 'double_xp':
      ctx.strokeStyle = '#b8e4e5'; ctx.lineWidth = 2;
      for (const dy of [-radius * 0.2, radius * 0.2]) {
        ctx.beginPath(); ctx.moveTo(-radius * 0.48, dy); ctx.lineTo(radius * 0.35, dy); ctx.lineTo(radius * 0.12, dy - radius * 0.2); ctx.moveTo(radius * 0.35, dy); ctx.lineTo(radius * 0.12, dy + radius * 0.2); ctx.stroke();
      }
      ctx.fillStyle = '#ffffff'; ctx.font = `bold ${radius * 0.38}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('2X', 0, radius * 0.55);
      break;
    case 'speed_boost':
      ctx.strokeStyle = '#dce7bd'; ctx.lineWidth = 2.2;
      for (let i = 0; i < 3; i++) {
        const ox = (i - 1) * radius * 0.31;
        ctx.beginPath(); ctx.moveTo(ox - radius * 0.12, radius * 0.28); ctx.lineTo(ox + radius * 0.12, 0); ctx.lineTo(ox - radius * 0.12, -radius * 0.28); ctx.stroke();
      }
      break;
    case 'shield':
      ctx.beginPath(); ctx.moveTo(0, -radius * 0.55); ctx.lineTo(radius * 0.45, -radius * 0.34); ctx.lineTo(radius * 0.36, radius * 0.18); ctx.lineTo(0, radius * 0.52); ctx.lineTo(-radius * 0.36, radius * 0.18); ctx.lineTo(-radius * 0.45, -radius * 0.34); ctx.closePath();
      ctx.fillStyle = 'rgba(63, 108, 121, 0.82)'; ctx.fill(); ctx.strokeStyle = '#c1e2e1'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-radius * 0.2, 0); ctx.lineTo(-radius * 0.04, radius * 0.16); ctx.lineTo(radius * 0.22, -radius * 0.18); ctx.stroke();
      break;
    case 'bomb':
      ctx.fillStyle = '#242126'; ctx.beginPath(); ctx.arc(0, radius * 0.08, radius * 0.42, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#b9a7a0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(radius * 0.13, -radius * 0.28); ctx.quadraticCurveTo(radius * 0.5, -radius * 0.66, radius * 0.38, -radius * 0.82); ctx.stroke();
      ctx.fillStyle = '#ffd477'; ctx.shadowColor = '#ff5b35'; ctx.shadowBlur = 7; ctx.beginPath(); ctx.arc(radius * 0.38, -radius * 0.83, radius * 0.12, 0, Math.PI * 2); ctx.fill();
      break;
    case 'weapon_part':
      ctx.fillStyle = '#806339'; ctx.strokeStyle = '#ead19a'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 16; i++) { const a = -Math.PI / 2 + i * Math.PI / 8; const r = i % 2 === 0 ? radius * 0.48 : radius * 0.36; const px = Math.cos(a) * r; const py = Math.sin(a) * r; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#17171b'; ctx.beginPath(); ctx.arc(0, 0, radius * 0.15, 0, Math.PI * 2); ctx.fill();
      break;
    default:
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, radius * 0.38, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export class MapPickupSystem {
  pool: Pool<MapPickup>;
  private spawnTimer = 0;
  private airdropTimer = 0;

  constructor() {
    this.pool = new Pool(createPickup, resetPickup, 20);
  }

  update(dt: number, gameTime: number, playerX: number, playerY: number, allowAmbient = true,
    canCollect?: (pickup: MapPickup) => boolean): MapPickup[] {
    const collected: MapPickup[] = [];

    // Spawn random items periodically
    this.spawnTimer -= dt;
    if (allowAmbient && this.spawnTimer <= 0) {
      this.spawnTimer = 12 + Math.random() * 8; // every 12-20 seconds
      this.spawnRandomItem(gameTime, playerX, playerY);
    }

    // Airdrop
    this.airdropTimer -= dt;
    if (allowAmbient && this.airdropTimer <= 0 && gameTime > 60) {
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
      if (dist < p.size + 20 && (!canCollect || canCollect(p))) {
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
    if (!getCampaignBounds()) {
      x = Math.max(50, Math.min(MAP_CONFIG.width - 50, x));
      y = Math.max(50, Math.min(MAP_CONFIG.height - 50, y));
    }
    [x, y] = campaignSpawnPosition(playerX, playerY, x, y, chosen.size);

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

    if (!getCampaignBounds()) {
      x = Math.max(100, Math.min(MAP_CONFIG.width - 100, x));
      y = Math.max(100, Math.min(MAP_CONFIG.height - 100, y));
    }
    [x, y] = campaignSpawnPosition(playerX, playerY, x, y, 20);

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

  spawnWeaponPickup(x: number, y: number, gunId: string, campaignReward = false): void {
    const p = this.pool.acquire();
    p.x = x;
    p.y = y;
    p.size = 20;
    p.color = campaignReward ? '#d6b375' : gunId === 'sg12' ? '#ff9933' : '#00e5ff';
    p.glowColor = campaignReward ? '#ae8650' : gunId === 'sg12' ? '#ff7700' : '#00b4d8';
    p.itemId = `gun_${gunId}`;
    p.duration = 0;
    p.value = 0;
    p.life = campaignReward ? Infinity : 180;
    p.wobble = Math.random() * Math.PI * 2;
    p.isAirdrop = false;
    p.airdropLanded = true;
  }

  spawnAmmoPickup(x: number, y: number, gunId: string, rounds: number): void {
    const p = this.pool.acquire();
    p.x = x; p.y = y; p.size = 17;
    p.color = '#d3b16e'; p.glowColor = '#a87d41';
    p.itemId = `ammo_${gunId}`;
    p.duration = 0; p.value = rounds; p.life = 45;
    p.wobble = Math.random() * Math.PI * 2;
    p.isAirdrop = false; p.airdropLanded = true;
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
        drawLootIcon(ctx, 'airdrop', sx, crateY, 14, '#e2bd76', p.wobble);

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

      // ── Distinct weapon recovery cases ──
      if (p.itemId.startsWith('gun_')) {
        const gunId = p.itemId.slice(4);
        const campaignReward = p.life === Infinity;
        const labelText = `${campaignReward ? 'VŨ KHÍ TRÙM' : 'NHẶT SÚNG'}  ·  ${GUN_PICKUP_NAMES[gunId] ?? gunId.toUpperCase()}`;
        const beaconColor = gunId === 'rpg4' || gunId === 'rail_lance' ? '#d6b375'
          : gunId === 'sg12' || gunId === 'bulldog' ? '#e17143' : '#71a7bc';
        const wobbleY = Math.sin(p.wobble) * 3;

        ctx.save();
        // Restrained beacon keeps the weapon findable without flooding the screen.
        const beamGrad = ctx.createLinearGradient(sx, sy, sx, sy - 105);
        beamGrad.addColorStop(0, `${campaignReward ? 'rgba(214, 179, 117, .32)' : beaconColor === '#e17143' ? 'rgba(225, 113, 67, 0.26)' : 'rgba(113, 167, 188, 0.24)'}`);
        beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = beamGrad;
        ctx.fillRect(sx - 7, sy - 85, 14, 85);
        ctx.strokeStyle = campaignReward ? 'rgba(241, 205, 142, .8)' : beaconColor === '#e17143' ? 'rgba(240, 139, 78, 0.6)' : 'rgba(155, 210, 220, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(sx, sy + wobbleY + 7, 19, 7, 0, 0, Math.PI * 2); ctx.stroke();
        drawLootIcon(ctx, 'weapon_part', sx, sy + wobbleY, 17, beaconColor, p.wobble);
        drawGunArt(ctx, sx - 19, sy - 10 + wobbleY, 38, 20, gunId);

        ctx.font = `bold 10px 'Segoe UI', Arial, sans-serif`;
        const bw = ctx.measureText(labelText).width + 16;
        ctx.fillStyle = 'rgba(15, 12, 15, 0.94)';
        ctx.strokeStyle = beaconColor;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(sx - bw / 2, sy - 35 + wobbleY, bw, 18, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#f1e6df';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(labelText, sx, sy - 26 + wobbleY);
        ctx.restore();
        continue;
      }

      if (p.itemId.startsWith('ammo_')) {
        const gunId = p.itemId.slice(5);
        const floatY = sy + Math.sin(p.wobble) * 2;
        ctx.save(); ctx.translate(sx, floatY);
        ctx.fillStyle = 'rgba(0,0,0,.5)';
        ctx.beginPath(); ctx.ellipse(2, 13, 23, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#423c2e'; ctx.strokeStyle = '#d1ad70'; ctx.lineWidth = 2;
        ctx.fillRect(-20, -10, 40, 21); ctx.strokeRect(-20, -10, 40, 21);
        ctx.fillStyle = '#aa8351'; ctx.fillRect(-20, -10, 40, 5);
        ctx.fillStyle = '#dfc58c';
        for (let i = -1; i <= 1; i++) {
          const bx = i * 9;
          ctx.fillRect(bx - 2, -5, 4, 11);
          ctx.beginPath(); ctx.moveTo(bx - 2, -5); ctx.lineTo(bx, -9); ctx.lineTo(bx + 2, -5); ctx.fill();
        }
        ctx.fillStyle = '#f0e2be'; ctx.font = 'bold 9px Segoe UI, Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const label = `ĐẠN ${gunId.toUpperCase().replace('_', ' ')} +${p.value}`;
        const labelWidth = ctx.measureText(label).width + 14;
        ctx.fillStyle = 'rgba(12,17,18,.92)'; ctx.fillRect(-labelWidth / 2, -31, labelWidth, 15);
        ctx.strokeStyle = '#b69660'; ctx.lineWidth = 1; ctx.strokeRect(-labelWidth / 2, -31, labelWidth, 15);
        ctx.fillStyle = '#f0e2be'; ctx.fillText(label, 0, -23);
        ctx.restore();
        continue;
      }

      // Blinking when about to despawn
      if (p.life < 5 && Math.floor(p.life * 4) % 2 === 0) {
        ctx.globalAlpha = 0.4;
      }

      const wobbleY = Math.sin(p.wobble) * 2.5;
      const radius = Math.max(14, Math.min(19, p.size + 4));
      const color = p.itemId === 'health_pack' ? '#d85855'
        : p.itemId === 'magnet' ? '#d38a56'
        : p.itemId === 'xp_chest' ? '#d4ad54'
        : p.itemId === 'double_xp' ? '#8bbcc8'
        : p.itemId === 'speed_boost' ? '#b3b879'
        : p.itemId === 'shield' ? '#779bb4'
        : p.itemId === 'bomb' ? '#d75a43'
        : p.itemId === 'airdrop' ? '#c2a366'
        : '#b77c9e';
      LightingRenderer.get().drawGlow(ctx, sx, sy + wobbleY, radius * 2.15, p.glowColor, 0.32);
      drawLootIcon(ctx, p.itemId, sx, sy + wobbleY, radius, color, p.wobble);
      ctx.globalAlpha = 1;

      const labels: Record<string, string> = {
        health_pack: 'HỒI MÁU +30', magnet: 'NAM CHÂM', xp_chest: 'XP +100',
        double_xp: 'XP ×2', speed_boost: 'TĂNG TỐC', shield: 'LÁ CHẮN',
        bomb: 'PHÁ HỦY', weapon_part: 'LINH KIỆN', airdrop: 'TIẾP TẾ',
      };
      const label = labels[p.itemId] || MAP_ITEMS.find(i => i.id === p.itemId)?.name || p.itemId;
      ctx.save();
      ctx.font = `bold 9px 'Segoe UI', Arial, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const labelW = ctx.measureText(label).width + 12;
      ctx.fillStyle = 'rgba(13, 11, 14, 0.88)';
      ctx.strokeStyle = `${color}aa`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(sx - labelW / 2, sy + radius + 3 + wobbleY, labelW, 15, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f3e9e4';
      ctx.fillText(label, sx, sy + radius + 10.5 + wobbleY);
      ctx.restore();
    }
  }

  reset(): void {
    this.pool.releaseAll();
    this.spawnTimer = 5; // first spawn after 5 seconds
    this.airdropTimer = 60;
  }
}
