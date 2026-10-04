import type { Zombie } from '../entities/zombies';
import { anatomy, tissue, wound, brokenHead, sinew, fingers, FLESH } from './body-horror';

const THIN = 'M-15 -4 L-11 -9 Q-8 -14 -3 -10 L2 -9 L5 -5 L4 0 L6 5 L0 9 L-4 7 L-8 10 L-13 6 L-11 1 Z';
const HEAVY = 'M-18 -5 Q-18 -14 -8 -16 L-2 -13 Q4 -17 9 -9 L12 -3 L9 4 Q11 11 2 14 L-4 12 L-11 14 L-16 7 L-14 1 Z';
const SAC = 'M-18 -6 Q-15 -17 -5 -14 Q4 -18 9 -10 L10 -5 Q17 0 10 9 L6 13 Q-7 18 -15 9 L-19 3 Z';
const BOSS = 'M-18 -5 L-15 -11 L-10 -10 Q-4 -19 3 -13 L7 -14 L10 -9 L14 -8 L15 -2 L11 3 Q15 10 7 14 L2 12 L-3 16 L-7 12 L-14 13 L-16 6 L-12 3 Z';
const SURVIVAL_SIZE = 1.625;

function feet(ctx: CanvasRenderingContext2D, z: Zombie, flash: boolean, heavy: boolean): void {
  const gait = z.walkDist * (heavy ? 0.9 : 1.6);
  sinew(ctx, -9, -5, -14 + Math.sin(gait) * 2, -10, -19 + Math.sin(gait) * 2, -11, heavy ? 4.2 : 2.5, '#555653', flash);
  sinew(ctx, -8, 6, -13 + Math.sin(gait + 2.5), 10, -16 + Math.sin(gait + 2.5), 14, heavy ? 3.6 : 2, '#67645c', flash);
}

function spine(ctx: CanvasRenderingContext2D, bend: number, boss = false): void {
  ctx.strokeStyle = '#42323d'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-14, -3); ctx.quadraticCurveTo(-4, -6 + bend, 5, -2); ctx.stroke();
  ctx.strokeStyle = FLESH.bone; ctx.lineWidth = boss ? 1.6 : 1.05;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) { const x = -12 + i * 3.1; ctx.moveTo(x, -5 + bend * i / 6); ctx.lineTo(x + 1, -2 + bend * i / 6); }
  ctx.stroke();
}

function draggingArm(ctx: CanvasRenderingContext2D, z: Zombie, flash: boolean, side: number, reach = 0): void {
  const stagger = Math.sin(z.animTimer * 3.1 + side * 2) * 1.2;
  const handX = side < 0 ? -12 + reach * 16 : 12 + reach * 5;
  sinew(ctx, -2, side * 7, side < 0 ? -8 : 4, side * (13 + reach), handX, side * (15 - reach * 5) + stagger,
    side < 0 ? 2.4 : 3.5, side < 0 ? '#77766e' : '#9b9885', flash);
  fingers(ctx, handX, side * (15 - reach * 5) + stagger, side * 0.5, 4.2);
}

function giantArm(ctx: CanvasRenderingContext2D, flash: boolean, preparation: number, strike: number): void {
  ctx.save(); ctx.translate(-1, -7); ctx.rotate(-preparation * 1.1 + strike * 0.8);
  tissue(ctx, 'M-4 -3 Q-2 -10 6 -9 L8 -7 Q15 -10 17 -4 L19 0 L16 4 L10 6 L5 2 L0 3 Z', '#8b8276', flash);
  wound(ctx, 7, -3, 0.62, 0.45, false);
  ctx.strokeStyle = '#c4b298'; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(13, -3); ctx.lineTo(18, -2); ctx.moveTo(14, 0); ctx.lineTo(18, 1); ctx.stroke();
  ctx.restore();
}

/** Shared body-horror anatomy for Survival and Campaign regular zombies. */
export function drawSurvivalZombie(ctx: CanvasRenderingContext2D, z: Zombie, sx: number, sy: number, flash: boolean): void {
  const type = z.typeId;
  const heavy = type === 'tank' || z.isBoss;
  const t = z.animTimer;
  const breath = Math.sin(t * (heavy ? 2.2 : 3.3) + z.wobble);
  const prepare = z.visualWindup;
  const strike = Math.min(1, z.visualStrike / 0.25);
  const claw = strike > 0 ? 0.35 + strike * 0.65 : prepare * 0.4;
  ctx.save(); ctx.translate(sx, sy);
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(2, 6, z.size * SURVIVAL_SIZE * 0.98, z.size * SURVIVAL_SIZE * 0.58, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(z.facingAngle); ctx.scale(z.size / 20 * SURVIVAL_SIZE, z.size / 20 * SURVIVAL_SIZE);
  if (flash) ctx.translate(-1.7, 0.5);
  feet(ctx, z, flash, heavy);
  if (type === 'runner') {
    // A raised, bent spine and low, widely planted wrists read as a feral crawl.
    const skitter = Math.sin(z.walkDist * 2.7);
    sinew(ctx, 0, -5, 9 + skitter * 2, -13, 18, -10 - skitter * 2, 2.2, '#8c8e7d', flash);
    sinew(ctx, -4, 6, 0 - skitter, 14, 13, 17 + skitter, 2.5, '#777e74', flash);
    fingers(ctx, 18, -10 - skitter * 2, -0.5, 5); fingers(ctx, 13, 17 + skitter, 0.4, 4);
    ctx.save(); ctx.rotate(-0.12);
    tissue(ctx, THIN, '#727d73', flash); spine(ctx, -1.8);
    wound(ctx, -4, 4, 0.67, -0.7, true);
    brokenHead(ctx, 7, 1, 0.25 + Math.sin(t * 5.7) * 0.08, 0.86, '#a4a38a', flash, 1 + claw * 2);
    ctx.restore();
  } else if (type === 'tank') {
    draggingArm(ctx, z, flash, 1, claw);
    tissue(ctx, HEAVY, '#797168', flash); wound(ctx, -5, 6, 0.9, 0.6, true);
    spine(ctx, 0, true); giantArm(ctx, flash, prepare, claw);
    brokenHead(ctx, 7, 4, 0.62 + breath * 0.035, 0.79, '#a09882', flash, claw * 2);
    ctx.fillStyle = FLESH.bone; ctx.fill(anatomy('M-12 -10 Q-17 -16 -14 -19 Q-9 -16 -9 -12 Z M-6 -12 Q-7 -18 -4 -19 Q-2 -15 -2 -11 Z'));
  } else if (type === 'exploder' || type === 'spitter') {
    draggingArm(ctx, z, flash, -1, claw * 0.2); draggingArm(ctx, z, flash, 1, claw * 0.5);
    ctx.save(); ctx.scale(1 + breath * 0.022 + prepare * 0.025, 1 - breath * 0.035);
    tissue(ctx, SAC, type === 'spitter' ? '#7b866c' : '#9a8c76', flash);
    wound(ctx, -9, 3, 0.95, -0.3, false);
    ctx.strokeStyle = '#4d3740'; ctx.lineWidth = 1.7;
    ctx.stroke(anatomy('M-12 -9 L-6 -5 L-7 0 L-2 4 L-4 11 M-7 0 L-13 3 M-6 -5 L1 -7 L4 -4'));
    ctx.strokeStyle = type === 'spitter' ? '#9cae78' : '#bd8063'; ctx.lineWidth = 0.8 + prepare * 0.65;
    ctx.stroke(anatomy('M-11 -8 L-7 -5 L-8 0 L-3 5 L-5 10'));
    ctx.restore();
    ctx.save(); ctx.translate(7, 0); ctx.scale(1 - strike * 0.15, 1 + prepare * 0.3);
    tissue(ctx, 'M-6 -5 Q0 -10 5 -4 L7 2 Q3 10 -3 7 L-5 2 Z', type === 'spitter' ? '#a1a27b' : '#88736a', flash);
    ctx.restore();
    brokenHead(ctx, 10, -2, -0.3 + breath * 0.04, 0.77, '#a2a18b', flash, 1 + prepare * 2 + strike * 3);
    if (type === 'spitter') {
      ctx.strokeStyle = '#919c67'; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(14, 2); ctx.bezierCurveTo(13, 7, 8, 9 + breath, 4, 9 + breath); ctx.stroke();
    }
  } else if (z.isBoss) {
    const knight = type === 'boss_2';
    // Fused torsos grow around a central cleft, not a scaled ordinary zombie.
    for (let i = 0; i < 4; i++) {
      const side = i < 2 ? -1 : 1, root = i % 2 ? -9 : 0;
      const lag = Math.sin(t * (2.1 + i * 0.45) + i * 2) * 1.4;
      sinew(ctx, root, side * 7, root + 3 - prepare * 2, side * (12 + prepare * 3), root + 12 + claw * 5, side * (14 - claw * 4) + lag, i % 2 ? 2 : 3.6, '#96917e', flash);
      fingers(ctx, root + 12 + claw * 5, side * (14 - claw * 4) + lag, side * 0.3, 3.8);
    }
    tissue(ctx, BOSS, knight ? '#656a69' : '#82716e', flash);
    wound(ctx, -5, -5, 0.85, -0.6, true); wound(ctx, -3, 6, 0.9, 0.5, true);
    if (knight) {
      tissue(ctx, 'M-15 -7 L-10 -13 L-3 -12 L-5 -6 L-10 -3 Z M-12 9 L-5 7 L0 11 L-7 14 Z', '#575e62', flash);
      ctx.strokeStyle = '#a0a494'; ctx.lineWidth = 0.8; ctx.stroke(anatomy('M-14 -7 L-10 -11 L-5 -10 M-10 10 L-6 9'));
    }
    ctx.fillStyle = '#30222b'; ctx.fill(anatomy('M0 -8 L5 -5 L4 -1 L7 3 L3 9 L0 5 L2 1 L-1 -3 Z'));
    ctx.strokeStyle = FLESH.bone; ctx.lineWidth = 0.8;
    ctx.stroke(anatomy('M1 -6 L4 -4 M2 -2 L5 0 M2 3 L5 4 M1 6 L3 7'));
    brokenHead(ctx, 7, -5, -0.43 + Math.sin(t * 2.7) * 0.08, 0.8, '#b0a48c', flash, prepare * 2 + strike);
    brokenHead(ctx, 9, 6, 0.61 + Math.sin(t * 3.8 + 1) * 0.11, 0.7, '#8e9a8b', flash, 0.7 + claw);
    ctx.fillStyle = FLESH.bone; ctx.fill(anatomy('M-10 -10 Q-15 -16 -14 -18 Q-9 -16 -8 -12 Z M-4 -13 Q-7 -18 -4 -20 Q0 -16 0 -12 Z M-14 4 Q-20 5 -21 8 Q-16 9 -13 8 Z'));
  } else {
    draggingArm(ctx, z, flash, -1, claw); draggingArm(ctx, z, flash, 1, claw);
    ctx.save(); ctx.rotate(-0.1 + Math.sin(z.walkDist * 1.6) * 0.035);
    tissue(ctx, THIN, type === 'glowing' ? '#777e65' : '#7e8579', flash);
    tissue(ctx, 'M-15 -4 L-10 -8 L-8 -3 L-10 1 L-6 5 L-9 10 L-13 6 Z', '#4e585c', flash);
    wound(ctx, -2, 2, 0.83, -0.4, true); spine(ctx, 0.5);
    if (type === 'glowing') {
      // Infection is confined to fissures, preserving the skin and silhouette.
      ctx.strokeStyle = '#b9be79'; ctx.lineWidth = 1.6;
      ctx.stroke(anatomy('M-8 -7 L-4 -5 L-2 -7 M1 4 L-1 7 L2 8 M-9 2 L-6 4'));
      ctx.strokeStyle = '#e1d39b'; ctx.lineWidth = 0.65; ctx.stroke(anatomy('M-8 -7 L-4 -5 M1 4 L-1 7'));
    }
    brokenHead(ctx, 8, 1.5, 0.45 + Math.sin(t * 2.9 - 0.5) * 0.075, 0.84, '#a3a18a', flash, 0.5 + claw * 2);
    ctx.restore();
  }
  ctx.restore();
}
