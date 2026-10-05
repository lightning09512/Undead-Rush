// ─── Meta Shop UI: permanent upgrades, characters ───

import { PERM_UPGRADES, CHARACTERS, PermUpgradeDef, CharacterDef } from '../data/meta';
import { SaveSystem } from '../systems/save';
import { Audio } from '../core/audio';
import { UI_PALETTE as C } from './palette';
import { createQuarantineBackdrop } from './horror-texture';

export class ShopUI {
  visible = false;
  private tab: 'upgrades' | 'characters' = 'upgrades';
  private scrollY = 0;
  private backdrop?: HTMLCanvasElement;

  handleClick(x: number, y: number, w: number, h: number, save: SaveSystem, audio: Audio): string | null {
    if (!this.visible) return null;

    // Back button
    const compact = w < 520;
    const backBtnW = compact ? 96 : 110;
    const backBtnH = compact ? 32 : 36;
    const backBtnX = w - (compact ? 106 : 130);
    const backBtnY = compact ? 10 : 20;
    if (x >= backBtnX && x <= backBtnX + backBtnW && y >= backBtnY && y <= backBtnY + backBtnH) {
      audio.menuSelect();
      this.visible = false;
      return 'close_shop';
    }

    // Tab buttons
    const tabY = 70;
    const tabW = 140;
    if (y >= tabY && y <= tabY + 34) {
      if (x >= w / 2 - tabW - 10 && x <= w / 2 - 10) {
        this.tab = 'upgrades';
        audio.menuSelect();
        return null;
      }
      if (x >= w / 2 + 10 && x <= w / 2 + tabW + 10) {
        this.tab = 'characters';
        audio.menuSelect();
        return null;
      }
    }

    // Item clicks
    if (this.tab === 'upgrades') {
      return this.handleUpgradeClick(x, y, w, h, save, audio);
    } else {
      return this.handleCharacterClick(x, y, w, h, save, audio);
    }
  }

  private handleUpgradeClick(x: number, y: number, w: number, h: number, save: SaveSystem, audio: Audio): string | null {
    const startY = 130;
    const itemH = w < 520 ? 82 : 72;
    const itemW = Math.min(500, w - 60);
    const startX = (w - itemW) / 2;

    for (let i = 0; i < PERM_UPGRADES.length; i++) {
      const iy = startY + i * (itemH + 8) + this.scrollY;
      if (iy < 100 || iy > h - 20) continue;

      const btnX = startX + itemW - 90;
      const btnY = iy + 20;
      const btnW = 80;
      const btnH = 32;

      if (x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH) {
        const def = PERM_UPGRADES[i];
        const level = save.getPermUpgradeLevel(def.id);
        if (level >= def.maxLevel) return null;

        const cost = def.costs[level];
        if (save.purchasePermUpgrade(def.id, cost)) {
          audio.levelUp();
          return 'purchased';
        } else {
          // Not enough gold
          audio.playerHit();
          return null;
        }
      }
    }
    return null;
  }

  private handleCharacterClick(x: number, y: number, w: number, h: number, save: SaveSystem, audio: Audio): string | null {
    const startY = 130;
    const itemH = 80;
    const itemW = Math.min(500, w - 60);
    const startX = (w - itemW) / 2;

    for (let i = 0; i < CHARACTERS.length; i++) {
      const iy = startY + i * (itemH + 8) + this.scrollY;
      if (iy < 100 || iy > h - 20) continue;

      const btnX = startX + itemW - 100;
      const btnY = iy + 24;
      const btnW = 90;
      const btnH = 32;

      if (x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH) {
        const char = CHARACTERS[i];
        const cost = (char as CharacterDef & { cost?: number }).cost;
        const isUnlocked = save.data.unlockedCharacters.includes(char.id);

        if (isUnlocked) {
          save.data.selectedCharacter = char.id;
          save.save();
          audio.menuSelect();
          return 'selected';
        } else if (cost !== undefined && save.data.gold >= cost) {
          save.data.gold -= cost;
          save.unlockCharacter(char.id);
          save.data.selectedCharacter = char.id;
          save.save();
          audio.levelUp();
          return 'unlocked';
        } else {
          audio.playerHit();
          return null;
        }
      }
    }
    return null;
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, save: SaveSystem): void {
    if (!this.visible) return;

    // Reuse the game's quarantine artwork so every non-combat screen shares
    // the same cold metal and dried-blood visual language.
    if (!this.backdrop || this.backdrop.width !== Math.ceil(w) || this.backdrop.height !== Math.ceil(h)) {
      this.backdrop = createQuarantineBackdrop(w, h);
    }
    ctx.drawImage(this.backdrop, 0, 0, w, h);
    ctx.fillStyle = 'rgba(4, 7, 9, 0.36)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = C.danger;
    ctx.fillRect(0, 0, w, 4);

    // Title
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const compact = w < 520;
    ctx.fillStyle = C.text;
    ctx.font = `bold ${compact ? Math.min(19, w * 0.05) : Math.min(32, w * 0.045)}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText(compact ? 'KHO ĐỒ & NÂNG CẤP' : '⚙ KHO VŨ KHÍ & NÂNG CẤP', w / 2, compact ? 52 : 35);

    // Gold display
    ctx.fillStyle = C.amberBright;
    ctx.font = `bold ${Math.min(18, compact ? 16 : w * 0.025)}px 'Segoe UI', Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(`💰 ${save.data.gold} Gold`, compact ? 14 : 20, compact ? 27 : 35);

    // Back button
    const backBtnW = compact ? 96 : 110;
    const backBtnX = w - (compact ? 106 : 130);
    this.drawButton(ctx, backBtnX, compact ? 10 : 20, backBtnW, compact ? 32 : 36, '← QUAY LẠI', C.inactive);

    // Tabs
    const tabY = 70;
    const tabW = 140;
    this.drawButton(ctx, w / 2 - tabW - 10, tabY, tabW, 34,
      '⚔ NÂNG CẤP', this.tab === 'upgrades' ? C.cyan : C.panelRaised);
    this.drawButton(ctx, w / 2 + 10, tabY, tabW, 34,
      '👤 NHÂN VẬT', this.tab === 'characters' ? C.cyan : C.panelRaised);

    // Content
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 110, w, h - 110);
    ctx.clip();

    if (this.tab === 'upgrades') {
      this.drawUpgrades(ctx, w, h, save);
    } else {
      this.drawCharacters(ctx, w, h, save);
    }

    ctx.restore();
  }

  private drawUpgrades(ctx: CanvasRenderingContext2D, w: number, h: number, save: SaveSystem): void {
    const startY = 130;
    const itemH = w < 520 ? 82 : 72;
    const itemW = Math.min(500, w - 60);
    const startX = (w - itemW) / 2;

    for (let i = 0; i < PERM_UPGRADES.length; i++) {
      const def = PERM_UPGRADES[i];
      const level = save.getPermUpgradeLevel(def.id);
      const iy = startY + i * (itemH + 8) + this.scrollY;

      if (iy < 80 || iy > h + 50) continue;

      // Background
      ctx.fillStyle = level >= def.maxLevel ? '#202c28' : C.panel;
      ctx.strokeStyle = level >= def.maxLevel ? '#627b63' : C.borderSoft;
      ctx.lineWidth = 1;
      this.roundRect(ctx, startX, iy, itemW, itemH, 8);
      ctx.fill();
      ctx.stroke();

      // Icon
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(def.icon, startX + 30, iy + itemH / 2);

      // Name
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 14px 'Segoe UI', Arial, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(def.name, startX + 55, iy + 22);

      // Effect copy wraps to stay clear of the purchase button on small screens.
      ctx.fillStyle = C.textSoft;
      ctx.font = `${w < 520 ? 11 : 12}px 'Segoe UI', Arial, sans-serif`;
      const effectX = startX + 55;
      const effectMaxWidth = itemW - 170;
      if (w < 520) {
        const lines: string[] = [];
        let line = '';
        for (const word of def.effect.split(' ')) {
          const candidate = line ? `${line} ${word}` : word;
          if (line && ctx.measureText(candidate).width > effectMaxWidth) {
            lines.push(line);
            line = word;
          } else {
            line = candidate;
          }
        }
        if (line) lines.push(line);
        lines.slice(0, 2).forEach((text, lineIndex) => ctx.fillText(text, effectX, iy + 40 + lineIndex * 13));
      } else {
        ctx.fillText(def.effect, effectX, iy + 40);
      }

      // Level dots
      for (let d = 0; d < def.maxLevel; d++) {
        ctx.fillStyle = d < level ? C.amber : C.inactive;
        ctx.beginPath();
        ctx.arc(startX + 55 + d * 14, iy + itemH - 13, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Buy button
      if (level < def.maxLevel) {
        const cost = def.costs[level];
        const canAfford = save.data.gold >= cost;
        this.drawButton(ctx, startX + itemW - 90, iy + 20, 80, 32,
          `${cost} 💰`, canAfford ? C.health : C.inactive);
      } else {
        ctx.fillStyle = C.health;
        ctx.font = `bold 12px 'Segoe UI', Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('MAXED', startX + itemW - 50, iy + 36);
      }
    }
  }

  private drawCharacters(ctx: CanvasRenderingContext2D, w: number, h: number, save: SaveSystem): void {
    const startY = 130;
    const itemH = 80;
    const itemW = Math.min(500, w - 60);
    const startX = (w - itemW) / 2;

    for (let i = 0; i < CHARACTERS.length; i++) {
      const char = CHARACTERS[i];
      const isUnlocked = save.data.unlockedCharacters.includes(char.id);
      const isSelected = save.data.selectedCharacter === char.id;
      const iy = startY + i * (itemH + 8) + this.scrollY;

      if (iy < 80 || iy > h + 50) continue;

      // Background
      ctx.fillStyle = isSelected ? '#1d3033' : C.panel;
      ctx.strokeStyle = isSelected ? C.cyan : C.borderSoft;
      ctx.lineWidth = isSelected ? 2 : 1;
      this.roundRect(ctx, startX, iy, itemW, itemH, 8);
      ctx.fill();
      ctx.stroke();

      // Character preview
      ctx.fillStyle = isUnlocked ? char.color : '#444444';
      ctx.beginPath();
      ctx.arc(startX + 35, iy + itemH / 2, 18, 0, Math.PI * 2);
      ctx.fill();
      // Eyes
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(startX + 31, iy + itemH / 2 - 4, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(startX + 39, iy + itemH / 2 - 4, 3, 0, Math.PI * 2);
      ctx.fill();

      // Lock for locked characters
      if (!isUnlocked) {
        ctx.fillStyle = '#888888';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🔒', startX + 35, iy + itemH / 2 + 2);
      }

      // Name
      ctx.fillStyle = isUnlocked ? C.text : C.textMuted;
      ctx.font = `bold 14px 'Segoe UI', Arial, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(char.name, startX + 65, iy + 26);

      // Description
      ctx.fillStyle = C.textSoft;
      ctx.font = `12px 'Segoe UI', Arial, sans-serif`;
      ctx.fillText(char.description, startX + 65, iy + 44);

      // Button
      if (isSelected) {
        ctx.fillStyle = C.cyanBright;
        ctx.font = `bold 12px 'Segoe UI', Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('✓ SELECTED', startX + itemW - 55, iy + 42);
      } else if (isUnlocked) {
        this.drawButton(ctx, startX + itemW - 100, iy + 24, 90, 32, 'CHỌN', C.cyan);
      } else {
        const cost = (char as CharacterDef & { cost?: number }).cost;
        const canAfford = cost !== undefined && save.data.gold >= cost;
        this.drawButton(ctx, startX + itemW - 100, iy + 24, 90, 32,
          cost === undefined ? '—' : `${cost} 💰`, canAfford ? C.health : C.inactive);
      }
    }
  }

  private drawButton(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, text: string, color: string): void {
    ctx.fillStyle = color;
    this.roundRect(ctx, x, y, w, h, 6);
    ctx.fill();

    ctx.fillStyle = color === C.cyan || color === C.health ? C.black : C.text;
    ctx.font = `bold ${Math.min(13, w * 0.12)}px 'Segoe UI', Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2);
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
