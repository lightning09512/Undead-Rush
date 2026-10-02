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
      let seed = 12345;
      return () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      };
    })();

    // 1. Create a large temporary canvas for the whole map
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = MAP_CONFIG.width;
    tempCanvas.height = MAP_CONFIG.height;
    const ctx = tempCanvas.getContext('2d', { alpha: false })!;

    // Base dark green
    ctx.fillStyle = '#131b14';
    ctx.fillRect(0, 0, MAP_CONFIG.width, MAP_CONFIG.height);

    // Blobs
    const numBlobs = (MAP_CONFIG.width * MAP_CONFIG.height) / 25000;
    for (let i = 0; i < numBlobs; i++) {
      const x = random() * MAP_CONFIG.width;
      const y = random() * MAP_CONFIG.height;
      const radius = 50 + random() * 150;
      ctx.fillStyle = random() > 0.5 ? '#1b291d' : '#162017';
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Winding dirt paths
    const numPaths = (MAP_CONFIG.width * MAP_CONFIG.height) / 330000;
    for (let i = 0; i < numPaths; i++) {
      ctx.strokeStyle = '#2b261a';
      ctx.lineWidth = 40 + random() * 60;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      let px = random() * MAP_CONFIG.width;
      let py = random() * MAP_CONFIG.height;
      ctx.moveTo(px, py);
      for (let j = 0; j < 8; j++) {
        px += (random() - 0.5) * 600;
        py += (random() - 0.5) * 600;
        ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Inner path highlight
      ctx.strokeStyle = '#383121';
      ctx.lineWidth = ctx.lineWidth * 0.6;
      ctx.stroke();
    }

    // Thin vines / cracks
    const numVines = (MAP_CONFIG.width * MAP_CONFIG.height) / 50000;
    for (let i = 0; i < numVines; i++) {
      ctx.strokeStyle = '#0f140f';
      ctx.lineWidth = 1 + random() * 2;
      ctx.beginPath();
      let px = random() * MAP_CONFIG.width;
      let py = random() * MAP_CONFIG.height;
      ctx.moveTo(px, py);
      for (let j = 0; j < 5; j++) {
        px += (random() - 0.5) * 150;
        py += (random() - 0.5) * 150;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Tiny floating glow particles (drawn statically onto ground for performance)
    const numParticles = (MAP_CONFIG.width * MAP_CONFIG.height) / 10000;
    ctx.fillStyle = '#44aa55';
    for (let i = 0; i < numParticles; i++) {
      const x = random() * MAP_CONFIG.width;
      const y = random() * MAP_CONFIG.height;
      ctx.globalAlpha = 0.2 + random() * 0.3;
      ctx.beginPath();
      ctx.arc(x, y, 1 + random() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // 2. Slice into chunks
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
