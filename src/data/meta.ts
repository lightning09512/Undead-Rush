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
  theme: string;
  floorColor: string;
  accentColor: string;
  objectiveLabel: string;
  objectiveHoldAt?: number;
  objectiveHoldSeconds?: number;
  playerStart: Point;
  objectiveNodes: Point[];
  bossSpawn: Point;
  exitSpawn?: Point;
  bossTypeId: string;
  bossName: string;
  bossHp: number;
  mobIds: string[];
  buildings: StageBuildingDef[];
  layout?: CampaignLayout;
}
export interface CampaignRect { x: number; y: number; w: number; h: number; }
export interface CampaignZone extends CampaignRect {
  name: string;
  role: 'entry' | 'combat' | 'objective' | 'hold' | 'boss';
  landmark: string;
  floor: string;
  mobs: string[];
  waveSize: number;
}
export interface CampaignGate extends CampaignRect {
  afterZone: number;
  requiredObjectives: number;
}
export interface CampaignLayout {
  bounds: CampaignRect;
  zones: CampaignZone[];
  corridors: CampaignRect[];
  gates: CampaignGate[];
  decorations: Array<CampaignRect & { kind: string; solid: boolean }>;
}
export type CampaignAttackKind = 'sweep' | 'slam' | 'charge' | 'ring' | 'fan' | 'cross' | 'web' | 'stomp' | 'summon';
export interface CampaignAttackDef {
  name: string;
  kind: CampaignAttackKind;
  damage: number;
  reach: number;
  telegraph: number;
  recovery: number;
  speed?: number;
}

export interface Point { x: number; y: number; }
export interface StageBuildingDef extends Point {
  halfWidth: number;
  halfHeight: number;
  kind: 'warehouse' | 'ruin';
  rotation: number;
  large?: boolean;
  variant?: 'suburb' | 'fuel' | 'medical' | 'sewer' | 'military' | 'mall' | 'rail' | 'lab' | 'quarantine' | 'hive';
}

const b = (x: number, y: number, halfWidth: number, halfHeight: number, kind: StageBuildingDef['kind'] = 'ruin', large = false, rotation = 0, variant?: StageBuildingDef['variant']): StageBuildingDef =>
  ({ x, y, halfWidth, halfHeight, kind, large, rotation, variant });

/** Campaign-only layouts. Coordinates use the 4000×4000 world; Survival data is untouched. */
export const STAGES: StageDef[] = [
  { id: 1, name: 'Khu ngoại ô phong tỏa', description: 'Kích hoạt radio cứu hộ, hạ Đội trưởng Còi Hú', duration: 360, objective: 'kill_boss', objectiveValue: 1, difficultyMult: 0.82, bossAtEnd: true, reward: 100,
    theme: 'Ngoại ô phong tỏa', floorColor: '#30312f', accentColor: '#d7a15b', objectiveLabel: 'Kích hoạt các radio cứu hộ', playerStart: { x: 500, y: 2040 }, objectiveNodes: [{ x: 1220, y: 1840 }, { x: 2270, y: 2260 }], bossSpawn: { x: 3440, y: 2010 }, bossTypeId: 'boss_1', bossName: 'Đội trưởng Còi Hú', bossHp: 1900, mobIds: ['normal', 'runner'], buildings: [b(700,1320,210,150,'warehouse',true),b(1490,980,115,86),b(1660,2650,220,150,'warehouse',true),b(2700,1140,110,84),b(2870,2920,220,150,'warehouse',true),b(990,3040,105,72)] },
  { id: 2, name: 'Trạm xăng bỏ hoang', description: 'Thu hồi nhiên liệu ở các vòi bơm', duration: 400, objective: 'kill_boss', objectiveValue: 1, difficultyMult: 0.94, bossAtEnd: true, reward: 150,
    theme: 'Trạm xăng bỏ hoang', floorColor: '#35302b', accentColor: '#e4a449', objectiveLabel: 'Thu hồi nhiên liệu', playerStart: { x: 500, y: 2020 }, objectiveNodes: [{ x: 1220, y: 1450 }, { x: 2160, y: 2640 }, { x: 2810, y: 1530 }], bossSpawn: { x: 3530, y: 2070 }, bossTypeId: 'boss_1', bossName: 'Họng Bơm', bossHp: 2500, mobIds: ['normal', 'runner', 'exploder'], buildings: [b(940,930,240,160,'warehouse',true),b(1610,1570,125,84),b(2010,900,110,78),b(1330,2850,235,155,'warehouse',true),b(2540,2670,120,86),b(3040,1050,210,140,'warehouse',true)] },
  { id: 3, name: 'Bệnh viện dã chiến', description: 'Khôi phục điện và lấy vật tư y tế', duration: 440, objective: 'kill_boss', objectiveValue: 1, difficultyMult: 1.02, bossAtEnd: true, reward: 220,
    theme: 'Bệnh viện dã chiến', floorColor: '#303536', accentColor: '#76b8ad', objectiveLabel: 'Khôi phục điện / thu hồi vật tư', playerStart: { x: 500, y: 2020 }, objectiveNodes: [{ x: 1240, y: 1580 }, { x: 2080, y: 2160 }, { x: 2940, y: 1550 }], bossSpawn: { x: 3550, y: 2130 }, bossTypeId: 'boss_1', bossName: 'Đồ Tể Khu Cấp Cứu', bossHp: 3100, mobIds: ['normal', 'runner', 'spitter', 'glowing'], buildings: [b(930,1060,250,160,'warehouse',true),b(1670,2860,250,160,'warehouse',true),b(1850,1100,112,80),b(2740,2820,230,150,'warehouse',true),b(3000,1050,104,74)] },
  { id: 4, name: 'Cống thoát nước', description: 'Mở van xả để tiến vào ổ chuột', duration: 480, objective: 'kill_boss', objectiveValue: 1, difficultyMult: 1.1, bossAtEnd: true, reward: 300,
    theme: 'Cống thoát nước', floorColor: '#2b3431', accentColor: '#88a77c', objectiveLabel: 'Mở van xả', playerStart: { x: 500, y: 2020 }, objectiveNodes: [{ x: 1280, y: 1240 }, { x: 2160, y: 2810 }, { x: 2950, y: 1360 }], bossSpawn: { x: 3530, y: 2070 }, bossTypeId: 'rat_king', bossName: 'Vua Chuột', bossHp: 3900, mobIds: ['normal', 'spider', 'spitter', 'exploder'], buildings: [b(890,980,225,145,'warehouse',true),b(1470,2350,118,90),b(1860,850,115,82),b(2120,3180,235,150,'warehouse',true),b(2800,2320,110,82),b(3030,980,220,145,'warehouse',true)] },
  { id: 5, name: 'Chốt quân sự', description: 'Mở cổng và hạ kẻ phá cổng', duration: 520, objective: 'kill_boss', objectiveValue: 1, difficultyMult: 1.2, bossAtEnd: true, reward: 420,
    theme: 'Chốt quân sự', floorColor: '#333332', accentColor: '#c4ad72', objectiveLabel: 'Mở cổng tiền đồn', playerStart: { x: 500, y: 2020 }, objectiveNodes: [{ x: 1200, y: 1660 }, { x: 2180, y: 2040 }, { x: 2950, y: 1790 }], bossSpawn: { x: 3550, y: 2070 }, bossTypeId: 'boss_1', bossName: 'The Abomination — Kẻ Phá Cổng', bossHp: 5400, mobIds: ['normal', 'runner', 'tank', 'exploder', 'armed'], buildings: [b(850,920,240,158,'warehouse',true),b(1390,2840,230,145,'warehouse',true),b(1910,1080,116,84),b(2330,2910,236,150,'warehouse',true),b(2920,1000,225,150,'warehouse',true),b(3090,2800,110,78)] },
  { id: 6, name: 'Trung tâm thương mại', description: 'Giữ sảnh trung tâm và diệt Hợp Xướng Ba Miệng', duration: 560, objective: 'kill_boss', objectiveValue: 1, difficultyMult: 1.3, bossAtEnd: true, reward: 550,
    theme: 'Trung tâm thương mại', floorColor: '#343438', accentColor: '#bd7775', objectiveLabel: 'Thu vật tư rồi giữ sảnh trung tâm', objectiveHoldAt: 2, objectiveHoldSeconds: 18, playerStart: { x: 500, y: 2020 }, objectiveNodes: [{ x: 1220, y: 1330 }, { x: 2100, y: 2100 }, { x: 2960, y: 2730 }], bossSpawn: { x: 3560, y: 2070 }, bossTypeId: 'multihead', bossName: 'Hợp Xướng Ba Miệng', bossHp: 6900, mobIds: ['normal', 'runner', 'tank', 'spitter', 'glowing', 'spider', 'armed'], buildings: [b(900,930,255,165,'warehouse',true),b(1660,2930,250,160,'warehouse',true),b(1930,1050,100,76),b(2510,2750,250,162,'warehouse',true),b(2940,1040,240,158,'warehouse',true),b(3110,2050,112,80)] },
  { id: 7, name: 'Bãi tàu hàng', description: 'Kích hoạt tuyến tàu thoát hiểm', duration: 600, objective: 'kill_boss', objectiveValue: 1, difficultyMult: 1.4, bossAtEnd: true, reward: 700,
    theme: 'Bãi tàu hàng', floorColor: '#303235', accentColor: '#c28a59', objectiveLabel: 'Kích hoạt tuyến tàu', playerStart: { x: 500, y: 2020 }, objectiveNodes: [{ x: 1210, y: 1500 }, { x: 2110, y: 2630 }, { x: 2940, y: 1510 }], bossSpawn: { x: 3560, y: 2070 }, bossTypeId: 'boss_2', bossName: 'Death Knight — Kẻ Gác Đường Ray', bossHp: 8500, mobIds: ['normal', 'runner', 'tank', 'exploder', 'armed', 'rat_king'], buildings: [b(820,940,248,158,'warehouse',true),b(1500,2700,240,150,'warehouse',true),b(1840,1060,112,78),b(2360,2930,246,152,'warehouse',true),b(3010,1040,242,154,'warehouse',true),b(3080,2770,116,80)] },
  { id: 8, name: 'Phòng thí nghiệm', description: 'Lấy thẻ truy cập và khóa buồng lây nhiễm', duration: 650, objective: 'kill_boss', objectiveValue: 1, difficultyMult: 1.52, bossAtEnd: true, reward: 900,
    theme: 'Phòng thí nghiệm', floorColor: '#30383a', accentColor: '#68aaa3', objectiveLabel: 'Khóa buồng lây nhiễm', playerStart: { x: 500, y: 2020 }, objectiveNodes: [{ x: 1170, y: 1280 }, { x: 2060, y: 2900 }, { x: 2900, y: 1320 }], bossSpawn: { x: 3560, y: 2070 }, bossTypeId: 'mutant', bossName: 'Mẫu Thử Số Không', bossHp: 10400, mobIds: ['normal', 'runner', 'tank', 'spitter', 'glowing', 'spider', 'mutant', 'multihead', 'exploder'], buildings: [b(850,900,245,158,'warehouse',true),b(1410,2620,226,145,'warehouse',true),b(1880,930,112,80),b(2260,3000,238,152,'warehouse',true),b(2900,920,245,158,'warehouse',true),b(3100,2800,120,84)] },
  { id: 9, name: 'Khu cách ly nội đô', description: 'Phá các ổ lây nhiễm và sống sót qua đợt cuối', duration: 700, objective: 'kill_boss', objectiveValue: 1, difficultyMult: 1.65, bossAtEnd: true, reward: 1150, objectiveHoldAt: 2, objectiveHoldSeconds: 24,
    theme: 'Khu cách ly nội đô', floorColor: '#383233', accentColor: '#c4776e', objectiveLabel: 'Phá ổ lây nhiễm', playerStart: { x: 500, y: 2020 }, objectiveNodes: [{ x: 1200, y: 1410 }, { x: 2130, y: 2810 }, { x: 2940, y: 1420 }], bossSpawn: { x: 3560, y: 2080 }, bossTypeId: 'spider', bossName: 'Nhện Mẫu Chúa', bossHp: 12800, mobIds: ['normal', 'runner', 'tank', 'spitter', 'glowing', 'spider', 'armed', 'mutant', 'multihead', 'exploder'], buildings: [b(820,930,240,152,'warehouse',true),b(1470,2800,238,152,'warehouse',true),b(1850,1000,110,80),b(2350,2930,232,148,'warehouse',true),b(2980,980,246,158,'warehouse',true),b(3080,2780,118,82)] },
  { id: 10, name: 'Ổ dịch trung tâm', description: 'Phá lõi phụ, hạ Trái Tim Chôn Sống và thoát ra', duration: 760, objective: 'kill_boss', objectiveValue: 1, difficultyMult: 1.8, bossAtEnd: true, reward: 1600,
    theme: 'Ổ dịch trung tâm', floorColor: '#332e30', accentColor: '#d26e60', objectiveLabel: 'Phá các lõi phụ', playerStart: { x: 500, y: 2020 }, objectiveNodes: [{ x: 1190, y: 1260 }, { x: 2090, y: 2860 }, { x: 2970, y: 1260 }], bossSpawn: { x: 3540, y: 2070 }, exitSpawn: { x: 3400, y: 2040 }, bossTypeId: 'boss_2', bossName: 'Trái Tim Chôn Sống', bossHp: 18000, mobIds: ['normal', 'runner', 'tank', 'spitter', 'armed', 'mutant', 'multihead', 'exploder'], buildings: [b(850,900,250,160,'warehouse',true),b(1500,2800,240,150,'warehouse',true),b(1870,920,110,80),b(2300,3000,245,155,'warehouse',true),b(2950,900,250,160,'warehouse',true),b(3070,2810,118,84)] },
];

// Keep each start zone visually anchored with two nearby, walkable landmarks.
// Their asymmetric positions leave the opening path and first objective clear.
const openingLandmarks: Array<[number, number, number, number]> = [
  [480, 1740, 700, 2260], [515, 1755, 735, 2280], [465, 1725, 720, 2245],
  [505, 1765, 745, 2300], [475, 1715, 710, 2255], [520, 1735, 760, 2265],
  [460, 1770, 735, 2290], [510, 1720, 700, 2250], [485, 1750, 755, 2275],
  [530, 1740, 720, 2260],
];
const openingVariants: NonNullable<StageBuildingDef['variant']>[] = ['suburb','fuel','medical','sewer','military','mall','rail','lab','quarantine','hive'];
STAGES.forEach((stage, index) => {
  const [ruinX, ruinY, depotX, depotY] = openingLandmarks[index];
  // Give every structure the chapter's recognizable material and interior
  // dressing, rather than only styling the two buildings near spawn.
  for (const building of stage.buildings) building.variant ??= openingVariants[index];
  stage.buildings.unshift(b(ruinX, ruinY, 92, 68, 'ruin', false, (index % 2 ? .04 : -.03), openingVariants[index]), b(depotX, depotY, 190, 126, 'warehouse', true, 0, openingVariants[index]));
});

/** Four readable, dodgeable moves per boss; values are Campaign-only. */
export const CAMPAIGN_ATTACKS: Record<number, CampaignAttackDef[]> = {
  1: [{ name: 'Quét lưỡi', kind: 'sweep', damage: 18, reach: 170, telegraph: .82, recovery: 1.15 }, { name: 'Còi gọi bầy', kind: 'summon', damage: 0, reach: 360, telegraph: 1.05, recovery: 1.1 }, { name: 'Lao phá tuyến', kind: 'charge', damage: 22, reach: 285, telegraph: .95, recovery: 1.45, speed: 390 }, { name: 'Dậm nền', kind: 'slam', damage: 21, reach: 155, telegraph: .9, recovery: 1.3 }],
  2: [{ name: 'Quạt dịch', kind: 'fan', damage: 20, reach: 410, telegraph: .95, recovery: 1.2 }, { name: 'Lao bụng', kind: 'charge', damage: 24, reach: 300, telegraph: 1, recovery: 1.55, speed: 370 }, { name: 'Túi dịch nổ', kind: 'ring', damage: 23, reach: 210, telegraph: 1.1, recovery: 1.4 }, { name: 'Chấn động', kind: 'slam', damage: 26, reach: 180, telegraph: .9, recovery: 1.5 }],
  3: [{ name: 'Đâm cáng', kind: 'charge', damage: 25, reach: 330, telegraph: .95, recovery: 1.45, speed: 410 }, { name: 'Lưỡi mổ', kind: 'sweep', damage: 24, reach: 195, telegraph: .78, recovery: 1.25 }, { name: 'Dải axit', kind: 'web', damage: 21, reach: 360, telegraph: 1, recovery: 1.4 }, { name: 'Trượt quá đà', kind: 'slam', damage: 24, reach: 155, telegraph: .85, recovery: 1.7 }],
  4: [{ name: 'Cuộn ổ chuột', kind: 'charge', damage: 28, reach: 305, telegraph: 1, recovery: 1.4, speed: 340 }, { name: 'Vồ nhiều đầu', kind: 'fan', damage: 24, reach: 285, telegraph: .9, recovery: 1.25 }, { name: 'Cào thành cung', kind: 'sweep', damage: 25, reach: 210, telegraph: .85, recovery: 1.35 }, { name: 'Đàn chuột tràn', kind: 'ring', damage: 27, reach: 235, telegraph: 1.15, recovery: 1.55 }],
  5: [{ name: 'Đập phá cổng', kind: 'slam', damage: 32, reach: 205, telegraph: 1, recovery: 1.5 }, { name: 'Quét tay khổng lồ', kind: 'sweep', damage: 30, reach: 245, telegraph: .9, recovery: 1.35 }, { name: 'Xung phong phá thành', kind: 'charge', damage: 34, reach: 360, telegraph: 1.05, recovery: 1.65, speed: 430 }, { name: 'Combo trễ', kind: 'stomp', damage: 34, reach: 195, telegraph: 1, recovery: 1.7 }],
  6: [{ name: 'Ba hàm bổ xuống', kind: 'fan', damage: 32, reach: 330, telegraph: .9, recovery: 1.35 }, { name: 'Chuỗi tay lệch nhịp', kind: 'sweep', damage: 31, reach: 250, telegraph: .85, recovery: 1.4 }, { name: 'Thân thể lao tới', kind: 'charge', damage: 36, reach: 350, telegraph: 1, recovery: 1.55, speed: 400 }, { name: 'Hợp âm chấn động', kind: 'ring', damage: 33, reach: 265, telegraph: 1.05, recovery: 1.6 }],
  7: [{ name: 'Xích kéo đường ray', kind: 'web', damage: 35, reach: 440, telegraph: .95, recovery: 1.45 }, { name: 'Đại kiếm nặng', kind: 'sweep', damage: 37, reach: 270, telegraph: .9, recovery: 1.4 }, { name: 'Lao dọc đường ray', kind: 'charge', damage: 40, reach: 390, telegraph: 1, recovery: 1.65, speed: 440 }, { name: 'Đòn hai nhịp trì hoãn', kind: 'stomp', damage: 40, reach: 225, telegraph: 1.05, recovery: 1.8 }],
  8: [{ name: 'Đường nứt mô thịt', kind: 'web', damage: 39, reach: 420, telegraph: .9, recovery: 1.45 }, { name: 'Quạt dịch ăn mòn', kind: 'fan', damage: 38, reach: 430, telegraph: .9, recovery: 1.35 }, { name: 'Chi dài quét ngang', kind: 'sweep', damage: 42, reach: 310, telegraph: .85, recovery: 1.55 }, { name: 'Co rút rồi vồ', kind: 'charge', damage: 45, reach: 395, telegraph: .95, recovery: 1.8, speed: 470 }],
  9: [{ name: 'Cú vồ đổi hướng', kind: 'charge', damage: 43, reach: 400, telegraph: 1, recovery: 1.55, speed: 470 }, { name: 'Dải tơ cắt lối', kind: 'web', damage: 39, reach: 470, telegraph: .95, recovery: 1.45 }, { name: 'Nhảy đè', kind: 'slam', damage: 46, reach: 230, telegraph: 1.1, recovery: 1.8 }, { name: 'Bò vòng rồi bổ', kind: 'fan', damage: 44, reach: 370, telegraph: .9, recovery: 1.5 }],
  10: [{ name: 'Chi thể giáng xuống', kind: 'slam', damage: 46, reach: 255, telegraph: 1, recovery: 1.5 }, { name: 'Dòng máu trên sàn', kind: 'cross', damage: 42, reach: 420, telegraph: 1.05, recovery: 1.55 }, { name: 'Lõi lộ thiên', kind: 'ring', damage: 48, reach: 290, telegraph: 1.1, recovery: 1.8 }, { name: 'Trái tim co giật', kind: 'stomp', damage: 52, reach: 245, telegraph: 1.05, recovery: 1.9 }, { name: 'Xác bò lên từ lõi', kind: 'summon', damage: 0, reach: 180, telegraph: 1.15, recovery: 1.9 }],
};
