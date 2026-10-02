export type SpriteId = 'player' | 'shambler' | 'runner' | 'brute' | 'boomer' | 'spitter' | 'radiant' | 'boss';

export interface SpriteConfig {
  width: number;
  height: number;
  render: (ctx: CanvasRenderingContext2D, color?: string) => void;
}

export class AssetManager {
  private static instance: AssetManager;
  private cache = new Map<string, HTMLCanvasElement[]>(); // key: SpriteId_color, value: array of animation frames

  private constructor() {}

  static get(): AssetManager {
    if (!AssetManager.instance) {
      AssetManager.instance = new AssetManager();
    }
    return AssetManager.instance;
  }

  getSprite(id: SpriteId, color: string, frameIndex: number): HTMLCanvasElement {
    const key = `${id}_${color}`;
    if (!this.cache.has(key)) {
      this.cache.set(key, this.generateFrames(id, color));
    }
    const frames = this.cache.get(key)!;
    return frames[frameIndex % frames.length];
  }

  private generateFrames(id: SpriteId, color: string): HTMLCanvasElement[] {
    const frames: HTMLCanvasElement[] = [];
    const numFrames = 4; // 0: stand, 1: step right, 2: stand, 3: step left

    for (let i = 0; i < numFrames; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      
      // Center for rotation
      ctx.translate(32, 32);

      // Animation offset
      const bob = (i % 2 === 1) ? -2 : 0;
      let leftLeg = 0;
      let rightLeg = 0;
      if (i === 1) { leftLeg = 4; rightLeg = -4; }
      if (i === 3) { leftLeg = -4; rightLeg = 4; }

      ctx.save();
      ctx.translate(0, bob);

      switch (id) {
        case 'player':
          this.renderPlayer(ctx, color, leftLeg, rightLeg);
          break;
        case 'shambler':
        case 'radiant':
        case 'runner':
        case 'boss':
          this.renderZombieNormal(ctx, color, leftLeg, rightLeg, id);
          break;
        case 'brute':
          this.renderZombieBrute(ctx, color, leftLeg, rightLeg);
          break;
        case 'boomer':
          this.renderZombieBoomer(ctx, color, leftLeg, rightLeg);
          break;
        case 'spitter':
          this.renderZombieSpitter(ctx, color, leftLeg, rightLeg);
          break;
      }

      ctx.restore();
      frames.push(canvas);
    }
    return frames;
  }

  private renderPlayer(ctx: CanvasRenderingContext2D, color: string, ll: number, rl: number) {
    // Legs
    ctx.fillStyle = '#222';
    this.roundRect(ctx, -10 + ll, -8, 8, 16, 4);
    this.roundRect(ctx, 2 + rl, -8, 8, 16, 4);

    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();

    // Backpack
    ctx.fillStyle = '#443';
    this.roundRect(ctx, -18, -10, 12, 20, 3);

    // Head
    ctx.fillStyle = '#ffccaa';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();

    // Gun
    ctx.fillStyle = '#333';
    ctx.fillRect(8, -4, 18, 6); // Barrel
    ctx.fillStyle = '#111';
    ctx.fillRect(8, -5, 6, 8);  // Grip
    
    // Hands
    ctx.fillStyle = '#ffccaa';
    ctx.beginPath();
    ctx.arc(6, -2, 3, 0, Math.PI * 2);
    ctx.arc(14, -2, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderZombieNormal(ctx: CanvasRenderingContext2D, color: string, ll: number, rl: number, type: string) {
    const isRunner = type === 'runner';
    const isBoss = type === 'boss';
    const scale = isBoss ? 1.5 : (isRunner ? 0.8 : 1);
    ctx.scale(scale, scale);

    // Legs
    ctx.fillStyle = '#1a3320';
    this.roundRect(ctx, -10 + ll, -6, 6, 12, 3);
    this.roundRect(ctx, 4 + rl, -6, 6, 12, 3);

    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#779977';
    ctx.beginPath();
    ctx.arc(4, 0, 8, 0, Math.PI * 2);
    ctx.fill();

    // Arms outstretched
    ctx.fillStyle = color;
    this.roundRect(ctx, 2, -14, 14, 6, 3); // Left arm
    this.roundRect(ctx, 2, 8, 14, 6, 3);  // Right arm

    // Eyes
    ctx.fillStyle = isBoss ? '#ff00ff' : '#ff0000';
    ctx.beginPath();
    ctx.arc(8, -3, 2, 0, Math.PI * 2);
    ctx.arc(8, 3, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderZombieBrute(ctx: CanvasRenderingContext2D, color: string, ll: number, rl: number) {
    ctx.scale(1.3, 1.3);
    
    // Legs
    ctx.fillStyle = '#1a3320';
    this.roundRect(ctx, -12 + ll, -10, 8, 20, 4);
    this.roundRect(ctx, 4 + rl, -10, 8, 20, 4);

    // Huge Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#668866';
    ctx.beginPath();
    ctx.arc(8, 0, 9, 0, Math.PI * 2);
    ctx.fill();

    // Huge Arms
    ctx.fillStyle = color;
    this.roundRect(ctx, 0, -22, 18, 10, 5); 
    this.roundRect(ctx, 0, 12, 18, 10, 5);  

    // Eyes
    ctx.fillStyle = '#ffaa00';
    ctx.beginPath();
    ctx.arc(12, -4, 2, 0, Math.PI * 2);
    ctx.arc(12, 4, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderZombieBoomer(ctx: CanvasRenderingContext2D, color: string, ll: number, rl: number) {
    // Legs
    ctx.fillStyle = '#222';
    this.roundRect(ctx, -12 + ll, -8, 8, 16, 4);
    this.roundRect(ctx, 4 + rl, -8, 8, 16, 4);

    // Bloated Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();

    // Pulsing boils
    ctx.fillStyle = '#ff8800';
    ctx.beginPath();
    ctx.arc(-6, -8, 4, 0, Math.PI * 2);
    ctx.arc(2, 10, 5, 0, Math.PI * 2);
    ctx.arc(-8, 6, 3, 0, Math.PI * 2);
    ctx.fill();

    // Head embedded in fat
    ctx.fillStyle = '#88aa88';
    ctx.beginPath();
    ctx.arc(8, 0, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderZombieSpitter(ctx: CanvasRenderingContext2D, color: string, ll: number, rl: number) {
    // Legs
    ctx.fillStyle = '#112211';
    this.roundRect(ctx, -8 + ll, -6, 6, 12, 3);
    this.roundRect(ctx, 2 + rl, -6, 6, 12, 3);

    // Skinny Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#558855';
    ctx.beginPath();
    ctx.arc(6, 0, 7, 0, Math.PI * 2);
    ctx.fill();

    // Acid sac
    ctx.fillStyle = '#44ff44';
    ctx.beginPath();
    ctx.arc(4, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#44ff4488';
    ctx.beginPath();
    ctx.arc(12, 0, 3, 0, Math.PI * 2); // Mouth dripping
    ctx.fill();
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
  }
}
