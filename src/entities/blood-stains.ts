import type { Camera } from '../core/camera';

interface BloodStain {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  variant: number;
}

/** Permanent cached floor pools left at each defeated mob's death position. */
export class BloodStains {
  private static readonly CELL_SIZE = 512;
  private static readonly MAX_STAIN_SIZE = 280;
  private readonly variants: HTMLCanvasElement[] = [];
  private readonly cells = new Map<string, BloodStain[]>();

  constructor() {
    // Reuse a small atlas of irregular pool shapes so permanent stains do not
    // allocate one large canvas each time a mob dies.
    for (let i = 0; i < 24; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 256;
      this.paint(canvas, (i + 1) * 0x45d9f3b);
      this.variants.push(canvas);
    }
  }

  add(x: number, y: number, creatureSize: number, boss = false, bodyAngle = 0): void {
    const width = boss
      ? 230 + Math.random() * 40
      : Math.max(78, Math.min(160, 64 + creatureSize * 2.2));
    const stain: BloodStain = {
      x,
      y,
      width,
      height: width * (.72 + Math.random() * .18),
      // Keep the pool's main axis close to the fallen creature's body angle.
      rotation: bodyAngle + (Math.random() - .5) * .7,
      variant: Math.floor(Math.random() * this.variants.length),
    };
    const cellX = Math.floor(x / BloodStains.CELL_SIZE);
    const cellY = Math.floor(y / BloodStains.CELL_SIZE);
    const key = `${cellX}:${cellY}`;
    let cell = this.cells.get(key);
    if (!cell) this.cells.set(key, cell = []);
    cell.push(stain);
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const centerX = camera.x + camera.width / 2;
    const centerY = camera.y + camera.height / 2;
    const halfW = camera.width / (camera.zoom * 2) + BloodStains.MAX_STAIN_SIZE;
    const halfH = camera.height / (camera.zoom * 2) + BloodStains.MAX_STAIN_SIZE;
    const minCellX = Math.floor((centerX - halfW) / BloodStains.CELL_SIZE);
    const maxCellX = Math.floor((centerX + halfW) / BloodStains.CELL_SIZE);
    const minCellY = Math.floor((centerY - halfH) / BloodStains.CELL_SIZE);
    const maxCellY = Math.floor((centerY + halfH) / BloodStains.CELL_SIZE);

    ctx.save();
    for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
        const cell = this.cells.get(`${cellX}:${cellY}`);
        if (!cell) continue;
        for (const stain of cell) {
          if (!camera.isVisible(stain.x, stain.y, BloodStains.MAX_STAIN_SIZE)) continue;
          const [sx, sy] = camera.worldToScreen(stain.x, stain.y);
          ctx.save();
          ctx.globalAlpha = .92;
          ctx.translate(sx, sy);
          ctx.rotate(stain.rotation);
          ctx.drawImage(this.variants[stain.variant], -stain.width / 2, -stain.height / 2, stain.width, stain.height);
          ctx.restore();
        }
      }
    }
    ctx.restore();
  }

  clear(): void {
    this.cells.clear();
  }

  private paint(canvas: HTMLCanvasElement, seed: number): void {
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);

    let state = seed >>> 0;
    const random = (): number => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x100000000;
    };
    const irregularPool = (cx: number, cy: number, rx: number, ry: number, color: string, points = 30): void => {
      const outline: Array<[number, number]> = [];
      for (let i = 0; i < points; i++) {
        const angle = i / points * Math.PI * 2;
        const wobble = .76 + random() * .48;
        outline.push([cx + Math.cos(angle) * rx * wobble, cy + Math.sin(angle) * ry * wobble]);
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo((outline[0][0] + outline[points - 1][0]) / 2, (outline[0][1] + outline[points - 1][1]) / 2);
      for (let i = 0; i < points; i++) {
        const current = outline[i], next = outline[(i + 1) % points];
        ctx.quadraticCurveTo(current[0], current[1], (current[0] + next[0]) / 2, (current[1] + next[1]) / 2);
      }
      ctx.closePath();
      ctx.fill();
    };

    // A compact uneven pool with a few connected lobes, not a long smear.
    irregularPool(0, 2, 103, 78, 'rgba(31, 5, 10, .88)');
    irregularPool(-5, 0, 91, 67, 'rgba(75, 8, 17, .94)');
    irregularPool(-31, -12, 46, 35, 'rgba(112, 15, 27, .84)', 26);
    irregularPool(25, 14, 56, 39, 'rgba(92, 10, 21, .91)', 28);
    irregularPool(41, -19, 32, 27, 'rgba(126, 19, 29, .76)', 24);
    irregularPool(-2, 4, 47, 35, 'rgba(148, 25, 34, .55)', 27);

    // A handful of nearby droplets radiate mostly in one direction, with no
    // evenly spaced ring or long drag marks.
    const splashDirection = random() * Math.PI * 2;
    for (let i = 0; i < 17; i++) {
      const angle = splashDirection + (random() - .5) * 2.45;
      const distance = 72 + random() * 48;
      const px = Math.cos(angle) * distance;
      const py = Math.sin(angle) * distance * (.6 + random() * .7);
      const radius = 2 + random() * 5;
      ctx.fillStyle = i % 4 === 0 ? 'rgba(116, 17, 27, .75)' : 'rgba(38, 5, 10, .82)';
      ctx.beginPath();
      ctx.ellipse(px, py, radius * (1.2 + random() * .8), radius * (.45 + random() * .55), angle, 0, Math.PI * 2);
      ctx.fill();
    }

    // Subtle wet highlights sit inside the pool rather than outlining it.
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const x = (random() - .5) * 105;
      const y = (random() - .5) * 65;
      const length = 8 + random() * 18;
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(192, 57, 58, .31)' : 'rgba(228, 93, 77, .2)';
      ctx.lineWidth = 1 + random() * 2.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + length * .45, y - 3 - random() * 4, x + length, y + 1);
      ctx.stroke();
    }
    ctx.restore();
  }
}
