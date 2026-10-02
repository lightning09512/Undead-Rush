// ─── HUD: HP bar, XP bar, level, timer, kill count ───

import { Player } from '../entities/player';
import { Input } from '../core/input';
import { UPGRADES } from '../data/upgrades';
import { ZombieSystem } from '../entities/zombies';
import { MapPickupSystem } from '../entities/map-pickups';
import { MAP_CONFIG } from '../data/items';

export class HUD {
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, player: Player, gameTime: number, input: Input, zombies: ZombieSystem, mapPickups: MapPickupSystem): void {
    const pad = 15;
    const barH = 14;
    const barW = Math.min(280, w * 0.35);

    // ─── HP Bar (top-left) ───
    const hpX = pad;
    const hpY = pad;

    // Background Card
    ctx.fillStyle = 'rgba(10, 15, 10, 0.8)';
    ctx.strokeStyle = '#1d2c1c';
    ctx.lineWidth = 2;
    this.roundRect(ctx, hpX, hpY, barW, barH + 10, 8);
    ctx.fill();
    ctx.stroke();

    const hpRatio = Math.max(0, player.hp / player.maxHp);
    const hpColor = hpRatio > 0.5 ? '#44cc55' : hpRatio > 0.25 ? '#ddaa33' : '#dd3333';
    if (hpRatio > 0) {
      this.roundRect(ctx, hpX + 4, hpY + 4, (barW - 8) * hpRatio, barH + 2, 4);
      ctx.fillStyle = hpColor;
      ctx.fill();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 12px 'Segoe UI', Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.ceil(player.hp)} / ${player.maxHp}`, hpX + barW / 2, hpY + barH / 2 + 5);

    ctx.fillStyle = '#ff4455';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('❤️', hpX - 4, hpY + barH / 2 + 6);

    const xpY = hpY + barH + 20;

    ctx.fillStyle = 'rgba(10, 15, 10, 0.8)';
    ctx.strokeStyle = '#1d2c1c';
    this.roundRect(ctx, hpX, xpY, barW, barH + 4, 8);
    ctx.fill();
    ctx.stroke();

    const xpRatio = Math.min(1, player.xp / player.xpToNext);
    if (xpRatio > 0) {
      this.roundRect(ctx, hpX + 4, xpY + 4, (barW - 8) * xpRatio, barH - 4, 4);
      ctx.fillStyle = '#44bbff';
      ctx.fill();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 11px 'Segoe UI', Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`Lv.${player.level}  ${player.xp}/${player.xpToNext}`, hpX + barW / 2, xpY + barH / 2 + 2);

    const minutes = Math.floor(gameTime / 60);
    const seconds = Math.floor(gameTime % 60);
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    ctx.fillStyle = 'rgba(10, 15, 10, 0.8)';
    ctx.strokeStyle = '#1d2c1c';
    this.roundRect(ctx, w / 2 - 45, pad, 90, 32, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 20px 'Segoe UI', Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(timeStr, w / 2, pad + 16);

    // ─── Kill Count (top-right) ───
    ctx.fillStyle = 'rgba(10, 15, 10, 0.8)';
    ctx.strokeStyle = '#1d2c1c';
    this.roundRect(ctx, w - pad - 120, pad, 120, 32, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffaa66';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('💀', w - pad - 90, pad + 16);

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 16px 'Segoe UI', Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(`${player.kills}`, w - pad - 82, pad + 17);

    // ─── Virtual Joystick ───
    if (input.isJoystickVisible) {
      // Base
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(input.joystickBaseX, input.joystickBaseY, input.joystickRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Knob
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(input.joystickKnobX, input.joystickKnobY, 20, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
    }

    // ─── Active upgrades (bottom-left) ───
    this.drawActiveUpgrades(ctx, pad, h - pad - 30, player);

    // ─── Minimap (bottom-right) ───
    this.drawMinimap(ctx, w, h, pad, player, zombies, mapPickups);
  }

  private drawMinimap(ctx: CanvasRenderingContext2D, w: number, h: number, pad: number, player: Player, zombies: ZombieSystem, mapPickups: MapPickupSystem): void {
    const size = 120;
    const mx = w - pad - size;
    const my = h - pad - size;
    
    // Background
    ctx.fillStyle = 'rgba(10, 15, 10, 0.7)';
    ctx.strokeStyle = '#1d2c1c';
    ctx.lineWidth = 2;
    this.roundRect(ctx, mx, my, size, size, 8);
    ctx.fill();
    ctx.stroke();
    
    const scale = size / MAP_CONFIG.width;

    ctx.save();
    ctx.translate(mx, my);

    // Pickups
    ctx.fillStyle = '#ffff00';
    for (const p of mapPickups.pool.getActive()) {
      ctx.fillRect(p.x * scale - 1, p.y * scale - 1, 3, 3);
    }

    // Bosses
    ctx.fillStyle = '#ff0000';
    for (const z of zombies.pool.getActive()) {
      if (z.isBoss) {
        ctx.beginPath();
        ctx.arc(z.x * scale, z.y * scale, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Player
    ctx.fillStyle = '#00aaff';
    ctx.beginPath();
    ctx.arc(player.x * scale, player.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Viewport rect
    const vw = (w / 2) * scale; // Approximation of camera zoom
    const vh = (h / 2) * scale;
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(player.x * scale - vw/2, player.y * scale - vh/2, vw, vh);

    ctx.restore();
  }

  private drawActiveUpgrades(ctx: CanvasRenderingContext2D, x: number, y: number, player: Player): void {
    if (player.upgrades.size === 0) return;

    ctx.font = '16px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    let cx = x;
    const iconSize = 28;
    const gap = 4;

    for (const [id, level] of player.upgrades) {
      const def = UPGRADES.find((u) => u.id === id);
      if (!def) continue;

      // Background
      ctx.fillStyle = 'rgba(10, 15, 10, 0.8)';
      ctx.strokeStyle = '#1d2c1c';
      ctx.lineWidth = 2;
      this.roundRect(ctx, cx, y, iconSize, iconSize, 6);
      ctx.fill();
      ctx.stroke();

      // Icon
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(def.icon, cx + iconSize / 2, y + iconSize / 2);

      // Level badge
      ctx.fillStyle = '#ffcc00';
      ctx.font = `bold 9px 'Segoe UI', Arial, sans-serif`;
      ctx.fillText(`${level}`, cx + iconSize - 4, y + iconSize - 2);

      ctx.font = '16px sans-serif';
      cx += iconSize + gap;
    }
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
