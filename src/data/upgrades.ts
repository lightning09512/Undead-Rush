// ─── Game Data: Upgrades ───

export const MAX_WEAPON_SLOTS = 6;
export const MAX_PASSIVE_SLOTS = 6;

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji or icon code
  maxLevel: number;
  category: 'stat' | 'weapon' | 'effect';
  values: number[];
  /** If specified, only available if player currently possesses this gun ('ar7', 'sg12', 'smg9') */
  gunReq?: string;
  evolvesFrom?: [string, string];
  evolveReqLevel?: number;
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic';
}

export const UPGRADES: UpgradeDef[] = [
  // ─── AR-7 Specific Upgrades (Available by default) ───
  {
    id: 'ar7_drum_mag',
    name: 'Băng Đạn Trống AR-7',
    description: '+10 viên đạn băng AR-7 (sấy lâu hơn)',
    icon: '📦',
    maxLevel: 3,
    category: 'weapon',
    gunReq: 'ar7',
    values: [10, 20, 30],
  },
  {
    id: 'ar7_recoil_brake',
    name: 'Ống Hãm Nảy AR-7',
    description: '-35% độ giật súng, đường đạn chụm thẳng',
    icon: '🎯',
    maxLevel: 3,
    category: 'weapon',
    gunReq: 'ar7',
    values: [0.35, 0.60, 0.80],
  },
  {
    id: 'ar7_heavy_caliber',
    name: 'Đầu Đạn 7.62mm AR-7',
    description: '+25% sát thương đạn trường AR-7',
    icon: '⚡',
    maxLevel: 4,
    category: 'weapon',
    gunReq: 'ar7',
    values: [1.25, 1.50, 1.75, 2.0],
  },
  {
    id: 'ar7_rapid_trigger',
    name: 'Tăng Tốc Sấy AR-7',
    description: '+20% tốc độ sấy liên thanh (650+ RPM)',
    icon: '🔥',
    maxLevel: 3,
    category: 'weapon',
    gunReq: 'ar7',
    values: [1.20, 1.40, 1.65],
  },

  // ─── SG-12 Shotgun Specific Upgrades (ONLY unlocked after picking up SG-12!) ───
  {
    id: 'sg12_buckshot_spread',
    name: 'Đạn Ghém Tăng Cường SG-12',
    description: '+3 viên đạn mỗi phát bắn (7 -> 10 viên)',
    icon: '💥',
    maxLevel: 3,
    category: 'weapon',
    gunReq: 'sg12',
    values: [3, 6, 9],
  },
  {
    id: 'sg12_mag_tube',
    name: 'Ống Tiếp Đạn SG-12',
    description: '+4 viên đạn tối đa trong băng (8 -> 12)',
    icon: '🔋',
    maxLevel: 3,
    category: 'weapon',
    gunReq: 'sg12',
    values: [4, 8, 12],
  },
  {
    id: 'sg12_choke',
    name: 'Choke Siết Nòng SG-12',
    description: 'Gom chụm đạn ghém 40%, tăng 30% tầm bắn',
    icon: '🎯',
    maxLevel: 3,
    category: 'weapon',
    gunReq: 'sg12',
    values: [0.4, 0.65, 0.85],
  },
  {
    id: 'sg12_frag_rounds',
    name: 'Đạn Ghém Phá Nổ SG-12',
    description: 'Mỗi viên đạn ghém phát nổ khi va chạm',
    icon: '🧨',
    maxLevel: 3,
    category: 'weapon',
    gunReq: 'sg12',
    values: [35, 55, 80],
  },

  // ─── SMG-9 Submachine Specific Upgrades (ONLY unlocked after picking up SMG-9!) ───
  {
    id: 'smg9_cyclone',
    name: 'Xả Đạn Cuồng Phong SMG-9',
    description: '+30% tốc độ sấy RPM (780 -> 1014 RPM)',
    icon: '⚡',
    maxLevel: 3,
    category: 'weapon',
    gunReq: 'smg9',
    values: [1.30, 1.60, 1.95],
  },
  {
    id: 'smg9_drum_mag',
    name: 'Băng Đạn Kép SMG-9',
    description: '+20 viên đạn trong băng (40 -> 60 viên)',
    icon: '📦',
    maxLevel: 3,
    category: 'weapon',
    gunReq: 'smg9',
    values: [20, 40, 60],
  },
  {
    id: 'smg9_hollow_point',
    name: 'Đạn Đầu Rỗng SMG-9',
    description: '+30% sát thương sấy đạn SMG-9',
    icon: '🗡️',
    maxLevel: 3,
    category: 'weapon',
    gunReq: 'smg9',
    values: [1.30, 1.60, 1.90],
  },
  {
    id: 'smg9_featherweight',
    name: 'Thân Nhẹ Tác Chiến SMG-9',
    description: '+15% tốc độ di chuyển khi cầm SMG-9',
    icon: '👟',
    maxLevel: 3,
    category: 'weapon',
    gunReq: 'smg9',
    values: [1.15, 1.30, 1.45],
  },

  // ─── Universal Stats (Always available) ───
  {
    id: 'damage',
    name: 'Lực Bắn Tổng Thể',
    description: '+15% sát thương toàn bộ vũ khí',
    icon: '⚔️',
    maxLevel: 6,
    category: 'stat',
    values: [1.15, 1.30, 1.45, 1.60, 1.80, 2.0],
  },
  {
    id: 'max_hp',
    name: 'Sinh Lực Thể Chất',
    description: '+25 Máu tối đa và hồi phục',
    icon: '❤️',
    maxLevel: 5,
    category: 'stat',
    values: [125, 150, 175, 200, 250],
  },
  {
    id: 'move_speed',
    name: 'Đôi Chân Thần Tốc',
    description: '+10% tốc độ chạy',
    icon: '👟',
    maxLevel: 5,
    category: 'stat',
    values: [1.10, 1.20, 1.30, 1.40, 1.55],
  },
  {
    id: 'pickup_radius',
    name: 'Từ Trường Thu Gom',
    description: '+30% bán kính hút mảnh điểm',
    icon: '🧲',
    maxLevel: 5,
    category: 'stat',
    values: [1.30, 1.60, 1.90, 2.20, 2.60],
  },
  {
    id: 'armor',
    name: 'Giáp Chống Cắn',
    description: '-10% sát thương gánh chịu',
    icon: '🛡️',
    maxLevel: 5,
    category: 'stat',
    values: [0.90, 0.80, 0.70, 0.60, 0.50],
  },
  {
    id: 'lifesteal',
    name: 'Huyết Dược Sinh Tồn',
    description: 'Hồi máu khi tiêu diệt zombie',
    icon: '🧛',
    maxLevel: 3,
    category: 'effect',
    values: [2, 4, 7],
  },
  {
    id: 'mines',
    name: 'Mìn Đất Tự Động',
    description: 'Thả mìn bẫy nổ phía sau khi di chuyển',
    icon: '🔻',
    maxLevel: 4,
    category: 'weapon',
    values: [1, 2, 3, 4],
  },
  {
    id: 'drone',
    name: 'Drone Hộ Vệ',
    description: 'Drone chiến thuật bay quanh hỗ trợ hỏa lực',
    icon: '🤖',
    maxLevel: 4,
    category: 'weapon',
    values: [1, 2, 3, 4],
  },
  // ─── Survival build cards ───
  {
    id: 'piercing', name: 'Đạn Xuyên Giáp', description: 'Đạn xuyên thêm mục tiêu; mỗi cấp +1 lần xuyên.',
    icon: '⟿', maxLevel: 3, category: 'weapon', values: [1, 2, 3], rarity: 'uncommon',
  },
  {
    id: 'bleeding_rounds', name: 'Đạn Găm Mô', description: 'Đạn có cơ hội gây chảy máu, gây sát thương theo thời gian.',
    icon: '🩸', maxLevel: 3, category: 'weapon', values: [.18, .3, .42], rarity: 'uncommon',
  },
  {
    id: 'shock_rounds', name: 'Đạn Điện Xung', description: 'Đạn có cơ hội làm quái thường khựng lại trong chốc lát.',
    icon: 'ϟ', maxLevel: 3, category: 'weapon', values: [.12, .2, .28], rarity: 'rare',
  },
  {
    id: 'executioner', name: 'Kết Liễu', description: 'Gây thêm sát thương lên mục tiêu còn dưới 35% máu.',
    icon: '†', maxLevel: 3, category: 'weapon', values: [1.18, 1.32, 1.48], rarity: 'rare',
  },
  {
    id: 'mutant_hunter', name: 'Thợ Săn Dị Chủng', description: 'Tăng sát thương lên boss và quái tinh anh.',
    icon: '☠', maxLevel: 3, category: 'weapon', values: [1.12, 1.25, 1.4], rarity: 'rare',
  },
  {
    id: 'field_medic', name: 'Quân Y Dã Chiến', description: 'Hồi máu khi hạ boss hoặc quái tinh anh.',
    icon: '+', maxLevel: 3, category: 'effect', values: [8, 13, 20], rarity: 'uncommon',
  },
  {
    id: 'evasive_training', name: 'Phản Xạ Né Tránh', description: 'Giảm hồi chiêu lướt 8% mỗi cấp.',
    icon: '↗', maxLevel: 3, category: 'stat', values: [.92, .84, .76], rarity: 'uncommon',
  },
  {
    id: 'dash_impact', name: 'Lướt Xuyên Xương', description: 'Cú lướt gây sát thương một lần lên quái sát bên.',
    icon: '➤', maxLevel: 3, category: 'weapon', values: [22, 36, 52], rarity: 'rare',
  },
  {
    id: 'rapid_reload', name: 'Thao Tác Thay Đạn', description: 'Thay đạn nhanh hơn 12% mỗi cấp.',
    icon: '↻', maxLevel: 3, category: 'stat', values: [1.12, 1.24, 1.36], rarity: 'uncommon',
  },
  {
    id: 'ammo_scavenger', name: 'Tận Dụng Tiếp Tế', description: 'Nhặt được nhiều đạn hơn từ hộp tiếp tế.',
    icon: '▣', maxLevel: 3, category: 'effect', values: [1.25, 1.5, 1.8], rarity: 'uncommon',
  },
  {
    id: 'last_stand', name: 'Cố Sống Còn', description: 'Khi máu dưới 30%, giảm sát thương nhận vào.',
    icon: '⛨', maxLevel: 3, category: 'effect', values: [.9, .78, .65], rarity: 'rare',
  },
  {
    id: 'reload_guard', name: 'Che Chắn Khi Thay Đạn', description: 'Nhận ít sát thương hơn khi đang thay đạn.',
    icon: '▰', maxLevel: 3, category: 'effect', values: [.88, .76, .62], rarity: 'uncommon',
  },
];

// ─── Evolution combos ───
export interface EvolutionDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  requires: [string, string];
  requireLevel: number;
}

export const EVOLUTIONS: EvolutionDef[] = [
  {
    id: 'cluster_bombs',
    name: 'Bão Lựu Đạn Chùm',
    description: 'Tăng gấp đôi số lượng mảnh nổ văng',
    icon: '💥',
    requires: ['damage', 'armor'],
    requireLevel: 3,
  },
  {
    id: 'frost_nova',
    name: 'Băng Giá Địa Ngục',
    description: 'Mìn đóng băng diện rộng làm chậm 70%',
    icon: '🌀',
    requires: ['mines', 'pickup_radius'],
    requireLevel: 3,
  },
];
