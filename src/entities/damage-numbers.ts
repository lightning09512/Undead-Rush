// ─── Damage Numbers ───

import { Camera } from '../core/camera';

interface DamageNumber {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  vy: number;
  scale: number;
}

export class DamageNumbers {
  private numbers: DamageNumber[] = [];

  spawn(x: number, y: number, amount: number, color = '#ffffff', isCrit = false): void {
    this.numbers.push({
      x: x + (Math.random() - 0.5) * 20,
      y: y - 10,
      text: isCrit ? `${amount}!` : `${amount}`,
      color,
      life: 0.8,
      vy: -80,
      scale: isCrit ? 1.5 : 1.0,
    });
  }

  update(dt: number): void {
    for (let i = this.numbers.length - 1; i >= 0; i--) {
      const n = this.numbers[i];
      n.life -= dt;
      n.y += n.vy * dt;
      n.vy += 50 * dt; // slow down
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
      const alpha = Math.min(1, n.life / 0.3);
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${Math.round(14 * n.scale)}px 'Segoe UI', Arial, sans-serif`;
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
