// ─── Player Entity ───

import { PLAYER_DEFAULTS, MAP_CONFIG, xpForLevel } from '../data/items';
import { UPGRADES } from '../data/upgrades';
import { Camera } from '../core/camera';
import { AssetManager } from '../graphics/sprites';

export class Player {
  x: number;
  y: number;
  size: number;
  color: string;

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

  // Animation
  animTimer = 0;
  isMoving = false;

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
  }

  applyUpgrade(upgradeId: string): void {
    const current = this.upgrades.get(upgradeId) || 0;
    this.upgrades.set(upgradeId, current + 1);
    this.recalcStats();
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
    let speed = this.moveSpeed;
    const speedBuff = this.buffs.get('speed_boost');
    if (speedBuff) speed *= speedBuff.value;

    this.x += dirX * speed * dt;
    this.y += dirY * speed * dt;
    
    this.isMoving = (dirX !== 0 || dirY !== 0);

    // Clamp to map
    this.x = Math.max(this.size, Math.min(MAP_CONFIG.width - this.size, this.x));
    this.y = Math.max(this.size, Math.min(MAP_CONFIG.height - this.size, this.y));
  }

  takeDamage(amount: number): boolean {
    if (this.invulnTimer > 0) return false;
    if (this.buffs.has('shield')) return false;

    const actualDamage = Math.round(amount * this.damageReduction);
    this.hp -= actualDamage;
    this.invulnTimer = this.invulnDuration;
    this.flashTimer = 0.15;

    return this.hp <= 0;
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

    // Update buffs
    for (const [key, buff] of this.buffs) {
      buff.duration -= dt;
      if (buff.duration <= 0) {
        this.buffs.delete(key);
      }
    }

    // Animation
    if (this.isMoving) {
      this.animTimer += dt * 10;
    } else {
      this.animTimer = 0;
    }
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const [sx, sy] = camera.worldToScreen(this.x, this.y);

    // Invulnerability flash
    if (this.flashTimer > 0) {
      ctx.fillStyle = '#ffffff';
    } else if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 10) % 2 === 0) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = this.color;
    } else {
      ctx.fillStyle = this.color;
    }

    // Shield effect
    if (this.buffs.has('shield')) {
      ctx.strokeStyle = '#8888ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, sy, this.size + 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw sprite
    const frameIndex = Math.floor(this.animTimer) % 4;
    const sprite = AssetManager.get().getSprite('player', this.color, frameIndex);
    
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(this.aimAngle);
    
    // Draw flash overlay if needed, else draw normally
    if (this.flashTimer > 0) {
      ctx.globalCompositeOperation = 'lighter';
    }

    ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
    ctx.restore();

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
