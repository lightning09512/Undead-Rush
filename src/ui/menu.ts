// ─── Menu Screens: Main Menu, Pause, Game Over, Stage Complete ───

import { Audio } from '../core/audio';
import { SaveSystem, type CampaignDifficulty } from '../systems/save';
import { UI_PALETTE as C } from './palette';
import { STAGES } from '../data/meta';
import { getUiTerm, sentenceCaseDisplay } from '../data/localization';
import { createQuarantineBackdrop, drawBloodHandprint, drawWornPanel } from './horror-texture';

export type MenuScreen = 'main' | 'newgame' | 'savegame' | 'settings' | 'campaign' | 'playing' | 'paused' | 'gameover' | 'hunter_profile' | 'tutorial';

export class MenuUI {
  currentScreen: MenuScreen = 'main';

  // Game over stats
  finalTime = 0;
  finalKills = 0;
  finalScore = 0;
  finalGold = 0;
  confirmNewGame = false;
  newGameStep: 'mode' | 'difficulty' = 'mode';
  selectedCampaignDifficulty: CampaignDifficulty = 'normal';
  canWatchRevive = true;
  reviveAdAvailable = false;
  reviveAdPending = false;

  // Animation
  private titlePulse = 0;
  private bgParticles: { x: number; y: number; vx: number; vy: number; size: number }[] = [];
  private pointerX = -1;
  private pointerY = -1;
  private backdrop?: HTMLCanvasElement;
  private backdropLanguage?: 'vi' | 'en';
  private language: 'vi' | 'en' = 'vi';

  setPointer(x: number, y: number): void {
    this.pointerX = x;
    this.pointerY = y;
  }

  private drawStaticBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, shade = 0): void {
    if (!this.backdrop || this.backdrop.width !== Math.ceil(w) || this.backdrop.height !== Math.ceil(h) || this.backdropLanguage !== this.language) {
      this.backdrop = createQuarantineBackdrop(w, h, this.language);
      this.backdropLanguage = this.language;
    }
    ctx.drawImage(this.backdrop, 0, 0, w, h);
    if (shade > 0) {
      ctx.fillStyle = `rgba(4, 7, 9, ${shade})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  /** The same geometry is used for drawing and clicking, including short landscape. */
  private mainLayout(w: number, h: number) {
    const landscape = h < 540 && w > 620;
    const cardW = landscape ? Math.min(760, w - 36) : Math.min(430, w - 32);
    const cardH = landscape ? Math.min(388, h - 28) : Math.min(590, h - 32);
    const x = !landscape && w >= 850 ? Math.max(28, w * 0.11) : (w - cardW) / 2;
    const y = Math.max(14, (h - cardH) / 2);
    const titleX = landscape ? x + cardW * 0.245 : x + cardW / 2;
    const buttonW = landscape ? cardW * 0.46 : cardW - 52;
    const buttonH = Math.min(44, Math.max(32, (cardH - (landscape ? 76 : 252)) / 5 - 8));
    const buttonX = landscape ? x + cardW * 0.51 : x + 26;
    const buttonY = landscape ? y + 42 : y + Math.min(224, cardH * 0.375);
    return { x, y, cardW, cardH, landscape, titleX, buttonX, buttonY, buttonW, buttonH, gap: buttonH + 8 };
  }

  private newGameLayout(w: number, h: number) {
    const base = this.mainLayout(w, h);
    const buttonH = Math.min(48, Math.max(34, base.buttonH));
    return { ...base, buttonY: base.landscape ? base.y + 78 : base.y + Math.min(base.cardH * .51, 302),
      buttonH, gap: buttonH + 10 };
  }

  private resultLayout(w: number, h: number) {
    const compact = h < 550 && w > 600;
    const panelW = Math.min(compact ? 700 : 460, w - 32);
    const panelH = Math.min(compact ? 350 : 552, h - 28);
    const x = (w - panelW) / 2;
    const y = (h - panelH) / 2;
    const buttonW = compact ? panelW * 0.42 : panelW - 52;
    const buttonH = Math.min(44, Math.max(32, panelH * 0.085));
    const buttonX = compact ? x + panelW * 0.53 : x + 26;
    const buttonY = compact ? y + 124 : y + panelH - 3 * (buttonH + 10) - 28;
    return { x, y, panelW, panelH, compact, buttonX, buttonY, buttonW, buttonH, gap: buttonH + 10 };
  }

  private saveMenuLayout(w: number, h: number) {
    const landscape = h < 520 && w > 620;
    const panelW = Math.min(landscape ? 760 : 500, w - 32);
    const panelH = Math.min(landscape ? 340 : 430, h - 28);
    const x = (w - panelW) / 2, y = (h - panelH) / 2;
    const buttonW = Math.min(landscape ? 450 : 390, panelW - 44);
    const buttonH = Math.min(44, Math.max(32, (panelH - (landscape ? 116 : 176)) / 4 - 8));
    const buttonX = x + (panelW - buttonW) / 2;
    const buttonY = y + (landscape ? 96 : 126);
    return { x, y, panelW, panelH, buttonX, buttonY, buttonW, buttonH, gap: buttonH + 9 };
  }

  private settingsLayout(w: number, h: number) {
    const panelW = Math.min(500, w - 32), panelH = Math.min(390, h - 28);
    const x = (w - panelW) / 2, y = (h - panelH) / 2;
    const rowX = x + 24, rowW = panelW - 48;
    const languageY = y + panelH * .34;
    const musicY = y + panelH * .62;
    const buttonH = Math.min(46, Math.max(30, panelH * .12));
    const backY = y + panelH - buttonH - 14;
    return { x, y, panelW, panelH, rowX, rowW, languageY, musicY, buttonH, backY };
  }

  private newGameConfirmLayout(w: number, h: number) {
    const panelW = Math.min(440, w - 28);
    const panelH = Math.min(220, h - 24);
    const x = (w - panelW) / 2, y = (h - panelH) / 2;
    const buttonY = y + panelH - 57;
    const buttonW = (panelW - 54) / 2;
    return { x, y, panelW, panelH, buttonY, buttonW, confirmX: x + 18, cancelX: x + 36 + buttonW };
  }

  private newGameDifficultyLayout(w: number, h: number) {
    const base = this.newGameLayout(w, h);
    const backH = Math.min(38, Math.max(30, base.buttonH - 8));
    const backY = base.y + base.cardH - backH - 13;
    const itemY = base.y + (base.landscape ? 48 : 105);
    const gap = 6;
    const itemH = Math.max(46, Math.min(94, (backY - itemY - gap * 2 - 8) / 3));
    return { ...base, itemY, itemH, gap, backY, backH };
  }

  constructor() {
    // Initialize background particles for main menu
    for (let i = 0; i < 50; i++) {
      this.bgParticles.push({
        x: Math.random() * 2000,
        y: Math.random() * 1200,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 20,
        size: 1 + Math.random() * 3,
      });
    }
  }

  handleClick(x: number, y: number, w: number, h: number, audio: Audio, save?: SaveSystem): string | null {
    switch (this.currentScreen) {
      case 'main': return this.handleMainMenuClick(x, y, w, h, audio, save);
      case 'newgame': return this.handleNewGameMenuClick(x, y, w, h, audio, save);
      case 'savegame': return this.handleSaveGameClick(x, y, w, h, audio, save);
      case 'settings': return this.handleSettingsClick(x, y, w, h, audio, save);
      case 'paused': return this.handlePauseClick(x, y, w, h, audio);
      case 'gameover': return this.handleGameOverClick(x, y, w, h, audio);
      case 'hunter_profile': return this.handleHunterProfileClick(x, y, w, h, audio);
      case 'tutorial': return this.handleTutorialClick(x, y, w, h, audio);
    }
    return null;
  }

  private handleMainMenuClick(x: number, y: number, w: number, h: number, audio: Audio, save?: SaveSystem): string | null {
    const { buttonW: btnW, buttonH: btnH, buttonX: bx, buttonY: startY, gap } = this.mainLayout(w, h);
    const row = Math.floor((y - startY) / gap);
    const rowY = startY + row * gap;
    if (x < bx || x > bx + btnW || row < 0 || row > 4 || y < rowY || y > rowY + btnH) return null;
    if (row === 0) { audio.menuSelect(); return 'open_new_game'; }
    if (row === 1) {
      if (!save?.data.campaign.hasCheckpoint) return null;
      audio.menuSelect(); return 'load_game';
    }
    audio.menuSelect();
    if (row === 2) return 'open_settings';
    if (row === 3) return 'open_hunter_profile';
    return 'open_tutorial';
  }

  private handleNewGameMenuClick(x: number, y: number, w: number, h: number, audio: Audio, save?: SaveSystem): string | null {
    if (this.confirmNewGame) {
      const l = this.newGameConfirmLayout(w, h);
      const buttonH = 38;
      if (x >= l.confirmX && x <= l.confirmX + l.buttonW && y >= l.buttonY && y <= l.buttonY + buttonH) {
        audio.menuSelect(); return 'new_game';
      }
      if (x >= l.cancelX && x <= l.cancelX + l.buttonW && y >= l.buttonY && y <= l.buttonY + buttonH) {
        audio.menuSelect(); return 'cancel_new_game';
      }
      return null;
    }

    if (this.newGameStep === 'difficulty') {
      const l = this.newGameDifficultyLayout(w, h);
      const choices: CampaignDifficulty[] = ['normal', 'hard', 'impossible'];
      const row = Math.floor((y - l.itemY) / (l.itemH + l.gap));
      const rowY = l.itemY + row * (l.itemH + l.gap);
      if (x >= l.buttonX && x <= l.buttonX + l.buttonW && row >= 0 && row < choices.length &&
          y >= rowY && y <= rowY + l.itemH) {
        this.selectedCampaignDifficulty = choices[row];
        audio.menuSelect();
        if (this.hasCampaignProgress(save)) { this.confirmNewGame = true; return null; }
        return 'new_game';
      }
      if (x >= l.buttonX && x <= l.buttonX + l.buttonW && y >= l.backY && y <= l.backY + l.backH) {
        this.newGameStep = 'mode'; audio.menuSelect(); return null;
      }
      return null;
    }

    const l = this.newGameLayout(w, h);
    const row = Math.floor((y - l.buttonY) / l.gap);
    const rowY = l.buttonY + row * l.gap;
    if (x < l.buttonX || x > l.buttonX + l.buttonW || row < 0 || row > 2 || y < rowY || y > rowY + l.buttonH) return null;
    if (row === 0) {
      this.newGameStep = 'difficulty';
      audio.menuSelect();
      return null;
    }
    audio.menuSelect();
    if (row === 1) return 'start_endless';
    return 'back_to_main';
  }

  private hasCampaignProgress(save?: SaveSystem): boolean {
    const campaign = save?.data.campaign;
    if (!campaign) return false;
    return campaign.hasCheckpoint || campaign.unlockedStage > 1 || campaign.lastStage > 1
      || campaign.completedStages.length > 0 || campaign.credits !== 160
      || campaign.ownedGuns.some(id => id !== 'p9') || campaign.equippedGun !== 'p9'
      || campaign.selectedCharacter !== 'survivor'
      || Object.keys(campaign.gunLevels).length > 0 || Object.keys(campaign.gunAmmo).length > 0
      || campaign.ammoPacks > 0 || campaign.medKits > 0 || campaign.armorLevel > 0
      || campaign.flashlightLevel !== 1 || Object.keys(campaign.cardLevels).length > 0
      || Object.keys(campaign.stageScores).length > 0;
  }

  private handleSettingsClick(x: number, y: number, w: number, h: number, audio: Audio, save?: SaveSystem): string | null {
    if (!save) return null;
    const l = this.settingsLayout(w, h);
    const halfW = (l.rowW - 8) / 2;
    if (y >= l.languageY + 25 && y <= l.languageY + 25 + l.buttonH) {
      if (x >= l.rowX && x <= l.rowX + halfW) save.data.language = 'vi';
      else if (x >= l.rowX + halfW + 8 && x <= l.rowX + l.rowW) save.data.language = 'en';
      else return null;
      save.save(); audio.menuSelect(); return null;
    }
    if (x >= l.rowX && x <= l.rowX + l.rowW && y >= l.musicY + 25 && y <= l.musicY + 25 + l.buttonH) {
      save.data.musicEnabled = !save.data.musicEnabled;
      save.save(); audio.setMusicEnabled(save.data.musicEnabled); audio.menuSelect();
      return null;
    }
    if (x >= l.rowX && x <= l.rowX + l.rowW && y >= l.backY && y <= l.backY + l.buttonH) {
      audio.menuSelect(); return 'back_to_main';
    }
    return null;
  }

  private handleSaveGameClick(x: number, y: number, w: number, h: number, audio: Audio, save?: SaveSystem): string | null {
    if (this.confirmNewGame) {
      const l = this.newGameConfirmLayout(w, h);
      const buttonH = 38;
      if (x >= l.confirmX && x <= l.confirmX + l.buttonW && y >= l.buttonY && y <= l.buttonY + buttonH) {
        audio.menuSelect();
        return 'new_game';
      }
      if (x >= l.cancelX && x <= l.cancelX + l.buttonW && y >= l.buttonY && y <= l.buttonY + buttonH) {
        audio.menuSelect();
        return 'cancel_new_game';
      }
      return null;
    }

    const l = this.saveMenuLayout(w, h);
    const row = Math.floor((y - l.buttonY) / l.gap);
    const rowY = l.buttonY + row * l.gap;
    if (x < l.buttonX || x > l.buttonX + l.buttonW || row < 0 || row > 3 || y < rowY || y > rowY + l.buttonH) return null;
    if (row === 0) { audio.menuSelect(); return 'open_new_game'; }
    if (row === 1) {
      if (!save?.data.campaign.hasCheckpoint) return null;
      audio.menuSelect(); return 'load_game';
    }
    if (row === 2) { audio.menuSelect(); return 'select_campaign_stage'; }
    audio.menuSelect(); return 'back_to_main';
  }

  private handlePauseClick(x: number, y: number, w: number, h: number, audio: Audio): string | null {
    const btnW = 200;
    const btnH = 45;
    const bx = (w - btnW) / 2;

    const startY = h / 2 - 10;
    if (x >= bx && x <= bx + btnW && y >= startY && y <= startY + btnH) {
      audio.menuSelect();
      return 'resume';
    }
    if (x >= bx && x <= bx + btnW && y >= startY + 58 && y <= startY + 58 + btnH) {
      audio.menuSelect();
      return 'quit';
    }
    return null;
  }

  private handleGameOverClick(x: number, y: number, w: number, h: number, audio: Audio): string | null {
    if (this.reviveAdPending) return null;
    const { buttonX: bx, buttonW: btnW, buttonH: btnH, buttonY, gap } = this.resultLayout(w, h);

    // Retry
    if (x >= bx && x <= bx + btnW && y >= buttonY && y <= buttonY + btnH) {
      audio.menuSelect();
      return 'retry';
    }
    // Main menu
    if (x >= bx && x <= bx + btnW && y >= buttonY + gap && y <= buttonY + gap + btnH) {
      audio.menuSelect();
      return 'menu';
    }
    // Revive ad
    if (!this.canWatchRevive || !this.reviveAdAvailable || this.reviveAdPending) return null;
    if (x >= bx && x <= bx + btnW && y >= buttonY + gap * 2 && y <= buttonY + gap * 2 + btnH) {
      audio.menuSelect();
      return 'revive_ad';
    }
    return null;
  }

  private handleHunterProfileClick(x: number, y: number, w: number, h: number, audio: Audio): string | null {
    const btnW = 200;
    const btnH = 45;
    const bx = (w - btnW) / 2;

    // Back button
    if (x >= bx && x <= bx + btnW && y >= h - 58 && y <= h - 58 + btnH) {
      audio.menuSelect();
      return 'menu';
    }
    return null;
  }

  private handleTutorialClick(x: number, y: number, w: number, h: number, audio: Audio): string | null {
    const btnW = 200;
    const btnH = 45;
    const bx = (w - btnW) / 2;

    // Back button
    if (x >= bx && x <= bx + btnW && y >= h - 58 && y <= h - 58 + btnH) {
      audio.menuSelect();
      return 'menu';
    }
    return null;
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, save?: SaveSystem): void {
    this.titlePulse += 0.02;
    this.language = save?.data.language ?? 'vi';

    switch (this.currentScreen) {
      case 'main': this.drawMainMenu(ctx, w, h, save); break;
      case 'newgame': this.drawNewGameMenu(ctx, w, h, save); break;
      case 'savegame': this.drawSaveGameMenu(ctx, w, h, save); break;
      case 'settings': this.drawSettings(ctx, w, h, save); break;
      case 'paused': this.drawPause(ctx, w, h, save); break;
      case 'gameover': this.drawGameOver(ctx, w, h, save); break;
      case 'hunter_profile': this.drawHunterProfile(ctx, w, h, save); break;
      case 'tutorial': this.drawTutorial(ctx, w, h, save); break;
    }
  }

  private drawMainMenu(ctx: CanvasRenderingContext2D, w: number, h: number, save?: SaveSystem): void {
    this.drawStaticBackdrop(ctx, w, h);
    const english = save?.data.language === 'en';
    const l = this.mainLayout(w, h);
    const { x, y, cardW, cardH, titleX } = l;
    ctx.save();
    drawWornPanel(ctx, x, y, cardW, cardH, true);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = C.textMuted;
    ctx.font = "bold 10px 'Segoe UI', Arial, sans-serif";
    ctx.fillText(english ? 'Quarantine zone / 03' : 'Khu cách ly / 03', x + 26, y + 27);
    const titleTop = l.landscape ? y + 95 : y + 78;
    const titleSize = l.landscape ? Math.min(50, cardW * 0.072) : Math.min(55, cardW * 0.145);
    ctx.textAlign = 'center';
    ctx.fillStyle = C.text;
    ctx.font = `900 ${titleSize}px 'Arial Black', Impact, sans-serif`;
    ctx.fillText('UNDEAD', titleX, titleTop);
    ctx.fillStyle = C.dangerBright;
    ctx.fillText('RUSH', titleX, titleTop + titleSize * 0.91);
    // Small scars cut through the lettering like flaked paint, never through menu labels.
    ctx.strokeStyle = '#192125'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(titleX - 73, titleTop - 16); ctx.lineTo(titleX - 48, titleTop + 10);
    ctx.moveTo(titleX + 30, titleTop + titleSize * 0.66); ctx.lineTo(titleX + 46, titleTop + titleSize * 1.06); ctx.stroke();
    ctx.fillStyle = C.textSoft;
    ctx.font = "11px 'Segoe UI', Arial, sans-serif";
    ctx.fillText(english ? 'Survive the outbreak' : 'Sống sót qua vùng dịch', titleX, titleTop + titleSize + 31);
    if (l.landscape) {
      ctx.strokeStyle = C.borderSoft; ctx.beginPath(); ctx.moveTo(x + cardW * 0.48, y + 47); ctx.lineTo(x + cardW * 0.48, y + cardH - 48); ctx.stroke();
    } else {
      ctx.fillStyle = C.borderSoft; ctx.fillRect(x + 26, l.buttonY - 14, cardW - 52, 1);
    }
    const checkpoint = save?.data.campaign.hasCheckpoint ?? false;
    const lastStage = save?.data.campaign.lastStage ?? 1;
    const buttons: Array<[string, string, string, boolean]> = [
      [english ? 'New game' : 'Game mới', english ? 'Choose a mode' : 'Chọn chế độ', C.cyan, false],
      [english ? 'Load game' : 'Tải game', checkpoint
        ? english ? `Campaign · mission ${lastStage}` : `Chiến dịch · màn ${lastStage}`
        : english ? 'No campaign save' : 'Chưa có dữ liệu lưu', C.textSoft, !checkpoint],
      [english ? 'Settings' : 'Cài đặt', '', C.amber, false],
      [english ? 'Hunter profile' : 'Hồ sơ thợ săn', '', C.textSoft, false],
      [english ? 'How to play' : 'Hướng dẫn', '', C.textSoft, false],
    ];
    for (let i = 0; i < buttons.length; i++) {
      this.drawFieldButton(ctx, l.buttonX, l.buttonY + i * l.gap, l.buttonW, l.buttonH,
        buttons[i][0], buttons[i][2], i === 0, buttons[i][1], buttons[i][3]);
    }
    const footerY = y + cardH - 35;
    ctx.textAlign = 'left';
    ctx.fillStyle = C.amber;
    ctx.font = "bold 12px 'Segoe UI', Arial, sans-serif";
    ctx.fillText(`${save?.data.gold ?? 0} ${getUiTerm('gold', english ? 'en' : 'vi')}`, x + 26, footerY);
    ctx.textAlign = 'right';
    ctx.fillStyle = C.textMuted;
    ctx.font = "11px 'Segoe UI', Arial, sans-serif";
    const best = save?.data.bestTime ?? 0;
    const bestTime = `${Math.floor(best / 60)}:${Math.floor(best % 60).toString().padStart(2, '0')}`;
    ctx.fillText(english
      ? `Best time ${bestTime} · ${save?.data.bestKills ?? 0} kills`
      : `Kỷ lục ${bestTime} · ${save?.data.bestKills ?? 0} hạ gục`, x + cardW - 26, footerY);
    if (w >= 850 && h >= 540) {
      ctx.textAlign = 'left'; ctx.fillStyle = C.textMuted;
      ctx.font = "11px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(english
        ? 'WASD: move · Mouse: fire · R: reload · Esc: pause'
        : 'WASD: di chuyển · Chuột: bắn · R: nạp đạn · Esc: tạm dừng', x, Math.min(h - 20, y + cardH + 28));
      ctx.textAlign = 'right'; ctx.fillStyle = '#8c8773';
      ctx.font = "bold 11px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(english ? 'The gate is open. Keep moving.' : 'Cửa đã mở. Tiếp tục di chuyển.', w - 35, h - 29);
    }
    ctx.restore();
  }

  private drawNewGameMenu(ctx: CanvasRenderingContext2D, w: number, h: number, save?: SaveSystem): void {
    this.drawStaticBackdrop(ctx, w, h);
    const l = this.newGameLayout(w, h);
    const english = save?.data.language === 'en';
    ctx.save();
    drawWornPanel(ctx, l.x, l.y, l.cardW, l.cardH, true);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = C.textMuted; ctx.font = "bold 10px 'Segoe UI', Arial, sans-serif";
    ctx.fillText(english ? 'Start a new run' : 'Bắt đầu lượt chơi mới', l.x + 26, l.y + 27);
    if (this.newGameStep === 'difficulty') {
      this.drawCampaignDifficultyMenu(ctx, w, h, english);
    } else {
      ctx.textAlign = 'center';
      ctx.fillStyle = C.text; ctx.font = `900 ${Math.min(30, l.cardW * .085)}px 'Arial Black', Impact, sans-serif`;
      ctx.fillText(english ? 'Choose a mode' : 'Chọn chế độ', l.titleX, l.landscape ? l.y + l.cardH * .42 : l.y + 253);
      ctx.fillStyle = C.textSoft; ctx.font = "11px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(english ? 'Choose how you want to survive.' : 'Bạn muốn sống sót trong chế độ nào?', l.titleX,
        l.landscape ? l.y + l.cardH * .51 : l.y + 278, l.landscape ? l.cardW * .46 : l.cardW - 50);
      if (l.landscape) {
        ctx.strokeStyle = C.borderSoft;
        ctx.beginPath(); ctx.moveTo(l.x + l.cardW * .48, l.y + 47); ctx.lineTo(l.x + l.cardW * .48, l.y + l.cardH - 48); ctx.stroke();
      } else {
        ctx.fillStyle = C.borderSoft; ctx.fillRect(l.x + 26, l.buttonY - 14, l.cardW - 52, 1);
      }

      const buttons: Array<[string, string, string]> = [
        [english ? 'Campaign' : 'Chiến dịch', english ? '10 missions · Story' : '10 màn · Cốt truyện', C.cyan],
        [getUiTerm('survival', english ? 'en' : 'vi'), english ? 'Endless mode' : 'Sống sót vô tận', C.amber],
        [english ? 'Back' : 'Quay lại', '', C.textSoft],
      ];
      buttons.forEach(([label, note, color], index) => this.drawFieldButton(ctx,
        l.buttonX, l.buttonY + index * l.gap, l.buttonW, l.buttonH, label, color, index === 0, note));
    }
    ctx.restore();
    if (this.confirmNewGame) this.drawNewGameConfirmation(ctx, w, h, save);
  }

  private drawCampaignDifficultyMenu(ctx: CanvasRenderingContext2D, w: number, h: number, english: boolean): void {
    const l = this.newGameDifficultyLayout(w, h);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = C.text; ctx.font = `900 ${Math.min(27, l.cardW * .07)}px 'Arial Black', Impact, sans-serif`;
    ctx.fillText(english ? 'Choose your nightmare' : 'Chọn độ khó', l.titleX,
      l.landscape ? l.y + l.cardH * .35 : l.y + 62, l.landscape ? l.cardW * .46 : l.cardW - 40);
    ctx.fillStyle = C.textSoft; ctx.font = `${w < 480 ? 9 : 11}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText(english ? 'Set the stakes for this campaign.' : 'Chọn mức thử thách cho Chiến dịch.', l.titleX,
      l.landscape ? l.y + l.cardH * .43 : l.y + 84, l.landscape ? l.cardW * .46 : l.cardW - 42);
    if (l.landscape) {
      ctx.strokeStyle = C.borderSoft;
      ctx.beginPath(); ctx.moveTo(l.x + l.cardW * .48, l.y + 40); ctx.lineTo(l.x + l.cardW * .48, l.y + l.cardH - 48); ctx.stroke();
    } else {
      ctx.fillStyle = C.borderSoft; ctx.fillRect(l.x + 26, l.itemY - 8, l.cardW - 52, 1);
    }

    const options: Array<{ id: CampaignDifficulty; name: string; stats: string; dread: string; color: string }> = english ? [
      { id: 'normal', name: 'Normal', stats: 'Standard enemy health and damage · Attack direction visible.', dread: 'Warning signs give you a moment to react.', color: C.cyan },
      { id: 'hard', name: 'Hard', stats: '+30% enemy health and damage · Attack direction hidden.', dread: 'Warnings fade. You hear claws when they are already close.', color: C.amber },
      { id: 'impossible', name: 'Impossible', stats: '+50% enemy health and damage · No attack direction.', dread: 'One death erases the campaign save. Begin again at mission 1.', color: C.dangerBright },
    ] : [
      { id: 'normal', name: 'Bình thường', stats: 'Máu và sát thương tiêu chuẩn · Hiện hướng đòn đánh.', dread: 'Tín hiệu cảnh báo cho bạn thời gian né đòn.', color: C.cyan },
      { id: 'hard', name: 'Khó', stats: 'Quái +30% máu, +30% sát thương · Ẩn hướng đòn đánh.', dread: 'Tín hiệu tắt. Chỉ còn tiếng móng vuốt khi chúng đã áp sát.', color: C.amber },
      { id: 'impossible', name: 'Cực khó', stats: 'Quái +50% máu, +50% sát thương · Không hiện hướng đòn đánh.', dread: 'Chết là mất hồ sơ Chiến dịch. Chơi lại từ màn 1.', color: C.dangerBright },
    ];
    options.forEach((option, index) => {
      const x = l.buttonX, y = l.itemY + index * (l.itemH + l.gap), cardW = l.buttonW, cardH = l.itemH;
      ctx.fillStyle = '#192024'; ctx.strokeStyle = option.color; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.roundRect(x, y, cardW, cardH, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = option.color; ctx.fillRect(x + 8, y + 8, 3, Math.max(12, cardH - 16));
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = option.color; ctx.font = `900 ${w < 480 ? 10 : 12}px 'Arial Black', Impact, sans-serif`;
      ctx.fillText(option.name, x + 19, y + 15, cardW - 32);
      const compact = cardH < 67;
      ctx.fillStyle = C.text; ctx.font = `${w < 480 ? 8 : compact ? 9 : 10}px 'Segoe UI', Arial, sans-serif`;
      ctx.fillText(option.stats, x + 19, y + (cardH < 54 ? 27 : compact ? 31 : 36), cardW - 32);
      ctx.fillStyle = C.textMuted; ctx.font = `italic ${w < 480 ? 8 : compact ? 9 : 10}px 'Segoe UI', Arial, sans-serif`;
      ctx.fillText(option.dread, x + 19, y + (cardH < 54 ? 39 : compact ? 46 : 55), cardW - 32);
    });
    this.drawFieldButton(ctx, l.buttonX, l.backY, l.buttonW, l.backH,
      english ? 'Back to modes' : 'Quay lại chọn chế độ', C.textSoft);
  }

  private drawSettings(ctx: CanvasRenderingContext2D, w: number, h: number, save?: SaveSystem): void {
    this.drawStaticBackdrop(ctx, w, h, .24);
    const l = this.settingsLayout(w, h);
    const english = save?.data.language === 'en';
    const language = save?.data.language ?? 'vi';
    const musicEnabled = save?.data.musicEnabled ?? true;
    ctx.save();
    drawWornPanel(ctx, l.x, l.y, l.panelW, l.panelH, true);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = C.textMuted; ctx.font = "bold 10px 'Segoe UI', Arial, sans-serif";
    ctx.fillText(english ? 'Survivor settings' : 'Cài đặt', l.rowX, l.y + 28);
    ctx.fillStyle = C.text; ctx.font = `900 ${Math.min(32, l.panelW * .075)}px 'Arial Black', Impact, sans-serif`;
    ctx.fillText(english ? 'Settings' : 'Cài đặt', l.rowX, l.y + 66);
    ctx.fillStyle = C.borderSoft; ctx.fillRect(l.rowX, l.y + 88, l.rowW, 1);

    const halfW = (l.rowW - 8) / 2;
    ctx.fillStyle = C.textSoft; ctx.font = "bold 12px 'Segoe UI', Arial, sans-serif";
    ctx.fillText(english ? 'Language' : 'Ngôn ngữ', l.rowX, l.languageY);
    this.drawFieldButton(ctx, l.rowX, l.languageY + 25, halfW, l.buttonH,
      english ? 'Vietnamese' : 'Tiếng Việt', C.cyan, language === 'vi', language === 'vi' ? (english ? 'Selected' : 'Đang chọn') : '');
    this.drawFieldButton(ctx, l.rowX + halfW + 8, l.languageY + 25, halfW, l.buttonH,
      'English', C.cyan, language === 'en', language === 'en' ? (english ? 'Selected' : 'Đang chọn') : '');

    ctx.fillStyle = C.textSoft; ctx.font = "bold 12px 'Segoe UI', Arial, sans-serif";
    ctx.fillText(english ? 'Music' : 'Nhạc nền', l.rowX, l.musicY);
    this.drawFieldButton(ctx, l.rowX, l.musicY + 25, l.rowW, l.buttonH,
      musicEnabled ? (english ? 'On' : 'Bật') : (english ? 'Off' : 'Tắt'),
      musicEnabled ? C.cyan : C.textMuted, musicEnabled, english ? 'Toggle' : 'Bật / tắt');

    this.drawFieldButton(ctx, l.rowX, l.backY, l.rowW, l.buttonH,
      english ? 'Back to menu' : 'Quay lại menu', C.textSoft);
    ctx.restore();
  }

  private drawSaveGameMenu(ctx: CanvasRenderingContext2D, w: number, h: number, save?: SaveSystem): void {
    const english = save?.data.language === 'en';
    this.drawStaticBackdrop(ctx, w, h, .28);
    const l = this.saveMenuLayout(w, h);
    ctx.save();
    drawWornPanel(ctx, l.x, l.y, l.panelW, l.panelH, true);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = C.textMuted; ctx.font = "bold 10px 'Segoe UI', Arial, sans-serif";
    ctx.fillText(english ? 'Campaign / save data' : 'Chiến dịch / dữ liệu lưu', w / 2, l.y + 27);
    ctx.fillStyle = C.text; ctx.font = `900 ${Math.min(30, l.panelW * .075)}px 'Arial Black', Impact, sans-serif`;
    ctx.fillText(english ? 'New game / load game' : 'Game mới / tải game', w / 2, l.y + 56, l.panelW - 36);
    ctx.fillStyle = C.textSoft; ctx.font = "11px 'Segoe UI', Arial, sans-serif";
    ctx.fillText(english ? 'Start a new file or continue from your campaign save.' : 'Tạo hồ sơ mới hoặc tiếp tục từ dữ liệu lưu Chiến dịch.', w / 2, l.y + 78, l.panelW - 36);

    const checkpoint = save?.data.campaign.hasCheckpoint ?? false;
    const lastStage = save?.data.campaign.lastStage ?? 1;
    const buttons: Array<[string, string, string, boolean]> = [
      [english ? 'New game' : 'Game mới', english ? 'Reset campaign progress and begin at Mission 1' : 'Xóa tiến trình cũ và bắt đầu Chiến dịch từ màn 1', C.amber, false],
      [english ? 'Load game' : 'Tải game', checkpoint ? english ? `Mission ${lastStage} · Restart this mission` : `Màn ${lastStage} · Chơi lại từ đầu màn` : english ? 'No campaign save' : 'Chưa có dữ liệu lưu Chiến dịch', C.cyan, !checkpoint],
      [english ? 'Choose mission' : 'Chọn màn', english ? 'View unlocked missions' : 'Xem bản đồ các màn đã mở khóa', C.textSoft, false],
      [english ? 'Back to menu' : 'Về menu', '', C.textMuted, false],
    ];
    buttons.forEach(([label, note, color, disabled], index) => this.drawFieldButton(ctx,
      l.buttonX, l.buttonY + index * l.gap, l.buttonW, l.buttonH, label, color, index === 1 && !disabled, note, disabled));
    ctx.restore();
    if (this.confirmNewGame) this.drawNewGameConfirmation(ctx, w, h, save);
  }

  private drawNewGameConfirmation(ctx: CanvasRenderingContext2D, w: number, h: number, save?: SaveSystem): void {
    const l = this.newGameConfirmLayout(w, h);
    const english = save?.data.language === 'en';
    ctx.save();
    ctx.fillStyle = 'rgba(2, 4, 5, .76)'; ctx.fillRect(0, 0, w, h);
    drawWornPanel(ctx, l.x, l.y, l.panelW, l.panelH, true);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = C.amberBright; ctx.font = "900 19px 'Arial Black', Impact, sans-serif";
    ctx.fillText(english ? 'Start a new campaign?' : 'Bắt đầu Chiến dịch mới?', w / 2, l.y + 34, l.panelW - 32);
    ctx.fillStyle = C.textSoft; ctx.font = "12px 'Segoe UI', Arial, sans-serif";
    ctx.fillText(english
      ? 'Campaign progress, credits, weapons, and equipment will be reset.'
      : 'Tiến trình, tín dụng, súng và trang bị Chiến dịch sẽ được đặt lại.',
    w / 2, l.y + 75, l.panelW - 34);
    ctx.fillText(english ? 'Survival records will remain. You can cancel.' : 'Hồ sơ Sinh tồn được giữ nguyên. Bạn có thể hủy.',
      w / 2, l.y + 98, l.panelW - 34);
    const difficultyName = english
      ? ({ normal: 'Normal', hard: 'Hard', impossible: 'Impossible' } as const)[this.selectedCampaignDifficulty]
      : ({ normal: 'Bình thường', hard: 'Khó', impossible: 'Cực khó' } as const)[this.selectedCampaignDifficulty];
    ctx.fillStyle = this.selectedCampaignDifficulty === 'impossible' ? C.dangerBright : C.amberBright;
    ctx.font = "bold 11px 'Segoe UI', Arial, sans-serif";
    ctx.fillText(`${english ? 'Difficulty' : 'Độ khó'}: ${difficultyName}`,
      w / 2, l.y + 121, l.panelW - 34);
    this.drawFieldButton(ctx, l.confirmX, l.buttonY, l.buttonW, 38,
      english ? 'Start Campaign' : 'Bắt đầu', C.dangerBright, true);
    this.drawFieldButton(ctx, l.cancelX, l.buttonY, l.buttonW, 38, english ? 'Cancel' : 'Hủy', C.textSoft);
    ctx.restore();
  }

  private drawPause(ctx: CanvasRenderingContext2D, w: number, h: number, save?: SaveSystem): void {
    const english = save?.data.language === 'en';
    ctx.fillStyle = 'rgba(5, 8, 10, 0.78)'; ctx.fillRect(0, 0, w, h);
    const pw = Math.min(350, w - 32); const ph = Math.min(304, h - 24);
    const px = (w - pw) / 2; const py = h / 2 - 134;
    drawWornPanel(ctx, px, py, pw, ph, true);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = C.textMuted; ctx.font = "11px 'Segoe UI', Arial, sans-serif";
    ctx.fillText(english ? 'Field pause' : 'Tạm nghỉ', w / 2, h / 2 - 98);
    ctx.fillStyle = C.text; ctx.font = "bold 29px 'Segoe UI', Arial, sans-serif";
    ctx.fillText(english ? 'Paused' : 'Tạm dừng', w / 2, h / 2 - 64);
    const bx = (w - 200) / 2;
    this.drawFieldButton(ctx, bx, h / 2 - 10, 200, 45, english ? 'Resume' : 'Tiếp tục', C.cyan, true);
    this.drawFieldButton(ctx, bx, h / 2 + 48, 200, 45, english ? 'Return to menu' : 'Về menu', C.textSoft);
    ctx.fillStyle = C.textMuted; ctx.font = "11px 'Segoe UI', Arial, sans-serif";
    ctx.fillText(english ? 'Press Esc to return to the hunt' : 'Nhấn Esc để tiếp tục', w / 2, h / 2 + 125);
  }

  private drawGameOver(ctx: CanvasRenderingContext2D, w: number, h: number, save?: SaveSystem): void {
    const english = save?.data.language === 'en';
    ctx.fillStyle = 'rgba(7, 9, 11, 0.82)'; ctx.fillRect(0, 0, w, h);
    const l = this.resultLayout(w, h);
    const { x, y, panelW, panelH } = l;
    // The marks frame the report; they do not obscure values or buttons.
    ctx.save(); ctx.globalAlpha = 0.8;
    drawBloodHandprint(ctx, x - 22, y + panelH * 0.7, 1.6, -0.35);
    drawBloodHandprint(ctx, x + panelW + 15, y + 95, 1.2, 0.36);
    ctx.restore();
    drawWornPanel(ctx, x, y, panelW, panelH, true);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = C.dangerBright; ctx.font = "bold 10px 'Segoe UI', Arial, sans-serif";
    ctx.fillText(english ? 'Signal lost' : 'Mất liên lạc', x + 26, y + 29);
    ctx.fillStyle = C.text; ctx.font = `900 ${Math.min(34, panelW * 0.082)}px 'Arial Black', Impact, sans-serif`;
    ctx.fillText(english ? 'You are dead' : 'Bạn đã gục ngã', x + 26, y + 69);
    ctx.fillStyle = C.textMuted; ctx.font = "12px 'Segoe UI', Arial, sans-serif";
    ctx.fillText(english ? 'The hunt is over. Only your trail remains.' : 'Cuộc săn khép lại. Dấu vết của bạn còn đây.', x + 26, y + 99);
    const statX = x + 26;
    const statW = l.compact ? panelW * 0.42 : panelW - 52;
    const statTop = y + (l.compact ? 132 : 139);
    const statGap = l.compact ? 41 : Math.min(44, panelH * 0.077);
    const rows = [
      [english ? 'Time' : 'Thời gian', `${Math.floor(this.finalTime / 60)}:${Math.floor(this.finalTime % 60).toString().padStart(2, '0')}`, C.cyanBright],
      [english ? 'Kills' : 'Hạ gục', `${this.finalKills}`, C.text],
      [english ? 'Score' : 'Điểm', Math.floor(this.finalScore).toLocaleString(english ? 'en-US' : 'vi-VN'), C.cyanBright],
      [english ? 'Recovered' : 'Thu hồi', `+${this.finalGold} ${getUiTerm('gold', english ? 'en' : 'vi')}`, C.amberBright],
    ];
    for (let i = 0; i < rows.length; i++) {
      const ry = statTop + i * statGap;
      ctx.textAlign = 'left'; ctx.fillStyle = C.textMuted; ctx.font = "bold 10px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(rows[i][0], statX, ry);
      ctx.textAlign = 'right'; ctx.fillStyle = rows[i][2]; ctx.font = "bold 18px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(rows[i][1], statX + statW, ry);
      ctx.fillStyle = C.borderSoft; ctx.fillRect(statX, ry + 17, statW, 1);
    }
    this.drawFieldButton(ctx, l.buttonX, l.buttonY, l.buttonW, l.buttonH, english ? 'Try again' : 'Chơi lại', C.cyan, true);
    this.drawFieldButton(ctx, l.buttonX, l.buttonY + l.gap, l.buttonW, l.buttonH, english ? 'Main menu' : 'Menu chính', C.textSoft);
    const reviveStatus = this.reviveAdPending ? (english ? 'Please wait' : 'Vui lòng chờ')
      : !this.canWatchRevive ? (english ? 'Used' : 'Đã dùng')
      : this.reviveAdAvailable ? (english ? 'Watch ad' : 'Xem quảng cáo')
      : (english ? 'Unavailable' : 'Không khả dụng');
    this.drawFieldButton(ctx, l.buttonX, l.buttonY + l.gap * 2, l.buttonW, l.buttonH,
      this.reviveAdPending ? (english ? 'Loading ad' : 'Đang tải quảng cáo') : (english ? 'Revive' : 'Hồi sinh'), C.health, false,
      reviveStatus, !this.canWatchRevive || !this.reviveAdAvailable || this.reviveAdPending);
  }
  private drawHunterProfile(ctx: CanvasRenderingContext2D, w: number, h: number, save?: SaveSystem): void {
    const english = save?.data.language === 'en';
    this.drawStaticBackdrop(ctx, w, h, 0.3);
    const panelW = Math.min(620, w - 32);
    const panelH = Math.min(520, h - 120);
    const x = (w - panelW) / 2, y = Math.max(58, (h - panelH - 66) / 2);
    drawWornPanel(ctx, x, y, panelW, panelH, true);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.text;
    ctx.font = `bold ${w < 480 ? 24 : 30}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText(english ? 'Hunter profile' : 'Hồ sơ thợ săn', w / 2, y - 27);
    this.drawFieldButton(ctx, (w - 200) / 2, h - 58, 200, 45, english ? 'Back' : 'Quay lại', C.cyan);
    if (!save) return;
    const rows: [string, string, string][] = [
      [english ? 'Gold earned' : 'Vàng tích lũy', `${save.data.gold}`, C.amber],
      [english ? 'Longest survival' : 'Sống sót lâu nhất', `${Math.floor(save.data.bestTime / 60)}:${Math.floor(save.data.bestTime % 60).toString().padStart(2, '0')}`, C.cyan],
      [english ? 'Kill record' : 'Kỷ lục hạ gục', `${save.data.bestKills}`, C.text],
      [english ? 'Highest score' : 'Điểm cao nhất', `${save.data.bestScore.toLocaleString(english ? 'en-US' : 'vi-VN')}`, C.cyanBright],
      [english ? 'Runs played' : 'Tổng lượt chơi', `${save.data.totalGamesPlayed}`, C.text],
      [english ? 'Total kills' : 'Tổng hạ gục', `${save.data.totalKills}`, C.text],
      [english ? 'Missions complete' : 'Màn đã hoàn thành', `${save.data.completedStages.length} / ${STAGES.length}`, C.health],
    ];
    const rowH = Math.min(64, (panelH - 24) / rows.length);
    for (let i = 0; i < rows.length; i++) {
      const ry = y + 22 + i * rowH;
      ctx.textAlign = 'left'; ctx.fillStyle = C.textSoft;
      ctx.font = `bold ${w < 480 ? 10 : 12}px 'Segoe UI', Arial, sans-serif`;
      ctx.fillText(rows[i][0], x + 20, ry);
      ctx.textAlign = 'right'; ctx.fillStyle = rows[i][2];
      ctx.font = `bold ${h < 450 ? 16 : 20}px 'Segoe UI', Arial, sans-serif`;
      ctx.fillText(rows[i][1], x + panelW - 20, ry);
      ctx.fillStyle = C.borderSoft; ctx.fillRect(x + 20, ry + rowH * 0.42, panelW - 40, 1);
    }
  }

  private drawTutorial(ctx: CanvasRenderingContext2D, w: number, h: number, save?: SaveSystem): void {
    const english = save?.data.language === 'en';
    this.drawStaticBackdrop(ctx, w, h, 0.3);
    const landscape = h < 500 && w >= 620;
    const panelW = Math.min(760, w - 32);
    const panelH = Math.min(600, h - 120);
    const x = (w - panelW) / 2, y = Math.max(58, (h - panelH - 66) / 2);
    drawWornPanel(ctx, x, y, panelW, panelH, true);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.text;
    ctx.font = `bold ${w < 480 ? 24 : 30}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText(english ? 'Field guide' : 'Hướng dẫn', w / 2, y - 27);
    this.drawFieldButton(ctx, (w - 200) / 2, h - 58, 200, 45, english ? 'Back' : 'Quay lại', C.cyan);
    const columns = landscape || w >= 650 ? 2 : 1;
    const sections = english ? [
      { title: 'Controls', color: C.cyan, lines: ['WASD / arrows: move', 'Hold left mouse: fire · R: reload', 'Shift: dodge · G: grenade · F: rage', '1 / 2 / 3: switch weapon · Esc: pause', 'Touch: left stick to move, right buttons to act'] },
      { title: 'Survival', color: C.text, lines: ['A run ends when you are killed.', 'Collect score shards to raise your run score.', 'Keep moving and leave yourself an escape route.'] },
      { title: 'Supplies', color: C.amber, lines: ['Green: health · cyan: information', 'Amber: ammo, parts, and rare gear', 'Shoot supply crates to break them open.'] },
      { title: 'Read the enemy', color: C.dangerBright, lines: ['Telegraphs show an attack’s direction and reach.', 'Dodge sideways when the spider or Rat King lunges.', 'Clear heavy attacks, then strike back.'] },
    ] : [
      { title: 'Điều khiển', color: C.cyan, lines: ['WASD / phím mũi tên: di chuyển', 'Giữ chuột trái: bắn · R: nạp đạn', 'Shift: lướt · G: lựu đạn · F: nộ', '1 / 2 / 3: đổi súng · Esc: tạm dừng', 'Cảm ứng: cần trái để di chuyển, nút phải để hành động'] },
      { title: 'Sinh tồn', color: C.text, lines: ['Lượt chơi kết thúc khi bạn gục ngã.', 'Thu thập mảnh điểm để nâng điểm số của lượt chơi.', 'Luôn di chuyển và giữ đường rút lui.'] },
      { title: 'Tiếp tế', color: C.amber, lines: ['Xanh lá: hồi máu · xanh lam: thông tin', 'Màu hổ phách: đạn, linh kiện và trang bị hiếm', 'Bắn thùng tiếp tế để phá vỡ chúng.'] },
      { title: 'Đọc đòn quái', color: C.dangerBright, lines: ['Tín hiệu báo hướng và tầm đánh.', 'Né ngang khi nhện hoặc Vua Chuột lao tới.', 'Tránh đòn nặng rồi phản công.'] },
    ];
    const rows = sections.length / columns;
    const cellW = (panelW - 40) / columns;
    const cellH = (panelH - 26) / rows;
    const lineH = Math.min(20, (cellH - 26) / 5);
    sections.forEach((section, i) => {
      const tx = x + 20 + (i % columns) * cellW;
      const ty = y + 22 + Math.floor(i / columns) * cellH;
      ctx.textAlign = 'left'; ctx.fillStyle = section.color;
      ctx.font = `bold ${w < 480 ? 11 : 12}px 'Segoe UI', Arial, sans-serif`;
      ctx.fillText(section.title, tx, ty);
      ctx.fillStyle = C.textSoft;
      ctx.font = `${w < 480 || landscape ? 10.5 : 12}px 'Segoe UI', Arial, sans-serif`;
      section.lines.forEach((line, j) => ctx.fillText(line, tx, ty + 21 + j * lineH, cellW - 12));
    });
  }

  private drawFieldButton(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
    text: string, accent: string, primary = false, note = '', disabled = false): void {
    const hover = !disabled && this.pointerX >= x && this.pointerX <= x + w && this.pointerY >= y && this.pointerY <= y + h;
    ctx.save();
    ctx.fillStyle = disabled ? '#192024' : primary ? (hover ? '#a0d0d7' : C.cyan) : (hover ? '#303e43' : '#232d32');
    ctx.strokeStyle = disabled ? '#354044' : hover ? accent : (primary ? C.cyanBright : C.border);
    ctx.lineWidth = disabled ? 1 : hover ? 1.5 : 1;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = disabled ? '#424b4e' : primary ? '#41646b' : accent;
    ctx.fillRect(x + 7, y + 10, 2, h - 20);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = disabled ? '#6d797d' : primary ? '#102024' : C.text;
    ctx.font = `bold ${w < 230 ? 12 : 13}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText(sentenceCaseDisplay(text, this.language), x + 20, y + h / 2);
    if (note && w >= 150) {
      ctx.textAlign = 'right'; ctx.font = "bold 9px 'Segoe UI', Arial, sans-serif";
      ctx.fillStyle = disabled ? '#657074' : primary ? '#29474c' : C.textMuted;
      ctx.fillText(sentenceCaseDisplay(note, this.language), x + w - 17, y + h / 2);
    } else if (!disabled) {
      ctx.strokeStyle = primary ? '#29474c' : accent; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x + w - 20, y + h / 2 - 4); ctx.lineTo(x + w - 16, y + h / 2); ctx.lineTo(x + w - 20, y + h / 2 + 4); ctx.stroke();
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

  private drawButton(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, text: string, color: string): void {
    const isPrimary = color === C.cyan;
    const r = h / 2;

    ctx.save();
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

    if (isPrimary) {
      ctx.fillStyle = '#76b4c1';
      ctx.shadowColor = 'rgba(118, 180, 193, 0.16)';
      ctx.shadowBlur = 5;
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = 'rgba(37, 47, 53, 0.96)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(91, 110, 117, 0.72)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Text
    ctx.fillStyle = isPrimary ? '#10191d' : '#d7dfdc';
    ctx.font = `bold ${Math.min(14, w * 0.065)}px 'Segoe UI', Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2);

    ctx.restore();
  }
}
