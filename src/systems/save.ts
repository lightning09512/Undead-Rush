// ─── Save System: localStorage persistence ───
import { UPGRADES } from '../data/upgrades';
import { ALL_CHARACTER_IDS } from '../data/meta';

export interface SaveData {
  // Best scores
  bestTime: number;
  bestKills: number;
  bestLevel: number;
  totalKills: number;
  totalGamesPlayed: number;

  // Meta progression
  gold: number;
  totalGoldEarned: number;

  // Permanent upgrades purchased
  permUpgrades: Record<string, number>;

  // Unlocked characters
  unlockedCharacters: string[];
  selectedCharacter: string;

  // Level mode progress
  stagesCompleted: number;
  completedStages: number[]; // Array of completed stage IDs

  // Settings
  soundEnabled: boolean;
  language: 'vi' | 'en';
  musicEnabled: boolean;
  campaign: CampaignProgress;
}

export interface CampaignProgress {
  difficulty: CampaignDifficulty;
  credits: number;
  selectedCharacter: string;
  unlockedCharacters: string[];
  unlockedStage: number;
  /** Mission checkpoint used by Load Game; missions restart at their entrance. */
  lastStage: number;
  hasCheckpoint: boolean;
  completedStages: number[];
  ownedGuns: string[];
  equippedGun: string;
  gunLevels: Record<string, number>;
  /** Per-weapon loaded and reserve ammo, retained between Campaign missions. */
  gunAmmo: Record<string, { currentAmmo: number; reserveAmmo: number }>;
  ammoPacks: number;
  medKits: number;
  armorLevel: number;
  flashlightLevel: number;
  cardLevels: Record<string, number>;
  /** Bumped when Campaign's purchasable upgrade set changes. */
  upgradeSystemVersion: number;
  /** Best Campaign score recorded per stage; total is the sum of these records. */
  stageScores: Record<string, number>;
  totalScore: number;
}

export type CampaignDifficulty = 'normal' | 'hard' | 'impossible';

const newCampaign = (difficulty: CampaignDifficulty = 'normal'): CampaignProgress => ({
  difficulty,
  credits: 160, selectedCharacter: 'survivor', unlockedCharacters: [...ALL_CHARACTER_IDS],
  unlockedStage: 1, lastStage: 1, hasCheckpoint: false, completedStages: [], ownedGuns: ['p9'], equippedGun: 'p9',
  gunLevels: {}, gunAmmo: {}, ammoPacks: 0, medKits: 0, armorLevel: 0, flashlightLevel: 1,
  cardLevels: {}, upgradeSystemVersion: 1, stageScores: {}, totalScore: 0,
});

const SAVE_KEY = 'undead_rush_save';

const DEFAULT_SAVE: SaveData = {
  bestTime: 0,
  bestKills: 0,
  bestLevel: 0,
  totalKills: 0,
  totalGamesPlayed: 0,
  gold: 0,
  totalGoldEarned: 0,
  permUpgrades: {},
  unlockedCharacters: [...ALL_CHARACTER_IDS],
  selectedCharacter: 'survivor',
  stagesCompleted: 0,
  completedStages: [],
  soundEnabled: true,
  language: 'vi',
  musicEnabled: true,
  campaign: newCampaign(),
};

export class SaveSystem {
  data: SaveData;

  private readonly persistent: boolean;

  constructor(persistent = true) {
    this.persistent = persistent;
    this.data = { ...DEFAULT_SAVE, permUpgrades: {}, unlockedCharacters: [...ALL_CHARACTER_IDS], completedStages: [], campaign: newCampaign() };
    if (persistent) this.load();
  }

  load(): void {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SaveData>;
        const legacyStages = parsed.campaign ? [] : (parsed.completedStages ?? []);
        const completedCampaignStages = parsed.campaign?.completedStages ?? legacyStages;
        const unlockedStage = parsed.campaign?.unlockedStage ?? Math.min(10, Math.max(1, (parsed.stagesCompleted ?? 0) + 1));
        const savedCampaign = parsed.campaign;
        const difficulty: CampaignDifficulty = savedCampaign?.difficulty === 'hard' || savedCampaign?.difficulty === 'impossible'
          ? savedCampaign.difficulty : 'normal';
        const needsUpgradeMigration = (savedCampaign?.upgradeSystemVersion ?? 0) < 1;
        const stageScores = Object.fromEntries(Object.entries(savedCampaign?.stageScores ?? {})
          .map(([stage, score]) => [stage, Math.max(0, Math.floor(Number(score) || 0))]));
        const campaign = { ...newCampaign(), ...(savedCampaign ?? {}),
          difficulty,
          gunLevels: { ...(savedCampaign?.gunLevels ?? {}) },
          gunAmmo: { ...(savedCampaign?.gunAmmo ?? {}) },
          cardLevels: { ...(savedCampaign?.cardLevels ?? {}) },
          ownedGuns: [...new Set([...(savedCampaign?.ownedGuns ?? []), 'p9'])],
          completedStages: [...completedCampaignStages],
          unlockedStage,
          armorLevel: Math.max(0, Math.min(3, Math.floor(savedCampaign?.armorLevel ?? 0))),
          flashlightLevel: Math.max(1, Math.min(3, Math.floor(savedCampaign?.flashlightLevel ?? 1))),
          lastStage: savedCampaign?.lastStage ?? unlockedStage,
          hasCheckpoint: savedCampaign?.hasCheckpoint ?? (unlockedStage > 1 || completedCampaignStages.length > 0),
          stageScores,
          totalScore: Object.values(stageScores).reduce((sum, score) => sum + score, 0),
          unlockedCharacters: [...new Set([...ALL_CHARACTER_IDS, ...(savedCampaign?.unlockedCharacters ?? [])])] };
        if (needsUpgradeMigration) {
          let refund = 0;
          for (const upgrade of UPGRADES) {
            if (upgrade.id === 'drone') continue;
            const levels = Math.min(upgrade.maxLevel, Math.max(0, Math.floor(campaign.cardLevels[upgrade.id] ?? 0)));
            for (let level = 0; level < levels; level++)
              refund += (upgrade.category === 'weapon' ? 115 : 85) + level * 65;
          }
          const drone = UPGRADES.find(upgrade => upgrade.id === 'drone')!;
          const droneLevel = Math.min(drone.maxLevel, Math.max(0, Math.floor(campaign.cardLevels.drone ?? 0)));
          campaign.credits += refund;
          campaign.cardLevels = droneLevel > 0 ? { drone: droneLevel } : {};
          campaign.upgradeSystemVersion = 1;
        }
        this.data = { ...DEFAULT_SAVE, ...parsed,
          unlockedCharacters: [...new Set([...ALL_CHARACTER_IDS, ...(parsed.unlockedCharacters ?? [])])],
          language: parsed.language === 'en' ? 'en' : 'vi',
          musicEnabled: typeof parsed.musicEnabled === 'boolean' ? parsed.musicEnabled : true,
          campaign };
        if (needsUpgradeMigration) this.save();
      }
    } catch {
      // localStorage might be blocked
      this.data = { ...DEFAULT_SAVE, unlockedCharacters: [...ALL_CHARACTER_IDS], campaign: newCampaign() };
    }
  }

  save(): void {
    if (!this.persistent) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      // Silent fail
    }
  }

  /** Calculate gold earned from a run */
  calculateGold(timeSurvived: number, kills: number, level: number): number {
    const timeBonus = Math.floor(timeSurvived / 10);
    const killBonus = Math.floor(kills / 5);
    const levelBonus = level * 3;
    return timeBonus + killBonus + levelBonus;
  }

  /** Record end-of-run stats */
  recordRun(timeSurvived: number, kills: number, level: number): number {
    this.data.totalGamesPlayed++;
    this.data.totalKills += kills;

    if (timeSurvived > this.data.bestTime) this.data.bestTime = timeSurvived;
    if (kills > this.data.bestKills) this.data.bestKills = kills;
    if (level > this.data.bestLevel) this.data.bestLevel = level;

    const gold = this.calculateGold(timeSurvived, kills, level);
    this.data.gold += gold;
    this.data.totalGoldEarned += gold;

    this.save();
    return gold;
  }

  /** Purchase a permanent upgrade, returns true if successful */
  purchasePermUpgrade(id: string, cost: number): boolean {
    if (this.data.gold < cost) return false;
    this.data.gold -= cost;
    this.data.permUpgrades[id] = (this.data.permUpgrades[id] || 0) + 1;
    this.save();
    return true;
  }

  getPermUpgradeLevel(id: string): number {
    return this.data.permUpgrades[id] || 0;
  }

  unlockCharacter(id: string): void {
    if (!this.data.unlockedCharacters.includes(id)) {
      this.data.unlockedCharacters.push(id);
      this.save();
    }
  }

  completeStage(stageNum: number): void {
    if (stageNum > this.data.stagesCompleted) {
      this.data.stagesCompleted = stageNum;
    }
    if (!this.data.completedStages.includes(stageNum)) {
      this.data.completedStages.push(stageNum);
    }
    this.save();
  }

  /** Campaign currency and unlocks never touch Survival gold or records. */
  spendCampaign(cost: number): boolean {
    if (cost < 0 || this.data.campaign.credits < cost) return false;
    this.data.campaign.credits -= cost;
    this.save();
    return true;
  }

  collectCampaignCredits(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.data.campaign.credits += Math.floor(amount);
    this.save();
  }

  completeCampaignStage(stage: number, baseReward: number, kills: number, optionalDone: number): number {
    const progress = this.data.campaign;
    const alreadyCompleted = progress.completedStages.includes(stage);
    const reward = alreadyCompleted ? 0 : baseReward + Math.min(80, Math.floor(kills / 3)) + optionalDone * 35;
    if (!alreadyCompleted) progress.completedStages.push(stage);
    progress.unlockedStage = Math.max(progress.unlockedStage, Math.min(10, stage + 1));
    progress.lastStage = Math.min(10, Math.max(progress.lastStage, stage + 1));
    progress.hasCheckpoint = true;
    progress.credits += reward;
    this.save();
    return reward;
  }

  /** Keep only the best score for a stage so replaying it cannot farm the campaign total. */
  recordCampaignScore(stage: number, score: number): { added: number; total: number } {
    const progress = this.data.campaign;
    const key = String(stage);
    const previousBest = progress.stageScores[key] ?? 0;
    const best = Math.max(previousBest, Math.max(0, Math.floor(score)));
    const added = best - previousBest;
    if (added > 0) {
      progress.stageScores[key] = best;
      progress.totalScore += added;
      this.save();
    }
    return { added, total: progress.totalScore };
  }

  resetCampaign(difficulty: CampaignDifficulty = 'normal'): void {
    this.data.campaign = newCampaign(difficulty);
    this.save();
  }

  /** Preserve the player's kit and records, but send an Impossible run back to mission one. */
  resetCampaignRunToFirstStage(): void {
    const progress = this.data.campaign;
    progress.unlockedStage = 1;
    progress.lastStage = 1;
    progress.hasCheckpoint = true;
    progress.completedStages = [];
    this.save();
  }

  resetAll(): void {
    this.data = { ...DEFAULT_SAVE, permUpgrades: {}, unlockedCharacters: [...ALL_CHARACTER_IDS], completedStages: [], campaign: newCampaign() };
    this.save();
  }
}
