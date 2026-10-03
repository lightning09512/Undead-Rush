import { Camera } from '../core/camera';
import { MAP_CONFIG } from '../data/items';
import { EntityRenderer } from './entity-renderer';

type PropType = 'barrel' | 'concrete_block' | 'ammo_box' | 'sandbag' | 'wire_fence' | 'computer_terminal';

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
    this.sprites.set('barrel', this.renderBarrel());
    this.sprites.set('concrete_block', this.renderConcreteBlock());
    this.sprites.set('ammo_box', this.renderAmmoBox());
    this.sprites.set('sandbag', this.renderSandbag());
    this.sprites.set('wire_fence', this.renderWireFence());
    this.sprites.set('computer_terminal', this.renderTerminal());
  }

  private renderBarrel(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 56;
    canvas.height = 56;
    const ctx = canvas.getContext('2d')!;

    ctx.translate(28, 28);

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 4;

    // Barrel body (cylinder top-down)
    ctx.fillStyle = '#3a4050';
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = 'transparent';

    // Metallic rim
    ctx.strokeStyle = '#555d70';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.stroke();

    // Inner rim
    ctx.strokeStyle = '#4a5265';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.stroke();

    // Center cap
    ctx.fillStyle = '#2d3340';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();

    // Biohazard marking (small)
    ctx.fillStyle = '#8a7020';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('☢', 0, 0);

    // Light reflection
    ctx.fillStyle = 'rgba(120, 130, 150, 0.2)';
    ctx.beginPath();
    ctx.ellipse(-5, -6, 6, 3, -0.5, 0, Math.PI * 2);
    ctx.fill();

    return canvas;
  }

  private renderConcreteBlock(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 48;
    const ctx = canvas.getContext('2d')!;

    ctx.translate(32, 24);

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 5;

    // Base block
    ctx.fillStyle = '#383d48';
    ctx.fillRect(-24, -14, 48, 28);

    ctx.shadowColor = 'transparent';

    // Top face (lighter for 3D effect)
    ctx.fillStyle = '#454b58';
    ctx.fillRect(-24, -14, 48, 10);

    // Cracks
    ctx.strokeStyle = '#2a2e38';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-15, -8);
    ctx.lineTo(-5, 2);
    ctx.lineTo(8, -3);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(10, 5);
    ctx.lineTo(18, 12);
    ctx.stroke();

    // Edge highlight
    ctx.strokeStyle = 'rgba(80, 85, 100, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-24, -14, 48, 28);

    return canvas;
  }

  private renderAmmoBox(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 50;
    const ctx = canvas.getContext('2d')!;

    ctx.translate(25, 25);

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 6;

    // Military green box
    ctx.fillStyle = '#2d3a28';
    ctx.fillRect(-16, -14, 32, 28);

    ctx.shadowColor = 'transparent';

    // Top face
    ctx.fillStyle = '#3a4a33';
    ctx.fillRect(-16, -14, 32, 9);

    // Border
    ctx.strokeStyle = '#1a2218';
    ctx.lineWidth = 2;
    ctx.strokeRect(-16, -14, 32, 28);

    // Latch/clasp on top
    ctx.fillStyle = '#5a6558';
    ctx.fillRect(-3, -14, 6, 5);

    // Metal corners
    ctx.fillStyle = '#4a5248';
    ctx.fillRect(-16, -14, 5, 5);
    ctx.fillRect(11, -14, 5, 5);
    ctx.fillRect(-16, 9, 5, 5);
    ctx.fillRect(11, 9, 5, 5);

    // Ammo icon
    ctx.fillStyle = '#6a7a55';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AMMO', 0, 2);

    return canvas;
  }

  private renderSandbag(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 40;
    const ctx = canvas.getContext('2d')!;

    ctx.translate(40, 20);

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;

    // Sandbag body
    ctx.fillStyle = '#4a4230';
    ctx.beginPath();
    ctx.moveTo(-30, -8);
    ctx.quadraticCurveTo(-32, 0, -28, 10);
    ctx.lineTo(28, 10);
    ctx.quadraticCurveTo(32, 0, 30, -8);
    ctx.closePath();
    ctx.fill();

    ctx.shadowColor = 'transparent';

    // Top highlight
    ctx.fillStyle = '#5a5238';
    ctx.beginPath();
    ctx.moveTo(-28, -8);
    ctx.quadraticCurveTo(0, -14, 28, -8);
    ctx.lineTo(25, -2);
    ctx.quadraticCurveTo(0, -8, -25, -2);
    ctx.closePath();
    ctx.fill();

    // Fabric texture lines
    ctx.strokeStyle = '#3a3828';
    ctx.lineWidth = 0.5;
    for (let i = -25; i < 25; i += 8) {
      ctx.beginPath();
      ctx.moveTo(i, -6);
      ctx.lineTo(i + 2, 8);
      ctx.stroke();
    }

    return canvas;
  }

  private renderWireFence(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 24;
    const ctx = canvas.getContext('2d')!;

    ctx.translate(40, 12);

    // Posts
    ctx.fillStyle = '#505868';
    ctx.fillRect(-35, -10, 4, 20);
    ctx.fillRect(-5, -10, 4, 20);
    ctx.fillRect(25, -10, 4, 20);

    // Wire lines
    ctx.strokeStyle = '#606878';
    ctx.lineWidth = 1;
    for (let i = -6; i <= 6; i += 4) {
      ctx.beginPath();
      ctx.moveTo(-35, i);
      ctx.lineTo(29, i);
      ctx.stroke();
    }

    // Barb marks
    ctx.fillStyle = '#808898';
    for (let x = -30; x < 28; x += 10) {
      ctx.fillRect(x, -3, 2, 2);
      ctx.fillRect(x + 5, 1, 2, 2);
    }

    return canvas;
  }

  private renderTerminal(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 40;
    const ctx = canvas.getContext('2d')!;

    ctx.translate(20, 20);

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;

    // Terminal body
    ctx.fillStyle = '#2a2e38';
    ctx.fillRect(-12, -14, 24, 28);

    ctx.shadowColor = 'transparent';

    // Screen
    ctx.fillStyle = '#0a1a15';
    ctx.fillRect(-9, -11, 18, 14);

    // Screen glow
    ctx.fillStyle = 'rgba(20, 180, 80, 0.15)';
    ctx.fillRect(-9, -11, 18, 14);

    // Scan lines on screen
    ctx.strokeStyle = 'rgba(30, 200, 80, 0.2)';
    ctx.lineWidth = 0.5;
    for (let y = -10; y < 3; y += 2) {
      ctx.beginPath();
      ctx.moveTo(-9, y);
      ctx.lineTo(9, y);
      ctx.stroke();
    }

    // LED indicator
    ctx.fillStyle = '#30cc50';
    ctx.beginPath();
    ctx.arc(-6, 8, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Buttons
    ctx.fillStyle = '#4a5060';
    ctx.fillRect(0, 6, 3, 3);
    ctx.fillRect(5, 6, 3, 3);

    return canvas;
  }

  private scatterProps() {
    const numProps = 900;
    const random = (() => {
      let seed = 98765;
      return () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      };
    })();

    const types: PropType[] = ['barrel', 'concrete_block', 'ammo_box', 'sandbag', 'wire_fence', 'computer_terminal'];
    const weights = [25, 20, 18, 18, 12, 7]; // weighted distribution
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    for (let i = 0; i < numProps; i++) {
      // Weighted random type
      let r = random() * totalWeight;
      let typeIdx = 0;
      for (let w = 0; w < weights.length; w++) {
        r -= weights[w];
        if (r <= 0) { typeIdx = w; break; }
      }

      this.props.push({
        x: random() * MAP_CONFIG.width,
        y: random() * MAP_CONFIG.height,
        type: types[typeIdx],
        scale: 0.8 + random() * 0.5,
        rotation: random() * Math.PI * 2,
      });
    }
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera, layer: 'ground' | 'above') {
    for (const prop of this.props) {
      // Wire fence and terminals render above entities, others below
      const isAbove = prop.type === 'wire_fence';
      if ((layer === 'above' && !isAbove) || (layer === 'ground' && isAbove)) {
        continue;
      }

      if (!camera.isVisible(prop.x, prop.y, 60)) continue;

      const [sx, sy] = camera.worldToScreen(prop.x, prop.y);
      const sprite = this.sprites.get(prop.type)!;

      EntityRenderer.drawSprite(
        ctx,
        prop.type,
        sx, sy,
        prop.rotation,
        prop.scale,
        1, // alpha
        0, // bob
        1, 1, // squash
        false, // flash
        sprite
      );
    }
  }
}
