// ─── Game Data: Items / Pickups ───

export interface ItemDef {
  id: string;
  name: string;
  color: string;
  glowColor: string;
  size: number;
  /** Duration in seconds for timed buffs, 0 for instant */
  duration: number;
  /** Effect value (XP amount, HP heal, speed mult, etc.) */
  value: number;
  /** Spawn weight for random spawning */
  weight: number;
  /** Minimum game time to appear */
  minTime: number;
}

export const XP_GEM_SMALL: ItemDef = {
  id: 'xp_small',
  name: 'XP Gem',
  color: '#44bbff',
  glowColor: '#2299dd',
  size: 5,
  duration: 0,
  value: 5,
  weight: 70,
  minTime: 0,
};

export const XP_GEM_MEDIUM: ItemDef = {
  id: 'xp_medium',
  name: 'XP Crystal',
  color: '#44ff88',
  glowColor: '#22cc66',
  size: 7,
  duration: 0,
  value: 15,
  weight: 25,
  minTime: 0,
};

export const XP_GEM_LARGE: ItemDef = {
  id: 'xp_large',
  name: 'XP Prism',
  color: '#ff44ff',
  glowColor: '#cc22cc',
  size: 10,
  duration: 0,
  value: 50,
  weight: 5,
  minTime: 60,
};

export const XP_GEMS = [XP_GEM_SMALL, XP_GEM_MEDIUM, XP_GEM_LARGE];

export const MAP_ITEMS: ItemDef[] = [
  {
    id: 'health_pack',
    name: 'Health Pack',
    color: '#ff3344',
    glowColor: '#cc1122',
    size: 12,
    duration: 0,
    value: 30,
    weight: 15,
    minTime: 0,
  },
  {
    id: 'magnet',
    name: 'Magnet',
    color: '#ff8800',
    glowColor: '#cc6600',
    size: 12,
    duration: 0,
    value: 0,
    weight: 8,
    minTime: 30,
  },
  {
    id: 'xp_chest',
    name: 'XP Chest',
    color: '#ffdd00',
    glowColor: '#ccaa00',
    size: 14,
    duration: 0,
    value: 100,
    weight: 5,
    minTime: 45,
  },
  {
    id: 'double_xp',
    name: 'Double XP',
    color: '#00ddff',
    glowColor: '#00aacc',
    size: 11,
    duration: 15,
    value: 2,
    weight: 5,
    minTime: 30,
  },
  {
    id: 'speed_boost',
    name: 'Speed Boost',
    color: '#88ff00',
    glowColor: '#66cc00',
    size: 11,
    duration: 10,
    value: 1.5,
    weight: 5,
    minTime: 30,
  },
  {
    id: 'shield',
    name: 'Shield',
    color: '#8888ff',
    glowColor: '#6666cc',
    size: 11,
    duration: 8,
    value: 0,
    weight: 4,
    minTime: 60,
  },
  {
    id: 'bomb',
    name: 'Screen Bomb',
    color: '#ff0000',
    glowColor: '#cc0000',
    size: 13,
    duration: 0,
    value: 999,
    weight: 2,
    minTime: 90,
  },
];

// ─── Player Defaults ───
export const PLAYER_DEFAULTS = {
  maxHp: 100,
  moveSpeed: 180,         // pixels per second
  size: 14,               // radius
  color: '#4488ff',
  bulletDamage: 15,
  bulletSpeed: 450,
  bulletSize: 4,
  bulletColor: '#ffdd44',
  fireRate: 3.0,           // shots per second
  fireRange: 350,
  pickupRadius: 60,
  invulnDuration: 0.5,     // seconds after being hit
};

// ─── XP Level Curve ───
export function xpForLevel(level: number): number {
  return Math.floor(20 + level * 15 + level * level * 2);
}

// ─── Map ───
export const MAP_CONFIG = {
  width: 4000,
  height: 4000,
  tileSize: 64,
  tileColor1: '#1a1a2e',
  tileColor2: '#16213e',
  borderColor: '#ff4444',
};
