import type { Zombie } from '../entities/zombies';

const COLUMNS = 4;
const ROWS = 6;
const ROW_BY_TYPE: Record<string, number> = {
  normal: 0,
  runner: 1,
  tank: 2,
  exploder: 3,
  spitter: 4,
  glowing: 5,
};

let atlas: HTMLImageElement | null = null;

function getAtlas(): HTMLImageElement {
  if (atlas) return atlas;
  atlas = new Image();
  atlas.decoding = 'async';
  atlas.src = '/assets/zombie-gesture-atlas.webp';
  return atlas;
}

/** Draws animated pose frames for the six common zombie types. */
export function drawZombieGestureSprite(
  ctx: CanvasRenderingContext2D,
  z: Zombie,
  x: number,
  y: number,
  flash: boolean,
): boolean {
  const row = ROW_BY_TYPE[z.typeId];
  if (row === undefined || z.isBoss) return false;

  const image = getAtlas();
  if (!image.complete || image.naturalWidth === 0) return false;

  const speed = Math.hypot(z.vx, z.vy);
  const striking = z.visualStrike > 0.02 || z.visualWindup > 0.72 ||
    z.specialState === 'windup' || z.specialState === 'active';
  const step = Math.floor(z.walkDist * 0.92 + z.wobble * 0.18 + z.id * 0.37) & 1;
  const column = striking ? 3 : speed > 5 ? 1 + step : 0;
  const frameW = image.naturalWidth / COLUMNS;
  const frameH = image.naturalHeight / ROWS;
  const bodySize = z.size * (z.typeId === 'tank' ? 4.35 : 4.65);
  const bob = speed > 5
    ? Math.sin(z.walkDist * 2 + z.wobble) * bodySize * 0.012
    : Math.sin(z.animTimer * 1.7 + z.wobble) * bodySize * 0.009;
  const sway = striking ? 0 : Math.sin(z.animTimer * (speed > 5 ? 1.1 : 1.5) + z.wobble) * (speed > 5 ? 0.018 : 0.032);

  ctx.save();
  ctx.translate(x, y + bob);
  ctx.rotate(z.facingAngle + sway);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
  ctx.beginPath();
  ctx.ellipse(-bodySize * 0.04, bodySize * 0.2, bodySize * 0.27, bodySize * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.filter = flash ? 'brightness(0) invert(1)' : 'none';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image,
    column * frameW, row * frameH, frameW, frameH,
    -bodySize / 2, -bodySize / 2, bodySize, bodySize);
  ctx.restore();
  return true;
}
