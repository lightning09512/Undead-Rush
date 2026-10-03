import { Camera } from '../core/camera';
import { MAP_CONFIG } from '../data/items';

const CHUNK_SIZE = 1000;

export class GroundRenderer {
  private chunks: HTMLCanvasElement[][] = [];
  private cols: number;
  private rows: number;

  constructor() {
    this.cols = Math.ceil(MAP_CONFIG.width / CHUNK_SIZE);
    this.rows = Math.ceil(MAP_CONFIG.height / CHUNK_SIZE);
    this.generateChunks();
  }

  private generateChunks() {
    const random = (() => {
      let seed = 54321;
      return () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      };
    })();

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = MAP_CONFIG.width;
    tempCanvas.height = MAP_CONFIG.height;
    const ctx = tempCanvas.getContext('2d', { alpha: false })!;

    // ─── 1. Base: Dark metallic floor ───
    ctx.fillStyle = '#12141a';
    ctx.fillRect(0, 0, MAP_CONFIG.width, MAP_CONFIG.height);

    // ─── 2. Large concrete/metal floor tiles (32x32 grid) ───
    const tileSize = 64;
    const tilesX = Math.ceil(MAP_CONFIG.width / tileSize);
    const tilesY = Math.ceil(MAP_CONFIG.height / tileSize);

    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        const x = tx * tileSize;
        const y = ty * tileSize;
        const rval = random();

        // Alternating tile color pattern (checkerboard with variation)
        let baseColor: string;
        if ((tx + ty) % 2 === 0) {
          baseColor = rval < 0.3 ? '#15171f' : rval < 0.7 ? '#191c24' : '#1c1f28';
        } else {
          baseColor = rval < 0.3 ? '#13151c' : rval < 0.7 ? '#171a22' : '#1a1d26';
        }

        ctx.fillStyle = baseColor;
        ctx.fillRect(x, y, tileSize, tileSize);

        // Tile gap lines (subtle grid)
        ctx.strokeStyle = 'rgba(40, 45, 58, 0.45)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, tileSize - 1, tileSize - 1);
      }
    }

    // ─── 3. Large corridor sections (lighter metallic strips) ───
    const numCorridors = 12 + Math.floor(random() * 8);
    for (let i = 0; i < numCorridors; i++) {
      const isHorizontal = random() > 0.5;
      const corridorWidth = 120 + random() * 200;

      if (isHorizontal) {
        const y = random() * MAP_CONFIG.height;
        ctx.fillStyle = `rgba(28, 32, 42, ${0.5 + random() * 0.3})`;
        ctx.fillRect(0, y, MAP_CONFIG.width, corridorWidth);

        // Corridor edge lines (metallic trim)
        ctx.strokeStyle = 'rgba(55, 62, 80, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(MAP_CONFIG.width, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, y + corridorWidth);
        ctx.lineTo(MAP_CONFIG.width, y + corridorWidth);
        ctx.stroke();
      } else {
        const x = random() * MAP_CONFIG.width;
        ctx.fillStyle = `rgba(28, 32, 42, ${0.5 + random() * 0.3})`;
        ctx.fillRect(x, 0, corridorWidth, MAP_CONFIG.height);

        ctx.strokeStyle = 'rgba(55, 62, 80, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, MAP_CONFIG.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + corridorWidth, 0);
        ctx.lineTo(x + corridorWidth, MAP_CONFIG.height);
        ctx.stroke();
      }
    }

    // ─── 4. Industrial pipe runs ───
    const numPipes = 18 + Math.floor(random() * 12);
    for (let i = 0; i < numPipes; i++) {
      const isH = random() > 0.5;
      const pipeW = 4 + random() * 8;
      const pipeColor = random() > 0.5 ? '#2a3040' : '#252a35';

      ctx.strokeStyle = pipeColor;
      ctx.lineWidth = pipeW;
      ctx.lineCap = 'butt';
      ctx.beginPath();

      if (isH) {
        const y = random() * MAP_CONFIG.height;
        const x1 = random() * MAP_CONFIG.width * 0.3;
        const x2 = x1 + 400 + random() * 1500;
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
      } else {
        const x = random() * MAP_CONFIG.width;
        const y1 = random() * MAP_CONFIG.height * 0.3;
        const y2 = y1 + 400 + random() * 1500;
        ctx.moveTo(x, y1);
        ctx.lineTo(x, y2);
      }
      ctx.stroke();

      // Pipe highlight (reflective edge)
      ctx.strokeStyle = 'rgba(70, 80, 100, 0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // ─── 5. Hazard markings (yellow/black striped zones) ───
    const numHazards = 20 + Math.floor(random() * 15);
    for (let i = 0; i < numHazards; i++) {
      const hx = random() * MAP_CONFIG.width;
      const hy = random() * MAP_CONFIG.height;
      const hW = 60 + random() * 180;
      const hH = 8 + random() * 12;
      const isH = random() > 0.4;

      ctx.save();
      ctx.translate(hx, hy);
      if (!isH) ctx.rotate(Math.PI / 2);

      // Yellow-black hazard stripes
      const stripeW = 12;
      const numStripes = Math.ceil(hW / stripeW);
      for (let s = 0; s < numStripes; s++) {
        ctx.fillStyle = s % 2 === 0 ? 'rgba(180, 160, 30, 0.18)' : 'rgba(20, 20, 20, 0.25)';
        ctx.fillRect(s * stripeW, -hH / 2, stripeW, hH);
      }

      ctx.restore();
    }

    // ─── 6. Blood stains / scorch marks ───
    const numStains = 60 + Math.floor(random() * 40);
    for (let i = 0; i < numStains; i++) {
      const sx = random() * MAP_CONFIG.width;
      const sy = random() * MAP_CONFIG.height;
      const radius = 8 + random() * 35;
      const isBlood = random() > 0.35;

      if (isBlood) {
        // Blood splatter
        ctx.fillStyle = `rgba(${60 + Math.floor(random() * 40)}, ${5 + Math.floor(random() * 10)}, ${5 + Math.floor(random() * 10)}, ${0.12 + random() * 0.2})`;
        ctx.beginPath();
        // Irregular shape
        for (let j = 0; j < 8; j++) {
          const angle = (j / 8) * Math.PI * 2;
          const r = radius * (0.5 + random() * 0.5);
          const px = sx + Math.cos(angle) * r;
          const py = sy + Math.sin(angle) * r;
          if (j === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        // Blood droplets radiating outward
        for (let d = 0; d < 3 + Math.floor(random() * 5); d++) {
          const da = random() * Math.PI * 2;
          const dd = radius + random() * 25;
          const dr = 2 + random() * 4;
          ctx.fillStyle = `rgba(70, 8, 8, ${0.08 + random() * 0.12})`;
          ctx.beginPath();
          ctx.arc(sx + Math.cos(da) * dd, sy + Math.sin(da) * dd, dr, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Scorch / burn marks
        ctx.fillStyle = `rgba(${10 + Math.floor(random() * 15)}, ${10 + Math.floor(random() * 12)}, ${8 + Math.floor(random() * 10)}, ${0.2 + random() * 0.25})`;
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ─── 7. Floor grates / vent openings ───
    const numGrates = 25 + Math.floor(random() * 20);
    for (let i = 0; i < numGrates; i++) {
      const gx = random() * MAP_CONFIG.width;
      const gy = random() * MAP_CONFIG.height;
      const gw = 20 + random() * 40;
      const gh = 20 + random() * 40;

      // Dark grate background
      ctx.fillStyle = 'rgba(8, 10, 14, 0.6)';
      ctx.fillRect(gx, gy, gw, gh);

      // Grate lines
      ctx.strokeStyle = 'rgba(35, 40, 50, 0.7)';
      ctx.lineWidth = 2;
      for (let gLine = 0; gLine < gw; gLine += 6) {
        ctx.beginPath();
        ctx.moveTo(gx + gLine, gy);
        ctx.lineTo(gx + gLine, gy + gh);
        ctx.stroke();
      }

      // Border
      ctx.strokeStyle = 'rgba(50, 56, 70, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(gx, gy, gw, gh);
    }

    // ─── 8. Shell casings / debris dots ───
    const numDebris = (MAP_CONFIG.width * MAP_CONFIG.height) / 6000;
    for (let i = 0; i < numDebris; i++) {
      const dx = random() * MAP_CONFIG.width;
      const dy = random() * MAP_CONFIG.height;
      const dType = random();

      if (dType < 0.3) {
        // Brass shell casing
        ctx.fillStyle = `rgba(${140 + Math.floor(random() * 60)}, ${110 + Math.floor(random() * 40)}, ${40 + Math.floor(random() * 30)}, ${0.15 + random() * 0.2})`;
        ctx.save();
        ctx.translate(dx, dy);
        ctx.rotate(random() * Math.PI * 2);
        ctx.fillRect(-2, -1, 4, 2);
        ctx.restore();
      } else if (dType < 0.6) {
        // Rubble/concrete chip
        ctx.fillStyle = `rgba(${45 + Math.floor(random() * 30)}, ${48 + Math.floor(random() * 25)}, ${55 + Math.floor(random() * 20)}, ${0.2 + random() * 0.2})`;
        ctx.beginPath();
        ctx.arc(dx, dy, 1 + random() * 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Spark/glow point
        ctx.fillStyle = `rgba(${60 + Math.floor(random() * 40)}, ${70 + Math.floor(random() * 40)}, ${100 + Math.floor(random() * 40)}, ${0.08 + random() * 0.12})`;
        ctx.beginPath();
        ctx.arc(dx, dy, 1 + random() * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ─── 9. Wall segments / barricade lines (interior obstacles) ───
    const numWalls = 15 + Math.floor(random() * 10);
    for (let i = 0; i < numWalls; i++) {
      const wx = random() * MAP_CONFIG.width;
      const wy = random() * MAP_CONFIG.height;
      const wLen = 60 + random() * 200;
      const wThick = 6 + random() * 10;
      const isH = random() > 0.5;

      ctx.save();
      ctx.translate(wx, wy);

      // Dark wall shadow
      ctx.fillStyle = 'rgba(8, 10, 16, 0.5)';
      if (isH) {
        ctx.fillRect(0, 3, wLen, wThick);
      } else {
        ctx.fillRect(3, 0, wThick, wLen);
      }

      // Wall body
      ctx.fillStyle = `rgba(${30 + Math.floor(random() * 15)}, ${33 + Math.floor(random() * 12)}, ${40 + Math.floor(random() * 15)}, 0.7)`;
      if (isH) {
        ctx.fillRect(0, 0, wLen, wThick);
      } else {
        ctx.fillRect(0, 0, wThick, wLen);
      }

      // Wall top highlight
      ctx.fillStyle = 'rgba(60, 65, 80, 0.3)';
      if (isH) {
        ctx.fillRect(0, 0, wLen, 2);
      } else {
        ctx.fillRect(0, 0, 2, wLen);
      }

      ctx.restore();
    }

    // ─── 10. Emergency lighting pools (red/amber) ───
    const numLights = 30 + Math.floor(random() * 20);
    for (let i = 0; i < numLights; i++) {
      const lx = random() * MAP_CONFIG.width;
      const ly = random() * MAP_CONFIG.height;
      const lr = 40 + random() * 80;
      const isRed = random() > 0.6;

      const grad = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
      if (isRed) {
        grad.addColorStop(0, 'rgba(80, 15, 10, 0.12)');
        grad.addColorStop(0.5, 'rgba(60, 10, 8, 0.06)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        grad.addColorStop(0, 'rgba(60, 55, 20, 0.10)');
        grad.addColorStop(0.5, 'rgba(40, 35, 12, 0.05)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(lx - lr, ly - lr, lr * 2, lr * 2);
    }

    // ─── 11. Slice into chunks ───
    for (let r = 0; r < this.rows; r++) {
      this.chunks[r] = [];
      for (let c = 0; c < this.cols; c++) {
        const chunkCanvas = document.createElement('canvas');
        chunkCanvas.width = CHUNK_SIZE;
        chunkCanvas.height = CHUNK_SIZE;
        const chunkCtx = chunkCanvas.getContext('2d', { alpha: false })!;

        chunkCtx.drawImage(
          tempCanvas,
          c * CHUNK_SIZE, r * CHUNK_SIZE, CHUNK_SIZE, CHUNK_SIZE,
          0, 0, CHUNK_SIZE, CHUNK_SIZE
        );

        this.chunks[r][c] = chunkCanvas;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera) {
    const startCol = Math.max(0, Math.floor(camera.x / CHUNK_SIZE));
    const startRow = Math.max(0, Math.floor(camera.y / CHUNK_SIZE));
    const endCol = Math.min(this.cols - 1, Math.floor((camera.x + camera.width) / CHUNK_SIZE));
    const endRow = Math.min(this.rows - 1, Math.floor((camera.y + camera.height) / CHUNK_SIZE));

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const [sx, sy] = camera.worldToScreen(c * CHUNK_SIZE, r * CHUNK_SIZE);
        ctx.drawImage(this.chunks[r][c], sx, sy);
      }
    }
  }
}
