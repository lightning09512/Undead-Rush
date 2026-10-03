// ─── Camera: follows player on a large map ───

import { MAP_CONFIG } from '../data/items';

export class Camera {
  x = 0;
  y = 0;
  width = 0;
  height = 0;
  shakeX = 0;
  shakeY = 0;
  private shakeIntensity = 0;
  private shakeDuration = 0;
  private shakeTimer = 0;

  /** Zoom factor: closer camera for intense, tactile action */
  zoom = 1.42;

  /** Smoothing factor for tracking */
  private smoothing = 9;

  resize(w: number, h: number): void {
    this.width = w;
    this.height = h;
  }

  follow(targetX: number, targetY: number, mouseScreenX: number, mouseScreenY: number, dt: number): void {
    const cx = this.width / 2;
    const cy = this.height / 2;

    // Shift camera slightly towards the mouse pointer (look-ahead)
    const mouseOffX = (mouseScreenX - cx) * 0.32;
    const mouseOffY = (mouseScreenY - cy) * 0.32;
    const offDist = Math.hypot(mouseOffX, mouseOffY);
    const maxLookAhead = 150;
    let lookX = mouseOffX;
    let lookY = mouseOffY;
    if (offDist > maxLookAhead) {
      lookX = (mouseOffX / offDist) * maxLookAhead;
      lookY = (mouseOffY / offDist) * maxLookAhead;
    }

    const goalX = (targetX + lookX) - cx;
    const goalY = (targetY + lookY) - cy;

    // Smooth lerp
    const t = 1 - Math.exp(-this.smoothing * dt);
    this.x += (goalX - this.x) * t;
    this.y += (goalY - this.y) * t;

    // Clamp to map bounds
    this.x = Math.max(0, Math.min(MAP_CONFIG.width - this.width, this.x));
    this.y = Math.max(0, Math.min(MAP_CONFIG.height - this.height, this.y));

    // Screen shake
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const progress = this.shakeTimer / this.shakeDuration;
      const intensity = this.shakeIntensity * progress;
      this.shakeX = (Math.random() - 0.5) * 2 * intensity;
      this.shakeY = (Math.random() - 0.5) * 2 * intensity;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  shake(intensity: number, duration: number): void {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
    this.shakeTimer = duration;
  }

  /** Convert world coords to screen coords (before zoom scaling) */
  worldToScreen(wx: number, wy: number): [number, number] {
    return [wx - this.x + this.shakeX, wy - this.y + this.shakeY];
  }

  /** Convert world coords to full window screen pixels (including zoom & center) */
  worldToWindowScreen(wx: number, wy: number): [number, number] {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const sx = wx - this.x + this.shakeX;
    const sy = wy - this.y + this.shakeY;
    return [
      cx + (sx - cx) * this.zoom,
      cy + (sy - cy) * this.zoom
    ];
  }

  /** Convert full window screen pixels (mouse) to world coordinates */
  windowScreenToWorld(sx: number, sy: number): [number, number] {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const unscaledX = cx + (sx - cx) / this.zoom;
    const unscaledY = cy + (sy - cy) / this.zoom;
    return [
      unscaledX + this.x - this.shakeX,
      unscaledY + this.y - this.shakeY
    ];
  }

  /** Check if a world rect is visible on screen */
  isVisible(wx: number, wy: number, margin = 60): boolean {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const halfW = (this.width / this.zoom) / 2 + margin;
    const halfH = (this.height / this.zoom) / 2 + margin;
    const centerX = this.x + cx;
    const centerY = this.y + cy;
    return (
      wx > centerX - halfW &&
      wx < centerX + halfW &&
      wy > centerY - halfH &&
      wy < centerY + halfH
    );
  }
}
