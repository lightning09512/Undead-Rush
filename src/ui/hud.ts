// ─── HUD: Vampire Survivors style top XP bar, 6 weapon + 6 passive slots, HP & Timer ───

import { Player } from '../entities/player';
import { Input } from '../core/input';
import { UPGRADES, MAX_WEAPON_SLOTS, MAX_PASSIVE_SLOTS } from '../data/upgrades';
import { ZombieSystem } from '../entities/zombies';
import { MapPickupSystem } from '../entities/map-pickups';
import { MAP_CONFIG } from '../data/items';
import { Camera } from '../core/camera';
import { SOLID_BUILDINGS } from '../entities/map-geometry';
import { UI_PALETTE as C } from './palette';
import type { StageDef } from '../data/meta';

export class HUD {
  draw(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    player: Player,
    gameTime: number,
    input: Input,
    zombies: ZombieSystem,
    mapPickups: MapPickupSystem,
    camera: Camera,
    campaign?: { stage: StageDef; activeNode: number; bossSpawned: boolean; bossName?: string; bossHpRatio?: number; exitActive: boolean; exitActivated: boolean; credits: number; creditGain: number },
    survival?: { wave: number; phase: 'intermission' | 'regular' | 'boss-warning' | 'boss'; bossName?: string; bossHpRatio?: number }
  ): void {
    const pad = w < 700 ? 9 : 12;
    const compact = w < 700;
    const slotSize = compact ? 24 : 32;
    const hpRatio = Math.min(1, Math.max(0, player.hp / player.maxHp));

    // ─── 1. Vampire Survivors Full-Width Top XP Bar ───
    const xpBarH = 22;
    // Dark metallic obsidian base
    ctx.fillStyle = C.background;
    ctx.fillRect(0, 0, w, xpBarH);

    if (campaign) {
      ctx.fillStyle = '#c7a875'; ctx.fillRect(0, xpBarH - 2, w, 2);
      ctx.fillStyle = '#f1e9d5'; ctx.font = 'bold 12px Segoe UI, Arial'; ctx.textBaseline = 'middle';
      ctx.textAlign = 'left'; ctx.fillText(`CHIẾN DỊCH ${campaign.stage.id}/10`, 12, 10);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#e5c684';
      ctx.fillText(`${campaign.credits} TÍN DỤNG${campaign.creditGain ? `   +${campaign.creditGain}` : ''}`, w - 14, 10);
    } else {

    const xpRatio = Math.min(1, Math.max(0, player.xp / player.xpToNext));
    if (xpRatio > 0) {
      const xpGrad = ctx.createLinearGradient(0, 0, w * xpRatio, 0);
      xpGrad.addColorStop(0, '#477e8b');
      xpGrad.addColorStop(0.72, C.cyan);
      xpGrad.addColorStop(1, C.cyanBright);
      ctx.fillStyle = xpGrad;
      ctx.fillRect(0, 0, w * xpRatio, xpBarH);

      // Top sheen highlight for glassmorphism juice
      ctx.fillStyle = 'rgba(239, 247, 242, 0.2)';
      ctx.fillRect(0, 0, w * xpRatio, xpBarH * 0.38);
    }

    // Bottom gold separator line
    ctx.fillStyle = C.border;
    ctx.fillRect(0, xpBarH - 2, w, 2);

    // LV Badge (top-left inside XP bar)
    const lvBoxW = 60;
    ctx.fillStyle = C.amber;
    ctx.fillRect(8, 2, lvBoxW, xpBarH - 6);
    ctx.fillStyle = C.black;
    ctx.font = `bold 12px 'Segoe UI', Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`LV ${player.level}`, 8 + lvBoxW / 2, xpBarH / 2 - 1);

    // XP Text (centered in XP bar)
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 11px 'Segoe UI', Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(
      `${player.xp} / ${player.xpToNext} XP  (${Math.floor(xpRatio * 100)}%)`,
      w / 2,
      xpBarH / 2 - 1
    );
    }

    // ─── 2. Top-Center: Game Clock & Kill Count Pill ───
    const minutes = Math.floor(gameTime / 60);
    const seconds = Math.floor(gameTime % 60);
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    const clockW = compact ? 144 : 160;
    const clockH = compact ? 29 : 34;
    const clockX = compact ? pad : (w - clockW) / 2;
    const clockY = compact ? 126 : xpBarH + 6;

    ctx.save();
    ctx.fillStyle = 'rgba(27, 36, 41, 0.96)';
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, clockX, clockY, clockW, clockH, 3);
    ctx.fill();
    ctx.stroke();

    // Clock
    ctx.fillStyle = '#f8fafc';
    ctx.font = `bold 18px 'Segoe UI', Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(timeStr, clockX + 14, clockY + clockH / 2);

    // Kill Counter
    ctx.fillStyle = C.dangerBright;
    ctx.font = `14px sans-serif`;
    // A simple etched tally avoids brightly colored platform emoji in the combat HUD.
    ctx.strokeStyle = C.dangerBright; ctx.lineWidth = 1.5;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath(); ctx.moveTo(clockX + 82 + k * 4, clockY + 11); ctx.lineTo(clockX + 82 + k * 4, clockY + clockH - 10); ctx.stroke();
    }
    ctx.fillStyle = '#f8fafc';
    ctx.font = `bold 14px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText(`${player.kills}`, clockX + 104, clockY + clockH / 2);
    ctx.restore();

    const campaignBossActive = !!campaign?.bossSpawned && !!campaign.bossName;
    const survivalBossActive = survival?.phase === 'boss' && !!survival.bossName;
    const bossBarActive = campaignBossActive || survivalBossActive;

    if (survival && !survivalBossActive) {
      const panelW = Math.min(compact ? 220 : 310, w - pad * 2);
      const panelH = survival.bossName ? 56 : 34;
      const panelX = (w - panelW) / 2;
      const panelY = clockY + clockH + 7;
      ctx.save();
      ctx.fillStyle = 'rgba(10, 15, 16, .9)';
      ctx.strokeStyle = survival.phase === 'boss' || survival.phase === 'boss-warning' ? '#a64e47' : '#64716e';
      ctx.lineWidth = 1;
      this.roundRect(ctx, panelX, panelY, panelW, panelH, 5); ctx.fill(); ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const stateText = survival.phase === 'intermission' ? 'KHU VỰC ĐANG LẮNG' :
        survival.phase === 'boss-warning' ? 'CÓ THỨ ĐANG TIẾN ĐẾN' :
        survival.phase === 'boss' ? 'BOSS ĐANG SĂN LÙNG' : 'TIÊU DIỆT ĐỢT QUÁI';
      ctx.fillStyle = survival.phase === 'boss' || survival.phase === 'boss-warning' ? '#e3b37e' : '#b9cbc3';
      ctx.font = `800 ${compact ? 11 : 12}px Segoe UI, Arial`;
      ctx.fillText(`WAVE ${survival.wave}  ·  ${stateText}`, w / 2, panelY + 13, panelW - 14);
      if (survival.bossName) {
        ctx.fillStyle = '#f0e5d9'; ctx.font = `700 ${compact ? 10 : 11}px Segoe UI, Arial`;
        ctx.fillText(survival.bossName, w / 2, panelY + 29, panelW - 14);
      }
      ctx.restore();
    }

    if (bossBarActive) {
      const bossName = campaignBossActive ? campaign!.bossName! : survival!.bossName!;
      const bossHp = campaignBossActive ? campaign!.bossHpRatio : survival!.bossHpRatio;
      const bossBarY = compact ? clockY + clockH + 8 : w < 1240 ? 141 : clockY + clockH + 7;
      this.drawBossHealthBar(ctx, w, pad, bossBarY, compact, bossName, bossHp ?? 1);
    }

    // ─── 3. Top-Left: Equipment Slots (6 Weapons + 6 Passives) ───
    this.drawEquipmentSlots(ctx, pad, xpBarH + 8, player, slotSize);

    // ─── 4. Player HP Bar (Below Equipment Slots) ───
    const hpX = pad;
    const hpY = xpBarH + 8 + (slotSize + 4) * 2 + 6;
    const hpBarW = (slotSize + 4) * 6 - 4;
    const hpBarH = 26;

    ctx.save();
    ctx.fillStyle = 'rgba(27, 36, 41, 0.96)';
    ctx.strokeStyle = hpRatio <= 0.25 ? C.dangerBright : C.border;
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, hpX, hpY, hpBarW, hpBarH, 3);
    ctx.fill();
    ctx.stroke();

    const hpColor = hpRatio > 0.5 ? C.health : hpRatio > 0.25 ? C.healthWarning : C.dangerBright;
    if (hpRatio > 0) {
      ctx.fillStyle = hpColor;
      ctx.fillRect(hpX + 4, hpY + 18, (hpBarW - 8) * hpRatio, 4);
    }

    ctx.fillStyle = hpColor;
    ctx.font = `bold 9px 'Segoe UI', Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(hpRatio <= 0.25 ? 'NGUY KỊCH' : 'SINH LỰC', hpX + 6, hpY + 9);
    ctx.fillStyle = C.text; ctx.font = `bold 10px 'Segoe UI', Arial, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.ceil(player.hp)} / ${player.maxHp}`, hpX + hpBarW - 6, hpY + 9);
    ctx.restore();

    // ─── 5. Top-Right: Minimap ───
    if (!campaign) this.drawMinimap(ctx, w, h, pad, xpBarH + 8, player, zombies, mapPickups, camera);

    // ─── 6. Mobile Touch Joystick ───
    if (input.isJoystickVisible) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = C.cyan;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(input.joystickBaseX, input.joystickBaseY, input.joystickRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = 0.6;
      ctx.fillStyle = C.cyan;
      ctx.beginPath();
      ctx.arc(input.joystickKnobX, input.joystickKnobY, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawBossHealthBar(ctx: CanvasRenderingContext2D, w: number, pad: number, y: number, compact: boolean, name: string, hpRatio: number): void {
    const barW = Math.min(compact ? 420 : 800, w - pad * 2);
    const barH = compact ? 51 : 57;
    const x = (w - barW) / 2;
    const ratio = Math.max(0, Math.min(1, hpRatio));
    const trackX = x + 12, trackY = y + (compact ? 27 : 29), trackW = barW - 24, trackH = compact ? 13 : 16;

    ctx.save();
    ctx.fillStyle = 'rgba(10,12,13,.92)';
    ctx.strokeStyle = 'rgba(175,148,113,.9)';
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, x, y, barW, barH, 4); ctx.fill(); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${compact ? 11 : 14}px Segoe UI, Arial`;
    ctx.lineWidth = 3; ctx.strokeStyle = '#120f10';
    ctx.strokeText(name.toLocaleUpperCase(), w / 2, y + (compact ? 13 : 14), barW - 30);
    ctx.fillStyle = '#eee1d2';
    ctx.fillText(name.toLocaleUpperCase(), w / 2, y + (compact ? 13 : 14), barW - 30);

    ctx.fillStyle = '#1b1718'; ctx.fillRect(trackX, trackY, trackW, trackH);
    ctx.strokeStyle = '#796a59'; ctx.lineWidth = 1; ctx.strokeRect(trackX, trackY, trackW, trackH);
    if (ratio > 0) {
      ctx.fillStyle = ratio <= .2 ? '#b6483c' : '#923638';
      ctx.fillRect(trackX + 2, trackY + 2, Math.max(0, (trackW - 4) * ratio), trackH - 4);
      ctx.fillStyle = 'rgba(229,164,134,.23)';
      ctx.fillRect(trackX + 2, trackY + 2, Math.max(0, (trackW - 4) * ratio), 2);
    }
    // Fine divisions add the long, deliberate boss-bar read without obscuring health.
    ctx.strokeStyle = 'rgba(12,12,13,.48)'; ctx.lineWidth = 1;
    for (let i = 1; i < 10; i++) {
      const tickX = trackX + trackW * i / 10;
      ctx.beginPath(); ctx.moveTo(tickX, trackY + 1); ctx.lineTo(tickX, trackY + trackH - 1); ctx.stroke();
    }
    ctx.restore();
  }

  /** Render 6 Weapon slots (top row) and 6 Passive slots (bottom row) */
  private drawEquipmentSlots(ctx: CanvasRenderingContext2D, startX: number, startY: number, player: Player, slotSize: number): void {
    const gap = 4;

    const weapons: { icon: string; level: number; maxLevel: number }[] = [];
    const passives: { icon: string; level: number; maxLevel: number }[] = [];

    for (const [id, level] of player.upgrades) {
      const def = UPGRADES.find((u) => u.id === id);
      if (!def) continue;
      if (def.category === 'weapon') {
        weapons.push({ icon: def.icon, level, maxLevel: def.maxLevel });
      } else {
        passives.push({ icon: def.icon, level, maxLevel: def.maxLevel });
      }
    }

    // Row 1: weapons use amber; passive systems use cyan.
    for (let i = 0; i < MAX_WEAPON_SLOTS; i++) {
      const sx = startX + i * (slotSize + gap);
      const sy = startY;
      const item = weapons[i];

      ctx.save();
      ctx.fillStyle = item ? 'rgba(37, 47, 53, 0.96)' : 'rgba(18, 24, 28, 0.66)';
      ctx.strokeStyle = item ? C.amber : C.borderSoft;
      ctx.lineWidth = item ? 1.5 : 1;
      this.roundRect(ctx, sx, sy, slotSize, slotSize, 3);
      ctx.fill();
      ctx.stroke();

      if (item) {
        // Icon
        ctx.font = `${slotSize < 30 ? 13 : 16}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.icon, sx + slotSize / 2, sy + slotSize / 2 - 2);

        // Level pips at bottom of slot
        const pipW = (slotSize - 6) / item.maxLevel;
        for (let p = 0; p < item.maxLevel; p++) {
          ctx.fillStyle = p < item.level ? C.amber : C.inactive;
          ctx.fillRect(sx + 3 + p * pipW, sy + slotSize - 5, pipW - 1, 3);
        }
      }
      ctx.restore();
    }

    // Row 2: Passives (Cyan/Blue theme)
    const row2Y = startY + slotSize + gap;
    for (let i = 0; i < MAX_PASSIVE_SLOTS; i++) {
      const sx = startX + i * (slotSize + gap);
      const sy = row2Y;
      const item = passives[i];

      ctx.save();
      ctx.fillStyle = item ? 'rgba(37, 47, 53, 0.96)' : 'rgba(18, 24, 28, 0.66)';
      ctx.strokeStyle = item ? C.cyan : C.borderSoft;
      ctx.lineWidth = item ? 1.5 : 1;
      this.roundRect(ctx, sx, sy, slotSize, slotSize, 3);
      ctx.fill();
      ctx.stroke();

      if (item) {
        // Icon
        ctx.font = `${slotSize < 30 ? 13 : 16}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.icon, sx + slotSize / 2, sy + slotSize / 2 - 2);

        // Level pips at bottom of slot
        const pipW = (slotSize - 6) / item.maxLevel;
        for (let p = 0; p < item.maxLevel; p++) {
          ctx.fillStyle = p < item.level ? C.cyan : C.inactive;
          ctx.fillRect(sx + 3 + p * pipW, sy + slotSize - 5, pipW - 1, 3);
        }
      }
      ctx.restore();
    }
  }

  private drawMinimap(
    ctx: CanvasRenderingContext2D,
    w: number,
    _h: number,
    pad: number,
    topY: number,
    player: Player,
    zombies: ZombieSystem,
    mapPickups: MapPickupSystem,
    camera: Camera,
    campaign?: { stage: StageDef; activeNode: number; bossSpawned: boolean; exitActive: boolean; exitActivated: boolean }
  ): void {
    const size = w < 700 ? Math.min(124, Math.max(94, w * 0.26)) : Math.min(168, Math.max(112, w * 0.28));
    const frame = size + 12;
    const mx = w - pad - frame;
    const my = topY;
    const mapX = mx + 6;
    const mapY = my + 6;
    const scale = size / MAP_CONFIG.width;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = 'rgba(11, 16, 19, 0.97)';
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, mx, my, frame, frame, 3);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.rect(mapX, mapY, size, size);
    ctx.clip();
    ctx.fillStyle = '#202a30';
    ctx.fillRect(mapX, mapY, size, size);

    // A clear map grid and edge make orientation easier at a glance.
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.13)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const offset = size * i / 4;
      ctx.beginPath(); ctx.moveTo(mapX + offset, mapY); ctx.lineTo(mapX + offset, mapY + size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mapX, mapY + offset); ctx.lineTo(mapX + size, mapY + offset); ctx.stroke();
    }

    // Fixed buildings are deliberately bright and large enough to read at this scale.
    const minimapBuildings = campaign ? campaign.stage.buildings : SOLID_BUILDINGS;
    const variantColors: Record<string, string> = {
      suburb: '#9b8e79', fuel: '#c08a42', medical: '#89aaa0', sewer: '#738a70', military: '#a1946e',
      mall: '#aaa191', rail: '#a07f61', lab: '#719a9c', quarantine: '#aa6559', hive: '#954f52',
    };
    for (const building of minimapBuildings) {
      const bw = building.halfWidth * 2 * scale;
      const bh = building.halfHeight * 2 * scale;
      const drawW = Math.max(3, bw);
      const drawH = Math.max(3, bh);
      ctx.save();
      ctx.translate(mapX + building.x * scale, mapY + building.y * scale);
      ctx.rotate(building.rotation);
      ctx.fillStyle = campaign
        ? variantColors[(building as typeof campaign.stage.buildings[number]).variant ?? ''] ?? '#8c949a'
        : building.kind === 'warehouse' ? '#d08a46' : '#8c949a';
      ctx.fillRect(-drawW / 2, -drawH / 2, drawW, drawH);
      ctx.strokeStyle = '#f8d49a';
      ctx.lineWidth = 1;
      ctx.strokeRect(-drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    }

    if (campaign) {
      campaign.stage.objectiveNodes.forEach((node, index) => {
        if (index < campaign.activeNode) return;
        ctx.fillStyle = index === campaign.activeNode ? '#e3bd72' : '#a6a08a';
        ctx.strokeStyle = '#22292b'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(mapX + node.x * scale, mapY + node.y * scale, index === campaign.activeNode ? 3.3 : 2.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });
      if (campaign.bossSpawned) {
        ctx.strokeStyle = '#e56b5c'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(mapX + campaign.stage.bossSpawn.x * scale, mapY + campaign.stage.bossSpawn.y * scale, 4.5, 0, Math.PI * 2); ctx.stroke();
      }
      if (campaign.exitActive && campaign.stage.exitSpawn) {
        ctx.fillStyle = campaign.exitActivated ? '#9cae9f' : '#75c1b5';
        ctx.beginPath(); ctx.arc(mapX + campaign.stage.exitSpawn.x * scale, mapY + campaign.stage.exitSpawn.y * scale, 3.4, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Pickups (yellow)
    ctx.fillStyle = C.amberBright;
    for (const p of mapPickups.pool.getActive()) {
      ctx.fillRect(mapX + p.x * scale - 1.5, mapY + p.y * scale - 1.5, 3, 3);
    }

    // Zombies (red)
    for (const z of zombies.pool.getActive()) {
      ctx.fillStyle = z.isBoss ? C.amberBright : C.dangerBright;
      const dot = z.isBoss ? 6 : 3.5;
      ctx.beginPath();
      ctx.arc(mapX + z.x * scale, mapY + z.y * scale, dot / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Camera coverage shows which part of the full map is currently on screen.
    ctx.strokeStyle = C.cyanBright;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(mapX + camera.x * scale, mapY + camera.y * scale,
      Math.min(size, camera.width / camera.zoom * scale), Math.min(size, camera.height / camera.zoom * scale));

    // Player marker gets an outline so it stays visible over nearby icons.
    ctx.fillStyle = C.black;
    ctx.beginPath();
    ctx.arc(mapX + player.x * scale, mapY + player.y * scale, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.cyanBright;
    ctx.beginPath();
    ctx.arc(mapX + player.x * scale, mapY + player.y * scale, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.fillStyle = C.textSoft;
    ctx.font = 'bold 9px Segoe UI, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('BẢN ĐỒ', mx + 8, my - 2);
  }

  drawDamageFeedback(ctx: CanvasRenderingContext2D, w: number, h: number, hpRatio: number, flashTimer: number): void {
    if (flashTimer <= 0) return;
    const strength = Math.min(1, flashTimer / 0.2);
    const radius = Math.min(240, Math.max(115, Math.min(w, h) * .26));
    const alpha = (hpRatio < .25 ? .19 : .14) * strength;
    ctx.save();
    // Four short corner blooms show a hit without tinting the aiming area.
    for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h]]) {
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(145, 25, 30, ${alpha})`);
      gradient.addColorStop(.42, `rgba(126, 18, 24, ${alpha * .42})`);
      gradient.addColorStop(1, 'rgba(126, 18, 24, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(Math.max(0, x - radius), Math.max(0, y - radius), radius, radius);
    }
    ctx.restore();
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
