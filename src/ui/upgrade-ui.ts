// ─── Upgrade Selection UI ───

import { UPGRADES, UpgradeDef } from '../data/upgrades';
import { Player } from '../entities/player';

export interface UpgradeCard {
  def: UpgradeDef;
  nextLevel: number;
}

export class UpgradeUI {
  cards: UpgradeCard[] = [];
  selectedIndex = -1;
  visible = false;

  /** Generate 3 random upgrade choices, excluding maxed-out ones */
  generateChoices(player: Player): void {
    const available: UpgradeCard[] = [];

    for (const def of UPGRADES) {
      const currentLevel = player.upgrades.get(def.id) || 0;
      if (currentLevel < def.maxLevel) {
        available.push({ def, nextLevel: currentLevel + 1 });
      }
    }

    // Shuffle and pick 3
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }

    this.cards = available.slice(0, Math.min(3, available.length));
    this.selectedIndex = -1;
    this.visible = true;
  }

  /** Check if a click/tap hits a card; returns selected upgrade def or null */
  handleClick(screenX: number, screenY: number, canvasWidth: number, canvasHeight: number): UpgradeDef | null {
    if (!this.visible || this.cards.length === 0) return null;

    const cardW = Math.min(200, canvasWidth * 0.28);
    const cardH = Math.min(280, canvasHeight * 0.45);
    const gap = Math.min(20, canvasWidth * 0.02);
    const totalW = this.cards.length * cardW + (this.cards.length - 1) * gap;
    const startX = (canvasWidth - totalW) / 2;
    const startY = (canvasHeight - cardH) / 2;

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

  draw(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
    if (!this.visible || this.cards.length === 0) return;

    // Dim overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Title
    ctx.fillStyle = '#ffcc00';
    ctx.font = `bold ${Math.min(36, canvasWidth * 0.05)}px 'Segoe UI', Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⬆ LEVEL UP!', canvasWidth / 2, canvasHeight * 0.15);

    ctx.fillStyle = '#aaaacc';
    ctx.font = `${Math.min(18, canvasWidth * 0.025)}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText('Choose an upgrade:', canvasWidth / 2, canvasHeight * 0.22);

    // Cards
    const cardW = Math.min(200, canvasWidth * 0.28);
    const cardH = Math.min(280, canvasHeight * 0.45);
    const gap = Math.min(20, canvasWidth * 0.02);
    const totalW = this.cards.length * cardW + (this.cards.length - 1) * gap;
    const startX = (canvasWidth - totalW) / 2;
    const startY = (canvasHeight - cardH) / 2 + 10;

    for (let i = 0; i < this.cards.length; i++) {
      const card = this.cards[i];
      const cx = startX + i * (cardW + gap);
      const cy = startY;

      // Card background
      const gradient = ctx.createLinearGradient(cx, cy, cx, cy + cardH);
      gradient.addColorStop(0, '#2a2a4a');
      gradient.addColorStop(1, '#1a1a3a');
      ctx.fillStyle = gradient;
      ctx.strokeStyle = this.getCategoryColor(card.def.category);
      ctx.lineWidth = 2;

      // Rounded rect
      this.roundRect(ctx, cx, cy, cardW, cardH, 12);
      ctx.fill();
      ctx.stroke();

      // Category indicator bar
      ctx.fillStyle = this.getCategoryColor(card.def.category);
      this.roundRectTop(ctx, cx, cy, cardW, 6, 12);
      ctx.fill();

      // Icon
      ctx.font = `${Math.min(40, cardW * 0.2)}px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(card.def.icon, cx + cardW / 2, cy + cardH * 0.2);

      // Name
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.min(16, cardW * 0.08)}px 'Segoe UI', Arial, sans-serif`;
      ctx.fillText(card.def.name, cx + cardW / 2, cy + cardH * 0.38);

      // Level
      ctx.fillStyle = this.getCategoryColor(card.def.category);
      ctx.font = `bold ${Math.min(13, cardW * 0.065)}px 'Segoe UI', Arial, sans-serif`;
      ctx.fillText(`Lv.${card.nextLevel}/${card.def.maxLevel}`, cx + cardW / 2, cy + cardH * 0.48);

      // Level dots
      const dotSize = 6;
      const dotsTotal = card.def.maxLevel;
      const dotsW = dotsTotal * (dotSize + 4);
      const dotsStartX = cx + (cardW - dotsW) / 2;
      for (let d = 0; d < dotsTotal; d++) {
        const dx = dotsStartX + d * (dotSize + 4) + dotSize / 2;
        const dy = cy + cardH * 0.55;
        ctx.beginPath();
        ctx.arc(dx, dy, dotSize / 2, 0, Math.PI * 2);
        if (d < card.nextLevel) {
          ctx.fillStyle = this.getCategoryColor(card.def.category);
        } else {
          ctx.fillStyle = '#333355';
        }
        ctx.fill();
      }

      // Description
      ctx.fillStyle = '#aaaacc';
      ctx.font = `${Math.min(12, cardW * 0.06)}px 'Segoe UI', Arial, sans-serif`;
      this.wrapText(ctx, card.def.description, cx + cardW / 2, cy + cardH * 0.68, cardW - 20, 16);

      // Category tag
      ctx.fillStyle = this.getCategoryColor(card.def.category);
      ctx.font = `bold ${Math.min(10, cardW * 0.05)}px 'Segoe UI', Arial, sans-serif`;
      ctx.fillText(card.def.category.toUpperCase(), cx + cardW / 2, cy + cardH * 0.9);
    }
  }

  private getCategoryColor(category: string): string {
    switch (category) {
      case 'stat': return '#44aaff';
      case 'weapon': return '#ff8844';
      case 'effect': return '#aa44ff';
      default: return '#888888';
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

  private roundRectTop(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
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
