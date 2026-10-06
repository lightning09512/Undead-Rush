// ─── Player Entity ───

import { PLAYER_DEFAULTS, MAP_CONFIG } from '../data/items';
import { UPGRADES } from '../data/upgrades';
import { Camera } from '../core/camera';
import { EntityRenderer } from '../graphics/entity-renderer';
import type { GunLoadout } from '../systems/gun-loadout';
import { drawHeldGun, heldGunShape } from '../graphics/held-gun';
import { getCampaignBounds, resolveBuildingCollision, resolveCampaignMovement } from './map-geometry';

export interface DamageResult {
  damaged: boolean;
  dead: boolean;
  actualDamage: number;
  medkitUsed?: boolean;
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
  visualCharacterId = 'survivor';
  private displayedGunId = '';
  private switchVisualTimer = 0;

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

  // Survival score from collected shards, supply caches and airdrops.
  score = 0;
  scoreMultiplier = 1;

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
  reloadSpeedMultiplier = 1;

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
    this.score = 0;
    this.scoreMultiplier = 1;
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
    this.reloadSpeedMultiplier = 1;
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
    this.displayedGunId = '';
    this.switchVisualTimer = 0;
  }

  applyUpgrade(upgradeId: string): void {
    const current = this.upgrades.get(upgradeId) || 0;
    this.upgrades.set(upgradeId, current + 1);
    this.recalcStats();
    if (this.loadout) {
      this.loadout.applyUpgradeEffect(upgradeId, current + 1);
    }
  }

  recalcStats(): void {
    // Start from defaults
    let damageMult = 1;
    let fireRateMult = 1;
    let speedMult = 1;
    let radiusMult = 1;
    let reloadSpeedMult = 1;

    this.damageReduction = 1.0;
    this.pierceCount = 0;
    this.explosiveRadius = 0;
    this.burnDamage = 0;
    this.slowMultiplier = 1.0;
    this.lifestealAmount = 0;
    this.reloadSpeedMultiplier = 1;
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
        case 'rapid_reload': reloadSpeedMult = val; break;
      }
    }

    this.bulletDamage = Math.round(PLAYER_DEFAULTS.bulletDamage * damageMult);
    this.fireRate = PLAYER_DEFAULTS.fireRate * fireRateMult;
    this.moveSpeed = PLAYER_DEFAULTS.moveSpeed * speedMult;
    this.pickupRadius = PLAYER_DEFAULTS.pickupRadius * radiusMult;
    this.reloadSpeedMultiplier = reloadSpeedMult;
    const dashCard = this.upgrades.get('evasive_training') || 0;
    const dashDef = UPGRADES.find(upgrade => upgrade.id === 'evasive_training');
    const dashMult = dashCard > 0 && dashDef ? dashDef.values[dashCard - 1] : 1;
    this.dashMaxCooldown = (this.loadout?.campaignMode ? 1 : 3) * dashMult;

    // Cap HP at max when upgrading
    if (this.hp > this.maxHp) this.hp = this.maxHp;
  }

  move(dirX: number, dirY: number, dt: number, collideBuildings = true): void {
    const previousX = this.x, previousY = this.y;
    let targetSpeed = this.moveSpeed;
    if (this.loadout?.campaignMode && this.loadout.activeSlot.def.id === 'smg9') {
      targetSpeed *= 1 + .15 * (this.upgrades.get('smg9_featherweight') || 0);
    }
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
    [this.x, this.y] = resolveCampaignMovement(previousX, previousY, this.x, this.y, this.size * 0.72);

    // Direction facing based on aim angle
    if (Math.abs(Math.cos(this.aimAngle)) > 0.1) {
      this.facingLeft = Math.cos(this.aimAngle) < 0;
    }

    // Clamp to map
    const bounds = getCampaignBounds();
    this.x = Math.max((bounds?.x ?? 0) + this.size, Math.min((bounds ? bounds.x + bounds.w : MAP_CONFIG.width) - this.size, this.x));
    this.y = Math.max((bounds?.y ?? 0) + this.size, Math.min((bounds ? bounds.y + bounds.h : MAP_CONFIG.height) - this.size, this.y));
    if (collideBuildings) [this.x, this.y] = resolveBuildingCollision(this.x, this.y, this.size * 0.72);
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

    let takenMultiplier = this.damageReduction;
    const lowHpLevel = this.upgrades.get('last_stand') || 0;
    if (lowHpLevel > 0 && this.hp / this.maxHp <= .3) {
      const def = UPGRADES.find(upgrade => upgrade.id === 'last_stand');
      if (def) takenMultiplier *= def.values[lowHpLevel - 1];
    }
    const reloadLevel = this.upgrades.get('reload_guard') || 0;
    if (reloadLevel > 0 && this.loadout?.activeSlot.isReloading) {
      const def = UPGRADES.find(upgrade => upgrade.id === 'reload_guard');
      if (def) takenMultiplier *= def.values[reloadLevel - 1];
    }
    const actualDamage = Math.max(1, Math.round(amount * takenMultiplier));
    this.hp = Math.max(0, this.hp - actualDamage);
    this.invulnTimer = this.invulnDuration;
    this.flashTimer = 0.2;

    return {
      damaged: true,
      dead: this.hp <= 0,
      actualDamage,
    };
  }

  heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  addScore(amount: number): number {
    const multiplier = this.scoreMultiplier * (this.buffs.get('double_score')?.value ?? 1);
    const points = Math.max(0, Math.round(amount * multiplier));
    this.score += points;
    return points;
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
    const gunId = this.loadout?.activeSlot.def.id ?? 'ar7';
    if (this.displayedGunId && this.displayedGunId !== gunId) this.switchVisualTimer = .18;
    this.displayedGunId = gunId;
    this.switchVisualTimer = Math.max(0, this.switchVisualTimer - dt);

    // Animation: continuous timer for idle breathing & locomotion
    this.animTimer += dt;
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera, campaign = false): void {
    const [sx, sy] = camera.worldToScreen(this.x, this.y);
    const slot = this.loadout?.activeSlot;
    const gun = slot?.def;
    const shape = gun ? heldGunShape(gun) : undefined;
    const reload = slot?.isReloading ? slot.reloadProgress : 0;
    const idleBreath = Math.sin(this.animTimer * 2.3) * (this.isMoving ? .35 : .85);
    const chestTone = this.visualCharacterId === 'medic' ? '#858d80'
      : this.visualCharacterId === 'scout' ? '#6c6650'
      : this.visualCharacterId === 'soldier' ? '#56644e'
      : this.visualCharacterId === 'engineer' ? '#756a51'
      : this.visualCharacterId === 'berserker' ? '#713e3e' : '#52636a';

    // ─── 0. Volumetric Tactical Weapon Light (Horror Flashlight Beam) ───
    const flashLen = 360;
    const flashHalfAngle = 0.36; // ~21 deg half cone
    const flashOriginX = sx + Math.cos(this.aimAngle) * (shape?.muzzle ?? 28);
    const flashOriginY = sy + Math.sin(this.aimAngle) * (shape?.muzzle ?? 28);

    ctx.save();
    const flashAlpha = campaign ? (this.muzzleFlashTimer > 0 ? .14 : .055) : (this.muzzleFlashTimer > 0 ? 0.42 : 0.22);
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
    ctx.strokeStyle = '#788077';ctx.lineWidth = 1;
    ctx.beginPath();ctx.moveTo(-1 + stride,-8);ctx.lineTo(5 + stride,-8);
    ctx.moveTo(-1 - stride,5);ctx.lineTo(5 - stride,5);ctx.stroke();
    ctx.restore();

    // ─── 5. Thân trên, Áo giáp & Súng hướng theo chuột (aimAngle) ───
    ctx.save();
    ctx.translate(sx + this.recoilX, sy + this.recoilY + idleBreath);
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
    chestGrad.addColorStop(0, isFlashing ? '#ffffff' : chestTone);
    chestGrad.addColorStop(1, isFlashing ? '#ffffff' : '#303b3a');
    ctx.fillStyle = chestGrad;
    this.roundRect(ctx, -9, -11, 17, 22, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(183,191,177,.38)';ctx.lineWidth = 1.2;
    ctx.beginPath();ctx.moveTo(-8,-6);ctx.lineTo(5,-6);ctx.moveTo(-8,7);ctx.lineTo(5,7);
    ctx.moveTo(-4,-10);ctx.lineTo(-4,10);ctx.stroke();
    ctx.fillStyle = '#20292a';ctx.fillRect(-9,-2,4,5);ctx.fillRect(5,-2,3,5);
    if (this.visualCharacterId === 'medic') {
      ctx.fillStyle='#d9ddd0';ctx.fillRect(-2,-5,7,9);
      ctx.fillStyle='#9d5049';ctx.fillRect(0,-4,3,7);ctx.fillRect(-1,-2,5,2);
    } else if (this.visualCharacterId === 'engineer') {
      ctx.fillStyle='#c6a56f';ctx.fillRect(-8,6,7,4);ctx.fillRect(3,6,5,3);
    } else if (this.visualCharacterId === 'scout') {
      ctx.strokeStyle='#baa377';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-9,-8);ctx.lineTo(8,8);ctx.stroke();
    } else if (this.visualCharacterId === 'soldier') {
      ctx.fillStyle='#8d9b83';ctx.fillRect(-7,-4,3,9);ctx.fillRect(3,-4,3,9);
    } else if (this.visualCharacterId === 'berserker') {
      ctx.strokeStyle='#a4544f';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-8,-3);ctx.lineTo(6,4);ctx.stroke();
    }

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

    // Arms follow the grip and fore-end of the selected weapon.
    const support = shape?.support ?? 25;
    const grip = shape?.grip ?? 13;
    const switchDip = this.switchVisualTimer > 0 && this.muzzleFlashTimer <= 0
      ? Math.sin(this.switchVisualTimer / .18 * Math.PI) * 5 : 0;
    ctx.lineCap = 'round';
    ctx.strokeStyle = chestTone;
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(0, -12); ctx.lineTo(grip - 5, -6 + switchDip);
    ctx.moveTo(0, 12); ctx.lineTo(support - 6, 6 + switchDip);
    ctx.stroke();

    ctx.strokeStyle = '#b7876a';
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(grip - 5, -6 + switchDip); ctx.lineTo(grip, -3 + switchDip);
    ctx.moveTo(support - 6, 6 + switchDip); ctx.lineTo(support, 2 + switchDip);
    ctx.stroke();

    ctx.save();ctx.translate(0, switchDip + reload * 3);
    if (gun) drawHeldGun(ctx, gun, reload);
    ctx.restore();

    // Gloves sit over the weapon rather than floating beside it.
    ctx.fillStyle = '#15181a';
    ctx.beginPath(); ctx.arc(grip, -3 + switchDip, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(support, 2 + switchDip, 3.4, 0, Math.PI * 2); ctx.fill();

    // Đầu nhân vật: Nón cối đặc nhiệm 3D với kính ngắm điện tử phát sáng Cyan
    const helmGrad = ctx.createRadialGradient(-2, -2, 1, -1.5, 0, 10);
    helmGrad.addColorStop(0, isFlashing ? '#ffffff' : '#3f4950');
    helmGrad.addColorStop(0.7, isFlashing ? '#ffffff' : '#23292e');
    helmGrad.addColorStop(1, isFlashing ? '#ffffff' : '#14181a');
    ctx.fillStyle = helmGrad;
    ctx.beginPath(); ctx.arc(-1.5, 0, 10, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = this.visualCharacterId === 'scout' ? '#b49b65'
      : this.visualCharacterId === 'medic' ? '#ced7cf' : '#75837e';
    ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(-1.5,0,8.3,Math.PI*.66,Math.PI*1.36);ctx.stroke();

    // Kính nhìn đêm / Visor HUD phát sáng Cyan
    ctx.save();
    ctx.fillStyle = this.visualCharacterId === 'medic' ? '#d9ece3'
      : this.visualCharacterId === 'berserker' ? '#d69a84' : '#9fd8db';
    this.roundRect(ctx, 2.5, -4.5, 3.5, 9, 1.5);
    ctx.fill();
    ctx.restore();

    // Chớp lửa nòng súng khi bắn
    if (this.muzzleFlashTimer > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255, 220, 100, 0.95)';
      ctx.beginPath();
      const muzzle = shape?.muzzle ?? 32;
      ctx.moveTo(muzzle, -3); ctx.lineTo(muzzle + 9, 0); ctx.lineTo(muzzle, 3); ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(muzzle + 1, 0, 2.6, 0, Math.PI * 2); ctx.fill();
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
