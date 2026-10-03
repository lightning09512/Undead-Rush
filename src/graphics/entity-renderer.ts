import { spriteLoader, ASSETS_CONFIG } from './assets-config';

export interface EntityRenderOptions {
  assetKey: string;
  x: number;
  y: number;
  facingLeft?: boolean;
  scaleMult?: number;
  isMoving?: boolean;
  animTimer?: number;
  isFlashing?: boolean;
  alpha?: number;
  tiltAngle?: number;
  extraSquashX?: number;
  extraSquashY?: number;
  recoilX?: number;
  recoilY?: number;
  fallbackColor?: string;
  fallbackCanvas?: HTMLCanvasElement;
}

export class EntityRenderer {
  private static shadowCanvas: HTMLCanvasElement;

  static init() {
    // Pre-cache a soft elliptical shadow with radial gradient
    this.shadowCanvas = document.createElement('canvas');
    this.shadowCanvas.width = 128;
    this.shadowCanvas.height = 64;
    const ctx = this.shadowCanvas.getContext('2d')!;

    const grad = ctx.createRadialGradient(64, 32, 0, 64, 32, 64);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.25)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 64);
  }

  /**
   * Primary billboard 2.5D renderer for Vampire Survivors / Brotato aesthetic.
   * Characters stay upright, flip left/right, and feature squash-and-stretch locomotion.
   */
  static drawEntity(ctx: CanvasRenderingContext2D, opts: EntityRenderOptions): void {
    if (!this.shadowCanvas) this.init();

    const config = ASSETS_CONFIG[opts.assetKey];
    const scaleMult = opts.scaleMult ?? 1;
    const size = (config ? config.scale : 60) * scaleMult;
    const alpha = opts.alpha ?? 1;
    const isFlashing = opts.isFlashing ?? false;
    const isMoving = opts.isMoving ?? false;
    const facingLeft = opts.facingLeft ?? false;
    const anim = opts.animTimer ?? 0;
    const recoilX = opts.recoilX ?? 0;
    const recoilY = opts.recoilY ?? 0;
    const extraSquashX = opts.extraSquashX ?? 1;
    const extraSquashY = opts.extraSquashY ?? 1;

    const img = spriteLoader.getImage(opts.assetKey);
    const imgAspect = img && img.height > 0 ? img.width / img.height : 1;
    const drawH = size;
    const drawW = size * imgAspect;

    // ─── 1. Squash & Stretch + Bobbing Engine ───
    let bobY = 0;
    let sqX = 1;
    let sqY = 1;
    let tilt = 0;

    if (isMoving) {
      // Step frequency cadence
      const step = anim * 11;
      // Lifting foot off ground bob
      bobY = -Math.abs(Math.sin(step)) * (size * 0.12);
      // Dynamic compression on landing vs extension when jumping
      const stepSin = Math.sin(step * 2);
      sqX = 1 - stepSin * 0.08;
      sqY = 1 + stepSin * 0.08;
      // Waddling tilt + forward momentum lean
      const waddle = Math.sin(step) * 0.07;
      const forwardLean = (facingLeft ? -1 : 1) * 0.06;
      tilt = waddle + forwardLean;
    } else if (opts.tiltAngle === undefined) {
      // Gentle breathing idle for living beings
      const breath = Math.sin(anim * 2.8);
      bobY = breath * (size * 0.025);
      sqX = 1 - breath * 0.02;
      sqY = 1 + breath * 0.02;
      tilt = 0;
    }

    // Hit impact deformation: squash flatter like taking a heavy kinetic blow
    if (isFlashing) {
      sqX *= 1.25;
      sqY *= 0.78;
      bobY += size * 0.04;
    }

    // ─── 2. Dynamic Shadow ───
    const shadowW = drawW * 0.8 * Math.max(0.65, 1 + bobY / 30);
    const shadowH = size * 0.3 * Math.max(0.65, 1 + bobY / 30);
    const shadowY = opts.y + size * 0.32;
    ctx.globalAlpha = alpha * Math.max(0.2, 0.55 + bobY / 40);
    ctx.drawImage(this.shadowCanvas, opts.x - shadowW / 2, shadowY - shadowH / 2, shadowW, shadowH);
    ctx.globalAlpha = alpha;

    // ─── 3. Upright Billboard Transform ───
    ctx.save();
    ctx.translate(opts.x + recoilX, opts.y + bobY + recoilY);
    ctx.rotate(opts.tiltAngle !== undefined ? opts.tiltAngle : tilt);

    const flip = facingLeft ? -1 : 1;
    ctx.scale(flip * sqX * extraSquashX, sqY * extraSquashY);

    // Anchor pivot near feet (size * 0.35) so squash & stretch bounces up from ground
    const pivotOffsetY = size * 0.35;

    if (isFlashing) {
      const whiteImg = spriteLoader.getWhiteImage(opts.assetKey);
      if (whiteImg) {
        ctx.drawImage(whiteImg, -drawW / 2, -drawH + pivotOffsetY, drawW, drawH);
      } else if (img) {
        ctx.drawImage(img, -drawW / 2, -drawH + pivotOffsetY, drawW, drawH);
      } else if (opts.fallbackCanvas) {
        const fb = opts.fallbackCanvas;
        const fbW = size;
        const fbH = size * (fb.height / fb.width);
        ctx.drawImage(fb, -fbW / 2, -fbH + pivotOffsetY, fbW, fbH);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, -size / 2 + pivotOffsetY, size * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (img) {
      ctx.drawImage(img, -drawW / 2, -drawH + pivotOffsetY, drawW, drawH);
    } else if (opts.fallbackCanvas) {
      const fb = opts.fallbackCanvas;
      const fbW = size;
      const fbH = size * (fb.height / fb.width);
      ctx.drawImage(fb, -fbW / 2, -fbH + pivotOffsetY, fbW, fbH);
    } else {
      // Procedural fallback
      ctx.fillStyle = opts.fallbackColor || '#5a8a3c';
      ctx.beginPath();
      ctx.arc(0, -size / 2 + pivotOffsetY, size * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /** Backwards compatibility facade for drawParts */
  static drawParts(
    ctx: CanvasRenderingContext2D,
    baseKey: string,
    x: number, y: number,
    angle: number,
    scaleMult: number,
    animPhase: number,
    speed: number,
    isFlashing: boolean
  ) {
    const facingLeft = Math.cos(angle - Math.PI / 2) < -0.1 || angle > Math.PI;
    this.drawEntity(ctx, {
      assetKey: baseKey,
      x, y,
      facingLeft,
      scaleMult,
      isMoving: speed > 1,
      animTimer: animPhase,
      isFlashing,
    });
  }

  /** Backwards compatibility facade for drawSprite */
  static drawSprite(
    ctx: CanvasRenderingContext2D,
    assetKey: string,
    x: number, y: number,
    angle: number,
    scaleMult: number = 1,
    alpha: number = 1,
    bob: number = 0,
    squashX: number = 1,
    squashY: number = 1,
    isFlashing: boolean = false,
    fallbackCanvas?: HTMLCanvasElement,
    animPhase: number = 0
  ) {
    this.drawEntity(ctx, {
      assetKey,
      x, y,
      facingLeft: false,
      scaleMult,
      alpha,
      isFlashing,
      extraSquashX: squashX,
      extraSquashY: squashY,
      animTimer: animPhase,
      tiltAngle: angle,
      isMoving: Math.abs(bob) > 0.1,
      fallbackCanvas,
    });
  }
}
