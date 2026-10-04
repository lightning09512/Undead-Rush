// ─── Menu Screens: Main Menu, Pause, Game Over, Stage Complete ───

import { Audio } from '../core/audio';
import { SaveSystem } from '../systems/save';
import { UI_PALETTE as C } from './palette';
import { STAGES } from '../data/meta';
import { createQuarantineBackdrop, drawBloodHandprint, drawWornPanel } from './horror-texture';

export type MenuScreen = 'main' | 'savegame' | 'campaign' | 'playing' | 'paused' | 'gameover' | 'levelup' | 'stage_complete' | 'hunter_profile' | 'tutorial';

export class MenuUI {
  currentScreen: MenuScreen = 'main';

  // Game over stats
  finalTime = 0;
  finalKills = 0;
  finalLevel = 0;
  finalGold = 0;
  confirmNewGame = false;

  // Animation
  private titlePulse = 0;
  private bgParticles: { x: number; y: number; vx: number; vy: number; size: number }[] = [];
  private pointerX = -1;
  private pointerY = -1;
  private backdrop?: HTMLCanvasElement;

  setPointer(x: number, y: number): void {
    this.pointerX = x;
    this.pointerY = y;
  }

  private drawStaticBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, shade = 0): void {
    if (!this.backdrop || this.backdrop.width !== Math.ceil(w) || this.backdrop.height !== Math.ceil(h)) {
      this.backdrop = createQuarantineBackdrop(w, h);
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

  private newGameConfirmLayout(w: number, h: number) {
    const panelW = Math.min(440, w - 28);
    const panelH = Math.min(220, h - 24);
    const x = (w - panelW) / 2, y = (h - panelH) / 2;
    const buttonY = y + panelH - 57;
    const buttonW = (panelW - 54) / 2;
    return { x, y, panelW, panelH, buttonY, buttonW, confirmX: x + 18, cancelX: x + 36 + buttonW };
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
      case 'main': return this.handleMainMenuClick(x, y, w, h, audio);
      case 'savegame': return this.handleSaveGameClick(x, y, w, h, audio, save);
      case 'paused': return this.handlePauseClick(x, y, w, h, audio);
      case 'gameover': return this.handleGameOverClick(x, y, w, h, audio);
      case 'stage_complete': return this.handleStageCompleteClick(x, y, w, h, audio);
      case 'hunter_profile': return this.handleHunterProfileClick(x, y, w, h, audio);
      case 'tutorial': return this.handleTutorialClick(x, y, w, h, audio);
    }
    return null;
  }

  private handleMainMenuClick(x: number, y: number, w: number, h: number, audio: Audio): string | null {
    const { buttonW: btnW, buttonH: btnH, buttonX: bx, buttonY: startY, gap } = this.mainLayout(w, h);

    // Endless (PLAY)
    if (x >= bx && x <= bx + btnW && y >= startY && y <= startY + btnH) {
      audio.menuSelect();
      return 'start_endless';
    }
    // Stage mode
    if (x >= bx && x <= bx + btnW && y >= startY + gap && y <= startY + gap + btnH) {
      audio.menuSelect();
      return 'open_save_menu';
    }
    // Shop
    if (x >= bx && x <= bx + btnW && y >= startY + gap * 2 && y <= startY + gap * 2 + btnH) {
      audio.menuSelect();
      return 'open_shop';
    }
    // Hunter Profile
    if (x >= bx && x <= bx + btnW && y >= startY + gap * 3 && y <= startY + gap * 3 + btnH) {
      audio.menuSelect();
      return 'open_hunter_profile';
    }
    // Tutorial
    if (x >= bx && x <= bx + btnW && y >= startY + gap * 4 && y <= startY + gap * 4 + btnH) {
      audio.menuSelect();
      return 'open_tutorial';
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
    if (row === 0) { audio.menuSelect(); return 'open_new_game_confirm'; }
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
    if (x >= bx && x <= bx + btnW && y >= buttonY + gap * 2 && y <= buttonY + gap * 2 + btnH) {
      audio.menuSelect();
      return 'revive_ad';
    }
    return null;
  }

  private handleStageCompleteClick(x: number, y: number, w: number, h: number, audio: Audio): string | null {
    const btnW = 200;
    const btnH = 45;
    const bx = (w - btnW) / 2;

    if (x >= bx && x <= bx + btnW && y >= h * 0.65 && y <= h * 0.65 + btnH) {
      audio.menuSelect();
      return 'next_stage';
    }
    if (x >= bx && x <= bx + btnW && y >= h * 0.73 && y <= h * 0.73 + btnH) {
      audio.menuSelect();
      return 'menu';
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

    switch (this.currentScreen) {
      case 'main': this.drawMainMenu(ctx, w, h, save); break;
      case 'savegame': this.drawSaveGameMenu(ctx, w, h, save); break;
      case 'paused': this.drawPause(ctx, w, h); break;
      case 'gameover': this.drawGameOver(ctx, w, h); break;
      case 'stage_complete': this.drawStageComplete(ctx, w, h); break;
      case 'hunter_profile': this.drawHunterProfile(ctx, w, h, save); break;
      case 'tutorial': this.drawTutorial(ctx, w, h); break;
    }
  }

  private drawMainMenu(ctx: CanvasRenderingContext2D, w: number, h: number, save?: SaveSystem): void {
    this.drawStaticBackdrop(ctx, w, h);
    const l = this.mainLayout(w, h);
    const { x, y, cardW, cardH, titleX } = l;
    ctx.save();
    drawWornPanel(ctx, x, y, cardW, cardH, true);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = C.textMuted;
    ctx.font = "bold 10px 'Segoe UI', Arial, sans-serif";
    ctx.fillText('KHU VỰC CÁCH LY  /  03', x + 26, y + 27);
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
    ctx.fillText('SỐNG SÓT QUA VÙNG NHIỄM BỆNH', titleX, titleTop + titleSize + 31);
    if (l.landscape) {
      ctx.strokeStyle = C.borderSoft; ctx.beginPath(); ctx.moveTo(x + cardW * 0.48, y + 47); ctx.lineTo(x + cardW * 0.48, y + cardH - 48); ctx.stroke();
    } else {
      ctx.fillStyle = C.borderSoft; ctx.fillRect(x + 26, l.buttonY - 14, cardW - 52, 1);
    }
    const buttons = [
      ['SINH TỒN', 'BẮT ĐẦU', C.cyan],
      ['CHIẾN DỊCH', '10 MÀN', C.textMuted],
      ['CỬA HÀNG NÂNG CẤP', '', C.amber],
      ['HỒ SƠ THỢ SĂN', '', C.textSoft],
      ['HƯỚNG DẪN', '', C.textSoft],
    ];
    for (let i = 0; i < buttons.length; i++) {
      this.drawFieldButton(ctx, l.buttonX, l.buttonY + i * l.gap, l.buttonW, l.buttonH, buttons[i][0], buttons[i][2], i === 0, buttons[i][1]);
    }
    const footerY = y + cardH - 35;
    ctx.textAlign = 'left';
    ctx.fillStyle = C.amber;
    ctx.font = "bold 12px 'Segoe UI', Arial, sans-serif";
    ctx.fillText(`${save?.data.gold ?? 0} VÀNG`, x + 26, footerY);
    ctx.textAlign = 'right';
    ctx.fillStyle = C.textMuted;
    ctx.font = "11px 'Segoe UI', Arial, sans-serif";
    const best = save?.data.bestTime ?? 0;
    const bestTime = `${Math.floor(best / 60)}:${Math.floor(best % 60).toString().padStart(2, '0')}`;
    ctx.fillText(`KỶ LỤC  ${bestTime}  /  ${save?.data.bestKills ?? 0} HẠ GỤC`, x + cardW - 26, footerY);
    if (w >= 850 && h >= 540) {
      ctx.textAlign = 'left'; ctx.fillStyle = C.textMuted;
      ctx.font = "11px 'Segoe UI', Arial, sans-serif";
      ctx.fillText('WASD  DI CHUYỂN     CHUỘT  BẮN     R  NẠP ĐẠN     ESC  TẠM DỪNG', x, Math.min(h - 20, y + cardH + 28));
      ctx.textAlign = 'right'; ctx.fillStyle = '#8c8773';
      ctx.font = "bold 11px 'Segoe UI', Arial, sans-serif";
      ctx.fillText('CỬA ĐÃ MỞ.  ĐỪNG DỪNG LẠI.', w - 35, h - 29);
    }
    ctx.restore();
  }

  private drawSaveGameMenu(ctx: CanvasRenderingContext2D, w: number, h: number, save?: SaveSystem): void {
    this.drawStaticBackdrop(ctx, w, h, .28);
    const l = this.saveMenuLayout(w, h);
    ctx.save();
    drawWornPanel(ctx, l.x, l.y, l.panelW, l.panelH, true);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = C.textMuted; ctx.font = "bold 10px 'Segoe UI', Arial, sans-serif";
    ctx.fillText('CHIẾN DỊCH  /  DỮ LIỆU LƯU', w / 2, l.y + 27);
    ctx.fillStyle = C.text; ctx.font = `900 ${Math.min(30, l.panelW * .075)}px 'Arial Black', Impact, sans-serif`;
    ctx.fillText('NEW GAME  /  LOAD GAME', w / 2, l.y + 56, l.panelW - 36);
    ctx.fillStyle = C.textSoft; ctx.font = "11px 'Segoe UI', Arial, sans-serif";
    ctx.fillText('Bắt đầu hồ sơ mới hoặc tiếp tục từ checkpoint chiến dịch.', w / 2, l.y + 78, l.panelW - 36);

    const checkpoint = save?.data.campaign.hasCheckpoint ?? false;
    const lastStage = save?.data.campaign.lastStage ?? 1;
    const buttons: Array<[string, string, string, boolean]> = [
      ['NEW GAME', 'XÓA TIẾN ĐỘ CŨ · BẮT ĐẦU CHIẾN DỊCH TỪ MÀN 1', C.amber, false],
      ['LOAD GAME', checkpoint ? `MÀN ${lastStage} · KHỞI ĐỘNG LẠI TỪ ĐẦU MÀN` : 'CHƯA CÓ CHECKPOINT CHIẾN DỊCH', C.cyan, !checkpoint],
      ['CHỌN MÀN', 'MỞ BẢN ĐỒ CÁC MÀN ĐÃ MỞ KHÓA', C.textSoft, false],
      ['VỀ MENU', '', C.textMuted, false],
    ];
    buttons.forEach(([label, note, color, disabled], index) => this.drawFieldButton(ctx,
      l.buttonX, l.buttonY + index * l.gap, l.buttonW, l.buttonH, label, color, index === 1 && !disabled, note, disabled));
    ctx.restore();
    if (this.confirmNewGame) this.drawNewGameConfirmation(ctx, w, h);
  }

  private drawNewGameConfirmation(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const l = this.newGameConfirmLayout(w, h);
    ctx.save();
    ctx.fillStyle = 'rgba(2, 4, 5, .76)'; ctx.fillRect(0, 0, w, h);
    drawWornPanel(ctx, l.x, l.y, l.panelW, l.panelH, true);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = C.amberBright; ctx.font = "900 19px 'Arial Black', Impact, sans-serif";
    ctx.fillText('BẮT ĐẦU GAME MỚI?', w / 2, l.y + 34, l.panelW - 32);
    ctx.fillStyle = C.textSoft; ctx.font = "12px 'Segoe UI', Arial, sans-serif";
    ctx.fillText('Thao tác này xóa tiến độ, tín dụng, súng và thẻ của Chiến dịch.', w / 2, l.y + 75, l.panelW - 34);
    ctx.fillText('Dữ liệu Sinh tồn được giữ nguyên. Bạn vẫn có thể hủy.', w / 2, l.y + 98, l.panelW - 34);
    this.drawFieldButton(ctx, l.confirmX, l.buttonY, l.buttonW, 38, 'BẮT ĐẦU', C.dangerBright, true);
    this.drawFieldButton(ctx, l.cancelX, l.buttonY, l.buttonW, 38, 'HỦY', C.textSoft);
    ctx.restore();
  }

  private drawPause(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = 'rgba(5, 8, 10, 0.78)'; ctx.fillRect(0, 0, w, h);
    const pw = Math.min(350, w - 32); const ph = Math.min(304, h - 24);
    const px = (w - pw) / 2; const py = h / 2 - 134;
    drawWornPanel(ctx, px, py, pw, ph, true);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = C.textMuted; ctx.font = "11px 'Segoe UI', Arial, sans-serif";
    ctx.fillText('TRẠM NGHỈ TẠM THỜI', w / 2, h / 2 - 98);
    ctx.fillStyle = C.text; ctx.font = "bold 29px 'Segoe UI', Arial, sans-serif";
    ctx.fillText('TẠM DỪNG', w / 2, h / 2 - 64);
    const bx = (w - 200) / 2;
    this.drawFieldButton(ctx, bx, h / 2 - 10, 200, 45, 'TIẾP TỤC', C.cyan, true);
    this.drawFieldButton(ctx, bx, h / 2 + 48, 200, 45, 'THOÁT VỀ MENU', C.textSoft);
    ctx.fillStyle = C.textMuted; ctx.font = "11px 'Segoe UI', Arial, sans-serif";
    ctx.fillText('ESC để trở lại cuộc săn', w / 2, h / 2 + 125);
  }

  private drawGameOver(ctx: CanvasRenderingContext2D, w: number, h: number): void {
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
    ctx.fillText('LIÊN LẠC ĐÃ MẤT', x + 26, y + 29);
    ctx.fillStyle = C.text; ctx.font = `900 ${Math.min(34, panelW * 0.082)}px 'Arial Black', Impact, sans-serif`;
    ctx.fillText('BẠN ĐÃ CHẾT', x + 26, y + 69);
    ctx.fillStyle = C.textMuted; ctx.font = "12px 'Segoe UI', Arial, sans-serif";
    ctx.fillText('Cuộc săn kết thúc. Dấu vết còn lại.', x + 26, y + 99);
    const statX = x + 26;
    const statW = l.compact ? panelW * 0.42 : panelW - 52;
    const statTop = y + (l.compact ? 132 : 139);
    const statGap = l.compact ? 41 : Math.min(44, panelH * 0.077);
    const rows = [
      ['THỜI GIAN', `${Math.floor(this.finalTime / 60)}:${Math.floor(this.finalTime % 60).toString().padStart(2, '0')}`, C.cyanBright],
      ['HẠ GỤC', `${this.finalKills}`, C.text],
      ['CẤP ĐỘ', `${this.finalLevel}`, C.text],
      ['THU HỒI', `+${this.finalGold} VÀNG`, C.amberBright],
    ];
    for (let i = 0; i < rows.length; i++) {
      const ry = statTop + i * statGap;
      ctx.textAlign = 'left'; ctx.fillStyle = C.textMuted; ctx.font = "bold 10px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(rows[i][0], statX, ry);
      ctx.textAlign = 'right'; ctx.fillStyle = rows[i][2]; ctx.font = "bold 18px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(rows[i][1], statX + statW, ry);
      ctx.fillStyle = C.borderSoft; ctx.fillRect(statX, ry + 17, statW, 1);
    }
    this.drawFieldButton(ctx, l.buttonX, l.buttonY, l.buttonW, l.buttonH, 'THỬ LẠI', C.cyan, true);
    this.drawFieldButton(ctx, l.buttonX, l.buttonY + l.gap, l.buttonW, l.buttonH, 'MENU CHÍNH', C.textSoft);
    this.drawFieldButton(ctx, l.buttonX, l.buttonY + l.gap * 2, l.buttonW, l.buttonH, 'HỒI SINH', C.health, false, 'QUẢNG CÁO');
  }
  private drawStageComplete(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawStaticBackdrop(ctx, w, h, 0.35);
    const panelW = Math.min(520, w - 32);
    const panelH = Math.min(400, h * 0.58);
    drawWornPanel(ctx, (w - panelW) / 2, Math.max(12, h * 0.04), panelW, panelH, true);
    this.drawBloodAtmosphere(ctx, w, h, 0.34);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = C.text;
    ctx.font = `900 ${Math.min(38, panelW * 0.085)}px 'Arial Black', Impact, sans-serif`;
    ctx.fillText('MÀN ĐÃ HOÀN THÀNH', w / 2, h * 0.15, panelW - 42);

    const minutes = Math.floor(this.finalTime / 60);
    const seconds = Math.floor(this.finalTime % 60);

    ctx.fillStyle = C.textSoft;
    ctx.font = `${Math.min(17, Math.max(13, w * 0.04))}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText(`⏱ Time: ${minutes}m ${seconds}s`, w / 2, h * 0.30);
    ctx.fillText(`💀 Kills: ${this.finalKills}`, w / 2, h * 0.36);
    ctx.fillText(`⭐ Level: ${this.finalLevel}`, w / 2, h * 0.42);

    ctx.fillStyle = C.amberBright;
    ctx.font = `bold ${Math.min(20, Math.max(14, w * 0.045))}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText(`💰 +${this.finalGold} Gold`, w / 2, h * 0.52);

    const btnW = 200;
    const btnH = 45;
    const bx = (w - btnW) / 2;

    this.drawFieldButton(ctx, bx, h * 0.65, btnW, btnH, 'MÀN TIẾP THEO', C.cyan, true);
    this.drawFieldButton(ctx, bx, h * 0.73, btnW, btnH, 'MENU CHÍNH', C.dangerBright);
  }

  private drawHunterProfile(ctx: CanvasRenderingContext2D, w: number, h: number, save?: SaveSystem): void {
    this.drawStaticBackdrop(ctx, w, h, 0.3);
    const panelW = Math.min(620, w - 32);
    const panelH = Math.min(520, h - 120);
    const x = (w - panelW) / 2, y = Math.max(58, (h - panelH - 66) / 2);
    drawWornPanel(ctx, x, y, panelW, panelH, true);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.text;
    ctx.font = `bold ${w < 480 ? 24 : 30}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText('HỒ SƠ THỢ SĂN', w / 2, y - 27);
    this.drawFieldButton(ctx, (w - 200) / 2, h - 58, 200, 45, 'QUAY LẠI', C.cyan);
    if (!save) return;
    const rows: [string, string, string][] = [
      ['VÀNG TÍCH LŨY', `${save.data.gold}`, C.amber],
      ['SỐNG SÓT LÂU NHẤT', `${Math.floor(save.data.bestTime / 60)}:${Math.floor(save.data.bestTime % 60).toString().padStart(2, '0')}`, C.cyan],
      ['KỶ LỤC HẠ GỤC', `${save.data.bestKills}`, C.text],
      ['CẤP CAO NHẤT', `${save.data.bestLevel}`, C.text],
      ['TỔNG LƯỢT CHƠI', `${save.data.totalGamesPlayed}`, C.text],
      ['TỔNG HẠ GỤC', `${save.data.totalKills}`, C.text],
      ['CỬA ẢI HOÀN THÀNH', `${save.data.completedStages.length} / ${STAGES.length}`, C.health],
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

  private drawTutorial(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawStaticBackdrop(ctx, w, h, 0.3);
    const landscape = h < 500 && w >= 620;
    const panelW = Math.min(760, w - 32);
    const panelH = Math.min(600, h - 120);
    const x = (w - panelW) / 2, y = Math.max(58, (h - panelH - 66) / 2);
    drawWornPanel(ctx, x, y, panelW, panelH, true);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.text;
    ctx.font = `bold ${w < 480 ? 24 : 30}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText('HƯỚNG DẪN', w / 2, y - 27);
    this.drawFieldButton(ctx, (w - 200) / 2, h - 58, 200, 45, 'QUAY LẠI', C.cyan);
    const columns = landscape || w >= 650 ? 2 : 1;
    const sections = [
      { title: 'ĐIỀU KHIỂN', color: C.cyan, lines: ['WASD / mũi tên: di chuyển', 'Giữ chuột trái: bắn · R: nạp đạn', 'Shift: lướt · G: lựu đạn · F: nộ', '1 / 2 / 3: đổi súng · ESC: tạm dừng', 'Cảm ứng: cần trái, nút hành động phải'] },
      { title: 'CHẾ ĐỘ SINH TỒN', color: C.text, lines: ['Cuộc chơi kết thúc khi bạn bị hạ gục.', 'Thu thập XP để chọn thẻ nâng cấp.', 'Di chuyển liên tục, giữ đường rút lui.'] },
      { title: 'TIẾP TẾ', color: C.amber, lines: ['Xanh lục: hồi máu · Cyan: thông tin', 'Hổ phách: đạn, linh kiện và đồ hiếm', 'Bắn vỡ thùng để lấy vật phẩm.'] },
      { title: 'ĐỌC ĐÒN QUÁI', color: C.dangerBright, lines: ['Vùng sáng báo hướng và tầm đánh.', 'Né ngang khi nhện và vua chuột lao.', 'Lùi khỏi đòn nặng rồi phản công.'] },
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

  private drawBloodAtmosphere(ctx: CanvasRenderingContext2D, w: number, h: number, strength: number): void {
    ctx.save();
    const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.15, w / 2, h / 2, Math.max(w, h) * 0.72);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, `rgba(3, 8, 11, ${strength * 0.48})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
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
    ctx.fillText(text, x + 20, y + h / 2);
    if (note && w >= 270) {
      ctx.textAlign = 'right'; ctx.font = "bold 9px 'Segoe UI', Arial, sans-serif";
      ctx.fillStyle = disabled ? '#657074' : primary ? '#29474c' : C.textMuted;
      ctx.fillText(note, x + w - 17, y + h / 2);
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
