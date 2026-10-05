import { Camera } from '../core/camera';
import { MAP_CONFIG } from '../data/items';
import { EntityRenderer } from './entity-renderer';
import { SOLID_BUILDINGS } from '../entities/map-geometry';
import type { GameLanguage } from '../data/localization';

type PropType = 'barrel' | 'concrete_block' | 'ammo_box' | 'sandbag' | 'wire_fence' | 'computer_terminal' | 'warehouse' | 'ruin';

interface Prop {
  x: number;
  y: number;
  type: PropType;
  scale: number;
  rotation: number;
  large?: boolean;
}

export class PropRenderer {
  private props: Prop[] = [];
  private sprites = new Map<PropType, HTMLCanvasElement>();
  private largeWarehouseFloor: HTMLCanvasElement;
  private largeWarehouseWalls: HTMLCanvasElement;
  private language: GameLanguage = 'vi';

  constructor() {
    this.generateSprites();
    this.largeWarehouseFloor = this.renderLargeWarehouseFloor();
    this.largeWarehouseWalls = this.renderLargeWarehouseWalls();
    this.scatterProps();
  }

  private generateSprites() {
    this.sprites.set('barrel', this.renderBarrel());
    this.sprites.set('concrete_block', this.renderConcreteBlock());
    this.sprites.set('ammo_box', this.renderAmmoBox(this.language));
    this.sprites.set('sandbag', this.renderSandbag());
    this.sprites.set('wire_fence', this.renderWireFence());
    this.sprites.set('computer_terminal', this.renderTerminal());
    this.sprites.set('warehouse', this.renderWarehouse());
    this.sprites.set('ruin', this.renderRuin());
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

  private renderAmmoBox(language: GameLanguage): HTMLCanvasElement {
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
    ctx.fillText(language === 'en' ? 'Ammo' : 'Đạn', 0, 2);

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

  private renderWarehouse(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d')!;
    ctx.translate(160, 120);

    // Broad, offset shadow gives the building weight against the tiled floor.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.moveTo(-132, -82); ctx.lineTo(104, -82); ctx.lineTo(140, -48);
    ctx.lineTo(140, 82); ctx.lineTo(-104, 82); ctx.lineTo(-140, 48); ctx.closePath();
    ctx.fill();

    // Concrete foundation and battered outer walls.
    ctx.fillStyle = '#343943';
    ctx.fillRect(-136, -92, 272, 184);
    ctx.fillStyle = '#555b62';
    ctx.fillRect(-128, -84, 256, 168);
    ctx.fillStyle = '#252a32';
    ctx.fillRect(-110, -66, 220, 132);

    // Ribbed metal roof, broken into panels for a readable top-down silhouette.
    ctx.fillStyle = '#414953';
    ctx.fillRect(-104, -60, 208, 120);
    ctx.fillStyle = '#505964';
    for (let x = -96; x <= 96; x += 24) ctx.fillRect(x, -56, 5, 112);
    ctx.strokeStyle = 'rgba(15,18,24,0.7)';
    ctx.lineWidth = 3;
    ctx.strokeRect(-104, -60, 208, 120);
    ctx.beginPath(); ctx.moveTo(-100, 0); ctx.lineTo(100, 0); ctx.stroke();

    // Loading bay, warning paint, rooftop vents, and a damaged corner.
    ctx.fillStyle = '#242a31';
    ctx.fillRect(-34, 60, 68, 24);
    ctx.fillStyle = '#c39a3d';
    for (let x = -28; x <= 24; x += 14) {
      ctx.beginPath(); ctx.moveTo(x, 61); ctx.lineTo(x + 8, 61); ctx.lineTo(x, 70); ctx.lineTo(x - 8, 70); ctx.fill();
    }
    ctx.fillStyle = '#272d35';
    ctx.fillRect(-82, -38, 30, 24); ctx.fillRect(52, 20, 34, 26);
    ctx.fillStyle = '#68717a';
    ctx.fillRect(-78, -34, 22, 16); ctx.fillRect(56, 24, 26, 18);
    ctx.fillStyle = '#8a302d';
    ctx.fillRect(90, -58, 14, 20);
    ctx.fillStyle = '#a38b50';
    ctx.fillRect(-126, -78, 15, 8); ctx.fillRect(111, 70, 14, 8);
    return canvas;
  }

  private renderLargeWarehouseFloor(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d')!;
    ctx.translate(160, 120);
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(-148, -104, 300, 220);
    ctx.fillStyle = '#343943';
    ctx.fillRect(-144, -100, 288, 200);
    ctx.fillStyle = '#77766e';
    ctx.fillRect(-136, -92, 272, 184);
    ctx.fillStyle = '#555a5b';
    ctx.fillRect(-124, -80, 248, 160);
    ctx.strokeStyle = 'rgba(28,33,38,0.52)';
    ctx.lineWidth = 2;
    for (let x = -104; x <= 104; x += 32) {
      ctx.beginPath(); ctx.moveTo(x, -78); ctx.lineTo(x, 78); ctx.stroke();
    }
    for (let y = -64; y <= 64; y += 32) {
      ctx.beginPath(); ctx.moveTo(-122, y); ctx.lineTo(122, y); ctx.stroke();
    }
    // Faded hazard markings and a loading lane give the open interior scale.
    ctx.fillStyle = 'rgba(194,153,66,0.62)';
    ctx.fillRect(-45, 48, 90, 4);
    ctx.fillRect(-45, 72, 90, 4);
    for (let x = -38; x <= 30; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 49); ctx.lineTo(x + 11, 49); ctx.lineTo(x, 75); ctx.lineTo(x - 11, 75); ctx.fill();
    }
    ctx.fillStyle = 'rgba(35,46,47,0.75)';
    ctx.fillRect(-110, -68, 24, 20);
    ctx.fillRect(88, -44, 24, 20);
    ctx.fillStyle = '#849077';
    ctx.fillRect(-106, -64, 16, 12);
    ctx.fillRect(92, -40, 16, 12);
    return canvas;
  }

  private renderLargeWarehouseWalls(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d')!;
    ctx.translate(160, 120);

    // Transparent center keeps the player visible while the raised walls overlap them.
    ctx.fillStyle = '#292e35';
    ctx.fillRect(-144, -100, 288, 16);
    ctx.fillRect(-144, -84, 16, 168);
    ctx.fillRect(128, -84, 16, 168);
    ctx.fillRect(-144, 84, 102, 16);
    ctx.fillRect(42, 84, 102, 16);

    ctx.fillStyle = '#686d70';
    ctx.fillRect(-136, -96, 272, 8);
    ctx.fillRect(-136, -84, 8, 168);
    ctx.fillRect(128, -84, 8, 168);
    ctx.fillRect(-136, 84, 94, 8);
    ctx.fillRect(42, 84, 94, 8);

    // Door frame and hazard stripes mark the walkable opening.
    ctx.fillStyle = '#c39a3d';
    ctx.fillRect(-40, 84, 8, 16);
    ctx.fillRect(32, 84, 8, 16);
    ctx.strokeStyle = '#252a30';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-40, 84); ctx.lineTo(-40, 70); ctx.lineTo(40, 70); ctx.lineTo(40, 84); ctx.stroke();

    // Structural columns make the perimeter read as walls instead of a flat outline.
    ctx.fillStyle = '#85847b';
    for (const [x, y] of [[-136, -84], [128, -84], [-136, 68], [128, 68], [-16, -96], [40, -96]] as number[][]) {
      ctx.fillRect(x, y, 8, 16);
    }
    return canvas;
  }

  private renderRuin(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 250;
    canvas.height = 190;
    const ctx = canvas.getContext('2d')!;
    ctx.translate(125, 95);

    ctx.fillStyle = 'rgba(0,0,0,0.48)';
    ctx.fillRect(-104, -60, 220, 136);
    ctx.fillStyle = '#343840';
    ctx.fillRect(-112, -70, 218, 132);
    ctx.fillStyle = '#54585b';
    ctx.fillRect(-106, -66, 204, 120);
    ctx.fillStyle = '#252a30';
    ctx.fillRect(-68, -36, 142, 72);

    // Broken wall sections leave a clear, recognizable ruined footprint.
    ctx.fillStyle = '#62615b';
    ctx.fillRect(-104, -62, 204, 20);
    ctx.fillRect(-104, -44, 22, 72);
    ctx.fillRect(78, -42, 22, 94);
    ctx.fillRect(-88, 34, 106, 18);
    ctx.fillStyle = '#3e4449';
    ctx.fillRect(-84, -57, 30, 10);
    ctx.fillRect(36, 39, 36, 8);

    ctx.strokeStyle = '#30343a';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-70, -20); ctx.lineTo(-24, 22); ctx.lineTo(18, -8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(30, -30); ctx.lineTo(64, 6); ctx.stroke();
    ctx.fillStyle = '#887c61';
    for (const [x, y, r] of [[-40, 39, 7], [52, -18, 9], [6, 29, 6], [-92, 9, 5]] as number[][]) {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    return canvas;
  }

  private scatterProps() {
    // Fixed landmarks make the survival map feel like a place with recognizable routes.
    // Keep the starting area clear so the first moments remain readable.
    for (const building of SOLID_BUILDINGS) {
      this.props.push({ x: building.x, y: building.y, type: building.kind, scale: 1, rotation: building.rotation, large: building.large });
    }

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

  draw(ctx: CanvasRenderingContext2D, camera: Camera, layer: 'ground' | 'above', includeLandmarks = true, language: GameLanguage = 'vi') {
    if (language !== this.language) {
      this.language = language;
      this.sprites.set('ammo_box', this.renderAmmoBox(language));
    }
    for (const prop of this.props) {
      if (!includeLandmarks && (prop.type === 'warehouse' || prop.type === 'ruin')) continue;
      if (prop.large) {
        if (!camera.isVisible(prop.x, prop.y, 520)) continue;
        const [sx, sy] = camera.worldToScreen(prop.x, prop.y);
        const sprite = layer === 'ground' ? this.largeWarehouseFloor : this.largeWarehouseWalls;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.drawImage(sprite, -480, -360, 960, 720);
        ctx.restore();
        continue;
      }
      // Wire fence and terminals render above entities, others below
      const isAbove = prop.type === 'wire_fence' || prop.type === 'warehouse' || prop.type === 'ruin';
      if ((layer === 'above' && !isAbove) || (layer === 'ground' && isAbove)) {
        continue;
      }

      const visibilityPadding = prop.type === 'warehouse' ? 180 : prop.type === 'ruin' ? 140 : 60;
      if (!camera.isVisible(prop.x, prop.y, visibilityPadding)) continue;

      const [sx, sy] = camera.worldToScreen(prop.x, prop.y);
      const sprite = this.sprites.get(prop.type)!;

      if (prop.type === 'warehouse' || prop.type === 'ruin') {
        // Buildings have their own large world-sized sprites, unlike small prop billboards.
        const width = prop.type === 'warehouse' ? 320 : 250;
        const height = prop.type === 'warehouse' ? 240 : 190;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(prop.rotation);
        ctx.drawImage(sprite, -width / 2, -height / 2, width, height);
        ctx.restore();
        continue;
      }

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
