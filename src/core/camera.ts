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

  /** Smoothing factor (0=instant, higher=smoother) */
  private smoothing = 8;

  resize(w: number, h: number): void {
    this.width = w;
    this.height = h;
  }

  follow(targetX: number, targetY: number, dt: number): void {
    const goalX = targetX - this.width / 2;
    const goalY = targetY - this.height / 2;

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

  /** Convert world coords to screen coords */
  worldToScreen(wx: number, wy: number): [number, number] {
    return [wx - this.x + this.shakeX, wy - this.y + this.shakeY];
  }

  /** Check if a world rect is visible on screen */
  isVisible(wx: number, wy: number, margin = 50): boolean {
    return (
      wx > this.x - margin &&
      wx < this.x + this.width + margin &&
      wy > this.y - margin &&
      wy < this.y + this.height + margin
    );
  }
}
