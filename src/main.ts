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
import { CampaignCredits } from './entities/campaign-credits';
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
import { UI_PALETTE } from './ui/palette';

import { MAP_CONFIG, PLAYER_DEFAULTS, WEAPON_PARTS } from './data/items';
import { PERM_UPGRADES, CHARACTERS, STAGES, type CampaignZone, type Point } from './data/meta';
import { EVOLUTIONS } from './data/upgrades';
import { getHorrorAttack, HORROR_TYPES, ZOMBIE_TYPES, type ZombieTypeDef } from './data/zombies';
import { horrorAttackHits } from './systems/horror-ai';
import { HorrorRemains } from './entities/horror-remains';
import { campaignSpawnPosition, isCampaignGateClosed, isCampaignWalkable, isInsideBuilding, nearestCampaignZone, resolveBuildingCollision, setCampaignGateState, setCampaignGeometry } from './entities/map-geometry';
import { CampaignMapRenderer } from './graphics/campaign-map-renderer';
import { CampaignTerrainRenderer } from './graphics/campaign-terrain';
import { CampaignBossDirector } from './systems/campaign-boss';
import { CampaignResources } from './systems/campaign-resources';
import { CampaignUI } from './ui/campaign-ui';
import { createCampaignGunDefs } from './systems/gun-loadout';

// Development encounters use an isolated, non-persistent save from the outset.
const horrorPreview = import.meta.env.DEV && new URLSearchParams(location.search).get('horror-preview') === '1';
const campaignGuns = createCampaignGunDefs();

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
  camera.zoom = gameMode === 'stage' && viewportWidth < 700 ? 0.95 : 1.42;
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
const campaignCredits = new CampaignCredits();
const particles = new ParticleSystem();
const damageNumbers = new DamageNumbers();
const enemyProjectiles = new EnemyProjectileSystem();
const mapPickups = new MapPickupSystem();
const supplyCrates = new SupplyCrateSystem();
const spawner = new Spawner();
const weapons = new WeaponSystem();
const zombieGrid = new SpatialGrid<Zombie>(64);
const save = new SaveSystem(!horrorPreview);
const horrorRemains = new HorrorRemains();
const groundRenderer = new GroundRenderer();
const propRenderer = new PropRenderer();
const campaignMapRenderer = new CampaignMapRenderer();
const campaignTerrainRenderer = new CampaignTerrainRenderer();
const campaignBossDirector = new CampaignBossDirector();
const campaignResources = new CampaignResources();

// ─── UI ───
const hud = new HUD();
const upgradeUI = new UpgradeUI();
const menuUI = new MenuUI();
const shopUI = new ShopUI();
const campaignUI = new CampaignUI();

// ─── Game State ───
let gameTime = 0;
let paused = false;
let lastTimestamp = 0;
let gameMode: 'endless' | 'stage' = 'endless';
let currentStageIndex = 0;
let stageComplete = false;
let bossKilledThisRun = false;
let bossWeaponDrop: (Point & { gunId: string }) | null = null;
let stageObjectiveIndex = 0;
let stageBossSpawned = false;
let stageObjectiveHoldTime = 0;
let stageObjectiveHoldStarted = false;
let stageObjectiveHp = 0;
let stageBossSummonsSpawned = 0;
let stageExitActive = false;
let stageExitActivated = false;
const campaignTriggeredZones = new Set<number>();
const campaignActiveWaveZones = new Set<number>();
interface CampaignWaveQueueEntry {
  zoneIndex: number;
  roster: ZombieTypeDef[];
  portalPoints: Point[];
  remaining: number;
  total: number;
  spawned: number;
  portalCursor: number;
  started: boolean;
  warningTimer: number;
  spawnTimer: number;
  groupSpawned: number;
  groupSize: number;
  countsForGate: boolean;
}
const campaignWaveQueue: CampaignWaveQueueEntry[] = [];
let campaignWaveAlertText = '';
let campaignWaveAlertTimer = 0;
let campaignEncounterTriggered = false;
let campaignHoldWaveTimer = 0;
let campaignBossWaveTimer = 0;
const CAMPAIGN_HORDE_MULTIPLIER = 10;
const CAMPAIGN_ACTIVE_ZOMBIE_LIMIT = 180;
const CAMPAIGN_WAVE_WARNING_SECONDS = 1.65;
const CAMPAIGN_WAVE_GROUP_BREAK = 1.6;
const CAMPAIGN_MIN_PORTAL_DISTANCE = 300;
const CAMPAIGN_PORTAL_SCATTER: ReadonlyArray<readonly [number, number]> = [
  [0,0],[-38,-20],[38,20],[-22,38],[22,-38],[-48,26],[48,-26],[0,48],
];
let lastCreditGain = 0;
let creditGainTimer = 0;
let campaignSupplyNotice = '';
let campaignSupplyNoticeTimer = 0;
let goldEarned = 0;
let hasRevive = false;     // from perm upgrade or ad
let previewEncounter = false;
let campaignWavePreview = false;
let previewCleanCapture = false;
const previewAudit = { hits: 0, attacks: 0, deaths: 0, drops: 0, phases: new Set<string>() };
type MusicThreat = 'calm' | 'combat' | 'boss';
let activeMusicThreat: MusicThreat = 'calm';
let hasSeenZombiesThisRun = false;

function syncMusicForThreat(): void {
  const menuScene = menuUI.currentScreen === 'main' || menuUI.currentScreen === 'campaign' || menuUI.currentScreen === 'hunter_profile' || menuUI.currentScreen === 'tutorial';
  if (menuScene) {
    activeMusicThreat = 'calm';
    hasSeenZombiesThisRun = false;
    audio.setMusicScene('menu');
    return;
  }
  const upgradeScene = menuUI.currentScreen === 'levelup' || upgradeUI.visible;
  if ((menuUI.currentScreen === 'paused' || paused) && !upgradeScene) {
    audio.setMusicScene('paused');
    return;
  }

  let bossAlive = false;
  for (const z of zombies.pool.getActive()) {
    if (z.hp <= 0) continue;
    // Once a run has had enemies, combat music stays latched through empty waves.
    hasSeenZombiesThisRun = true;
    // Boss music has priority for the entire boss encounter, including off-screen.
    if (z.isBoss) {
      bossAlive = true;
      break;
    }
  }

  if (bossAlive) hasSeenZombiesThisRun = true;
  // Music 1 is strictly pre-combat. Music 2 remains through quiet gaps and
  // completed waves; Music 3 temporarily overrides it while a boss is alive.
  activeMusicThreat = bossAlive ? 'boss' : hasSeenZombiesThisRun ? 'combat' : 'calm';

  audio.setMusicScene(activeMusicThreat);
}

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
  syncMusicForThreat();
  input.touchButtonsEnabled = menuUI.currentScreen === 'playing' && !paused && !shopUI.visible;
  input.campaignTouchEnabled = input.touchButtonsEnabled && gameMode === 'stage';

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
  menuUI.setPointer(input.mouseX, input.mouseY);
  if (menuUI.currentScreen === 'paused' && input.pausePressed) handleMenuAction('resume');

  const click = input.uiClick;

  if (click && menuUI.currentScreen === 'playing' && !paused) {
    if (weapons.loadout.handleClick(click.x, click.y, viewportWidth, viewportHeight, audio)) input.clearUiFire();
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
      if (menuUI.currentScreen === 'campaign') {
        const action = campaignUI.click(click.x, click.y, save);
        if (action === 'main') { menuUI.currentScreen = 'main'; gameMode = 'endless'; }
        else if (action === 'start' || action === 'retry') {
          gameMode = 'stage'; currentStageIndex = campaignUI.selectedStage; previewEncounter = false; startGame();
        }
        else if (action) audio.menuSelect();
      } else if (upgradeUI.visible) {
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
    if (menuUI.currentScreen === 'campaign') { campaignUI.draw(ctx, viewportWidth, viewportHeight, save); return; }
    if (menuUI.currentScreen === 'main' || menuUI.currentScreen === 'hunter_profile' || menuUI.currentScreen === 'tutorial') {
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
      previewEncounter = false;
      gameMode = 'endless';
      startGame();
      break;
    case 'start_stage':
      gameMode = 'stage';
      campaignUI.page = 'character';
      menuUI.currentScreen = 'campaign';
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
      if (gameMode === 'endless') endRun();
      resetGame();
      if (gameMode === 'stage' && !previewEncounter) { campaignUI.page = 'stages'; menuUI.currentScreen = 'campaign'; }
      else menuUI.currentScreen = 'main';
      break;
    case 'retry':
      previewEncounter = false;
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
        campaignUI.selectedStage = currentStageIndex;
        campaignUI.page = 'briefing';
        menuUI.currentScreen = 'campaign';
      } else {
        campaignUI.page = 'stages'; menuUI.currentScreen = 'campaign';
      }
      break;
  }
}

function updateGame(dt: number): void {
  gameTime += dt;
  if (gameMode === 'stage') setCampaignGateState(stageObjectiveIndex, stageBossSpawned, bossKilledThisRun, campaignActiveWaveZones);

  // ─── Stage mode: check completion ───
  if (gameMode === 'stage' && !stageComplete) {
    checkStageObjective();
  }

  // ─── Player Movement ───
  player.move(input.dirX, input.dirY, dt, true);
  player.update(dt);

  // Dash input
  if (input.dashPressed) {
    const dashX = gameMode === 'stage' && input.dirX === 0 && input.dirY === 0 ? Math.cos(player.moveAngle) : input.dirX;
    const dashY = gameMode === 'stage' && input.dirX === 0 && input.dirY === 0 ? Math.sin(player.moveAngle) : input.dirY;
    player.dash(dashX, dashY);
  }
  if (gameMode === 'stage') updateCampaignObjective(dt);

  // ─── Camera ───
  camera.follow(player.x, player.y, input.mouseX, input.mouseY, dt);

  // ─── Spawning ───
  const stage = gameMode === 'stage' ? STAGES[currentStageIndex] : undefined;
  if (stage && (!previewEncounter || campaignWavePreview)) updateCampaignWaves(stage, dt);
  const toSpawn = previewEncounter || stage ? [] : spawner.update(
    dt, gameTime, zombies.pool.activeCount, camera, player.x, player.y, true
  );
  for (const s of toSpawn) {
    const z = zombies.spawn(
      s.type, s.x, s.y,
      s.tier.hpMultiplier, s.tier.speedMultiplier, s.tier.damageMultiplier,
      s.isElite
    );
    if (gameMode === 'endless' && getHorrorAttack(z.typeId) || gameMode === 'stage') {
      [z.x, z.y] = resolveBuildingCollision(z.x, z.y, z.size);
    }

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
  bullets.update(dt, true);

  // ─── Zombies ───
  zombies.update(dt, player.x, player.y, true);
  if (stage) {
    const boss = zombies.pool.getActive().find((z) => z.campaignBossId === stage.id);
    const bossDamage = campaignBossDirector.update(dt, stage, boss, player.x, player.y, () => {
      const summonCap = stage.id === 1 ? 4 : stage.id === 10 ? 3 : 0;
      if (!summonCap || stageBossSummonsSpawned >= summonCap || !boss || zombies.pool.activeCount >= CAMPAIGN_ACTIVE_ZOMBIE_LIMIT) return;
      const summonIds = stage.id === 10 ? ['normal', 'runner', 'spitter'] : ['normal', 'normal', 'normal', 'normal'];
      for (let i = 0; i < 2 && stageBossSummonsSpawned < summonCap && zombies.pool.activeCount < CAMPAIGN_ACTIVE_ZOMBIE_LIMIT; i++) {
        const shambler = ZOMBIE_TYPES.find((entry) => entry.id === summonIds[stageBossSummonsSpawned % summonIds.length]);
        if (!shambler) continue;
        const angle = Math.PI * (.35 + i * .3);
        const z = zombies.spawn(shambler, boss.x + Math.cos(angle) * 105, boss.y + Math.sin(angle) * 105, 1, 1, 1);
        z.campaignZoneIndex = stage.layout?.zones.length ? stage.layout.zones.length - 1 : -1;
        z.hp = Math.round(z.hp * stage.difficultyMult); z.maxHp = z.hp;
        z.damage = Math.round(z.damage * stage.difficultyMult);
        [z.x, z.y] = resolveBuildingCollision(z.x, z.y, z.size);
        stageBossSummonsSpawned++;
      }
    }, (move, actor, angle) => {
      if (move.kind === 'fan') {
        const type = stage.id === 2 ? 'boss_acid' : 'boss_shard';
        const count = stage.id === 2 ? 7 : stage.id >= 7 ? 6 : 5;
        const spread = stage.id === 2 ? .78 : .56;
        const muzzle = actor.size * .72;
        enemyProjectiles.fireFan(actor.x + Math.cos(angle) * muzzle, actor.y + Math.sin(angle) * muzzle,
          angle, count, spread, stage.id === 2 ? 310 : 390, move.damage, type);
        camera.shake(stage.id === 2 ? 2.4 : 1.7, .12);
        particles.emit(actor.x + Math.cos(angle) * muzzle, actor.y + Math.sin(angle) * muzzle,
          stage.id === 2 ? 8 : 5, stage.id === 2 ? '#a7c568' : '#c8c5b7', 65, .24, 3);
      }
    });
    if (bossDamage > 0) {
      const hit = player.takeDamage(bossDamage);
      if (hit.dead) { handlePlayerDeath(); return; }
      if (hit.damaged) {
        audio.playerHit(); camera.shake(3.2, .16);
        damageNumbers.spawn(player.x, player.y, hit.actualDamage, UI_PALETTE.dangerBright, false, '-');
        particles.burst(player.x, player.y, 9, '#a9473d', Math.atan2(player.y - (boss?.y ?? player.y), player.x - (boss?.x ?? player.x)), 1.2, 105, .3);
      }
    }
  }
  if (horrorPreview) for (const z of zombies.pool.getActive()) previewAudit.phases.add(z.specialState);
  horrorRemains.update(dt);

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
    let campaignShots = 0;
    const campaignShotLimit = gameMode === 'stage' ? 5 : Infinity;
    for (const z of zombies.pool.getActive()) {
      // Campaign bosses use their own telegraphed attacks; the legacy ranged
      // loop must never add an unannounced projectile during their fight.
      if (!z.ranged || z.hp <= 0 || z.campaignBossId !== null) continue;
      const dx = player.x - z.x;
      const dy = player.y - z.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < z.attackRange && z.attackCooldown <= 0) {
        const angle = Math.atan2(dy, dx);
        enemyProjectiles.fire(z.x, z.y, angle, z.projectileSpeed, z.damage, 'poison');
        z.attackCooldown = 2.0;
        z.visualStrike = 0.35;
        campaignShots++;
        if (campaignShots >= campaignShotLimit) break;
      }
    }
  }

  // ─── Boss AI: special attacks ───
  if (gameMode === 'endless') {
    bossAttackTimer -= dt;
    if (bossAttackTimer <= 0) {
    bossAttackTimer = 3.0;
    bossAttackPhase++;
    for (const z of zombies.pool.getActive()) {
      if (!z.isBoss || z.hp <= 0) continue;

      // Alternate between attack patterns
      z.visualStrike = 0.4;
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
  }

  // ─── Enemy Projectiles ───
  enemyProjectiles.update(dt);

  // ─── Enemy projectile -> player collision ───
  enemyProjectiles.pool.forEach((p) => {
    if (gameMode === 'stage' && (!isCampaignWalkable(p.x, p.y, p.size * .6) || isInsideBuilding(p.x, p.y))) return true;
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
    if (gameMode === 'stage' && !stageBossSpawned &&
        (currentStageIndex === 9 || currentStageIndex === 8 && stageObjectiveIndex < 2)) {
      const node = STAGES[currentStageIndex].objectiveNodes[stageObjectiveIndex];
      if (node && Math.hypot(b.x - node.x, b.y - node.y) < 32) {
        stageObjectiveHp -= b.damage;
        particles.emit(node.x, node.y, 3, '#b45d4d', 55, .22, 2);
        if (stageObjectiveHp <= 0) {
          stageObjectiveIndex++;
          stageObjectiveHp = 150 + currentStageIndex * 12 + stageObjectiveIndex * 30;
          audio.levelUp();
          setCampaignGateState(stageObjectiveIndex, stageBossSpawned, bossKilledThisRun);
        }
        return true;
      }
    }
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
        if (horrorPreview) previewAudit.hits++;
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
        if (getHorrorAttack(z.typeId)) {
          audio.zombieHurt(Math.max(-1, Math.min(1, (z.x - player.x) / 420)), z.typeId, Math.hypot(z.x - player.x, z.y - player.y));
          particles.burst(z.x, z.y, 3, '#973b36', Math.atan2(-dy, -dx), 0.7, 70, 0.25);
        }

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
  const livingZombies = zombies.pool.getActive();
  for (let i = livingZombies.length - 1; i >= 0; i--) {
    const z = livingZombies[i];
    if (z && z.hp <= 0) {
      handleZombieDeath(z);
    }
  }

  // Special enemies deal damage only in the committed active phase, once per attack.
  for (const z of zombies.pool.getActive()) {
    if (z.campaignBossId !== null || z.hp <= 0 || !getHorrorAttack(z.typeId)) continue;
    const distance = Math.hypot(player.x - z.x, player.y - z.y);
    const pan = Math.max(-1, Math.min(1, (z.x - player.x) / 420));
    if (z.specialStarted) {
      audio.zombieAttack(pan, z.typeId, distance);
      if (horrorPreview) previewAudit.attacks++;
    }
    if (!horrorAttackHits(z, player.x, player.y, player.size, true)) continue;
    z.specialHit = true;
    const hit = player.takeDamage(z.damage);
    if (hit.damaged) {
      audio.playerHit();
      camera.shake(z.typeId === 'mutant' ? 2.8 : 2.1, 0.12);
      damageNumbers.spawn(player.x, player.y, hit.actualDamage, UI_PALETTE.dangerBright, false, '-');
      particles.burst(player.x, player.y, 5, '#a93e38', z.specialAngle, 1.1, 80, 0.28);
    }
    if (hit.dead) { handlePlayerDeath(); return; }
  }

  // ─── Zombie-Player Collisions ───
  const nearPlayer = zombieGrid.query(player.x, player.y, player.size + 50);
  for (const z of nearPlayer) {
    if (z.hp <= 0) continue;
    // Campaign bosses only hurt the player through their telegraphed move hitboxes.
    // Don't let the generic overlap timer deal invisible contact damage.
    if (z.campaignBossId !== null) continue;
    if (getHorrorAttack(z.typeId) && z.campaignBossId === null) continue;
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
        z.visualStrike = 0.3;
        const hit = player.takeDamage(z.damage);
        if (hit.dead) {
          handlePlayerDeath();
          return;
        }
        if (hit.damaged) {
          z.attackCooldown = 0.5;
          const [zombieScreenX] = camera.worldToWindowScreen(z.x, z.y);
          const [playerScreenX] = camera.worldToWindowScreen(player.x, player.y);
          const pan = Math.max(-1, Math.min(1, (zombieScreenX - playerScreenX) / (window.innerWidth * 0.48)));
          audio.zombieAttack(pan, z.typeId);
          audio.playerHit();
          camera.shake(2.1, 0.12);
          damageNumbers.spawn(player.x, player.y, hit.actualDamage, '#ff3b30', false, '-');
          particles.emit(player.x, player.y, 3, '#ff3b30', 60, 0.18, 2.5);
        }
      }
    }
  }

  // ─── XP Gems ───
  const collected = gameMode === 'endless' ? xpGems.update(dt, player.x, player.y, player.pickupRadius) : [];
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

  if (gameMode === 'stage') {
    const supplies = campaignResources.collectNearby(player, weapons.loadout);
    if (supplies.length) {
      const last = supplies[supplies.length - 1];
      campaignSupplyNotice = supplies.length > 1 ? `${last.label} · +${supplies.length - 1} HỘP` : last.label;
      campaignSupplyNoticeTimer = 2.2;
      for (const supply of supplies) particles.emit(supply.x, supply.y, 6,
        supply.kind === 'med' ? '#9ed4a6' : supply.kind === 'ammo' ? '#e9c47b' : '#9ac8c7', 50, .3, 2);
      audio.supplyPickup(last.kind);
    }
    campaignSupplyNoticeTimer = Math.max(0, campaignSupplyNoticeTimer - dt);
    const credits = campaignCredits.update(dt, player.x, player.y, player.pickupRadius);
    if (credits > 0) {
      if (!previewEncounter) save.collectCampaignCredits(credits);
      lastCreditGain = credits;
      creditGainTimer = 1.8;
      audio.creditPickup();
    }
    creditGainTimer = Math.max(0, creditGainTimer - dt);
  }

  // ─── Supply Crates ───
  if (gameMode === 'endless') supplyCrates.update(dt, gameTime, player.x, player.y);

  // ─── Map Pickups ───
  const pickedUp = mapPickups.update(dt, gameTime, player.x, player.y, gameMode === 'endless',
    item => !item.itemId.startsWith('ammo_') || weapons.loadout.canAddCampaignAmmoForGun(item.itemId.slice(5)));
  for (const item of pickedUp) {
    handlePickup(item.itemId, item.value, item.duration);
  }

  // ─── Particles ───
  particles.update(dt);
  damageNumbers.update(dt);
}

function handlePickup(itemId: string, value: number, duration: number): void {
  if (gameMode === 'stage' && itemId.startsWith('ammo_')) {
    const gunId = itemId.slice(5);
    const added = weapons.loadout.addCampaignAmmoForGun(gunId, value);
    if (added > 0) {
      audio.supplyPickup('ammo');
      campaignSupplyNotice = `ĐẠN ${campaignGuns.find(gun => gun.id === gunId)?.shortName ?? gunId.toUpperCase()} +${added}`;
      campaignSupplyNoticeTimer = 1.8;
      particles.emit(player.x, player.y, 5, '#d5b477', 45, .25, 2);
    }
    return;
  }
  if (gameMode === 'stage' && itemId.startsWith('gun_')) {
    const gunId = itemId.slice(4);
    if (weapons.loadout.collectCampaignGun(gunId, audio)) {
      const owned = save.data.campaign.ownedGuns;
      if (!owned.includes(gunId)) owned.push(gunId);
      save.data.campaign.equippedGun = gunId;
      save.save();
      bossWeaponDrop = null;
      campaignSupplyNotice = `ĐÃ NHẶT ${campaignGuns.find(gun => gun.id === gunId)?.shortName ?? gunId.toUpperCase()} · CÓ THỂ ĐỔI BẰNG PHÍM SỐ`;
      campaignSupplyNoticeTimer = 3.5;
      particles.emit(player.x, player.y, 24, '#d6b375', 100, .6, 4);
      audio.levelUp();
    }
    return;
  }
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
          if (upgradeUI.cards.length > 0 && gameMode === 'endless') {
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

  if (gameMode === 'stage') {
    campaignUI.selectedStage = currentStageIndex;
    campaignUI.result = { time: gameTime, kills: player.kills, reward: 0, newStage: 0, optional: campaignResources.used };
    campaignUI.page = 'failure';
    menuUI.currentScreen = 'campaign';
    paused = true;
    return;
  }

  goldEarned = endRun();

  menuUI.finalTime = gameTime;
  menuUI.finalKills = player.kills;
  menuUI.finalLevel = player.level;
  menuUI.finalGold = goldEarned;
  menuUI.currentScreen = 'gameover';
}

function endRun(): number {
  if (gameMode !== 'endless') return 0;
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

function updateCampaignWaves(stage: typeof STAGES[number], dt: number): void {
  const layout = stage.layout;
  if (!layout) return;
  campaignWaveAlertTimer = Math.max(0, campaignWaveAlertTimer - dt);
  updateCampaignSpawnQueue(stage, dt);
  updateCampaignWaveClears(stage);

  if (stageBossSpawned) {
    if (bossKilledThisRun) return;
    const bossZoneIndex = layout.zones.length - 1;
    const bossWaveQueued = campaignWaveQueue.some(wave => wave.zoneIndex === bossZoneIndex);
    if (!bossWaveQueued && zombies.pool.activeCount < CAMPAIGN_ACTIVE_ZOMBIE_LIMIT) campaignBossWaveTimer -= dt;
    if (campaignBossWaveTimer <= 0 && !bossWaveQueued) {
      campaignBossWaveTimer = Math.max(5.5, 8 - stage.id * .22);
      // Boss support arrives through warned arena entrances and obeys the cap.
      spawnCampaignZoneWave(stage, layout.zones.length - 1, 1, true);
    }
    return;
  }
  const zoneIndex = layout.zones.findIndex(z => player.x >= z.x && player.x <= z.x + z.w && player.y >= z.y && player.y <= z.y + z.h);
  if (zoneIndex < 0) return;
  const zone = layout.zones[zoneIndex];
  if (zone.waveTrigger && !campaignTriggeredZones.has(zoneIndex)) {
    if (spawnCampaignZoneWave(stage, zoneIndex, zone.waveSize)) {
      campaignTriggeredZones.add(zoneIndex);
      campaignEncounterTriggered = true;
    }
  }
  if (zone.role === 'hold' && stage.objectiveHoldAt === stageObjectiveIndex) {
    if (!isCampaignWaveBusy(zoneIndex)) campaignHoldWaveTimer -= dt;
    if (campaignHoldWaveTimer <= 0 && !isCampaignWaveBusy(zoneIndex)) {
      campaignHoldWaveTimer = 4.25;
      spawnCampaignZoneWave(stage, zoneIndex, 2);
    }
  }
}

function spawnCampaignZoneWave(stage: typeof STAGES[number], zoneIndex: number, count: number, useStageRoster = false): boolean {
  const zone = stage.layout?.zones[zoneIndex];
  if (!zone || count <= 0) return false;
  const allowedIds = useStageRoster || zone.mobs.length === 0 ? stage.mobIds : zone.mobs;
  const roster = [...ZOMBIE_TYPES, ...HORROR_TYPES].filter(type => allowedIds.includes(type.id) && stage.mobIds.includes(type.id) && !type.isBoss);
  if (!roster.length) return false;
  const portalPoints = chooseCampaignPortalPoints(stage, zone, 4);
  if (!portalPoints.length) return false;
  const total = count * CAMPAIGN_HORDE_MULTIPLIER;
  campaignWaveQueue.push({ zoneIndex, roster, portalPoints, remaining: total, total, spawned: 0, portalCursor: 0,
    started: false, warningTimer: 0, spawnTimer: 0, groupSpawned: 0,
    groupSize: Math.max(5, Math.min(10, 5 + Math.floor(stage.id / 2))), countsForGate: !useStageRoster && zone.waveTrigger });
  if (!useStageRoster && zone.waveTrigger) campaignActiveWaveZones.add(zoneIndex);
  return true;
}

function isCampaignWaveBusy(zoneIndex: number): boolean {
  return campaignWaveQueue.some(wave => wave.zoneIndex === zoneIndex) ||
    zombies.pool.getActive().some(z => z.hp > 0 && z.campaignZoneIndex === zoneIndex);
}

function campaignPointInsideBuildingFootprint(stage: typeof STAGES[number], x: number, y: number, radius: number): boolean {
  return stage.buildings.some(building => Math.abs(x - building.x) < building.halfWidth + radius &&
    Math.abs(y - building.y) < building.halfHeight + radius);
}

function isCampaignPortalPointValid(stage: typeof STAGES[number], zone: CampaignZone, x: number, y: number, radius: number): boolean {
  if (x < zone.x || x > zone.x + zone.w || y < zone.y || y > zone.y + zone.h) return false;
  if (!isCampaignWalkable(x, y, radius) || isInsideBuilding(x, y) || campaignPointInsideBuildingFootprint(stage, x, y, radius)) return false;
  if (stage.layout?.decorations.some(prop => prop.solid && x + radius > prop.x && x - radius < prop.x + prop.w &&
      y + radius > prop.y && y - radius < prop.y + prop.h)) return false;
  return true;
}

function chooseCampaignPortalPoints(stage: typeof STAGES[number], zone: CampaignZone, maxPoints: number): Point[] {
  const candidates = zone.spawnPoints.filter(point => isCampaignPortalPointValid(stage, zone, point.x, point.y, 44) &&
    Math.hypot(point.x - player.x, point.y - player.y) >= Math.max(CAMPAIGN_MIN_PORTAL_DISTANCE, player.size + 120));
  // Prefer points on different sides of the room, with the farthest portal first.
  candidates.sort((a, b) => Math.hypot(b.x - player.x, b.y - player.y) - Math.hypot(a.x - player.x, a.y - player.y));
  const chosen: Point[] = [];
  while (candidates.length && chosen.length < maxPoints) {
    let bestIndex = 0, bestScore = -Infinity;
    for (let i = 0; i < candidates.length; i++) {
      const point = candidates[i];
      const separation = chosen.length ? Math.min(...chosen.map(other => Math.hypot(point.x - other.x, point.y - other.y))) : 0;
      const distance = Math.hypot(point.x - player.x, point.y - player.y);
      const score = chosen.length ? separation + distance * .18 : distance;
      if (score > bestScore) { bestScore = score; bestIndex = i; }
    }
    chosen.push(candidates.splice(bestIndex, 1)[0]);
  }
  return chosen;
}

function spawnCampaignZombie(stage: typeof STAGES[number], wave: CampaignWaveQueueEntry, type: ZombieTypeDef): boolean {
  if (zombies.pool.activeCount >= CAMPAIGN_ACTIVE_ZOMBIE_LIMIT || !wave.portalPoints.length) return false;
  const zone = stage.layout?.zones[wave.zoneIndex];
  if (!zone) return false;
  const minDistance = Math.max(CAMPAIGN_MIN_PORTAL_DISTANCE, player.size + 120);
  for (let portalAttempt = 0; portalAttempt < wave.portalPoints.length; portalAttempt++) {
    const portalIndex = (wave.portalCursor + portalAttempt) % wave.portalPoints.length;
    const portal = wave.portalPoints[portalIndex];
    if (!isCampaignPortalPointValid(stage, zone, portal.x, portal.y, type.size * .7) ||
        Math.hypot(portal.x - player.x, portal.y - player.y) < minDistance) continue;
    const offsetStart = (wave.spawned * 3) % CAMPAIGN_PORTAL_SCATTER.length;
    for (let offsetAttempt = 0; offsetAttempt < CAMPAIGN_PORTAL_SCATTER.length; offsetAttempt++) {
      const [ox, oy] = CAMPAIGN_PORTAL_SCATTER[(offsetStart + offsetAttempt) % CAMPAIGN_PORTAL_SCATTER.length];
      const x = portal.x + ox, y = portal.y + oy;
      if (!isCampaignPortalPointValid(stage, zone, x, y, type.size * .7) || Math.hypot(x - player.x, y - player.y) < minDistance) continue;
      const overlaps = zombies.pool.getActive().some(z => z.hp > 0 && Math.hypot(x - z.x, y - z.y) < (type.size + z.size) * .48);
      if (overlaps) continue;
      const mob = zombies.spawn(type, x, y, 1, 1, 1);
      mob.campaignZoneIndex = wave.zoneIndex;
      mob.hp = Math.round(mob.hp * stage.difficultyMult);
      mob.maxHp = mob.hp;
      mob.damage = Math.round(mob.damage * stage.difficultyMult);
      mob.speed *= 1.12;
      wave.portalCursor = (portalIndex + 1) % wave.portalPoints.length;
      return true;
    }
  }
  return false;
}

function updateCampaignSpawnQueue(stage: typeof STAGES[number], dt: number): void {
  const wave = campaignWaveQueue[0];
  if (!wave) return;
  if (!wave.started) {
    if (zombies.pool.activeCount >= CAMPAIGN_ACTIVE_ZOMBIE_LIMIT) return;
    wave.started = true;
    wave.warningTimer = CAMPAIGN_WAVE_WARNING_SECONDS;
    wave.spawnTimer = 0;
    campaignWaveAlertText = `CỬA VÀO KHU ${wave.zoneIndex + 1} ĐANG MỞ`;
    campaignWaveAlertTimer = 3.2;
    return;
  }
  if (wave.warningTimer > 0) {
    wave.warningTimer = Math.max(0, wave.warningTimer - dt);
    return;
  }
  wave.spawnTimer -= dt;
  if (wave.spawnTimer > 0 || zombies.pool.activeCount >= CAMPAIGN_ACTIVE_ZOMBIE_LIMIT) return;
  const spawnRate = 2.5 + (stage.id - 1) * .42;
  const type = wave.roster[wave.spawned % wave.roster.length];
  if (!spawnCampaignZombie(stage, wave, type)) {
    wave.spawnTimer = .25;
    return;
  }
  wave.spawned++;
  wave.remaining--;
  wave.groupSpawned++;
  wave.spawnTimer = wave.groupSpawned >= wave.groupSize && wave.remaining > 0
    ? CAMPAIGN_WAVE_GROUP_BREAK : 1 / spawnRate;
  if (wave.groupSpawned >= wave.groupSize) wave.groupSpawned = 0;
  if (wave.remaining <= 0) campaignWaveQueue.shift();
}

function updateCampaignWaveClears(stage: typeof STAGES[number]): void {
  for (const zoneIndex of campaignActiveWaveZones) {
    if (campaignWaveQueue.some(wave => wave.zoneIndex === zoneIndex)) continue;
    if (zombies.pool.getActive().some(z => z.hp > 0 && z.campaignZoneIndex === zoneIndex)) continue;
    campaignActiveWaveZones.delete(zoneIndex);
    campaignWaveAlertText = `KHU ${zoneIndex + 1} ĐÃ SẠCH · LỐI ĐI ĐÃ MỞ`;
    campaignWaveAlertTimer = 3.2;
    if (stage.layout?.zones[zoneIndex].role === 'hold') campaignHoldWaveTimer = 4.25;
  }
}

function updateCampaignObjective(dt: number): void {
  const stage = STAGES[currentStageIndex];
  const pressed = input.interactPressed;
  if (!stage) return;
  if (stage.exitSpawn && bossKilledThisRun && !stageExitActivated) {
    stageExitActive = true;
    if (bossWeaponDrop) return;
    if (pressed && Math.hypot(player.x - stage.exitSpawn.x, player.y - stage.exitSpawn.y) <= 88) {
      stageExitActivated = true; audio.levelUp();
      particles.emit(stage.exitSpawn.x, stage.exitSpawn.y, 22, '#8eafa0', 100, .7, 3);
    }
    return;
  }
  if (stageBossSpawned) return;
  if (stageObjectiveIndex >= stage.objectiveNodes.length) {
    const arena = stage.layout?.zones.at(-1);
    if (arena && player.x >= arena.x && player.x <= arena.x + arena.w && player.y >= arena.y && player.y <= arena.y + arena.h) spawnCampaignBoss(stage);
    return;
  }
  const node = stage.objectiveNodes[stageObjectiveIndex];
  if (stage.id === 10 || stage.id === 9 && stageObjectiveIndex < 2) return;
  if (stage.objectiveHoldAt === stageObjectiveIndex) {
    const near = Math.hypot(player.x - node.x, player.y - node.y) <= 110;
    if (stage.id === 9 && !stageObjectiveHoldStarted && pressed && near) {
      stageObjectiveHoldStarted = true;
      particles.emit(node.x, node.y, 18, '#a4554a', 95, .65, 4);
      audio.levelUp();
    }
    if (near && (stage.id !== 9 || stageObjectiveHoldStarted)) stageObjectiveHoldTime += dt;
    else stageObjectiveHoldTime = 0;
    if (stageObjectiveHoldTime >= (stage.objectiveHoldSeconds ?? 15)) {
      stageObjectiveIndex++; stageObjectiveHoldTime = 0; audio.levelUp();
      setCampaignGateState(stageObjectiveIndex, stageBossSpawned, bossKilledThisRun);
    }
    return;
  }
  if (pressed && Math.hypot(player.x - node.x, player.y - node.y) <= 82) {
    stageObjectiveIndex++;
    audio.levelUp();
    particles.emit(node.x, node.y, 14, '#d8ad65', 90, .55, 3);
    setCampaignGateState(stageObjectiveIndex, stageBossSpawned, bossKilledThisRun);
  }
}

function spawnCampaignBoss(stage: typeof STAGES[number]): void {
  if (stageBossSpawned) return;
  stageBossSpawned = true;
  campaignBossWaveTimer = 6;
  setCampaignGateState(stageObjectiveIndex, true, false);
  const type = [...ZOMBIE_TYPES, ...HORROR_TYPES].find((entry) => entry.id === stage.bossTypeId) ?? ZOMBIE_TYPES.find((entry) => entry.id === 'boss_1')!;
  const boss = zombies.spawn(type, stage.bossSpawn.x, stage.bossSpawn.y, 1, 1, 1);
  [boss.x, boss.y] = resolveBuildingCollision(boss.x, boss.y, 88);
  boss.campaignBossId = stage.id;
  boss.isBoss = true;
  boss.typeId = stage.bossTypeId;
  boss.size = stage.id === 9 ? 88 : stage.id === 10 ? 82 : 55 + Math.min(18, stage.id * 1.8);
  boss.hp = stage.bossHp; boss.maxHp = stage.bossHp;
  boss.damage = 20 + stage.id * 2;
  boss.speed = 32;
  boss.xpValue = 80 + stage.id * 15;
  campaignBossDirector.reset();
  camera.shake(7, .35);
  particles.emit(boss.x, boss.y, 38, '#a9473d', 145, .9, 6);
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
      if (bossKilledThisRun) stageExitActive = true;
      complete = stageExitActivated;
      break;
  }

  if (complete && !stageComplete) {
    stageComplete = true;
    const gold = save.completeCampaignStage(stage.id, stage.reward, player.kills, campaignResources.used);

    menuUI.finalTime = gameTime;
    menuUI.finalKills = player.kills;
    menuUI.finalLevel = player.level;
    menuUI.finalGold = gold;
    campaignUI.selectedStage = currentStageIndex;
    campaignUI.result = { time: gameTime, kills: player.kills, reward: gold,
      newStage: gold > 0 && stage.id < STAGES.length ? stage.id + 1 : 0, optional: campaignResources.used };
    campaignUI.page = 'result';
    menuUI.currentScreen = 'campaign';
    paused = true;
  }
}

function handleZombieDeath(z: Zombie): void {
  if (z.hp > 0 || z.deathHandled) return;
  z.deathHandled = true;
  if (gameMode === 'endless') horrorRemains.add(z);

  player.kills++;
  weapons.loadout.addRageOnKill();

  if (z.isBoss) {
    bossKilledThisRun = true;
    camera.shake(8, 0.3);
    particles.emit(z.x, z.y, 16, '#ff44ff', 140, 0.6, 4);
    if (gameMode === 'stage' && z.campaignBossId !== null) {
      const reward = campaignGuns.find(gun => gun.unlockStage === z.campaignBossId! + 1);
      if (reward && !save.data.campaign.ownedGuns.includes(reward.id)) {
        const [dropX, dropY] = campaignSpawnPosition(z.x, z.y, z.x + 82, z.y + 24, 26);
        bossWeaponDrop = { x: dropX, y: dropY, gunId: reward.id };
        mapPickups.spawnWeaponPickup(dropX, dropY, reward.id, true);
      }
    }
  }

  // Elite and Boss zombies drop unowned weapons!
  if (gameMode === 'endless' && (z.isBoss || z.isElite)) {
    if (!weapons.loadout.hasGun('sg12')) {
      mapPickups.spawnWeaponPickup(z.x, z.y, 'sg12');
    } else if (!weapons.loadout.hasGun('smg9')) {
      mapPickups.spawnWeaponPickup(z.x, z.y, 'smg9');
    }
  }

  if (player.lifestealAmount > 0) {
    player.heal(player.lifestealAmount);
  }

  if (gameMode === 'stage') {
    const threat = z.campaignBossId !== null ? 100 + currentStageIndex * 25
      : z.isElite ? 15 : ['rat_king', 'mutant', 'multihead', 'tank'].includes(z.typeId) ? 8
      : ['runner', 'spider', 'spitter', 'armed', 'exploder'].includes(z.typeId) ? 4 : 2;
    campaignCredits.drop(z.x, z.y, threat);
    if (z.campaignBossId === null && Math.random() < (z.isElite ? .16 : .065)
      && mapPickups.pool.getActive().filter(item => item.itemId.startsWith('ammo_')).length < 24) {
      const candidates = weapons.loadout.unlockedSlots.filter(slot =>
        weapons.loadout.canAddCampaignAmmoForGun(slot.def.id));
      const chapterGun = campaignGuns.find(gun => gun.unlockStage === currentStageIndex + 1)?.id;
      const totalWeight = candidates.reduce((sum, slot) => sum + (slot.def.id === chapterGun ? 6 : slot === weapons.loadout.activeSlot ? 2 : 1), 0);
      let choice = Math.random() * totalWeight;
      for (const slot of candidates) {
        choice -= slot.def.id === chapterGun ? 6 : slot === weapons.loadout.activeSlot ? 2 : 1;
        if (choice > 0) continue;
        mapPickups.spawnAmmoPickup(z.x, z.y, slot.def.id, slot.def.magSize * (z.isElite ? 2 : 1));
        break;
      }
    }
  } else xpGems.drop(z.x, z.y, z.xpValue);
  if (horrorPreview) { previewAudit.deaths++; previewAudit.drops += z.xpValue; }

  const [zombieScreenX] = camera.worldToWindowScreen(z.x, z.y);
  const [playerScreenX] = camera.worldToWindowScreen(player.x, player.y);
  const pan = Math.max(-1, Math.min(1, (zombieScreenX - playerScreenX) / (window.innerWidth * 0.48)));
  audio.zombieDie(pan, z.typeId, Math.hypot(z.x - player.x, z.y - player.y));

  // Exploder death explosion
  if (z.explodes) {
    z.explodes = false; // Prevent any duplicate explosions
    handleExplosion(z.x, z.y, z.explosionRadius, z.explosionDamage);
  } else {
    // Normal / Elite zombie death
    particles.burst(z.x, z.y, z.isBoss ? 16 : 5, '#bb1122', Math.random() * Math.PI * 2, Math.PI * 2, 90, 0.25);
    particles.emit(z.x, z.y, 3, z.color, 60, 0.2, 2.5);
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

  const campaignStage = gameMode === 'stage' ? STAGES[currentStageIndex] : undefined;
  if (campaignStage) {
    campaignTerrainRenderer.draw(ctx, camera, campaignStage, stageObjectiveIndex, player.x, player.y, gameTime);
    weapons.loadout.casings.draw(ctx, camera);
    const spawnCue = campaignWaveQueue[0]?.started ? campaignWaveQueue[0] : undefined;
    campaignMapRenderer.draw(ctx, camera, campaignStage, stageObjectiveIndex, stageBossSpawned, stageExitActive, stageExitActivated, stageObjectiveHp, spawnCue);
    campaignResources.draw(ctx, camera);
  } else {
    groundRenderer.draw(ctx, camera);
    drawMapBorder();
    weapons.loadout.casings.draw(ctx, camera);
    propRenderer.draw(ctx, camera, 'ground', true);
  }

  if (gameMode === 'endless') {
    horrorRemains.draw(ctx, camera);
  }
  zombies.drawWarnings(ctx, camera);
  if (campaignStage) campaignBossDirector.draw(ctx, camera, zombies.pool.getActive().find((z) => z.campaignBossId === campaignStage.id));

  // Draw entities
  mapPickups.draw(ctx, camera);
  supplyCrates.draw(ctx, camera);
  if (campaignStage) campaignCredits.draw(ctx, camera);
  else xpGems.draw(ctx, camera);
  bullets.draw(ctx, camera);
  enemyProjectiles.draw(ctx, camera);
  drawPickupRadius();
  drawDrones();
  player.draw(ctx, camera, !!campaignStage);
  if (gameMode === 'endless') {
    for (const z of zombies.pool.getActive()) {
      if (z.isBoss) z.visualWindup = Math.max(0, Math.min(1, 1 - bossAttackTimer / 0.8));
      else if (z.ranged) z.visualWindup = Math.hypot(z.x - player.x, z.y - player.y) < z.attackRange
        ? Math.max(0, Math.min(1, 1 - Math.max(z.attackCooldown, spitterGlobalCooldown) / 0.7)) : 0;
    }
  }
  // Both modes share the current body-horror creature art. Campaign bosses
  // retain their dedicated renderer inside ZombieSystem.draw.
  zombies.draw(ctx, camera, true);

  if (!campaignStage) propRenderer.draw(ctx, camera, 'above', true);

  particles.draw(ctx, camera);
  damageNumbers.draw(ctx, camera);

  // Floating reload indicator in world coordinates
  weapons.loadout.drawInWorld(ctx, camera, player);

  ctx.restore();
  
  LightingRenderer.get().drawVignette(ctx, campaignStage ? .25 : 1);

  if (previewCleanCapture) return;

  // HUD
  hud.draw(ctx, viewportWidth, viewportHeight, player, gameTime, input, zombies, mapPickups, camera,
    campaignStage ? { stage: campaignStage, activeNode: stageObjectiveIndex, bossSpawned: stageBossSpawned, exitActive: stageExitActive, exitActivated: stageExitActivated,
      credits: save.data.campaign.credits, creditGain: creditGainTimer > 0 ? lastCreditGain : 0 } : undefined);

  // Active buffs display
  drawActiveBuffs();

  // Stage mode objective display
  if (gameMode === 'stage' && currentStageIndex < STAGES.length) {
    drawStageObjective();
  }

  // ─── Tactical Gun Loadout Bottom HUD Card (Matches User Spec) ───
  if (menuUI.currentScreen === 'playing') {
    weapons.loadout.drawHUD(ctx, viewportWidth, viewportHeight, player);
    drawTouchActionButtons(ctx, viewportWidth, viewportHeight, gameMode === 'stage');
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
  hud.drawDamageFeedback(ctx, viewportWidth, viewportHeight, player.hp / player.maxHp, player.flashTimer);
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
  let y = gameMode === 'stage' && viewportWidth >= 700 && viewportWidth < 1050 ? 180 : 125;

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = `11px 'Segoe UI', Arial, sans-serif`;

  for (const [key, buff] of player.buffs) {
    const barW = 60;
    const barH = 6;
    const progress = buff.duration / 15; // assume max 15s

    ctx.fillStyle = 'rgba(27, 36, 41, 0.86)';
    ctx.fillRect(x - barW - 5, y - 10, barW + 10, 20);

    // Progress bar
    const buffColor = key === 'speed_boost'
      ? UI_PALETTE.health
      : key === 'double_xp'
        ? UI_PALETTE.amber
        : UI_PALETTE.cyan;
    ctx.fillStyle = buffColor;
    ctx.fillRect(x - barW, y - 2, barW * Math.min(1, progress), barH);

    // Label
    ctx.fillStyle = UI_PALETTE.textSoft;
    const label = key.replace('_', ' ').toUpperCase();
    ctx.fillText(label, x - 5, y - 3);
    ctx.fillStyle = UI_PALETTE.text;
    ctx.fillText(`${Math.ceil(buff.duration)}s`, x - 5, y + 8);

    y += 25;
  }
}

function drawStageObjective(): void {
  if (currentStageIndex >= STAGES.length) return;
  const stage = STAGES[currentStageIndex];

  const panelW = Math.min(330, Math.max(210, viewportWidth * .52));
  const x = viewportWidth - panelW / 2 - 12;
  const y = viewportWidth >= 700 && viewportWidth < 1050 ? 117 : 70;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(13,17,19,.9)'; ctx.strokeStyle = stageBossSpawned ? '#a9473d' : '#a9966d'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.roundRect(x - panelW / 2, y - 29, panelW, 64, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#d4c7a2'; ctx.font = `bold 10px 'Segoe UI', Arial, sans-serif`;
  const currentZoneIndex = nearestCampaignZone(player.x, player.y);
  const zoneName = stage.layout?.zones[currentZoneIndex]?.name;
  const heading = campaignWaveAlertTimer > 0 && campaignWaveAlertText
    ? campaignWaveAlertText
    : !campaignEncounterTriggered ? `TIẾP CẬN AN TOÀN  •  ${zoneName ?? stage.name}` : `CAMPAIGN ${stage.id}/10  •  ${zoneName ?? stage.name}`;
  ctx.fillText(heading, x, y - 16, panelW - 20);
  let objectiveText: string;
  if (stageBossSpawned) objectiveText = `HẠ BOSS: ${stage.bossName}`;
  else if (stageObjectiveIndex >= stage.objectiveNodes.length) objectiveText = stage.id === 1 ? 'ĐẾN KHU BOSS  •  SHIFT / LƯỚT ĐỂ NÉ ĐÒN' : 'ĐANG TIẾN VÀO KHU BOSS';
  else {
    const node = stage.objectiveNodes[stageObjectiveIndex];
    const near = Math.hypot(player.x - node.x, player.y - node.y) < 82;
    const holding = stage.objectiveHoldAt === stageObjectiveIndex;
    objectiveText = stage.id === 10 || stage.id === 9 && stageObjectiveIndex < 2
      ? `BẮN PHÁ Ổ DỊCH / LÕI  ${stageObjectiveIndex + 1}/${stage.objectiveNodes.length}  •  ${Math.max(0, Math.ceil(stageObjectiveHp))} HP`
      : holding
      ? stage.id === 9 && !stageObjectiveHoldStarted
        ? `PHÁ Ổ DỊCH CUỐI${near ? '  •  NHẤN E' : '  •  ĐẾN GẦN Ổ DỊCH'}`
        : `${stage.objectiveLabel}  •  ${Math.floor(stageObjectiveHoldTime)}/${stage.objectiveHoldSeconds ?? 15} GIÂY${near ? '  •  GIỮ VỊ TRÍ' : '  •  QUAY LẠI MỤC TIÊU'}`
      : `${stage.objectiveLabel}  ${stageObjectiveIndex}/${stage.objectiveNodes.length}${near ? '  •  NHẤN E ĐỂ TƯƠNG TÁC' : '  •  THEO DẤU CHỈ HƯỚNG'}`;
    if (holding) {
      ctx.fillStyle = 'rgba(38,43,41,.95)'; ctx.fillRect(x - panelW*.38, y + 27, panelW*.76, 3);
      ctx.fillStyle = '#a8c08b'; ctx.fillRect(x - panelW*.38, y + 27, panelW*.76 * Math.min(1, stageObjectiveHoldTime / (stage.objectiveHoldSeconds ?? 15)), 3);
    }
  }
  if (stageExitActive && stage.exitSpawn && !stageExitActivated) {
    const nearExit = Math.hypot(player.x - stage.exitSpawn.x, player.y - stage.exitSpawn.y) <= 88;
    objectiveText = nearExit ? 'ĐIỂM THOÁT ĐÃ MỞ  •  NHẤN E ĐỂ KẾT THÚC' : 'ĐI THEO DẤU CHỈ HƯỚNG ĐẾN ĐIỂM THOÁT';
  }
  if (bossWeaponDrop) objectiveText = `NHẶT ${campaignGuns.find(gun => gun.id === bossWeaponDrop!.gunId)?.shortName ?? 'VŨ KHÍ'} BOSS ĐỂ MỞ ĐIỂM THOÁT`;
  if (campaignActiveWaveZones.has(currentZoneIndex)) {
    const enemiesLeft = zombies.pool.getActive().reduce((count, z) => count + (z.hp > 0 && z.campaignZoneIndex === currentZoneIndex ? 1 : 0), 0);
    const holdText = stage.layout?.zones[currentZoneIndex]?.role === 'hold' ? `  •  GIỮ ${Math.floor(stageObjectiveHoldTime)}/${stage.objectiveHoldSeconds ?? 15}s` : '';
    const pending = campaignWaveQueue.reduce((count, wave) => count + (wave.zoneIndex === currentZoneIndex ? wave.remaining : 0), 0);
    objectiveText = `ĐỢT QUÁI: ${enemiesLeft} ĐANG SỐNG · ${pending} SẮP RA${holdText}`;
  }
  if (campaignSupplyNoticeTimer > 0) objectiveText = campaignSupplyNotice;
  ctx.fillStyle = stageExitActive ? '#9fc4af' : stageBossSpawned ? '#e47a68' : '#f0eadc';
  ctx.font = `bold ${viewportWidth < 700 ? 10 : 11}px 'Segoe UI', Arial, sans-serif`;
  const words = objectiveText.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > panelW - 24 && lines.length === 0) {
      lines.push(line); line = word;
    } else line = next;
  }
  lines.push(line);
  lines.slice(0, 2).forEach((text, index) => ctx.fillText(text, x, y + (lines.length > 1 ? -1 : 6) + index * 15, panelW - 22));
  drawCampaignDirection(stage);
}

function drawCampaignDirection(stage: typeof STAGES[number]): void {
  const layout = stage.layout;
  if (!layout) return;
  let target = bossWeaponDrop ?? (stageExitActive && stage.exitSpawn ? stage.exitSpawn :
    stageBossSpawned ? stage.bossSpawn : stage.objectiveNodes[stageObjectiveIndex] ?? stage.bossSpawn);
  const currentZone = nearestCampaignZone(player.x, player.y);
  const targetZone = nearestCampaignZone(target.x, target.y);
  if (currentZone >= 0 && targetZone > currentZone && !stageBossSpawned && !stageExitActive) {
    const gate = layout.gates[currentZone];
    const here = layout.zones[currentZone], next = layout.zones[currentZone + 1];
    if (gate && next && campaignActiveWaveZones.has(currentZone) && isCampaignGateClosed(currentZone)) {
      target = { x: gate.x + gate.w / 2, y: gate.y + gate.h / 2 };
    } else if (gate && next && !isCampaignGateClosed(currentZone)) {
      const bendX = (here.x + here.w / 2 + next.x + next.w / 2) / 2;
      const hereY = here.y + here.h / 2, nextY = next.y + next.h / 2;
      if (player.x < bendX - 65) target = { x: bendX, y: hereY };
      else if (Math.abs(player.y - nextY) > 70) target = { x: bendX, y: nextY };
      else target = { x: gate.x + gate.w / 2, y: gate.y + gate.h / 2 };
    }
  }
  const [tx, ty] = camera.worldToWindowScreen(target.x, target.y);
  if (tx > 80 && tx < viewportWidth - 80 && ty > 190 && ty < viewportHeight - 185) return;
  const dx = tx - viewportWidth / 2, dy = ty - viewportHeight / 2;
  const angle = Math.atan2(dy, dx);
  const px = Math.max(56, Math.min(viewportWidth - 56, viewportWidth / 2 + Math.cos(angle) * (viewportWidth / 2 - 90)));
  const py = Math.max(185, Math.min(viewportHeight - 190, viewportHeight / 2 + Math.sin(angle) * (viewportHeight / 2 - 200)));
  ctx.save(); ctx.translate(px, py); ctx.rotate(angle);
  ctx.fillStyle = stageExitActive ? '#9dc5a4' : stageBossSpawned ? '#d78d77' : '#d8bc7c';
  ctx.strokeStyle = '#182022'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(22,0); ctx.lineTo(-13,-14); ctx.lineTo(-8,0); ctx.lineTo(-13,14); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
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
  for (const def of gameMode === 'endless' ? PERM_UPGRADES : []) {
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
  const charId = gameMode === 'stage' ? save.data.campaign.selectedCharacter : save.data.selectedCharacter;
  player.visualCharacterId = charId;
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
  input.campaignMode = gameMode === 'stage';
  resetGame();
  input.clearUiFire();
  const stage = gameMode === 'stage' ? STAGES[currentStageIndex] : undefined;
  if (stage) {
    setCampaignGeometry(stage.buildings, stage.layout);
    camera.zoom = viewportWidth < 700 ? 0.95 : 1.42;
    player.x = stage.playerStart.x; player.y = stage.playerStart.y;
    player.dashMaxCooldown = 1.0;
    camera.x = player.x - camera.width / 2; camera.y = player.y - camera.height / 2;
    const stock = save.data.campaign;
    const ammoPacks = stock.ammoPacks;
    const medKits = stock.medKits;
    if (!previewEncounter) { stock.ammoPacks = 0; stock.medKits = 0; save.save(); }
    weapons.loadout.configureCampaign(stock.ownedGuns, stock.equippedGun, stock.gunLevels, ammoPacks, currentStageIndex + 1);
    campaignResources.reset(stage, medKits);
  } else {
    camera.zoom = 1.42;
    player.dashMaxCooldown = 3;
  }
  player.loadout = weapons.loadout;
  audio.init();
  if (stage) {
    for (const [id, level] of Object.entries(save.data.campaign.cardLevels)) {
      for (let n = 0; n < level; n++) player.applyUpgrade(id);
    }
  }
  applyPermUpgrades();
  if (stage) player.hp = player.maxHp;
  adWrapper.gameplayStart();
  menuUI.currentScreen = 'playing';
  paused = false;
  stageComplete = false;
  bossKilledThisRun = false;
  bossWeaponDrop = null;

  // Spawn initial discoverable weapon drop (SG-12) 220px from player!
  if (gameMode === 'endless') mapPickups.spawnWeaponPickup(player.x + 220, player.y + 45, 'sg12');
}

function resetGame(): void {
  setCampaignGeometry();
  bossWeaponDrop = null;
  stageObjectiveIndex = 0;
  stageBossSpawned = false;
  stageObjectiveHoldTime = 0;
  stageObjectiveHoldStarted = false;
  stageObjectiveHp = 150 + currentStageIndex * 12;
  stageBossSummonsSpawned = 0;
  stageExitActive = false;
  stageExitActivated = false;
  campaignTriggeredZones.clear();
  campaignActiveWaveZones.clear();
  campaignWaveQueue.length = 0;
  campaignSupplyNotice = '';
  campaignSupplyNoticeTimer = 0;
  campaignWaveAlertText = '';
  campaignWaveAlertTimer = 0;
  campaignEncounterTriggered = false;
  campaignWavePreview = false;
  campaignHoldWaveTimer = 5.5;
  campaignBossWaveTimer = 0;
  campaignBossDirector.reset();
  campaignResources.reset();
  campaignCredits.clear();
  lastCreditGain = 0;
  creditGainTimer = 0;
  activeMusicThreat = 'calm';
  hasSeenZombiesThisRun = false;
  player.reset();
  bullets.pool.releaseAll();
  zombies.pool.releaseAll();
  horrorRemains.clear();
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
  audio.unlock();
};
window.addEventListener('pointerdown', unlockAudioContext, { passive: true });
window.addEventListener('mousedown', unlockAudioContext, { passive: true });
window.addEventListener('keydown', unlockAudioContext, { passive: true });
window.addEventListener('touchstart', unlockAudioContext, { passive: true });

lastTimestamp = performance.now();
requestAnimationFrame(gameLoop);

if (import.meta.env.DEV && horrorPreview) {
  void import('./dev/horror-preview').then(({ mountHorrorPreview }) => mountHorrorPreview({
    captureClean(enabled) { previewCleanCapture = enabled; },
    encounter(typeId, wall) {
      const type = [...ZOMBIE_TYPES, ...HORROR_TYPES].find(t => t.id === typeId);
      if (!type) return;
      previewEncounter = true;
      gameMode = 'endless';
      startGame();
      previewAudit.hits = previewAudit.attacks = previewAudit.deaths = previewAudit.drops = 0;
      previewAudit.phases.clear();
      player.x = wall ? 995 : 2000;
      player.y = wall ? 720 : 2000;
      const z = zombies.spawn(type, wall ? 885 : player.x + 240, player.y, 1, 1, 1);
      z.facingAngle = Math.PI;
      camera.x = player.x - camera.width / 2;
      camera.y = player.y - camera.height / 2;
      mapPickups.reset();
    },
    campaign(stageIndex, bossPreview, zoneIndex, attackKind) {
      const stage = STAGES[stageIndex];
      if (!stage) return;
      // Map and boss previews are always isolated from the player's real save.
      previewEncounter = true;
      campaignWavePreview = false;
      previewAudit.hits = previewAudit.attacks = previewAudit.deaths = previewAudit.drops = 0;
      previewAudit.phases.clear();
      gameMode = 'stage'; currentStageIndex = stageIndex;
      startGame();
      if (zoneIndex !== undefined && stage.layout) {
        const zone = stage.layout.zones[zoneIndex];
        if (zone) {
          stageObjectiveIndex = stage.objectiveNodes.filter(node => nearestCampaignZone(node.x, node.y) < zoneIndex).length;
          stageObjectiveHp = 150 + currentStageIndex * 12 + stageObjectiveIndex * 30;
          for (let i = 0; i < zoneIndex; i++) campaignTriggeredZones.add(i);
          setCampaignGateState(stageObjectiveIndex, false, false);
          player.x = zone.x + zone.w * .30; player.y = zone.y + zone.h / 2;
          camera.x = player.x - camera.width / 2; camera.y = player.y - camera.height / 2;
        }
      }
      if (bossPreview) {
        stageObjectiveIndex = stage.objectiveNodes.length;
        spawnCampaignBoss(stage);
        if (attackKind) campaignBossDirector.forceNextAttack(attackKind);
        // Keep a useful stage-scale gap in the dev showcase so movement,
        // weapon arcs and projectiles remain visible. Give the player only a
        // brief spawn grace period so preview runs can still validate real hits.
        player.x = stage.bossSpawn.x - 240;
        player.y = stage.bossSpawn.y + 18;
        if (horrorPreview) player.invulnTimer = 0.65;
        [player.x, player.y] = resolveBuildingCollision(player.x, player.y, player.size);
        camera.x = player.x - camera.width / 2; camera.y = player.y - camera.height / 2;
      }
      mapPickups.reset();
    },
    campaignWave(stageIndex, zoneIndex) {
      const stage = STAGES[stageIndex];
      const zone = stage?.layout?.zones[zoneIndex];
      if (!stage || !zone?.waveTrigger) return;
      previewEncounter = true;
      campaignWavePreview = false;
      gameMode = 'stage'; currentStageIndex = stageIndex;
      startGame();
      stageObjectiveIndex = stage.objectiveNodes.filter(node => nearestCampaignZone(node.x, node.y) < zoneIndex).length;
      stageObjectiveHp = 150 + currentStageIndex * 12 + stageObjectiveIndex * 30;
      for (let i = 0; i <= zoneIndex; i++) campaignTriggeredZones.add(i);
      setCampaignGateState(stageObjectiveIndex, false, false, campaignActiveWaveZones);
      player.x = zone.x + zone.w * .3;
      player.y = zone.y + zone.h / 2;
      [player.x, player.y] = resolveBuildingCollision(player.x, player.y, player.size);
      camera.x = player.x - camera.width / 2; camera.y = player.y - camera.height / 2;
      campaignEncounterTriggered = true;
      campaignWavePreview = spawnCampaignZoneWave(stage, zoneIndex, zone.waveSize);
      mapPickups.reset();
    },
    shoot() {
      const z = zombies.pool.getActive().find(z => z.hp > 0);
      if (!z) return;
      // Collision probe uses a real projectile and unchanged base player damage.
      bullets.fire(z.x - 5, z.y, 0, player.bulletDamage, 0, player.bulletSize, player.bulletColor);
    },
    menu() { previewEncounter = false; resetGame(); menuUI.currentScreen = 'main'; },
    gameOver() { player.hp = 0; handlePlayerDeath(); },
    survive() { previewEncounter = false; gameMode = 'endless'; startGame(); },
    snapshot() {
      const z = zombies.pool.getActive()[0];
      return { screen: menuUI.currentScreen, playerHp: player.hp, kills: player.kills,
        xp: player.xp, gems: xpGems.pool.activeCount, ...previewAudit, phases: [...previewAudit.phases],
        creature: z ? { type: z.typeId, hp: z.hp, x: z.x, y: z.y, phase: z.specialState, flash: z.flashTimer,
          attack: z.campaignAttackKind, moveProgress: z.campaignAttackProgress, campaignPhase: z.campaignPhase } : null };
    },
  }));
}
