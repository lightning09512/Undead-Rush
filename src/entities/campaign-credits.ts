import type { Camera } from '../core/camera';

type CreditDrop = { x: number; y: number; value: number; phase: number };

/** Campaign-only salvage. A pickup is credited exactly once when removed. */
export class CampaignCredits {
  private drops: CreditDrop[] = [];
  private readonly capacity = 90;

  clear(): void { this.drops.length = 0; }

  drop(x: number, y: number, value: number): void {
    const amount = Math.max(1, Math.floor(value));
    for (const item of this.drops) {
      if ((item.x - x) ** 2 + (item.y - y) ** 2 < 44 ** 2) {
        item.value += amount;
        return;
      }
    }
    if (this.drops.length >= this.capacity) {
      let closest = this.drops[0];
      let distance = Infinity;
      for (const item of this.drops) {
        const d = (item.x - x) ** 2 + (item.y - y) ** 2;
        if (d < distance) { distance = d; closest = item; }
      }
      closest.value += amount;
      return;
    }
    this.drops.push({ x, y, value: amount, phase: (x + y) * .017 });
  }

  update(dt: number, x: number, y: number, pickupRadius: number): number {
    let collected = 0;
    const range = Math.max(20, pickupRadius);
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const item = this.drops[i];
      item.phase += dt * 2.2;
      const dx = x - item.x, dy = y - item.y;
      const distance = Math.hypot(dx, dy);
      if (distance < range && distance > 14) {
        const step = Math.min(distance - 12, (210 + (range - distance) * 2) * dt);
        item.x += dx / distance * step;
        item.y += dy / distance * step;
      }
      if (distance < 18) {
        collected += item.value;
        this.drops.splice(i, 1);
      }
    }
    return collected;
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    for (const item of this.drops) {
      if (!camera.isVisible(item.x, item.y, 20)) continue;
      const [x, y] = camera.worldToScreen(item.x, item.y);
      const bob = Math.sin(item.phase) * 1.3;
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.beginPath(); ctx.ellipse(x, y + 7, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#bba47a'; ctx.fillRect(x - 11, y - 6 + bob, 22, 11);
      ctx.fillStyle = '#d4c6a0'; ctx.fillRect(x - 9, y - 8 + bob, 18, 10);
      ctx.strokeStyle = '#392c20'; ctx.lineWidth = 1.5; ctx.strokeRect(x - 9, y - 8 + bob, 18, 10);
      ctx.fillStyle = '#52655d'; ctx.fillRect(x - 3, y - 8 + bob, 6, 10);
      ctx.fillStyle = '#dfcd94'; ctx.fillRect(x - 1, y - 6 + bob, 2, 5);
      if (item.value >= 20) {
        ctx.fillStyle = '#e9d6a6'; ctx.font = 'bold 9px Segoe UI, Arial'; ctx.textAlign = 'center';
        ctx.fillText(`${item.value}`, x, y - 13 + bob);
      }
    }
  }
}
