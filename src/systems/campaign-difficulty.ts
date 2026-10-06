import type { CampaignDifficulty } from './save';

export function getCampaignDifficultyFactors(difficulty: CampaignDifficulty): { health: number; damage: number } {
  switch (difficulty) {
    case 'hard': return { health: 1.3, damage: 1.3 };
    case 'impossible': return { health: 1.5, damage: 1.5 };
    default: return { health: 1, damage: 1 };
  }
}

export function shouldShowCampaignSkillDirections(mode: 'stage' | 'endless', difficulty: CampaignDifficulty): boolean {
  return mode !== 'stage' || difficulty === 'normal';
}
