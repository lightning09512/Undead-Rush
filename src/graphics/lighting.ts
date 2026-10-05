import type { Camera } from '../core/camera';
import { CAMPAIGN_VISUAL_PROFILES, type CampaignLampTone, type StageDef } from '../data/meta';

type CampaignLamp = {
  x: number;
  y: number;
  radius: number;
  tone: CampaignLampTone;
};

type CampaignLampSource = CampaignLamp & { x: number; y: number };

export class LightingRenderer {
  private static instance: LightingRenderer;
  private vignetteCanvas: HTMLCanvasElement;
  private glowCanvas: HTMLCanvasElement;
  private campaignDarknessCanvas: HTMLCanvasElement;
  private campaignDarknessCtx: CanvasRenderingContext2D;
  private lightMaskCanvas: HTMLCanvasElement;
  private lampGlowCanvases: Record<CampaignLampTone, HTMLCanvasElement>;
  private flashlightGlowCanvas: HTMLCanvasElement;
  private campaignLamps: CampaignLamp[] = [];
  private readonly lampSourcesByLayout = new WeakMap<object, CampaignLampSource[]>();
  private visibleCampaignLampCount = 0;

  private constructor() {
    this.vignetteCanvas = document.createElement('canvas');
    this.glowCanvas = document.createElement('canvas');
    this.campaignDarknessCanvas = document.createElement('canvas');
    this.campaignDarknessCtx = this.campaignDarknessCanvas.getContext('2d')!;
    this.lightMaskCanvas = document.createElement('canvas');
    this.flashlightGlowCanvas = document.createElement('canvas');
    this.lampGlowCanvases = {
      warm: document.createElement('canvas'),
      medical: document.createElement('canvas'),
      red: document.createElement('canvas'),
      cyan: document.createElement('canvas'),
    };
    this.resizeVignette(window.innerWidth, window.innerHeight);
    this.generateGlow();
    this.generateCampaignLightTextures();
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

  private generateCampaignLightTextures(): void {
    const size = 256;
    this.lightMaskCanvas.width = size;
    this.lightMaskCanvas.height = size;
    const mask = this.lightMaskCanvas.getContext('2d')!;
    const maskGradient = mask.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    maskGradient.addColorStop(0, 'rgba(255,255,255,.98)');
    maskGradient.addColorStop(.34, 'rgba(255,255,255,.88)');
    maskGradient.addColorStop(.66, 'rgba(255,255,255,.56)');
    maskGradient.addColorStop(1, 'rgba(255,255,255,0)');
    mask.fillStyle = maskGradient;
    mask.fillRect(0, 0, size, size);

    this.flashlightGlowCanvas.width = size;
    this.flashlightGlowCanvas.height = size;
    const flashlightGlow = this.flashlightGlowCanvas.getContext('2d')!;
    const flashlightGradient = flashlightGlow.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    flashlightGradient.addColorStop(0, 'rgba(255,239,204,.28)');
    flashlightGradient.addColorStop(.48, 'rgba(255,226,184,.13)');
    flashlightGradient.addColorStop(1, 'rgba(255,220,175,0)');
    flashlightGlow.fillStyle = flashlightGradient;
    flashlightGlow.fillRect(0, 0, size, size);

    const colors: Record<CampaignLampTone, [string, string]> = {
      warm: ['rgba(255,220,164,.42)', 'rgba(255,183,104,.15)'],
      medical: ['rgba(226,246,224,.38)', 'rgba(174,222,203,.14)'],
      red: ['rgba(255,126,96,.31)', 'rgba(225,72,62,.10)'],
      cyan: ['rgba(157,236,233,.38)', 'rgba(91,181,195,.13)'],
    };
    for (const [tone, [center, mid]] of Object.entries(colors) as Array<[CampaignLampTone, [string, string]]>) {
      const canvas = this.lampGlowCanvases[tone];
      canvas.width = size;
      canvas.height = size;
      const glow = canvas.getContext('2d')!;
      const gradient = glow.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, center);
      gradient.addColorStop(.58, mid);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      glow.fillStyle = gradient;
      glow.fillRect(0, 0, size, size);
    }
  }

  /** Campaign-only low-light pass. Cached light textures keep the pass cheap per frame. */
  drawCampaignLighting(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    stage: StageDef,
    playerX: number,
    playerY: number,
    aimAngle: number,
    width: number,
    height: number,
    flashlightLevel = 1,
  ): void {
    const layout = stage.layout;
    if (!layout) return;
    const overlay = this.campaignDarknessCanvas;
    if (overlay.width !== Math.ceil(width) || overlay.height !== Math.ceil(height)) {
      overlay.width = Math.ceil(width);
      overlay.height = Math.ceil(height);
      this.campaignDarknessCtx = overlay.getContext('2d')!;
    }

    const mask = this.campaignDarknessCtx;
    mask.clearRect(0, 0, overlay.width, overlay.height);
    const profile = CAMPAIGN_VISUAL_PROFILES[stage.id] ?? CAMPAIGN_VISUAL_PROFILES[1];
    mask.fillStyle = `rgba(3,5,9,${profile.darkness})`;
    mask.fillRect(0, 0, overlay.width, overlay.height);

    const lamps = this.campaignLamps;
    let lampCount = 0;
    for (const source of this.getCampaignLampSources(layout, stage.id)) {
      if (!camera.isVisible(source.x, source.y, 260)) continue;
      const [sx, sy] = camera.worldToScreen(source.x, source.y);
      const lamp = lamps[lampCount] ?? (lamps[lampCount] = { x: 0, y: 0, radius: 0, tone: source.tone });
      lamp.x = sx; lamp.y = sy; lamp.radius = source.radius; lamp.tone = source.tone;
      lampCount++;
    }
    this.visibleCampaignLampCount = lampCount;

    mask.save();
    mask.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < lampCount; i++) {
      const lamp = lamps[i];
      mask.globalAlpha = .92;
      mask.drawImage(this.lightMaskCanvas, lamp.x - lamp.radius, lamp.y - lamp.radius, lamp.radius * 2, lamp.radius * 2);
    }

    if (flashlightLevel > 0) {
      const [px, py] = camera.worldToScreen(playerX, playerY);
      const beamX = px + Math.cos(aimAngle) * 28;
      const beamY = py + Math.sin(aimAngle) * 28;
      const level = Math.max(1, Math.min(3, flashlightLevel));
      const beamLength = 360 + (level - 1) * 90;
      const beamHalfAngle = .36 + (level - 1) * .045;
      mask.globalAlpha = 1;
      mask.translate(beamX, beamY);
      mask.rotate(aimAngle);
      const featheredCones = [
        { spread: .10, alpha: .23 },
        { spread: .045, alpha: .34 },
        { spread: 0, alpha: .48 + (level - 1) * .035 },
      ];
      for (const cone of featheredCones) {
        mask.save();
        mask.globalAlpha = cone.alpha;
        mask.beginPath();
        mask.moveTo(0, 0);
        mask.arc(0, 0, beamLength, -beamHalfAngle - cone.spread, beamHalfAngle + cone.spread);
        mask.closePath();
        mask.clip();
        mask.drawImage(this.lightMaskCanvas, -beamLength, -beamLength, beamLength * 2, beamLength * 2);
        mask.restore();
      }
      mask.restore();
    }
    mask.restore();

    ctx.drawImage(overlay, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    if (flashlightLevel > 0) {
      const [px, py] = camera.worldToScreen(playerX, playerY);
      const level = Math.max(1, Math.min(3, flashlightLevel));
      const beamLength = 360 + (level - 1) * 90;
      const beamHalfAngle = .36 + (level - 1) * .045;
      const beamX = px + Math.cos(aimAngle) * 28;
      const beamY = py + Math.sin(aimAngle) * 28;
      ctx.globalAlpha = .52;
      ctx.translate(beamX, beamY);
      ctx.rotate(aimAngle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, beamLength, -beamHalfAngle - .1, beamHalfAngle + .1);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(this.flashlightGlowCanvas, -beamLength, -beamLength, beamLength * 2, beamLength * 2);
      ctx.restore();
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
    }
    for (let i = 0; i < lampCount; i++) {
      const lamp = lamps[i];
      ctx.globalAlpha = lamp.tone === 'red' || lamp.tone === 'cyan' ? .78 : .84;
      ctx.drawImage(this.lampGlowCanvases[lamp.tone], lamp.x - lamp.radius, lamp.y - lamp.radius, lamp.radius * 2, lamp.radius * 2);
    }
    ctx.restore();
  }

  get performanceStats(): { visibleCampaignLamps: number } {
    return { visibleCampaignLamps: this.visibleCampaignLampCount };
  }

  private getCampaignLampSources(layout: NonNullable<StageDef['layout']>, stageId: number): CampaignLampSource[] {
    let sources = this.lampSourcesByLayout.get(layout);
    if (sources) return sources;

    const profile = CAMPAIGN_VISUAL_PROFILES[stageId] ?? CAMPAIGN_VISUAL_PROFILES[1];
    sources = [];
    for (const prop of layout.decorations) {
      if (!['streetlight', 'gardenlamp', 'examLamp', 'lightbar', 'wallLamp'].includes(prop.kind)) continue;
      const poleLamp = prop.kind === 'streetlight' || prop.kind === 'gardenlamp' || prop.kind === 'examLamp';
      const sourceX = prop.x + prop.w * (poleLamp ? .82 : .5);
      const sourceY = prop.y + prop.h * (poleLamp ? .22 : .5);
      const radius = prop.kind === 'streetlight' ? 225 : prop.kind === 'gardenlamp' ? 175
        : prop.kind === 'examLamp' ? 155 : prop.kind === 'wallLamp' ? profile.lampRadius : 118;
      if (prop.kind === 'lightbar') {
        sources.push({ x: sourceX - prop.w * .09, y: sourceY, radius, tone: 'red' });
        sources.push({ x: sourceX + prop.w * .09, y: sourceY, radius, tone: 'cyan' });
      } else {
        const tone = prop.kind === 'examLamp' ? 'medical' : prop.kind === 'wallLamp' ? profile.lampTone : 'warm';
        sources.push({ x: sourceX, y: sourceY, radius, tone });
      }
    }
    this.lampSourcesByLayout.set(layout, sources);
    return sources;
  }

  drawVignette(ctx: CanvasRenderingContext2D, opacity = 1) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.drawImage(this.vignetteCanvas, 0, 0);
    ctx.restore();
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
