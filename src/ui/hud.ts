// ─── HUD: Vampire Survivors style top XP bar, 6 weapon + 6 passive slots, HP & Timer ───

import { Player } from '../entities/player';
import { Input } from '../core/input';
import { UPGRADES, MAX_WEAPON_SLOTS, MAX_PASSIVE_SLOTS } from '../data/upgrades';
import { ZombieSystem } from '../entities/zombies';
import { MapPickupSystem } from '../entities/map-pickups';
import { MAP_CONFIG } from '../data/items';

export class HUD {
  draw(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    player: Player,
    gameTime: number,
    input: Input,
    zombies: ZombieSystem,
    mapPickups: MapPickupSystem
  ): void {
    const pad = 12;

    // ─── 1. Vampire Survivors Full-Width Top XP Bar ───
    const xpBarH = 22;
    // Dark metallic obsidian base
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, w, xpBarH);

    const xpRatio = Math.min(1, Math.max(0, player.xp / player.xpToNext));
    if (xpRatio > 0) {
      const xpGrad = ctx.createLinearGradient(0, 0, w * xpRatio, 0);
      xpGrad.addColorStop(0, '#0284c7');
      xpGrad.addColorStop(0.5, '#00e5ff');
      xpGrad.addColorStop(1, '#38bdf8');
      ctx.fillStyle = xpGrad;
      ctx.fillRect(0, 0, w * xpRatio, xpBarH);

      // Top sheen highlight for glassmorphism juice
      ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
      ctx.fillRect(0, 0, w * xpRatio, xpBarH * 0.38);
    }

    // Bottom gold separator line
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, xpBarH - 2, w, 2);

    // LV Badge (top-left inside XP bar)
    const lvBoxW = 60;
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(8, 2, lvBoxW, xpBarH - 6);
    ctx.fillStyle = '#0f172a';
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

    // ─── 2. Top-Center: Game Clock & Kill Count Pill ───
    const minutes = Math.floor(gameTime / 60);
    const seconds = Math.floor(gameTime % 60);
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    const clockW = 160;
    const clockH = 34;
    const clockX = (w - clockW) / 2;
    const clockY = xpBarH + 6;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, clockX, clockY, clockW, clockH, 8);
    ctx.fill();
    ctx.stroke();

    // Clock
    ctx.fillStyle = '#f8fafc';
    ctx.font = `bold 18px 'Segoe UI', Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(timeStr, clockX + 14, clockY + clockH / 2);

    // Kill Counter
    ctx.fillStyle = '#f43f5e';
    ctx.font = `14px sans-serif`;
    ctx.fillText('💀', clockX + 80, clockY + clockH / 2);
    ctx.fillStyle = '#f8fafc';
    ctx.font = `bold 14px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText(`${player.kills}`, clockX + 104, clockY + clockH / 2);
    ctx.restore();

    // ─── 3. Top-Left: Equipment Slots (6 Weapons + 6 Passives) ───
    this.drawEquipmentSlots(ctx, pad, xpBarH + 8, player);

    // ─── 4. Player HP Bar (Below Equipment Slots) ───
    const hpX = pad;
    const hpY = xpBarH + 8 + 36 * 2 + 10;
    const hpBarW = 216;
    const hpBarH = 14;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, hpX, hpY, hpBarW, hpBarH, 6);
    ctx.fill();
    ctx.stroke();

    const hpRatio = Math.max(0, player.hp / player.maxHp);
    const hpColor = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.25 ? '#f59e0b' : '#ef4444';
    if (hpRatio > 0) {
      this.roundRect(ctx, hpX + 2, hpY + 2, (hpBarW - 4) * hpRatio, hpBarH - 4, 4);
      ctx.fillStyle = hpColor;
      ctx.fill();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 10px 'Segoe UI', Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`HP: ${Math.ceil(player.hp)} / ${player.maxHp}`, hpX + hpBarW / 2, hpY + hpBarH / 2);
    ctx.restore();

    // ─── 5. Top-Right: Minimap ───
    this.drawMinimap(ctx, w, h, pad, xpBarH + 8, player, zombies, mapPickups);

    // ─── 6. Mobile Touch Joystick ───
    if (input.isJoystickVisible) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(input.joystickBaseX, input.joystickBaseY, input.joystickRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(input.joystickKnobX, input.joystickKnobY, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /** Render 6 Weapon slots (top row) and 6 Passive slots (bottom row) */
  private drawEquipmentSlots(ctx: CanvasRenderingContext2D, startX: number, startY: number, player: Player): void {
    const slotSize = 32;
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

    // Row 1: Weapons (Orange/Red theme)
    for (let i = 0; i < MAX_WEAPON_SLOTS; i++) {
      const sx = startX + i * (slotSize + gap);
      const sy = startY;
      const item = weapons[i];

      ctx.save();
      ctx.fillStyle = item ? 'rgba(30, 41, 59, 0.92)' : 'rgba(15, 23, 42, 0.55)';
      ctx.strokeStyle = item ? '#f97316' : '#1e293b';
      ctx.lineWidth = item ? 1.5 : 1;
      this.roundRect(ctx, sx, sy, slotSize, slotSize, 6);
      ctx.fill();
      ctx.stroke();

      if (item) {
        // Icon
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.icon, sx + slotSize / 2, sy + slotSize / 2 - 2);

        // Level pips at bottom of slot
        const pipW = (slotSize - 6) / item.maxLevel;
        for (let p = 0; p < item.maxLevel; p++) {
          ctx.fillStyle = p < item.level ? '#f97316' : '#334155';
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
      ctx.fillStyle = item ? 'rgba(30, 41, 59, 0.92)' : 'rgba(15, 23, 42, 0.55)';
      ctx.strokeStyle = item ? '#0ea5e9' : '#1e293b';
      ctx.lineWidth = item ? 1.5 : 1;
      this.roundRect(ctx, sx, sy, slotSize, slotSize, 6);
      ctx.fill();
      ctx.stroke();

      if (item) {
        // Icon
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.icon, sx + slotSize / 2, sy + slotSize / 2 - 2);

        // Level pips at bottom of slot
        const pipW = (slotSize - 6) / item.maxLevel;
        for (let p = 0; p < item.maxLevel; p++) {
          ctx.fillStyle = p < item.level ? '#38bdf8' : '#334155';
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
    mapPickups: MapPickupSystem
  ): void {
    const size = 76;
    const mx = w - pad - size;
    const my = topY;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, mx, my, size, size, 8);
    ctx.fill();
    ctx.stroke();

    const scale = size / MAP_CONFIG.width;
    ctx.translate(mx, my);

    // Pickups (yellow)
    ctx.fillStyle = '#facc15';
    for (const p of mapPickups.pool.getActive()) {
      ctx.fillRect(p.x * scale - 1, p.y * scale - 1, 2.5, 2.5);
    }

    // Zombies (red)
    ctx.fillStyle = '#f43f5e';
    for (const z of zombies.pool.getActive()) {
      ctx.fillRect(z.x * scale - 1, z.y * scale - 1, z.isBoss ? 4 : 2, z.isBoss ? 4 : 2);
    }

    // Player (cyan dot)
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.arc(player.x * scale, player.y * scale, 3.5, 0, Math.PI * 2);
    ctx.fill();

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
