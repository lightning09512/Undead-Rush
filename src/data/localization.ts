import type { StageDef } from './meta';
import type { ZombieTypeDef } from './zombies';

export type GameLanguage = 'vi' | 'en';

const PROTECTED_TERMS = /\b(?:undead rush|wasd|esc|shift|hp|xp|p-9|ar-7|smg-9|sg-12|dmr-55|bulldog|lmg-6|flamer|rpg-4|railgun|rail lance|howler captain|the pump maw|the triage butcher|rat king|the abomination|gatebreaker|three-mouthed chorus|death knight|rail warden|specimen zero|broodmother|the buried heart|đội trưởng còi hú|họng bơm|đồ tể khu cấp cứu|vua chuột|hợp xướng ba miệng|kẻ phá cổng|kẻ gác đường ray|mẫu thử số không|nhện mẫu chúa|trái tim chôn sống)\b/gi;
const PREFERRED_TERM_CASE: Record<string, string> = {
  'undead rush': 'Undead Rush', wasd: 'WASD', esc: 'Esc', shift: 'Shift', hp: 'HP', xp: 'XP',
  'p-9': 'P-9', 'ar-7': 'AR-7', 'smg-9': 'SMG-9', 'sg-12': 'SG-12', 'dmr-55': 'DMR-55',
  bulldog: 'Bulldog', 'lmg-6': 'LMG-6', flamer: 'Flamer', 'rpg-4': 'RPG-4', railgun: 'Railgun', 'rail lance': 'Rail Lance',
  'howler captain': 'Howler Captain', 'the pump maw': 'The Pump Maw', 'the triage butcher': 'The Triage Butcher',
  'rat king': 'Rat King', 'the abomination': 'The Abomination', gatebreaker: 'Gatebreaker',
  'three-mouthed chorus': 'Three-Mouthed Chorus', 'death knight': 'Death Knight', 'rail warden': 'Rail Warden',
  'specimen zero': 'Specimen Zero', broodmother: 'Broodmother', 'the buried heart': 'The Buried Heart',
  'đội trưởng còi hú': 'Đội trưởng Còi Hú', 'họng bơm': 'Họng Bơm', 'đồ tể khu cấp cứu': 'Đồ Tể Khu Cấp Cứu',
  'vua chuột': 'Vua Chuột', 'hợp xướng ba miệng': 'Hợp Xướng Ba Miệng', 'kẻ phá cổng': 'Kẻ Phá Cổng',
  'kẻ gác đường ray': 'Kẻ Gác Đường Ray', 'mẫu thử số không': 'Mẫu Thử Số Không', 'nhện mẫu chúa': 'Nhện Mẫu Chúa',
  'trái tim chôn sống': 'Trái Tim Chôn Sống',
};

/** Normalizes legacy all-caps UI copy while retaining key names and weapon codes. */
export function sentenceCaseDisplay(text: string, language: GameLanguage): string {
  const locale = language === 'en' ? 'en-US' : 'vi-VN';
  const protectedTerms: string[] = [];
  const preserved = text.replace(PROTECTED_TERMS, term => {
    protectedTerms.push(PREFERRED_TERM_CASE[term.toLocaleLowerCase(locale)] ?? term);
    return `\u0000${protectedTerms.length - 1}\u0000`;
  });
  const lowered = preserved.toLocaleLowerCase(locale);
  const sentenceCased = lowered.replace(/(^|[.!?]\s+)([\p{L}])/gu, (_match, prefix: string, letter: string) =>
    `${prefix}${letter.toLocaleUpperCase(locale)}`);
  return sentenceCased.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => protectedTerms[Number(index)]);
}

type StageCopy = Pick<StageDef, 'name' | 'description' | 'theme' | 'objectiveLabel' | 'bossName'>;

const STAGE_COPY: Record<number, Record<GameLanguage, StageCopy>> = {
  1: {
    vi: { name: 'Ngoại ô phong tỏa', description: 'Kích hoạt radio cứu hộ và hạ Đội trưởng Còi Hú.', theme: 'Ngoại ô phong tỏa', objectiveLabel: 'Kích hoạt radio cứu hộ', bossName: 'Đội trưởng Còi Hú' },
    en: { name: 'Quarantined suburbs', description: 'Activate the rescue radios and take down the Howler Captain.', theme: 'Quarantined suburbs', objectiveLabel: 'Activate the rescue radios', bossName: 'Howler Captain' },
  },
  2: {
    vi: { name: 'Trạm xăng bỏ hoang', description: 'Thu hồi nhiên liệu tại các vòi bơm.', theme: 'Trạm xăng bỏ hoang', objectiveLabel: 'Thu hồi nhiên liệu', bossName: 'Họng Bơm' },
    en: { name: 'Abandoned fuel stop', description: 'Recover fuel from the pumps.', theme: 'Abandoned fuel stop', objectiveLabel: 'Recover fuel', bossName: 'The Pump Maw' },
  },
  3: {
    vi: { name: 'Bệnh viện dã chiến', description: 'Khôi phục điện và thu hồi vật tư y tế.', theme: 'Bệnh viện dã chiến', objectiveLabel: 'Khôi phục điện và thu hồi vật tư', bossName: 'Đồ Tể Khu Cấp Cứu' },
    en: { name: 'Field hospital', description: 'Restore power and recover medical supplies.', theme: 'Field hospital', objectiveLabel: 'Restore power and recover supplies', bossName: 'The Triage Butcher' },
  },
  4: {
    vi: { name: 'Cống thoát nước', description: 'Mở van xả để tiến sâu vào ổ chuột.', theme: 'Cống thoát nước', objectiveLabel: 'Mở van xả', bossName: 'Vua Chuột' },
    en: { name: 'Storm drains', description: 'Open the sluice gates and push into the nest.', theme: 'Storm drains', objectiveLabel: 'Open the sluice gates', bossName: 'Rat King' },
  },
  5: {
    vi: { name: 'Chốt quân sự', description: 'Mở cổng tiền đồn và hạ Kẻ Phá Cổng.', theme: 'Chốt quân sự', objectiveLabel: 'Mở cổng tiền đồn', bossName: 'The Abomination — Kẻ Phá Cổng' },
    en: { name: 'Military outpost', description: 'Open the outpost gate and bring down the Gatebreaker.', theme: 'Military outpost', objectiveLabel: 'Open the outpost gate', bossName: 'The Abomination — Gatebreaker' },
  },
  6: {
    vi: { name: 'Trung tâm thương mại', description: 'Giữ sảnh trung tâm và hạ Hợp Xướng Ba Miệng.', theme: 'Trung tâm thương mại', objectiveLabel: 'Thu vật tư rồi giữ sảnh trung tâm', bossName: 'Hợp Xướng Ba Miệng' },
    en: { name: 'Shopping mall', description: 'Hold the central atrium and silence the Three-Mouthed Chorus.', theme: 'Shopping mall', objectiveLabel: 'Recover supplies, then hold the atrium', bossName: 'Three-Mouthed Chorus' },
  },
  7: {
    vi: { name: 'Bãi tàu hàng', description: 'Kích hoạt tuyến tàu thoát hiểm.', theme: 'Bãi tàu hàng', objectiveLabel: 'Kích hoạt tuyến tàu', bossName: 'Death Knight — Kẻ Gác Đường Ray' },
    en: { name: 'Freight yard', description: 'Bring the evacuation train online.', theme: 'Freight yard', objectiveLabel: 'Activate the train line', bossName: 'Death Knight — Rail Warden' },
  },
  8: {
    vi: { name: 'Phòng thí nghiệm', description: 'Lấy thẻ truy cập và khóa buồng lây nhiễm.', theme: 'Phòng thí nghiệm', objectiveLabel: 'Khóa buồng lây nhiễm', bossName: 'Mẫu Thử Số Không' },
    en: { name: 'Research laboratory', description: 'Find the access card and seal the infected chamber.', theme: 'Research laboratory', objectiveLabel: 'Seal the infected chamber', bossName: 'Specimen Zero' },
  },
  9: {
    vi: { name: 'Khu cách ly nội đô', description: 'Phá các ổ lây nhiễm và sống sót qua đợt cuối.', theme: 'Khu cách ly nội đô', objectiveLabel: 'Phá ổ lây nhiễm', bossName: 'Nhện Mẫu Chúa' },
    en: { name: 'Inner-city quarantine', description: 'Destroy the infection nests and survive the final push.', theme: 'Inner-city quarantine', objectiveLabel: 'Destroy the infection nests', bossName: 'Broodmother' },
  },
  10: {
    vi: { name: 'Ổ dịch trung tâm', description: 'Phá lõi phụ, hạ Trái Tim Chôn Sống rồi thoát ra.', theme: 'Ổ dịch trung tâm', objectiveLabel: 'Phá các lõi phụ', bossName: 'Trái Tim Chôn Sống' },
    en: { name: 'The central hive', description: 'Destroy the auxiliary cores, kill the Buried Heart, and escape.', theme: 'The central hive', objectiveLabel: 'Destroy the auxiliary cores', bossName: 'The Buried Heart' },
  },
};

const ZOMBIE_NAMES: Record<string, Record<GameLanguage, string>> = {
  normal: { vi: 'Xác sống lê bước', en: 'Shambler' }, runner: { vi: 'Xác sống chạy', en: 'Runner' },
  tank: { vi: 'Xác sống khổng lồ', en: 'Brute' }, exploder: { vi: 'Xác sống phát nổ', en: 'Boomer' },
  spitter: { vi: 'Xác sống phun dịch', en: 'Spitter' }, glowing: { vi: 'Xác sống phát sáng', en: 'Radiant' },
  boss_1: { vi: 'Kẻ ghê tởm', en: 'The Abomination' }, boss_2: { vi: 'Kỵ sĩ Tử Thần', en: 'Death Knight' },
  spider: { vi: 'Nhện đột biến', en: 'Mutant Spider' }, armed: { vi: 'Kẻ hành hình', en: 'Executioner' },
  rat_king: { vi: 'Vua Chuột', en: 'Rat King' }, mutant: { vi: 'Kẻ đột biến', en: 'Mutant' },
  multihead: { vi: 'Hợp thể ba đầu', en: 'Three-Headed Abomination' },
  orange_mutant: { vi: 'Đột biến cam', en: 'Orange Mutant' }, red_mutant: { vi: 'Đột biến đỏ', en: 'Red Mutant' },
  gunner: { vi: 'Xạ thủ xác sống', en: 'Undead Gunner' }, gunner_orange: { vi: 'Xạ thủ đột biến cam', en: 'Orange Gunner' },
  gunner_red: { vi: 'Xạ thủ đột biến đỏ', en: 'Red Gunner' },
};

export function getStageCopy(stage: StageDef, language: GameLanguage): StageCopy {
  return STAGE_COPY[stage.id]?.[language] ?? {
    name: stage.name, description: stage.description, theme: stage.theme,
    objectiveLabel: stage.objectiveLabel, bossName: stage.bossName,
  };
}

/** A shallow display-only view; gameplay continues to use the original stage data. */
export function localizeStage(stage: StageDef, language: GameLanguage): StageDef {
  return { ...stage, ...getStageCopy(stage, language) };
}

export function getZombieName(zombie: Pick<ZombieTypeDef, 'id' | 'name'>, language: GameLanguage): string {
  return ZOMBIE_NAMES[zombie.id]?.[language] ?? zombie.name;
}

export function localizeZombieName(id: string, language: GameLanguage, fallback = id): string {
  return ZOMBIE_NAMES[id]?.[language] ?? fallback;
}

const ZONE_NAMES: Record<string, string> = {
  'Chốt vào ngoại ô': 'Suburban checkpoint', 'Cụm nhà và sân nhỏ': 'Houses and backyards', 'Đường xe bị chặn': 'Blocked street', 'Quảng trường radio': 'Radio plaza', 'Sân trạm cứu hộ': 'Rescue station yard',
  'Bãi xe dẫn vào': 'Entry lot', 'Sân cột bơm': 'Pump forecourt', 'Cửa hàng tiện lợi': 'Convenience store', 'Bãi xe bồn': 'Tanker lot', 'Sân bảo dưỡng': 'Service yard',
  'Bãi xe cứu thương': 'Ambulance bay', 'Lều cấp cứu': 'Triage tent', 'Hành lang bệnh viện': 'Hospital corridor', 'Phòng vật tư': 'Supply room', 'Khu cấp cứu cuối': 'Emergency ward',
  'Miệng cống': 'Drain entrance', 'Nhánh cống thấp': 'Lower drain', 'Phòng van lớn': 'Valve chamber', 'Cầu cửa xả': 'Sluice bridge', 'Ổ chuột': 'Rat nest',
  'Đường chống xe': 'Anti-vehicle lane', 'Bao cát và chòi gác': 'Sandbags and watch post', 'Bãi xe bọc thép': 'Armored vehicle lot', 'Cổng chính': 'Main gate', 'Sân tập sau cổng': 'Inner yard',
  'Cửa vào sập kính': 'Shattered glass entrance', 'Dãy cửa hàng': 'Shop row', 'Food court': 'Food court', 'Sảnh trung tâm': 'Central atrium', 'Sảnh biểu diễn': 'Performance hall',
  'Lối vào đường ray': 'Rail entrance', 'Vành đai container': 'Container yard', 'Sân toa hàng': 'Freight platform', 'Phòng tín hiệu': 'Signal room', 'Đoạn ray cuối': 'End of the line',
  'Sảnh tiếp nhận': 'Reception hall', 'Hành lang buồng kính': 'Glass chamber corridor', 'Khu nuôi cấy': 'Culture lab', 'Phòng kiểm soát': 'Control room', 'Buồng thử nghiệm số không': 'Specimen Zero chamber',
  'Chốt cách ly': 'Quarantine checkpoint', 'Cửa hàng đổ nát': 'Ransacked shops', 'Quảng trường ổ dịch': 'Infestation plaza', 'Phố nối': 'Connecting street', 'Quảng trường phong tỏa': 'Sealed plaza', 'Tổ nhện cuối phố': 'Brood nest',
  'Miệng vùng nhiễm': 'Hive entrance', 'Nhánh lõi thứ nhất': 'First core branch', 'Nhánh lõi thứ hai': 'Second core branch', 'Nhánh lõi thứ ba': 'Third core branch', 'Tiền sảnh lõi': 'Core antechamber', 'Phòng tim': 'Heart chamber',
};

export function localizeZoneName(name: string, language: GameLanguage): string {
  return language === 'en' ? ZONE_NAMES[name] ?? name : name;
}

export const UI_COPY = {
  campaign: { vi: 'Chiến dịch', en: 'Campaign' },
  survival: { vi: 'Sinh tồn', en: 'Survival' },
  mission: { vi: 'Màn', en: 'Mission' },
  wave: { vi: 'Đợt', en: 'Wave' },
  boss: { vi: 'Trùm', en: 'Boss' },
  reserveAmmo: { vi: 'Đạn dự trữ', en: 'Reserve ammo' },
  cooldown: { vi: 'Hồi chiêu', en: 'Cooldown' },
  credits: { vi: 'Tín dụng', en: 'credits' },
  gold: { vi: 'Vàng', en: 'gold' },
} as const;

export type UiTerm = keyof typeof UI_COPY;

export function getUiTerm(term: UiTerm, language: GameLanguage): string {
  return UI_COPY[term][language];
}
