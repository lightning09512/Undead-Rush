// ─── Game Data: Zombie Types ───

export interface ZombieTypeDef {
  id: string;
  name: string;
  hp: number;
  speed: number;         // pixels per second
  damage: number;
  xpValue: number;
  size: number;          // radius
  color: string;
  /** For ranged zombies */
  ranged?: boolean;
  attackRange?: number;
  projectileSpeed?: number;
  /** For exploders */
  explodes?: boolean;
  explosionRadius?: number;
  explosionDamage?: number;
  /** Spawn weight - higher = more common */
  weight: number;
  /** Minimum game time (seconds) before this type can appear */
  minTime: number;
  /** Boss flag */
  isBoss?: boolean;
  /** Glowing flag - drops extra XP */
  isGlowing?: boolean;
}

export const ZOMBIE_TYPES: ZombieTypeDef[] = [
  {
    id: 'normal',
    name: 'Shambler',
    hp: 30,
    speed: 60,
    damage: 10,
    xpValue: 5,
    size: 14,
    color: '#5a8a3c',
    weight: 50,
    minTime: 0,
  },
  {
    id: 'runner',
    name: 'Runner',
    hp: 20,
    speed: 130,
    damage: 8,
    xpValue: 8,
    size: 11,
    color: '#c9a030',
    weight: 20,
    minTime: 30,
  },
  {
    id: 'tank',
    name: 'Brute',
    hp: 200,
    speed: 35,
    damage: 25,
    xpValue: 25,
    size: 22,
    color: '#6b3a6b',
    weight: 8,
    minTime: 60,
  },
  {
    id: 'exploder',
    name: 'Boomer',
    hp: 40,
    speed: 90,
    damage: 5,
    xpValue: 15,
    size: 16,
    color: '#d94a38',
    weight: 10,
    minTime: 45,
    explodes: true,
    explosionRadius: 80,
    explosionDamage: 30,
  },
  {
    id: 'spitter',
    name: 'Spitter',
    hp: 50,
    speed: 40,
    damage: 12,
    xpValue: 12,
    size: 15,
    color: '#3aaa5c',
    weight: 10,
    minTime: 60,
    ranged: true,
    attackRange: 250,
    projectileSpeed: 200,
  },
  {
    id: 'glowing',
    name: 'Radiant',
    hp: 60,
    speed: 55,
    damage: 10,
    xpValue: 50,
    size: 14,
    color: '#ffee44',
    weight: 3,
    minTime: 30,
    isGlowing: true,
  },
  {
    id: 'boss_1',
    name: 'The Abomination',
    hp: 2000,
    speed: 30,
    damage: 40,
    xpValue: 200,
    size: 45,
    color: '#882288',
    weight: 0,
    minTime: 120,
    isBoss: true,
  },
  {
    id: 'boss_2',
    name: 'Death Knight',
    hp: 4000,
    speed: 45,
    damage: 50,
    xpValue: 500,
    size: 50,
    color: '#221144',
    weight: 0,
    minTime: 300,
    isBoss: true,
  },
];

// ─── Difficulty Scaling ───
export interface DifficultyTier {
  time: number;           // game seconds
  spawnRate: number;       // spawns per second
  maxZombies: number;
  hpMultiplier: number;
  speedMultiplier: number;
  damageMultiplier: number;
  batchSize: number;       // zombies per spawn wave
}

export const DIFFICULTY_CURVE: DifficultyTier[] = [
  { time: 0,    spawnRate: 0.8,  maxZombies: 30,  hpMultiplier: 1.0, speedMultiplier: 1.0, damageMultiplier: 1.0, batchSize: 1 },
  { time: 30,   spawnRate: 1.2,  maxZombies: 50,  hpMultiplier: 1.1, speedMultiplier: 1.05, damageMultiplier: 1.0, batchSize: 2 },
  { time: 60,   spawnRate: 1.6,  maxZombies: 80,  hpMultiplier: 1.3, speedMultiplier: 1.1, damageMultiplier: 1.1, batchSize: 3 },
  { time: 90,   spawnRate: 2.0,  maxZombies: 100, hpMultiplier: 1.5, speedMultiplier: 1.15, damageMultiplier: 1.2, batchSize: 4 },
  { time: 120,  spawnRate: 2.5,  maxZombies: 130, hpMultiplier: 1.8, speedMultiplier: 1.2, damageMultiplier: 1.3, batchSize: 5 },
  { time: 180,  spawnRate: 3.0,  maxZombies: 160, hpMultiplier: 2.2, speedMultiplier: 1.25, damageMultiplier: 1.5, batchSize: 6 },
  { time: 240,  spawnRate: 3.5,  maxZombies: 200, hpMultiplier: 2.8, speedMultiplier: 1.3, damageMultiplier: 1.7, batchSize: 7 },
  { time: 300,  spawnRate: 4.0,  maxZombies: 250, hpMultiplier: 3.5, speedMultiplier: 1.35, damageMultiplier: 2.0, batchSize: 8 },
  { time: 420,  spawnRate: 5.0,  maxZombies: 300, hpMultiplier: 5.0, speedMultiplier: 1.4, damageMultiplier: 2.5, batchSize: 10 },
  { time: 600,  spawnRate: 6.0,  maxZombies: 400, hpMultiplier: 8.0, speedMultiplier: 1.5, damageMultiplier: 3.0, batchSize: 12 },
];

/** Boss spawn times in seconds */
export const BOSS_SPAWN_TIMES = [120, 300, 480, 660, 900];
