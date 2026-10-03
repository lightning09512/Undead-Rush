export class LightingRenderer {
  private static instance: LightingRenderer;
  private vignetteCanvas: HTMLCanvasElement;
  private glowCanvas: HTMLCanvasElement;

  private constructor() {
    this.vignetteCanvas = document.createElement('canvas');
    this.glowCanvas = document.createElement('canvas');
    this.resizeVignette(window.innerWidth, window.innerHeight);
    this.generateGlow();
  }

  static get(): LightingRenderer {
    if (!LightingRenderer.instance) {
      LightingRenderer.instance = new LightingRenderer();
    }
    return LightingRenderer.instance;
  }

  resizeVignette(width: number, height: number) {
    this.vignetteCanvas.width = width;
    this.vignetteCanvas.height = height;
    const ctx = this.vignetteCanvas.getContext('2d')!;
    
    const maxRadius = Math.max(width, height) / 1.5;
    const cx = width / 2;
    const cy = height / 2;
    
    const grad = ctx.createRadialGradient(cx, cy, maxRadius * 0.35, cx, cy, maxRadius);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.7, 'rgba(5, 5, 15, 0.35)');
    grad.addColorStop(1, 'rgba(0, 2, 8, 0.8)');
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  private generateGlow() {
    const size = 256;
    this.glowCanvas.width = size;
    this.glowCanvas.height = size;
    const ctx = this.glowCanvas.getContext('2d')!;
    
    const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  drawVignette(ctx: CanvasRenderingContext2D) {
    ctx.drawImage(this.vignetteCanvas, 0, 0);
  }

  drawGlow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, alpha: number = 1.0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    
    // We colorize the white glow by using globalCompositeOperation 'source-in' or just a colored rect?
    // Actually, drawing a colored rect over the white glow works if we do it in a temporary pass,
    // OR simply draw the pre-rendered white glow, then draw a colored circle with 'multiply' or 'source-atop'.
    // A faster way without per-frame composition: tint the glow via a tint function (caching colored glows).
    // Let's just use ctx.globalCompositeOperation = 'lighter' and draw a colored circle with blur? NO blur per frame!
    // Easiest is to draw the white glow, and it will just be white. To tint it per frame without creating gradients:
    // Just set `ctx.fillStyle = color`, `ctx.globalCompositeOperation = 'multiply'`? No, lighter.
    
    // Instead of complex tinting, I'll cache the glow and draw a colored circle under it, or just accept white core.
    // Let's draw a colored circle with low alpha, then the white glow on top.
    ctx.translate(x, y);
    ctx.scale(radius / 128, radius / 128); // 256 is default size (radius 128)
    
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha * 0.4;
    ctx.beginPath();
    ctx.arc(0, 0, 128, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.globalAlpha = alpha * 0.8;
    ctx.drawImage(this.glowCanvas, -128, -128);
    
    ctx.restore();
  }

  drawTelegraphRing(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 15]);
    ctx.globalAlpha = 0.8;
    
    // Rotate the dash over time
    const time = Date.now() / 1000;
    ctx.lineDashOffset = time * 20;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.restore();
  }
}
