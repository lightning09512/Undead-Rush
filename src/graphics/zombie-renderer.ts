// ─── Zombie Procedural 2.5D Volumetric Horror Renderer ───

import { Zombie } from '../entities/zombies';

export class ZombieRenderer {
  private static shadowCanvas: HTMLCanvasElement;

  private static initShadow(): void {
    if (this.shadowCanvas) return;
    this.shadowCanvas = document.createElement('canvas');
    this.shadowCanvas.width = 128;
    this.shadowCanvas.height = 64;
    const ctx = this.shadowCanvas.getContext('2d')!;

    const grad = ctx.createRadialGradient(64, 32, 0, 64, 32, 64);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
    grad.addColorStop(0.4, 'rgba(0, 0, 0, 0.4)');
    grad.addColorStop(0.8, 'rgba(0, 0, 0, 0.12)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 64);
  }

  static drawZombie(
    ctx: CanvasRenderingContext2D,
    z: Zombie,
    sx: number,
    sy: number,
    isFlashing: boolean
  ): void {
    if (!this.shadowCanvas) this.initShadow();

    const scale = z.isBoss ? 2.2 : z.typeId === 'tank' ? 1.5 : z.typeId === 'runner' ? 0.88 : z.isElite ? 1.18 : 1.0;
    const size = z.size * scale;

    // ─── 1. Volumetric Ground Ambient Shadow ───
    const shadowW = size * 2.5;
    const shadowH = size * 1.35;
    // Directional shadow shift away from player
    ctx.drawImage(this.shadowCanvas, sx - shadowW / 2 + Math.cos(z.facingAngle) * 4, sy - shadowH / 2 + 5, shadowW, shadowH);

    // ─── 2. Top-Down Rotated Entity Space ───
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(z.facingAngle);
    ctx.scale(scale, scale);

    // Dynamic shambling wobble
    const wobble = Math.sin(z.animTimer * 4.5 + z.wobble) * 0.055;
    ctx.rotate(wobble);

    // Render terrifying procedural archetype
    switch (z.typeId) {
      case 'runner':
        this.renderRunner(ctx, z, isFlashing);
        break;
      case 'tank':
        this.renderTank(ctx, z, isFlashing);
        break;
      case 'exploder':
        this.renderBoomer(ctx, z, isFlashing);
        break;
      case 'spitter':
        this.renderSpitter(ctx, z, isFlashing);
        break;
      case 'glowing':
        this.renderRadiant(ctx, z, isFlashing);
        break;
      default:
        if (z.isBoss) {
          this.renderBoss(ctx, z, isFlashing);
        } else {
          this.renderShambler(ctx, z, isFlashing);
        }
        break;
    }

    ctx.restore();
  }

  // ─── 1. SHAMBLER (Terrifying Rotting Zombie, Exposed Bones & Gaping Maw) ───
  private static renderShambler(ctx: CanvasRenderingContext2D, z: Zombie, flash: boolean): void {
    const sp = Math.hypot(z.vx, z.vy);
    const stride = sp > 5 ? Math.sin(z.walkDist * 1.8) * 6 : 0;
    const attack = z.attackAnim;
    const clawSwipe = Math.sin(z.attackTimer * 13) * (8 * attack);

    // Volumetric Feet (decayed muddy combat boots with treads)
    const footGradL = ctx.createLinearGradient(0, -11, 0, -4);
    footGradL.addColorStop(0, flash ? '#ffffff' : '#323f33');
    footGradL.addColorStop(1, flash ? '#ffffff' : '#141c15');
    ctx.fillStyle = footGradL;
    this.roundRect(ctx, -8 + stride, -11, 12, 6.5, 2.5); ctx.fill();

    const footGradR = ctx.createLinearGradient(0, 4, 0, 11);
    footGradR.addColorStop(0, flash ? '#ffffff' : '#323f33');
    footGradR.addColorStop(1, flash ? '#ffffff' : '#141c15');
    ctx.fillStyle = footGradR;
    this.roundRect(ctx, -8 - stride, 4.5, 12, 6.5, 2.5); ctx.fill();

    // ─── Torso: Rotting Decayed Flesh & Torn Rags with 3D Cylindrical Shading ───
    const bodyGrad = ctx.createLinearGradient(0, -14, 0, 14);
    bodyGrad.addColorStop(0, flash ? '#ffffff' : '#455e3e');
    bodyGrad.addColorStop(0.3, flash ? '#ffffff' : '#57774e');
    bodyGrad.addColorStop(0.8, flash ? '#ffffff' : '#364930');
    bodyGrad.addColorStop(1, flash ? '#ffffff' : '#22301f');

    ctx.fillStyle = bodyGrad;
    this.roundRect(ctx, -14, -13, 23, 26, 8); ctx.fill();

    // Dark Creases / Torn Clothing Fabric
    if (!flash) {
      ctx.strokeStyle = '#1b2418';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-11, -8); ctx.lineTo(-2, -5); ctx.lineTo(-12, 0);
      ctx.moveTo(-10, 6); ctx.lineTo(-1, 3);
      ctx.stroke();

      // Exposed Ribcage with Ivory Bones poking through
      ctx.fillStyle = '#4a1212'; // Wound cavity
      ctx.fillRect(-7, -4, 9, 8);
      ctx.fillStyle = '#e6ded1'; // Exposed Ribs
      for (let r = -3; r <= 3; r += 2.2) {
        ctx.fillRect(-6, r, 7, 1.2);
      }

      // Fresh & Coagulated Blood Splatter
      ctx.fillStyle = '#7a0e18';
      ctx.beginPath();
      ctx.arc(-8, -6, 2.2, 0, Math.PI * 2);
      ctx.arc(-2, 5, 2.8, 0, Math.PI * 2);
      ctx.arc(4, -8, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // ─── Arms: Muscular Rotten Tendons & Sharp Bony Talons ───
    const armL = 17 + (attack > 0 ? clawSwipe : stride * 0.45);
    const armR = 17 + (attack > 0 ? -clawSwipe : -stride * 0.45);

    // Left Arm (upper highlight, lower shadow)
    const armGrad = ctx.createLinearGradient(0, -12, 0, -4);
    armGrad.addColorStop(0, flash ? '#ffffff' : '#739967');
    armGrad.addColorStop(1, flash ? '#ffffff' : '#3a4f33');
    ctx.strokeStyle = armGrad;
    ctx.lineWidth = 4.8;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(-1, -10);
    ctx.lineTo(armL, -8 - attack * 3);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-1, 10);
    ctx.lineTo(armR, 8 + attack * 3);
    ctx.stroke();

    // Sharp Bony Claw Fingers
    ctx.fillStyle = flash ? '#ffffff' : '#d2dbc8';
    ctx.beginPath();
    // Claw talons left
    ctx.moveTo(armL, -10 - attack * 3);
    ctx.lineTo(armL + 5, -8 - attack * 3);
    ctx.lineTo(armL, -6 - attack * 3);
    // Claw talons right
    ctx.moveTo(armR, 6 + attack * 3);
    ctx.lineTo(armR + 5, 8 + attack * 3);
    ctx.lineTo(armR, 10 + attack * 3);
    ctx.fill();

    // Dripping Fresh Blood on Claw Tips
    if (!flash) {
      ctx.fillStyle = '#b30d1d';
      ctx.beginPath();
      ctx.arc(armL + 4.5, -8 - attack * 3, 1.6, 0, Math.PI * 2);
      ctx.arc(armR + 4.5, 8 + attack * 3, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // ─── Head: Rotting Skull with 3D Spherical Lighting ───
    const headGrad = ctx.createRadialGradient(2, -2, 1, 2, 0, 9);
    headGrad.addColorStop(0, flash ? '#ffffff' : '#9bbd8f');
    headGrad.addColorStop(0.6, flash ? '#ffffff' : '#719465');
    headGrad.addColorStop(1, flash ? '#ffffff' : '#3d5236');

    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(3, 0, 8.8, 0, Math.PI * 2);
    ctx.fill();

    if (!flash) {
      // Gaping Dark Mouth with Jagged Teeth
      ctx.fillStyle = '#140507';
      ctx.beginPath();
      ctx.ellipse(8, 0, 3.5, 4.2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Sharp Yellow Teeth
      ctx.fillStyle = '#f0e3be';
      ctx.fillRect(8.5, -3, 1.4, 1.8);
      ctx.fillRect(8.5, 1.2, 1.4, 1.8);
      ctx.fillRect(6.5, -2, 1.2, 1.5);
      ctx.fillRect(6.5, 0.5, 1.2, 1.5);

      // Deep Sunken Eye Sockets
      ctx.fillStyle = '#0c120a';
      ctx.beginPath();
      ctx.arc(6, -3.2, 2.5, 0, Math.PI * 2);
      ctx.arc(6, 3.2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Emissive Glowing Crimson Eyes
    ctx.save();
    ctx.shadowColor = '#ff1122';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ff2233';
    ctx.beginPath();
    ctx.arc(6.5, -3.2, 1.6, 0, Math.PI * 2);
    ctx.arc(6.5, 3.2, 1.6, 0, Math.PI * 2);
    ctx.fill();
    // Inner fiery pupil
    ctx.fillStyle = '#ffdd66';
    ctx.beginPath();
    ctx.arc(7, -3.2, 0.8, 0, Math.PI * 2);
    ctx.arc(7, 3.2, 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Pulsating Glowing Virus Pustules
    if (!flash) {
      const boilGlow = 0.65 + Math.sin(z.animTimer * 5) * 0.3;
      ctx.save();
      ctx.shadowColor = '#76ff03';
      ctx.shadowBlur = 6;
      ctx.fillStyle = `rgba(130, 255, 30, ${boilGlow})`;
      ctx.beginPath();
      ctx.arc(-8, 6, 2.8, 0, Math.PI * 2);
      ctx.arc(-4, -8, 2.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ─── 2. RUNNER (Sinewy, Emaciated Predator, Gaping Maw, Razor Talons) ───
  private static renderRunner(ctx: CanvasRenderingContext2D, z: Zombie, flash: boolean): void {
    const sp = Math.hypot(z.vx, z.vy);
    const stride = sp > 5 ? Math.sin(z.walkDist * 2.8) * 8.5 : 0;
    const attack = z.attackAnim;
    const clawSwipe = Math.sin(z.attackTimer * 18) * (10 * attack);

    // Scissor Legs (lean, predatory)
    ctx.fillStyle = flash ? '#ffffff' : '#38280f';
    this.roundRect(ctx, -9 + stride, -9, 14, 5, 2); ctx.fill();
    this.roundRect(ctx, -9 - stride, 4, 14, 5, 2); ctx.fill();

    // Emaciated Hunched Body with 3D Spine & Tendon shading
    const bodyGrad = ctx.createLinearGradient(0, -11, 0, 11);
    bodyGrad.addColorStop(0, flash ? '#ffffff' : '#946618');
    bodyGrad.addColorStop(0.5, flash ? '#ffffff' : '#b88228');
    bodyGrad.addColorStop(1, flash ? '#ffffff' : '#573a0a');

    ctx.fillStyle = bodyGrad;
    this.roundRect(ctx, -15, -10, 21, 20, 6); ctx.fill();

    // Protruding Vertebrae / Spine Ridges
    if (!flash) {
      ctx.fillStyle = '#e6ded1';
      for (let i = -12; i <= 2; i += 3.8) {
        ctx.fillRect(i, -1.2, 2.2, 2.4);
      }
      // Bloody claw marks across back
      ctx.strokeStyle = '#850e18';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-10, -7); ctx.lineTo(-2, -3);
      ctx.moveTo(-8, 6); ctx.lineTo(0, 2);
      ctx.stroke();
    }

    // Feral Elongated Arms
    const armL = 20 + (attack > 0 ? clawSwipe : stride * 0.5);
    const armR = 20 + (attack > 0 ? -clawSwipe : -stride * 0.5);

    ctx.strokeStyle = flash ? '#ffffff' : '#c48f2b';
    ctx.lineWidth = 3.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-2, -8); ctx.lineTo(armL, -6 - attack * 3.5);
    ctx.moveTo(-2, 8); ctx.lineTo(armR, 6 + attack * 3.5);
    ctx.stroke();

    // Razor-sharp curved talons
    ctx.fillStyle = flash ? '#ffffff' : '#e6ded1';
    ctx.beginPath();
    ctx.arc(armL + 2.5, -6 - attack * 3.5, 2.5, 0, Math.PI * 2);
    ctx.arc(armR + 2.5, 6 + attack * 3.5, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Blood tips
    if (!flash) {
      ctx.fillStyle = '#ff1122';
      ctx.beginPath();
      ctx.arc(armL + 4, -6 - attack * 3.5, 1.6, 0, Math.PI * 2);
      ctx.arc(armR + 4, 6 + attack * 3.5, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hunched Skull with Gaping Predatory Jaw
    const headGrad = ctx.createRadialGradient(3, -1, 1, 3, 0, 8);
    headGrad.addColorStop(0, flash ? '#ffffff' : '#d49d33');
    headGrad.addColorStop(1, flash ? '#ffffff' : '#734e10');
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.ellipse(3.5, 0, 8, 6.8, 0, 0, Math.PI * 2);
    ctx.fill();

    if (!flash) {
      // Snarling Jaw
      ctx.fillStyle = '#1c0507';
      ctx.beginPath();
      ctx.ellipse(8, 0, 2.8, 3.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(8.5, -2, 1.2, 1.4);
      ctx.fillRect(8.5, 0.8, 1.2, 1.4);
    }

    // Predatory Glowing Amber Eyes
    ctx.save();
    ctx.shadowColor = '#ffbb00';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffbb00';
    ctx.beginPath();
    ctx.arc(8, -2.8, 1.8, 0, Math.PI * 2);
    ctx.arc(8, 2.8, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ─── 3. BRUTE / TANK (Volcanic Armored Carapace, Magma Fissures, Heavy Stompers) ───
  private static renderTank(ctx: CanvasRenderingContext2D, z: Zombie, flash: boolean): void {
    const sp = Math.hypot(z.vx, z.vy);
    const stride = sp > 5 ? Math.sin(z.walkDist * 1.2) * 5.5 : 0;
    const attack = z.attackAnim;
    const slam = Math.sin(z.attackTimer * 9) * (9 * attack);

    // Heavy iron-reinforced combat treads
    ctx.fillStyle = flash ? '#ffffff' : '#17141f';
    this.roundRect(ctx, -11 + stride, -15, 17, 9.5, 3.5); ctx.fill();
    this.roundRect(ctx, -11 - stride, 5.5, 17, 9.5, 3.5); ctx.fill();

    // Massive Muscular Torso with Basalt Carapace Shading
    const bodyGrad = ctx.createLinearGradient(0, -18, 0, 18);
    bodyGrad.addColorStop(0, flash ? '#ffffff' : '#3f2142');
    bodyGrad.addColorStop(0.5, flash ? '#ffffff' : '#572d5c');
    bodyGrad.addColorStop(1, flash ? '#ffffff' : '#261229');

    ctx.fillStyle = bodyGrad;
    this.roundRect(ctx, -17, -18, 30, 36, 11); ctx.fill();

    // Volcanic Magma Cracks on Spine
    if (!flash) {
      ctx.save();
      ctx.shadowColor = '#ff6600';
      ctx.shadowBlur = 7;
      ctx.strokeStyle = '#ff7700';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-13, 0); ctx.lineTo(-4, -4); ctx.lineTo(2, 0); ctx.lineTo(8, -3);
      ctx.moveTo(-8, 0); ctx.lineTo(-1, 5); ctx.lineTo(5, 2);
      ctx.stroke();
      ctx.restore();
    }

    // Heavy Sledgehammer Arms
    const fistL = 22 + (attack > 0 ? slam : stride * 0.35);
    const fistR = 22 + (attack > 0 ? -slam : -stride * 0.35);

    ctx.strokeStyle = flash ? '#ffffff' : '#632e69';
    ctx.lineWidth = 8.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-4, -14); ctx.lineTo(fistL, -10);
    ctx.moveTo(-4, 14); ctx.lineTo(fistR, 10);
    ctx.stroke();

    // Massive Spiked Armored Knuckle Plates
    ctx.fillStyle = flash ? '#ffffff' : '#2b122e';
    ctx.beginPath();
    ctx.arc(fistL + 2, -10, 6, 0, Math.PI * 2);
    ctx.arc(fistR + 2, 10, 6, 0, Math.PI * 2);
    ctx.fill();

    // Knuckle Spikes
    if (!flash) {
      ctx.fillStyle = '#ff8800';
      ctx.beginPath();
      ctx.moveTo(fistL + 6, -12); ctx.lineTo(fistL + 11, -10); ctx.lineTo(fistL + 6, -8);
      ctx.moveTo(fistR + 6, 8); ctx.lineTo(fistR + 11, 10); ctx.lineTo(fistR + 6, 12);
      ctx.fill();
    }

    // Heavy Armored Skull with Protruding Tusks
    const headGrad = ctx.createRadialGradient(6, -2, 1, 6, 0, 11);
    headGrad.addColorStop(0, flash ? '#ffffff' : '#6b3670');
    headGrad.addColorStop(1, flash ? '#ffffff' : '#2e1430');
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(6.5, 0, 11, 0, Math.PI * 2);
    ctx.fill();

    // Brutal Tusks & Glowing Magma Eyes
    if (!flash) {
      ctx.fillStyle = '#e6ded1';
      ctx.beginPath();
      ctx.moveTo(13, -6); ctx.lineTo(19, -8); ctx.lineTo(15, -4);
      ctx.moveTo(13, 6); ctx.lineTo(19, 8); ctx.lineTo(15, 4);
      ctx.fill();
    }

    ctx.save();
    ctx.shadowColor = '#ff6600';
    ctx.shadowBlur = 9;
    ctx.fillStyle = '#ff7700';
    ctx.beginPath();
    ctx.arc(13, -4.2, 2.4, 0, Math.PI * 2);
    ctx.arc(13, 4.2, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ─── 4. BOOMER (Translucent Necrotic Belly, Sloshing Acid Bile, Oozing Blisters) ───
  private static renderBoomer(ctx: CanvasRenderingContext2D, z: Zombie, flash: boolean): void {
    const sp = Math.hypot(z.vx, z.vy);
    const waddle = sp > 5 ? Math.sin(z.walkDist * 1.5) * 5 : 0;
    const pulse = 1 + Math.sin(z.animTimer * 6) * 0.08;

    // Swollen deformed feet
    ctx.fillStyle = flash ? '#ffffff' : '#2e1511';
    this.roundRect(ctx, -8 + waddle, -12.5, 12, 7.5, 3); ctx.fill();
    this.roundRect(ctx, -8 - waddle, 5, 12, 7.5, 3); ctx.fill();

    ctx.save();
    ctx.scale(pulse, pulse);

    // Stretched necrotic skin with volumetric sphere gradient
    const bellyGrad = ctx.createRadialGradient(-2, -3, 2, 0, 0, 18);
    bellyGrad.addColorStop(0, flash ? '#ffffff' : '#ad3d2f');
    bellyGrad.addColorStop(0.7, flash ? '#ffffff' : '#82281c');
    bellyGrad.addColorStop(1, flash ? '#ffffff' : '#451009');

    ctx.fillStyle = bellyGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 17.5, 0, Math.PI * 2);
    ctx.fill();

    // Translucent Glowing Acid Bile Core sloshing inside
    if (!flash) {
      const coreGrad = ctx.createRadialGradient(2, 0, 1, 2, 0, 13);
      coreGrad.addColorStop(0, 'rgba(255, 235, 60, 0.95)');
      coreGrad.addColorStop(0.5, 'rgba(255, 120, 20, 0.85)');
      coreGrad.addColorStop(1, 'rgba(180, 30, 10, 0)');

      ctx.save();
      ctx.shadowColor = '#ff6600';
      ctx.shadowBlur = 10;
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(2, 0, 13.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Sloshing Bubbles
      ctx.fillStyle = 'rgba(255, 255, 150, 0.8)';
      ctx.beginPath();
      ctx.arc(-2, -4, 2, 0, Math.PI * 2);
      ctx.arc(4, 5, 2.4, 0, Math.PI * 2);
      ctx.arc(6, -2, 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Oozing Pustules on skin surface
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(-9, -9, 4, 0, Math.PI * 2);
      ctx.arc(-7, 10, 3.8, 0, Math.PI * 2);
      ctx.arc(-12, 1, 3.5, 0, Math.PI * 2);
      ctx.fill();
      // Pus heads
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-9, -9, 1.5, 0, Math.PI * 2);
      ctx.arc(-7, 10, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Bloated Straining Arms
    ctx.strokeStyle = flash ? '#ffffff' : '#ab3d2e';
    ctx.lineWidth = 4.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(2, -12); ctx.lineTo(16 + waddle * 0.4, -13);
    ctx.moveTo(2, 12); ctx.lineTo(16 - waddle * 0.4, 13);
    ctx.stroke();

    // Drooling Grotesque Head sunken into neck
    const headGrad = ctx.createRadialGradient(8, -1, 1, 8, 0, 8);
    headGrad.addColorStop(0, flash ? '#ffffff' : '#b84637');
    headGrad.addColorStop(1, flash ? '#ffffff' : '#571810');
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(8.5, 0, 7.8, 0, Math.PI * 2);
    ctx.fill();

    if (!flash) {
      // Drooling open maw
      ctx.fillStyle = '#1c0507';
      ctx.beginPath();
      ctx.ellipse(13, 0, 2.5, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sickly Yellow Acid Eyes
    ctx.save();
    ctx.shadowColor = '#ffee00';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#ffee22';
    ctx.beginPath();
    ctx.arc(12.5, -2.6, 1.8, 0, Math.PI * 2);
    ctx.arc(12.5, 2.6, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ─── 5. SPITTER (Acid Glands, Corroded Maw, Dripping Venom) ───
  private static renderSpitter(ctx: CanvasRenderingContext2D, z: Zombie, flash: boolean): void {
    const sp = Math.hypot(z.vx, z.vy);
    const stride = sp > 5 ? Math.sin(z.walkDist * 2.0) * 6 : 0;

    // Slender clawed feet
    ctx.fillStyle = flash ? '#ffffff' : '#162e1e';
    this.roundRect(ctx, -8 + stride, -8.5, 12, 5, 2); ctx.fill();
    this.roundRect(ctx, -8 - stride, 3.5, 12, 5, 2); ctx.fill();

    // Narrow reptilian body with 3D gradient
    const bodyGrad = ctx.createLinearGradient(0, -10, 0, 10);
    bodyGrad.addColorStop(0, flash ? '#ffffff' : '#2c6340');
    bodyGrad.addColorStop(0.5, flash ? '#ffffff' : '#3d8757');
    bodyGrad.addColorStop(1, flash ? '#ffffff' : '#1a4027');

    ctx.fillStyle = bodyGrad;
    this.roundRect(ctx, -14, -9.5, 21, 19, 5); ctx.fill();

    // Glowing Venom Gland on spine (pulsating acid green)
    if (!flash) {
      const glandGlow = 0.7 + Math.sin(z.animTimer * 7) * 0.25;
      ctx.save();
      ctx.shadowColor = '#00ff66';
      ctx.shadowBlur = 8;
      ctx.fillStyle = `rgba(0, 255, 100, ${glandGlow})`;
      ctx.beginPath();
      ctx.ellipse(-4, 0, 7.5, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Arms
    ctx.strokeStyle = flash ? '#ffffff' : '#3d8255';
    ctx.lineWidth = 3.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(15, -6);
    ctx.moveTo(0, 8); ctx.lineTo(15, 6);
    ctx.stroke();

    // Acid-Corroded Beak / Maw
    ctx.fillStyle = flash ? '#ffffff' : '#2e6642';
    ctx.beginPath();
    ctx.moveTo(3, -6.5);
    ctx.lineTo(16, 0);
    ctx.lineTo(3, 6.5);
    ctx.closePath();
    ctx.fill();

    // Dripping Acid Venom droplets
    if (!flash) {
      ctx.save();
      ctx.shadowColor = '#39ff14';
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#39ff14';
      ctx.beginPath();
      ctx.arc(18, 0, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Glowing Toxic Emerald Eyes
    ctx.save();
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 7;
    ctx.fillStyle = '#26ff7b';
    ctx.beginPath();
    ctx.arc(8, -3.2, 1.8, 0, Math.PI * 2);
    ctx.arc(8, 3.2, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ─── 6. RADIANT (Nuclear Golden Mutant, Arcing Electricity) ───
  private static renderRadiant(ctx: CanvasRenderingContext2D, z: Zombie, flash: boolean): void {
    const sp = Math.hypot(z.vx, z.vy);
    const stride = sp > 5 ? Math.sin(z.walkDist * 2.0) * 6 : 0;
    const attack = z.attackAnim;

    // Glowing radioactive halo
    const auraPulse = 0.55 + Math.sin(z.animTimer * 8) * 0.25;
    ctx.save();
    ctx.strokeStyle = `rgba(255, 235, 50, ${auraPulse})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = '#ffe600';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Golden boots
    ctx.fillStyle = flash ? '#ffffff' : '#6b5e1b';
    this.roundRect(ctx, -7 + stride, -9, 12, 6, 2.5); ctx.fill();
    this.roundRect(ctx, -7 - stride, 3, 12, 6, 2.5); ctx.fill();

    // Golden Crystalline Torso
    const bodyGrad = ctx.createLinearGradient(0, -11, 0, 11);
    bodyGrad.addColorStop(0, flash ? '#ffffff' : '#e6be3e');
    bodyGrad.addColorStop(0.5, flash ? '#ffffff' : '#ffe66d');
    bodyGrad.addColorStop(1, flash ? '#ffffff' : '#a88219');
    ctx.fillStyle = bodyGrad;
    this.roundRect(ctx, -13, -11, 21, 22, 6); ctx.fill();

    // Crackling nuclear lightning veins
    if (!flash) {
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 5;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-10, -5); ctx.lineTo(-4, 0); ctx.lineTo(-8, 5);
      ctx.stroke();
      ctx.restore();
    }

    // Golden Claws
    const armReach = 18 + (attack > 0 ? Math.sin(z.attackTimer * 14) * 8 : stride * 0.4);
    ctx.strokeStyle = flash ? '#ffffff' : '#e6c84c';
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(armReach, -7);
    ctx.moveTo(0, 9); ctx.lineTo(armReach, 7);
    ctx.stroke();

    ctx.fillStyle = flash ? '#ffffff' : '#fff580';
    ctx.beginPath();
    ctx.arc(armReach + 1.5, -7, 2.5, 0, Math.PI * 2);
    ctx.arc(armReach + 1.5, 7, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Glowing Golden Head
    ctx.fillStyle = flash ? '#ffffff' : '#fad02c';
    ctx.beginPath();
    ctx.arc(2, 0, 8.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffff55';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(7, -3, 2.2, 0, Math.PI * 2);
    ctx.arc(7, 3, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ─── 7. BOSS (Demonic Warlord, Horned Skull Helm, Giant Scythe Talons) ───
  private static renderBoss(ctx: CanvasRenderingContext2D, z: Zombie, flash: boolean): void {
    const sp = Math.hypot(z.vx, z.vy);
    const stride = sp > 5 ? Math.sin(z.walkDist * 1.0) * 4.5 : 0;
    const attack = z.attackAnim;
    const clawSwipe = Math.sin(z.attackTimer * 10) * (9 * attack);

    // Demonic Boss Pulse Aura
    const bossPulse = 0.65 + Math.sin(z.animTimer * 6) * 0.25;
    ctx.save();
    ctx.strokeStyle = `rgba(220, 20, 60, ${bossPulse})`;
    ctx.lineWidth = 4.5;
    ctx.shadowColor = '#ff0033';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(0, 0, 23, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Spiked gothic armored sabatons
    ctx.fillStyle = flash ? '#ffffff' : '#140c14';
    this.roundRect(ctx, -12 + stride, -16, 18, 10, 4); ctx.fill();
    this.roundRect(ctx, -12 - stride, 6, 18, 10, 4); ctx.fill();

    // Massive armored warlord body
    const bodyGrad = ctx.createLinearGradient(0, -18, 0, 18);
    bodyGrad.addColorStop(0, flash ? '#ffffff' : '#38162e');
    bodyGrad.addColorStop(0.5, flash ? '#ffffff' : '#571e46');
    bodyGrad.addColorStop(1, flash ? '#ffffff' : '#1f0919');

    ctx.fillStyle = bodyGrad;
    this.roundRect(ctx, -18, -18, 32, 36, 11); ctx.fill();

    // Gothic Pauldrons & Spikes
    if (!flash) {
      ctx.fillStyle = '#611749';
      this.roundRect(ctx, -14, -22, 16, 12, 4); ctx.fill();
      this.roundRect(ctx, -14, 10, 16, 12, 4); ctx.fill();

      // Sharp Pauldron Spikes
      ctx.fillStyle = '#e64060';
      ctx.beginPath();
      ctx.moveTo(-10, -22); ctx.lineTo(-6, -28); ctx.lineTo(-2, -22);
      ctx.moveTo(-10, 22); ctx.lineTo(-6, 28); ctx.lineTo(-2, 22);
      ctx.fill();
    }

    // Huge Demonic Scythe Claws
    const clawL = 25 + (attack > 0 ? clawSwipe : stride * 0.4);
    const clawR = 25 + (attack > 0 ? -clawSwipe : -stride * 0.4);

    ctx.strokeStyle = flash ? '#ffffff' : '#7d1e51';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-4, -14); ctx.lineTo(clawL, -11 - attack * 3);
    ctx.moveTo(-4, 14); ctx.lineTo(clawR, 11 + attack * 3);
    ctx.stroke();

    // Razor-sharp Scythe Blades
    ctx.fillStyle = flash ? '#ffffff' : '#ff1e42';
    ctx.beginPath();
    ctx.moveTo(clawL, -17);
    ctx.lineTo(clawL + 11, -11 - attack * 3);
    ctx.lineTo(clawL, -5);
    ctx.moveTo(clawR, 5);
    ctx.lineTo(clawR + 11, 11 + attack * 3);
    ctx.lineTo(clawR, 17);
    ctx.fill();

    // Horned Skull
    const headGrad = ctx.createRadialGradient(8, -2, 1, 8, 0, 12);
    headGrad.addColorStop(0, flash ? '#ffffff' : '#631d47');
    headGrad.addColorStop(1, flash ? '#ffffff' : '#2b0b1e');
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(8, 0, 12, 0, Math.PI * 2);
    ctx.fill();

    // Demonic Horns
    if (!flash) {
      ctx.fillStyle = '#ffb300';
      ctx.beginPath();
      ctx.moveTo(5, -10); ctx.lineTo(14, -20); ctx.lineTo(10, -8);
      ctx.moveTo(5, 10); ctx.lineTo(14, 20); ctx.lineTo(10, 8);
      ctx.fill();
    }

    // Blazing Demonic Red Eyes
    ctx.save();
    ctx.fillStyle = '#ff0033';
    ctx.shadowColor = '#ff0044';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(15, -4.5, 2.8, 0, Math.PI * 2);
    ctx.arc(15, 4.5, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private static roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
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
  }
}
