import type { Camera } from '../core/camera';
import type { Zombie } from './zombies';
import { getHorrorAttack } from '../data/zombies';
import { drawSurvivalZombie } from '../graphics/survival-zombie-renderer';
import { drawHorrorCorpse } from '../graphics/horror-renderer';

/** Fixed-size decal ring. Cached once on death, underneath all loot and actors. */
export class HorrorRemains {
  private cursor = 0;
  private records = Array.from({ length: 24 }, () => ({ x: 0, y: 0, life: 0, canvas: null as HTMLCanvasElement | null }));

  add(z: Zombie): void {
    const r = this.records[this.cursor];
    this.cursor = (this.cursor + 1) % this.records.length;
    r.x = z.x; r.y = z.y; r.life = 14;
    if (!r.canvas) {
      r.canvas = document.createElement('canvas');
      r.canvas.width = r.canvas.height = 224;
    }
    const c = r.canvas.getContext('2d')!;
    c.clearRect(0, 0, 224, 224);
    drawHorrorCorpse(c, z.typeId, 112, 112, z.size, z.facingAngle, z.id);
    if (!getHorrorAttack(z.typeId)) {
      // Snapshot once at death. The world decal does not retain a pooled entity.
      c.save(); c.translate(112, 112); c.rotate(z.facingAngle + 0.25); c.scale(1.12, 0.65);
      drawSurvivalZombie(c, { ...z, facingAngle: 0, visualWindup: 0, visualStrike: 0, walkDist: 0 }, 0, 0, false);
      c.restore();
    }
  }

  update(dt: number): void {
    for (const r of this.records) r.life = Math.max(0, r.life - dt);
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    ctx.save();
    for (const r of this.records) {
      if (r.life <= 0 || !r.canvas || !camera.isVisible(r.x, r.y, 112)) continue;
      const [x, y] = camera.worldToScreen(r.x, r.y);
      ctx.globalAlpha = Math.min(0.74, r.life / 4);
      const collapse = Math.max(0, 1 - (14 - r.life) / 0.32);
      const w = 224 * (1 - collapse * 0.08), h = 224 * (1 + collapse * 0.13);
      ctx.drawImage(r.canvas, x - w / 2, y - h / 2, w, h);
    }
    ctx.restore();
  }

  clear(): void {
    for (const r of this.records) r.life = 0;
    this.cursor = 0;
  }
}
