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
  color: '#73b9cf',
  glowColor: '#3d859d',
  size: 5,
  duration: 0,
  value: 5,
  weight: 70,
  minTime: 0,
};

export const XP_GEM_MEDIUM: ItemDef = {
  id: 'xp_medium',
  name: 'XP Crystal',
  color: '#9cc8aa',
  glowColor: '#54876a',
  size: 7,
  duration: 0,
  value: 15,
  weight: 25,
  minTime: 0,
};

export const XP_GEM_LARGE: ItemDef = {
  id: 'xp_large',
  name: 'XP Prism',
  color: '#e0b875',
  glowColor: '#aa7941',
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
    color: '#8fbd7b',
    glowColor: '#4e8052',
    size: 12,
    duration: 0,
    value: 30,
    weight: 15,
    minTime: 0,
  },
  {
    id: 'magnet',
    name: 'Magnet',
    color: '#77b8c5',
    glowColor: '#3e8290',
    size: 12,
    duration: 0,
    value: 0,
    weight: 8,
    minTime: 30,
  },
  {
    id: 'xp_chest',
    name: 'XP Chest',
    color: '#efc76a',
    glowColor: '#ad813a',
    size: 14,
    duration: 0,
    value: 100,
    weight: 5,
    minTime: 45,
  },
  {
    id: 'double_xp',
    name: 'Double XP',
    color: '#8ed3d5',
    glowColor: '#468f9c',
    size: 11,
    duration: 15,
    value: 2,
    weight: 5,
    minTime: 30,
  },
  {
    id: 'speed_boost',
    name: 'Speed Boost',
    color: '#b0c77a',
    glowColor: '#6d8648',
    size: 11,
    duration: 10,
    value: 1.5,
    weight: 5,
    minTime: 30,
  },
  {
    id: 'shield',
    name: 'Shield',
    color: '#80b8c3',
    glowColor: '#466f85',
    size: 11,
    duration: 8,
    value: 0,
    weight: 4,
    minTime: 60,
  },
  {
    id: 'bomb',
    name: 'Screen Bomb',
    color: '#cb6253',
    glowColor: '#923c36',
    size: 13,
    duration: 0,
    value: 999,
    weight: 2,
    minTime: 90,
  },
  {
    id: 'weapon_part',
    name: 'Weapon Part',
    color: '#d5aa62',
    glowColor: '#937044',
    size: 10,
    duration: 0,
    value: 0,
    weight: 3,
    minTime: 45,
  },
];

// ─── Player Defaults ───
export const PLAYER_DEFAULTS = {
  maxHp: 100,
  moveSpeed: 180,         // pixels per second
  size: 14,               // radius
  color: '#4488ff',
  bulletDamage: 15,
  bulletSpeed: 1100,
  bulletSize: 4,
  bulletColor: '#ffdd44',
  fireRate: 3.0,           // shots per second
  fireRange: 620,
  pickupRadius: 60,
  invulnDuration: 0.5,     // seconds after being hit
};

// ─── XP Level Curve ───
export function xpForLevel(level: number): number {
  return Math.floor(20 + level * 15 + level * level * 2);
}

// ─── Weapon Parts System (like Monster Breakout) ───
export interface WeaponPartDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  effect: string; // What stat it boosts
}

export const WEAPON_PARTS: WeaponPartDef[] = [
  {
    id: 'part_damage',
    name: 'Damage Part',
    icon: 'D',
    description: 'Tăng sát thương vũ khí',
    effect: '+5% damage',
  },
  {
    id: 'part_fire_rate',
    name: 'Fire Rate Part',
    icon: 'F',
    description: 'Tăng tốc độ bắn',
    effect: '+8% fire rate',
  },
  {
    id: 'part_magazine',
    name: 'Magazine Part',
    icon: 'M',
    description: 'Tăng băng đạn/tốc độ hồi',
    effect: '+10% fire rate',
  },
  {
    id: 'part_pierce',
    name: 'Pierce Part',
    icon: 'P',
    description: 'Đạn xuyên mục tiêu',
    effect: '+1 pierce',
  },
  {
    id: 'part_split',
    name: 'Split Part',
    icon: 'S',
    description: 'Đạn chia tia',
    effect: '+1 split',
  },
];

// ─── Map ───
export const MAP_CONFIG = {
  width: 4000,
  height: 4000,
  tileSize: 64,
  tileColor1: '#12141a',
  tileColor2: '#181b24',
  borderColor: '#3388ff',
};
