import { Camera } from '../core/camera';
import { MAP_CONFIG } from '../data/items';

type PropType = 'rock' | 'log' | 'crate' | 'bush';

interface Prop {
  x: number;
  y: number;
  type: PropType;
  scale: number;
  rotation: number;
}

export class PropRenderer {
  private props: Prop[] = [];
  private sprites = new Map<PropType, HTMLCanvasElement>();

  constructor() {
    this.generateSprites();
    this.scatterProps();
  }

  private generateSprites() {
    this.sprites.set('rock', this.renderRock());
    this.sprites.set('log', this.renderLog());
    this.sprites.set('crate', this.renderCrate());
    this.sprites.set('bush', this.renderBush());
  }

  private renderRock(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    
    ctx.translate(32, 32);
    
    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 5;

    // Base shape
    ctx.fillStyle = '#445544';
    ctx.beginPath();
    ctx.moveTo(-20, -10);
    ctx.lineTo(-10, -20);
    ctx.lineTo(15, -15);
    ctx.lineTo(25, 5);
    ctx.lineTo(10, 20);
    ctx.lineTo(-15, 15);
    ctx.closePath();
    ctx.fill();

    ctx.shadowColor = 'transparent';

    // Facets (lit/shaded)
    ctx.fillStyle = '#556655';
    ctx.beginPath();
    ctx.moveTo(-20, -10);
    ctx.lineTo(-10, -20);
    ctx.lineTo(5, -5);
    ctx.lineTo(-5, 5);
    ctx.fill();

    ctx.fillStyle = '#334433';
    ctx.beginPath();
    ctx.moveTo(15, -15);
    ctx.lineTo(25, 5);
    ctx.lineTo(5, -5);
    ctx.fill();

    return canvas;
  }

  private renderLog(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 40;
    const ctx = canvas.getContext('2d')!;
    
    ctx.translate(40, 20);

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 5;

    // Body
    ctx.fillStyle = '#5c4033';
    ctx.fillRect(-30, -10, 60, 20);
    
    ctx.shadowColor = 'transparent';

    // Bark lines
    ctx.strokeStyle = '#3e2723';
    ctx.lineWidth = 2;
    for (let i = -8; i <= 8; i += 4) {
      ctx.beginPath();
      ctx.moveTo(-30, i);
      ctx.lineTo(30, i + (Math.random() - 0.5) * 4);
      ctx.stroke();
    }

    // Wood rings on end
    ctx.fillStyle = '#8b5a2b';
    ctx.beginPath();
    ctx.ellipse(-30, 0, 4, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#5c4033';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(-30, 0, 2, 6, 0, 0, Math.PI * 2);
    ctx.stroke();

    return canvas;
  }

  private renderCrate(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 50;
    const ctx = canvas.getContext('2d')!;
    
    ctx.translate(25, 25);

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 6;

    // Box
    ctx.fillStyle = '#6b4c3a';
    ctx.fillRect(-16, -16, 32, 32);

    ctx.shadowColor = 'transparent';

    // Border
    ctx.strokeStyle = '#3e2723';
    ctx.lineWidth = 2;
    ctx.strokeRect(-16, -16, 32, 32);

    // Planks
    ctx.beginPath();
    ctx.moveTo(-16, -5);
    ctx.lineTo(16, -5);
    ctx.moveTo(-16, 5);
    ctx.lineTo(16, 5);
    ctx.stroke();

    // Metal corners
    ctx.fillStyle = '#777777';
    ctx.fillRect(-16, -16, 6, 6);
    ctx.fillRect(10, -16, 6, 6);
    ctx.fillRect(-16, 10, 6, 6);
    ctx.fillRect(10, 10, 6, 6);

    // Icon (skull or star)
    ctx.fillStyle = '#8c6853';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('☣', 0, 0);

    return canvas;
  }

  private renderBush(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 80;
    const ctx = canvas.getContext('2d')!;
    
    ctx.translate(40, 40);

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 8;

    // Base dark leaves
    ctx.fillStyle = '#0f2411';
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.arc(-10, -10, 20, 0, Math.PI * 2);
    ctx.arc(10, -10, 20, 0, Math.PI * 2);
    ctx.arc(-15, 10, 18, 0, Math.PI * 2);
    ctx.arc(15, 10, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = 'transparent';

    // Mid leaves
    ctx.fillStyle = '#163319';
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.arc(-8, -8, 15, 0, Math.PI * 2);
    ctx.arc(8, -8, 15, 0, Math.PI * 2);
    ctx.arc(-12, 8, 13, 0, Math.PI * 2);
    ctx.arc(12, 8, 13, 0, Math.PI * 2);
    ctx.fill();

    // Highlights
    ctx.fillStyle = '#224a27';
    ctx.beginPath();
    ctx.arc(-4, -4, 8, 0, Math.PI * 2);
    ctx.arc(6, -6, 7, 0, Math.PI * 2);
    ctx.fill();

    return canvas;
  }

  private scatterProps() {
    const numProps = 800;
    const random = (() => {
      let seed = 98765;
      return () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      };
    })();

    const types: PropType[] = ['rock', 'log', 'crate', 'bush'];

    for (let i = 0; i < numProps; i++) {
      this.props.push({
        x: random() * MAP_CONFIG.width,
        y: random() * MAP_CONFIG.height,
        type: types[Math.floor(random() * types.length)],
        scale: 0.8 + random() * 0.6,
        rotation: random() * Math.PI * 2,
      });
    }
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera, layer: 'ground' | 'above') {
    for (const prop of this.props) {
      // Split drawing: bushes render 'above' entities, everything else 'ground'
      const isAbove = prop.type === 'bush';
      if ((layer === 'above' && !isAbove) || (layer === 'ground' && isAbove)) {
        continue;
      }

      if (!camera.isVisible(prop.x, prop.y, 60)) continue;

      const [sx, sy] = camera.worldToScreen(prop.x, prop.y);
      const sprite = this.sprites.get(prop.type)!;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(prop.rotation);
      ctx.scale(prop.scale, prop.scale);
      // Offset by half sprite size since we translated center when rendering sprite
      ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
      ctx.restore();
    }
  }
}
