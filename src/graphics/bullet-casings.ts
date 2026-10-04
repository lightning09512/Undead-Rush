import type { Camera } from '../core/camera';
import type { HeldGunShape } from './held-gun';

type Casing = { x: number; y: number; vx: number; vy: number; height: number; vz: number;
  angle: number; spin: number; age: number; delay: number; kind: HeldGunShape['casing'] };

/** Decorative world-space casings, pooled and capped independently of projectiles. */
export class BulletCasings {
  private readonly items: Casing[] = [];
  private next = 0;
  private shotInterval = 0;
  private readonly capacity = 160;

  clear(): void { this.items.length = 0; this.next = 0; this.shotInterval = 0; }

  spawn(playerX: number, playerY: number, aim: number, shape: HeldGunShape): void {
    if (shape.casing === 'none' || this.shotInterval > 0) return;
    this.shotInterval = shape.casing === 'small' ? .055 : .035;
    const sideX = Math.sin(aim), sideY = -Math.cos(aim);
    const alongX = Math.cos(aim), alongY = Math.sin(aim);
    const casing = this.items[this.next] ?? { x: 0, y: 0, vx: 0, vy: 0, height: 0, vz: 0,
      angle: 0, spin: 0, age: 0, delay: 0, kind: shape.casing };
    casing.x = playerX + alongX * (shape.grip + 6) + sideX * 5;
    casing.y = playerY + alongY * (shape.grip + 6) + sideY * 5;
    casing.vx = sideX * (72 + Math.random() * 46) + alongX * (Math.random() - .5) * 35;
    casing.vy = sideY * (72 + Math.random() * 46) + alongY * (Math.random() - .5) * 35;
    casing.height = 4; casing.vz = 60 + Math.random() * 45;
    casing.angle = aim; casing.spin = (Math.random() - .5) * 19;
    casing.age = 0; casing.delay = shape.casing === 'shell' ? .2 : 0;
    casing.kind = shape.casing;
    if (this.items.length < this.capacity) this.items.push(casing);
    this.next = (this.next + 1) % this.capacity;
  }

  update(dt: number): void {
    this.shotInterval = Math.max(0, this.shotInterval - dt);
    for (const c of this.items) {
      if (c.delay > 0) { c.delay -= dt; continue; }
      c.age += dt;
      if (c.height <= 0) continue;
      c.x += c.vx * dt; c.y += c.vy * dt;
      c.height = Math.max(0, c.height + c.vz * dt);
      c.vz -= 390 * dt; c.angle += c.spin * dt;
      if (c.height === 0) { c.vx = 0; c.vy = 0; c.spin = 0; }
    }
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    for (const c of this.items) {
      if (c.delay > 0 || c.age > 7 || !camera.isVisible(c.x, c.y, 12)) continue;
      const x = c.x - camera.x + camera.shakeX;
      const y = c.y - camera.y + camera.shakeY;
      const size = c.kind === 'shell' ? 7 : c.kind === 'heavy' ? 6 : c.kind === 'small' ? 3.5 : 5;
      ctx.save();ctx.translate(x, y - c.height);ctx.rotate(c.angle);
      ctx.globalAlpha = c.age > 5 ? Math.max(0, (7 - c.age) / 2) : .9;
      ctx.fillStyle = c.kind === 'shell' ? '#a7683f' : '#bd9a5f';
      ctx.fillRect(-size / 2, -1.5, size, 3);
      ctx.fillStyle = c.kind === 'shell' ? '#42302a' : '#574a35';
      ctx.fillRect(size / 2 - 1.3, -1.5, 1.3, 3);
      ctx.restore();
    }
  }
}
