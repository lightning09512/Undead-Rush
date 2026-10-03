// ─── Upgrade Selection UI: Vampire Survivors / Dark Fantasy Roguelite style cards ───

import { UPGRADES, UpgradeDef, MAX_WEAPON_SLOTS, MAX_PASSIVE_SLOTS } from '../data/upgrades';
import { Player } from '../entities/player';

export interface UpgradeCard {
  def: UpgradeDef;
  nextLevel: number;
}

export class UpgradeUI {
  cards: UpgradeCard[] = [];
  selectedIndex = -1;
  visible = false;

  /** Generate 3 upgrade choices respecting 6 weapon + 6 passive slots */
  generateChoices(player: Player): void {
    const weightedPool: UpgradeCard[] = [];

    for (const def of UPGRADES) {
      if (!player.canPickUpgrade(def)) continue;
      const currentLevel = player.upgrades.get(def.id) || 0;
      const card: UpgradeCard = { def, nextLevel: currentLevel + 1 };
      weightedPool.push(card);
      // Give weight boost to currently owned upgrades for synergy
      if (currentLevel > 0) {
        weightedPool.push(card, card);
      }
    }

    const picked: UpgradeCard[] = [];
    const usedIds = new Set<string>();

    for (let n = 0; n < 3 && weightedPool.length > 0; n++) {
      const idx = Math.floor(Math.random() * weightedPool.length);
      const card = weightedPool[idx];
      if (!usedIds.has(card.def.id)) {
        usedIds.add(card.def.id);
        picked.push(card);
      }
      weightedPool.splice(idx, 1);
    }

    if (picked.length < 3) {
      for (const def of UPGRADES) {
        if (picked.length >= 3) break;
        if (usedIds.has(def.id)) continue;
        if (!player.canPickUpgrade(def)) continue;
        const currentLevel = player.upgrades.get(def.id) || 0;
        usedIds.add(def.id);
        picked.push({ def, nextLevel: currentLevel + 1 });
      }
    }

    this.cards = picked;
    this.selectedIndex = -1;
    this.visible = true;
  }

  /** Check if a click/tap hits a card; returns selected upgrade def or null */
  handleClick(screenX: number, screenY: number, canvasWidth: number, canvasHeight: number): UpgradeDef | null {
    if (!this.visible || this.cards.length === 0) return null;

    const cardW = Math.min(240, Math.max(180, canvasWidth * 0.28));
    const cardH = Math.min(340, Math.max(260, canvasHeight * 0.54));
    const gap = Math.min(22, canvasWidth * 0.025);
    const totalW = this.cards.length * cardW + (this.cards.length - 1) * gap;
    const startX = (canvasWidth - totalW) / 2;
    const startY = (canvasHeight - cardH) / 2 + 30;

    for (let i = 0; i < this.cards.length; i++) {
      const cx = startX + i * (cardW + gap);
      const cy = startY;

      if (screenX >= cx && screenX <= cx + cardW && screenY >= cy && screenY <= cy + cardH) {
        this.selectedIndex = i;
        this.visible = false;
        return this.cards[i].def;
      }
    }

    return null;
  }

  draw(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number, player?: Player): void {
    if (!this.visible || this.cards.length === 0) return;

    // Dark gothic vignette backdrop
    ctx.save();
    ctx.fillStyle = 'rgba(6, 8, 16, 0.88)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // ─── Header: LEVEL UP! ───
    const titleY = canvasHeight * 0.12;
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#fbbf24';
    ctx.font = `900 ${Math.min(38, canvasWidth * 0.055)}px 'Segoe UI', Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚔ LEVEL UP! ⚔', canvasWidth / 2, titleY);

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#94a3b8';
    ctx.font = `600 ${Math.min(14, canvasWidth * 0.022)}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText('CHOOSE AN ENHANCEMENT', canvasWidth / 2, titleY + 30);

    if (player) {
      ctx.fillStyle = '#cbd5e1';
      ctx.font = `500 ${Math.min(12, canvasWidth * 0.018)}px 'Segoe UI', Arial, sans-serif`;
      ctx.fillText(
        `Weapons: ${player.countWeaponSlotsUsed()}/${MAX_WEAPON_SLOTS}   ·   Passives: ${player.countPassiveSlotsUsed()}/${MAX_PASSIVE_SLOTS}`,
        canvasWidth / 2,
        titleY + 50
      );
    }

    // ─── Upgrade Cards ───
    const cardW = Math.min(240, Math.max(180, canvasWidth * 0.28));
    const cardH = Math.min(340, Math.max(260, canvasHeight * 0.54));
    const gap = Math.min(22, canvasWidth * 0.025);
    const totalW = this.cards.length * cardW + (this.cards.length - 1) * gap;
    const startX = (canvasWidth - totalW) / 2;
    const startY = (canvasHeight - cardH) / 2 + 30;

    for (let i = 0; i < this.cards.length; i++) {
      const card = this.cards[i];
      const cx = startX + i * (cardW + gap);
      const cy = startY;
      const isNew = card.nextLevel === 1;

      // Card outer frame with gold / category accent
      ctx.save();
      const accentColor = this.getCategoryColor(card.def.category);

      // Card background gradient
      const bgGrad = ctx.createLinearGradient(cx, cy, cx, cy + cardH);
      bgGrad.addColorStop(0, '#1e1b4b'); // Deep indigo
      bgGrad.addColorStop(1, '#0f172a'); // Midnight obsidian
      ctx.fillStyle = bgGrad;
      this.roundRect(ctx, cx, cy, cardW, cardH, 12);
      ctx.fill();

      // Golden ornate double border
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.5;
      this.roundRect(ctx, cx, cy, cardW, cardH, 12);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      this.roundRect(ctx, cx + 3, cy + 3, cardW - 6, cardH - 6, 9);
      ctx.stroke();

      // Top Tag & Badge
      const badgeH = 22;
      const badgeY = cy + 14;

      if (isNew) {
        // "★ NEW ★" Badge
        ctx.fillStyle = '#dc2626';
        this.roundRect(ctx, cx + 12, badgeY, 60, badgeH, 4);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold 10px 'Segoe UI', Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★ NEW', cx + 42, badgeY + badgeH / 2);
      } else {
        // "LV X" Badge
        ctx.fillStyle = '#0284c7';
        this.roundRect(ctx, cx + 12, badgeY, 54, badgeH, 4);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold 11px 'Segoe UI', Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`LV ${card.nextLevel}`, cx + 39, badgeY + badgeH / 2);
      }

      // Category Pill (Right)
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1;
      const catW = 76;
      this.roundRect(ctx, cx + cardW - catW - 12, badgeY, catW, badgeH, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = accentColor;
      ctx.font = `bold 10px 'Segoe UI', Arial, sans-serif`;
      ctx.textAlign = 'center';
      const catLabel = card.def.category === 'weapon' ? 'WEAPON' : card.def.category === 'stat' ? 'PASSIVE' : 'EFFECT';
      ctx.fillText(catLabel, cx + cardW - catW / 2 - 12, badgeY + badgeH / 2);

      // Icon Center Medallion
      const medalRadius = 30;
      const medalX = cx + cardW / 2;
      const medalY = cy + cardH * 0.28;

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(medalX, medalY, medalRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.font = `34px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(card.def.icon, medalX, medalY);

      // Card Name
      ctx.fillStyle = '#f8fafc';
      ctx.font = `bold 15px 'Segoe UI', Arial, sans-serif`;
      ctx.fillText(card.def.name.toUpperCase(), cx + cardW / 2, cy + cardH * 0.44);

      // Level Progress Bar (Segmented pips)
      const pipH = 4;
      const totalPips = card.def.maxLevel;
      const pipsW = cardW - 40;
      const pipStep = pipsW / totalPips;
      const pipsY = cy + cardH * 0.51;

      for (let p = 0; p < totalPips; p++) {
        const px = cx + 20 + p * pipStep;
        if (p < card.nextLevel - 1) {
          ctx.fillStyle = '#f59e0b'; // Already owned levels
        } else if (p === card.nextLevel - 1) {
          ctx.fillStyle = '#22c55e'; // Current level being acquired
        } else {
          ctx.fillStyle = '#334155'; // Future locked levels
        }
        ctx.fillRect(px, pipsY, pipStep - 3, pipH);
      }

      // Description Box
      const descBoxW = cardW - 24;
      const descBoxH = cardH * 0.28;
      const descBoxX = cx + 12;
      const descBoxY = cy + cardH * 0.58;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      this.roundRect(ctx, descBoxX, descBoxY, descBoxW, descBoxH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#cbd5e1';
      ctx.font = `12px 'Segoe UI', Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      this.wrapText(ctx, card.def.description, cx + cardW / 2, descBoxY + 12, descBoxW - 14, 17);

      // Bottom Call-To-Action
      ctx.fillStyle = '#f59e0b';
      ctx.font = `bold 11px 'Segoe UI', Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SELECT', cx + cardW / 2, cy + cardH - 16);

      ctx.restore();
    }
    ctx.restore();
  }

  private getCategoryColor(category: string): string {
    switch (category) {
      case 'stat': return '#38bdf8'; // Sky blue
      case 'weapon': return '#f97316'; // Amber orange
      case 'effect': return '#a855f7'; // Purple
      default: return '#94a3b8';
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

  private wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
    const words = text.split(' ');
    let line = '';
    let cy = y;

    for (const word of words) {
      const testLine = line + word + ' ';
      if (ctx.measureText(testLine).width > maxWidth && line) {
        ctx.fillText(line.trim(), x, cy);
        line = word + ' ';
        cy += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), x, cy);
  }
}
