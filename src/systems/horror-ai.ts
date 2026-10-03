import type { Zombie } from '../entities/zombies';
import { getHorrorAttack } from '../data/zombies';
import { segmentHitsBuilding } from '../entities/map-geometry';

/** Returns true for special creatures. No damage is applied during the warning. */
export function updateHorrorAI(z: Zombie, dt: number, playerX: number, playerY: number, walls: boolean): boolean {
  const attack = getHorrorAttack(z.typeId);
  if (!attack) return false;
  z.specialStarted = false;
  const dx = playerX - z.x;
  const dy = playerY - z.y;
  const distance = Math.hypot(dx, dy);
  const slow = z.slowTimer > 0 ? z.slowMult : 1;
  if (z.slowTimer > 0) z.slowTimer -= dt;

  if (z.specialState === 'chase' && z.attackCooldown <= 0 && distance < attack.triggerRange &&
      (!walls || !segmentHitsBuilding(z.x, z.y, playerX, playerY))) {
    z.specialState = 'windup';
    z.specialDuration = z.specialTimer = attack.windup;
    z.specialAngle = Math.atan2(dy, dx);
    z.specialHit = false;
  } else if (z.specialState !== 'chase') {
    z.specialTimer -= dt;
    if (z.specialTimer <= 0) {
      if (z.specialState === 'windup') {
        z.specialState = 'active';
        z.specialDuration = z.specialTimer = attack.active;
        z.specialStarted = true;
      } else if (z.specialState === 'active') {
        z.specialState = 'recover';
        z.specialDuration = z.specialTimer = attack.recovery;
      } else {
        z.specialState = 'chase';
        z.attackCooldown = attack.cooldown;
      }
    }
  }

  if (z.specialState === 'chase') {
    const speed = z.speed * slow;
    const k = 1 - Math.exp(-7 * dt);
    z.vx += ((distance > 1 ? dx / distance * speed : 0) - z.vx) * k;
    z.vy += ((distance > 1 ? dy / distance * speed : 0) - z.vy) * k;
  } else {
    // A committed direction lets the player sidestep a charge or leave a swing.
    z.facingAngle = z.specialAngle;
    const speed = z.specialState === 'active' ? attack.dashSpeed * slow : 0;
    z.vx = Math.cos(z.specialAngle) * speed;
    z.vy = Math.sin(z.specialAngle) * speed;
  }
  z.attackAnim = z.specialState === 'chase' ? 0 : 1;
  z.attackTimer = (1 - Math.max(0, z.specialTimer) / Math.max(0.001, z.specialDuration)) * Math.PI;
  return true;
}

/** Same bounds as the ground warning; walls block melee and charges. */
export function horrorAttackHits(z: Zombie, x: number, y: number, radius: number, walls: boolean): boolean {
  const attack = getHorrorAttack(z.typeId);
  if (!attack || z.specialState !== 'active' || z.specialHit || z.hp <= 0) return false;
  const dx = x - z.x;
  const dy = y - z.y;
  const distance = Math.hypot(dx, dy);
  if (distance > attack.reach + radius) return false;
  if (walls && segmentHitsBuilding(z.x, z.y, x, y)) return false;
  if (distance > radius && attack.arc < Math.PI * 2) {
    const delta = Math.atan2(Math.sin(Math.atan2(dy, dx) - z.specialAngle), Math.cos(Math.atan2(dy, dx) - z.specialAngle));
    if (Math.abs(delta) > attack.arc / 2 + Math.asin(Math.min(1, radius / distance))) return false;
  }
  return true;
}

export function drawHorrorWarning(ctx: CanvasRenderingContext2D, z: Zombie, sx: number, sy: number): void {
  const attack = getHorrorAttack(z.typeId);
  if (!attack || (z.specialState !== 'windup' && z.specialState !== 'active')) return;
  const active = z.specialState === 'active';
  const progress = 1 - Math.max(0, z.specialTimer) / z.specialDuration;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(z.specialAngle);
  ctx.strokeStyle = active ? '#efb581' : '#d4946c';
  ctx.fillStyle = active ? 'rgba(151,47,36,0.16)' : `rgba(142,64,38,${0.07 + progress * 0.08})`;
  ctx.lineWidth = active ? 2 : 1.5;
  if (attack.dashSpeed > 0) {
    const length = attack.dashSpeed * (active ? Math.max(0, z.specialTimer) : attack.active) + attack.reach;
    const half = attack.reach;
    ctx.beginPath();
    ctx.moveTo(0, -half); ctx.lineTo(length, -half);
    ctx.lineTo(length, 0); ctx.lineTo(length, half); ctx.lineTo(0, half);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(length * progress, 0); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.arc(0, 0, attack.reach, -attack.arc / 2, attack.arc / 2);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, attack.reach * Math.max(0.08, progress), -attack.arc / 2, attack.arc / 2);
    ctx.stroke();
  }
  ctx.restore();
}
