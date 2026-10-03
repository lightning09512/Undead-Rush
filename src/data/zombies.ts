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

export type HorrorTypeId = 'spider' | 'rat_king' | 'mutant' | 'armed' | 'multihead';
export interface HorrorAttackDef {
  triggerRange: number;
  reach: number;
  arc: number;
  windup: number;
  active: number;
  recovery: number;
  cooldown: number;
  dashSpeed: number;
}

/** Separate roster: stage mode deliberately keeps ZOMBIE_TYPES only. */
export const HORROR_TYPES: ZombieTypeDef[] = [
  { id: 'spider', name: 'Nhện đột biến', hp: 48, speed: 83, damage: 12, xpValue: 10, size: 19, color: '#93816d', weight: 10, minTime: 25 },
  { id: 'armed', name: 'Kẻ hành hình', hp: 95, speed: 51, damage: 19, xpValue: 18, size: 19, color: '#a69e86', weight: 7, minTime: 55 },
  { id: 'rat_king', name: 'Vua chuột', hp: 160, speed: 39, damage: 22, xpValue: 28, size: 30, color: '#89786c', weight: 4, minTime: 85 },
  { id: 'mutant', name: 'Kẻ đột biến', hp: 250, speed: 34, damage: 28, xpValue: 36, size: 28, color: '#9e897a', weight: 3, minTime: 115 },
  { id: 'multihead', name: 'Hợp thể ba đầu', hp: 320, speed: 43, damage: 24, xpValue: 45, size: 29, color: '#ad9f8c', weight: 2, minTime: 155 },
];

/** Distances are in world pixels, timings in seconds. Aim locks at windup. */
export const HORROR_ATTACKS: Record<HorrorTypeId, HorrorAttackDef> = {
  spider: { triggerRange: 185, reach: 26, arc: Math.PI * 2, windup: 0.7, active: 0.42, recovery: 0.8, cooldown: 1.6, dashSpeed: 365 },
  rat_king: { triggerRange: 195, reach: 36, arc: Math.PI * 2, windup: 0.9, active: 0.65, recovery: 1.1, cooldown: 2.4, dashSpeed: 235 },
  mutant: { triggerRange: 106, reach: 94, arc: Math.PI * 1.15, windup: 1.05, active: 0.2, recovery: 1.25, cooldown: 1.6, dashSpeed: 0 },
  armed: { triggerRange: 95, reach: 82, arc: Math.PI * 0.85, windup: 0.8, active: 0.23, recovery: 1, cooldown: 1.25, dashSpeed: 0 },
  multihead: { triggerRange: 117, reach: 106, arc: Math.PI * 1.45, windup: 1.15, active: 0.48, recovery: 1.35, cooldown: 2, dashSpeed: 0 },
};

export function getHorrorAttack(typeId: string): HorrorAttackDef | undefined {
  return Object.prototype.hasOwnProperty.call(HORROR_ATTACKS, typeId)
    ? HORROR_ATTACKS[typeId as HorrorTypeId] : undefined;
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
