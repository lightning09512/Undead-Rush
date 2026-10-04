export type TouchAction = 'fire' | 'reload' | 'grenade' | 'dash' | 'interact';

export interface TouchActionButton {
  id: TouchAction;
  x: number;
  y: number;
  size: number;
  label: string;
  hint: string;
}

export function getTouchActionButtons(width: number, height: number, includeInteract = false): TouchActionButton[] {
  const size = Math.max(52, Math.min(72, width * 0.065, height * 0.11));
  const small = size * 0.78;
  const pad = Math.max(14, size * 0.22);
  const fireX = width - pad - size;
  // Leave a clear lane above the bottom weapon HUD on narrow screens. The
  // input hitboxes use this same layout, so touch and mouse controls stay aligned.
  const compactHudLift = width < 760 ? Math.min(136, Math.max(120, height * 0.22)) : 0;
  const fireY = height - pad - size - compactHudLift;
  const buttons: TouchActionButton[] = [
    { id: 'fire', x: fireX, y: fireY, size, label: 'BẮN', hint: 'GIỮ' },
    { id: 'reload', x: fireX + size * 0.18, y: fireY - small - 10, size: small, label: 'ĐẠN', hint: 'R' },
    { id: 'grenade', x: fireX - small - 10, y: fireY - small - 10, size: small, label: 'LỰU', hint: 'G' },
    { id: 'dash', x: fireX - small - 10, y: fireY + size - small, size: small, label: 'LƯỚT', hint: 'SHIFT' },
  ];
  if (includeInteract) buttons.push({ id: 'interact', x: fireX - small * 2 - 18, y: fireY - small - 10, size: small, label: 'DÙNG', hint: 'E' });
  return buttons;
}

export function drawTouchActionButtons(ctx: CanvasRenderingContext2D, width: number, height: number, includeInteract = false): void {
  const buttons = getTouchActionButtons(width, height, includeInteract);
  const styles: Record<TouchAction, { fill: string; stroke: string }> = {
    fire: { fill: 'rgba(125, 48, 47, 0.58)', stroke: 'rgba(224, 120, 105, 0.82)' },
    reload: { fill: 'rgba(98, 75, 43, 0.55)', stroke: 'rgba(212, 170, 99, 0.82)' },
    grenade: { fill: 'rgba(98, 75, 43, 0.55)', stroke: 'rgba(212, 170, 99, 0.82)' },
    dash: { fill: 'rgba(35, 77, 84, 0.58)', stroke: 'rgba(118, 180, 193, 0.82)' },
    interact: { fill: 'rgba(68, 91, 66, 0.72)', stroke: 'rgba(150, 186, 119, 0.9)' },
  };
  for (const button of buttons) {
    const { x, y, size } = button;
    const isFire = button.id === 'fire';
    const style = styles[button.id];
    ctx.save();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.fillStyle = style.fill;
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = isFire ? 1.5 : 1;
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, 6);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f1eee7';
    ctx.font = `900 ${Math.max(10, size * (isFire ? 0.19 : 0.17))}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText(button.label, x + size / 2, y + size * 0.46);
    ctx.fillStyle = 'rgba(225, 232, 228, 0.72)';
    ctx.font = `bold ${Math.max(8, size * 0.12)}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText(button.hint, x + size / 2, y + size * 0.72);
    ctx.restore();
  }
}
