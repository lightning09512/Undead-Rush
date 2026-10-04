import type { Camera } from '../core/camera';

interface BloodStain {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  life: number;
  canvas: HTMLCanvasElement | null;
}

/** Short-lived, cached floor splashes left by defeated mobs. */
export class BloodStains {
  private readonly records: BloodStain[] = Array.from({ length: 84 }, () => ({
    x: 0, y: 0, width: 0, height: 0, rotation: 0, life: 0, canvas: null,
  }));
  private cursor = 0;

  add(x: number, y: number, creatureSize: number, boss = false): void {
    const stain = this.records[this.cursor];
    this.cursor = (this.cursor + 1) % this.records.length;
    stain.x = x;
    stain.y = y;
    stain.width = boss ? 360 : Math.max(150, Math.min(250, 100 + creatureSize * 2.9));
    stain.height = stain.width * (.68 + Math.random() * .28);
    stain.rotation = Math.random() * Math.PI;
    stain.life = boss ? 42 : 30;

    if (!stain.canvas) {
      stain.canvas = document.createElement('canvas');
      stain.canvas.width = stain.canvas.height = 256;
    }
    this.paint(stain.canvas);
  }

  update(dt: number): void {
    for (const stain of this.records) stain.life = Math.max(0, stain.life - dt);
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    ctx.save();
    for (const stain of this.records) {
      if (stain.life <= 0 || !stain.canvas || !camera.isVisible(stain.x, stain.y, stain.width)) continue;
      const [sx, sy] = camera.worldToScreen(stain.x, stain.y);
      const fade = stain.life < 8 ? stain.life / 8 : 1;
      ctx.save();
      ctx.globalAlpha = .92 * fade;
      ctx.translate(sx, sy);
      ctx.rotate(stain.rotation);
      ctx.drawImage(stain.canvas, -stain.width / 2, -stain.height / 2, stain.width, stain.height);
      ctx.restore();
    }
    ctx.restore();
  }

  clear(): void {
    for (const stain of this.records) stain.life = 0;
    this.cursor = 0;
  }

  private paint(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 256, 256);
    ctx.save();
    ctx.translate(128, 128);
    ctx.rotate(Math.random() * Math.PI * 2);

    const irregularPool = (cx: number, cy: number, rx: number, ry: number, color: string, points = 22): void => {
      const outline: Array<[number, number]> = [];
      for (let i = 0; i < points; i++) {
        const angle = i / points * Math.PI * 2;
        const wobble = .72 + Math.random() * .5;
        outline.push([cx + Math.cos(angle) * rx * wobble, cy + Math.sin(angle) * ry * wobble]);
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo((outline[0][0] + outline[points - 1][0]) / 2, (outline[0][1] + outline[points - 1][1]) / 2);
      for (let i = 0; i < points; i++) {
        const current = outline[i], next = outline[(i + 1) % points];
        ctx.quadraticCurveTo(current[0], current[1], (current[0] + next[0]) / 2, (current[1] + next[1]) / 2);
      }
      ctx.closePath(); ctx.fill();
    };

    // A broad dark pooling mass, broken into connected lobes instead of a neat oval.
    irregularPool(0, 4, 104, 66, 'rgba(25,5,9,.96)', 26);
    irregularPool(-8, 1, 88, 51, 'rgba(74,9,17,.94)', 24);
    irregularPool(16, -5, 58, 36, 'rgba(111,18,27,.78)', 20);
    irregularPool(-54, 14, 35, 23, 'rgba(58,7,14,.9)', 16);
    irregularPool(48, 20, 38, 24, 'rgba(47,6,12,.88)', 17);

    // Uneven drag marks and arterial sprays break up the pool edge.
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const start = 30 + Math.random() * 38;
      const length = 28 + Math.random() * 62;
      const sx = Math.cos(angle) * start, sy = Math.sin(angle) * start * .7;
      const ex = Math.cos(angle) * (start + length), ey = Math.sin(angle) * (start + length) * .7;
      ctx.strokeStyle = i % 2 ? 'rgba(35,5,10,.86)' : 'rgba(120,20,27,.73)';
      ctx.lineWidth = 3 + Math.random() * 8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo((sx + ex) * .52 + (Math.random() - .5) * 20,
        (sy + ey) * .52 + (Math.random() - .5) * 18, ex, ey); ctx.stroke();
      ctx.fillStyle = 'rgba(35,5,10,.88)'; ctx.beginPath();
      ctx.ellipse(ex, ey, 2.5 + Math.random() * 4.5, 1.7 + Math.random() * 3.5, angle, 0, Math.PI * 2); ctx.fill();
    }

    // Wet highlights sit off-center so the blood reads as thick and pooled, not a flat icon.
    irregularPool(-16, -11, 43, 17, 'rgba(151,28,35,.5)', 18);
    ctx.strokeStyle = 'rgba(187,48,49,.46)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-62, 3); ctx.quadraticCurveTo(-33, -14, -8, -7); ctx.stroke();

    // A wide, irregular field of droplets gives each impact a different silhouette.
    for (let i = 0; i < 25; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 54 + Math.random() * 68;
      const radius = 1.5 + Math.random() * 4.8;
      const px = Math.cos(angle) * distance, py = Math.sin(angle) * distance * .72;
      ctx.fillStyle = i % 4 === 0 ? 'rgba(126,22,29,.88)' : 'rgba(39,5,10,.9)';
      ctx.beginPath();
      ctx.ellipse(px, py, radius * (1.1 + Math.random() * .9), radius * (.55 + Math.random() * .65), angle, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
