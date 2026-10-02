// ─── Meta Progression: Permanent Upgrades, Characters ───

export interface PermUpgradeDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  maxLevel: number;
  costs: number[];       // gold cost per level
  effect: string;        // description of what it does
  values: number[];      // per-level values
}

export const PERM_UPGRADES: PermUpgradeDef[] = [
  {
    id: 'perm_damage',
    name: 'Arsenal',
    description: 'Start with bonus damage',
    icon: '⚔️',
    maxLevel: 5,
    costs: [50, 100, 200, 400, 800],
    effect: '+5% starting damage per level',
    values: [1.05, 1.10, 1.15, 1.20, 1.30],
  },
  {
    id: 'perm_hp',
    name: 'Resilience',
    description: 'Start with bonus HP',
    icon: '❤️',
    maxLevel: 5,
    costs: [50, 100, 200, 400, 800],
    effect: '+10 starting max HP per level',
    values: [110, 120, 130, 140, 160],
  },
  {
    id: 'perm_speed',
    name: 'Agility',
    description: 'Start with bonus move speed',
    icon: '👟',
    maxLevel: 3,
    costs: [75, 200, 500],
    effect: '+5% starting move speed per level',
    values: [1.05, 1.10, 1.15],
  },
  {
    id: 'perm_pickup',
    name: 'Attraction',
    description: 'Start with bonus pickup radius',
    icon: '🧲',
    maxLevel: 3,
    costs: [75, 200, 500],
    effect: '+15% starting pickup radius per level',
    values: [1.15, 1.30, 1.50],
  },
  {
    id: 'perm_fire_rate',
    name: 'Trigger Finger',
    description: 'Start with bonus fire rate',
    icon: '🔥',
    maxLevel: 3,
    costs: [100, 250, 600],
    effect: '+8% starting fire rate per level',
    values: [1.08, 1.16, 1.25],
  },
  {
    id: 'perm_xp_mult',
    name: 'Wisdom',
    description: 'Earn bonus XP',
    icon: '📚',
    maxLevel: 3,
    costs: [150, 400, 1000],
    effect: '+10% XP gain per level',
    values: [1.10, 1.20, 1.35],
  },
  {
    id: 'perm_gold_mult',
    name: 'Prosperity',
    description: 'Earn bonus gold from runs',
    icon: '💰',
    maxLevel: 3,
    costs: [200, 500, 1200],
    effect: '+15% gold per level',
    values: [1.15, 1.30, 1.50],
  },
  {
    id: 'perm_revive',
    name: 'Second Wind',
    description: 'Start with a free revive',
    icon: '💫',
    maxLevel: 1,
    costs: [2000],
    effect: 'Revive once per run with 30% HP',
    values: [1],
  },
];

export interface CharacterDef {
  id: string;
  name: string;
  description: string;
  color: string;
  cost: number;          // gold to unlock (0 = free)
  bonuses: {
    damage?: number;
    speed?: number;
    hp?: number;
    fireRate?: number;
    pickupRadius?: number;
    special?: string;
  };
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'survivor',
    name: 'Survivor',
    description: 'Balanced stats, no bonuses',
    color: '#4488ff',
    cost: 0,
    bonuses: {},
  },
  {
    id: 'soldier',
    name: 'Soldier',
    description: '+20% damage, -10% speed',
    color: '#44aa44',
    cost: 500,
    bonuses: { damage: 1.2, speed: 0.9 },
  },
  {
    id: 'scout',
    name: 'Scout',
    description: '+30% speed, -20% HP',
    color: '#ffaa22',
    cost: 500,
    bonuses: { speed: 1.3, hp: 0.8 },
  },
  {
    id: 'medic',
    name: 'Medic',
    description: '+50% HP, -15% damage',
    color: '#ff4488',
    cost: 750,
    bonuses: { hp: 1.5, damage: 0.85 },
  },
  {
    id: 'engineer',
    name: 'Engineer',
    description: '+25% fire rate, +30% pickup radius',
    color: '#88aaff',
    cost: 1000,
    bonuses: { fireRate: 1.25, pickupRadius: 1.3 },
  },
  {
    id: 'berserker',
    name: 'Berserker',
    description: '+40% damage, +20% speed, -40% HP',
    color: '#ff2222',
    cost: 1500,
    bonuses: { damage: 1.4, speed: 1.2, hp: 0.6 },
  },
];

// ─── Stage Definitions for Level Mode ───
export interface StageDef {
  id: number;
  name: string;
  description: string;
  duration: number;         // seconds
  objective: 'survive' | 'kill_boss' | 'kill_count';
  objectiveValue: number;   // kill count target, etc.
  difficultyMult: number;   // multiplier on difficulty curve
  bossAtEnd: boolean;
  reward: number;           // bonus gold
}

export const STAGES: StageDef[] = [
  {
    id: 1, name: 'Outbreak', description: 'Survive the initial wave',
    duration: 300, objective: 'survive', objectiveValue: 300,
    difficultyMult: 0.8, bossAtEnd: true, reward: 100,
  },
  {
    id: 2, name: 'Overrun', description: 'Clear 100 zombies',
    duration: 420, objective: 'kill_count', objectiveValue: 100,
    difficultyMult: 1.0, bossAtEnd: false, reward: 150,
  },
  {
    id: 3, name: 'The Brute', description: 'Defeat the Abomination',
    duration: 360, objective: 'kill_boss', objectiveValue: 1,
    difficultyMult: 1.1, bossAtEnd: true, reward: 250,
  },
  {
    id: 4, name: 'Horde Night', description: 'Survive 8 minutes of endless waves',
    duration: 480, objective: 'survive', objectiveValue: 480,
    difficultyMult: 1.3, bossAtEnd: true, reward: 400,
  },
  {
    id: 5, name: 'Death March', description: 'Defeat the Death Knight',
    duration: 600, objective: 'kill_boss', objectiveValue: 1,
    difficultyMult: 1.5, bossAtEnd: true, reward: 750,
  },
];
