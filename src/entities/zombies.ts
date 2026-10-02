// ─── Zombie Entity ───

import { Pool } from '../core/pool';
import { Camera } from '../core/camera';
import { ZombieTypeDef } from '../data/zombies';
import { AssetManager, SpriteId } from '../graphics/sprites';

let nextZombieId = 1;

export interface Zombie {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  xpValue: number;
  typeId: string;
  // Status
  flashTimer: number;
  burnTimer: number;
  burnDamage: number;
  slowTimer: number;
  slowMult: number;
  // Flags
  isBoss: boolean;
  isGlowing: boolean;
  explodes: boolean;
  explosionRadius: number;
  explosionDamage: number;
  ranged: boolean;
  attackRange: number;
  projectileSpeed: number;
  attackCooldown: number;
  // Animation
  wobble: number;
  animTimer: number;
}

function createZombie(): Zombie {
  return {
    id: 0, x: 0, y: 0, size: 14, color: '#5a8a3c',
    hp: 30, maxHp: 30, speed: 60, damage: 10, xpValue: 5,
    typeId: 'normal',
    flashTimer: 0, burnTimer: 0, burnDamage: 0,
    slowTimer: 0, slowMult: 1,
    isBoss: false, isGlowing: false,
    explodes: false, explosionRadius: 0, explosionDamage: 0,
    ranged: false, attackRange: 0, projectileSpeed: 0, attackCooldown: 0,
    wobble: 0,
    animTimer: 0,
  };
}

function resetZombie(z: Zombie): void {
  z.hp = 0;
  z.flashTimer = 0;
  z.burnTimer = 0;
  z.slowTimer = 0;
  z.slowMult = 1;
  z.attackCooldown = 0;
  z.wobble = 0;
  z.animTimer = Math.random() * 100;
}

export class ZombieSystem {
  pool: Pool<Zombie>;

  constructor() {
    this.pool = new Pool(createZombie, resetZombie, 300);
  }

  spawn(
    typeDef: ZombieTypeDef,
    x: number, y: number,
    hpMult: number, speedMult: number, damageMult: number
  ): Zombie {
    const z = this.pool.acquire();
    z.id = nextZombieId++;
    z.x = x;
    z.y = y;
    z.size = typeDef.size;
    z.color = typeDef.color;
    z.hp = Math.round(typeDef.hp * hpMult);
    z.maxHp = z.hp;
    z.speed = typeDef.speed * speedMult;
    z.damage = Math.round(typeDef.damage * damageMult);
    z.xpValue = typeDef.xpValue;
    z.typeId = typeDef.id;
    z.isBoss = !!typeDef.isBoss;
    z.isGlowing = !!typeDef.isGlowing;
    z.explodes = !!typeDef.explodes;
    z.explosionRadius = typeDef.explosionRadius || 0;
    z.explosionDamage = Math.round((typeDef.explosionDamage || 0) * damageMult);
    z.ranged = !!typeDef.ranged;
    z.attackRange = typeDef.attackRange || 0;
    z.projectileSpeed = typeDef.projectileSpeed || 0;
    z.wobble = Math.random() * Math.PI * 2;
    return z;
  }

  update(dt: number, playerX: number, playerY: number): void {
    this.pool.forEach((z) => {
      // Chase player
      const dx = playerX - z.x;
      const dy = playerY - z.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 1) {
        let speed = z.speed;
        // Apply slow
        if (z.slowTimer > 0) {
          speed *= z.slowMult;
          z.slowTimer -= dt;
        }

        // Ranged zombies stop at attack range
        if (z.ranged && dist < z.attackRange) {
          // Don't move closer
        } else {
          z.x += (dx / dist) * speed * dt;
          z.y += (dy / dist) * speed * dt;
        }
      }

      // Burn damage
      if (z.burnTimer > 0) {
        z.burnTimer -= dt;
        z.hp -= z.burnDamage * dt;
      }

      // Flash timer
      if (z.flashTimer > 0) z.flashTimer -= dt;

      // Attack cooldown
      if (z.attackCooldown > 0) z.attackCooldown -= dt;

      // Wobble animation
      z.wobble += dt * 5;
      z.animTimer += dt * 8; // Adjust animation speed

      // Release if dead
      if (z.hp <= 0) return true;
      return false;
    });
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const active = this.pool.getActive();
    for (const z of active) {
      if (!camera.isVisible(z.x, z.y, z.size + 10)) continue;
      const [sx, sy] = camera.worldToScreen(z.x, z.y);

      // Wobble
      const wobbleX = Math.sin(z.wobble) * 2;
      const wobbleY = Math.cos(z.wobble * 0.7) * 1;

      // Burn and slow glow overlays
      if (z.burnTimer > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255, 100, 0, 0.5)';
        ctx.beginPath();
        ctx.arc(sx + wobbleX, sy + wobbleY, z.size * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }

      if (z.slowTimer > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(100, 150, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(sx + wobbleX, sy + wobbleY, z.size * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }

      // Draw sprite
      const frameIndex = Math.floor(z.animTimer) % 4;
      let spriteId = z.typeId as SpriteId;
      if (z.isBoss) spriteId = 'boss';
      
      // Map 'normal' to 'shambler' as fallback
      if (spriteId as string === 'normal') spriteId = 'shambler';

      const sprite = AssetManager.get().getSprite(spriteId, z.color, frameIndex);
      
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(z.wobble * 0.1);

      if (z.flashTimer > 0) {
        ctx.globalCompositeOperation = 'lighter';
      }

      ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
      ctx.restore();

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      // HP bar for bosses and damaged zombies
      if (z.isBoss || z.hp < z.maxHp) {
        const barW = z.size * 2;
        const barH = z.isBoss ? 6 : 3;
        const barY = sy - z.size - 8;
        const hpRatio = Math.max(0, z.hp / z.maxHp);
        ctx.fillStyle = '#333333';
        ctx.fillRect(sx - barW / 2, barY, barW, barH);
        ctx.fillStyle = z.isBoss ? '#ff4444' : '#44ff44';
        ctx.fillRect(sx - barW / 2, barY, barW * hpRatio, barH);
      }

      // Boss crown
      if (z.isBoss) {
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        const crownY = sy - z.size - 14;
        ctx.moveTo(sx - 10, crownY);
        ctx.lineTo(sx - 8, crownY - 8);
        ctx.lineTo(sx - 4, crownY - 3);
        ctx.lineTo(sx, crownY - 10);
        ctx.lineTo(sx + 4, crownY - 3);
        ctx.lineTo(sx + 8, crownY - 8);
        ctx.lineTo(sx + 10, crownY);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
}
