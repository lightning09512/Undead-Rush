import type { Zombie } from '../entities/zombies';

// Geometry is authored facing right, in a 20-unit collision radius. Limbs are
// deliberately thin outside that radius; the opaque body matches the hit area.
// These renderers allocate neither gradients nor temporary canvases each frame.
const TAU = Math.PI * 2;
const INK = '#17191b';
const BONE = '#cecab0';
const BLOOD = '#712f36';
const WET = '#bd6860';
const RAT_LAYOUT = [
  [-7, -8, -1.0], [4, -9, -0.35], [9, 1, 0.2],
  [3, 9, 0.9], [-8, 7, 2.1], [-11, -1, 3.1],
] as const;

function oval(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string, angle = 0): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, angle, 0, TAU);
  ctx.fill();
}

function finishSkin(ctx: CanvasRenderingContext2D, color: string, flash: boolean): void {
  ctx.fillStyle = flash ? '#e8e1ca' : color;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.35;
  ctx.stroke();
}

function limb(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, cx: number, cy: number, width: number, color: string, flash: boolean): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(cx, cy);
  ctx.strokeStyle = INK;
  ctx.lineWidth = width + 2;
  ctx.stroke();
  ctx.strokeStyle = flash ? '#e8e1ca' : color;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.strokeStyle = flash ? '#ffffff' : '#a5a38b';
  ctx.lineWidth = Math.max(0.65, width * 0.15);
  ctx.beginPath();
  ctx.moveTo(ax, ay - width * 0.2);
  ctx.lineTo(bx, by - width * 0.2);
  ctx.stroke();
}

function claws(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, length: number, flash: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = flash ? '#ffffff' : BONE;
  ctx.lineWidth = 1.05;
  ctx.beginPath();
  for (let i = -1; i <= 1; i++) {
    ctx.moveTo(0, i * 1.6);
    ctx.quadraticCurveTo(length * 0.65, i * 2, length, i * 1.5 + 1.1);
  }
  ctx.stroke();
  ctx.restore();
}

function ribs(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#35232a';
  ctx.beginPath();
  ctx.moveTo(-5, -6); ctx.lineTo(3, -4); ctx.lineTo(5, 1);
  ctx.lineTo(1, 7); ctx.lineTo(-6, 4); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = BLOOD;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.strokeStyle = BONE;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const y0 = -4 + i * 2.7;
    ctx.moveTo(-4, y0); ctx.quadraticCurveTo(0, y0 - 1, 3 - (i % 2), y0 + 1);
  }
  ctx.stroke();
  ctx.restore();
}

/** A tapered torn jaw and offset skull, rather than a circular head icon. */
function skull(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, scale: number, skin: string, flash: boolean, open: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(-6, -3.5);
  ctx.bezierCurveTo(-8, -7, -1, -8.5, 3, -5.5);
  ctx.lineTo(5, -3.3); ctx.lineTo(7.5, -1.4);
  ctx.lineTo(5.5, 1.2); ctx.lineTo(6.5, 4.4 + open);
  ctx.lineTo(0, 5.6); ctx.lineTo(-5.5, 4);
  ctx.closePath();
  finishSkin(ctx, skin, flash);
  oval(ctx, -1.6, -3.1, 3.5, 2.5, flash ? '#fff8dc' : '#b7b39a', -0.25);
  if (!flash) {
    ctx.strokeStyle = '#575653'; ctx.lineWidth = 0.85;
    ctx.beginPath(); ctx.moveTo(-4, -5); ctx.lineTo(-1, -2.5); ctx.lineTo(-2, 0); ctx.stroke();
    oval(ctx, 3, -3, 2.2, 1.5, '#242329', -0.15);
    oval(ctx, 2.4, 2.3, 1.8, 1.5, '#242329', 0.3);
    oval(ctx, 3.8, -3, 0.65, 0.6, '#e3a879');
    oval(ctx, 3.2, 2.3, 0.6, 0.6, '#e3a879');
    oval(ctx, 5.3, 0, 1.7, 2 + open * 0.6, '#31151d');
    ctx.fillStyle = BONE;
    ctx.fillRect(4.7, -1.7, 1.7, 0.8);
    ctx.fillRect(4.5, 1.1 + open * 0.2, 1.5, 0.8);
    ctx.strokeStyle = WET; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(5.8, 2); ctx.lineTo(7, 4 + open); ctx.lineTo(5.9, 6 + open); ctx.stroke();
  }
  ctx.restore();
}

function progress(z: Zombie): number {
  return Math.max(0, Math.min(1, 1 - z.specialTimer / Math.max(0.001, z.specialDuration)));
}

function spider(ctx: CanvasRenderingContext2D, z: Zombie, flash: boolean): void {
  const p = progress(z);
  const crouch = z.specialState === 'windup' ? p : z.specialState === 'active' ? -0.55 : 0;
  const gait = z.walkDist * 2.5;
  // Four independently phased knees on either flank fold toward the abdomen
  // during anticipation, then stretch forward for the committed leap.
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 4; i++) {
      const step = Math.sin(gait + i * 2.15 + side * 1.6);
      const anchorX = 6 - i * 4.2;
      const kneeX = 19 - i * 11 + step * 2.5 - crouch * 3;
      const kneeY = side * (16 + Math.sin(i * 1.2) * 3 - crouch * 4);
      const toeX = 27 - i * 17 + step * 4 + crouch * 5;
      const toeY = side * (23 - Math.abs(i - 1.5) * 3 - crouch * 7);
      limb(ctx, anchorX, side * 5, kneeX, kneeY, toeX, toeY, 2.7, '#646167', flash);
      oval(ctx, kneeX, kneeY, 1.8, 1.6, flash ? '#ffffff' : '#b7a696');
      ctx.strokeStyle = flash ? '#ffffff' : '#cabbae';
      ctx.lineWidth = 0.85;
      ctx.beginPath(); ctx.moveTo(toeX, toeY); ctx.lineTo(toeX + 3, toeY - side * 2.5); ctx.stroke();
    }
  }
  ctx.save();
  ctx.scale(1 - crouch * 0.07, 1 + crouch * 0.1);
  // Bulging, split egg sac. The uneven silhouette is legible without a glow.
  ctx.beginPath(); ctx.moveTo(-3, -7);
  ctx.bezierCurveTo(-12, -15, -23, -12, -23, -2);
  ctx.bezierCurveTo(-26, 9, -12, 15, -5, 9);
  ctx.bezierCurveTo(1, 8, 2, -3, -3, -7); ctx.closePath();
  finishSkin(ctx, '#665363', flash);
  oval(ctx, -15, -4, 6.5, 5, flash ? '#fff5de' : '#8b7780', -0.2);
  if (!flash) {
    ctx.strokeStyle = '#342e3b'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(-21, -1); ctx.lineTo(-15, 1); ctx.lineTo(-13, 5); ctx.lineTo(-9, 3); ctx.lineTo(-6, 7);
    ctx.moveTo(-15, 1); ctx.lineTo(-12, -2); ctx.lineTo(-9, -6); ctx.stroke();
    ctx.strokeStyle = '#a75a61'; ctx.lineWidth = 2.3;
    ctx.beginPath(); ctx.moveTo(-18, 5); ctx.quadraticCurveTo(-13, 2, -11, 8); ctx.stroke();
    oval(ctx, -12, 5, 2.2, 1.3, '#dbb38c');
    oval(ctx, -19, -5, 1.2, 0.8, '#b29991');
  }
  ctx.beginPath(); ctx.moveTo(-7, -6); ctx.lineTo(2, -8); ctx.lineTo(11, -5);
  ctx.lineTo(14, 0); ctx.lineTo(9, 6); ctx.lineTo(-3, 8); ctx.closePath();
  finishSkin(ctx, '#5f6969', flash);
  ctx.strokeStyle = flash ? '#ffffff' : '#9ba8a0'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-4, -4); ctx.lineTo(3, -5.5); ctx.lineTo(9, -3.2); ctx.stroke();
  // Paired hooked chelicerae with pale chipped tips.
  for (let side = -1; side <= 1; side += 2) {
    ctx.fillStyle = flash ? '#ffffff' : BONE;
    ctx.beginPath(); ctx.moveTo(10, side * 2.5); ctx.lineTo(18, side * (4.5 + crouch));
    ctx.quadraticCurveTo(21, side * 1.8, 16, side * 0.6); ctx.lineTo(14, side * 2); ctx.closePath(); ctx.fill();
    oval(ctx, 9, side * 3.8, 2.2, 1.65, '#24252a');
    oval(ctx, 9.8, side * 3.8, 1, 0.9, flash ? '#ffffff' : '#e4ac78');
    oval(ctx, 5.9, side * 5.2, 0.8, 0.75, flash ? '#ffffff' : '#c9a887');
  }
  ctx.restore();
}

function rat(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, phase: number, index: number, flash: boolean): void {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  const wriggle = Math.sin(phase) * 1.2;
  // Four visible crooked feet on every rat keep the mass animal-like.
  ctx.strokeStyle = flash ? '#ffffff' : '#ae8780'; ctx.lineWidth = 1.3;
  ctx.beginPath();
  for (let side = -1; side <= 1; side += 2) {
    ctx.moveTo(-3, side * 3); ctx.lineTo(-5 + wriggle, side * 5.8); ctx.lineTo(-2 + wriggle, side * 6.6);
    ctx.moveTo(4, side * 2.4); ctx.lineTo(5 - wriggle, side * 5); ctx.lineTo(7 - wriggle, side * 5.4);
  }
  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-7, 0);
  ctx.bezierCurveTo(-8, -5, -1, -5.6, 4, -3.4);
  ctx.lineTo(11, -0.8); ctx.lineTo(12, 0.5); ctx.lineTo(6, 2.1);
  ctx.bezierCurveTo(1, 6, -7, 5, -7, 0); ctx.closePath();
  finishSkin(ctx, index % 2 === 0 ? '#7d7871' : '#6c706a', flash);
  ctx.strokeStyle = flash ? '#fff9dc' : '#b0aca0'; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(-4, -2.4); ctx.quadraticCurveTo(1, -3.6, 5, -1.4); ctx.stroke();
  oval(ctx, 3.2, -3.7, 2, 2.1, flash ? '#ffffff' : '#b39088', -0.2);
  oval(ctx, 3.7, 2.4, 1.9, 1.9, flash ? '#ffffff' : '#ad857e');
  oval(ctx, 3.1, -3.8, 0.8, 1.1, '#61494c');
  oval(ctx, 7.6, -1.15, 0.75, 0.75, '#e8a888');
  oval(ctx, 11.2, 0, 1, 0.8, '#36292d');
  if (!flash) {
    ctx.strokeStyle = '#b9b9ab'; ctx.lineWidth = 0.45;
    ctx.beginPath(); ctx.moveTo(9, -0.5); ctx.lineTo(12, -3); ctx.moveTo(9, 0.5); ctx.lineTo(12, 3); ctx.stroke();
    ctx.strokeStyle = BLOOD; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-2, 1); ctx.lineTo(0, -0.8); ctx.stroke();
  }
  ctx.restore();
}

function ratKing(ctx: CanvasRenderingContext2D, z: Zombie, flash: boolean): void {
  const p = progress(z);
  const t = z.animTimer * 3;
  const bunch = z.specialState === 'windup' ? 1 - p * 0.13 : 1;
  ctx.save(); ctx.scale(bunch, bunch);
  // A compact meaty knot ties six full bodies together; tails have both ends
  // visible so this reads as trapped rats rather than one six-headed zombie.
  oval(ctx, -2, 0, 17, 15, '#49363c');
  for (let i = 0; i < 6; i++) {
    const layout = RAT_LAYOUT[i];
    const motion = Math.sin(t + i * 1.6);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#30252b'; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(layout[0] - Math.cos(layout[2]) * 5, layout[1] - Math.sin(layout[2]) * 5);
    ctx.bezierCurveTo(-20, 12 - i * 3, -15 + motion * 4, -21 + i * 3, 4 - i * 2, -5 + i * 2);
    ctx.bezierCurveTo(13, 16, -21, 22 + motion, -23 + motion, 10 - i * 1.5); ctx.stroke();
    ctx.strokeStyle = flash ? '#eadbca' : '#ac7b7b'; ctx.lineWidth = 1.9; ctx.stroke();
  }
  for (let i = 0; i < 6; i++) {
    const r = RAT_LAYOUT[i];
    const phase = t + i * 2.1;
    rat(ctx, r[0] + Math.sin(phase) * 0.6, r[1], r[2] + Math.sin(phase * 1.2) * 0.09, z.walkDist * 2.4 + i * 2, i, flash);
  }
  // Exposed connective tissue between bodies, with pale sinews crossing it.
  ctx.strokeStyle = flash ? '#d9cab5' : BLOOD; ctx.lineWidth = 3.3;
  ctx.beginPath(); ctx.moveTo(-6, -3); ctx.quadraticCurveTo(0, -1, 1, 5); ctx.lineTo(-3, 7); ctx.stroke();
  ctx.strokeStyle = flash ? '#ffffff' : '#c69888'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(-6, -3); ctx.lineTo(-1, 2); ctx.lineTo(-3, 7); ctx.moveTo(-2, -2); ctx.lineTo(1, 4); ctx.stroke();
  ctx.restore();
}

function feet(ctx: CanvasRenderingContext2D, z: Zombie, flash: boolean, spread: number): void {
  const step = Math.sin(z.walkDist * 1.8) * 3;
  for (let side = -1; side <= 1; side += 2) {
    limb(ctx, -7, side * spread * 0.65, -12 - step * side, side * spread, -9 + step * side, side * (spread + 2), 5, '#504b4b', flash);
  }
}

function mutant(ctx: CanvasRenderingContext2D, z: Zombie, flash: boolean): void {
  const p = progress(z);
  const lift = z.specialState === 'windup' ? p : z.specialState === 'active' ? 1 - p : 0;
  const sweep = z.specialState === 'active' ? p : 0;
  const sway = Math.sin(z.walkDist * 1.6);
  feet(ctx, z, flash, 11);
  // The lean arm sits low; its fist is dwarfed by the opposite shoulder.
  limb(ctx, -1, 9, 5 + sway, 15, 15 + sway, 12, 4, '#899184', flash);
  claws(ctx, 15 + sway, 12, -0.3, 4, flash);
  ctx.beginPath(); ctx.moveTo(-16, -8);
  ctx.bezierCurveTo(-19, -18, -8, -21, -1, -14);
  ctx.bezierCurveTo(7, -13, 12, -5, 9, 4);
  ctx.lineTo(5, 12); ctx.lineTo(-6, 15); ctx.lineTo(-15, 7); ctx.closePath();
  finishSkin(ctx, '#727c6b', flash);
  oval(ctx, -11, -10, 7.4, 5.4, flash ? '#fff9df' : '#919782', -0.3);
  if (!flash) {
    ribs(ctx, -1, 2, 0.8);
    ctx.strokeStyle = '#414b42'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-14, -6); ctx.lineTo(-11, -2); ctx.lineTo(-12, 6); ctx.stroke();
    ctx.strokeStyle = '#c2bfa4'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(-15, -12); ctx.lineTo(-17, -17); ctx.moveTo(-10, -14); ctx.lineTo(-10, -20); ctx.stroke();
    oval(ctx, -6, 10, 3.4, 2.1, BLOOD, -0.3);
  }
  skull(ctx, 7, 5, 0.16 + sway * 0.035, 0.77, '#a0a38d', flash, lift * 1.4);
  // Huge arm rolls back before a slam. A visible elbow, knuckles and exposed
  // tendon give its mass a readable direction even at gameplay scale.
  ctx.save(); ctx.translate(-2, -10);
  const armAngle = z.specialState === 'windup' ? -0.25 - lift * 1.5
    : z.specialState === 'active' ? -1.75 + Math.min(1, sweep * 2.3) * 2.2
      : z.specialState === 'recover' ? 0.45 * (1 - p) : -0.1 + sway * 0.08;
  ctx.rotate(armAngle);
  ctx.beginPath(); ctx.moveTo(-4, -4);
  ctx.bezierCurveTo(1, -13, 10, -11, 13, -5);
  ctx.lineTo(19, -6); ctx.quadraticCurveTo(27, -4, 27, 2);
  ctx.lineTo(24, 7); ctx.lineTo(16, 8); ctx.lineTo(10, 4);
  ctx.quadraticCurveTo(2, 6, -4, 3); ctx.closePath();
  finishSkin(ctx, '#927f75', flash);
  oval(ctx, 6, -5, 6, 4, flash ? '#fff7d9' : '#b19d89', 0.1);
  if (!flash) {
    ctx.strokeStyle = '#553b3e'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(9, -7); ctx.lineTo(11, -2); ctx.lineTo(18, 0); ctx.stroke();
    ctx.strokeStyle = WET; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(10, -6); ctx.lineTo(13, -1); ctx.lineTo(19, 1); ctx.stroke();
    ctx.fillStyle = BONE;
    for (let i = 0; i < 3; i++) ctx.fillRect(21.5, -3 + i * 3, 4.8, 1.2);
  }
  ctx.restore();
}

function armed(ctx: CanvasRenderingContext2D, z: Zombie, flash: boolean): void {
  const p = progress(z);
  const stride = Math.sin(z.walkDist * 1.7);
  feet(ctx, z, flash, 8);
  limb(ctx, -1, 7, 6, 11 + stride, 13, 9 + stride, 3.2, '#89978a', flash);
  claws(ctx, 13, 9 + stride, -0.2, 3.3, flash);
  // Ragged work coat and exposed diagonal rib cage.
  ctx.beginPath(); ctx.moveTo(-12, -10); ctx.lineTo(-3, -13); ctx.lineTo(5, -9); ctx.lineTo(7, 6);
  ctx.lineTo(0, 11); ctx.lineTo(-4, 8); ctx.lineTo(-7, 12); ctx.lineTo(-9, 8); ctx.lineTo(-14, 10);
  ctx.lineTo(-12, 3); ctx.lineTo(-15, -4); ctx.closePath();
  finishSkin(ctx, '#55636a', flash);
  if (!flash) {
    ctx.strokeStyle = '#8a9697'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-10, -8); ctx.lineTo(-5, -9); ctx.moveTo(-12, -4); ctx.lineTo(-11, 3); ctx.stroke();
    ribs(ctx, -2, 0, 0.58);
    ctx.fillStyle = '#394249'; ctx.fillRect(-11, -3, 5, 5);
    ctx.strokeStyle = '#beaa83'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-10, -8); ctx.lineTo(1, 7); ctx.stroke();
  }
  skull(ctx, 7, 1, stride * 0.055, 0.83, '#97a193', flash, z.specialState === 'windup' ? p : 0);
  const angle = z.specialState === 'windup' ? -0.1 - p * 1.6
    : z.specialState === 'active' ? -1.7 + Math.min(1, p * 1.8) * 2.8
      : z.specialState === 'recover' ? 1.1 * (1 - p) : -0.05 + stride * 0.09;
  ctx.save(); ctx.translate(-1, -8); ctx.rotate(angle);
  limb(ctx, 0, 0, 7, -3, 13, -1, 4, '#8b9180', flash);
  // Large chipped butcher's cleaver: warm rust, cold cutting edge, wrapped grip.
  ctx.lineCap = 'butt'; ctx.strokeStyle = INK; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(9, -1); ctx.lineTo(22, -1); ctx.stroke();
  ctx.strokeStyle = flash ? '#ffffff' : '#8e7461'; ctx.lineWidth = 2.7; ctx.stroke();
  ctx.strokeStyle = '#cfbb9b'; ctx.lineWidth = 0.7;
  ctx.beginPath(); for (let i = 0; i < 3; i++) { ctx.moveTo(15 + i * 2, -2.5); ctx.lineTo(14 + i * 2, 0.5); } ctx.stroke();
  ctx.beginPath(); ctx.moveTo(21, -4); ctx.lineTo(35, -5); ctx.lineTo(37, -2); ctx.lineTo(34, 7);
  ctx.lineTo(30, 8); ctx.lineTo(29, 6.5); ctx.lineTo(26, 8); ctx.lineTo(21, 6); ctx.closePath();
  finishSkin(ctx, '#8e9799', flash);
  if (!flash) {
    ctx.strokeStyle = '#dbe0d4'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(35, 1); ctx.lineTo(33.5, 5.4); ctx.lineTo(30, 6.5); ctx.moveTo(27, 6.5); ctx.lineTo(22, 5); ctx.stroke();
    ctx.fillStyle = '#6e4740'; ctx.fillRect(22, -3, 4, 5);
    ctx.strokeStyle = '#61323a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(28, 1); ctx.lineTo(30, 4); ctx.lineTo(32, 2); ctx.stroke();
    oval(ctx, 31.5, -2.3, 1.2, 1.1, '#353e42');
  }
  ctx.restore();
}

function multihead(ctx: CanvasRenderingContext2D, z: Zombie, flash: boolean): void {
  const p = progress(z);
  const spread = z.specialState === 'windup' ? p : z.specialState === 'active' ? 1 - p : 0;
  const lunge = z.specialState === 'active' ? Math.sin(p * Math.PI) : 0;
  const time = z.animTimer;
  feet(ctx, z, flash, 10);
  // Four uneven arms flail at different rates. All pull outward to telegraph
  // the converging rake; the head arrangement remains clear in every pose.
  for (let i = 0; i < 4; i++) {
    const side = i < 2 ? -1 : 1;
    const front = i % 2;
    const twitch = Math.sin(time * (3.5 + i * 0.7) + i * 2) * 2;
    const shoulderX = front ? 2 : -9;
    const handX = (front ? 20 : 6) + lunge * 9 - spread * 7;
    const handY = side * ((front ? 16 : 22) + spread * 5 - lunge * 10) + twitch;
    limb(ctx, shoulderX, side * 8, shoulderX + 7, side * (16 + spread * 2), handX, handY, front ? 4 : 3, front ? '#9a8589' : '#7a727a', flash);
    claws(ctx, handX, handY, -side * 0.2, 4.5, flash);
  }
  ctx.beginPath(); ctx.moveTo(-17, -8); ctx.lineTo(-10, -13); ctx.lineTo(-3, -14);
  ctx.bezierCurveTo(6, -16, 12, -8, 10, -1);
  ctx.lineTo(11, 8); ctx.lineTo(3, 15); ctx.lineTo(-6, 13); ctx.lineTo(-13, 7);
  ctx.lineTo(-18, 2); ctx.lineTo(-15, -2); ctx.closePath();
  finishSkin(ctx, '#766571', flash);
  oval(ctx, -9, -6, 6.5, 5.7, flash ? '#fff6df' : '#9c858d', -0.3);
  if (!flash) {
    ribs(ctx, -3, 3, 0.65);
    ctx.strokeStyle = '#b7b29a'; ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) { ctx.moveTo(-14 + i * 3.3, -6 + i * 0.8); ctx.lineTo(-14 + i * 3.3, -3 + i * 0.8); }
    ctx.stroke();
    ctx.strokeStyle = BLOOD; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(-14, 3); ctx.lineTo(-9, 4); ctx.lineTo(-6, 10); ctx.stroke();
  }
  // Staggered necks and exposed vertebrae distinguish three complete heads.
  const twitchA = Math.sin(time * 4.1) * 0.17;
  const twitchB = Math.sin(time * 5.3 + 2) * 0.13;
  const twitchC = Math.sin(time * 3.7 + 4) * 0.2;
  limb(ctx, -1, -6, 2, -11, 6 + lunge * 3, -11 - spread * 2, 4.6, '#a58a8b', flash);
  limb(ctx, 0, 6, 4, 10, 9 + lunge * 5, 11 + spread * 2, 4, '#a58a8b', flash);
  limb(ctx, 2, 0, 7, -1, 13 + lunge * 6, -1, 4.8, '#a58a8b', flash);
  skull(ctx, 7 + lunge * 3, -12 - spread * 2, -0.35 + twitchA, 0.72, '#b1aa94', flash, spread * 2);
  skull(ctx, 10 + lunge * 5, 12 + spread * 2, 0.45 + twitchB, 0.7, '#9baba0', flash, spread * 1.5);
  skull(ctx, 14 + lunge * 6, -0.5, twitchC, 0.8, '#c0b3a0', flash, spread * 2);
}

function orangeMutant(ctx: CanvasRenderingContext2D, z: Zombie, flash: boolean): void {
  const stride = Math.sin(z.walkDist * 1.75);
  const windup = z.specialState === 'windup' ? progress(z) : 0;
  const lunge = z.specialState === 'active' ? Math.sin(progress(z) * Math.PI) : 0;
  feet(ctx, z, flash, 8);
  // One overgrown shoulder and a forward-leaning, uneven torso make its pounce
  // silhouette distinct from the ordinary shamblers at normal play zoom.
  limb(ctx, -9, -5, -14, -13 + stride * 2, -20, -12 + stride * 3, 5, '#79523b', flash);
  limb(ctx, -7, 6, -11, 14 - stride * 2, -18, 13 - stride * 3, 4, '#704936', flash);
  limb(ctx, 0, -8, 10 + lunge * 8, -13 - windup * 3, 18 + lunge * 14, -10, 5.3, '#bc7044', flash);
  limb(ctx, -1, 8, 8 + lunge * 7, 14 + windup * 2, 16 + lunge * 12, 12, 4.2, '#a45e3b', flash);
  ctx.beginPath(); ctx.moveTo(-15, -7); ctx.lineTo(-10, -14); ctx.lineTo(-1, -15);
  ctx.lineTo(8, -11); ctx.lineTo(14, -4); ctx.lineTo(11, 6); ctx.lineTo(5, 12);
  ctx.lineTo(-5, 11); ctx.lineTo(-12, 6); ctx.closePath();
  finishSkin(ctx, flash ? '#fff5dc' : '#97563a', flash);
  if (!flash) {
    // Dull keratin plates and exposed orange seams distinguish its armor from blood decals.
    ctx.fillStyle = '#4c3933'; ctx.strokeStyle = '#1c1a1b'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(-11, -10); ctx.lineTo(-15, -17); ctx.lineTo(-5, -14); ctx.lineTo(-2, -9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-9, 8); ctx.lineTo(-15, 15); ctx.lineTo(-5, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#e49a48'; ctx.lineWidth = 1.6; ctx.beginPath();
    ctx.moveTo(-7, -8); ctx.lineTo(-2, -4); ctx.lineTo(-6, 1); ctx.moveTo(-2, -4); ctx.lineTo(2, -9);
    ctx.moveTo(-4, 3); ctx.lineTo(1, 7); ctx.stroke();
    ribs(ctx, -1, 0, .56);
    oval(ctx, -8, -1, 3.2, 4.5, '#e38a3e', -.2);
  }
  skull(ctx, 10 + lunge * 4, 0, -.06, .86, '#c18a61', flash, windup * .65 + lunge * .5);
}

function redMutant(ctx: CanvasRenderingContext2D, z: Zombie, flash: boolean): void {
  const stride = Math.sin(z.walkDist * 1.45);
  const windup = z.specialState === 'windup' ? progress(z) : 0;
  const lunge = z.specialState === 'active' ? Math.sin(progress(z) * Math.PI) : 0;
  feet(ctx, z, flash, 10);
  // Low, broad shoulders and a heavy frontal mass signal a slower, harder hit.
  limb(ctx, -8, -8, -13, -16 + stride, -21, -13, 7.2, '#672f35', flash);
  limb(ctx, -7, 8, -12, 17 - stride, -20, 14, 6, '#582b31', flash);
  limb(ctx, 0, -9, 10 + lunge * 8, -15 - windup * 4, 20 + lunge * 12, -10, 7, '#7b3437', flash);
  limb(ctx, -1, 9, 8 + lunge * 7, 16 + windup * 3, 19 + lunge * 10, 12, 6.2, '#703237', flash);
  ctx.beginPath(); ctx.moveTo(-17, -8); ctx.lineTo(-13, -16); ctx.lineTo(-4, -18);
  ctx.lineTo(6, -15); ctx.lineTo(15, -9); ctx.lineTo(17, 0); ctx.lineTo(11, 11);
  ctx.lineTo(2, 16); ctx.lineTo(-9, 13); ctx.lineTo(-16, 5); ctx.closePath();
  finishSkin(ctx, flash ? '#fff5dc' : '#542a31', flash);
  if (!flash) {
    ctx.fillStyle = '#211c20'; ctx.strokeStyle = '#171719'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-13, -11); ctx.lineTo(-20, -19); ctx.lineTo(-7, -16); ctx.lineTo(-4, -10); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-13, 9); ctx.lineTo(-19, 18); ctx.lineTo(-6, 14); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Short ember-colored fissures stay on the body; no floor-like warning cues.
    ctx.strokeStyle = '#d34f48'; ctx.lineWidth = 1.9; ctx.beginPath();
    ctx.moveTo(-9, -9); ctx.lineTo(-3, -5); ctx.lineTo(-7, 0); ctx.lineTo(-2, 4);
    ctx.moveTo(-3, -5); ctx.lineTo(1, -12); ctx.moveTo(-7, 0); ctx.lineTo(-11, 5); ctx.stroke();
    ribs(ctx, 0, 1, .78);
    oval(ctx, -9, -1, 3.7, 5.1, '#d7574b', -.15);
  }
  skull(ctx, 12 + lunge * 3, 0, -.04, .92, '#93625a', flash, windup * .75 + lunge * .5);
}

function campaignGunner(ctx: CanvasRenderingContext2D, z: Zombie, flash: boolean): void {
  const red = z.typeId === 'gunner_red';
  const orange = z.typeId === 'gunner_orange';
  const gait = Math.sin(z.walkDist * 1.8);
  const skin = red ? '#62333a' : orange ? '#80533b' : '#58605d';
  const limbSkin = red ? '#774047' : orange ? '#986345' : '#758078';
  feet(ctx, z, flash, red ? 10 : 8);
  limb(ctx, -7, -7, -12, -14 + gait * 2, -18, -12, 4, limbSkin, flash);
  limb(ctx, -7, 7, -12, 14 - gait * 2, -18, 12, 4, limbSkin, flash);
  // Ribbed back harness straps visibly carry the gun into both hands.
  ctx.beginPath(); ctx.moveTo(-14, -7); ctx.lineTo(-8, -12); ctx.lineTo(1, -10);
  ctx.lineTo(8, -4); ctx.lineTo(7, 7); ctx.lineTo(0, 12); ctx.lineTo(-10, 9); ctx.closePath();
  finishSkin(ctx, flash ? '#fff5dc' : skin, flash);
  if (!flash) {
    ribs(ctx, -4, 1, .5);
    ctx.strokeStyle = red ? '#c35249' : orange ? '#d08b4a' : '#9aa196'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-10, -7); ctx.lineTo(3, 7); ctx.moveTo(-8, 7); ctx.lineTo(4, -6); ctx.stroke();
    oval(ctx, -7, 0, 2.4, 3.3, red ? '#c44945' : orange ? '#df8b3d' : '#b7b392');
  }
  skull(ctx, 4, 0, 0, .7, red ? '#9b6a60' : orange ? '#ad805c' : '#a0a28d', flash, 0);

  // A strapped receiver, rear stock, handguard, barrel and forward grip form
  // one supported weapon silhouette, aligned with the creature's aim.
  const recoil = z.visualStrike > 0 ? -2.5 : z.specialState === 'windup' ? -progress(z) * 1.2 : 0;
  ctx.save(); ctx.translate(5 + recoil, 0);
  ctx.strokeStyle = INK; ctx.lineWidth = red ? 6 : 5;
  ctx.beginPath(); ctx.moveTo(-2, 1); ctx.lineTo(3, 1); ctx.stroke();
  ctx.fillStyle = '#393b39'; ctx.strokeStyle = '#17191a'; ctx.lineWidth = 1.15;
  ctx.beginPath(); ctx.moveTo(1, -4); ctx.lineTo(9, -5); ctx.lineTo(11, -2); ctx.lineTo(11, 3); ctx.lineTo(8, 5); ctx.lineTo(1, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = red ? '#4a3436' : '#51463a'; ctx.fillRect(9, -3, 8, 6);
  ctx.fillStyle = '#59605c'; ctx.fillRect(16, -3.4, 11, 6.8);
  ctx.fillStyle = '#363a39'; ctx.fillRect(18, -5, 7, 1.8); ctx.fillRect(20, 3.4, 3, 5);
  ctx.strokeStyle = '#17191b'; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.moveTo(26, -.4); ctx.lineTo(36, -.4); ctx.stroke();
  ctx.strokeStyle = '#89918b'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(22, -2); ctx.lineTo(33, -2); ctx.stroke();
  // Support hands connect the receiver to the chest/back mount.
  limb(ctx, 3, -7, 12, -5, 18, -2, 3.2, limbSkin, flash);
  limb(ctx, 2, 7, 12, 5, 21, 2, 3.2, limbSkin, flash);
  oval(ctx, 18, -1.5, 2.2, 2.1, flash ? '#fff' : limbSkin);
  oval(ctx, 21, 1.5, 2.2, 2.1, flash ? '#fff' : limbSkin);
  if (z.specialState === 'windup') {
    const charge = progress(z);
    ctx.globalAlpha = .34 + charge * .56;
    ctx.strokeStyle = red ? '#ff7665' : orange ? '#ffbd61' : '#e7ddb7';
    ctx.lineWidth = 1.2 + charge;
    ctx.beginPath(); ctx.arc(37, 0, 3.5 + charge * 3, 0, TAU); ctx.stroke();
    ctx.fillStyle = red ? '#f15c55' : orange ? '#ffad43' : '#eadca8';
    ctx.fillRect(34.5, -1.5, 3.5, 3);
  } else if (z.visualStrike > 0) {
    ctx.fillStyle = red ? '#f07061' : orange ? '#f3ae57' : '#e2d6a0';
    ctx.beginPath(); ctx.moveTo(36, -3); ctx.lineTo(44, 0); ctx.lineTo(36, 3); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

/** Returns false for legacy types; their original renderer is untouched. */
export function drawHorrorZombie(ctx: CanvasRenderingContext2D, z: Zombie, sx: number, sy: number, flash: boolean): boolean {
  if (z.typeId !== 'spider' && z.typeId !== 'rat_king' && z.typeId !== 'mutant' && z.typeId !== 'armed' && z.typeId !== 'multihead' &&
      z.typeId !== 'orange_mutant' && z.typeId !== 'red_mutant' && !z.typeId.startsWith('gunner')) return false;
  ctx.save();
  ctx.translate(sx, sy);
  const baseScale = z.size / 20;
  oval(ctx, 2, 4, z.size * 1.12, z.size * 0.72, 'rgba(0,0,0,0.35)');
  ctx.rotate(z.facingAngle);
  ctx.scale(baseScale, baseScale);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // Small recoil only while the existing hit flash is active, no camera shake.
  if (flash) ctx.translate(-1.5, 0);
  if (z.typeId === 'spider') spider(ctx, z, flash);
  else if (z.typeId === 'rat_king') ratKing(ctx, z, flash);
  else if (z.typeId === 'mutant') mutant(ctx, z, flash);
  else if (z.typeId === 'armed') armed(ctx, z, flash);
  else if (z.typeId === 'orange_mutant') orangeMutant(ctx, z, flash);
  else if (z.typeId === 'red_mutant') redMutant(ctx, z, flash);
  else if (z.typeId.startsWith('gunner')) campaignGunner(ctx, z, flash);
  else multihead(ctx, z, flash);
  ctx.restore();
  return true;
}

/** Static low-detail corpse, intended for a capped world decal pool. */
export function drawHorrorCorpse(ctx: CanvasRenderingContext2D, typeId: string, sx: number, sy: number, size: number, angle: number, seed: number, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(sx, sy); ctx.rotate(angle); ctx.scale(size / 20, size / 20);
  oval(ctx, -2, 1, 22, 15, '#381e26', 0.25);
  oval(ctx, -12, 7, 14, 6, '#432029', -0.6);
  if (typeId === 'spider') {
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 4; i++) limb(ctx, -2 - i * 2, side * 4, 12 - i * 7, side * 13, 5 - i * 6, side * 8, 1.8, '#555159', false);
    }
    oval(ctx, -11, 0, 11, 8, '#53414c'); oval(ctx, 4, 0, 9, 5, '#535c58');
  } else if (typeId === 'rat_king') {
    for (let i = 0; i < 6; i++) {
      const r = RAT_LAYOUT[i];
      ctx.save(); ctx.translate(r[0], r[1]); ctx.rotate(r[2]);
      oval(ctx, 0, 0, 7, 3.8, i % 2 ? '#555650' : '#615853');
      ctx.fillStyle = '#72645e'; ctx.beginPath(); ctx.moveTo(4, -2); ctx.lineTo(11, 0); ctx.lineTo(4, 2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#745357'; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(-14, 8, -16, 2); ctx.stroke(); ctx.restore();
    }
  } else {
    for (let side = -1; side <= 1; side += 2) {
      limb(ctx, -6, side * 6, -12, side * 13, -18, side * 12, 4, '#545551', false);
      limb(ctx, 0, side * 7, 7, side * 16, 13, side * 13, typeId === 'mutant' && side === -1 ? 8 : 3, '#75615f', false);
    }
    oval(ctx, -3, 0, 14, 10, typeId === 'armed' ? '#414d50' : '#65575d', -0.1);
    ribs(ctx, -2, 0, 0.65);
    oval(ctx, 11, 0, 6, 5, '#8d8878', 0.2);
    if (typeId === 'multihead') {
      oval(ctx, 4, -11, 5, 4, '#868576', -0.4); oval(ctx, 8, 10, 5, 4, '#858679', 0.6);
    }
    if (typeId === 'armed') {
      ctx.save(); ctx.translate(12, 13); ctx.rotate(0.6);
      ctx.fillStyle = '#655748'; ctx.fillRect(0, -1, 12, 2);
      ctx.fillStyle = '#6e7676'; ctx.fillRect(11, -4, 10, 8); ctx.restore();
    }
  }
  for (let i = 0; i < 4; i++) {
    const x = ((seed * 11 + i * 17) % 29) - 14;
    const y = ((seed * 7 + i * 13) % 19) - 9;
    oval(ctx, x, y, 2.8, 1.2, '#73313a', i * 0.7);
  }
  ctx.restore();
}
