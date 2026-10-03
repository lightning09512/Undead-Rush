// ─── Menu Screens: Main Menu, Pause, Game Over, Stage Complete ───

import { Audio } from '../core/audio';
import { SaveSystem } from '../systems/save';
import { STAGES } from '../data/meta';

export type MenuScreen = 'main' | 'playing' | 'paused' | 'gameover' | 'levelup' | 'stage_complete' | 'hunter_profile' | 'tutorial';

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
      case 'hunter_profile': return this.handleHunterProfileClick(x, y, w, h, audio);
      case 'tutorial': return this.handleTutorialClick(x, y, w, h, audio);
    }
    return null;
  }

  private handleMainMenuClick(x: number, y: number, w: number, h: number, audio: Audio): string | null {
    const cardW = Math.min(480, w * 0.9);
    const cardH = 480;
    const cy = (h - cardH) / 2;

    const btnW = Math.min(320, cardW * 0.8);
    const btnH = 46;
    const bx = (w - btnW) / 2;
    const startY = cy + 220;
    const gap = 54;

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

  private handleHunterProfileClick(x: number, y: number, w: number, h: number, audio: Audio): string | null {
    const btnW = 200;
    const btnH = 45;
    const bx = (w - btnW) / 2;

    // Back button
    if (x >= bx && x <= bx + btnW && y >= h * 0.85 && y <= h * 0.85 + btnH) {
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
    if (x >= bx && x <= bx + btnW && y >= h * 0.85 && y <= h * 0.85 + btnH) {
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
      case 'hunter_profile': this.drawHunterProfile(ctx, w, h, save); break;
      case 'tutorial': this.drawTutorial(ctx, w, h); break;
    }
  }

  private drawMainMenu(ctx: CanvasRenderingContext2D, w: number, h: number, save?: SaveSystem): void {
    // Deep dark background
    ctx.fillStyle = '#060810';
    ctx.fillRect(0, 0, w, h);

    // Animated particles (floating embers / sparks)
    for (const p of this.bgParticles) {
      p.x += p.vx * 0.016;
      p.y += p.vy * 0.016;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      ctx.fillStyle = `rgba(80, 120, 200, ${0.15 + Math.sin(this.titlePulse + p.x * 0.01) * 0.1})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Subtle scan lines (CRT effect)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
    for (let y = 0; y < h; y += 3) {
      ctx.fillRect(0, y, w, 1);
    }

    // Side ambient glow
    const leftGrad = ctx.createLinearGradient(0, 0, w * 0.25, 0);
    leftGrad.addColorStop(0, 'rgba(20, 60, 140, 0.12)');
    leftGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = leftGrad;
    ctx.fillRect(0, 0, w * 0.25, h);

    const rightGrad = ctx.createLinearGradient(w, 0, w * 0.75, 0);
    rightGrad.addColorStop(0, 'rgba(140, 40, 30, 0.08)');
    rightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = rightGrad;
    ctx.fillRect(w * 0.75, 0, w * 0.25, h);

    // Central Modal Card with frosted glass effect
    const cardW = Math.min(480, w * 0.9);
    const cardH = 480;
    const cx = (w - cardW) / 2;
    const cy = (h - cardH) / 2;

    // Card shadow
    ctx.shadowColor = 'rgba(30, 80, 180, 0.15)';
    ctx.shadowBlur = 40;
    ctx.fillStyle = 'rgba(10, 14, 22, 0.95)';
    ctx.beginPath();
    ctx.roundRect(cx, cy, cardW, cardH, 16);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Card border (subtle glow)
    ctx.strokeStyle = 'rgba(60, 100, 180, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(cx, cy, cardW, cardH, 16);
    ctx.stroke();

    // Top accent line
    const accentGrad = ctx.createLinearGradient(cx, cy, cx + cardW, cy);
    accentGrad.addColorStop(0, 'rgba(50, 120, 255, 0)');
    accentGrad.addColorStop(0.3, 'rgba(50, 120, 255, 0.6)');
    accentGrad.addColorStop(0.7, 'rgba(50, 120, 255, 0.6)');
    accentGrad.addColorStop(1, 'rgba(50, 120, 255, 0)');
    ctx.fillStyle = accentGrad;
    ctx.fillRect(cx + 20, cy, cardW - 40, 2);

    // Title
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const titleSize = Math.min(58, cardW * 0.16);

    // "UNDEAD" with subtle glow
    ctx.shadowColor = 'rgba(200, 200, 255, 0.3)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#e8ecf4';
    ctx.font = `900 ${titleSize}px 'Arial Black', Impact, sans-serif`;
    ctx.fillText('UNDEAD', w / 2, cy + 75);
    ctx.shadowBlur = 0;

    // "RUSH" with red-orange accent
    ctx.shadowColor = 'rgba(255, 60, 30, 0.4)';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#ff4433';
    ctx.font = `900 ${titleSize * 0.95}px 'Arial Black', Impact, sans-serif`;
    ctx.fillText('RUSH', w / 2, cy + 75 + titleSize * 0.88);
    ctx.shadowBlur = 0;

    // Subtitle
    ctx.fillStyle = '#5a6580';
    ctx.font = `${Math.min(13, cardW * 0.032)}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText('T O P - D O W N   Z O M B I E   S U R V I V A L', w / 2, cy + 180);

    // Thin separator
    ctx.fillStyle = 'rgba(60, 100, 180, 0.2)';
    ctx.fillRect(cx + 40, cy + 200, cardW - 80, 1);

    // Gold display
    if (save) {
      ctx.fillStyle = '#daa520';
      ctx.font = `bold ${Math.min(14, cardW * 0.035)}px 'Segoe UI', Arial, sans-serif`;
      ctx.fillText(`💰 ${save.data.gold} Gold`, w / 2, cy + 440);
    }

    // Buttons
    const btnW = Math.min(320, cardW * 0.8);
    const btnH = 46;
    const bx = (w - btnW) / 2;
    const startY = cy + 220;
    const gap = 54;

    this.drawButton(ctx, bx, startY, btnW, btnH, '▶  PLAY', '#adff2f');
    this.drawButton(ctx, bx, startY + gap, btnW, btnH, 'STAGE MODE', '#222');
    this.drawButton(ctx, bx, startY + gap * 2, btnW, btnH, 'UPGRADES SHOP', '#222');
    this.drawButton(ctx, bx, startY + gap * 3, btnW, btnH, 'HUNTER PROFILE', '#222');
    this.drawButton(ctx, bx, startY + gap * 4, btnW, btnH, 'TUTORIAL', '#222');

    // Best stats
    if (save && save.data.bestTime > 0) {
      const minutes = Math.floor(save.data.bestTime / 60);
      const seconds = Math.floor(save.data.bestTime % 60);
      ctx.fillStyle = '#3a4460';
      ctx.font = `11px 'Segoe UI', Arial, sans-serif`;
      ctx.fillText(`Best: ${minutes}m ${seconds}s  ·  ${save.data.bestKills} kills  ·  Lv.${save.data.bestLevel}`, w / 2, cy + cardH + 25);
      ctx.fillText(`Total kills: ${save.data.totalKills}  ·  Games: ${save.data.totalGamesPlayed}`, w / 2, cy + cardH + 42);
    }

    // Controls hint
    ctx.fillStyle = '#2d3650';
    ctx.font = `11px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText('WASD di chuyển · LMB bắn · R thay đạn · ESC tạm dừng', w / 2, cy + cardH + 70);
  }

  private drawPause(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = 'rgba(4, 6, 14, 0.82)';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#c8d0e0';
    ctx.font = `bold ${Math.min(40, w * 0.06)}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText('⏸ TẠM DỪNG', w / 2, h * 0.3);

    const btnW = 200;
    const btnH = 45;
    const bx = (w - btnW) / 2;

    this.drawButton(ctx, bx, h * 0.45, btnW, btnH, '▶ Tiếp tục', '#adff2f');
    this.drawButton(ctx, bx, h * 0.55, btnW, btnH, '✕ Thoát', '#222');
  }

  private drawGameOver(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = 'rgba(6, 2, 2, 0.92)';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.shadowColor = '#ff2200';
    ctx.shadowBlur = 25;
    ctx.fillStyle = '#ff3333';
    ctx.font = `bold ${Math.min(48, w * 0.07)}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText('BẠN ĐÃ CHẾT', w / 2, h * 0.15);
    ctx.shadowBlur = 0;

    // Stats
    const minutes = Math.floor(this.finalTime / 60);
    const seconds = Math.floor(this.finalTime % 60);

    ctx.font = `${Math.min(16, w * 0.024)}px 'Segoe UI', Arial, sans-serif`;

    ctx.fillStyle = '#8895b0';
    ctx.fillText(`⏱ Thời gian: ${minutes}m ${seconds}s`, w / 2, h * 0.28);
    ctx.fillText(`💀 Tiêu diệt: ${this.finalKills}`, w / 2, h * 0.34);
    ctx.fillText(`⭐ Cấp độ: ${this.finalLevel}`, w / 2, h * 0.40);

    // Gold earned
    ctx.fillStyle = '#daa520';
    ctx.font = `bold ${Math.min(20, w * 0.03)}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText(`💰 +${this.finalGold} Gold`, w / 2, h * 0.50);

    // Buttons
    const btnW = 200;
    const btnH = 45;
    const bx = (w - btnW) / 2;

    this.drawButton(ctx, bx, h * 0.62, btnW, btnH, '🔄 Thử lại', '#adff2f');
    this.drawButton(ctx, bx, h * 0.70, btnW, btnH, '🏠 Menu chính', '#222');
    this.drawButton(ctx, bx, h * 0.78, btnW, btnH, '📺 Hồi sinh (Ad)', '#222');

    // Double gold hint
    ctx.fillStyle = '#3a4460';
    ctx.font = `${Math.min(11, w * 0.016)}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText('Xem quảng cáo để x2 vàng', w / 2, h * 0.88);
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

  private drawHunterProfile(ctx: CanvasRenderingContext2D, w: number, h: number, save?: SaveSystem): void {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.min(40, w * 0.06)}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText('HỒ SƠ HUNTER', w / 2, h * 0.12);

    // Profile card
    const cardW = Math.min(500, w * 0.85);
    const cardH = h * 0.65;
    const cx = (w - cardW) / 2;
    const cy = (h - cardH) / 2 + h * 0.05;

    ctx.fillStyle = '#0a0d0a';
    ctx.strokeStyle = '#1d2c1c';
    ctx.lineWidth = 2;
    this.roundRect(ctx, cx, cy, cardW, cardH, 16);
    ctx.fill();
    ctx.stroke();

    // Stats
    if (save) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.min(18, w * 0.025)}px 'Segoe UI', Arial, sans-serif`;
      ctx.fillText('THỐNG KÊ', cx + 30, cy + 40);

      ctx.fillStyle = '#aaaacc';
      ctx.font = `${Math.min(14, w * 0.02)}px 'Segoe UI', Arial, sans-serif`;
      const stats = [
        `💰 Gold: ${save.data.gold}`,
        `⏱ Best Time: ${Math.floor(save.data.bestTime / 60)}m ${Math.floor(save.data.bestTime % 60)}s`,
        `💀 Best Kills: ${save.data.bestKills}`,
        `⭐ Best Level: ${save.data.bestLevel}`,
        `🎮 Total Games: ${save.data.totalGamesPlayed}`,
        `🧟 Total Kills: ${save.data.totalKills}`,
      ];

      let y = cy + 70;
      for (const stat of stats) {
        ctx.fillText(stat, cx + 30, y);
        y += 28;
      }

      // Stages completed
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.min(18, w * 0.025)}px 'Segoe UI', Arial, sans-serif`;
      ctx.fillText('CỬA ẢI HOÀN THÀNH', cx + 30, y + 20);

      ctx.fillStyle = '#aaaacc';
      ctx.font = `${Math.min(14, w * 0.02)}px 'Segoe UI', Arial, sans-serif`;
      y += 50;
      for (const stageId of save.data.completedStages) {
        ctx.fillText(`✓ Gate ${stageId}`, cx + 30, y);
        y += 24;
      }
      if (save.data.completedStages.length === 0) {
        ctx.fillText('Chưa hoàn thành cửa ải nào', cx + 30, y);
      }
    }

    // Back button
    const btnW = 200;
    const btnH = 45;
    const bx = (w - btnW) / 2;
    this.drawButton(ctx, bx, h * 0.85, btnW, btnH, '← Quay lại', '#222');
  }

  private drawTutorial(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.min(40, w * 0.06)}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText('HƯỚNG DẪN', w / 2, h * 0.10);

    // Tutorial card
    const cardW = Math.min(550, w * 0.9);
    const cardH = h * 0.70;
    const cx = (w - cardW) / 2;
    const cy = (h - cardH) / 2 + h * 0.03;

    ctx.fillStyle = '#0a0d0a';
    ctx.strokeStyle = '#1d2c1c';
    ctx.lineWidth = 2;
    this.roundRect(ctx, cx, cy, cardW, cardH, 16);
    ctx.fill();
    ctx.stroke();

    // Tutorial content
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.min(16, w * 0.022)}px 'Segoe UI', Arial, sans-serif`;

    const sections = [
      { title: '🎮 ĐIỀU KHIỂN', content: ['WASD / Mũi tên: Di chuyển', 'ESC: Tạm dừng', 'Vũ khí tự động bắn'] },
      { title: '⚔️ GAMEPLAY', content: ['Thu thập XP để level up', 'Chọn nâng cấp vũ khí/passive', 'Sống sót càng lâu càng tốt'] },
      { title: '📦 THÙNG TIẾP TẾ', content: ['Thùng gỗ có dấu ★', 'Bắn vỡ để nhặt items', 'Common/Rare/Legendary tiers'] },
      { title: '🔧 LINH KIỆN VŨ KHÍ', content: ['D: Damage (+5% sát thương)', 'F: Fire Rate (+8% tốc độ bắn)', 'M: Magazine (+10% tốc độ)', 'P: Pierce (+1 xuyên)', 'S: Split (+1 chia tia)'] },
      { title: '💡 MẸO', content: ['Thùng tiếp tế rơi random items', 'Elite quái (viền tím) drop tốt', 'Airdrop thả XP lớn', 'Magnet hút tất cả XP'] },
    ];

    let y = cy + 35;
    for (const section of sections) {
      ctx.fillStyle = '#ffcc00';
      ctx.fillText(section.title, cx + 25, y);
      y += 25;

      ctx.fillStyle = '#aaaacc';
      ctx.font = `${Math.min(13, w * 0.018)}px 'Segoe UI', Arial, sans-serif`;
      for (const line of section.content) {
        ctx.fillText(line, cx + 25, y);
        y += 20;
      }
      y += 15;

      ctx.font = `bold ${Math.min(16, w * 0.022)}px 'Segoe UI', Arial, sans-serif`;
    }

    // Back button
    const btnW = 200;
    const btnH = 45;
    const bx = (w - btnW) / 2;
    this.drawButton(ctx, bx, h * 0.88, btnW, btnH, '← Quay lại', '#222');
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
    const isPrimary = color === '#adff2f' || color === '#ccff00';
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
      // Vivid gradient fill
      const grad = ctx.createLinearGradient(x, y, x + w, y + h);
      grad.addColorStop(0, '#78ff44');
      grad.addColorStop(0.5, '#adff2f');
      grad.addColorStop(1, '#66ee22');
      ctx.fillStyle = grad;
      ctx.shadowColor = 'rgba(120, 255, 50, 0.3)';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Top sheen
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();
    } else {
      // Dark glass button
      ctx.fillStyle = 'rgba(18, 22, 32, 0.9)';
      ctx.fill();

      // Subtle border
      ctx.strokeStyle = 'rgba(70, 90, 130, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Text
    ctx.fillStyle = isPrimary ? '#0a1a05' : '#8899bb';
    ctx.font = `bold ${Math.min(14, w * 0.065)}px 'Segoe UI', Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2);

    ctx.restore();
  }
}
