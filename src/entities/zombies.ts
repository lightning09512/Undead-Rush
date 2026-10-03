// ─── Zombie Entity ───

import { Pool } from '../core/pool';
import { Camera } from '../core/camera';
import { ZombieTypeDef } from '../data/zombies';
import { ZombieRenderer } from '../graphics/zombie-renderer';
import { resolveBuildingCollision } from './map-geometry';

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
  // Kinetic / Knockback
  knockbackX: number;
  knockbackY: number;
  facingLeft: boolean;
  // Flags
  isBoss: boolean;
  isGlowing: boolean;
  isElite: boolean;
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
  vx: number;
  vy: number;
  facingAngle: number;
  walkDist: number;
  attackAnim: number;
  attackTimer: number;
}

function createZombie(): Zombie {
  return {
    id: 0, x: 0, y: 0, size: 14, color: '#5a8a3c',
    hp: 30, maxHp: 30, speed: 60, damage: 10, xpValue: 5,
    typeId: 'normal',
    flashTimer: 0, burnTimer: 0, burnDamage: 0,
    slowTimer: 0, slowMult: 1,
    knockbackX: 0, knockbackY: 0,
    facingLeft: false,
    isBoss: false, isGlowing: false, isElite: false,
    explodes: false, explosionRadius: 0, explosionDamage: 0,
    ranged: false, attackRange: 0, projectileSpeed: 0, attackCooldown: 0,
    wobble: 0,
    animTimer: 0,
    vx: 0, vy: 0,
    facingAngle: 0,
    walkDist: 0,
    attackAnim: 0,
    attackTimer: 0,
  };
}

function resetZombie(z: Zombie): void {
  z.hp = 0;
  z.flashTimer = 0;
  z.burnTimer = 0;
  z.slowTimer = 0;
  z.slowMult = 1;
  z.knockbackX = 0;
  z.knockbackY = 0;
  z.facingLeft = false;
  z.attackCooldown = 0;
  z.wobble = 0;
  z.animTimer = Math.random() * 100;
  z.walkDist = 0;
  z.attackAnim = 0;
  z.attackTimer = 0;
  z.facingAngle = 0;
}

export class ZombieSystem {
  pool: Pool<Zombie>;

  constructor() {
    this.pool = new Pool(createZombie, resetZombie, 300);
  }

  spawn(
    typeDef: ZombieTypeDef,
    x: number, y: number,
    hpMult: number, speedMult: number, damageMult: number,
    isElite = false
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
    z.isGlowing = !!typeDef.isGlowing || isElite;
    z.isElite = isElite && !typeDef.isBoss;
    if (z.isElite) {
      z.hp = Math.round(z.hp * 2.2);
      z.maxHp = z.hp;
      z.damage = Math.round(z.damage * 1.15);
      z.xpValue = Math.round(z.xpValue * 2.5);
      z.size = Math.round(z.size * 1.12);
    }
    z.explodes = !!typeDef.explodes;
    z.explosionRadius = typeDef.explosionRadius || 0;
    z.explosionDamage = Math.round((typeDef.explosionDamage || 0) * damageMult);
    z.ranged = !!typeDef.ranged;
    z.attackRange = typeDef.attackRange || 0;
    z.projectileSpeed = typeDef.projectileSpeed || 0;
    z.wobble = Math.random() * Math.PI * 2;
    z.knockbackX = 0;
    z.knockbackY = 0;
    z.facingLeft = false;
    return z;
  }

  update(dt: number, playerX: number, playerY: number, collideBuildings = true): void {
    this.pool.forEach((z) => {
      const dx = playerX - z.x;
      const dy = playerY - z.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Facing orientation (left / right)
      // Smooth facing angle towards player / movement
      const targetAngle = Math.atan2(dy, dx);
      let diff = targetAngle - z.facingAngle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      const turnSpeed = z.isBoss ? 8 : z.typeId === 'runner' ? 14 : 10;
      const turnK = 1 - Math.exp(-turnSpeed * dt);
      z.facingAngle += diff * turnK;

      if (Math.abs(dx) > 1.5) {
        z.facingLeft = dx < 0;
      }

      if (dist > 1) {
        let speed = z.speed;
        // Apply slow debuff
        if (z.slowTimer > 0) {
          speed *= z.slowMult;
          z.slowTimer -= dt;
        }

        // Ranged spitters keep distance
        if (z.ranged && dist < z.attackRange) {
          const k = 1 - Math.exp(-6 * dt);
          z.vx *= (1 - k);
          z.vy *= (1 - k);
        } else {
          const targetVx = (dx / dist) * speed;
          const targetVy = (dy / dist) * speed;
          const k = 1 - Math.exp(-8 * dt);
          z.vx += (targetVx - z.vx) * k;
          z.vy += (targetVy - z.vy) * k;
        }
      } else {
        z.vx *= 0.5;
        z.vy *= 0.5;
      }

      // Apply velocity AND knockback impulse
      const previousX = z.x;
      const previousY = z.y;
      z.x += (z.vx + z.knockbackX) * dt;
      z.y += (z.vy + z.knockbackY) * dt;
      if (collideBuildings) {
        [z.x, z.y] = resolveBuildingCollision(z.x, z.y, z.size * 0.72);
        if (Math.abs(z.x - previousX) < 0.01) z.vx = 0;
        if (Math.abs(z.y - previousY) < 0.01) z.vy = 0;
      }

      // Exponential decay of knockback
      const decay = Math.exp(-12 * dt);
      z.knockbackX *= decay;
      z.knockbackY *= decay;

      // Burn damage over time
      if (z.burnTimer > 0) {
        z.burnTimer -= dt;
        z.hp -= z.burnDamage * dt;
      }

      // Flash timer for hit feedback
      if (z.flashTimer > 0) z.flashTimer -= dt;

      // Attack cooldown
      if (z.attackCooldown > 0) z.attackCooldown -= dt;

      // Footstep locomotion distance
      const movingSpeed = Math.sqrt(z.vx * z.vx + z.vy * z.vy);
      if (movingSpeed > 5) {
        z.walkDist += movingSpeed * dt * 0.08;
      }

      // Attack / Claw scratching animation when close to player
      const inAttackRange = dist < (z.size + 36);
      if (inAttackRange || z.attackCooldown > 0.25) {
        z.attackAnim = Math.min(1, z.attackAnim + dt * 6);
        z.attackTimer += dt * 10;
      } else {
        z.attackAnim = Math.max(0, z.attackAnim - dt * 3);
        z.attackTimer += dt * 2;
      }

      // Animation & bobbing cadence
      z.wobble += dt * 5;
      z.animTimer += dt * (movingSpeed > 10 ? 1.0 : 0.4);

      // Release if dead
      if (z.hp <= 0) return true;
      return false;
    });
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const active = this.pool.getActive();
    for (const z of active) {
      if (!camera.isVisible(z.x, z.y, z.size + 30)) continue;
      const [sx, sy] = camera.worldToScreen(z.x, z.y);

      const isFlashing = z.flashTimer > 0;

      // Draw procedural top-down zombie (Monster Breakout style)
      ZombieRenderer.drawZombie(ctx, z, sx, sy, isFlashing);

      // Burn fire overlay
      if (z.burnTimer > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255, 100, 0, 0.45)';
        ctx.beginPath();
        ctx.arc(sx, sy - 4, z.size * 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Slow ice overlay
      if (z.slowTimer > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(80, 160, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(sx, sy - 4, z.size * 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Elite purple aura
      if (z.isElite) {
        ctx.save();
        ctx.strokeStyle = 'rgba(200, 80, 255, 0.85)';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#cc44ff';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(sx, sy - 4, z.size + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // HP bar for bosses and damaged zombies
      if (z.isBoss || z.hp < z.maxHp) {
        const barW = Math.max(28, z.size * 1.8);
        const barH = z.isBoss ? 7 : 4;
        const barY = sy - z.size - (z.isBoss ? 16 : 10);
        const hpRatio = Math.max(0, z.hp / z.maxHp);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(sx - barW / 2 - 1, barY - 1, barW + 2, barH + 2);
        ctx.fillStyle = '#222222';
        ctx.fillRect(sx - barW / 2, barY, barW, barH);
        ctx.fillStyle = z.isBoss ? '#ff3344' : '#55ff55';
        ctx.fillRect(sx - barW / 2, barY, barW * hpRatio, barH);
      }

      // Boss crown
      if (z.isBoss) {
        ctx.save();
        ctx.fillStyle = '#ffdd00';
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        const crownY = sy - z.size - 22;
        ctx.moveTo(sx - 12, crownY);
        ctx.lineTo(sx - 10, crownY - 10);
        ctx.lineTo(sx - 5, crownY - 4);
        ctx.lineTo(sx, crownY - 12);
        ctx.lineTo(sx + 5, crownY - 4);
        ctx.lineTo(sx + 10, crownY - 10);
        ctx.lineTo(sx + 12, crownY);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }
}
