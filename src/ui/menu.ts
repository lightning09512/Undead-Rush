// ─── Menu Screens: Main Menu, Pause, Game Over, Stage Complete ───

import { Audio } from '../core/audio';
import { SaveSystem } from '../systems/save';
import { STAGES } from '../data/meta';

export type MenuScreen = 'main' | 'playing' | 'paused' | 'gameover' | 'levelup' | 'stage_complete';

export class MenuUI {
  currentScreen: MenuScreen = 'main';

  // Game over stats
  finalTime = 0;
  finalKills = 0;
  finalLevel = 0;
  finalGold = 0;

  // Animation
  private titlePulse = 0;
  private bgParticles: { x: number; y: number; vx: number; vy: number; size: number }[] = [];

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

  handleClick(x: number, y: number, w: number, h: number, audio: Audio): string | null {
    switch (this.currentScreen) {
      case 'main': return this.handleMainMenuClick(x, y, w, h, audio);
      case 'paused': return this.handlePauseClick(x, y, w, h, audio);
      case 'gameover': return this.handleGameOverClick(x, y, w, h, audio);
      case 'stage_complete': return this.handleStageCompleteClick(x, y, w, h, audio);
    }
    return null;
  }

  private handleMainMenuClick(x: number, y: number, w: number, h: number, audio: Audio): string | null {
    const cardW = Math.min(480, w * 0.9);
    const cardH = 460;
    const cy = (h - cardH) / 2;

    const btnW = Math.min(320, cardW * 0.8);
    const btnH = 48;
    const bx = (w - btnW) / 2;
    const startY = cy + 220;
    const gap = 58;

    // Endless (PLAY)
    if (x >= bx && x <= bx + btnW && y >= startY && y <= startY + btnH) {
      audio.menuSelect();
      return 'start_endless';
    }
    // Stage mode
    if (x >= bx && x <= bx + btnW && y >= startY + gap && y <= startY + gap + btnH) {
      audio.menuSelect();
      return 'start_stage';
    }
    // Shop
    if (x >= bx && x <= bx + btnW && y >= startY + gap * 2 && y <= startY + gap * 2 + btnH) {
      audio.menuSelect();
      return 'open_shop';
    }

    return null;
  }

  private handlePauseClick(x: number, y: number, w: number, h: number, audio: Audio): string | null {
    const btnW = 200;
    const btnH = 45;
    const bx = (w - btnW) / 2;

    if (x >= bx && x <= bx + btnW && y >= h * 0.45 && y <= h * 0.45 + btnH) {
      audio.menuSelect();
      return 'resume';
    }
    if (x >= bx && x <= bx + btnW && y >= h * 0.55 && y <= h * 0.55 + btnH) {
      audio.menuSelect();
      return 'quit';
    }
    return null;
  }

  private handleGameOverClick(x: number, y: number, w: number, h: number, audio: Audio): string | null {
    const btnW = 200;
    const btnH = 45;
    const bx = (w - btnW) / 2;

    // Retry
    if (x >= bx && x <= bx + btnW && y >= h * 0.62 && y <= h * 0.62 + btnH) {
      audio.menuSelect();
      return 'retry';
    }
    // Main menu
    if (x >= bx && x <= bx + btnW && y >= h * 0.70 && y <= h * 0.70 + btnH) {
      audio.menuSelect();
      return 'menu';
    }
    // Revive ad
    if (x >= bx && x <= bx + btnW && y >= h * 0.78 && y <= h * 0.78 + btnH) {
      audio.menuSelect();
      return 'revive_ad';
    }
    // Double gold ad
    if (x >= bx + btnW + 20 - 100 && x <= bx + btnW + 20 + 100) {
      // position is to the right of main buttons
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

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, save?: SaveSystem): void {
    this.titlePulse += 0.02;

    switch (this.currentScreen) {
      case 'main': this.drawMainMenu(ctx, w, h, save); break;
      case 'paused': this.drawPause(ctx, w, h); break;
      case 'gameover': this.drawGameOver(ctx, w, h); break;
      case 'stage_complete': this.drawStageComplete(ctx, w, h); break;
    }
  }

  private drawMainMenu(ctx: CanvasRenderingContext2D, w: number, h: number, save?: SaveSystem): void {
    // Animated dark background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);

    // Animated particles
    for (const p of this.bgParticles) {
      p.x += p.vx * 0.016;
      p.y += p.vy * 0.016;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      ctx.fillStyle = '#1a3a1a';
      ctx.globalAlpha = 0.5;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // Deep dark background
    ctx.fillStyle = '#060906';
    ctx.fillRect(0, 0, w, h);

    // Glowing side gradients (very subtle)
    const leftGrad = ctx.createLinearGradient(0, 0, w * 0.3, 0);
    leftGrad.addColorStop(0, 'rgba(30, 60, 30, 0.2)');
    leftGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = leftGrad;
    ctx.fillRect(0, 0, w * 0.3, h);

    const rightGrad = ctx.createLinearGradient(w, 0, w * 0.7, 0);
    rightGrad.addColorStop(0, 'rgba(60, 30, 30, 0.15)');
    rightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = rightGrad;
    ctx.fillRect(w * 0.7, 0, w * 0.3, h);

    // Central Modal Card
    const cardW = Math.min(480, w * 0.9);
    const cardH = 460;
    const cx = (w - cardW) / 2;
    const cy = (h - cardH) / 2;

    ctx.fillStyle = '#0a0d0a';
    ctx.strokeStyle = '#1d2c1c';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(cx, cy, cardW, cardH, 16);
    ctx.fill();
    ctx.stroke();

    // Title without glowing blur, just flat bold text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const titleSize = Math.min(64, cardW * 0.18);
    ctx.font = `900 ${titleSize}px 'Arial Black', Impact, sans-serif`;
    
    ctx.fillStyle = '#ffffff';
    ctx.fillText('UNDEAD', w / 2, cy + 80);

    ctx.fillStyle = '#adff2f';
    ctx.fillText('RUSH', w / 2, cy + 80 + titleSize * 0.9);

    // Subtitle
    ctx.fillStyle = '#888899';
    ctx.font = `${Math.min(14, cardW * 0.035)}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText('Survive the undead horde', w / 2, cy + 180);

    // Gold display
    if (save) {
      ctx.fillStyle = '#ffdd44';
      ctx.font = `bold ${Math.min(16, cardW * 0.04)}px 'Segoe UI', Arial, sans-serif`;
      ctx.fillText(`💰 ${save.data.gold} Gold`, w / 2, cy + 420);
    }

    // Buttons inside card
    const btnW = Math.min(320, cardW * 0.8);
    const btnH = 48;
    const bx = (w - btnW) / 2;
    const startY = cy + 220;
    const gap = 58;

    this.drawButton(ctx, bx, startY, btnW, btnH, 'PLAY', '#adff2f');
    this.drawButton(ctx, bx, startY + gap, btnW, btnH, 'STAGE MODE', '#222');
    this.drawButton(ctx, bx, startY + gap * 2, btnW, btnH, 'UPGRADES SHOP', '#222');

    // Best stats (placed below the modal)
    if (save && save.data.bestTime > 0) {
      const minutes = Math.floor(save.data.bestTime / 60);
      const seconds = Math.floor(save.data.bestTime % 60);
      ctx.fillStyle = '#555566';
      ctx.font = `12px 'Segoe UI', Arial, sans-serif`;
      ctx.fillText(`Best: ${minutes}m ${seconds}s  •  ${save.data.bestKills} kills  •  Lv.${save.data.bestLevel}`, w / 2, cy + cardH + 30);
      ctx.fillText(`Total kills: ${save.data.totalKills}  •  Games played: ${save.data.totalGamesPlayed}`, w / 2, cy + cardH + 50);
    }

    // Controls
    ctx.fillStyle = '#444455';
    ctx.font = `12px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText('WASD / Arrows to move  •  Auto-aim & Auto-fire  •  ESC to pause', w / 2, cy + cardH + 80);
    ctx.fillText('Touch: Virtual Joystick', w / 2, cy + cardH + 100);
  }

  private drawPause(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.min(40, w * 0.06)}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText('⏸ PAUSED', w / 2, h * 0.3);

    const btnW = 200;
    const btnH = 45;
    const bx = (w - btnW) / 2;

    this.drawButton(ctx, bx, h * 0.45, btnW, btnH, '▶ Resume', '#44aa55');
    this.drawButton(ctx, bx, h * 0.55, btnW, btnH, '✕ Quit to Menu', '#aa4444');
  }

  private drawGameOver(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = 'rgba(10, 0, 0, 0.88)';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 25;
    ctx.fillStyle = '#ff3333';
    ctx.font = `bold ${Math.min(48, w * 0.07)}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText('GAME OVER', w / 2, h * 0.15);
    ctx.shadowBlur = 0;

    // Stats
    const minutes = Math.floor(this.finalTime / 60);
    const seconds = Math.floor(this.finalTime % 60);

    ctx.font = `${Math.min(17, w * 0.025)}px 'Segoe UI', Arial, sans-serif`;

    ctx.fillStyle = '#aaaacc';
    ctx.fillText(`⏱ Time: ${minutes}m ${seconds}s`, w / 2, h * 0.28);
    ctx.fillText(`💀 Kills: ${this.finalKills}`, w / 2, h * 0.34);
    ctx.fillText(`⭐ Level: ${this.finalLevel}`, w / 2, h * 0.40);

    // Gold earned
    ctx.fillStyle = '#ffdd44';
    ctx.font = `bold ${Math.min(20, w * 0.03)}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText(`💰 +${this.finalGold} Gold`, w / 2, h * 0.50);

    // Buttons
    const btnW = 200;
    const btnH = 45;
    const bx = (w - btnW) / 2;

    this.drawButton(ctx, bx, h * 0.62, btnW, btnH, '🔄 Try Again', '#44aa55');
    this.drawButton(ctx, bx, h * 0.70, btnW, btnH, '🏠 Main Menu', '#4455aa');
    this.drawButton(ctx, bx, h * 0.78, btnW, btnH, '📺 Revive (Ad)', '#aa8822');

    // Double gold button
    ctx.fillStyle = '#666677';
    ctx.font = `${Math.min(11, w * 0.016)}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText('Watch an ad to double your gold reward', w / 2, h * 0.88);
  }

  private drawStageComplete(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = 'rgba(0, 10, 0, 0.88)';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.shadowColor = '#44ff44';
    ctx.shadowBlur = 25;
    ctx.fillStyle = '#44ff44';
    ctx.font = `bold ${Math.min(48, w * 0.07)}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText('STAGE COMPLETE!', w / 2, h * 0.15);
    ctx.shadowBlur = 0;

    const minutes = Math.floor(this.finalTime / 60);
    const seconds = Math.floor(this.finalTime % 60);

    ctx.fillStyle = '#aaaacc';
    ctx.font = `${Math.min(17, w * 0.025)}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText(`⏱ Time: ${minutes}m ${seconds}s`, w / 2, h * 0.30);
    ctx.fillText(`💀 Kills: ${this.finalKills}`, w / 2, h * 0.36);
    ctx.fillText(`⭐ Level: ${this.finalLevel}`, w / 2, h * 0.42);

    ctx.fillStyle = '#ffdd44';
    ctx.font = `bold ${Math.min(20, w * 0.03)}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText(`💰 +${this.finalGold} Gold`, w / 2, h * 0.52);

    const btnW = 200;
    const btnH = 45;
    const bx = (w - btnW) / 2;

    this.drawButton(ctx, bx, h * 0.65, btnW, btnH, '➡ Next Stage', '#44aa55');
    this.drawButton(ctx, bx, h * 0.73, btnW, btnH, '🏠 Main Menu', '#4455aa');
  }

  private drawButton(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, text: string, color: string): void {
    const isPrimary = color === '#adff2f' || color === '#ccff00';
    
    if (isPrimary) {
      ctx.fillStyle = color;
      ctx.strokeStyle = '#000000';
    } else {
      ctx.fillStyle = '#111311';
      ctx.strokeStyle = '#223322';
    }

    ctx.beginPath();
    const r = h / 2; // Pill shape
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
    ctx.fill();

    // Border
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = isPrimary ? '#000000' : '#ffffff';
    ctx.font = `bold ${Math.min(15, w * 0.07)}px 'Segoe UI', Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2);
  }
}
