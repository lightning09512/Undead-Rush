import type { Camera } from '../core/camera';
import { getBossSignature } from '../data/boss-signatures';

type ImpactStyle = 'blast' | 'fire' | 'arcane' | 'acid' | 'shard' | 'blood';

interface ExplosionFlash {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  seed: number;
  style: ImpactStyle;
  bossId: number;
}

/** Readable world-space blast visuals for Boomer deaths and explosive rounds. */
export class ExplosionEffects {
  private readonly active: ExplosionFlash[] = [];

  spawn(x: number, y: number, radius: number, style: ImpactStyle = 'blast', bossId = 0): void {
    if (this.active.length >= 20) this.active.shift();
    const duration = style === 'blast' ? .42 : .3;
    this.active.push({ x, y, radius: Math.max(style === 'blast' ? 54 : 14, radius),
      life: duration, maxLife: duration, seed: Math.random() * Math.PI * 2, style, bossId });
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

      if (blast.style !== 'blast') {
        this.drawBossImpact(ctx, x, y, blast, reach, fade, progress);
        continue;
      }

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

  private drawBossImpact(ctx: CanvasRenderingContext2D, x: number, y: number, blast: ExplosionFlash,
    reach: number, fade: number, progress: number): void {
    const { core, glow, edge } = getBossSignature(blast.bossId).colors;
    ctx.save(); ctx.translate(x, y); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = fade;

    if (blast.style === 'fire') {
      ctx.strokeStyle = glow; ctx.lineWidth = Math.max(1.5, 6 * fade); ctx.beginPath();
      ctx.arc(0, 0, reach * .72, blast.seed, blast.seed + Math.PI * 1.62); ctx.stroke();
      for (let i = 0; i < 7; i++) {
        const a = blast.seed + i * Math.PI * 2 / 7, inner = reach * .36, outer = reach * (.75 + (i % 2) * .18);
        ctx.fillStyle = i % 2 ? glow : core; ctx.beginPath();
        ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
        ctx.lineTo(Math.cos(a - .16) * outer, Math.sin(a - .16) * outer);
        ctx.lineTo(Math.cos(a + .16) * outer, Math.sin(a + .16) * outer); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = core; ctx.globalAlpha = fade * .68; ctx.beginPath();
      ctx.arc(0, 0, Math.max(2, blast.radius * .17 * (1 - progress * .6)), 0, Math.PI * 2); ctx.fill();
    } else if (blast.style === 'arcane') {
      ctx.strokeStyle = glow; ctx.lineWidth = 2.5; ctx.beginPath();
      ctx.arc(0, 0, reach * .8, blast.seed + progress, blast.seed + progress + Math.PI * 1.55); ctx.stroke();
      ctx.strokeStyle = core; ctx.lineWidth = 1.5; ctx.beginPath();
      ctx.arc(0, 0, reach * .52, blast.seed - progress * 1.4, blast.seed + Math.PI * 1.1 - progress * 1.4); ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const a = blast.seed + i * Math.PI * 2 / 5 - progress * .5;
        const r = reach * (.65 + (i % 2) * .22);
        ctx.fillStyle = i % 2 ? core : edge; ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.lineTo(Math.cos(a + .1) * r * .78, Math.sin(a + .1) * r * .78);
        ctx.lineTo(Math.cos(a - .08) * r * .56, Math.sin(a - .08) * r * .56); ctx.closePath(); ctx.fill();
      }
    } else if (blast.style === 'acid') {
      ctx.fillStyle = edge; ctx.beginPath(); ctx.ellipse(0, 0, reach * 1.05, reach * .58, blast.seed * .1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = glow; ctx.globalAlpha = fade * .75; ctx.beginPath();
      ctx.ellipse(0, 0, reach * .74, reach * .34, blast.seed * .1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = core;
      for (let i = 0; i < 5; i++) {
        const a = blast.seed + i * 1.23, r = reach * (.55 + (i % 2) * .34);
        ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r * .65, 1.8 + fade * 2.5, 0, Math.PI * 2); ctx.fill();
      }
    } else if (blast.style === 'shard') {
      ctx.strokeStyle = glow; ctx.lineWidth = 2.5;
      for (let i = 0; i < 6; i++) {
        const a = blast.seed + i * Math.PI / 3;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * reach * .16, Math.sin(a) * reach * .16);
        ctx.lineTo(Math.cos(a + .08) * reach * (.62 + (i % 2) * .19), Math.sin(a + .08) * reach * (.62 + (i % 2) * .19)); ctx.stroke();
      }
      ctx.fillStyle = core; ctx.beginPath(); ctx.arc(0, 0, Math.max(1.5, blast.radius * .1 * fade), 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.strokeStyle = glow; ctx.lineWidth = Math.max(2, blast.radius * .11 * fade);
      ctx.beginPath(); ctx.arc(0, 0, reach * .78, blast.seed, blast.seed + Math.PI * 1.72); ctx.stroke();
      ctx.fillStyle = edge;
      for (let i = 0; i < 8; i++) {
        const a = blast.seed + i * Math.PI / 4, r = reach * (.42 + (i % 3) * .12);
        ctx.beginPath(); ctx.ellipse(Math.cos(a) * r, Math.sin(a) * r, 2.2 + fade * 2.2, 1.5 + fade * 1.7, a, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = core; ctx.globalAlpha = fade * .65; ctx.beginPath();
      ctx.arc(0, 0, blast.radius * .15 * fade, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();
  }
}
