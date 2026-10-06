import type { Camera } from '../core/camera';
import type { Zombie } from './zombies';
import { getHorrorAttack } from '../data/zombies';
import { drawSurvivalZombie } from '../graphics/survival-zombie-renderer';
import { drawHorrorCorpse } from '../graphics/horror-renderer';
import { drawCampaignBoss } from '../graphics/campaign-boss-renderer';

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
    if (z.campaignBossId !== null) {
      // Campaign bosses have authored silhouettes; keep that exact boss in
      // the death decal instead of layering the generic zombie corpse over it.
      c.save(); c.translate(112, 112);
      c.fillStyle = 'rgba(81, 13, 22, .78)';
      c.beginPath(); c.ellipse(0, z.size * .28, z.size * 1.55, z.size * .92, -.18, 0, Math.PI * 2); c.fill();
      for (let i = 0; i < 6; i++) {
        const angle = ((z.id * 19 + i * 61) % 360) * Math.PI / 180;
        const distance = z.size * (.72 + (i % 3) * .24);
        c.fillStyle = i % 2 ? 'rgba(116, 21, 30, .74)' : 'rgba(57, 15, 21, .68)';
        c.beginPath(); c.ellipse(Math.cos(angle) * distance, z.size * .22 + Math.sin(angle) * distance * .58,
          z.size * (.2 + (i % 2) * .09), z.size * .11, angle, 0, Math.PI * 2); c.fill();
      }
      c.rotate(z.facingAngle + .34); c.scale(1.08, .68);
      drawCampaignBoss(c, { ...z, hp: 1, facingAngle: 0, visualWindup: 0, visualStrike: 0, walkDist: 0 }, 0, 0, false, false);
      c.restore();
    } else {
      drawHorrorCorpse(c, z.typeId, 112, 112, z.size, z.facingAngle, z.id);
    }
    if (z.campaignBossId === null && !getHorrorAttack(z.typeId)) {
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
