import type { Camera } from '../core/camera';

interface ExplosionFlash {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  seed: number;
}

/** Readable world-space blast visuals for Boomer deaths and explosive rounds. */
export class ExplosionEffects {
  private readonly active: ExplosionFlash[] = [];

  spawn(x: number, y: number, radius: number): void {
    if (this.active.length >= 20) this.active.shift();
    this.active.push({ x, y, radius: Math.max(54, radius), life: .42, maxLife: .42, seed: Math.random() * Math.PI * 2 });
  }

  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const blast = this.active[i];
      blast.life -= dt;
      if (blast.life <= 0) this.active.splice(i, 1);
    }
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    for (const blast of this.active) {
      if (!camera.isVisible(blast.x, blast.y, blast.radius * 1.5)) continue;
      const [x, y] = camera.worldToScreen(blast.x, blast.y);
      const fade = Math.max(0, blast.life / blast.maxLife);
      const progress = 1 - fade;
      const reach = blast.radius * (.3 + progress * 1.05);

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const flare = ctx.createRadialGradient(x, y, 0, x, y, reach);
      flare.addColorStop(0, `rgba(255, 250, 218, ${fade * .92})`);
      flare.addColorStop(.18, `rgba(255, 207, 95, ${fade * .86})`);
      flare.addColorStop(.48, `rgba(255, 104, 35, ${fade * .68})`);
      flare.addColorStop(.78, `rgba(177, 38, 31, ${fade * .38})`);
      flare.addColorStop(1, 'rgba(80, 14, 18, 0)');
      ctx.fillStyle = flare;
      ctx.beginPath(); ctx.arc(x, y, reach, 0, Math.PI * 2); ctx.fill();

      ctx.strokeStyle = `rgba(255, 226, 151, ${fade * .9})`;
      ctx.lineWidth = 2 + fade * 5;
      ctx.beginPath(); ctx.arc(x, y, reach * .82, 0, Math.PI * 2); ctx.stroke();

      ctx.strokeStyle = `rgba(255, 130, 54, ${fade * .82})`;
      ctx.lineWidth = 1.5 + fade * 2.5;
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const angle = blast.seed + i * Math.PI / 6;
        const inner = reach * (.33 + (i % 3) * .035);
        const outer = reach * (.7 + (i % 2) * .16);
        ctx.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
        ctx.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer);
      }
      ctx.stroke();

      const coreRadius = blast.radius * (.22 * fade + .025);
      ctx.fillStyle = `rgba(255, 243, 192, ${fade * .82})`;
      ctx.beginPath(); ctx.arc(x, y, coreRadius, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  clear(): void {
    this.active.length = 0;
  }
}
