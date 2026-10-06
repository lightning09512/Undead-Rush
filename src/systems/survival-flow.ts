import type { Zombie } from '../entities/zombies';

/** A wave ends when its configured spawn budget is exhausted, even if enemies remain. */
export function isSurvivalWaveSpawnBudgetExhausted(remaining: number): boolean {
  return remaining <= 0;
}

/** Adds may outlive a boss, but only the active encounter boss gates the next intermission. */
export function hasLivingSurvivalBoss(
  active: readonly Pick<Zombie, 'isBoss' | 'campaignBossId' | 'hp'>[],
  stageId: number,
): boolean {
  return active.some(zombie => zombie.isBoss && zombie.campaignBossId === stageId && zombie.hp > 0);
}

/** Rotate Campaign boss profiles every third Survival wave, repeating by circuit. */
export function getSurvivalBossSelection(wave: number, stageCount: number): { stageIndex: number; circuit: number } | null {
  if (!Number.isInteger(wave) || wave < 1 || wave % 3 !== 0 || !Number.isInteger(stageCount) || stageCount < 1) return null;
  const bossIndex = Math.ceil(wave / 3) - 1;
  return { stageIndex: bossIndex % stageCount, circuit: Math.floor(bossIndex / stageCount) };
}
