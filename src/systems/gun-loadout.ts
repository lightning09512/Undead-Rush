// ─── Gun Loadout System: Full-Auto Spray, Tactical Reload, Gun Pickups & HUD ───

import { Player } from '../entities/player';
import { BulletSystem } from '../entities/bullets';
import { Audio } from '../core/audio';
import { Camera } from '../core/camera';
import { Input } from '../core/input';
import { drawGunArt } from '../graphics/campaign-menu-art';
import { heldGunShape } from '../graphics/held-gun';
import { BulletCasings } from '../graphics/bullet-casings';

export interface GunDef {
  id: string;
  name: string;        // '1·AR-7', '2·SG-12', '3·SMG-9'
  shortName: string;   // 'AR-7', 'SG-12', 'SMG-9'
  slotKey: string;     // '1', '2', '3'
  type: 'rifle' | 'shotgun' | 'smg';
  soundType?: 'pistol' | 'rifle' | 'shotgun' | 'smg';
  magSize: number;     // 30, 8, 40
  fireRate: number;    // shots per sec: 9.1 (545 RPM), 2.1 (126 RPM), 13.0 (780 RPM)
  rpm: number;         // 545, 126, 780
  baseDamage: number;  // 20, 13 (per pellet), 14
  pellets?: number;    // 7 for shotgun
  bulletSpeed: number; // 860, 760, 840
  bulletColor: string; // '#ffdd44', '#ff9933', '#ffe644'
  reloadDuration: number; // in seconds (1.6s, 2.0s, 1.2s)
  spreadBase: number;  // base spread angle in radians
  spreadMax: number;   // max spray spread angle in radians
  recoilImpulse: number;
  campaignOnly?: boolean;
  campaignCost?: number;
  unlockStage?: number;
  reserveMagazines?: number;
  extraPierce?: number;
  extraBlastRadius?: number;
  extraBurnDamage?: number;
}

export function createDefaultGunDefs(): GunDef[] {
  return [
    {
      id: 'ar7',
      name: '1·AR-7',
      shortName: 'AR-7',
      slotKey: '1',
      type: 'rifle',
      magSize: 30,
      fireRate: 9.1, // 545 RPM
      rpm: 545,
      baseDamage: 20,
      bulletSpeed: 1120,
      bulletColor: '#ffdd44',
      reloadDuration: 1.6,
      spreadBase: 0.012,
      spreadMax: 0.075,
      recoilImpulse: 4.8,
    },
    {
      id: 'sg12',
      name: '2·SG-12',
      shortName: 'SG-12',
      slotKey: '2',
      type: 'shotgun',
      magSize: 8,
      fireRate: 2.1, // ~126 RPM
      rpm: 126,
      baseDamage: 13, // 7 pellets x 13 = 91 damage per blast
      pellets: 7,
      bulletSpeed: 980,
      bulletColor: '#ff9933',
      reloadDuration: 2.0,
      spreadBase: 0.24,
      spreadMax: 0.32,
      recoilImpulse: 12.0,
    },
    {
      id: 'smg9',
      name: '3·SMG-9',
      shortName: 'SMG-9',
      slotKey: '3',
      type: 'smg',
      magSize: 40,
      fireRate: 13.0, // 780 RPM
      rpm: 780,
      baseDamage: 14,
      bulletSpeed: 1080,
      bulletColor: '#ffe644',
      reloadDuration: 1.2,
      spreadBase: 0.025,
      spreadMax: 0.11,
      recoilImpulse: 3.2,
    },
  ];
}

/** Ten Campaign weapons, ordered by the chapter that first permits purchase. */
export function createCampaignGunDefs(campaignProgression = true): GunDef[] {
  const [ar7, sg12, smg9] = createDefaultGunDefs();
  const guns: GunDef[] = [
    { id:'p9', name:'P-9', shortName:'P-9', slotKey:'1', type:'rifle', soundType:'pistol', magSize:12, fireRate:3.1, rpm:186, baseDamage:14,
      bulletSpeed:900, bulletColor:'#ddd1b3', reloadDuration:1.65, spreadBase:.02, spreadMax:.07, recoilImpulse:2.5,
      campaignOnly:true, campaignCost:0, unlockStage:1, reserveMagazines:8 },
    { ...ar7, campaignOnly:true, campaignCost:180, unlockStage:2, reserveMagazines:6 },
    { ...smg9, campaignOnly:true, campaignCost:260, unlockStage:3, reserveMagazines:5 },
    { ...sg12, campaignOnly:true, campaignCost:360, unlockStage:4, reserveMagazines:6 },
    { id:'dmr55', name:'DMR-55', shortName:'DMR-55', slotKey:'5', type:'rifle', magSize:10, fireRate:2.2, rpm:132,
      baseDamage:48, bulletSpeed:1420, bulletColor:'#e8d8a2', reloadDuration:2.15, spreadBase:.004, spreadMax:.035, recoilImpulse:8.2,
      campaignOnly:true, campaignCost:520, unlockStage:5, reserveMagazines:7, extraPierce:1 },
    { id:'bulldog', name:'BULLDOG-10', shortName:'BULLDOG', slotKey:'6', type:'shotgun', magSize:10, fireRate:2.5, rpm:150,
      baseDamage:17, pellets:10, bulletSpeed:990, bulletColor:'#ffb653', reloadDuration:2.4, spreadBase:.21, spreadMax:.34, recoilImpulse:14,
      campaignOnly:true, campaignCost:700, unlockStage:6, reserveMagazines:6 },
    { id:'lmg6', name:'LMG-6', shortName:'LMG-6', slotKey:'7', type:'smg', magSize:72, fireRate:11.5, rpm:690,
      baseDamage:19, bulletSpeed:1130, bulletColor:'#ffd45b', reloadDuration:3.0, spreadBase:.025, spreadMax:.15, recoilImpulse:6.4,
      campaignOnly:true, campaignCost:920, unlockStage:7, reserveMagazines:4 },
    { id:'flamer8', name:'FLAMER-8', shortName:'FLAMER', slotKey:'8', type:'smg', magSize:48, fireRate:8.5, rpm:510,
      baseDamage:10, bulletSpeed:680, bulletColor:'#ff7444', reloadDuration:2.7, spreadBase:.04, spreadMax:.19, recoilImpulse:3.8,
      campaignOnly:true, campaignCost:1180, unlockStage:8, reserveMagazines:4, extraBurnDamage:16 },
    { id:'rpg4', name:'RPG-4', shortName:'RPG-4', slotKey:'9', type:'rifle', magSize:4, fireRate:.72, rpm:43,
      baseDamage:92, bulletSpeed:620, bulletColor:'#ff8e47', reloadDuration:2.8, spreadBase:.006, spreadMax:.04, recoilImpulse:15,
      campaignOnly:true, campaignCost:1500, unlockStage:9, reserveMagazines:5, extraBlastRadius:92 },
    { id:'rail_lance', name:'RAIL LANCE', shortName:'RAIL', slotKey:'0', type:'rifle', magSize:6, fireRate:1.05, rpm:63,
      baseDamage:112, bulletSpeed:1660, bulletColor:'#75d5df', reloadDuration:2.45, spreadBase:0, spreadMax:.018, recoilImpulse:13,
      campaignOnly:true, campaignCost:1950, unlockStage:10, reserveMagazines:5, extraPierce:3 },
  ];
  if (!campaignProgression) return guns;
  // Small Campaign-only power steps help later chapters keep pace with their
  // higher health budgets without flattening each gun's distinct role.
  const progression: Record<string, Partial<GunDef>> = {
    smg9: { baseDamage: 15 },
    sg12: { baseDamage: 14 },
    dmr55: { baseDamage: 52 },
    lmg6: { baseDamage: 20 },
    flamer8: { baseDamage: 11, extraBurnDamage: 18 },
    rpg4: { baseDamage: 100, extraBlastRadius: 100 },
    rail_lance: { baseDamage: 122 },
  };
  return guns.map(gun => ({ ...gun, ...progression[gun.id] }));
}

export function createAllGunDefs(): GunDef[] {
  // Survival keeps its previous weapon values; the small power steps above
  // are applied only when Campaign loadout is configured.
  const campaign = createCampaignGunDefs(false);
  const byId = new Map(campaign.map(def => [def.id, def]));
  return [byId.get('ar7')!, byId.get('sg12')!, byId.get('smg9')!,
    ...campaign.filter(def => !['ar7', 'sg12', 'smg9', 'p9'].includes(def.id)), byId.get('p9')!];
}

export interface GunSlotState {
  def: GunDef;
  currentAmmo: number;
  reserveAmmo: number;
  isReloading: boolean;
  reloadTimer: number;
  reloadProgress: number;
  soundMilestones: { insert: boolean; rack: boolean };
  sprayHeat: number; // 0 to 1
  fireCooldown: number;
}

export interface CampaignGunAmmoState {
  currentAmmo: number;
  reserveAmmo: number;
}

export class GunLoadout {
  readonly casings = new BulletCasings();
  slots: GunSlotState[] = [];
  activeSlotIndex = 0;
  campaignMode = false;
  private campaignGunLevels: Record<string, number> = {};

  /** Unlocked guns that the player has picked up in the world (starts with AR-7 only) */
  unlockedGunIds: Set<string> = new Set(['ar7']);

  // Tactical abilities
  grenadesCurrent = 3;
  readonly maxGrenades = 3;
  grenadeRechargeTimer = 15.0;
  readonly grenadeRechargeMax = 15.0;

  // Rage mode (Berserk)
  ragePercent = 0;
  rageActiveTimer = 0;
  readonly rageDuration = 8.0;
  rageCooldownTimer = 0;
  readonly rageCooldownDuration = 24.0;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.casings.clear();
    this.campaignMode = false;
    this.campaignGunLevels = {};
    const defs = createAllGunDefs();
    this.slots = defs.map((def) => ({
      def,
      currentAmmo: def.magSize,
      reserveAmmo: 0,
      isReloading: false,
      reloadTimer: 0,
      reloadProgress: 0,
      soundMilestones: { insert: false, rack: false },
      sprayHeat: 0,
      fireCooldown: 0,
    }));
    // Survival keeps the AR-7 opening and a P-9 backup with infinite reserve.
    this.unlockedGunIds = new Set(['p9', 'ar7']);
    const pistol = this.slots.find(slot => slot.def.id === 'p9');
    const rifle = this.slots.find(slot => slot.def.id === 'ar7');
    if (pistol) { pistol.currentAmmo = pistol.def.magSize; pistol.reserveAmmo = -1; }
    if (rifle) { rifle.currentAmmo = rifle.def.magSize; rifle.reserveAmmo = rifle.def.magSize * (rifle.def.reserveMagazines ?? 6); }
    this.activeSlotIndex = Math.max(0, this.slots.findIndex(slot => slot.def.id === 'ar7'));
    this.grenadesCurrent = 3;
    this.grenadeRechargeTimer = this.grenadeRechargeMax;
    this.ragePercent = 0;
    this.rageActiveTimer = 0;
    this.rageCooldownTimer = 0;
  }

  /** Configure a mission without refilling ammunition already carried between stages. */
  configureCampaign(
    owned: string[],
    equipped: string,
    levels: Record<string, number>,
    ammoState: Record<string, CampaignGunAmmoState> = {},
    _stage = 1,
    legacyAmmoPacks = 0,
  ): void {
    this.campaignMode = true;
    this.campaignGunLevels = { ...levels };
    for (const def of createCampaignGunDefs()) {
      const slot = this.slots.find(value => value.def.id === def.id);
      if (slot) slot.def = { ...def };
    }
    // Stage gates purchases in the armory, not weapons already purchased.
    // Keep the full owned arsenal available when replaying an earlier chapter.
    const available = this.slots.filter(slot => slot.def.campaignOnly
      && (slot.def.id === 'p9' || owned.includes(slot.def.id)));
    this.unlockedGunIds = new Set(available.map(slot => slot.def.id));
    this.unlockedGunIds.add('p9');
    const packBonus = Object.keys(ammoState).length === 0 ? Math.max(0, legacyAmmoPacks) * 2 : 0;
    for (const slot of available) {
      const level = Math.max(0, Math.min(3, levels[slot.def.id] ?? 0));
      slot.def = { ...slot.def, baseDamage: Math.round(slot.def.baseDamage * (1 + level * .12)) };
      const savedAmmo = ammoState[slot.def.id];
      slot.currentAmmo = savedAmmo
        ? Math.max(0, Math.min(slot.def.magSize, Math.floor(savedAmmo.currentAmmo)))
        : slot.def.magSize;
      slot.reserveAmmo = slot.def.id === 'p9' ? -1 : savedAmmo
        ? Math.max(0, Math.floor(savedAmmo.reserveAmmo))
        : slot.def.magSize * ((slot.def.reserveMagazines ?? 5) + packBonus);
      slot.isReloading = false;
      slot.reloadTimer = 0;
      slot.reloadProgress = 0;
    }
    for (const slot of this.slots.filter(value => !this.unlockedGunIds.has(value.def.id))) slot.reserveAmmo = 0;
    const primary = available.some(slot => slot.def.id === equipped) ? equipped : 'p9';
    this.activeSlotIndex = Math.max(0, this.slots.findIndex(slot => slot.def.id === primary));
    this.grenadesCurrent = 2;
  }

  getCampaignAmmoState(): Record<string, CampaignGunAmmoState> {
    const state: Record<string, CampaignGunAmmoState> = {};
    if (!this.campaignMode) return state;
    for (const slot of this.unlockedSlots) {
      state[slot.def.id] = { currentAmmo: slot.currentAmmo, reserveAmmo: slot.reserveAmmo };
    }
    return state;
  }

  addCampaignAmmo(magazines = 2): void {
    if (!this.campaignMode) return;
    for (const slot of this.unlockedSlots) {
      if (slot.reserveAmmo < 0) continue;
      slot.reserveAmmo = Math.min(slot.def.magSize * 12, slot.reserveAmmo + slot.def.magSize * magazines);
    }
  }

  canAddCampaignAmmoForGun(gunId: string): boolean {
    const slot = this.slots.find(value => value.def.id === gunId);
    return this.campaignMode && !!slot && this.unlockedGunIds.has(gunId)
      && slot.reserveAmmo >= 0 && slot.reserveAmmo < slot.def.magSize * 12;
  }

  addCampaignAmmoForGun(gunId: string, rounds: number): number {
    if (!this.canAddCampaignAmmoForGun(gunId)) return 0;
    const slot = this.slots.find(value => value.def.id === gunId)!;
    const before = slot.reserveAmmo;
    slot.reserveAmmo = Math.min(slot.def.magSize * 12, before + Math.max(0, Math.floor(rounds)));
    return slot.reserveAmmo - before;
  }

  canAddAmmoForGun(gunId: string): boolean {
    const slot = this.slots.find(value => value.def.id === gunId);
    return !!slot && this.unlockedGunIds.has(gunId) && slot.reserveAmmo >= 0
      && slot.reserveAmmo < slot.def.magSize * 12;
  }

  addAmmoForGun(gunId: string, rounds: number): number {
    if (!this.canAddAmmoForGun(gunId)) return 0;
    const slot = this.slots.find(value => value.def.id === gunId)!;
    const before = slot.reserveAmmo;
    slot.reserveAmmo = Math.min(slot.def.magSize * 12, before + Math.max(0, Math.floor(rounds)));
    return slot.reserveAmmo - before;
  }

  collectCampaignGun(gunId: string, audio?: Audio): boolean {
    if (!this.campaignMode || !this.unlockGun(gunId, audio)) return false;
    const slot = this.slots.find(value => value.def.id === gunId);
    if (slot) slot.reserveAmmo = slot.def.magSize * (slot.def.reserveMagazines ?? 5);
    return true;
  }

  collectSurvivalGun(gunId: string, audio?: Audio): boolean {
    if (this.campaignMode) return false;
    const slot = this.slots.find(value => value.def.id === gunId);
    if (!slot) return false;
    if (!this.unlockGun(gunId, audio)) {
      return this.addAmmoForGun(gunId, slot.def.magSize * 2) > 0;
    }
    return true;
  }

  canAddCampaignAmmo(): boolean {
    return this.campaignMode && this.unlockedSlots.some(slot =>
      slot.reserveAmmo >= 0 && slot.reserveAmmo < slot.def.magSize * 12);
  }

  get activeSlot(): GunSlotState {
    const active = this.slots[this.activeSlotIndex];
    if (active && this.unlockedGunIds.has(active.def.id)) {
      return active;
    }
    // Fallback to first unlocked slot
    const firstUnlocked = this.slots.find((s) => this.unlockedGunIds.has(s.def.id));
    return firstUnlocked || this.slots[0];
  }

  get unlockedSlots(): GunSlotState[] {
    const unlocked = this.slots.filter((s) => this.unlockedGunIds.has(s.def.id));
    if (this.campaignMode) return unlocked.sort((a, b) => (a.def.unlockStage ?? 1) - (b.def.unlockStage ?? 1));
    const order = ['p9', 'ar7', 'smg9', 'sg12', 'dmr55', 'bulldog', 'lmg6', 'flamer8', 'rpg4', 'rail_lance'];
    return unlocked.sort((a, b) => order.indexOf(a.def.id) - order.indexOf(b.def.id));
  }

  hasGun(gunId: string): boolean {
    return this.unlockedGunIds.has(gunId);
  }

  getGunDef(gunId: string): GunDef | null {
    return this.slots.find((s) => s.def.id === gunId)?.def || null;
  }

  /**
   * Unlock a weapon when picked up in the world!
   */
  unlockGun(gunId: string, audio?: Audio): boolean {
    if (this.unlockedGunIds.has(gunId)) return false;

    this.unlockedGunIds.add(gunId);
    const targetIdx = this.slots.findIndex((s) => s.def.id === gunId);
    if (targetIdx >= 0) {
      this.activeSlotIndex = targetIdx;
      // Replenish ammo immediately on fresh pickup
      this.slots[targetIdx].currentAmmo = this.slots[targetIdx].def.magSize;
      this.slots[targetIdx].reserveAmmo = gunId === 'p9' ? -1
        : this.slots[targetIdx].def.magSize * (this.slots[targetIdx].def.reserveMagazines ?? 5);
      this.slots[targetIdx].isReloading = false;
    }

    if (audio) {
      audio.reloadRack(targetIdx >= 0 ? this.slots[targetIdx].def.type : 'rifle');
    }
    return true;
  }

  /**
   * Apply upgrade effect matching the gun
   */
  applyUpgradeEffect(upgradeId: string, level: number): void {
    switch (upgradeId) {
      case 'ar7_drum_mag': {
        const ar7 = this.getGunDef('ar7');
        if (ar7) {
          ar7.magSize = 30 + 10 * level;
          const slot = this.slots.find((s) => s.def.id === 'ar7');
          if (slot) slot.currentAmmo = Math.min(ar7.magSize, slot.currentAmmo + 10);
        }
        break;
      }
      case 'ar7_recoil_brake': {
        const ar7 = this.getGunDef('ar7');
        if (ar7) {
          ar7.spreadBase = 0.012 * Math.max(0.2, 1 - 0.25 * level);
          ar7.spreadMax = 0.075 * Math.max(0.25, 1 - 0.25 * level);
        }
        break;
      }
      case 'ar7_heavy_caliber': {
        const ar7 = this.getGunDef('ar7');
        if (ar7) ar7.baseDamage = Math.round(20 * (1 + (this.campaignMode ? (this.campaignGunLevels.ar7 ?? 0) * .12 : 0)) * (1 + 0.25 * level));
        break;
      }
      case 'ar7_rapid_trigger': {
        const ar7 = this.getGunDef('ar7');
        if (ar7) {
          ar7.fireRate = 9.1 * (1 + 0.2 * level);
          ar7.rpm = Math.round(ar7.fireRate * 60);
        }
        break;
      }
      case 'sg12_buckshot_spread': {
        const sg = this.getGunDef('sg12');
        if (sg) sg.pellets = 7 + 3 * level;
        break;
      }
      case 'sg12_mag_tube': {
        const sg = this.getGunDef('sg12');
        if (sg) {
          sg.magSize = 8 + 4 * level;
          const slot = this.slots.find((s) => s.def.id === 'sg12');
          if (slot) slot.currentAmmo = Math.min(sg.magSize, slot.currentAmmo + 4);
        }
        break;
      }
      case 'sg12_choke': {
        const sg = this.getGunDef('sg12');
        if (sg) {
          sg.spreadBase = 0.24 * Math.max(0.25, 1 - 0.25 * level);
          sg.spreadMax = 0.32 * Math.max(0.3, 1 - 0.25 * level);
        }
        break;
      }
      case 'smg9_cyclone': {
        const smg = this.getGunDef('smg9');
        if (smg) {
          smg.fireRate = 13.0 * (1 + 0.3 * level);
          smg.rpm = Math.round(smg.fireRate * 60);
        }
        break;
      }
      case 'smg9_drum_mag': {
        const smg = this.getGunDef('smg9');
        if (smg) {
          smg.magSize = 40 + 20 * level;
          const slot = this.slots.find((s) => s.def.id === 'smg9');
          if (slot) slot.currentAmmo = Math.min(smg.magSize, slot.currentAmmo + 20);
        }
        break;
      }
      case 'smg9_hollow_point': {
        const smg = this.getGunDef('smg9');
        if (smg) smg.baseDamage = Math.round((this.campaignMode ? 15 : 14) *
          (1 + (this.campaignMode ? (this.campaignGunLevels.smg9 ?? 0) * .12 : 0)) * (1 + 0.3 * level));
        break;
      }
    }
  }

  get isRageActive(): boolean {
    return this.rageActiveTimer > 0;
  }

  switchSlot(index: number, audio?: Audio): void {
    if (index < 0 || index >= this.slots.length) return;
    const targetSlot = this.slots[index];
    if (!targetSlot || !this.unlockedGunIds.has(targetSlot.def.id)) return;
    if (index === this.activeSlotIndex) return;

    this.activeSlotIndex = index;
    if (audio) {
      audio.menuSelect();
    }
  }

  nextSlot(audio?: Audio): void {
    const unlocked = this.unlockedSlots;
    if (unlocked.length <= 1) return;
    const curUnlockedIdx = unlocked.indexOf(this.activeSlot);
    const nextUnlockedIdx = (curUnlockedIdx + 1) % unlocked.length;
    const realSlotIdx = this.slots.indexOf(unlocked[nextUnlockedIdx]);
    if (realSlotIdx >= 0) {
      this.switchSlot(realSlotIdx, audio);
    }
  }

  prevSlot(audio?: Audio): void {
    const unlocked = this.unlockedSlots;
    if (unlocked.length <= 1) return;
    const curUnlockedIdx = unlocked.indexOf(this.activeSlot);
    const prevUnlockedIdx = (curUnlockedIdx - 1 + unlocked.length) % unlocked.length;
    const realSlotIdx = this.slots.indexOf(unlocked[prevUnlockedIdx]);
    if (realSlotIdx >= 0) {
      this.switchSlot(realSlotIdx, audio);
    }
  }

  startReload(audio?: Audio): void {
    const slot = this.activeSlot;
    if (slot.isReloading) return;
    if (slot.currentAmmo >= slot.def.magSize) return;
    if (slot.def.id !== 'p9' && slot.reserveAmmo === 0) return;

    slot.isReloading = true;
    slot.reloadTimer = 0;
    slot.reloadProgress = 0;
    slot.soundMilestones = { insert: false, rack: false };

    if (audio) {
      audio.reloadStart(slot.def.type);
    }
  }

  addRageOnKill(): void {
    if (this.isRageActive || this.rageCooldownTimer > 0) return;
    this.ragePercent = Math.min(100, this.ragePercent + 2.5);
  }

  activateRage(audio?: Audio): void {
    if (this.ragePercent < 100 || this.isRageActive || this.rageCooldownTimer > 0) return;

    this.ragePercent = 0;
    this.rageActiveTimer = this.rageDuration;
    this.rageCooldownTimer = this.rageCooldownDuration;
    this.activeSlot.isReloading = false;

    if (audio) {
      audio.rageActivate();
    }
  }

  update(
    dt: number,
    player: Player,
    input: Input,
    bullets: BulletSystem,
    audio: Audio,
    camera: Camera
  ): void {
    this.casings.update(dt);
    // ── 1. Weapon selection inputs (only switches to unlocked weapons) ──
    const requestedSlot = input.weaponSelect;
    if (requestedSlot !== null && requestedSlot >= 0) {
      if (this.campaignMode) {
        const requested = this.unlockedSlots[requestedSlot];
        if (requested) this.switchSlot(this.slots.indexOf(requested), audio);
      } else {
        const requested = this.unlockedSlots[requestedSlot];
        if (requested) this.switchSlot(this.slots.indexOf(requested), audio);
      }
    }
    const wheel = input.wheelDelta;
    if (wheel > 0) this.nextSlot(audio);
    else if (wheel < 0) this.prevSlot(audio);

    // ── 2. Reload input ──
    if (input.reloadPressed) {
      this.startReload(audio);
    }

    // ── 3. Rage input ──
    if (input.ragePressed) {
      this.activateRage(audio);
    }

    // ── 4. Grenade input ──
    if (input.grenadePressed && this.grenadesCurrent > 0) {
      this.throwGrenade(player, input, bullets, audio, camera);
    }

    // ── 5. Tactical cooldowns ──
    if (!this.campaignMode && this.grenadesCurrent < this.maxGrenades) {
      this.grenadeRechargeTimer -= dt;
      if (this.grenadeRechargeTimer <= 0) {
        this.grenadesCurrent++;
        this.grenadeRechargeTimer = this.grenadeRechargeMax;
      }
    } else {
      this.grenadeRechargeTimer = this.grenadeRechargeMax;
    }

    if (this.rageActiveTimer > 0) {
      this.rageActiveTimer = Math.max(0, this.rageActiveTimer - dt);
    }
    if (this.rageCooldownTimer > 0) {
      this.rageCooldownTimer = Math.max(0, this.rageCooldownTimer - dt);
      this.ragePercent = Math.round((1 - this.rageCooldownTimer / this.rageCooldownDuration) * 100);
      if (this.rageCooldownTimer === 0) this.ragePercent = 100;
    }

    // ── 6. Update all gun slot states (reloads & cooling) ──
    for (const slot of this.slots) {
      if (slot.fireCooldown > 0) {
        slot.fireCooldown = Math.max(0, slot.fireCooldown - dt);
      }

      if (slot.isReloading) {
        slot.reloadTimer += dt;
        const reloadDuration = slot.def.reloadDuration / Math.max(.65, player.reloadSpeedMultiplier);
        slot.reloadProgress = Math.min(1, slot.reloadTimer / reloadDuration);

        // Milestone sounds
        if (slot.reloadProgress >= 0.42 && !slot.soundMilestones.insert) {
          slot.soundMilestones.insert = true;
          audio.reloadInsert(slot.def.type);
        }
        if (slot.reloadProgress >= 0.88 && !slot.soundMilestones.rack) {
          slot.soundMilestones.rack = true;
          audio.reloadRack(slot.def.type);
        }

        // Finish reload
        if (slot.reloadTimer >= reloadDuration) {
          slot.isReloading = false;
          const missing = slot.def.magSize - slot.currentAmmo;
          const loaded = slot.def.id !== 'p9' ? Math.min(missing, slot.reserveAmmo) : missing;
          slot.currentAmmo += loaded;
          if (slot.def.id !== 'p9') slot.reserveAmmo -= loaded;
          slot.reloadProgress = 0;
        }
      }

      // Cool down spray heat when not firing
      if (!input.isFiring || slot !== this.activeSlot) {
        slot.sprayHeat = Math.max(0, slot.sprayHeat - dt * 3.4);
      }
    }

    // ── 7. Full-Auto Continuous Spray ("sấy được như AK") ──
    const active = this.activeSlot;
    const wantsFire = input.isFiring;

    if (wantsFire) {
      if (active.isReloading) {
        if (active.fireCooldown <= 0) {
          audio.emptyClick();
          active.fireCooldown = 0.22;
        }
      } else if (active.currentAmmo <= 0) {
        if (active.fireCooldown <= 0) {
          audio.emptyClick();
          active.fireCooldown = 0.22;
        }
        this.startReload(audio);
      } else if (active.fireCooldown <= 0) {
        this.fireActiveGun(player, bullets, audio, camera);
      }
    }
  }

  private fireActiveGun(
    player: Player,
    bullets: BulletSystem,
    audio: Audio,
    camera: Camera
  ): void {
    const slot = this.activeSlot;
    const def = slot.def;

    const rageFireRateMult = this.isRageActive ? 1.45 : 1.0;
    const effectiveFireRate = def.fireRate * rageFireRateMult * (player.fireRate / 3.0);
    const damageMult = player.bulletDamage / 15.0;
    const effectiveDamage = Math.round(def.baseDamage * damageMult * (this.isRageActive ? 1.3 : 1.0));

    // Rage never creates ammunition. Only the P-9 has an unlimited reserve.
    slot.currentAmmo--;

    slot.sprayHeat = Math.min(1.0, slot.sprayHeat + (def.type === 'smg' ? 0.11 : 0.15));
    const spreadRange = def.spreadBase + (def.spreadMax - def.spreadBase) * Math.pow(slot.sprayHeat, 1.35);

    if (def.type === 'shotgun') {
      const pellets = def.pellets || 7;
      const fragUpgrade = player.upgrades.get('sg12_frag_rounds') || 0;
      const expRadius = Math.max(fragUpgrade > 0 ? 30 + fragUpgrade * 15 : 0, def.extraBlastRadius ?? 0);

      for (let i = 0; i < pellets; i++) {
        const pelletAngle =
          player.aimAngle + (i / (pellets - 1) - 0.5) * spreadRange + (Math.random() - 0.5) * 0.08;
        bullets.fire(
          player.x,
          player.y,
          pelletAngle,
          effectiveDamage,
          def.bulletSpeed * (0.92 + Math.random() * 0.16),
          3.5,
          def.bulletColor,
          0,
          expRadius,
          player.burnDamage + (def.extraBurnDamage ?? 0),
          0,
          'shotgun'
        );
      }
      audio.shotgun();
      camera.shake(2.8, 0.08);
    } else {
      const bulletAngle = player.aimAngle + (Math.random() - 0.5) * 2 * spreadRange;
      bullets.fire(
        player.x,
        player.y,
        bulletAngle,
        effectiveDamage,
        def.bulletSpeed,
        def.type === 'smg' ? 3.5 : 4.0,
        def.bulletColor,
        player.pierceCount + (def.extraPierce ?? 0),
        Math.max(player.explosiveRadius, def.extraBlastRadius ?? 0),
        player.burnDamage + (def.extraBurnDamage ?? 0),
        player.slowMultiplier < 1 ? player.slowMultiplier : 0
      );
      audio.shoot(def.soundType ?? def.type);
      camera.shake(1.0 + slot.sprayHeat * 1.6, 0.05);
    }

    player.recoilX -= Math.cos(player.aimAngle) * def.recoilImpulse;
    player.recoilY -= Math.sin(player.aimAngle) * def.recoilImpulse;
    player.muzzleFlashTimer = def.type === 'smg' ? 0.04 : 0.06;
    this.casings.spawn(player.x, player.y, player.aimAngle, heldGunShape(def));
    slot.fireCooldown = 1 / effectiveFireRate;

    if (slot.currentAmmo <= 0) {
      this.startReload(audio);
    }
  }

  private throwGrenade(
    player: Player,
    input: Input,
    bullets: BulletSystem,
    audio: Audio,
    camera: Camera
  ): void {
    this.grenadesCurrent--;
    const [mouseWorldX, mouseWorldY] = camera.windowScreenToWorld(input.mouseX, input.mouseY);
    const angle = Math.atan2(mouseWorldY - player.y, mouseWorldX - player.x);

    bullets.fire(
      player.x,
      player.y,
      angle,
      85,
      490,
      8,
      '#ff6600',
      0,
      120,
      0,
      0,
      'grenade'
    );

    audio.grenadeLaunch();
    camera.shake(1.8, 0.08);
  }

  // The left rail and its click targets share this layout on every viewport.
  private weaponHudLayout(canvasW: number, canvasH: number, campaignGear = false) {
    const x = 10;
    const width = Math.min(canvasW - 20, canvasW < 760 ? 176 : 218);
    const infoHeight = (canvasH < 650 ? 94 : 108) + (campaignGear ? 24 : 0);
    const infoY = canvasH - infoHeight - 10;
    const listTop = canvasH < 650 ? 155 : 208; // Below the health/equipment HUD.
    const rowHeight = canvasH < 650 ? 29 : 34;
    const count = this.unlockedSlots.length;
    const visibleCount = Math.min(count, Math.max(0, Math.floor((infoY - listTop - 8) / rowHeight)));
    const activeIndex = this.unlockedSlots.indexOf(this.activeSlot);
    const first = Math.max(0, Math.min(count - visibleCount, activeIndex - Math.floor(visibleCount / 2)));
    return { x, width, infoY, infoHeight, listTop, rowHeight, visibleCount, first };
  }

  drawHUD(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number, player: Player,
    campaignGear?: { armorLevel: number; medKits: number; flashlightLevel: number }): void {
    const { x, width, infoY, infoHeight, listTop, rowHeight, visibleCount, first } = this.weaponHudLayout(canvasW, canvasH, !!campaignGear);
    const unlocked = this.unlockedSlots;
    const active = this.activeSlot;
    const ammoLow = active.currentAmmo <= Math.ceil(active.def.magSize * .2);
    const accent = active.isReloading ? '#d9ae68' : ammoLow ? '#da7469' : '#a9c5c3';
    ctx.save();
    ctx.lineWidth = 1;
    if (visibleCount > 0) {
      const listHeight = visibleCount * rowHeight + 22;
      ctx.fillStyle = 'rgba(10, 17, 19, .86)'; ctx.strokeStyle = 'rgba(119, 144, 145, .62)';
      this.roundRect(ctx, x, listTop, width, listHeight, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#aabbb9'; ctx.font = '700 9px Segoe UI, Arial';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('VŨ KHÍ  ·  CUỘN / PHÍM SỐ', x + 9, listTop + 11, width - 58);
      ctx.textAlign = 'right'; ctx.fillText(`${unlocked.indexOf(active) + 1}/${unlocked.length}`, x + width - 9, listTop + 11);
      for (let visible = 0; visible < visibleCount; visible++) {
        const slot = unlocked[first + visible];
        const rowY = listTop + 22 + visible * rowHeight;
        const selected = slot === active;
        ctx.fillStyle = selected ? 'rgba(119, 91, 48, .82)' : 'rgba(53, 66, 69, .55)';
        ctx.fillRect(x + 4, rowY + 1, width - 8, rowHeight - 2);
        if (selected) { ctx.fillStyle = '#dfbb7e'; ctx.fillRect(x + 4, rowY + 1, 3, rowHeight - 2); }
        ctx.fillStyle = selected ? '#fff0d5' : '#aebcba';
        ctx.font = '800 11px Segoe UI, Arial'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        const weaponIndex = first + visible;
        ctx.fillText(weaponIndex === 9 ? '0' : String(weaponIndex + 1), x + 12, rowY + rowHeight / 2);
        const compactRow = width < 200;
        const ammoWidth = compactRow ? 41 : 46;
        const nameX = x + (compactRow ? 78 : 91);
        const nameWidth = x + width - 9 - ammoWidth - nameX;
        drawGunArt(ctx, x + 29, rowY + 3, compactRow ? 42 : 54, rowHeight - 6, slot.def.id);
        ctx.fillStyle = selected ? '#f4eee0' : '#c3d0ce';
        ctx.font = `700 ${compactRow ? 9 : 10}px Segoe UI, Arial`;
        ctx.fillText(slot.def.shortName, nameX, rowY + rowHeight / 2, nameWidth);

        const lowAmmo = slot.currentAmmo <= Math.ceil(slot.def.magSize * .2);
        ctx.fillStyle = slot.isReloading ? '#d9ae68'
          : lowAmmo ? '#da7469' : selected ? '#f0dfbd' : '#aebcba';
        ctx.font = `800 ${compactRow ? 8 : 9}px Segoe UI, Arial`;
        ctx.textAlign = 'right';
        const reserve = slot.reserveAmmo < 0 ? '∞' : String(slot.reserveAmmo);
        ctx.fillText(`${slot.currentAmmo}/${reserve}`, x + width - 9, rowY + rowHeight / 2, ammoWidth);
        ctx.textAlign = 'left';
      }
      if (first > 0) { ctx.fillStyle = '#dfbb7e'; ctx.fillRect(x + width - 3, listTop + 23, 2, 8); }
      if (first + visibleCount < unlocked.length) { ctx.fillStyle = '#dfbb7e'; ctx.fillRect(x + width - 3, listTop + listHeight - 10, 2, 8); }
    }

    ctx.fillStyle = 'rgba(10, 17, 19, .94)'; ctx.strokeStyle = 'rgba(136, 157, 158, .72)';
    this.roundRect(ctx, x, infoY, width, infoHeight, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = accent; ctx.fillRect(x + 1, infoY + 7, 3, 39);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f0eee7'; ctx.font = '800 13px Segoe UI, Arial';
    ctx.fillText(active.def.shortName, x + 11, infoY + 15, width - 106);
    ctx.textAlign = 'right'; ctx.fillStyle = accent; ctx.font = '800 20px Segoe UI, Arial';
    ctx.fillText(String(active.currentAmmo), x + width - 32, infoY + 17);
    ctx.fillStyle = '#b6c3c1'; ctx.font = '700 10px Segoe UI, Arial';
    ctx.fillText('/' + active.def.magSize, x + width - 9, infoY + 19);
    ctx.textAlign = 'left'; ctx.font = '600 9px Segoe UI, Arial';
    ctx.fillStyle = active.isReloading ? '#e1ba78' : '#a4b7b6';
    ctx.fillText(active.isReloading ? 'THAY ĐẠN' : 'R · THAY ĐẠN', x + 11, infoY + 36);
    ctx.textAlign = 'right'; ctx.fillStyle = '#b6c3c1';
    ctx.fillText(`DỰ TRỮ ${active.reserveAmmo < 0 ? '∞' : active.reserveAmmo}`, x + width - 10, infoY + 36);
    if (active.isReloading) {
      ctx.fillStyle = '#324045'; ctx.fillRect(x + 9, infoY + 47, width - 18, 3);
      ctx.fillStyle = '#d9ae68'; ctx.fillRect(x + 9, infoY + 47, (width - 18) * active.reloadProgress, 3);
    } else { ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(x + 9, infoY + 49, width - 18, 1); }
    const dashReady = player.dashCooldown <= 0;
    ctx.textAlign = 'left'; ctx.font = '700 10px Segoe UI, Arial';
    ctx.fillStyle = '#dfc289'; ctx.fillText(`G  LỰU  ${this.grenadesCurrent}/${this.maxGrenades}`, x + 11, infoY + 65);
    ctx.fillStyle = dashReady ? '#8ec3c7' : '#9aa7a8';
    ctx.fillText(dashReady ? 'SHIFT  LƯỚT SẴN' : `SHIFT  LƯỚT ${player.dashCooldown.toFixed(1)}s`, x + 11, infoY + 82);
    if (infoHeight > 100) {
      ctx.fillStyle = this.ragePercent >= 100 || this.isRageActive ? '#d6a078' : '#aab7b7';
      const rage = this.isRageActive ? `NỘ ${this.rageActiveTimer.toFixed(1)}s`
        : this.rageCooldownTimer > 0 ? `NỘ HỒI ${this.rageCooldownTimer.toFixed(1)}s`
        : this.ragePercent >= 100 ? 'NỘ SẴN' : `NỘ ${Math.floor(this.ragePercent)}%`;
      ctx.fillText(`F  ${rage}`, x + 11, infoY + 99);
    } else {
      ctx.textAlign = 'right'; ctx.fillStyle = '#b7a092';
      ctx.fillText(`F NỘ ${Math.floor(this.ragePercent)}%`, x + width - 9, infoY + 65, width * .48);
    }
    if (campaignGear) {
      ctx.textAlign = 'left'; ctx.font = '700 9px Segoe UI, Arial';
      ctx.fillStyle = '#a9d9d2';
      ctx.fillText(`PIN ${campaignGear.flashlightLevel}/3`, x + 11, infoY + 114);
      ctx.fillStyle = campaignGear.armorLevel ? '#b9d78d' : '#97a29f';
      ctx.fillText(`GIÁP ${campaignGear.armorLevel}/3`, x + 83, infoY + 114);
      ctx.fillStyle = campaignGear.medKits > 0 ? '#8de6a3' : '#97a29f';
      ctx.fillText(`TÚI ${campaignGear.medKits}`, x + width - 47, infoY + 114, 39);
    }
    ctx.restore();
  }

  handleClick(clickX: number, clickY: number, canvasW: number, canvasH: number, audio?: Audio): boolean {
    const { x, width, listTop, rowHeight, visibleCount, first } = this.weaponHudLayout(canvasW, canvasH);
    if (clickX < x || clickX > x + width) return false;
    for (let visible = 0; visible < visibleCount; visible++) {
      const rowY = listTop + 22 + visible * rowHeight;
      if (clickY < rowY || clickY >= rowY + rowHeight) continue;
      const slot = this.unlockedSlots[first + visible];
      if (slot) this.switchSlot(this.slots.indexOf(slot), audio);
      return true;
    }
    return false;
  }

  /**
   * In-world circular reload ring floating above player
   */
  drawInWorld(ctx: CanvasRenderingContext2D, camera: Camera, player: Player): void {
    const active = this.activeSlot;
    if (!active.isReloading) return;

    const [sx, sy] = camera.worldToScreen(player.x, player.y - 28);
    const radius = 16;

    ctx.save();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#a3e635';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(
      sx,
      sy,
      radius,
      -Math.PI / 2,
      -Math.PI / 2 + active.reloadProgress * Math.PI * 2
    );
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 10px 'Segoe UI', Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('R', sx, sy);

    ctx.restore();
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
