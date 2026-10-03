// ─── Tactical Shooter Crosshair & Reticle Renderer ───

export class CrosshairRenderer {
  private static recoilOffset = 0;

  static draw(
    ctx: CanvasRenderingContext2D,
    mouseX: number,
    mouseY: number,
    playerScreenX: number,
    playerScreenY: number,
    isFiring: boolean,
    isTargetLocked: boolean
  ): void {
    // Dynamic recoil spread
    if (isFiring) {
      this.recoilOffset = Math.min(8, this.recoilOffset + 2.5);
    } else {
      this.recoilOffset = Math.max(0, this.recoilOffset - 0.4);
    }

    const spread = this.recoilOffset;
    const aimAngle = Math.atan2(mouseY - playerScreenY, mouseX - playerScreenX);

    ctx.save();
    ctx.translate(mouseX, mouseY);

    // Color theme: Neon Cyan (Normal) or Crimson Red (Target Locked on Zombie)
    const primaryColor = isTargetLocked ? '#ff2a4b' : '#00f0ff';
    const glowColor = isTargetLocked ? 'rgba(255, 42, 75, 0.7)' : 'rgba(0, 240, 255, 0.6)';
    const coreColor = isTargetLocked ? '#ffffff' : '#e6ffff';

    ctx.shadowColor = glowColor;
    ctx.shadowBlur = isTargetLocked ? 10 : 7;

    // ─── 1. Tactical Shooter Directional Arrow (Chevron Pointer) ───
    ctx.save();
    ctx.rotate(aimAngle);

    // Dynamic Chevron Arrowhead pointing towards target
    const arrowDist = 19 + spread * 0.9;
    
    // Outer Arrow
    ctx.fillStyle = primaryColor;
    ctx.beginPath();
    ctx.moveTo(arrowDist + 15, 0); // Sharp forward point
    ctx.lineTo(arrowDist, -8.5);
    ctx.lineTo(arrowDist + 4.5, 0);
    ctx.lineTo(arrowDist, 8.5);
    ctx.closePath();
    ctx.fill();

    // Inner Core Glow
    ctx.fillStyle = coreColor;
    ctx.beginPath();
    ctx.moveTo(arrowDist + 11, 0);
    ctx.lineTo(arrowDist + 2.5, -4.5);
    ctx.lineTo(arrowDist + 5, 0);
    ctx.lineTo(arrowDist + 2.5, 4.5);
    ctx.closePath();
    ctx.fill();

    // Rear counter-chevron tick
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-arrowDist - 4, -4);
    ctx.lineTo(-arrowDist, 0);
    ctx.lineTo(-arrowDist - 4, 4);
    ctx.stroke();

    ctx.restore();

    // ─── 2. Center Precision Aim Pip ───
    ctx.fillStyle = coreColor;
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // ─── 3. Tactical Reticle Brackets [ + ] ───
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';

    const gap = 8 + spread;
    const len = 8;

    // Left bracket
    ctx.beginPath();
    ctx.moveTo(-gap, 0);
    ctx.lineTo(-gap - len, 0);
    // Right bracket
    ctx.moveTo(gap, 0);
    ctx.lineTo(gap + len, 0);
    // Top bracket
    ctx.moveTo(0, -gap);
    ctx.lineTo(0, -gap - len);
    // Bottom bracket
    ctx.moveTo(0, gap);
    ctx.lineTo(0, gap + len);
    ctx.stroke();

    // ─── 4. Target Locked Indicator ───
    if (isTargetLocked) {
      // Small tactical diamond lock around target
      const lockSize = 13 + spread;
      ctx.strokeStyle = '#ff2a4b';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, -lockSize);
      ctx.lineTo(lockSize, 0);
      ctx.lineTo(0, lockSize);
      ctx.lineTo(-lockSize, 0);
      ctx.closePath();
      ctx.stroke();

      // Corner tick marks
      const cOff = lockSize + 4;
      ctx.fillStyle = '#ff2a4b';
      ctx.fillRect(-cOff - 1, -1, 3, 2);
      ctx.fillRect(cOff - 2, -1, 3, 2);
      ctx.fillRect(-1, -cOff - 1, 2, 3);
      ctx.fillRect(-1, cOff - 2, 2, 3);
    } else {
      // Subtle outer dashed ring
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
      ctx.lineWidth = 1.0;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.arc(0, 0, 16 + spread, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}
