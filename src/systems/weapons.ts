// ─── Weapon System: handles auto-aim and firing logic ───

import { Player } from '../entities/player';
import { Zombie } from '../entities/zombies';
import { BulletSystem } from '../entities/bullets';
import { Audio } from '../core/audio';
import { Pool } from '../core/pool';

export class WeaponSystem {
  // Grenade timer
  private grenadeTimer = 0;
  // Mine timer
  private mineTimer = 0;
  // Drone angles
  private droneAngles: number[] = [];

  findNearestZombie(player: Player, zombies: readonly Zombie[]): Zombie | null {
    let nearest: Zombie | null = null;
    let nearestDist = player.fireRange * player.fireRange;

    for (const z of zombies) {
      if (z.hp <= 0) continue;
      const dx = z.x - player.x;
      const dy = z.y - player.y;
      const dist = dx * dx + dy * dy;
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = z;
      }
    }

    return nearest;
  }

  update(dt: number, player: Player, zombies: Pool<Zombie>, bullets: BulletSystem, audio: Audio): void {
    const activeZombies = zombies.getActive();

    // Find target
    const target = this.findNearestZombie(player, activeZombies);
    if (target) {
      player.aimAngle = Math.atan2(target.y - player.y, target.x - player.x);
    }

    // Main weapon fire
    if (target && player.fireCooldown <= 0) {
      this.fireMainWeapon(player, bullets, audio);
      player.fireCooldown = 1 / player.fireRate;
    }

    // Shotgun
    const shotgunLevel = player.upgrades.get('shotgun') || 0;
    if (shotgunLevel > 0 && target && player.fireCooldown <= 0.01) {
      this.fireShotgun(player, bullets, audio, shotgunLevel);
    }

    // Grenades
    const grenadeLevel = player.upgrades.get('grenades') || 0;
    if (grenadeLevel > 0) {
      this.grenadeTimer -= dt;
      if (this.grenadeTimer <= 0 && target) {
        this.throwGrenade(player, target, bullets, grenadeLevel);
        this.grenadeTimer = 3.0; // every 3 seconds
      }
    }

    // Drone
    const droneLevel = player.upgrades.get('drone') || 0;
    if (droneLevel > 0) {
      this.updateDrones(dt, player, activeZombies, bullets, audio, droneLevel);
    }
  }

  private fireMainWeapon(player: Player, bullets: BulletSystem, audio: Audio): void {
    const dualLevel = player.upgrades.get('dual_pistols') || 0;
    const bulletCount = dualLevel > 0 ? (dualLevel + 1) : 1;

    for (let i = 0; i < bulletCount; i++) {
      const spread = bulletCount > 1 ? (i - (bulletCount - 1) / 2) * 0.12 : 0;
      const angle = player.aimAngle + spread;

      bullets.fire(
        player.x, player.y, angle,
        player.bulletDamage, player.bulletSpeed, player.bulletSize, player.bulletColor,
        player.pierceCount, player.explosiveRadius, player.burnDamage, player.slowMultiplier < 1 ? player.slowMultiplier : 0
      );
    }

    audio.shoot();
  }

  private fireShotgun(player: Player, bullets: BulletSystem, audio: Audio, level: number): void {
    const pellets = [5, 7, 9, 11, 14][level - 1] || 5;
    const spreadAngle = 0.8; // radians total spread

    for (let i = 0; i < pellets; i++) {
      const angle = player.aimAngle + (i / (pellets - 1) - 0.5) * spreadAngle;
      bullets.fire(
        player.x, player.y, angle,
        Math.round(player.bulletDamage * 0.6), player.bulletSpeed * 0.8,
        3, '#ffaa44',
        0, 0, player.burnDamage, 0, 'shotgun'
      );
    }
  }

  private throwGrenade(player: Player, target: Zombie, bullets: BulletSystem, level: number): void {
    const count = level;
    for (let i = 0; i < count; i++) {
      const angle = Math.atan2(target.y - player.y, target.x - player.x) + (Math.random() - 0.5) * 0.5;
      bullets.fire(
        player.x, player.y, angle,
        player.bulletDamage * 2, 200, 6, '#ff6600',
        0, 60 + level * 15, 0, 0, 'grenade'
      );
    }
  }

  private updateDrones(dt: number, player: Player, zombies: readonly Zombie[], bullets: BulletSystem, audio: Audio, level: number): void {
    // Init drone angles
    while (this.droneAngles.length < level) {
      this.droneAngles.push((this.droneAngles.length / level) * Math.PI * 2);
    }

    for (let i = 0; i < level; i++) {
      this.droneAngles[i] += dt * 2;

      // Fire every ~0.5 seconds (use angle crossing)
      if (Math.sin(this.droneAngles[i] * 3) > 0.95) {
        const droneX = player.x + Math.cos(this.droneAngles[i]) * 60;
        const droneY = player.y + Math.sin(this.droneAngles[i]) * 60;

        // Find nearest zombie to drone
        let nearest: Zombie | null = null;
        let nearDist = 250 * 250;
        for (const z of zombies) {
          const dx = z.x - droneX;
          const dy = z.y - droneY;
          const d = dx * dx + dy * dy;
          if (d < nearDist) {
            nearDist = d;
            nearest = z;
          }
        }

        if (nearest) {
          const angle = Math.atan2(nearest.y - droneY, nearest.x - droneX);
          bullets.fire(
            droneX, droneY, angle,
            Math.round(player.bulletDamage * 0.5), 400, 3, '#88ffaa',
            0, 0, 0, 0, 'drone'
          );
        }
      }
    }
  }

  reset(): void {
    this.grenadeTimer = 0;
    this.mineTimer = 0;
    this.droneAngles = [];
  }
}
