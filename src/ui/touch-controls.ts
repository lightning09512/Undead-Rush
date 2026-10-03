export type TouchAction = 'fire' | 'reload' | 'grenade' | 'dash';

export interface TouchActionButton {
  id: TouchAction;
  x: number;
  y: number;
  size: number;
  label: string;
  hint: string;
}

export function getTouchActionButtons(width: number, height: number): TouchActionButton[] {
  const size = Math.max(52, Math.min(72, width * 0.065, height * 0.11));
  const small = size * 0.78;
  const pad = Math.max(14, size * 0.22);
  const fireX = width - pad - size;
  const fireY = height - pad - size;
  return [
    { id: 'fire', x: fireX, y: fireY, size, label: 'BẮN', hint: 'GIỮ' },
    { id: 'reload', x: fireX + size * 0.18, y: fireY - small - 10, size: small, label: 'ĐẠN', hint: 'R' },
    { id: 'grenade', x: fireX - small - 10, y: fireY - small - 10, size: small, label: 'LỰU', hint: 'G' },
    { id: 'dash', x: fireX - small - 10, y: fireY + size - small, size: small, label: 'LƯỚT', hint: 'SHIFT' },
  ];
}

export function drawTouchActionButtons(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const buttons = getTouchActionButtons(width, height);
  for (const button of buttons) {
    const { x, y, size } = button;
    const isFire = button.id === 'fire';
    ctx.save();
    ctx.shadowColor = isFire ? 'rgba(220,38,38,0.38)' : 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = isFire ? 14 : 8;
    ctx.fillStyle = isFire ? 'rgba(110, 18, 24, 0.58)' : 'rgba(15, 22, 30, 0.58)';
    ctx.strokeStyle = isFire ? 'rgba(255, 95, 82, 0.9)' : 'rgba(226, 232, 240, 0.66)';
    ctx.lineWidth = isFire ? 2 : 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, 9);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Inner glass edge and a restrained blood red corner slash.
    ctx.strokeStyle = 'rgba(255,255,255,0.13)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x + 4, y + 4, size - 8, size - 8, 6);
    ctx.stroke();
    ctx.strokeStyle = isFire ? 'rgba(255,80,70,0.65)' : 'rgba(248,113,113,0.38)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + size - 15, y + 5);
    ctx.lineTo(x + size - 5, y + 15);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff7f2';
    ctx.font = `900 ${Math.max(10, size * (isFire ? 0.19 : 0.17))}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText(button.label, x + size / 2, y + size * 0.46);
    ctx.fillStyle = 'rgba(255,235,225,0.68)';
    ctx.font = `bold ${Math.max(8, size * 0.12)}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillText(button.hint, x + size / 2, y + size * 0.72);
    ctx.restore();
  }
}
