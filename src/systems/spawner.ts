// ─── Spawner: controls zombie spawning and difficulty ───

import { ZOMBIE_TYPES, DIFFICULTY_CURVE, BOSS_SPAWN_TIMES, ZombieTypeDef, DifficultyTier } from '../data/zombies';
import { Camera } from '../core/camera';

export class Spawner {
  private spawnTimer = 0;
  private bossesSpawned = new Set<number>();

  getCurrentTier(gameTime: number): DifficultyTier {
    let tier = DIFFICULTY_CURVE[0];
    for (const t of DIFFICULTY_CURVE) {
      if (gameTime >= t.time) tier = t;
      else break;
    }
    return tier;
  }

  /** Get list of zombies that should be spawned this frame */
  update(
    dt: number, gameTime: number, currentZombieCount: number,
    camera: Camera, playerX: number, playerY: number
  ): { type: ZombieTypeDef; x: number; y: number; tier: DifficultyTier }[] {
    const tier = this.getCurrentTier(gameTime);
    const spawns: { type: ZombieTypeDef; x: number; y: number; tier: DifficultyTier }[] = [];

    // Check boss spawn
    for (const bossTime of BOSS_SPAWN_TIMES) {
      if (gameTime >= bossTime && !this.bossesSpawned.has(bossTime)) {
        this.bossesSpawned.add(bossTime);
        // Pick appropriate boss
        const bosses = ZOMBIE_TYPES.filter(z => z.isBoss && z.minTime <= gameTime);
        if (bosses.length > 0) {
          const boss = bosses[bosses.length - 1]; // hardest available
          const pos = this.getSpawnPosition(camera, playerX, playerY);
          spawns.push({ type: boss, x: pos.x, y: pos.y, tier });
        }
      }
    }

    // Regular spawning
    if (currentZombieCount >= tier.maxZombies) return spawns;

    this.spawnTimer += dt * tier.spawnRate;
    while (this.spawnTimer >= 1) {
      this.spawnTimer -= 1;

      const batch = tier.batchSize;
      for (let i = 0; i < batch; i++) {
        if (currentZombieCount + spawns.length >= tier.maxZombies) break;

        const type = this.pickZombieType(gameTime);
        if (type) {
          const pos = this.getSpawnPosition(camera, playerX, playerY);
          spawns.push({ type, x: pos.x, y: pos.y, tier });
        }
      }
    }

    return spawns;
  }

  private pickZombieType(gameTime: number): ZombieTypeDef | null {
    const available = ZOMBIE_TYPES.filter(z => !z.isBoss && gameTime >= z.minTime);
    if (available.length === 0) return null;

    // Weighted random
    const totalWeight = available.reduce((sum, z) => sum + z.weight, 0);
    let r = Math.random() * totalWeight;
    for (const z of available) {
      r -= z.weight;
      if (r <= 0) return z;
    }
    return available[available.length - 1];
  }

  /** Spawn just outside visible screen */
  private getSpawnPosition(camera: Camera, playerX: number, playerY: number): { x: number; y: number } {
    const margin = 80;
    const side = Math.floor(Math.random() * 4);

    let x: number, y: number;
    switch (side) {
      case 0: // top
        x = camera.x + Math.random() * camera.width;
        y = camera.y - margin;
        break;
      case 1: // bottom
        x = camera.x + Math.random() * camera.width;
        y = camera.y + camera.height + margin;
        break;
      case 2: // left
        x = camera.x - margin;
        y = camera.y + Math.random() * camera.height;
        break;
      default: // right
        x = camera.x + camera.width + margin;
        y = camera.y + Math.random() * camera.height;
        break;
    }

    // Clamp to map
    x = Math.max(30, Math.min(3970, x));
    y = Math.max(30, Math.min(3970, y));

    return { x, y };
  }

  reset(): void {
    this.spawnTimer = 0;
    this.bossesSpawned.clear();
  }
}
