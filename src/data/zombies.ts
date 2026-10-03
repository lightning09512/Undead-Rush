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
    hp: 35,
    speed: 80,
    damage: 5,
    xpValue: 15,
    size: 16,
    color: '#d94a38',
    weight: 7,
    minTime: 45,
    explodes: true,
    explosionRadius: 60,
    explosionDamage: 20,
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

// ─── Difficulty Scaling (Clean, responsive wave population like Monster Breakout) ───
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
  { time: 0,    spawnRate: 0.5,  maxZombies: 15,  hpMultiplier: 1.0, speedMultiplier: 1.0, damageMultiplier: 1.0, batchSize: 1 },
  { time: 30,   spawnRate: 0.7,  maxZombies: 22,  hpMultiplier: 1.1, speedMultiplier: 1.05, damageMultiplier: 1.0, batchSize: 1 },
  { time: 60,   spawnRate: 0.9,  maxZombies: 28,  hpMultiplier: 1.25, speedMultiplier: 1.08, damageMultiplier: 1.1, batchSize: 2 },
  { time: 90,   spawnRate: 1.1,  maxZombies: 35,  hpMultiplier: 1.4, speedMultiplier: 1.12, damageMultiplier: 1.15, batchSize: 2 },
  { time: 120,  spawnRate: 1.3,  maxZombies: 40,  hpMultiplier: 1.6, speedMultiplier: 1.15, damageMultiplier: 1.2, batchSize: 2 },
  { time: 180,  spawnRate: 1.4,  maxZombies: 45,  hpMultiplier: 1.9, speedMultiplier: 1.18, damageMultiplier: 1.3, batchSize: 2 },
  { time: 240,  spawnRate: 1.5,  maxZombies: 50,  hpMultiplier: 2.2, speedMultiplier: 1.2, damageMultiplier: 1.4, batchSize: 3 },
  { time: 300,  spawnRate: 1.6,  maxZombies: 55,  hpMultiplier: 2.6, speedMultiplier: 1.22, damageMultiplier: 1.5, batchSize: 3 },
  { time: 420,  spawnRate: 1.7,  maxZombies: 60,  hpMultiplier: 3.2, speedMultiplier: 1.25, damageMultiplier: 1.6, batchSize: 3 },
  { time: 600,  spawnRate: 1.8,  maxZombies: 65,  hpMultiplier: 4.0, speedMultiplier: 1.3, damageMultiplier: 1.8, batchSize: 3 },
];

/** Boss spawn times in seconds */
export const BOSS_SPAWN_TIMES = [120, 300, 480, 660, 900];
