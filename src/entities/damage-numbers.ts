// ─── Damage Numbers ───

import { Camera } from '../core/camera';

interface DamageNumber {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  vy: number;
  scale: number;
}

export class DamageNumbers {
  private numbers: DamageNumber[] = [];
  private static readonly MAX_FLOATING = 20;

  spawn(x: number, y: number, amount: number, color = '#ffffff', isCrit = false, prefix = ''): void {
    if (this.numbers.length >= DamageNumbers.MAX_FLOATING) {
      this.numbers.shift();
    }
    const text = amount === 0 && !prefix ? '' : isCrit ? `${prefix}${amount}!` : `${prefix}${amount}`;
    if (!text) return;

    this.numbers.push({
      x: x + (Math.random() - 0.5) * 12,
      y: y - 8,
      text,
      color,
      life: 0.42,
      maxLife: 0.42,
      vy: -105,
      scale: isCrit ? 1.25 : 1.0,
    });
  }

  update(dt: number): void {
    for (let i = this.numbers.length - 1; i >= 0; i--) {
      const n = this.numbers[i];
      n.life -= dt;
      n.y += n.vy * dt;
      n.vy += 85 * dt; // gentle deceleration
      if (n.life <= 0) {
        this.numbers[i] = this.numbers[this.numbers.length - 1];
        this.numbers.pop();
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const n of this.numbers) {
      if (!camera.isVisible(n.x, n.y)) continue;
      const [sx, sy] = camera.worldToScreen(n.x, n.y);
      const alpha = Math.min(1, n.life / 0.16);
      ctx.globalAlpha = alpha;
      const fontSize = Math.round(11 * n.scale);
      ctx.font = `bold ${fontSize}px 'Segoe UI', Arial, sans-serif`;
      ctx.fillStyle = '#000000';
      ctx.fillText(n.text, sx + 1, sy + 1);
      ctx.fillStyle = n.color;
      ctx.fillText(n.text, sx, sy);
    }
    ctx.globalAlpha = 1;
  }

  clear(): void {
    this.numbers.length = 0;
  }
}
