import { UI_PALETTE as C } from './palette';

/** Original procedural artwork. No external images; static scene is cached by MenuUI. */
export function drawBloodHandprint(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, rotation = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#502c29';
  ctx.beginPath();
  ctx.moveTo(-17, 12); ctx.bezierCurveTo(-27, -1, -26, -16, -12, -23);
  ctx.bezierCurveTo(0, -30, 24, -21, 24, -4); ctx.lineTo(14, 24);
  ctx.lineTo(-6, 29); ctx.closePath(); ctx.fill();
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#502c29';
  ctx.lineWidth = 8;
  const fingers = [[-19, -10, -33, -39], [-10, -20, -14, -57], [2, -22, 3, -65], [13, -16, 20, -53], [21, -4, 40, -26]];
  for (const [sx, sy, ex, ey] of fingers) {
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
  }
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#4a2826';
  for (let i = 0; i < 7; i++) {
    ctx.beginPath(); ctx.moveTo(-12 + i * 5, 18); ctx.lineTo(-11 + i * 5, 42 + (i % 3) * 11); ctx.stroke();
  }
  ctx.restore();
}

/** Scratches and stains stay at the border, leaving the content area clean. */
export function drawWornPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, bloody = false): void {
  ctx.save();
  ctx.fillStyle = '#192125';
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 5); ctx.fill(); ctx.stroke();
  ctx.clip();
  ctx.fillStyle = '#263137';
  ctx.fillRect(x + 1, y + 1, w - 2, 3);
  ctx.fillStyle = '#101619';
  ctx.fillRect(x + 1, y + h - 6, w - 2, 5);
  ctx.lineWidth = 1;
  for (let i = 0; i < 17; i++) {
    const sx = x + 11 + ((i * 73) % Math.max(1, w - 22));
    const sy = i % 2 ? y + 8 + i % 5 : y + h - 10 - i % 6;
    ctx.strokeStyle = i % 3 ? 'rgba(147,158,155,0.13)' : 'rgba(3,7,8,0.5)';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 5 + i % 13, sy - 2); ctx.stroke();
  }
  if (bloody) {
    ctx.fillStyle = '#4d2b28';
    ctx.beginPath();
    ctx.moveTo(x + w - 58, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + 37);
    ctx.lineTo(x + w - 12, y + 19); ctx.lineTo(x + w - 24, y + 28);
    ctx.lineTo(x + w - 29, y + 11); ctx.lineTo(x + w - 52, y + 9); ctx.closePath(); ctx.fill();
    ctx.fillRect(x + w - 23, y + 16, 2, 32);
    ctx.fillRect(x + w - 11, y + 26, 2, 18);
  }
  for (const sx of [x + 9, x + w - 9]) {
    for (const sy of [y + 9, y + h - 9]) {
      ctx.fillStyle = '#101719';
      ctx.beginPath(); ctx.arc(sx, sy, 2.3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#697170'; ctx.beginPath(); ctx.moveTo(sx - 1, sy); ctx.lineTo(sx + 1, sy); ctx.stroke();
    }
  }
  ctx.restore();
}

export function createQuarantineBackdrop(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w);
  canvas.height = Math.ceil(h);
  const ctx = canvas.getContext('2d')!;
  const wall = ctx.createLinearGradient(0, 0, w, h);
  wall.addColorStop(0, '#182329'); wall.addColorStop(0.55, '#151d20'); wall.addColorStop(1, '#080d10');
  ctx.fillStyle = wall; ctx.fillRect(0, 0, w, h);
  // Large concrete slabs, rust runs and mineral scratches.
  const seam = Math.max(120, w / 6);
  for (let x = 0; x < w; x += seam) {
    ctx.fillStyle = '#0f171a'; ctx.fillRect(x, 0, 3, h * 0.83);
    ctx.fillStyle = '#2b3334'; ctx.fillRect(x + 3, 0, 1, h * 0.83);
  }
  let random = 4171;
  const next = () => { random = (random * 1664525 + 1013904223) >>> 0; return random / 4294967296; };
  for (let i = 0; i < 430; i++) {
    const x = next() * w; const y = next() * h;
    ctx.strokeStyle = i % 4 ? 'rgba(137,137,119,0.06)' : 'rgba(82,46,31,0.21)';
    ctx.lineWidth = 1 + next(); ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(x + next() * 9, y + 3 + next() * 35); ctx.stroke();
  }
  const sceneX = w >= 850 ? w * 0.76 : w * 0.79;
  const sceneScale = Math.min(1.45, Math.max(0.65, h / 630));
  ctx.save(); ctx.translate(sceneX, h * 0.83); ctx.scale(sceneScale, sceneScale);
  // A door left open in an abandoned containment corridor.
  ctx.fillStyle = '#090e10'; ctx.fillRect(-119, -392, 242, 397);
  ctx.fillStyle = '#354043'; ctx.fillRect(-125, -401, 252, 8); ctx.fillRect(-127, -393, 10, 395); ctx.fillRect(119, -393, 9, 395);
  ctx.fillStyle = '#0c1113'; ctx.fillRect(-112, -386, 224, 383);
  ctx.strokeStyle = '#1d2525'; ctx.lineWidth = 5;
  for (let x = -92; x <= 92; x += 32) { ctx.beginPath(); ctx.moveTo(x, -380); ctx.lineTo(x, -280); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(-111, -321); ctx.lineTo(111, -321); ctx.stroke();
  // Uneven anatomical silhouette: bowed neck, one dragging arm and torn coat.
  ctx.fillStyle = '#202528'; ctx.strokeStyle = '#2e3433'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-20, -255); ctx.bezierCurveTo(-48, -277, -35, -311, -14, -314);
  ctx.bezierCurveTo(6, -320, 22, -298, 9, -282); ctx.lineTo(26, -272);
  ctx.bezierCurveTo(51, -263, 61, -239, 58, -213); ctx.lineTo(73, -171);
  ctx.lineTo(64, -117); ctx.lineTo(55, -110); ctx.lineTo(54, -171); ctx.lineTo(33, -208);
  ctx.lineTo(37, -160); ctx.lineTo(27, -128); ctx.lineTo(35, -77); ctx.lineTo(48, -20);
  ctx.lineTo(36, -12); ctx.lineTo(21, -21); ctx.lineTo(10, -77); ctx.lineTo(-4, -119);
  ctx.lineTo(-18, -78); ctx.lineTo(-16, -14); ctx.lineTo(-37, -9); ctx.lineTo(-41, -19);
  ctx.lineTo(-39, -80); ctx.lineTo(-35, -144); ctx.lineTo(-48, -175); ctx.lineTo(-44, -213);
  ctx.lineTo(-64, -179); ctx.lineTo(-71, -124); ctx.lineTo(-85, -100); ctx.lineTo(-92, -105);
  ctx.lineTo(-83, -134); ctx.lineTo(-80, -191); ctx.lineTo(-59, -247); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#482f2b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-29, -248); ctx.lineTo(-9, -210); ctx.lineTo(-17, -174); ctx.stroke();
  ctx.fillStyle = '#6c5b49'; ctx.fillRect(-18, -293, 4, 2); ctx.fillRect(-5, -290, 3, 2);
  // Angled steel door and bolt; keeps the figure partially concealed.
  ctx.fillStyle = '#202a2e'; ctx.beginPath(); ctx.moveTo(50, -382); ctx.lineTo(112, -365); ctx.lineTo(112, 0); ctx.lineTo(50, -19); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#435050'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#9c8b68'; ctx.fillRect(64, -189, 18, 4);
  ctx.fillStyle = '#473530'; ctx.fillRect(60, -342, 2, 133);
  // A small practical emergency light, no full-screen color wash.
  ctx.fillStyle = '#090d0f'; ctx.fillRect(-39, -432, 78, 22);
  ctx.fillStyle = '#733934'; ctx.fillRect(-31, -428, 62, 11);
  ctx.fillStyle = '#b36a54'; ctx.fillRect(-24, -427, 48, 3);
  ctx.fillStyle = '#8f7c51'; ctx.fillRect(-138, 1, 278, 13);
  ctx.fillStyle = '#252824';
  for (let i = -130; i < 140; i += 27) { ctx.beginPath(); ctx.moveTo(i, 1); ctx.lineTo(i + 12, 1); ctx.lineTo(i + 2, 14); ctx.lineTo(i - 10, 14); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = '#344146'; ctx.fillRect(-213, -265, 66, 87); ctx.strokeStyle = '#69736e'; ctx.lineWidth = 1; ctx.strokeRect(-213, -265, 66, 87);
  ctx.fillStyle = '#b1aa86'; ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center'; ctx.fillText('CÁCH LY', -180, -245);
  ctx.font = 'bold 30px Arial'; ctx.fillText('03', -180, -210);
  drawBloodHandprint(ctx, 166, -201, 0.85, -0.23);
  ctx.restore();
  // Floor catches a sliver of light. Stains remain below the interactive content.
  ctx.fillStyle = '#0b1114'; ctx.fillRect(0, h * 0.85, w, h * 0.15);
  ctx.strokeStyle = '#263034'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, h * 0.85); ctx.lineTo(w, h * 0.85); ctx.stroke();
  ctx.fillStyle = '#362421';
  ctx.beginPath(); ctx.ellipse(sceneX - 30, h * 0.89, 80 * sceneScale, 11, -0.04, 0, Math.PI * 2); ctx.fill();
  const shade = ctx.createLinearGradient(0, 0, w, 0);
  shade.addColorStop(0, 'rgba(6,11,14,0.62)'); shade.addColorStop(0.4, 'rgba(6,11,14,0.28)'); shade.addColorStop(1, 'rgba(6,11,14,0.04)');
  ctx.fillStyle = shade; ctx.fillRect(0, 0, w, h);
  return canvas;
}
