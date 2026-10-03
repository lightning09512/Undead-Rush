// ─── Player Entity ───

import { PLAYER_DEFAULTS, MAP_CONFIG, xpForLevel } from '../data/items';
import { UPGRADES, MAX_WEAPON_SLOTS, MAX_PASSIVE_SLOTS } from '../data/upgrades';
import type { UpgradeDef } from '../data/upgrades';
import { Camera } from '../core/camera';
import { EntityRenderer } from '../graphics/entity-renderer';
import type { GunLoadout } from '../systems/gun-loadout';

export interface DamageResult {
  damaged: boolean;
  dead: boolean;
  actualDamage: number;
}

export class Player {
  loadout?: GunLoadout;
  x: number;
  y: number;
  size: number;
  color: string;

  recoilX = 0;
  recoilY = 0;
  muzzleFlashTimer = 0;

  // Stats (current, after upgrades)
  maxHp: number;
  hp: number;
  moveSpeed: number;
  bulletDamage: number;
  bulletSpeed: number;
  bulletSize: number;
  bulletColor: string;
  fireRate: number;
  fireRange: number;
  pickupRadius: number;
  invulnDuration: number;

  // Shooting
  fireCooldown = 0;
  aimAngle = 0;

  // Animation & Motion (Monster Breakout physics)
  vx = 0;
  vy = 0;
  moveAngle = 0;
  walkDist = 0;
  animTimer = 0;
  isMoving = false;
  facingLeft = false;

  // Damage
  invulnTimer = 0;
  flashTimer = 0;

  // XP / Leveling
  xp = 0;
  level = 1;
  xpToNext: number;

  // Kills
  kills = 0;

  // Upgrades acquired: upgradeId -> level
  upgrades: Map<string, number> = new Map();

  // Active buffs
  buffs: Map<string, { duration: number; value: number }> = new Map();

  // Armor
  damageReduction = 1.0;

  // Weapon effects
  pierceCount = 0;
  explosiveRadius = 0;
  burnDamage = 0;
  slowMultiplier = 1.0;
  lifestealAmount = 0;

  // Active skills
  dashCooldown = 0;
  dashMaxCooldown = 3.0;
  dashDuration = 0;
  dashSpeed = 600;
  dashDirection = 0;

  grenadeCooldown = 0;
  grenadeMaxCooldown = 8.0;

  constructor() {
    this.x = MAP_CONFIG.width / 2;
    this.y = MAP_CONFIG.height / 2;
    this.size = PLAYER_DEFAULTS.size;
    this.color = PLAYER_DEFAULTS.color;
    this.maxHp = PLAYER_DEFAULTS.maxHp;
    this.hp = this.maxHp;
    this.moveSpeed = PLAYER_DEFAULTS.moveSpeed;
    this.bulletDamage = PLAYER_DEFAULTS.bulletDamage;
    this.bulletSpeed = PLAYER_DEFAULTS.bulletSpeed;
    this.bulletSize = PLAYER_DEFAULTS.bulletSize;
    this.bulletColor = PLAYER_DEFAULTS.bulletColor;
    this.fireRate = PLAYER_DEFAULTS.fireRate;
    this.fireRange = PLAYER_DEFAULTS.fireRange;
    this.pickupRadius = PLAYER_DEFAULTS.pickupRadius;
    this.invulnDuration = PLAYER_DEFAULTS.invulnDuration;
    this.xpToNext = xpForLevel(1);
  }

  reset(): void {
    this.x = MAP_CONFIG.width / 2;
    this.y = MAP_CONFIG.height / 2;
    this.maxHp = PLAYER_DEFAULTS.maxHp;
    this.hp = this.maxHp;
    this.moveSpeed = PLAYER_DEFAULTS.moveSpeed;
    this.bulletDamage = PLAYER_DEFAULTS.bulletDamage;
    this.bulletSpeed = PLAYER_DEFAULTS.bulletSpeed;
    this.bulletSize = PLAYER_DEFAULTS.bulletSize;
    this.bulletColor = PLAYER_DEFAULTS.bulletColor;
    this.fireRate = PLAYER_DEFAULTS.fireRate;
    this.fireRange = PLAYER_DEFAULTS.fireRange;
    this.pickupRadius = PLAYER_DEFAULTS.pickupRadius;
    this.invulnDuration = PLAYER_DEFAULTS.invulnDuration;
    this.xp = 0;
    this.level = 1;
    this.xpToNext = xpForLevel(1);
    this.kills = 0;
    this.upgrades.clear();
    this.buffs.clear();
    this.fireCooldown = 0;
    this.invulnTimer = 0;
    this.flashTimer = 0;
    this.damageReduction = 1.0;
    this.pierceCount = 0;
    this.explosiveRadius = 0;
    this.burnDamage = 0;
    this.slowMultiplier = 1.0;
    this.lifestealAmount = 0;
    this.dashCooldown = 0;
    this.dashDuration = 0;
    this.dashDirection = 0;
    this.grenadeCooldown = 0;
    this.vx = 0;
    this.vy = 0;
    this.moveAngle = 0;
    this.walkDist = 0;
    this.animTimer = 0;
    this.isMoving = false;
    this.facingLeft = false;
    this.recoilX = 0;
    this.recoilY = 0;
    this.muzzleFlashTimer = 0;
  }

  applyUpgrade(upgradeId: string): void {
    const current = this.upgrades.get(upgradeId) || 0;
    this.upgrades.set(upgradeId, current + 1);
    this.recalcStats();
    if (this.loadout) {
      this.loadout.applyUpgradeEffect(upgradeId, current + 1);
    }
  }

  countWeaponSlotsUsed(): number {
    let n = 0;
    for (const [id, level] of this.upgrades) {
      if (level <= 0) continue;
      const def = UPGRADES.find((u) => u.id === id);
      if (def?.category === 'weapon') n++;
    }
    return n;
  }

  countPassiveSlotsUsed(): number {
    let n = 0;
    for (const [id, level] of this.upgrades) {
      if (level <= 0) continue;
      const def = UPGRADES.find((u) => u.id === id);
      if (def && (def.category === 'stat' || def.category === 'effect')) n++;
    }
    return n;
  }

  /** Can pick this upgrade on level-up (respects owned weapons and slots). */
  canPickUpgrade(def: UpgradeDef): boolean {
    // If upgrade requires a specific gun, only offer it if player possesses that gun!
    if (def.gunReq && (!this.loadout || !this.loadout.hasGun(def.gunReq))) {
      return false;
    }

    const current = this.upgrades.get(def.id) || 0;
    if (current >= def.maxLevel) return false;
    if (current > 0) return true;

    if (def.category === 'weapon') {
      return this.countWeaponSlotsUsed() < MAX_WEAPON_SLOTS;
    }
    if (def.category === 'stat' || def.category === 'effect') {
      return this.countPassiveSlotsUsed() < MAX_PASSIVE_SLOTS;
    }
    return false;
  }

  recalcStats(): void {
    // Start from defaults
    let damageMult = 1;
    let fireRateMult = 1;
    let speedMult = 1;
    let radiusMult = 1;

    this.damageReduction = 1.0;
    this.pierceCount = 0;
    this.explosiveRadius = 0;
    this.burnDamage = 0;
    this.slowMultiplier = 1.0;
    this.lifestealAmount = 0;
    this.maxHp = PLAYER_DEFAULTS.maxHp;

    for (const [id, level] of this.upgrades) {
      const def = UPGRADES.find(u => u.id === id);
      if (!def) continue;
      const val = def.values[level - 1];

      switch (id) {
        case 'damage': damageMult = val; break;
        case 'fire_rate': fireRateMult = val; break;
        case 'max_hp': this.maxHp = val; break;
        case 'move_speed': speedMult = val; break;
        case 'pickup_radius': radiusMult = val; break;
        case 'armor': this.damageReduction = val; break;
        case 'piercing': this.pierceCount = val; break;
        case 'explosive': this.explosiveRadius = val; break;
        case 'burning': this.burnDamage = val; break;
        case 'slowing': this.slowMultiplier = val; break;
        case 'lifesteal': this.lifestealAmount = val; break;
      }
    }

    this.bulletDamage = Math.round(PLAYER_DEFAULTS.bulletDamage * damageMult);
    this.fireRate = PLAYER_DEFAULTS.fireRate * fireRateMult;
    this.moveSpeed = PLAYER_DEFAULTS.moveSpeed * speedMult;
    this.pickupRadius = PLAYER_DEFAULTS.pickupRadius * radiusMult;

    // Cap HP at max when upgrading
    if (this.hp > this.maxHp) this.hp = this.maxHp;
  }

  move(dirX: number, dirY: number, dt: number): void {
    let targetSpeed = this.moveSpeed;
    const speedBuff = this.buffs.get('speed_boost');
    if (speedBuff) targetSpeed *= speedBuff.value;

    // Dash override
    if (this.dashDuration > 0) {
      this.vx = Math.cos(this.dashDirection) * this.dashSpeed;
      this.vy = Math.sin(this.dashDirection) * this.dashSpeed;
      this.isMoving = true;
    } else {
      // Monster Breakout smooth acceleration & momentum
      const accel = 14;
      const k = 1 - Math.exp(-accel * dt);
      this.vx += (dirX * targetSpeed - this.vx) * k;
      this.vy += (dirY * targetSpeed - this.vy) * k;

      const currentSpeed = Math.hypot(this.vx, this.vy);
      this.isMoving = currentSpeed > 15;
      if (this.isMoving) {
        this.moveAngle = Math.atan2(this.vy, this.vx);
        this.walkDist += currentSpeed * dt * 0.05;
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Direction facing based on aim angle
    if (Math.abs(Math.cos(this.aimAngle)) > 0.1) {
      this.facingLeft = Math.cos(this.aimAngle) < 0;
    }

    // Clamp to map
    this.x = Math.max(this.size, Math.min(MAP_CONFIG.width - this.size, this.x));
    this.y = Math.max(this.size, Math.min(MAP_CONFIG.height - this.size, this.y));
  }

  dash(dirX: number, dirY: number): void {
    if (this.dashCooldown > 0) return;
    if (dirX === 0 && dirY === 0) return;

    this.dashDirection = Math.atan2(dirY, dirX);
    this.dashDuration = 0.15; // 150ms dash
    this.dashCooldown = this.dashMaxCooldown;
    this.invulnTimer = 0.2; // Brief invulnerability during dash
  }

  takeDamage(amount: number): DamageResult {
    if (this.invulnTimer > 0 || this.hp <= 0) {
      return { damaged: false, dead: this.hp <= 0, actualDamage: 0 };
    }
    if (this.buffs.has('shield')) {
      return { damaged: false, dead: false, actualDamage: 0 };
    }

    const actualDamage = Math.max(1, Math.round(amount * this.damageReduction));
    this.hp = Math.max(0, this.hp - actualDamage);
    this.invulnTimer = this.invulnDuration;
    this.flashTimer = 0.12;

    return {
      damaged: true,
      dead: this.hp <= 0,
      actualDamage,
    };
  }

  heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  addXp(amount: number): boolean {
    let xpMult = 1;
    const doubleXp = this.buffs.get('double_xp');
    if (doubleXp) xpMult = doubleXp.value;

    this.xp += Math.round(amount * xpMult);
    if (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = xpForLevel(this.level);
      return true; // leveled up
    }
    return false;
  }

  update(dt: number): void {
    // Timers
    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    if (this.flashTimer > 0) this.flashTimer -= dt;
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    if (this.dashDuration > 0) this.dashDuration -= dt;

    // Update buffs
    for (const [key, buff] of this.buffs) {
      buff.duration -= dt;
      if (buff.duration <= 0) {
        this.buffs.delete(key);
      }
    }

    // Recover recoil
    this.recoilX -= this.recoilX * 10 * dt;
    this.recoilY -= this.recoilY * 10 * dt;
    if (this.muzzleFlashTimer > 0) this.muzzleFlashTimer -= dt;

    // Animation: continuous timer for idle breathing & locomotion
    this.animTimer += dt;
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const [sx, sy] = camera.worldToScreen(this.x, this.y);

    // ─── 0. Volumetric Tactical Weapon Light (Horror Flashlight Beam) ───
    const flashLen = 360;
    const flashHalfAngle = 0.36; // ~21 deg half cone
    const flashOriginX = sx + Math.cos(this.aimAngle) * 22;
    const flashOriginY = sy + Math.sin(this.aimAngle) * 22;

    ctx.save();
    const flashAlpha = this.muzzleFlashTimer > 0 ? 0.42 : 0.22;
    const flashGrad = ctx.createRadialGradient(flashOriginX, flashOriginY, 12, flashOriginX, flashOriginY, flashLen);
    flashGrad.addColorStop(0, `rgba(235, 250, 255, ${flashAlpha})`);
    flashGrad.addColorStop(0.25, `rgba(200, 235, 255, ${flashAlpha * 0.8})`);
    flashGrad.addColorStop(0.65, `rgba(130, 195, 255, ${flashAlpha * 0.3})`);
    flashGrad.addColorStop(1, 'rgba(70, 140, 220, 0)');

    ctx.fillStyle = flashGrad;
    ctx.beginPath();
    ctx.moveTo(flashOriginX, flashOriginY);
    ctx.arc(flashOriginX, flashOriginY, flashLen, this.aimAngle - flashHalfAngle, this.aimAngle + flashHalfAngle);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // ─── 1. Position Ring (Vòng định vị dưới chân như Monster Breakout) ───
    ctx.save();
    ctx.strokeStyle = 'rgba(126, 243, 255, 0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(sx, sy + 6, 22, 14, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(sx + 2, sy + 8, 20, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ─── 2. Aim Line / Laser Pointer ───
    const laserLen = 220;
    ctx.save();
    ctx.strokeStyle = 'rgba(126, 243, 255, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 8]);
    ctx.beginPath();
    ctx.moveTo(sx + Math.cos(this.aimAngle) * 20, sy + Math.sin(this.aimAngle) * 20);
    ctx.lineTo(sx + Math.cos(this.aimAngle) * laserLen, sy + Math.sin(this.aimAngle) * laserLen);
    ctx.stroke();
    ctx.restore();

    // ─── 3. Dash afterimage ───
    if (this.dashDuration > 0) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#7ef3ff';
      ctx.beginPath();
      ctx.arc(sx - Math.cos(this.dashDirection) * 18, sy - Math.sin(this.dashDirection) * 18, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Invulnerability blinking
    const isFlashing = this.flashTimer > 0;
    if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 12) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }

    // Shield aura
    if (this.buffs.has('shield')) {
      ctx.save();
      ctx.strokeStyle = '#88aaff';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#4488ff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(sx, sy - 4, this.size + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // ─── 4. Chân bước theo hướng di chuyển (moveAngle) với đổ bóng 3D ───
    const sp = Math.hypot(this.vx, this.vy);
    const stride = sp > 15 ? Math.sin(this.walkDist) * Math.min(8, 2 + sp / 50) : 0;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(sp > 15 ? this.moveAngle : this.aimAngle);

    // Boot left
    const bootGradL = ctx.createLinearGradient(0, -10, 0, -3);
    bootGradL.addColorStop(0, '#3f4741');
    bootGradL.addColorStop(1, '#1b201d');
    ctx.fillStyle = bootGradL;
    this.roundRect(ctx, -6 + stride, -10, 14, 7, 3); ctx.fill();

    // Boot right
    const bootGradR = ctx.createLinearGradient(0, 3, 0, 10);
    bootGradR.addColorStop(0, '#3f4741');
    bootGradR.addColorStop(1, '#1b201d');
    ctx.fillStyle = bootGradR;
    this.roundRect(ctx, -6 - stride, 3, 14, 7, 3); ctx.fill();

    // Reinforced boot toes
    ctx.fillStyle = '#111412';
    this.roundRect(ctx, 4 + stride, -10, 5, 7, 2.5); ctx.fill();
    this.roundRect(ctx, 4 - stride, 3, 5, 7, 2.5); ctx.fill();
    ctx.restore();

    // ─── 5. Thân trên, Áo giáp & Súng hướng theo chuột (aimAngle) ───
    ctx.save();
    ctx.translate(sx + this.recoilX, sy + this.recoilY);
    ctx.rotate(this.aimAngle);

    // Balo tác chiến sau lưng với đổ bóng 3D
    const bagGrad = ctx.createLinearGradient(-24, -10, -12, 10);
    bagGrad.addColorStop(0, '#544c38');
    bagGrad.addColorStop(1, '#242016');
    ctx.fillStyle = bagGrad;
    ctx.strokeStyle = '#12100a';
    ctx.lineWidth = 1.4;
    this.roundRect(ctx, -24, -10, 12, 20, 3.5);
    ctx.fill();
    ctx.stroke();

    // Bình lọc phát sáng xanh
    ctx.fillStyle = 'rgba(125, 255, 155, 0.85)';
    this.roundRect(ctx, -20, -13.5, 7, 3.5, 1.5);
    ctx.fill();

    // Áo giáp chiến thuật (đen than) với 3D gradient
    const armorGrad = ctx.createLinearGradient(-13, -14, 10, 14);
    armorGrad.addColorStop(0, isFlashing ? '#ffffff' : '#3d4447');
    armorGrad.addColorStop(0.5, isFlashing ? '#ffffff' : '#272b2e');
    armorGrad.addColorStop(1, isFlashing ? '#ffffff' : '#141618');
    ctx.fillStyle = armorGrad;
    ctx.strokeStyle = '#0b0d0e';
    ctx.lineWidth = 2;
    this.roundRect(ctx, -13, -14, 23, 28, 9);
    ctx.fill();
    ctx.stroke();

    // Tấm giáp ngực màu ô-liu với gờ nổi
    const chestGrad = ctx.createLinearGradient(-9, -11, 8, 11);
    chestGrad.addColorStop(0, isFlashing ? '#ffffff' : '#6e5f46');
    chestGrad.addColorStop(1, isFlashing ? '#ffffff' : '#3b3323');
    ctx.fillStyle = chestGrad;
    this.roundRect(ctx, -9, -11, 17, 22, 4);
    ctx.fill();

    // Phù hiệu cánh-kiếm phát sáng cyan ở vai trái
    ctx.fillStyle = '#30353a';
    ctx.beginPath(); ctx.arc(-2, -13, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-2, 13, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#86f6ff';
    ctx.shadowColor = '#7ef3ff';
    ctx.shadowBlur = 6;
    this.roundRect(ctx, -4.5, -17.5, 5, 3.6, 1);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Tay áo & Cẳng tay cầm súng
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#2c3033';
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(0, -12); ctx.lineTo(7, -8);
    ctx.moveTo(0, 12); ctx.lineTo(10, 7);
    ctx.stroke();

    ctx.strokeStyle = '#b7876a';
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(7, -8); ctx.lineTo(14, -4);
    ctx.moveTo(10, 7); ctx.lineTo(20, 2);
    ctx.stroke();

    // Khẩu súng trường tác chiến với metallic highlight
    const gunGrad = ctx.createLinearGradient(12, -4, 27, 4);
    gunGrad.addColorStop(0, '#2b333a');
    gunGrad.addColorStop(0.5, '#44515c');
    gunGrad.addColorStop(1, '#171b1f');
    ctx.fillStyle = gunGrad;
    ctx.fillRect(12, -3.5, 15, 7);

    // Nòng súng & Ống hãm nảy (muzzle compensator)
    ctx.fillStyle = '#0a0d0e';
    ctx.fillRect(25, -1.8, 7, 3.6);

    // Tactical Flashlight gắn trên nòng súng
    ctx.fillStyle = '#222';
    ctx.fillRect(18, 3.5, 8, 3.2);
    ctx.fillStyle = '#e6ffff';
    ctx.beginPath();
    ctx.arc(26, 5.1, 1.6, 0, Math.PI * 2);
    ctx.fill();

    // Bàn tay găng tác chiến đen
    ctx.fillStyle = '#15181a';
    ctx.beginPath(); ctx.arc(14, -4, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(20, 2, 3.4, 0, Math.PI * 2); ctx.fill();

    // Đầu nhân vật: Nón cối đặc nhiệm 3D với kính ngắm điện tử phát sáng Cyan
    const helmGrad = ctx.createRadialGradient(-2, -2, 1, -1.5, 0, 10);
    helmGrad.addColorStop(0, isFlashing ? '#ffffff' : '#3f4950');
    helmGrad.addColorStop(0.7, isFlashing ? '#ffffff' : '#23292e');
    helmGrad.addColorStop(1, isFlashing ? '#ffffff' : '#14181a');
    ctx.fillStyle = helmGrad;
    ctx.beginPath(); ctx.arc(-1.5, 0, 10, 0, Math.PI * 2); ctx.fill();

    // Kính nhìn đêm / Visor HUD phát sáng Cyan
    ctx.save();
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#00e5ff';
    this.roundRect(ctx, 2.5, -4.5, 3.5, 9, 1.5);
    ctx.fill();
    ctx.restore();

    // Chớp lửa nòng súng khi bắn
    if (this.muzzleFlashTimer > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255, 220, 100, 0.95)';
      ctx.beginPath();
      ctx.moveTo(32, -5); ctx.lineTo(48 + Math.random() * 8, 0); ctx.lineTo(32, 5); ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(34, 0, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
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
