// ─── Save System: localStorage persistence ───

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

  // Settings
  soundEnabled: boolean;
}

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
  unlockedCharacters: ['survivor'],
  selectedCharacter: 'survivor',
  stagesCompleted: 0,
  soundEnabled: true,
};

export class SaveSystem {
  data: SaveData;

  constructor() {
    this.data = { ...DEFAULT_SAVE };
    this.load();
  }

  load(): void {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SaveData>;
        this.data = { ...DEFAULT_SAVE, ...parsed };
      }
    } catch {
      // localStorage might be blocked
      this.data = { ...DEFAULT_SAVE };
    }
  }

  save(): void {
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
      this.save();
    }
  }

  resetAll(): void {
    this.data = { ...DEFAULT_SAVE };
    this.save();
  }
}
