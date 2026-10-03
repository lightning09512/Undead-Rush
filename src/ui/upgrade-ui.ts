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
    const layout = this.getCardLayout(canvasWidth, canvasHeight);

    for (let i = 0; i < this.cards.length; i++) {
      const { x: cx, y: cy, w: cardW, h: cardH } = layout.cards[i];

      if (screenX >= cx && screenX <= cx + cardW && screenY >= cy && screenY <= cy + cardH) {
        this.selectedIndex = i;
        this.visible = false;
        return this.cards[i].def;
      }
    }

    return null;
  }

  draw(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number, player?: Player, mouseX = -1, mouseY = -1): void {
    if (!this.visible || this.cards.length === 0) return;

    // Dark gothic vignette backdrop
    ctx.save();
    ctx.fillStyle = 'rgba(15, 5, 9, 0.91)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    const edgeBlood = ctx.createLinearGradient(0, 0, canvasWidth, 0);
    edgeBlood.addColorStop(0, 'rgba(142, 18, 30, 0.28)');
    edgeBlood.addColorStop(0.22, 'rgba(0, 0, 0, 0)');
    edgeBlood.addColorStop(0.78, 'rgba(0, 0, 0, 0)');
    edgeBlood.addColorStop(1, 'rgba(142, 18, 30, 0.28)');
    ctx.fillStyle = edgeBlood;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // ─── Header: LEVEL UP! ───
    const titleY = canvasHeight * 0.12;
    ctx.shadowColor = '#b91c2c';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#f0c4c0';
    ctx.font = `900 ${Math.min(38, canvasWidth * 0.055)}px 'Segoe UI', Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚔ LÊN CẤP — CHỌN NÂNG CẤP ⚔', canvasWidth / 2, titleY);

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#94a3b8';
    ctx.font = `600 ${Math.min(14, canvasWidth * 0.022)}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText('CHỌN MỘT NÂNG CẤP', canvasWidth / 2, titleY + 30);

    if (player) {
      ctx.fillStyle = '#cbd5e1';
      ctx.font = `500 ${Math.min(12, canvasWidth * 0.018)}px 'Segoe UI', Arial, sans-serif`;
      ctx.fillText(
        `VŨ KHÍ ${player.countWeaponSlotsUsed()}/${MAX_WEAPON_SLOTS}   ·   NỘ BỊ ĐỘNG ${player.countPassiveSlotsUsed()}/${MAX_PASSIVE_SLOTS}`,
        canvasWidth / 2,
        titleY + 50
      );
    }

    // ─── Upgrade Cards ───
    const layout = this.getCardLayout(canvasWidth, canvasHeight);
    this.selectedIndex = -1;

    for (let i = 0; i < this.cards.length; i++) {
      const card = this.cards[i];
      const { x: cx, y: cy, w: cardW, h: cardH } = layout.cards[i];
      const isHovered = mouseX >= cx && mouseX <= cx + cardW && mouseY >= cy && mouseY <= cy + cardH;
      if (isHovered) this.selectedIndex = i;
      const isNew = card.nextLevel === 1;

      if (layout.compact) {
        this.drawCompactCard(ctx, card, cx, cy, cardW, cardH, this.getCategoryColor(card.def.category), isNew, isHovered);
        continue;
      }

      // Card outer frame with gold / category accent
      ctx.save();
      const accentColor = this.getCategoryColor(card.def.category);

      // Card background gradient
      const bgGrad = ctx.createLinearGradient(cx, cy, cx, cy + cardH);
      bgGrad.addColorStop(0, '#35151d');
      bgGrad.addColorStop(1, '#100d12');
      ctx.fillStyle = bgGrad;
      this.roundRect(ctx, cx, cy, cardW, cardH, 12);
      ctx.fill();

      // Golden ornate double border
      ctx.strokeStyle = '#a9343a';
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
        ctx.fillStyle = '#71232e';
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
      const catLabel = card.def.category === 'weapon' ? 'VŨ KHÍ' : card.def.category === 'stat' ? 'CHỈ SỐ' : 'HIỆU ỨNG';
      ctx.fillText(catLabel, cx + cardW - catW / 2 - 12, badgeY + badgeH / 2);

      // Icon Center Medallion
      const medalRadius = 30;
      const medalX = cx + cardW / 2;
      const medalY = cy + cardH * 0.28;

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#a9343a';
      ctx.lineWidth = 2;
      ctx.shadowColor = isHovered ? '#ff6562' : accentColor;
      ctx.shadowBlur = isHovered ? 22 : 10;
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
      ctx.fillText(card.def.name.toUpperCase(), cx + cardW / 2, cy + cardH * 0.42);

      ctx.fillStyle = '#e5b4b0';
      ctx.font = `bold 10px 'Segoe UI', Arial, sans-serif`;
      ctx.fillText(isNew ? 'MỚI  ·  CẤP 0 → 1' : `CẤP ${card.nextLevel - 1} → ${card.nextLevel}`, cx + cardW / 2, cy + cardH * 0.475);

      // Level Progress Bar (Segmented pips)
      const pipH = 4;
      const totalPips = card.def.maxLevel;
      const pipsW = cardW - 40;
      const pipStep = pipsW / totalPips;
      const pipsY = cy + cardH * 0.51;

      for (let p = 0; p < totalPips; p++) {
        const px = cx + 20 + p * pipStep;
        if (p < card.nextLevel - 1) {
          ctx.fillStyle = '#98313a';
        } else if (p === card.nextLevel - 1) {
          ctx.fillStyle = '#e24d54';
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
      ctx.fillStyle = '#e16b68';
      ctx.font = `bold 11px 'Segoe UI', Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isHovered ? 'NHẤN ĐỂ CHỌN' : 'CHỌN NÂNG CẤP', cx + cardW / 2, cy + cardH - 16);

      ctx.strokeStyle = isHovered ? '#ff7770' : '#a9343a';
      ctx.lineWidth = isHovered ? 3 : 1.5;
      this.roundRect(ctx, cx, cy, cardW, cardH, 12);
      ctx.stroke();

      ctx.restore();
    }
    ctx.restore();
  }

  private getCardLayout(width: number, height: number): {
    compact: boolean;
    cards: Array<{ x: number; y: number; w: number; h: number }>;
  } {
    const count = this.cards.length;
    if (width < 760) {
      const gap = 10;
      const cardW = Math.min(width - 20, Math.max(240, width - 28));
      const cardH = Math.max(108, Math.min(156, (height - 142 - gap * (count - 1)) / Math.max(1, count)));
      const totalH = count * cardH + Math.max(0, count - 1) * gap;
      const startY = Math.max(100, (height - totalH) / 2 + 60);
      return {
        compact: true,
        cards: this.cards.map((_, i) => ({ x: (width - cardW) / 2, y: startY + i * (cardH + gap), w: cardW, h: cardH })),
      };
    }

    const gap = Math.min(22, width * 0.025);
    const cardW = Math.min(240, (width - 56 - gap * 2) / Math.max(1, count));
    const cardH = Math.min(340, Math.max(260, height * 0.54));
    const totalW = count * cardW + Math.max(0, count - 1) * gap;
    const startX = (width - totalW) / 2;
    const startY = (height - cardH) / 2 + 30;
    return {
      compact: false,
      cards: this.cards.map((_, i) => ({ x: startX + i * (cardW + gap), y: startY, w: cardW, h: cardH })),
    };
  }

  private drawCompactCard(
    ctx: CanvasRenderingContext2D, card: UpgradeCard, x: number, y: number, w: number, h: number,
    accent: string, isNew: boolean, hovered: boolean
  ): void {
    ctx.save();
    ctx.shadowColor = hovered ? '#ff6562' : 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = hovered ? 18 : 8;
    ctx.fillStyle = 'rgba(28, 13, 18, 0.98)';
    ctx.strokeStyle = hovered ? '#ff7770' : '#81323a';
    ctx.lineWidth = hovered ? 3 : 1.5;
    this.roundRect(ctx, x, y, w, h, 10); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;

    const iconX = x + 38;
    const iconY = y + h / 2;
    ctx.fillStyle = '#211319'; ctx.strokeStyle = accent; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(iconX, iconY, Math.min(25, h * 0.25), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.font = `${Math.min(27, h * 0.27)}px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff1e9';
    ctx.fillText(card.def.icon, iconX, iconY);

    const contentX = x + 76;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fbf0eb'; ctx.font = `bold ${Math.min(15, h * 0.14)}px 'Segoe UI', Arial, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(card.def.name.toUpperCase(), contentX, y + h * 0.25);
    ctx.fillStyle = '#e3a9a5'; ctx.font = `bold ${Math.min(10, h * 0.095)}px 'Segoe UI', Arial, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(isNew ? 'MỚI · 0 → 1' : `CẤP ${card.nextLevel - 1} → ${card.nextLevel}`, x + w - 12, y + h * 0.25);

    const category = card.def.category === 'weapon' ? 'VŨ KHÍ' : card.def.category === 'stat' ? 'CHỈ SỐ' : 'HIỆU ỨNG';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = accent; ctx.font = `bold ${Math.min(9, h * 0.085)}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText(category, contentX, y + h * 0.43);

    ctx.textAlign = 'left'; ctx.fillStyle = '#c9b7b4'; ctx.font = ` ${Math.min(12, h * 0.105)}px 'Segoe UI', Arial, sans-serif`;
    ctx.textBaseline = 'top';
    this.wrapText(ctx, card.def.description, contentX, y + h * 0.52, w - 94, Math.min(14, h * 0.12));

    const totalPips = card.def.maxLevel;
    const pipW = Math.min(16, (w - 102) / totalPips);
    const pipGap = 3;
    const pipsY = y + h - 14;
    for (let i = 0; i < totalPips; i++) {
      ctx.fillStyle = i < card.nextLevel ? '#d94b51' : '#473039';
      ctx.fillRect(contentX + i * (pipW + pipGap), pipsY, pipW, 4);
    }
    ctx.fillStyle = hovered ? '#ff8a82' : accent;
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.font = `bold 9px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText(hovered ? 'CHỌN' : 'NÂNG CẤP', x + w - 12, y + h - 5);
    ctx.restore();
  }

  private getCategoryColor(category: string): string {
    switch (category) {
      case 'stat': return '#d17667';
      case 'weapon': return '#ef554e';
      case 'effect': return '#a54451';
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
