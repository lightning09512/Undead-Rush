// ─── Game Data: Upgrades ───
export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji or color code
  maxLevel: number;
  category: 'stat' | 'weapon' | 'effect';
  /** Per-level values: damage mult, count, etc. */
  values: number[];
  /** Evolution combo: [upgradeA_id, upgradeB_id] => evolution_id */
  evolvesFrom?: [string, string];
  /** Required level of each component to trigger evolution */
  evolveReqLevel?: number;
}

export const UPGRADES: UpgradeDef[] = [
  // ─── Stats ───
  {
    id: 'damage',
    name: 'Power Up',
    description: '+15% bullet damage',
    icon: '⚔️',
    maxLevel: 8,
    category: 'stat',
    values: [1.15, 1.30, 1.45, 1.60, 1.80, 2.0, 2.25, 2.5],
  },
  {
    id: 'fire_rate',
    name: 'Rapid Fire',
    description: '+12% fire rate',
    icon: '🔥',
    maxLevel: 8,
    category: 'stat',
    values: [1.12, 1.24, 1.36, 1.50, 1.65, 1.80, 2.0, 2.2],
  },
  {
    id: 'max_hp',
    name: 'Vitality',
    description: '+20 max HP',
    icon: '❤️',
    maxLevel: 6,
    category: 'stat',
    values: [120, 140, 160, 180, 200, 240],
  },
  {
    id: 'move_speed',
    name: 'Swift Feet',
    description: '+10% move speed',
    icon: '👟',
    maxLevel: 5,
    category: 'stat',
    values: [1.10, 1.20, 1.30, 1.40, 1.55],
  },
  {
    id: 'pickup_radius',
    name: 'Magnetism',
    description: '+25% XP pickup radius',
    icon: '🧲',
    maxLevel: 5,
    category: 'stat',
    values: [1.25, 1.50, 1.75, 2.0, 2.5],
  },
  {
    id: 'armor',
    name: 'Tough Skin',
    description: '-10% damage taken',
    icon: '🛡️',
    maxLevel: 5,
    category: 'stat',
    values: [0.90, 0.80, 0.70, 0.60, 0.50],
  },
  // ─── Weapons ───
  {
    id: 'dual_pistols',
    name: 'Dual Pistols',
    description: 'Fire two bullets at once',
    icon: '🔫',
    maxLevel: 5,
    category: 'weapon',
    values: [2, 3, 4, 5, 6], // bullet count
  },
  {
    id: 'shotgun',
    name: 'Shotgun',
    description: 'Spread of 5 pellets, short range',
    icon: '💥',
    maxLevel: 5,
    category: 'weapon',
    values: [5, 7, 9, 11, 14], // pellet count
  },
  {
    id: 'piercing',
    name: 'Piercing Rounds',
    description: 'Bullets pass through enemies',
    icon: '🗡️',
    maxLevel: 4,
    category: 'weapon',
    values: [2, 3, 4, 6], // pierce count
  },
  {
    id: 'grenades',
    name: 'Grenades',
    description: 'Lob explosive grenades periodically',
    icon: '💣',
    maxLevel: 5,
    category: 'weapon',
    values: [1, 2, 3, 4, 5], // grenade count per throw
  },
  {
    id: 'mines',
    name: 'Landmines',
    description: 'Drop mines behind you',
    icon: '🔻',
    maxLevel: 4,
    category: 'weapon',
    values: [1, 2, 3, 4], // mine count
  },
  {
    id: 'drone',
    name: 'Combat Drone',
    description: 'Auto-firing drone orbits you',
    icon: '🤖',
    maxLevel: 4,
    category: 'weapon',
    values: [1, 2, 3, 4], // drone count
  },
  // ─── Effects ───
  {
    id: 'explosive',
    name: 'Explosive Rounds',
    description: 'Bullets explode on hit',
    icon: '🧨',
    maxLevel: 3,
    category: 'effect',
    values: [30, 50, 80], // explosion radius
  },
  {
    id: 'burning',
    name: 'Incendiary',
    description: 'Bullets set enemies on fire',
    icon: '🔥',
    maxLevel: 3,
    category: 'effect',
    values: [3, 5, 8], // burn damage per tick
  },
  {
    id: 'slowing',
    name: 'Cryo Rounds',
    description: 'Bullets slow enemies',
    icon: '❄️',
    maxLevel: 3,
    category: 'effect',
    values: [0.7, 0.5, 0.3], // slow multiplier
  },
  {
    id: 'lifesteal',
    name: 'Vampiric',
    description: 'Heal on kill',
    icon: '🧛',
    maxLevel: 3,
    category: 'effect',
    values: [2, 4, 7], // hp healed per kill
  },
];

// ─── Evolution combos ───
export interface EvolutionDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  requires: [string, string];
  requireLevel: number; // min level of each component
}

export const EVOLUTIONS: EvolutionDef[] = [
  {
    id: 'flamethrower',
    name: 'Flamethrower',
    description: 'Shotgun + Burning = Continuous flame cone',
    icon: '🔥',
    requires: ['shotgun', 'burning'],
    requireLevel: 3,
  },
  {
    id: 'railgun',
    name: 'Railgun',
    description: 'Piercing + Damage = Devastating beam',
    icon: '⚡',
    requires: ['piercing', 'damage'],
    requireLevel: 4,
  },
  {
    id: 'cluster_bombs',
    name: 'Cluster Bombs',
    description: 'Grenades + Explosive = Cluster explosions',
    icon: '💥',
    requires: ['grenades', 'explosive'],
    requireLevel: 3,
  },
  {
    id: 'frost_nova',
    name: 'Frost Nova',
    description: 'Mines + Cryo = Freezing mines',
    icon: '🌀',
    requires: ['mines', 'slowing'],
    requireLevel: 3,
  },
];
