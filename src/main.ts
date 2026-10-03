// ─── Undead Rush: Main Game Loop ───
// Top-down roguelite zombie survivor
// Stages 1–7: Full game with meta progression

import { Camera } from './core/camera';
import { Input } from './core/input';
import { Audio } from './core/audio';
import { SpatialGrid } from './core/spatial';

import { Player } from './entities/player';
import { BulletSystem, Bullet } from './entities/bullets';
import { ZombieSystem, Zombie } from './entities/zombies';
import { XpGemSystem } from './entities/xp-gems';
import { ParticleSystem } from './entities/particles';
import { DamageNumbers } from './entities/damage-numbers';
import { EnemyProjectileSystem } from './entities/enemy-projectiles';
import { MapPickupSystem } from './entities/map-pickups';
import { SupplyCrateSystem } from './entities/supply-crates';
import { GroundRenderer } from './graphics/ground';
import { PropRenderer } from './graphics/props';
import { LightingRenderer } from './graphics/lighting';
import { spriteLoader } from './graphics/assets-config';
import { EntityRenderer } from './graphics/entity-renderer';

import { Spawner } from './systems/spawner';
import { WeaponSystem } from './systems/weapons';
import { SaveSystem } from './systems/save';
import { adWrapper } from './systems/ads';

import { HUD } from './ui/hud';
import { UpgradeUI } from './ui/upgrade-ui';
import { MenuUI } from './ui/menu';
import { ShopUI } from './ui/shop';
import { CrosshairRenderer } from './ui/crosshair';
import { drawTouchActionButtons } from './ui/touch-controls';

import { MAP_CONFIG, PLAYER_DEFAULTS, WEAPON_PARTS } from './data/items';
import { PERM_UPGRADES, CHARACTERS, STAGES } from './data/meta';
import { EVOLUTIONS } from './data/upgrades';

// ─── Canvas Setup ───
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
let viewportWidth = window.innerWidth;
let viewportHeight = window.innerHeight;

function resizeCanvas(): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  viewportWidth = window.innerWidth;
  viewportHeight = window.innerHeight;
  canvas.width = Math.round(viewportWidth * dpr);
  canvas.height = Math.round(viewportHeight * dpr);
  canvas.style.width = `${viewportWidth}px`;
  canvas.style.height = `${viewportHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  camera.resize(viewportWidth, viewportHeight);
  LightingRenderer.get().resizeVignette(viewportWidth, viewportHeight);
}

EntityRenderer.init();

// ─── Systems ───
const camera = new Camera();
const input = new Input(canvas);
const audio = new Audio();
const player = new Player();
const bullets = new BulletSystem();
const zombies = new ZombieSystem();
const xpGems = new XpGemSystem();
const particles = new ParticleSystem();
const damageNumbers = new DamageNumbers();
const enemyProjectiles = new EnemyProjectileSystem();
const mapPickups = new MapPickupSystem();
const supplyCrates = new SupplyCrateSystem();
const spawner = new Spawner();
const weapons = new WeaponSystem();
const zombieGrid = new SpatialGrid<Zombie>(64);
const save = new SaveSystem();
const groundRenderer = new GroundRenderer();
const propRenderer = new PropRenderer();

// ─── UI ───
const hud = new HUD();
const upgradeUI = new UpgradeUI();
const menuUI = new MenuUI();
const shopUI = new ShopUI();

// ─── Game State ───
let gameTime = 0;
let paused = false;
let lastTimestamp = 0;
let gameMode: 'endless' | 'stage' = 'endless';
let currentStageIndex = 0;
let stageComplete = false;
let bossKilledThisRun = false;
let goldEarned = 0;
let hasRevive = false;     // from perm upgrade or ad

// ─── Spitter attack timer (shared) ───
let spitterGlobalCooldown = 0;

// ─── Boss attack patterns ───
let bossAttackTimer = 0;
let bossAttackPhase = 0;

// ─── Init ad wrapper ───
adWrapper.init({
  onRewarded: (placement) => {
    if (placement === 'revive') {
      // Revive player
      player.hp = Math.round(player.maxHp * 0.3);
      player.invulnTimer = 2.0;
      menuUI.currentScreen = 'playing';
      paused = false;
      particles.emit(player.x, player.y, 30, '#ffff00', 200, 0.8, 5);
    } else if (placement === 'double_gold') {
      save.data.gold += goldEarned; // double it
      save.save();
      menuUI.finalGold = goldEarned * 2;
    } else if (placement === 'reroll_upgrades') {
      upgradeUI.generateChoices(player);
    }
  },
  onSkipped: () => {},
  onError: () => {},
});

// ─── Main Loop ───
function gameLoop(timestamp: number): void {
  requestAnimationFrame(gameLoop);

  const rawDt = (timestamp - lastTimestamp) / 1000;
  const dt = Math.min(rawDt, 0.1);
  lastTimestamp = timestamp;
  input.touchButtonsEnabled = menuUI.currentScreen === 'playing' && !paused && !shopUI.visible;

  if (!spriteLoader.ready) {
    ctx.fillStyle = '#060906';
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Loading Assets...', viewportWidth / 2, viewportHeight / 2);
    return;
  }

  input.update();

  const click = input.uiClick;

  if (click && menuUI.currentScreen === 'playing' && !paused) {
    weapons.loadout.handleClick(click.x, click.y, viewportWidth, viewportHeight, audio);
  }

  // ─── Shop Screen ───
  if (shopUI.visible) {
    if (click) {
      shopUI.handleClick(click.x, click.y, viewportWidth, viewportHeight, save, audio);
    }
    shopUI.draw(ctx, viewportWidth, viewportHeight, save);
    return;
  }

  // ─── Menu screens ───
  if (menuUI.currentScreen !== 'playing') {
    if (click) {
      if (upgradeUI.visible) {
        const selected = upgradeUI.handleClick(click.x, click.y, viewportWidth, viewportHeight);
        if (selected) {
          player.applyUpgrade(selected.id);
          audio.menuSelect();

          // Check for evolutions
          checkEvolutions();

          menuUI.currentScreen = 'playing';
          paused = false;
        }
      } else {
        const action = menuUI.handleClick(click.x, click.y, viewportWidth, viewportHeight, audio);
        handleMenuAction(action);
      }
    }

    // Draw appropriate screen
    canvas.style.cursor = 'default';
    if (menuUI.currentScreen === 'main') {
      menuUI.draw(ctx, viewportWidth, viewportHeight, save);
      return;
    }
    if (menuUI.currentScreen === 'paused') {
      drawGame();
      menuUI.draw(ctx, viewportWidth, viewportHeight, save);
      return;
    }
    if (menuUI.currentScreen === 'gameover') {
      drawGame();
      menuUI.draw(ctx, viewportWidth, viewportHeight, save);
      return;
    }
    if (menuUI.currentScreen === 'levelup') {
      drawGame();
      upgradeUI.draw(ctx, viewportWidth, viewportHeight, player, input.mouseX, input.mouseY);
      return;
    }
    if (menuUI.currentScreen === 'stage_complete' as any) {
      drawGame();
      menuUI.draw(ctx, viewportWidth, viewportHeight, save);
      return;
    }
  }

  // Pause toggle
  if (input.pausePressed) {
    paused = !paused;
    menuUI.currentScreen = paused ? 'paused' : 'playing';
    if (paused) adWrapper.gameplayStop();
    else adWrapper.gameplayStart();
  }

  if (paused) {
    drawGame();
    menuUI.draw(ctx, viewportWidth, viewportHeight, save);
    return;
  }

  updateGame(dt);
  drawGame();
}

function handleMenuAction(action: string | null): void {
  if (!action) return;

  switch (action) {
    case 'start_endless':
      gameMode = 'endless';
      startGame();
      break;
    case 'start_stage':
      gameMode = 'stage';
      currentStageIndex = 0;
      startGame();
      break;
    case 'open_shop':
      shopUI.visible = true;
      break;
    case 'open_hunter_profile':
      menuUI.currentScreen = 'hunter_profile';
      break;
    case 'open_tutorial':
      menuUI.currentScreen = 'tutorial';
      break;
    case 'resume':
      menuUI.currentScreen = 'playing';
      paused = false;
      adWrapper.gameplayStart();
      break;
    case 'quit':
    case 'menu':
      endRun();
      resetGame();
      menuUI.currentScreen = 'main';
      break;
    case 'retry':
      startGame();
      break;
    case 'revive_ad':
      adWrapper.showRewarded('revive');
      break;
    case 'double_gold_ad':
      adWrapper.showRewarded('double_gold');
      break;
    case 'next_stage':
      currentStageIndex++;
      if (currentStageIndex < STAGES.length) {
        startGame();
      } else {
        menuUI.currentScreen = 'main';
      }
      break;
  }
}

function updateGame(dt: number): void {
  gameTime += dt;

  // ─── Stage mode: check completion ───
  if (gameMode === 'stage' && !stageComplete) {
    checkStageObjective();
  }

  // ─── Player Movement ───
  player.move(input.dirX, input.dirY, dt, gameMode === 'endless');
  player.update(dt);

  // Dash input
  if (input.dashPressed) {
    player.dash(input.dirX, input.dirY);
  }

  // ─── Camera ───
  camera.follow(player.x, player.y, input.mouseX, input.mouseY, dt);

  // ─── Spawning ───
  const toSpawn = spawner.update(dt, gameTime, zombies.pool.activeCount, camera, player.x, player.y);
  for (const s of toSpawn) {
    const z = zombies.spawn(
      s.type, s.x, s.y,
      s.tier.hpMultiplier, s.tier.speedMultiplier, s.tier.damageMultiplier,
      s.isElite
    );

    // Stage mode difficulty multiplier
    if (gameMode === 'stage' && currentStageIndex < STAGES.length) {
      const mult = STAGES[currentStageIndex].difficultyMult;
      z.hp = Math.round(z.hp * mult);
      z.maxHp = z.hp;
      z.damage = Math.round(z.damage * mult);
    }
  }

  // ─── Weapons ───
  weapons.update(dt, player, input, zombies.pool, bullets, audio, camera);

  // ─── Bullets ───
  bullets.update(dt, gameMode === 'endless');

  // ─── Zombies ───
  zombies.update(dt, player.x, player.y, gameMode === 'endless');

  // ─── Spatial Grid ───
  zombieGrid.clear();
  let nearestZombie: Zombie | null = null;
  let nearestZombieDistanceSq = Infinity;
  for (const z of zombies.pool.getActive()) {
    zombieGrid.insert(z);
    if (z.hp <= 0) continue;
    const dx = z.x - player.x;
    const dy = z.y - player.y;
    const distanceSq = dx * dx + dy * dy;
    if (distanceSq < nearestZombieDistanceSq) {
      nearestZombie = z;
      nearestZombieDistanceSq = distanceSq;
    }
  }
  if (nearestZombie) {
    const [zombieScreenX] = camera.worldToWindowScreen(nearestZombie.x, nearestZombie.y);
    const [playerScreenX] = camera.worldToWindowScreen(player.x, player.y);
    const pan = Math.max(-1, Math.min(1, (zombieScreenX - playerScreenX) / (window.innerWidth * 0.48)));
    audio.updateZombieAmbience(dt, Math.sqrt(nearestZombieDistanceSq), pan, nearestZombie.typeId);
  } else {
    audio.updateZombieAmbience(dt);
  }

  // ─── Spitter AI ───
  spitterGlobalCooldown -= dt;
  if (spitterGlobalCooldown <= 0) {
    spitterGlobalCooldown = 1.5; // fire every 1.5s
    for (const z of zombies.pool.getActive()) {
      if (!z.ranged || z.hp <= 0) continue;
      const dx = player.x - z.x;
      const dy = player.y - z.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < z.attackRange && z.attackCooldown <= 0) {
        const angle = Math.atan2(dy, dx);
        enemyProjectiles.fire(z.x, z.y, angle, z.projectileSpeed, z.damage, 'poison');
        z.attackCooldown = 2.0;
      }
    }
  }

  // ─── Boss AI: special attacks ───
  bossAttackTimer -= dt;
  if (bossAttackTimer <= 0) {
    bossAttackTimer = 3.0;
    bossAttackPhase++;
    for (const z of zombies.pool.getActive()) {
      if (!z.isBoss || z.hp <= 0) continue;

      // Alternate between attack patterns
      if (bossAttackPhase % 3 === 0) {
        // Ring of projectiles
        enemyProjectiles.fireRing(z.x, z.y, 12, 120, z.damage, 'boss_orb');
        camera.shake(5, 0.2);
      } else if (bossAttackPhase % 3 === 1) {
        // Aimed burst at player
        const angle = Math.atan2(player.y - z.y, player.x - z.x);
        enemyProjectiles.fireBurst(z.x, z.y, 5, 150, z.damage, angle);
      } else {
        // Slow wave in all directions
        enemyProjectiles.fireRing(z.x, z.y, 24, 80, Math.round(z.damage * 0.6), 'boss_wave');
        camera.shake(8, 0.3);
      }
    }
  }

  // ─── Enemy Projectiles ───
  enemyProjectiles.update(dt);

  // ─── Enemy projectile -> player collision ───
  enemyProjectiles.pool.forEach((p) => {
    const dx = player.x - p.x;
    const dy = player.y - p.y;
    const dist = dx * dx + dy * dy;
    const radii = player.size + p.size;
    if (dist < radii * radii) {
      const hit = player.takeDamage(p.damage);
      if (hit.dead) {
        handlePlayerDeath();
        return true;
      }
      if (hit.damaged) {
        audio.playerHit();
        camera.shake(1.5, 0.08);
        damageNumbers.spawn(player.x, player.y, hit.actualDamage, '#ff4444', false, '-');
        particles.emit(player.x, player.y, 3, '#44ff66', 60, 0.2, 2.5);
      }
      return true; // release projectile
    }
    return false;
  });

  // ─── Bullet-Zombie Collisions ───
  bullets.pool.forEach((b: Bullet) => {
    const nearby = zombieGrid.query(b.x, b.y, b.size + 30);
    for (const z of nearby) {
      if (b.hitIds.has(z.id)) continue;
      if (z.hp <= 0) continue;

      const dx = b.x - z.x;
      const dy = b.y - z.y;
      const dist = dx * dx + dy * dy;
      const radii = b.size + z.size;
      if (dist < radii * radii) {
        z.hp -= b.damage;
        z.flashTimer = 0.08;
        b.hitIds.add(z.id);

        // Apply knockback impulse
        const kDist = Math.sqrt(dx * dx + dy * dy);
        if (kDist > 0.1) {
          const kForce = z.isBoss ? 35 : z.isElite ? 85 : 180;
          z.knockbackX = (-dx / kDist) * kForce;
          z.knockbackY = (-dy / kDist) * kForce;
        }

        if (b.burn > 0) {
          z.burnTimer = 3;
          z.burnDamage = b.burn;
        }
        if (b.slow > 0 && b.slow < 1) {
          z.slowTimer = 2;
          z.slowMult = b.slow;
        }

        damageNumbers.spawn(z.x, z.y, b.damage, '#ffdd44');
        particles.burst(z.x, z.y, 4, z.color,
          Math.atan2(-dy, -dx), Math.PI * 0.5, 90, 0.35);
        audio.hit();

        if (b.explosive > 0) {
          handleExplosion(z.x, z.y, b.explosive, b.damage);
        }

        if (b.pierceLeft > 0) {
          b.pierceLeft--;
        } else {
          return true;
        }

        if (z.hp <= 0) {
          handleZombieDeath(z);
        }
      }
    }

    // Bullet-Crate collision
    const crateHit = supplyCrates.damageCrate(b.x, b.y, b.damage);
    if (crateHit) {
      const crate = supplyCrates.getCrateAt(b.x, b.y);
      if (crate) {
        handleCrateDestruction(crate);
      }
      return true; // destroy bullet
    }

    return false;
  });

  // ─── Check burn deaths ───
  for (const z of zombies.pool.getActive()) {
    if (z.hp <= 0) {
      handleZombieDeath(z);
    }
  }

  // ─── Zombie-Player Collisions ───
  const nearPlayer = zombieGrid.query(player.x, player.y, player.size + 50);
  for (const z of nearPlayer) {
    if (z.hp <= 0) continue;
    const dx = player.x - z.x;
    const dy = player.y - z.y;
    const dist = dx * dx + dy * dy;
    const radii = player.size + z.size;
    if (dist < radii * radii) {
      if (z.explodes && z.hp > 0) {
        z.hp = 0;
        handleZombieDeath(z);
        continue;
      }

      if (z.attackCooldown <= 0) {
        z.attackAnim = 1.0;
        z.attackTimer += 0.8;
        const hit = player.takeDamage(z.damage);
        if (hit.dead) {
          handlePlayerDeath();
          return;
        }
        if (hit.damaged) {
          z.attackCooldown = 0.5;
          audio.playerHit();
          camera.shake(1.6, 0.08);
          damageNumbers.spawn(player.x, player.y, hit.actualDamage, '#ff3b30', false, '-');
          particles.emit(player.x, player.y, 3, '#ff3b30', 60, 0.18, 2.5);
        }
      }
    }
  }

  // ─── XP Gems ───
  const collected = xpGems.update(dt, player.x, player.y, player.pickupRadius);
  for (const gem of collected) {
    const leveledUp = player.addXp(gem.value);
    audio.xpPickup();
    particles.emit(player.x, player.y, 3, gem.color, 50, 0.2, 2);

    if (leveledUp) {
      audio.levelUp();
      camera.shake(3, 0.15);
      upgradeUI.generateChoices(player);
      if (upgradeUI.cards.length > 0) {
        menuUI.currentScreen = 'levelup';
        paused = true;
      }
    }
  }

  // ─── Supply Crates ───
  supplyCrates.update(dt, gameTime, player.x, player.y);

  // ─── Map Pickups ───
  const pickedUp = mapPickups.update(dt, gameTime, player.x, player.y);
  for (const item of pickedUp) {
    handlePickup(item.itemId, item.value, item.duration);
  }

  // ─── Particles ───
  particles.update(dt);
  damageNumbers.update(dt);
}

function handlePickup(itemId: string, value: number, duration: number): void {
  audio.xpPickup();

  switch (itemId) {
    case 'health_pack':
      player.heal(value);
      particles.emit(player.x, player.y, 8, '#ff4444', 60, 0.4, 3);
      damageNumbers.spawn(player.x, player.y, value, '#44ff44');
      break;
    case 'magnet':
      xpGems.magnetizeAll();
      particles.emit(player.x, player.y, 15, '#ff8800', 100, 0.5, 4);
      break;
    case 'xp_chest':
      player.addXp(value);
      particles.emit(player.x, player.y, 20, '#ffdd00', 120, 0.6, 5);
      camera.shake(3, 0.15);
      // Check for level up after adding XP
      if (player.xp >= player.xpToNext) {
        // The level up will be caught on the next XP gem collection
        // Force it here
        while (player.xp >= player.xpToNext) {
          player.xp -= player.xpToNext;
          player.level++;
          player.xpToNext = Math.floor(20 + player.level * 15 + player.level * player.level * 2);
          audio.levelUp();
          upgradeUI.generateChoices(player);
          if (upgradeUI.cards.length > 0) {
            menuUI.currentScreen = 'levelup';
            paused = true;
            break;
          }
        }
      }
      break;
    case 'double_xp':
      player.buffs.set('double_xp', { duration, value });
      break;
    case 'speed_boost':
      player.buffs.set('speed_boost', { duration, value });
      break;
    case 'shield':
      player.buffs.set('shield', { duration, value: 1 });
      particles.emit(player.x, player.y, 10, '#8888ff', 80, 0.4, 3);
      break;
    case 'bomb':
      // Kill all visible zombies
      handleScreenBomb();
      break;
    case 'airdrop':
      // Big XP
      player.addXp(value);
      particles.emit(player.x, player.y, 25, '#ffaa00', 150, 0.8, 6);
      camera.shake(5, 0.2);
      break;
    case 'weapon_part':
      // Apply weapon part effect
      handleWeaponPart();
      break;
    case 'gun_sg12':
      weapons.loadout.unlockGun('sg12', audio);
      damageNumbers.spawn(player.x, player.y - 35, 0, '#a3e635');
      particles.emit(player.x, player.y, 25, '#ff9933', 140, 0.7, 5);
      audio.levelUp();
      break;
    case 'gun_smg9':
      weapons.loadout.unlockGun('smg9', audio);
      damageNumbers.spawn(player.x, player.y - 35, 0, '#a3e635');
      particles.emit(player.x, player.y, 25, '#00e5ff', 140, 0.7, 5);
      audio.levelUp();
      break;
  }
}

function handleCrateDestruction(crate: any): void {
  audio.explosion();
  camera.shake(5, 0.2);
  particles.emit(crate.x, crate.y, 15, '#ffaa00', 100, 0.5, 4);

  // Chance to drop an unowned weapon from crate!
  if (!weapons.loadout.hasGun('sg12') && Math.random() < 0.45) {
    mapPickups.spawnWeaponPickup(crate.x, crate.y, 'sg12');
    return;
  }
  if (!weapons.loadout.hasGun('smg9') && Math.random() < 0.45) {
    mapPickups.spawnWeaponPickup(crate.x, crate.y, 'smg9');
    return;
  }

  // Get drop type from crate
  const dropType = supplyCrates.getDropType(crate);

  // Spawn the appropriate pickup
  if (dropType === 'weapon_part') {
    handleWeaponPart();
  } else if (dropType === 'health_pack') {
    player.heal(30);
    particles.emit(crate.x, crate.y, 8, '#ff4444', 60, 0.4, 3);
    damageNumbers.spawn(crate.x, crate.y, 30, '#44ff44');
  } else if (dropType === 'xp_chest') {
    player.addXp(100);
    particles.emit(crate.x, crate.y, 20, '#ffdd00', 120, 0.6, 5);
  } else if (dropType === 'shield') {
    player.buffs.set('shield', { duration: 8, value: 1 });
    particles.emit(crate.x, crate.y, 10, '#8888ff', 80, 0.4, 3);
  } else if (dropType === 'magnet') {
    xpGems.magnetizeAll();
    particles.emit(crate.x, crate.y, 15, '#ff8800', 100, 0.5, 4);
  }
}

function handleWeaponPart(): void {
  // Randomly select a weapon part type
  const part = WEAPON_PARTS[Math.floor(Math.random() * WEAPON_PARTS.length)];

  // Apply the effect
  switch (part.id) {
    case 'part_damage':
      player.bulletDamage = Math.round(player.bulletDamage * 1.05);
      break;
    case 'part_fire_rate':
    case 'part_magazine':
      player.fireRate *= 1.08;
      break;
    case 'part_pierce':
      player.pierceCount += 1;
      break;
    case 'part_split':
      // Split effect - handled in weapon system
      break;
  }

  // Show notification
  damageNumbers.spawn(player.x, player.y - 30, 0, '#ff00ff');
  particles.emit(player.x, player.y, 15, '#ff00ff', 100, 0.6, 4);
  audio.levelUp();
}

function handleScreenBomb(): void {
  audio.explosion();
  camera.shake(15, 0.5);
  particles.emit(player.x, player.y, 40, '#ff2222', 300, 1.0, 8);
  particles.emit(player.x, player.y, 30, '#ffaa00', 250, 0.8, 6);

  // Kill all zombies on screen
  for (const z of zombies.pool.getActive()) {
    if (camera.isVisible(z.x, z.y, z.size)) {
      z.hp = 0;
      handleZombieDeath(z);
    }
  }
}

function handlePlayerDeath(): void {
  // Check for revive (perm upgrade or ad)
  if (hasRevive) {
    hasRevive = false;
    player.hp = Math.round(player.maxHp * 0.3);
    player.invulnTimer = 2.0;
    particles.emit(player.x, player.y, 30, '#ffff00', 200, 0.8, 5);
    audio.levelUp();
    return;
  }

  audio.gameOver();
  camera.shake(15, 0.5);
  adWrapper.gameplayStop();

  goldEarned = endRun();

  menuUI.finalTime = gameTime;
  menuUI.finalKills = player.kills;
  menuUI.finalLevel = player.level;
  menuUI.finalGold = goldEarned;
  menuUI.currentScreen = 'gameover';
}

function endRun(): number {
  if (gameTime < 1) return 0;
  const gold = save.recordRun(gameTime, player.kills, player.level);
  return gold;
}

function checkEvolutions(): void {
  for (const evo of EVOLUTIONS) {
    const [reqA, reqB] = evo.requires;
    const levelA = player.upgrades.get(reqA) || 0;
    const levelB = player.upgrades.get(reqB) || 0;

    if (levelA >= evo.requireLevel && levelB >= evo.requireLevel) {
      if (!player.upgrades.has(evo.id)) {
        // Unlock evolution!
        player.upgrades.set(evo.id, 1);
        // Show notification
        damageNumbers.spawn(player.x, player.y - 30, 0, '#ffcc00');
        particles.emit(player.x, player.y, 20, '#ffcc00', 150, 0.8, 5);
        audio.levelUp();
        camera.shake(5, 0.2);
      }
    }
  }
}

function checkStageObjective(): void {
  if (currentStageIndex >= STAGES.length) return;
  const stage = STAGES[currentStageIndex];

  let complete = false;
  switch (stage.objective) {
    case 'survive':
      complete = gameTime >= stage.objectiveValue;
      break;
    case 'kill_count':
      complete = player.kills >= stage.objectiveValue;
      break;
    case 'kill_boss':
      complete = bossKilledThisRun;
      break;
  }

  if (complete && !stageComplete) {
    stageComplete = true;
    save.completeStage(stage.id);

    const gold = save.calculateGold(gameTime, player.kills, player.level) + stage.reward;
    save.data.gold += gold;
    save.save();

    menuUI.finalTime = gameTime;
    menuUI.finalKills = player.kills;
    menuUI.finalLevel = player.level;
    menuUI.finalGold = gold;
    menuUI.currentScreen = 'stage_complete' as any;
    paused = true;
  }
}

function handleZombieDeath(z: Zombie): void {
  if (z.hp > 0) return;

  player.kills++;
  weapons.loadout.addRageOnKill();

  if (z.isBoss) {
    bossKilledThisRun = true;
    camera.shake(8, 0.3);
    particles.emit(z.x, z.y, 16, '#ff44ff', 140, 0.6, 4);
  }

  // Elite and Boss zombies drop unowned weapons!
  if (z.isBoss || z.isElite) {
    if (!weapons.loadout.hasGun('sg12')) {
      mapPickups.spawnWeaponPickup(z.x, z.y, 'sg12');
    } else if (!weapons.loadout.hasGun('smg9')) {
      mapPickups.spawnWeaponPickup(z.x, z.y, 'smg9');
    }
  }

  if (player.lifestealAmount > 0) {
    player.heal(player.lifestealAmount);
  }

  xpGems.drop(z.x, z.y, z.xpValue);

  // Exploder death explosion
  if (z.explodes) {
    z.explodes = false; // Prevent any duplicate explosions
    handleExplosion(z.x, z.y, z.explosionRadius, z.explosionDamage);
  } else {
    // Normal / Elite zombie death
    particles.burst(z.x, z.y, z.isBoss ? 16 : 5, '#bb1122', Math.random() * Math.PI * 2, Math.PI * 2, 90, 0.25);
    particles.emit(z.x, z.y, 3, z.color, 60, 0.2, 2.5);
    const [zombieScreenX] = camera.worldToWindowScreen(z.x, z.y);
    const [playerScreenX] = camera.worldToWindowScreen(player.x, player.y);
    const pan = Math.max(-1, Math.min(1, (zombieScreenX - playerScreenX) / (window.innerWidth * 0.48)));
    audio.zombieDie(pan, z.typeId);
    camera.shake(z.isBoss ? 8 : z.isElite ? 1.8 : 0.6, z.isBoss ? 0.3 : 0.05);
  }

  zombies.pool.release(z);
}

function handleExplosion(x: number, y: number, radius: number, damage: number): void {
  audio.explosion();
  camera.shake(1.8, 0.09);
  particles.emit(x, y, 5, '#ff6600', 65, 0.22, 2.8);
  particles.emit(x, y, 3, '#ffcc00', 45, 0.18, 2.2);

  const nearby = zombieGrid.query(x, y, radius);
  const dyingZombies: Zombie[] = [];
  let numbersSpawned = 0;

  for (const z of nearby) {
    if (z.hp <= 0) continue;
    const dx = z.x - x;
    const dy = z.y - y;
    const distSq = dx * dx + dy * dy;
    if (distSq < radius * radius) {
      const dist = Math.sqrt(distSq);
      const falloff = 1 - dist / radius;
      const dmg = Math.round(damage * falloff);
      z.hp -= dmg;
      z.flashTimer = 0.08;

      if (numbersSpawned < 4) {
        damageNumbers.spawn(z.x, z.y, dmg, '#ff8844');
        numbersSpawned++;
      }

      if (dist > 0.1) {
        const expForce = (z.isBoss ? 45 : 180) * falloff;
        z.knockbackX = (dx / dist) * expForce;
        z.knockbackY = (dy / dist) * expForce;
      }
      if (z.hp <= 0) {
        dyingZombies.push(z);
      }
    }
  }

  for (const dz of dyingZombies) {
    if (dz.hp <= 0) {
      handleZombieDeath(dz);
    }
  }

  const pdx = player.x - x;
  const pdy = player.y - y;
  const pDist = Math.sqrt(pdx * pdx + pdy * pdy);
  if (pDist < radius) {
    const hit = player.takeDamage(Math.round(damage * 0.3 * (1 - pDist / radius)));
    if (hit.dead) {
      handlePlayerDeath();
    } else if (hit.damaged) {
      audio.playerHit();
      camera.shake(1.8, 0.09);
      damageNumbers.spawn(player.x, player.y, hit.actualDamage, '#ff3b30', false, '-');
      particles.emit(player.x, player.y, 3, '#ff4444', 60, 0.18, 2.5);
    }
  }
}

function drawGame(): void {
  ctx.fillStyle = '#08090e';
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);

  ctx.save();

  // Apply camera zoom centered at the viewport center
  if (camera.zoom !== 1) {
    const cx = viewportWidth / 2;
    const cy = viewportHeight / 2;
    ctx.translate(cx, cy);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-cx, -cy);
  }

  groundRenderer.draw(ctx, camera);
  drawMapBorder();

  propRenderer.draw(ctx, camera, 'ground', gameMode === 'endless');

  // Draw entities
  mapPickups.draw(ctx, camera);
  supplyCrates.draw(ctx, camera);
  xpGems.draw(ctx, camera);
  bullets.draw(ctx, camera);
  enemyProjectiles.draw(ctx, camera);
  drawPickupRadius();
  drawDrones();
  player.draw(ctx, camera);
  zombies.draw(ctx, camera);

  propRenderer.draw(ctx, camera, 'above', gameMode === 'endless');

  particles.draw(ctx, camera);
  damageNumbers.draw(ctx, camera);

  // Floating reload indicator in world coordinates
  weapons.loadout.drawInWorld(ctx, camera, player);

  ctx.restore();
  
  LightingRenderer.get().drawVignette(ctx);

  // HUD
  hud.draw(ctx, viewportWidth, viewportHeight, player, gameTime, input, zombies, mapPickups, camera);

  // Active buffs display
  drawActiveBuffs();

  // Stage mode objective display
  if (gameMode === 'stage' && currentStageIndex < STAGES.length) {
    drawStageObjective();
  }

  // ─── Tactical Gun Loadout Bottom HUD Card (Matches User Spec) ───
  if (menuUI.currentScreen === 'playing') {
    weapons.loadout.drawHUD(ctx, viewportWidth, viewportHeight, player);
    drawTouchActionButtons(ctx, viewportWidth, viewportHeight);
  }

  // ─── Custom Shooter Crosshair (Directional Arrow & Reticle) ───
  if (!paused && menuUI.currentScreen === 'playing') {
    canvas.style.cursor = 'none';

    // Target lock detection on hovering zombies in world coordinates
    let isTargetLocked = false;
    const [mouseWorldX, mouseWorldY] = camera.windowScreenToWorld(input.mouseX, input.mouseY);
    for (const z of zombies.pool.getActive()) {
      if (z.hp <= 0) continue;
      const distToCursor = Math.hypot(mouseWorldX - z.x, mouseWorldY - z.y);
      if (distToCursor < z.size + 24) {
        isTargetLocked = true;
        break;
      }
    }

    const [psx, psy] = camera.worldToWindowScreen(player.x, player.y);
    CrosshairRenderer.draw(ctx, input.mouseX, input.mouseY, psx, psy, input.isFiring, isTargetLocked);
  } else {
    canvas.style.cursor = 'default';
  }
}

function drawPickupRadius(): void {
  const [sx, sy] = camera.worldToScreen(player.x, player.y);
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.18)';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.arc(sx, sy, player.pickupRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawActiveBuffs(): void {
  if (player.buffs.size === 0) return;

  const x = viewportWidth - 12;
  let y = 125;

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = `11px 'Segoe UI', Arial, sans-serif`;

  for (const [key, buff] of player.buffs) {
    const barW = 60;
    const barH = 6;
    const progress = buff.duration / 15; // assume max 15s

    ctx.fillStyle = '#1a1a2e88';
    ctx.fillRect(x - barW - 5, y - 10, barW + 10, 20);

    // Progress bar
    ctx.fillStyle = '#44aaff';
    ctx.fillRect(x - barW, y - 2, barW * Math.min(1, progress), barH);

    // Label
    ctx.fillStyle = '#aaaacc';
    const label = key.replace('_', ' ').toUpperCase();
    ctx.fillText(label, x - 5, y - 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${Math.ceil(buff.duration)}s`, x - 5, y + 8);

    y += 25;
  }
}

function drawStageObjective(): void {
  if (currentStageIndex >= STAGES.length) return;
  const stage = STAGES[currentStageIndex];

  const x = viewportWidth / 2;
  const y = viewportHeight - 146; // Above tactical weapon card

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#1a1a2e88';
  ctx.fillRect(x - 120, y - 15, 240, 30);

  ctx.fillStyle = '#ffcc00';
  ctx.font = `bold 12px 'Segoe UI', Arial, sans-serif`;

  let objText = '';
  switch (stage.objective) {
    case 'survive': {
      const remaining = Math.max(0, stage.objectiveValue - gameTime);
      const m = Math.floor(remaining / 60);
      const s = Math.floor(remaining % 60);
      objText = `Survive: ${m}:${s.toString().padStart(2, '0')} remaining`;
      break;
    }
    case 'kill_count':
      objText = `Kill ${player.kills}/${stage.objectiveValue} zombies`;
      break;
    case 'kill_boss':
      objText = bossKilledThisRun ? '✓ Boss defeated!' : 'Defeat the boss!';
      break;
  }

  ctx.fillText(`Stage ${stage.id}: ${stage.name} — ${objText}`, x, y);
}

function drawMapBorder(): void {
  const { width, height, borderColor } = MAP_CONFIG;

  const [x1, y1] = camera.worldToScreen(0, 0);
  const [x2, y2] = camera.worldToScreen(width, height);

  // Outer glow zone
  ctx.shadowColor = borderColor;
  ctx.shadowBlur = 20;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 3;
  ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

  // Inner electric line
  ctx.shadowBlur = 8;
  ctx.strokeStyle = '#aaccff';
  ctx.lineWidth = 1;
  ctx.strokeRect(x1 + 4, y1 + 4, x2 - x1 - 8, y2 - y1 - 8);
  ctx.shadowBlur = 0;

  // Danger zone gradient on each edge (fades inward)
  const fadeW = 30;
  ctx.save();

  // Top edge fade
  const topGrad = ctx.createLinearGradient(0, y1, 0, y1 + fadeW);
  topGrad.addColorStop(0, 'rgba(50, 130, 255, 0.12)');
  topGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(x1, y1, x2 - x1, fadeW);

  // Bottom edge fade
  const botGrad = ctx.createLinearGradient(0, y2, 0, y2 - fadeW);
  botGrad.addColorStop(0, 'rgba(50, 130, 255, 0.12)');
  botGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = botGrad;
  ctx.fillRect(x1, y2 - fadeW, x2 - x1, fadeW);

  // Left edge fade
  const leftGrad = ctx.createLinearGradient(x1, 0, x1 + fadeW, 0);
  leftGrad.addColorStop(0, 'rgba(50, 130, 255, 0.12)');
  leftGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = leftGrad;
  ctx.fillRect(x1, y1, fadeW, y2 - y1);

  // Right edge fade
  const rightGrad = ctx.createLinearGradient(x2, 0, x2 - fadeW, 0);
  rightGrad.addColorStop(0, 'rgba(50, 130, 255, 0.12)');
  rightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = rightGrad;
  ctx.fillRect(x2 - fadeW, y1, fadeW, y2 - y1);

  ctx.restore();
}

function drawDrones(): void {
  const droneLevel = player.upgrades.get('drone') || 0;
  if (droneLevel === 0) return;

  for (let i = 0; i < droneLevel; i++) {
    const angle = (gameTime * 2) + (i / droneLevel) * Math.PI * 2;
    const dx = player.x + Math.cos(angle) * 60;
    const dy = player.y + Math.sin(angle) * 60;
    const [sx, sy] = camera.worldToScreen(dx, dy);

    ctx.fillStyle = '#88ffaa';
    ctx.shadowColor = '#88ffaa';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(sx, sy, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#88ffaa44';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const [px, py] = camera.worldToScreen(player.x, player.y);
    ctx.arc(px, py, 60, angle - 0.5, angle);
    ctx.stroke();

    ctx.shadowBlur = 0;
  }
}

function applyPermUpgrades(): void {
  // Apply permanent upgrades from meta shop
  for (const def of PERM_UPGRADES) {
    const level = save.getPermUpgradeLevel(def.id);
    if (level <= 0) continue;
    const val = def.values[level - 1];

    switch (def.id) {
      case 'perm_damage':
        player.bulletDamage = Math.round(PLAYER_DEFAULTS.bulletDamage * val);
        break;
      case 'perm_hp':
        player.maxHp = val;
        player.hp = player.maxHp;
        break;
      case 'perm_speed':
        player.moveSpeed = PLAYER_DEFAULTS.moveSpeed * val;
        break;
      case 'perm_pickup':
        player.pickupRadius = PLAYER_DEFAULTS.pickupRadius * val;
        break;
      case 'perm_fire_rate':
        player.fireRate = PLAYER_DEFAULTS.fireRate * val;
        break;
      case 'perm_revive':
        hasRevive = true;
        break;
    }
  }

  // Apply character bonuses
  const charId = save.data.selectedCharacter;
  const char = CHARACTERS.find(c => c.id === charId);
  if (char) {
    player.color = char.color;
    if (char.bonuses.damage) player.bulletDamage = Math.round(player.bulletDamage * char.bonuses.damage);
    if (char.bonuses.speed) player.moveSpeed *= char.bonuses.speed;
    if (char.bonuses.hp) {
      player.maxHp = Math.round(player.maxHp * char.bonuses.hp);
      player.hp = player.maxHp;
    }
    if (char.bonuses.fireRate) player.fireRate *= char.bonuses.fireRate;
    if (char.bonuses.pickupRadius) player.pickupRadius *= char.bonuses.pickupRadius;
  }
}

function startGame(): void {
  resetGame();
  player.loadout = weapons.loadout;
  audio.init();
  applyPermUpgrades();
  adWrapper.gameplayStart();
  menuUI.currentScreen = 'playing';
  paused = false;
  stageComplete = false;
  bossKilledThisRun = false;

  // Spawn initial discoverable weapon drop (SG-12) 220px from player!
  mapPickups.spawnWeaponPickup(player.x + 220, player.y + 45, 'sg12');
}

function resetGame(): void {
  player.reset();
  bullets.pool.releaseAll();
  zombies.pool.releaseAll();
  xpGems.pool.releaseAll();
  particles.pool.releaseAll();
  enemyProjectiles.pool.releaseAll();
  damageNumbers.clear();
  spawner.reset();
  weapons.reset();
  mapPickups.reset();
  supplyCrates.reset();
  upgradeUI.visible = false;
  gameTime = 0;
  paused = false;
  hasRevive = false;
  spitterGlobalCooldown = 0;
  bossAttackTimer = 3;
  bossAttackPhase = 0;
  goldEarned = 0;
}

// ─── Initialization ───
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// User gesture unlock for WebAudio
const unlockAudioContext = () => {
  audio.init();
  audio.ensureContext();
};
window.addEventListener('pointerdown', unlockAudioContext, { passive: true });
window.addEventListener('mousedown', unlockAudioContext, { passive: true });
window.addEventListener('keydown', unlockAudioContext, { passive: true });
window.addEventListener('touchstart', unlockAudioContext, { passive: true });

lastTimestamp = performance.now();
requestAnimationFrame(gameLoop);
