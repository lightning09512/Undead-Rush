// ─── Spawner: controls zombie spawning and difficulty ───

import { ZOMBIE_TYPES, HORROR_TYPES, DIFFICULTY_CURVE, BOSS_SPAWN_TIMES, ZombieTypeDef, DifficultyTier } from '../data/zombies';
import { Camera } from '../core/camera';

export const SURVIVAL_HORDE_MULTIPLIER = 3;

export class Spawner {
  private spawnTimer = 0;
  private bossesSpawned = new Set<number>();
  private static survivalRoster = [...ZOMBIE_TYPES, ...HORROR_TYPES];

  getCurrentTier(gameTime: number): DifficultyTier {
    let tier = DIFFICULTY_CURVE[0];
    for (const t of DIFFICULTY_CURVE) {
      if (gameTime >= t.time) tier = t;
      else break;
    }
    return tier;
  }

  /** One paced batch for the current authored Survival wave. */
  updateWave(
    dt: number, gameTime: number, currentZombieCount: number,
    camera: Camera, playerX: number, playerY: number, remaining: number
  ): { type: ZombieTypeDef; x: number; y: number; tier: DifficultyTier; isElite?: boolean }[] {
    const tier = this.getCurrentTier(gameTime);
    const activeLimit = tier.maxZombies * SURVIVAL_HORDE_MULTIPLIER;
    if (remaining <= 0 || currentZombieCount >= activeLimit) return [];
    this.spawnTimer += dt * tier.spawnRate;
    if (this.spawnTimer < 1) return [];
    this.spawnTimer -= 1;

    const batchSize = tier.batchSize * SURVIVAL_HORDE_MULTIPLIER;
    const count = Math.min(batchSize, remaining, activeLimit - currentZombieCount);
    const result: { type: ZombieTypeDef; x: number; y: number; tier: DifficultyTier; isElite?: boolean }[] = [];
    for (let i = 0; i < count; i++) {
      const type = this.pickZombieType(gameTime, true);
      if (!type) break;
      const pos = this.getSpawnPosition(camera, playerX, playerY);
      const eliteChance = gameTime >= 45 ? Math.min(.12, .04 + gameTime / 6000) : 0;
      result.push({ type, x: pos.x, y: pos.y, tier, isElite: Math.random() < eliteChance || undefined });
    }
    return result;
  }

  beginWave(): void { this.spawnTimer = 0; }

  /** Get list of zombies that should be spawned this frame */
  update(
    dt: number, gameTime: number, currentZombieCount: number,
    camera: Camera, playerX: number, playerY: number, survival = false,
    campaignMobIds?: readonly string[], suppressTimedBosses = false
  ): { type: ZombieTypeDef; x: number; y: number; tier: DifficultyTier; isElite?: boolean }[] {
    const tier = this.getCurrentTier(gameTime);
    const spawns: { type: ZombieTypeDef; x: number; y: number; tier: DifficultyTier; isElite?: boolean }[] = [];
    const zombieCap = campaignMobIds
      ? Math.min(tier.maxZombies, campaignMobIds.length >= 8 ? 15 : 12)
      : tier.maxZombies;

    // Check boss spawn
    for (const bossTime of suppressTimedBosses ? [] : BOSS_SPAWN_TIMES) {
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
    if (currentZombieCount >= zombieCap) return spawns;

    this.spawnTimer += dt * tier.spawnRate;
    while (this.spawnTimer >= 1) {
      this.spawnTimer -= 1;

      const batch = tier.batchSize;
      for (let i = 0; i < batch; i++) {
        if (currentZombieCount + spawns.length >= zombieCap) break;

        const type = this.pickZombieType(gameTime, survival, campaignMobIds);
        if (type) {
          const pos = this.getSpawnPosition(camera, playerX, playerY);
          const eliteChance = gameTime >= 45 ? Math.min(0.12, 0.04 + gameTime / 6000) : 0;
          // Special creatures already have distinct attacks and readable body bounds.
          const isElite = !type.isBoss && !HORROR_TYPES.includes(type) && Math.random() < eliteChance;
          spawns.push({ type, x: pos.x, y: pos.y, tier, isElite: isElite || undefined });
        }
      }
    }

    return spawns;
  }

  private pickZombieType(gameTime: number, survival = false, campaignMobIds?: readonly string[]): ZombieTypeDef | null {
    const roster = campaignMobIds
      ? [...ZOMBIE_TYPES, ...HORROR_TYPES].filter(z => campaignMobIds.includes(z.id))
      : survival ? Spawner.survivalRoster : ZOMBIE_TYPES;
    const available = roster.filter(z => !z.isBoss && (campaignMobIds ? true : gameTime >= z.minTime));
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
