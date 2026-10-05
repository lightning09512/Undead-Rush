export type TouchAction = 'dash' | 'rage';

export interface TouchActionButton {
  id: TouchAction;
  x: number;
  y: number;
  size: number;
  label: string;
}

export interface TouchSkillState {
  dashCooldown: number;
  dashCooldownMax: number;
  ragePercent: number;
  rageCooldown: number;
  rageCooldownMax: number;
  rageActiveTimer: number;
}

export function getTouchActionButtons(width: number, height: number): TouchActionButton[] {
  const size = Math.max(52, Math.min(72, width * 0.065, height * 0.11));
  const small = size * 0.78;
  const pad = Math.max(14, size * 0.22);
  // Keep only the two skill buttons visible in a compact pair at bottom-right.
  // Leave a clear lane above the weapon HUD on narrow screens; input hitboxes
  // use this exact layout so touch and mouse activation remain aligned.
  const compactHudLift = width < 760 ? Math.min(136, Math.max(120, height * 0.22)) : 0;
  const skillY = height - pad - small - compactHudLift;
  const dashX = width - pad - small;
  const rageX = dashX - small - 10;
  return [
    { id: 'rage', x: rageX, y: skillY, size: small, label: 'NỘ' },
    { id: 'dash', x: dashX, y: skillY, size: small, label: 'LƯỚT' },
  ];
}

export function drawTouchActionButtons(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  skills?: TouchSkillState
): void {
  const buttons = getTouchActionButtons(width, height);
  const styles: Record<TouchAction, { fill: string; stroke: string }> = {
    dash: { fill: 'rgba(35, 77, 84, 0.58)', stroke: 'rgba(118, 180, 193, 0.82)' },
    rage: { fill: 'rgba(91, 42, 37, 0.68)', stroke: 'rgba(202, 104, 78, 0.9)' },
  };
  for (const button of buttons) {
    const style = styles[button.id];
    drawSkillButton(ctx, button, style, skills);
  }
}

function drawSkillButton(
  ctx: CanvasRenderingContext2D,
  button: TouchActionButton,
  style: { fill: string; stroke: string },
  skills?: TouchSkillState
): void {
  const { x, y, size, id } = button;
  const isRage = id === 'rage';
  const cooldown = isRage ? skills?.rageCooldown ?? 0 : skills?.dashCooldown ?? 0;
  const cooldownMax = isRage ? skills?.rageCooldownMax ?? 1 : skills?.dashCooldownMax ?? 1;
  const charge = Math.max(0, Math.min(1, (skills?.ragePercent ?? 0) / 100));
  const ready = isRage ? cooldown <= 0 && charge >= 1 && (skills?.rageActiveTimer ?? 0) <= 0 : cooldown <= 0;
  const cx = x + size / 2;
  const cy = y + size * 0.42;
  const radius = size * 0.34;
  const remaining = Math.max(0, Math.min(1, cooldown / Math.max(0.001, cooldownMax)));

  ctx.save();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.fillStyle = style.fill;
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 8);
  ctx.fill();
  ctx.stroke();

  // A compact ability medallion replaces the old text-only keyboard prompt.
  ctx.fillStyle = isRage ? 'rgba(22, 14, 14, 0.88)' : 'rgba(10, 22, 25, 0.88)';
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.84, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = isRage ? 'rgba(229, 130, 88, 0.8)' : 'rgba(116, 190, 200, 0.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  if (isRage && cooldown <= 0 && charge < 1) {
    // Before its first use, Rage still builds from kills. Show that charge as a
    // conventional ring; after activation the countdown uses a CCW wipe.
    ctx.strokeStyle = 'rgba(229, 144, 91, 0.95)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 1.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * charge);
    ctx.stroke();
  } else if (!isRage && cooldown <= 0) {
    ctx.strokeStyle = 'rgba(116, 190, 200, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 1, -Math.PI / 2, Math.PI * 1.5);
    ctx.stroke();
  }

  if (cooldown > 0) {
    // Darken the unrefilled portion. It shrinks counterclockwise as time passes.
    ctx.fillStyle = 'rgba(4, 8, 10, 0.76)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius * 0.84, -Math.PI / 2, -Math.PI / 2 - Math.PI * 2 * remaining, true);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = isRage ? 'rgba(238, 145, 91, 0.98)' : 'rgba(128, 208, 216, 0.98)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 1.5, -Math.PI / 2, -Math.PI / 2 - Math.PI * 2 * (1 - remaining), true);
    ctx.stroke();
  }

  drawSkillGlyph(ctx, cx, cy - size * 0.015, size * 0.8, isRage, ready && cooldown <= 0);

  if (cooldown > 0) {
    ctx.fillStyle = '#fff4e7';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.max(10, size * 0.22)}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText(`${Math.ceil(cooldown)}`, cx, cy + size * 0.015);
    ctx.fillStyle = 'rgba(255, 235, 218, 0.86)';
    ctx.font = `800 ${Math.max(7, size * 0.105)}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText('GIÂY', cx, cy + size * 0.18);
  } else if (isRage && charge < 1) {
    ctx.fillStyle = '#f1d9bf';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.max(9, size * 0.18)}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText(`${Math.floor(charge * 100)}%`, cx, cy + size * 0.02);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = ready && isRage ? '#ffd294' : '#f1eee7';
  ctx.font = `900 ${Math.max(9, size * 0.145)}px 'Segoe UI', Arial, sans-serif`;
  ctx.fillText(button.label, cx, y + size * 0.88);

  // Keep the keyboard shortcut visible without covering the ability icon or cooldown.
  const keyLabel = isRage ? 'F' : 'SHIFT';
  const keyWidth = isRage ? 18 : 34;
  const keyHeight = 11;
  const keyX = cx - keyWidth / 2;
  const keyY = y - keyHeight - 3;
  ctx.fillStyle = isRage ? 'rgba(40, 21, 19, 0.96)' : 'rgba(12, 26, 29, 0.96)';
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(keyX, keyY, keyWidth, keyHeight, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f1eee7';
  ctx.font = `900 ${Math.max(7, size * 0.115)}px 'Segoe UI', Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(keyLabel, cx, keyY + keyHeight / 2);
  ctx.restore();
}

function drawSkillGlyph(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, rage: boolean, ready: boolean): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(size / 52, size / 52);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (rage) {
    ctx.fillStyle = ready ? '#f2aa62' : '#cf684b';
    ctx.beginPath();
    ctx.moveTo(-2, 15);
    ctx.bezierCurveTo(-17, 8, -10, -5, -3, -15);
    ctx.bezierCurveTo(-3, -7, 3, -6, 4, -1);
    ctx.bezierCurveTo(6, -9, 12, -13, 13, -18);
    ctx.bezierCurveTo(23, -4, 21, 8, 10, 15);
    ctx.bezierCurveTo(6, 18, 1, 18, -2, 15);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 223, 160, 0.92)';
    ctx.beginPath();
    ctx.moveTo(5, 12);
    ctx.bezierCurveTo(0, 8, 5, 3, 8, 0);
    ctx.bezierCurveTo(13, 6, 12, 10, 5, 12);
    ctx.fill();
  } else {
    ctx.strokeStyle = ready ? '#9fe2e5' : '#77b9c2';
    ctx.lineWidth = 3.5;
    for (let i = 0; i < 3; i++) {
      const offset = (i - 1) * 10;
      ctx.beginPath();
      ctx.moveTo(-13 + i * 2, offset + 5);
      ctx.lineTo(-3 + i * 2, offset - 3);
      ctx.lineTo(4 + i * 2, offset - 3);
      ctx.stroke();
    }
    ctx.fillStyle = '#d9f4f4';
    ctx.beginPath();
    ctx.moveTo(6, -12);
    ctx.lineTo(17, 0);
    ctx.lineTo(6, 12);
    ctx.lineTo(9, 3);
    ctx.lineTo(1, 0);
    ctx.lineTo(9, -3);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
