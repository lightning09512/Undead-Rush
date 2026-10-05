export interface PerformanceSnapshot {
  updateMs: number;
  zombieUpdateMs: number;
  renderMs: number;
  zombies: number;
  playerBullets: number;
  enemyBullets: number;
  particles: number;
  bloodCells: number;
  bloodCanvases: number;
  bloodCanvasBytes: number;
  bloodStainRecords: number;
  visibleLamps: number;
  audioClips: number;
  queuedAudioClips: number;
  audioVoices: number;
  audioBytes: number;
}

/** F3-only diagnostics. This class is dynamically imported only in Vite dev mode. */
export class PerformanceOverlay {
  private enabled = false;
  private previousFrameAt = 0;
  private fps = 0;

  constructor() {
    window.addEventListener('keydown', (event) => {
      if (event.code !== 'F3' || event.repeat) return;
      event.preventDefault();
      this.enabled = !this.enabled;
    });
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  draw(ctx: CanvasRenderingContext2D, now: number, stats: PerformanceSnapshot): void {
    if (!this.enabled) return;
    if (this.previousFrameAt > 0) {
      const frameMs = Math.max(1, now - this.previousFrameAt);
      const instantFps = 1000 / frameMs;
      this.fps = this.fps === 0 ? instantFps : this.fps * .82 + instantFps * .18;
    }
    this.previousFrameAt = now;

    const lines = [
      `DEV PERF  •  ${Math.round(this.fps)} FPS`,
      `Update ${stats.updateMs.toFixed(2)} ms (AI ${stats.zombieUpdateMs.toFixed(2)} ms)  |  render ${stats.renderMs.toFixed(2)} ms`,
      `Mobs ${stats.zombies}  |  bullets ${stats.playerBullets} + ${stats.enemyBullets}  |  particles ${stats.particles}`,
      `Blood ${stats.bloodCells} cells / ${stats.bloodCanvases} canvases / ${(stats.bloodCanvasBytes / 1048576).toFixed(1)} MB / ${stats.bloodStainRecords} records`,
      `Lamps in view ${stats.visibleLamps}  |  audio ${stats.audioClips} loaded, ${stats.queuedAudioClips} queued, ${stats.audioVoices} voices, ${(stats.audioBytes / 1048576).toFixed(1)} MB`,
      'F3: hide diagnostics',
    ];
    const width = 486;
    const lineHeight = 18;
    const height = lines.length * lineHeight + 14;
    ctx.save();
    ctx.globalAlpha = .94;
    ctx.fillStyle = '#080d10';
    ctx.fillRect(12, 184, width, height);
    ctx.strokeStyle = '#8ec9bf';
    ctx.lineWidth = 1;
    ctx.strokeRect(12.5, 184.5, width - 1, height - 1);
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillStyle = i === 0 ? '#a4e6a4' : i === lines.length - 1 ? '#9aa8a5' : '#e0e6df';
      ctx.fillText(lines[i], 20, 191 + i * lineHeight);
    }
    ctx.restore();
  }
}
