// ─── Zombie Entity ───

import { Pool } from '../core/pool';
import { Camera } from '../core/camera';
import { ZombieTypeDef } from '../data/zombies';
import { ZombieRenderer } from '../graphics/zombie-renderer';
import { campaignDetourTarget, campaignSteeringTarget, resolveBuildingCollision, resolveCampaignMovement } from './map-geometry';
import { updateHorrorAI, drawHorrorWarning } from '../systems/horror-ai';
import { drawCampaignBoss } from '../graphics/campaign-boss-renderer';

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
  scoreValue: number;
  typeId: string;
  // Status
  flashTimer: number;
  burnTimer: number;
  burnDamage: number;
  bleedTimer: number;
  bleedDamage: number;
  stunTimer: number;
  slowTimer: number;
  slowMult: number;
  // Kinetic / Knockback
  knockbackX: number;
  knockbackY: number;
  facingLeft: boolean;
  // Flags
  isBoss: boolean;
  campaignBossId: number | null;
  /** Campaign encounter zone used to hold/release its exit gate until cleared. */
  campaignZoneIndex: number;
  campaignStuckTime: number;
  campaignPhase: number;
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
  // Cosmetic cues only; never consulted by combat or movement.
  visualWindup: number;
  visualStrike: number;
  specialState: 'chase' | 'windup' | 'active' | 'recover';
  specialTimer: number;
  specialDuration: number;
  specialAngle: number;
  specialHit: boolean;
  specialStarted: boolean;
  campaignAttackKind: string;
  campaignAttackProgress: number;
  deathHandled: boolean;
}

function createZombie(): Zombie {
  return {
    id: 0, x: 0, y: 0, size: 14, color: '#5a8a3c',
    hp: 30, maxHp: 30, speed: 60, damage: 10, scoreValue: 5,
    typeId: 'normal',
    flashTimer: 0, burnTimer: 0, burnDamage: 0, bleedTimer: 0, bleedDamage: 0, stunTimer: 0,
    slowTimer: 0, slowMult: 1,
    knockbackX: 0, knockbackY: 0,
    facingLeft: false,
    isBoss: false, campaignBossId: null, campaignZoneIndex: -1, campaignStuckTime: 0, campaignPhase: 1, isGlowing: false, isElite: false,
    explodes: false, explosionRadius: 0, explosionDamage: 0,
    ranged: false, attackRange: 0, projectileSpeed: 0, attackCooldown: 0,
    wobble: 0,
    animTimer: 0,
    vx: 0, vy: 0,
    facingAngle: 0,
    walkDist: 0,
    attackAnim: 0,
    attackTimer: 0,
    visualWindup: 0, visualStrike: 0,
    specialState: 'chase', specialTimer: 0, specialDuration: 1, specialAngle: 0,
    specialHit: false, specialStarted: false, campaignAttackKind: '', campaignAttackProgress: 0, deathHandled: false,
  };
}

function resetZombie(z: Zombie): void {
  z.hp = 0;
  z.flashTimer = 0;
  z.burnTimer = 0;
  z.bleedTimer = 0;
  z.bleedDamage = 0;
  z.stunTimer = 0;
  z.slowTimer = 0;
  z.slowMult = 1;
  z.knockbackX = 0;
  z.knockbackY = 0;
  z.facingLeft = false;
  z.attackCooldown = 0;
  z.campaignBossId = null;
  z.campaignZoneIndex = -1;
  z.campaignStuckTime = 0;
  z.campaignPhase = 1;
  z.wobble = 0;
  z.animTimer = Math.random() * 100;
  z.walkDist = 0;
  z.attackAnim = 0;
  z.attackTimer = 0;
  z.visualWindup = z.visualStrike = 0;
  z.facingAngle = 0;
  z.vx = z.vy = 0;
  z.specialState = 'chase';
  z.specialTimer = 0;
  z.specialDuration = 1;
  z.specialAngle = 0;
  z.specialHit = z.specialStarted = false;
  z.campaignAttackKind = '';
  z.campaignAttackProgress = 0;
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
    z.deathHandled = false;
    z.x = x;
    z.y = y;
    z.size = typeDef.size;
    z.color = typeDef.color;
    z.hp = Math.round(typeDef.hp * hpMult);
    z.maxHp = z.hp;
    z.speed = typeDef.speed * speedMult;
    z.damage = Math.round(typeDef.damage * damageMult);
    z.scoreValue = typeDef.scoreValue;
    z.typeId = typeDef.id;
    z.isBoss = !!typeDef.isBoss;
    z.campaignBossId = null;
    z.campaignZoneIndex = -1;
    z.campaignStuckTime = 0;
    z.campaignPhase = 1;
    z.isGlowing = !!typeDef.isGlowing || isElite;
    z.isElite = isElite && !typeDef.isBoss;
    if (z.isElite) {
      z.hp = Math.round(z.hp * 2.2);
      z.maxHp = z.hp;
      z.damage = Math.round(z.damage * 1.15);
      z.scoreValue = Math.round(z.scoreValue * 2.5);
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

  update(dt: number, playerX: number, playerY: number, collideBuildings = true,
    onSpecialTelegraph?: (zombie: Zombie) => void): void {
    this.pool.forEach((z) => {
      if (z.hp <= 0) return false; // Main loop owns death rewards and release.
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

      let special = false;
      if (z.campaignBossId === null) {
        // Shock rounds can interrupt an uncommitted windup. Once the strike is
        // active, let that clearly telegraphed attack finish instead of popping
        // the creature backward mid-animation.
        if (z.stunTimer > 0 && z.specialState !== 'active') {
          if (z.specialState === 'windup') {
            z.specialState = 'chase';
            z.specialTimer = 0;
            z.specialHit = false;
            z.attackCooldown = Math.max(z.attackCooldown, .42);
          }
          z.visualWindup = 0;
        } else {
          const previousSpecialState = z.specialState;
          special = updateHorrorAI(z, dt, playerX, playerY, collideBuildings);
          if (previousSpecialState === 'chase' && z.specialState === 'windup') onSpecialTelegraph?.(z);
        }
      }
      if (special) {
        // The committed attack state supplies movement and aim.
      } else if (dist > 1) {
        let speed = z.speed;
        // Apply slow debuff
        if (z.slowTimer > 0) {
          speed *= z.slowMult;
          z.slowTimer -= dt;
        }
        if (z.stunTimer > 0) {
          speed *= .12;
        }

        // Ranged spitters keep distance
        if (z.ranged && dist < z.attackRange) {
          const k = 1 - Math.exp(-6 * dt);
          z.vx *= (1 - k);
          z.vy *= (1 - k);
        } else {
          let [wayX, wayY] = campaignSteeringTarget(z.x, z.y, playerX, playerY);
          if (z.campaignZoneIndex >= 0 && z.campaignStuckTime > .55) {
            const detour = campaignDetourTarget(z.x, z.y, wayX, wayY, z.size * .72);
            if (detour) [wayX, wayY] = detour;
          }
          const wayDist = Math.max(1, Math.hypot(wayX - z.x, wayY - z.y));
          const targetVx = ((wayX - z.x) / wayDist) * speed;
          const targetVy = ((wayY - z.y) / wayDist) * speed;
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
      const moveX = (z.vx + z.knockbackX) * dt;
      const moveY = (z.vy + z.knockbackY) * dt;
      // Charges use small steps so even a slow frame cannot skip a wall.
      const steps = special && collideBuildings ? Math.max(1, Math.ceil(Math.hypot(moveX, moveY) / (z.size * 0.45))) : 1;
      for (let step = 0; step < steps; step++) {
        const beforeX = z.x, beforeY = z.y;
        z.x += moveX / steps;
        z.y += moveY / steps;
        [z.x, z.y] = resolveCampaignMovement(beforeX, beforeY, z.x, z.y, z.size * 0.72);
        if (collideBuildings) [z.x, z.y] = resolveBuildingCollision(z.x, z.y, special ? z.size : z.size * 0.72);
      }
      if (collideBuildings) {
        if (Math.abs(z.x - previousX) < 0.01) z.vx = 0;
        if (Math.abs(z.y - previousY) < 0.01) z.vy = 0;
      }
      if (z.campaignZoneIndex >= 0 && !z.isBoss && dist > z.size + 110) {
        z.campaignStuckTime = Math.hypot(z.x - previousX, z.y - previousY) < Math.max(1.2, z.speed * dt * .12)
          ? Math.min(4, z.campaignStuckTime + dt) : Math.max(0, z.campaignStuckTime - dt * 2);
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
      if (z.bleedTimer > 0) {
        z.bleedTimer = Math.max(0, z.bleedTimer - dt);
        z.hp -= z.bleedDamage * dt;
      }
      if (z.stunTimer > 0) z.stunTimer = Math.max(0, z.stunTimer - dt);

      // Flash timer for hit feedback
      if (z.flashTimer > 0) z.flashTimer -= dt;
      z.visualStrike = Math.max(0, z.visualStrike - dt);
      z.visualWindup = !special && !z.ranged && !z.isBoss
        ? Math.max(0, Math.min(1, 1 - (dist - z.size - 16) / 45)) * (z.attackCooldown <= 0 ? 1 : 0)
        : 0;

      // Attack cooldown
      if (z.attackCooldown > 0) z.attackCooldown -= dt;

      // Footstep locomotion distance
      const movingSpeed = Math.sqrt(z.vx * z.vx + z.vy * z.vy);
      if (movingSpeed > 5) {
        z.walkDist += movingSpeed * dt * 0.08;
      }

      // Attack / Claw scratching animation when close to player
      const inAttackRange = dist < (z.size + 36);
      if (special) {
        // Special animation is driven by its telegraphed attack phase.
      } else if (inAttackRange || z.attackCooldown > 0.25) {
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
      return false;
    });
  }

  drawWarnings(ctx: CanvasRenderingContext2D, camera: Camera, showDirections = true): void {
    if (!showDirections) return;
    for (const z of this.pool.getActive()) {
      if (z.hp <= 0 || z.campaignBossId !== null || !camera.isVisible(z.x, z.y, 260)) continue;
      const [sx, sy] = camera.worldToScreen(z.x, z.y);
      drawHorrorWarning(ctx, z, sx, sy);
    }
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera, survival = false): void {
    const active = this.pool.getActive();
    for (const z of active) {
      if (!camera.isVisible(z.x, z.y, survival ? z.size * 3.1 : z.size + 30)) continue;
      const [sx, sy] = camera.worldToScreen(z.x, z.y);

      const isFlashing = z.flashTimer > 0;

      // Draw procedural top-down zombie (Monster Breakout style)
      if (z.campaignBossId !== null) drawCampaignBoss(ctx, z, sx, sy, isFlashing);
      else ZombieRenderer.drawZombie(ctx, z, sx, sy, isFlashing, survival);

      // Burn fire overlay
      if (z.burnTimer > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255, 100, 0, 0.45)';
        ctx.beginPath();
        ctx.arc(sx, sy - 4, z.size * 1.3, 0, Math.PI * 2);
        if (survival) { ctx.strokeStyle = '#bc7952'; ctx.lineWidth = 1.5; ctx.stroke(); } else ctx.fill();
        ctx.restore();
      }

      // Slow ice overlay
      if (z.slowTimer > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(80, 160, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(sx, sy - 4, z.size * 1.3, 0, Math.PI * 2);
        if (survival) { ctx.strokeStyle = '#78a3ae'; ctx.lineWidth = 1.2; ctx.stroke(); } else ctx.fill();
        ctx.restore();
      }

      // Elite purple aura
      if (z.isElite) {
        ctx.save();
        ctx.strokeStyle = survival ? '#ac8aaf' : 'rgba(200, 80, 255, 0.85)';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#cc44ff';
        ctx.shadowBlur = survival ? 0 : 8;
        ctx.beginPath();
        ctx.arc(sx, sy - 4, z.size + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // HP bar for bosses and damaged zombies
      if (z.campaignBossId === null && (z.isBoss || z.hp < z.maxHp)) {
        const barW = Math.max(28, z.size * 1.8);
        const barH = z.isBoss ? 7 : 4;
        const barY = survival ? sy - z.size * 2.1 - 16 : sy - z.size - (z.isBoss ? 16 : 10);
        const hpRatio = Math.max(0, z.hp / z.maxHp);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(sx - barW / 2 - 1, barY - 1, barW + 2, barH + 2);
        ctx.fillStyle = '#222222';
        ctx.fillRect(sx - barW / 2, barY, barW, barH);
        ctx.fillStyle = survival ? (z.isBoss ? '#ba5960' : '#9e6966') : z.isBoss ? '#ff3344' : '#55ff55';
        ctx.fillRect(sx - barW / 2, barY, barW * hpRatio, barH);
      }

      // Boss crown
      if (z.isBoss && !survival && z.campaignBossId === null) {
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
