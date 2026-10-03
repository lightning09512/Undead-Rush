import { Player } from '../entities/player';
import { Zombie } from '../entities/zombies';
import { BulletSystem } from '../entities/bullets';
import { Audio } from '../core/audio';
import { Pool } from '../core/pool';
import { Input } from '../core/input';
import { Camera } from '../core/camera';
import { GunLoadout } from './gun-loadout';

export class WeaponSystem {
  readonly loadout = new GunLoadout();
  private grenadeTimer = 0;
  private mineTimer = 0;
  private shotgunTimer = 0;
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

  private updateAim(player: Player, input: Input, target: Zombie | null, camera?: Camera): void {
    if (input.hasTouchAim) {
      player.aimAngle = Math.atan2(input.rightAimY, input.rightAimX);
    } else if (input.mouseX !== undefined && input.mouseY !== undefined) {
      if (camera) {
        const [mouseWorldX, mouseWorldY] = camera.windowScreenToWorld(input.mouseX, input.mouseY);
        player.aimAngle = Math.atan2(mouseWorldY - player.y, mouseWorldX - player.x);
      } else {
        const screenPlayerX = window.innerWidth / 2;
        const screenPlayerY = window.innerHeight / 2;
        player.aimAngle = Math.atan2(input.mouseY - screenPlayerY, input.mouseX - screenPlayerX);
      }
    } else if (target) {
      player.aimAngle = Math.atan2(target.y - player.y, target.x - player.x);
    } else if (input.dirX !== 0 || input.dirY !== 0) {
      player.aimAngle = Math.atan2(input.dirY, input.dirX);
    }
  }

  update(
    dt: number,
    player: Player,
    input: Input,
    zombies: Pool<Zombie>,
    bullets: BulletSystem,
    audio: Audio,
    camera?: Camera
  ): void {
    const activeZombies = zombies.getActive();
    const target = this.findNearestZombie(player, activeZombies);
    this.updateAim(player, input, target, camera);

    // Primary weapon spray, reload & switching handled by GunLoadout
    if (camera) {
      this.loadout.update(dt, player, input, bullets, audio, camera);
    }

    const mineLevel = player.upgrades.get('mines') || 0;
    if (mineLevel > 0 && player.isMoving) {
      this.mineTimer -= dt;
      const interval = Math.max(0.8, 2.5 - mineLevel * 0.3);
      if (this.mineTimer <= 0) {
        this.dropMine(player, bullets, mineLevel);
        this.mineTimer = interval;
      }
    }

    const droneLevel = player.upgrades.get('drone') || 0;
    if (droneLevel > 0) {
      this.updateDrones(dt, player, activeZombies, bullets, audio, droneLevel);
    }
  }

  private fireMainWeapon(player: Player, bullets: BulletSystem, audio: Audio): void {
    const dualLevel = player.upgrades.get('dual_pistols') || 0;
    const bulletCount = dualLevel > 0 ? dualLevel + 1 : 1;

    for (let i = 0; i < bulletCount; i++) {
      const spread = bulletCount > 1 ? (i - (bulletCount - 1) / 2) * 0.12 : 0;
      const angle = player.aimAngle + spread;

      bullets.fire(
        player.x, player.y, angle,
        player.bulletDamage, player.bulletSpeed, player.bulletSize, player.bulletColor,
        player.pierceCount, player.explosiveRadius, player.burnDamage, player.slowMultiplier < 1 ? player.slowMultiplier : 0
      );
    }

    player.recoilX -= Math.cos(player.aimAngle) * 6;
    player.recoilY -= Math.sin(player.aimAngle) * 6;
    player.muzzleFlashTimer = 0.05;

    audio.shoot();
  }

  private fireShotgun(
    player: Player,
    bullets: BulletSystem,
    audio: Audio,
    level: number,
    target: Zombie | null
  ): void {
    const pellets = [5, 7, 9, 11, 14][level - 1] || 5;
    const spreadAngle = 0.8;
    let angle = player.aimAngle;
    if (target) {
      angle = Math.atan2(target.y - player.y, target.x - player.x);
    }

    for (let i = 0; i < pellets; i++) {
      const pelletAngle = angle + (i / (pellets - 1) - 0.5) * spreadAngle;
      bullets.fire(
        player.x, player.y, pelletAngle,
        Math.round(player.bulletDamage * 0.6), player.bulletSpeed * 0.8,
        3, '#ffaa44',
        0, 0, player.burnDamage, 0, 'shotgun'
      );
    }
    player.recoilX -= Math.cos(angle) * 12;
    player.recoilY -= Math.sin(angle) * 12;
    player.muzzleFlashTimer = 0.08;
    audio.shotgun();
  }

  private throwGrenade(player: Player, target: Zombie, bullets: BulletSystem, level: number, audio: Audio): void {
    const count = level;
    audio.grenadeLaunch();
    for (let i = 0; i < count; i++) {
      const angle = Math.atan2(target.y - player.y, target.x - player.x) + (Math.random() - 0.5) * 0.5;
      bullets.fire(
        player.x, player.y, angle,
        player.bulletDamage * 2, 200, 6, '#ff6600',
        0, 60 + level * 15, 0, 0, 'grenade'
      );
    }
  }

  private dropMine(player: Player, bullets: BulletSystem, level: number): void {
    const behind = player.aimAngle + Math.PI;
    const dist = 28;
    const mx = player.x + Math.cos(behind) * dist;
    const my = player.y + Math.sin(behind) * dist;
    const radius = 45 + level * 10;
    const b = bullets.fire(
      mx, my, 0,
      Math.round(player.bulletDamage * 1.5), 0, 8, '#aa6644',
      0, radius, 0, player.slowMultiplier < 1 ? player.slowMultiplier : 0, 'mine'
    );
    b.vx = 0;
    b.vy = 0;
    b.life = 12;
  }

  private updateDrones(
    dt: number,
    player: Player,
    zombies: readonly Zombie[],
    bullets: BulletSystem,
    audio: Audio,
    level: number
  ): void {
    while (this.droneAngles.length < level) {
      this.droneAngles.push((this.droneAngles.length / level) * Math.PI * 2);
    }

    for (let i = 0; i < level; i++) {
      this.droneAngles[i] += dt * 2;

      if (Math.sin(this.droneAngles[i] * 3) > 0.95) {
        const droneX = player.x + Math.cos(this.droneAngles[i]) * 60;
        const droneY = player.y + Math.sin(this.droneAngles[i]) * 60;

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
          audio.droneShoot(Math.cos(this.droneAngles[i]) * 0.28);
        }
      }
    }
  }

  reset(): void {
    this.loadout.reset();
    this.grenadeTimer = 0;
    this.mineTimer = 0;
    this.shotgunTimer = 0;
    this.droneAngles = [];
  }
}
