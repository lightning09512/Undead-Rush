/** Shared visual and sonic identity for the ten authored Campaign bosses. */
export type BossProjectileType = 'boss_acid' | 'boss_shard' | 'boss_fire' | 'boss_arcane' | 'boss_blood';

export interface BossSignature {
  id: number;
  name: string;
  warningText: { vi: string; en: string };
  projectile: BossProjectileType;
  colors: { core: string; glow: string; edge: string; warning: string; impact: string };
  audio: {
    rootHz: number;
    harmonicRatio: number;
    throatHz: number;
    textureHz: number;
    filterQ: number;
    waveform: OscillatorType;
  };
}

export const BOSS_SIGNATURES: Record<number, BossSignature> = {
  1: { id: 1, name: 'Howler Captain', warningText: { vi: 'Còi hú dồn âm', en: 'Siren pressure' }, projectile: 'boss_shard',
    colors: { core: '#f2d08b', glow: '#c76543', edge: '#393d37', warning: '#e1c48d', impact: '#c98c60' },
    audio: { rootHz: 46, harmonicRatio: 2.71, throatHz: 360, textureHz: 760, filterQ: .72, waveform: 'sawtooth' } },
  2: { id: 2, name: 'Pump Maw', warningText: { vi: 'Áp suất dồn lại', en: 'Pressure buildup' }, projectile: 'boss_acid',
    colors: { core: '#e0d77c', glow: '#98b956', edge: '#384631', warning: '#bed377', impact: '#a8bd63' },
    audio: { rootHz: 34, harmonicRatio: 1.38, throatHz: 245, textureHz: 430, filterQ: .66, waveform: 'triangle' } },
  3: { id: 3, name: 'Triage Butcher', warningText: { vi: 'Nhát mổ chuẩn bị', en: 'Surgical strike' }, projectile: 'boss_blood',
    colors: { core: '#dae1d4', glow: '#a74f4a', edge: '#555d59', warning: '#b8d1c6', impact: '#d0bda5' },
    audio: { rootHz: 57, harmonicRatio: 2.19, throatHz: 590, textureHz: 1420, filterQ: 1.34, waveform: 'sawtooth' } },
  4: { id: 4, name: 'Rat King', warningText: { vi: 'Đàn chuột trào lên', en: 'Swarm eruption' }, projectile: 'boss_acid',
    colors: { core: '#d5df9c', glow: '#829b4b', edge: '#423e2f', warning: '#bdc978', impact: '#a4b75d' },
    audio: { rootHz: 41, harmonicRatio: 1.64, throatHz: 315, textureHz: 920, filterQ: .88, waveform: 'sawtooth' } },
  5: { id: 5, name: 'The Abomination', warningText: { vi: 'Khối thịt co rút', en: 'Mass contracting' }, projectile: 'boss_fire',
    colors: { core: '#fff1b4', glow: '#f17937', edge: '#662c24', warning: '#d3be78', impact: '#ed713e' },
    audio: { rootHz: 31, harmonicRatio: 1.57, throatHz: 190, textureHz: 680, filterQ: .78, waveform: 'sawtooth' } },
  6: { id: 6, name: 'Three-Mouth Choir', warningText: { vi: 'Hợp âm biến dạng', en: 'Dissonant pulse' }, projectile: 'boss_arcane',
    colors: { core: '#e5c9ff', glow: '#a35bd0', edge: '#43294f', warning: '#d3a9de', impact: '#b183cf' },
    audio: { rootHz: 63, harmonicRatio: 2.37, throatHz: 520, textureHz: 1180, filterQ: 1.52, waveform: 'triangle' } },
  7: { id: 7, name: 'Death Knight', warningText: { vi: 'Sóng linh thể', en: 'Wraith surge' }, projectile: 'boss_shard',
    colors: { core: '#deefff', glow: '#6895c2', edge: '#273943', warning: '#a9c5d1', impact: '#92abc3' },
    audio: { rootHz: 38, harmonicRatio: 2.83, throatHz: 780, textureHz: 1850, filterQ: 1.04, waveform: 'sawtooth' } },
  8: { id: 8, name: 'Specimen Zero', warningText: { vi: 'Lõi năng lượng', en: 'Core overload' }, projectile: 'boss_arcane',
    colors: { core: '#d6ffca', glow: '#59c49c', edge: '#1e5349', warning: '#9bd8bd', impact: '#6ec9a7' },
    audio: { rootHz: 49, harmonicRatio: 1.31, throatHz: 405, textureHz: 1080, filterQ: 1.72, waveform: 'triangle' } },
  9: { id: 9, name: 'Broodmother', warningText: { vi: 'Ấu thể thức dậy', en: 'Brood stirring' }, projectile: 'boss_acid',
    colors: { core: '#f0bdc7', glow: '#bd5969', edge: '#522f3d', warning: '#d08e93', impact: '#b85d69' },
    audio: { rootHz: 36, harmonicRatio: 1.82, throatHz: 275, textureHz: 610, filterQ: .7, waveform: 'sawtooth' } },
  10: { id: 10, name: 'The Buried Heart', warningText: { vi: 'Tim sắp vỡ', en: 'Heart rupture' }, projectile: 'boss_blood',
    colors: { core: '#ffe1bd', glow: '#d83b43', edge: '#561d2b', warning: '#cf8179', impact: '#d64449' },
    audio: { rootHz: 29, harmonicRatio: 1.48, throatHz: 225, textureHz: 520, filterQ: .94, waveform: 'sawtooth' } },
};

const DEFAULT_BOSS_SIGNATURE = BOSS_SIGNATURES[1];

export function getBossSignature(id: number | null | undefined): BossSignature {
  return BOSS_SIGNATURES[id ?? 0] ?? DEFAULT_BOSS_SIGNATURE;
}

export function getBossIdFromType(type: string): number {
  const match = /^boss_(\d+)$/.exec(type);
  if (!match) return 1;
  // Timed Survival bosses reuse these two legacy creature IDs, whose actual
  // identities match the Abomination and Death Knight Campaign encounters.
  return match[1] === '1' ? 5 : match[1] === '2' ? 7 : Number(match[1]);
}
