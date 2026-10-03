import type { Camera } from '../core/camera';
import type { Zombie } from './zombies';
import { getHorrorAttack } from '../data/zombies';
import { drawHorrorCorpse } from '../graphics/horror-renderer';

/** Fixed-size decal ring. Cached once on death, underneath all loot and actors. */
export class HorrorRemains {
  private cursor = 0;
  private records = Array.from({ length: 24 }, () => ({ x: 0, y: 0, life: 0, canvas: null as HTMLCanvasElement | null }));

  add(z: Zombie): void {
    if (!getHorrorAttack(z.typeId)) return;
    const r = this.records[this.cursor];
    this.cursor = (this.cursor + 1) % this.records.length;
    r.x = z.x; r.y = z.y; r.life = 14;
    if (!r.canvas) {
      r.canvas = document.createElement('canvas');
      r.canvas.width = r.canvas.height = 160;
    }
    const c = r.canvas.getContext('2d')!;
    c.clearRect(0, 0, 160, 160);
    drawHorrorCorpse(c, z.typeId, 80, 80, z.size, z.facingAngle, z.id);
  }

  update(dt: number): void {
    for (const r of this.records) r.life = Math.max(0, r.life - dt);
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    ctx.save();
    for (const r of this.records) {
      if (r.life <= 0 || !r.canvas || !camera.isVisible(r.x, r.y, 80)) continue;
      const [x, y] = camera.worldToScreen(r.x, r.y);
      ctx.globalAlpha = Math.min(0.74, r.life / 4);
      ctx.drawImage(r.canvas, x - 80, y - 80);
    }
    ctx.restore();
  }

  clear(): void {
    for (const r of this.records) r.life = 0;
    this.cursor = 0;
  }
}
