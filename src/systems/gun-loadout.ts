// ─── Gun Loadout System: Full-Auto Spray, Tactical Reload, Gun Pickups & HUD ───

import { Player } from '../entities/player';
import { BulletSystem } from '../entities/bullets';
import { Audio } from '../core/audio';
import { Camera } from '../core/camera';
import { Input } from '../core/input';

export interface GunDef {
  id: string;
  name: string;        // '1·AR-7', '2·SG-12', '3·SMG-9'
  shortName: string;   // 'AR-7', 'SG-12', 'SMG-9'
  slotKey: string;     // '1', '2', '3'
  type: 'rifle' | 'shotgun' | 'smg';
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

export interface GunSlotState {
  def: GunDef;
  currentAmmo: number;
  isReloading: boolean;
  reloadTimer: number;
  reloadProgress: number;
  soundMilestones: { insert: boolean; rack: boolean };
  sprayHeat: number; // 0 to 1
  fireCooldown: number;
}

export class GunLoadout {
  slots: GunSlotState[] = [];
  activeSlotIndex = 0;

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

  constructor() {
    this.reset();
  }

  reset(): void {
    const defs = createDefaultGunDefs();
    this.slots = defs.map((def) => ({
      def,
      currentAmmo: def.magSize,
      isReloading: false,
      reloadTimer: 0,
      reloadProgress: 0,
      soundMilestones: { insert: false, rack: false },
      sprayHeat: 0,
      fireCooldown: 0,
    }));
    // Player starts with only AR-7 unlocked! Other guns must be picked up in the world!
    this.unlockedGunIds = new Set(['ar7']);
    this.activeSlotIndex = 0;
    this.grenadesCurrent = 3;
    this.grenadeRechargeTimer = this.grenadeRechargeMax;
    this.ragePercent = 0;
    this.rageActiveTimer = 0;
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
    return this.slots.filter((s) => this.unlockedGunIds.has(s.def.id));
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
      this.slots[targetIdx].isReloading = false;
    }

    if (audio) {
      audio.reloadRack();
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
        if (ar7) ar7.baseDamage = Math.round(20 * (1 + 0.25 * level));
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
        if (smg) smg.baseDamage = Math.round(14 * (1 + 0.3 * level));
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

    slot.isReloading = true;
    slot.reloadTimer = 0;
    slot.reloadProgress = 0;
    slot.soundMilestones = { insert: false, rack: false };

    if (audio) {
      audio.reloadStart();
    }
  }

  addRageOnKill(): void {
    if (this.isRageActive) return;
    this.ragePercent = Math.min(100, this.ragePercent + 2.5);
  }

  activateRage(audio?: Audio): void {
    if (this.ragePercent < 100 || this.isRageActive) return;

    this.ragePercent = 0;
    this.rageActiveTimer = this.rageDuration;
    this.activeSlot.currentAmmo = this.activeSlot.def.magSize;
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
    // ── 1. Weapon selection inputs (only switches to unlocked weapons) ──
    const requestedSlot = input.weaponSelect;
    if (requestedSlot !== null && requestedSlot >= 0 && requestedSlot < this.slots.length) {
      if (this.unlockedGunIds.has(this.slots[requestedSlot].def.id)) {
        this.switchSlot(requestedSlot, audio);
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
    if (this.grenadesCurrent < this.maxGrenades) {
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

    // ── 6. Update all gun slot states (reloads & cooling) ──
    for (const slot of this.slots) {
      if (slot.fireCooldown > 0) {
        slot.fireCooldown = Math.max(0, slot.fireCooldown - dt);
      }

      if (slot.isReloading) {
        slot.reloadTimer += dt;
        slot.reloadProgress = Math.min(1, slot.reloadTimer / slot.def.reloadDuration);

        // Milestone sounds
        if (slot.reloadProgress >= 0.42 && !slot.soundMilestones.insert) {
          slot.soundMilestones.insert = true;
          audio.reloadInsert();
        }
        if (slot.reloadProgress >= 0.88 && !slot.soundMilestones.rack) {
          slot.soundMilestones.rack = true;
          audio.reloadRack();
        }

        // Finish reload
        if (slot.reloadTimer >= slot.def.reloadDuration) {
          slot.isReloading = false;
          slot.currentAmmo = slot.def.magSize;
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
        audio.emptyClick();
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

    if (!this.isRageActive) {
      slot.currentAmmo--;
    }

    slot.sprayHeat = Math.min(1.0, slot.sprayHeat + (def.type === 'smg' ? 0.11 : 0.15));
    const spreadRange = def.spreadBase + (def.spreadMax - def.spreadBase) * Math.pow(slot.sprayHeat, 1.35);

    if (def.type === 'shotgun') {
      const pellets = def.pellets || 7;
      const fragUpgrade = player.upgrades.get('sg12_frag_rounds') || 0;
      const expRadius = fragUpgrade > 0 ? 30 + fragUpgrade * 15 : 0;

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
          player.burnDamage,
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
        player.pierceCount,
        player.explosiveRadius,
        player.burnDamage,
        player.slowMultiplier < 1 ? player.slowMultiplier : 0
      );
      audio.shoot();
      camera.shake(1.0 + slot.sprayHeat * 1.6, 0.05);
    }

    player.recoilX -= Math.cos(player.aimAngle) * def.recoilImpulse;
    player.recoilY -= Math.sin(player.aimAngle) * def.recoilImpulse;
    player.muzzleFlashTimer = def.type === 'smg' ? 0.04 : 0.06;
    slot.fireCooldown = 1 / effectiveFireRate;

    if (slot.currentAmmo <= 0 && !this.isRageActive) {
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

  // ─── Tactical HUD Card Rendering (Matches User Screenshot) ───

  drawHUD(
    ctx: CanvasRenderingContext2D,
    canvasW: number,
    canvasH: number,
    player: Player
  ): void {
    const cardW = 390;
    const cardH = 118;
    const cardX = (canvasW - cardW) / 2;
    const cardY = canvasH - cardH - 12;

    ctx.save();

    // ── 1. Main Card Container ──
    ctx.fillStyle = 'rgba(12, 19, 14, 0.94)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, cardX, cardY, cardW, cardH, 14);
    ctx.fill();
    ctx.stroke();

    // ── 2. Top Weapon Switcher Pills (Only shows UNLOCKED weapons) ──
    const unlocked = this.unlockedSlots;
    const pillH = 26;
    const pillGap = 8;
    const pillW = Math.max(80, Math.min(94, (cardW - 50) / Math.max(1, unlocked.length) - pillGap));
    const totalPillsW = unlocked.length * pillW + (unlocked.length - 1) * pillGap;
    const pillsStartX = cardX + (cardW - totalPillsW) / 2;
    const pillY = cardY + 12;

    for (let i = 0; i < unlocked.length; i++) {
      const slot = unlocked[i];
      const px = pillsStartX + i * (pillW + pillGap);
      const isActive = slot === this.activeSlot;

      ctx.save();
      if (isActive) {
        ctx.fillStyle = '#a3e635';
        this.roundRect(ctx, px, pillY, pillW, pillH, 13);
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.font = `bold 13px 'Segoe UI', Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(slot.def.name, px + pillW / 2, pillY + pillH / 2);
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        this.roundRect(ctx, px, pillY, pillW, pillH, 13);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#94a3b8';
        ctx.font = `bold 12px 'Segoe UI', Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(slot.def.name, px + pillW / 2, pillY + pillH / 2);
      }
      ctx.restore();
    }

    // ── 3. Central Ammo Display (or Reloading Progress) ──
    const active = this.activeSlot;
    const ammoY = cardY + 54;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (active.isReloading) {
      const remainingSec = Math.max(0, active.def.reloadDuration - active.reloadTimer);
      ctx.fillStyle = '#fbbf24';
      ctx.font = `bold 15px 'Segoe UI', Arial, sans-serif`;
      ctx.fillText(`ĐANG THAY ĐẠN... ${remainingSec.toFixed(1)}s`, cardX + cardW / 2, ammoY - 4);

      const barW = 160;
      const barH = 5;
      const barX = cardX + (cardW - barW) / 2;
      const barY = ammoY + 10;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      this.roundRect(ctx, barX, barY, barW, barH, 3);
      ctx.fill();
      ctx.fillStyle = '#a3e635';
      this.roundRect(ctx, barX, barY, barW * active.reloadProgress, barH, 3);
      ctx.fill();
    } else {
      const current = active.currentAmmo;
      const max = active.def.magSize;
      const isLow = current <= Math.ceil(max * 0.2);

      ctx.font = `bold 28px 'Segoe UI', Arial, sans-serif`;
      const curText = this.isRageActive ? '∞' : `${current}`;
      const curW = ctx.measureText(curText).width;
      ctx.font = `bold 16px 'Segoe UI', Arial, sans-serif`;
      const maxText = `/${max}`;
      const maxW = ctx.measureText(maxText).width;
      const startX = cardX + (cardW - (curW + maxW)) / 2;

      ctx.fillStyle = isLow ? '#ef4444' : '#ffffff';
      ctx.font = `bold 28px 'Segoe UI', Arial, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(curText, startX, ammoY);

      ctx.fillStyle = '#94a3b8';
      ctx.font = `bold 16px 'Segoe UI', Arial, sans-serif`;
      ctx.fillText(maxText, startX + curW, ammoY + 3);
    }
    ctx.restore();

    // ── 4. Thin Horizontal Divider Line ──
    const divY = cardY + 74;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fillRect(cardX + 24, divY, cardW - 48, 1);

    // ── 5. Weapon Stats Subline ──
    const damageMult = player.bulletDamage / 15.0;
    const effDmg = Math.round(active.def.baseDamage * damageMult * (this.isRageActive ? 1.3 : 1.0));
    const pwrLevel = Math.max(0, Math.round((damageMult - 1) * 20));
    const statText = `PWR ${pwrLevel} · ${effDmg} DMG · ${active.def.rpm} RPM`;

    ctx.save();
    ctx.fillStyle = '#94a3b8';
    ctx.font = `11px 'Segoe UI', Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(statText, cardX + cardW / 2, cardY + 86);
    ctx.restore();

    // ── 6. Bottom Tactical Row ──
    const botY = cardY + 103;

    const grenadeRechargeSec = Math.ceil(this.grenadeRechargeTimer);
    const grenadeExtra =
      this.grenadesCurrent < this.maxGrenades
        ? ` (+1 sau ${grenadeRechargeSec}s)`
        : '';
    const grenadeStr = `LỰU ĐẠN ${this.grenadesCurrent}/${this.maxGrenades}${grenadeExtra}`;

    const isDashReady = player.dashCooldown <= 0;
    const dashStr = isDashReady
      ? 'XUNG KÍCH SẴN SÀNG'
      : `XUNG KÍCH (${player.dashCooldown.toFixed(1)}s)`;

    let rageStr = `NỘ ${Math.floor(this.ragePercent)}%`;
    let rageColor = '#94a3b8';
    if (this.isRageActive) {
      rageStr = `CUỒNG NỘ (${this.rageActiveTimer.toFixed(1)}s)`;
      rageColor = '#ef4444';
    } else if (this.ragePercent >= 100) {
      rageStr = `NỘ 100% (NHẤN F)`;
      rageColor = '#facc15';
    }

    ctx.save();
    ctx.font = `bold 10.5px 'Segoe UI', Arial, sans-serif`;
    ctx.textBaseline = 'middle';

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(grenadeStr, cardX + 16, botY);

    ctx.textAlign = 'center';
    ctx.fillStyle = isDashReady ? '#4ade80' : '#94a3b8';
    ctx.fillText(dashStr, cardX + cardW / 2 + 18, botY);

    ctx.textAlign = 'right';
    ctx.fillStyle = rageColor;
    ctx.fillText(rageStr, cardX + cardW - 16, botY);

    ctx.restore();

    ctx.restore();
  }

  /**
   * Handle mouse/touch clicks on weapon pills to switch guns directly
   */
  handleClick(
    clickX: number,
    clickY: number,
    canvasW: number,
    canvasH: number,
    audio?: Audio
  ): boolean {
    const cardW = 390;
    const cardH = 118;
    const cardX = (canvasW - cardW) / 2;
    const cardY = canvasH - cardH - 12;

    const unlocked = this.unlockedSlots;
    const pillH = 26;
    const pillGap = 8;
    const pillW = Math.max(80, Math.min(94, (cardW - 50) / Math.max(1, unlocked.length) - pillGap));
    const totalPillsW = unlocked.length * pillW + (unlocked.length - 1) * pillGap;
    const pillsStartX = cardX + (cardW - totalPillsW) / 2;
    const pillY = cardY + 12;

    for (let i = 0; i < unlocked.length; i++) {
      const px = pillsStartX + i * (pillW + pillGap);
      if (
        clickX >= px &&
        clickX <= px + pillW &&
        clickY >= pillY &&
        clickY <= pillY + pillH
      ) {
        const realIdx = this.slots.indexOf(unlocked[i]);
        if (realIdx >= 0) {
          this.switchSlot(realIdx, audio);
        }
        return true;
      }
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
