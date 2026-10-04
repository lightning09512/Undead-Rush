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
import { ExplosionEffects } from './entities/explosion-effects';
import { DamageNumbers } from './entities/damage-numbers';
import { EnemyProjectileSystem } from './entities/enemy-projectiles';
import { MapPickupSystem } from './entities/map-pickups';
import { SupplyCrateSystem } from './entities/supply-crates';
import { GroundRenderer } from './graphics/ground';
import { PropRenderer } from './graphics/props';
import { LightingRenderer } from './graphics/lighting';
import { spriteLoader } from './graphics/assets-config';
import { EntityRenderer } from './graphics/entity-renderer';

import { Spawner, SURVIVAL_HORDE_MULTIPLIER } from './systems/spawner';
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
import { PERM_UPGRADES, CHARACTERS, STAGES, type CampaignZone, type Point, type StageDef } from './data/meta';
import { EVOLUTIONS, UPGRADES } from './data/upgrades';
import { getHorrorAttack, HORROR_TYPES, ZOMBIE_TYPES, type ZombieTypeDef } from './data/zombies';
import { horrorAttackHits } from './systems/horror-ai';
import { HorrorRemains } from './entities/horror-remains';
import { BloodStains } from './entities/blood-stains';
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
const explosionEffects = new ExplosionEffects();
const damageNumbers = new DamageNumbers();
const enemyProjectiles = new EnemyProjectileSystem();
const mapPickups = new MapPickupSystem();
const supplyCrates = new SupplyCrateSystem();
const spawner = new Spawner();
const weapons = new WeaponSystem();
const zombieGrid = new SpatialGrid<Zombie>(64);
const save = new SaveSystem(!horrorPreview);
const horrorRemains = new HorrorRemains();
const bloodStains = new BloodStains();
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
const campaignDestroyedPortals = new Set<string>();
const campaignSealedSpawnZones = new Set<number>();
interface CampaignWaveQueueEntry {
  zoneIndex: number;
  roster: ZombieTypeDef[];
  portalPoints: Point[];
  sealedPortals: boolean[];
  portalHp: number[];
  portalMaxHp: number;
  remaining: number;
  total: number;
  spawned: number;
  portalCursor: number;
  started: boolean;
  warningTimer: number;
  spawnTimer: number;
  groupSpawned: number;
  groupSize: number;
  waitingForClear: boolean;
  countsForGate: boolean;
}
const campaignWaveQueue: CampaignWaveQueueEntry[] = [];
let campaignPortalFlash: { zoneIndex: number; point: Point; timer: number } | null = null;
let campaignWaveAlertText = '';
let campaignWaveAlertTimer = 0;
let campaignEncounterTriggered = false;
let campaignHoldWaveTimer = 0;
let campaignBossWaveTimer = 0;
const CAMPAIGN_HORDE_MULTIPLIER = 10;
const CAMPAIGN_SPAWN_PRESSURE_MULTIPLIER = 3;
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
type SurvivalPhase = 'intermission' | 'regular' | 'boss-warning' | 'boss';
let survivalWave = 0;
let survivalPhase: SurvivalPhase = 'intermission';
let survivalPhaseTimer = 2.7;
let survivalSpawnRemaining = 0;
let survivalBossStageId = 0;
let survivalBossSummonsSpawned = 0;

function syncMusicForThreat(): void {
  const menuScene = menuUI.currentScreen === 'main' || menuUI.currentScreen === 'savegame' || menuUI.currentScreen === 'campaign' || menuUI.currentScreen === 'hunter_profile' || menuUI.currentScreen === 'tutorial';
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

  // Campaign boss rooms keep Music 2 throughout the encounter and its clear;
  // the same track continues until the player leaves gameplay for the result/menu flow.
  const campaignBossRoomMusic = gameMode === 'stage' && stageBossSpawned;
  let bossAlive = false;
  for (const z of zombies.pool.getActive()) {
    if (z.hp <= 0) continue;
    // Once a run has had enemies, combat music stays latched through empty waves.
    hasSeenZombiesThisRun = true;
    // Boss music has priority for the entire boss encounter, including off-screen.
    if (z.isBoss && !campaignBossRoomMusic) {
      bossAlive = true;
      break;
    }
  }

  if (bossAlive || campaignBossRoomMusic) hasSeenZombiesThisRun = true;
  // Music 1 is strictly pre-combat. Music 2 stays through empty waves and the
  // full Campaign boss room; Music 3 remains reserved for Survival bosses.
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
        const action = menuUI.handleClick(click.x, click.y, viewportWidth, viewportHeight, audio, save);
        handleMenuAction(action);
      }
    }

    // Draw appropriate screen
    canvas.style.cursor = 'default';
    if (menuUI.currentScreen === 'campaign') { campaignUI.draw(ctx, viewportWidth, viewportHeight, save); return; }
    if (menuUI.currentScreen === 'main' || menuUI.currentScreen === 'savegame' || menuUI.currentScreen === 'hunter_profile' || menuUI.currentScreen === 'tutorial') {
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
    case 'open_save_menu':
      menuUI.confirmNewGame = false;
      menuUI.currentScreen = 'savegame';
      break;
    case 'open_new_game_confirm':
      menuUI.confirmNewGame = true;
      break;
    case 'cancel_new_game':
      menuUI.confirmNewGame = false;
      break;
    case 'new_game':
      menuUI.confirmNewGame = false;
      save.resetCampaign();
      gameMode = 'stage';
      currentStageIndex = 0;
      previewEncounter = false;
      campaignUI.selectedStage = 0;
      campaignUI.page = 'character';
      campaignUI.focusedCharacter = 'survivor';
      menuUI.currentScreen = 'campaign';
      break;
    case 'load_game': {
      const campaign = save.data.campaign;
      const checkpoint = Math.max(1, Math.min(STAGES.length, campaign.lastStage, campaign.unlockedStage));
      gameMode = 'stage';
      currentStageIndex = checkpoint - 1;
      previewEncounter = false;
      campaignUI.selectedStage = currentStageIndex;
      campaignUI.page = 'briefing';
      menuUI.currentScreen = 'campaign';
      break;
    }
    case 'select_campaign_stage':
      gameMode = 'stage';
      campaignUI.page = 'stages';
      menuUI.currentScreen = 'campaign';
      break;
    case 'back_to_main':
      menuUI.confirmNewGame = false;
      menuUI.currentScreen = 'main';
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
    const cooldownBeforeDash = player.dashCooldown;
    player.dash(dashX, dashY);
    if (cooldownBeforeDash <= 0 && player.dashCooldown > 0) {
      const impactDamage = upgradeValue('dash_impact');
      if (impactDamage > 0) {
        particles.emit(player.x, player.y, 9, '#b7d1c4', 78, .22, 2.5);
        for (const z of [...zombies.pool.getActive()]) {
          if (z.hp <= 0 || Math.hypot(z.x - player.x, z.y - player.y) > 82) continue;
          z.hp -= impactDamage;
          z.flashTimer = .12;
          z.knockbackX += Math.cos(player.dashDirection) * 115;
          z.knockbackY += Math.sin(player.dashDirection) * 115;
          damageNumbers.spawn(z.x, z.y, impactDamage, '#d8c59f');
          particles.burst(z.x, z.y, 5, '#a9473d', player.dashDirection, 1.2, 80, .25);
          if (z.hp <= 0) handleZombieDeath(z);
        }
      }
    }
  }
  if (gameMode === 'stage') updateCampaignObjective(dt);

  // ─── Camera ───
  camera.follow(player.x, player.y, input.mouseX, input.mouseY, dt);
  audio.updatePlayerFootsteps(dt, player.isMoving && player.dashDuration <= 0, Math.hypot(player.vx, player.vy));

  // ─── Spawning ───
  const stage = gameMode === 'stage' ? STAGES[currentStageIndex] : undefined;
  if (stage && (!previewEncounter || campaignWavePreview)) updateCampaignWaves(stage, dt);
  const toSpawn = previewEncounter || stage ? [] : updateSurvivalWaves(dt);
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
    const bossDamage = updateBossEncounter(dt, stage, boss);
    if (bossDamage > 0) {
      const hit = player.takeDamage(bossDamage);
      if (hit.dead) { handlePlayerDeath(); return; }
      if (hit.damaged) {
        audio.playerHit(); camera.shake(3.2, .16);
        damageNumbers.spawn(player.x, player.y, hit.actualDamage, UI_PALETTE.dangerBright, false, '-');
        particles.burst(player.x, player.y, 9, '#a9473d', Math.atan2(player.y - (boss?.y ?? player.y), player.x - (boss?.x ?? player.x)), 1.2, 105, .3);
      }
    }
  } else if (gameMode === 'endless' && survivalPhase === 'boss' && survivalBossStageId > 0) {
    const bossStage = STAGES.find(value => value.id === survivalBossStageId);
    const boss = zombies.pool.getActive().find(z => z.campaignBossId === survivalBossStageId);
    if (bossStage && boss) {
      const bossDamage = updateBossEncounter(dt, bossStage, boss, true);
      if (bossDamage > 0) {
        const hit = player.takeDamage(bossDamage);
        if (hit.dead) { handlePlayerDeath(); return; }
        if (hit.damaged) {
          audio.playerHit(); camera.shake(3.2, .16);
          damageNumbers.spawn(player.x, player.y, hit.actualDamage, UI_PALETTE.dangerBright, false, '-');
          particles.burst(player.x, player.y, 9, '#a9473d', Math.atan2(player.y - boss.y, player.x - boss.x), 1.2, 105, .3);
        }
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
      if (!z.isBoss || z.hp <= 0 || z.campaignBossId !== null) continue;

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
          audio.objectiveComplete();
          setCampaignGateState(stageObjectiveIndex, stageBossSpawned, bossKilledThisRun);
        }
        return true;
      }
    }
    if (gameMode === 'stage') {
      for (let waveIndex = 0; waveIndex < campaignWaveQueue.length; waveIndex++) {
        const wave = campaignWaveQueue[waveIndex];
        if (!wave.started || wave.remaining <= 0) continue;
        for (let portalIndex = 0; portalIndex < wave.portalPoints.length; portalIndex++) {
          if (wave.sealedPortals[portalIndex]) continue;
          const point = wave.portalPoints[portalIndex];
          const dx = b.x - point.x, dy = b.y - point.y;
          const hitRadius = b.size + 46;
          if (dx * dx + dy * dy >= hitRadius * hitRadius) continue;
          wave.portalHp[portalIndex] = Math.max(0, wave.portalHp[portalIndex] - b.damage);
          particles.emit(point.x, point.y, 3, '#a23e3a', 38, .2, 2.2);
          if (wave.portalHp[portalIndex] <= 0) {
            wave.sealedPortals[portalIndex] = true;
            campaignDestroyedPortals.add(campaignPortalKey(wave.zoneIndex, point));
            particles.burst(point.x, point.y, 24, '#9b3938', Math.random() * Math.PI * 2, Math.PI * 2, 112, .42);
            particles.emit(point.x, point.y, 10, '#443330', 54, .45, 4);
            camera.shake(1.8, .15);
            audio.explosion();
            campaignWaveAlertText = wave.sealedPortals.every(Boolean) ? 'CÁC Ổ SPAWN ĐÃ BỊ PHÁ' : 'Ổ SPAWN ĐÃ BỊ PHÁ';
            campaignWaveAlertTimer = 2.4;
            if (campaignPortalFlash?.point === point) campaignPortalFlash = null;
            if (wave.sealedPortals.every(Boolean)) {
              campaignSealedSpawnZones.add(wave.zoneIndex);
              campaignWaveQueue.splice(waveIndex, 1);
            }
          }
          return true;
        }
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
        let hitDamage = b.damage;
        if ((z.isBoss || z.isElite) && upgradeLevel('mutant_hunter') > 0) {
          hitDamage = Math.round(hitDamage * upgradeValue('mutant_hunter', 1));
        }
        if (z.hp / Math.max(1, z.maxHp) <= .35 && upgradeLevel('executioner') > 0) {
          hitDamage = Math.round(hitDamage * upgradeValue('executioner', 1));
        }
        z.hp -= hitDamage;
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

        const bleedLevel = upgradeLevel('bleeding_rounds');
        if (bleedLevel > 0 && Math.random() < upgradeValue('bleeding_rounds')) {
          z.bleedTimer = Math.max(z.bleedTimer, z.isBoss ? 1.5 : 2.4);
          z.bleedDamage = Math.max(z.bleedDamage, hitDamage * (z.isBoss ? .055 : .12));
          particles.emit(z.x, z.y, 3, '#8f3435', 32, .2, 2);
        }
        const shockLevel = upgradeLevel('shock_rounds');
        if (!z.isBoss && shockLevel > 0 && Math.random() < upgradeValue('shock_rounds')) {
          z.stunTimer = Math.max(z.stunTimer, .22 + shockLevel * .1);
          particles.emit(z.x, z.y, 3, '#a9c8bc', 34, .18, 1.7);
        }

        damageNumbers.spawn(z.x, z.y, hitDamage, '#ffdd44');
        particles.burst(z.x, z.y, 4, z.color,
          Math.atan2(-dy, -dx), Math.PI * 0.5, 90, 0.35);
        audio.hit();
        if (getHorrorAttack(z.typeId)) {
          audio.zombieHurt(Math.max(-1, Math.min(1, (z.x - player.x) / 420)), z.typeId, Math.hypot(z.x - player.x, z.y - player.y));
          particles.burst(z.x, z.y, 3, '#973b36', Math.atan2(-dy, -dx), 0.7, 70, 0.25);
        }

        if (b.explosive > 0) {
          handleExplosion(z.x, z.y, b.explosive, hitDamage);
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
    const supplies = campaignResources.collectNearby(player, weapons.loadout, upgradeValue('ammo_scavenger', 1));
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
    item => {
      if (item.itemId.startsWith('ammo_')) return gameMode === 'stage'
        ? weapons.loadout.canAddCampaignAmmoForGun(item.itemId.slice(5))
        : weapons.loadout.canAddAmmoForGun(item.itemId.slice(5));
      if (gameMode === 'endless' && item.itemId.startsWith('gun_')) {
        const gunId = item.itemId.slice(4);
        return !weapons.loadout.hasGun(gunId) || weapons.loadout.canAddAmmoForGun(gunId);
      }
      return true;
    });
  for (const item of pickedUp) {
    handlePickup(item.itemId, item.value, item.duration);
  }

  // ─── Particles ───
  particles.update(dt);
  explosionEffects.update(dt);
  damageNumbers.update(dt);
}

function handlePickup(itemId: string, value: number, duration: number): void {
  if (gameMode === 'stage' && itemId.startsWith('ammo_')) {
    const gunId = itemId.slice(5);
    const added = weapons.loadout.addCampaignAmmoForGun(gunId, Math.round(value * upgradeValue('ammo_scavenger', 1)));
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
  if (gameMode === 'endless' && itemId.startsWith('ammo_')) {
    const gunId = itemId.slice(5);
    const rounds = Math.round(value * upgradeValue('ammo_scavenger', 1));
    const added = weapons.loadout.addAmmoForGun(gunId, rounds);
    if (added > 0) {
      audio.supplyPickup('ammo');
      campaignSupplyNotice = `ĐẠN ${campaignGuns.find(gun => gun.id === gunId)?.shortName ?? gunId.toUpperCase()} +${added}`;
      campaignSupplyNoticeTimer = 1.8;
      particles.emit(player.x, player.y, 5, '#d5b477', 45, .25, 2);
    }
    return;
  }
  if (gameMode === 'endless' && itemId.startsWith('gun_')) {
    const gunId = itemId.slice(4);
    const wasOwned = weapons.loadout.hasGun(gunId);
    if (weapons.loadout.collectSurvivalGun(gunId, audio)) {
      if (wasOwned) audio.supplyPickup('ammo'); else audio.supplyPickup('crate');
      campaignSupplyNotice = wasOwned
        ? `TIẾP ĐẠN ${campaignGuns.find(gun => gun.id === gunId)?.shortName ?? gunId.toUpperCase()}`
        : `ĐÃ NHẶT ${campaignGuns.find(gun => gun.id === gunId)?.shortName ?? gunId.toUpperCase()} · ĐỔI BẰNG PHÍM SỐ`;
      campaignSupplyNoticeTimer = 2.2;
      particles.emit(player.x, player.y, 18, '#d6b375', 85, .45, 3);
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
    audio.revive();
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
    if (campaignSealedSpawnZones.has(zoneIndex)) campaignTriggeredZones.add(zoneIndex);
    else if (spawnCampaignZoneWave(stage, zoneIndex, zone.waveSize)) {
      campaignTriggeredZones.add(zoneIndex);
      campaignEncounterTriggered = true;
    }
  }
  if (zone.role === 'hold' && stage.objectiveHoldAt === stageObjectiveIndex && !campaignSealedSpawnZones.has(zoneIndex)) {
    if (!isCampaignWaveBusy(zoneIndex)) campaignHoldWaveTimer -= dt;
    if (campaignHoldWaveTimer <= 0 && !isCampaignWaveBusy(zoneIndex)) {
      campaignHoldWaveTimer = 4.25;
      spawnCampaignZoneWave(stage, zoneIndex, 2);
    }
  }
}

function spawnCampaignZoneWave(stage: typeof STAGES[number], zoneIndex: number, count: number, useStageRoster = false): boolean {
  const zone = stage.layout?.zones[zoneIndex];
  if (!zone || count <= 0 || campaignSealedSpawnZones.has(zoneIndex)) return false;
  const allowedIds = useStageRoster || zone.mobs.length === 0 ? stage.mobIds : zone.mobs;
  const roster = [...ZOMBIE_TYPES, ...HORROR_TYPES].filter(type => allowedIds.includes(type.id) && stage.mobIds.includes(type.id) && !type.isBoss);
  if (!roster.length) return false;
  const portalPoints = chooseCampaignPortalPoints(stage, zoneIndex, 4);
  if (!portalPoints.length) return false;
  // Keep the opening chapter's authored density, then raise Campaign hordes by 40% from stage 2 onward.
  const stageHordeMultiplier = stage.id === 1 ? CAMPAIGN_HORDE_MULTIPLIER : Math.round(CAMPAIGN_HORDE_MULTIPLIER * 1.4);
  const hordeMultiplier = stageHordeMultiplier * CAMPAIGN_SPAWN_PRESSURE_MULTIPLIER;
  const groupSize = Math.max(5, Math.min(10, 5 + Math.floor(stage.id / 2))) * CAMPAIGN_SPAWN_PRESSURE_MULTIPLIER;
  const total = count * hordeMultiplier;
  const portalMaxHp = 1_200 + stage.id * 220;
  campaignWaveQueue.push({ zoneIndex, roster, portalPoints, sealedPortals: portalPoints.map(() => false),
    portalHp: portalPoints.map(() => portalMaxHp), portalMaxHp, remaining: total, total, spawned: 0, portalCursor: 0,
    started: false, warningTimer: 0, spawnTimer: 0, groupSpawned: 0,
    groupSize, waitingForClear: false,
    countsForGate: !useStageRoster && zone.waveTrigger });
  if (!useStageRoster && zone.waveTrigger) campaignActiveWaveZones.add(zoneIndex);
  return true;
}

function chooseCampaignWaveMob(roster: ZombieTypeDef[]): ZombieTypeDef {
  // Brutes stay as occasional heavy threats instead of occupying half of a
  // small authored roster. Their data weight is further reduced for Campaign.
  const weights = roster.map(type => type.weight * (type.id === 'tank' ? 0.22 : 1));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = Math.random() * totalWeight;
  for (let i = 0; i < roster.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return roster[i];
  }
  return roster[roster.length - 1];
}

function isCampaignWaveBusy(zoneIndex: number): boolean {
  return campaignWaveQueue.some(wave => wave.zoneIndex === zoneIndex) ||
    zombies.pool.getActive().some(z => z.hp > 0 && z.campaignZoneIndex === zoneIndex);
}

function campaignPortalKey(zoneIndex: number, point: Point): string {
  return `${zoneIndex}:${Math.round(point.x)}:${Math.round(point.y)}`;
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

function chooseCampaignPortalPoints(stage: typeof STAGES[number], zoneIndex: number, maxPoints: number): Point[] {
  const zone = stage.layout?.zones[zoneIndex];
  if (!zone) return [];
  const candidates = zone.spawnPoints.filter(point => !campaignDestroyedPortals.has(campaignPortalKey(zoneIndex, point)) &&
    isCampaignPortalPointValid(stage, zone, point.x, point.y, 44) &&
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
    if (wave.sealedPortals[portalIndex]) continue;
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
      campaignPortalFlash = { zoneIndex: wave.zoneIndex, point: portal, timer: .46 };
      return true;
    }
  }
  return false;
}

function updateCampaignSpawnQueue(stage: typeof STAGES[number], dt: number): void {
  if (campaignPortalFlash) {
    campaignPortalFlash.timer = Math.max(0, campaignPortalFlash.timer - dt);
    if (campaignPortalFlash.timer <= 0) campaignPortalFlash = null;
  }
  const wave = campaignWaveQueue[0];
  if (!wave) return;
  if (!wave.started) {
    if (zombies.pool.activeCount >= CAMPAIGN_ACTIVE_ZOMBIE_LIMIT) return;
    wave.started = true;
    wave.warningTimer = CAMPAIGN_WAVE_WARNING_SECONDS;
    wave.spawnTimer = 0;
    campaignWaveAlertText = 'CỔNG MÁU ĐANG MỞ';
    campaignWaveAlertTimer = 3.2;
    return;
  }
  if (wave.warningTimer > 0) {
    wave.warningTimer = Math.max(0, wave.warningTimer - dt);
    return;
  }
  if (wave.waitingForClear) {
    if (zombies.pool.getActive().some(z => z.hp > 0 && z.campaignZoneIndex === wave.zoneIndex)) return;
    wave.waitingForClear = false;
    wave.warningTimer = CAMPAIGN_WAVE_GROUP_BREAK;
    campaignWaveAlertText = 'QUÁI MỚI ĐANG TRÀN VÀO';
    campaignWaveAlertTimer = 2.4;
    return;
  }
  wave.spawnTimer -= dt;
  if (wave.spawnTimer > 0 || zombies.pool.activeCount >= CAMPAIGN_ACTIVE_ZOMBIE_LIMIT) return;
  const spawnRate = 2.5 + (stage.id - 1) * .42;
  const type = chooseCampaignWaveMob(wave.roster);
  if (!spawnCampaignZombie(stage, wave, type)) {
    wave.spawnTimer = .25;
    return;
  }
  wave.spawned++;
  wave.remaining--;
  wave.groupSpawned++;
  wave.spawnTimer = 1 / spawnRate;
  if (wave.groupSpawned >= wave.groupSize && wave.remaining > 0) {
    wave.groupSpawned = 0;
    wave.waitingForClear = true;
  }
  if (wave.remaining <= 0) campaignWaveQueue.shift();
}

function updateCampaignWaveClears(stage: typeof STAGES[number]): void {
  for (const zoneIndex of campaignActiveWaveZones) {
    if (campaignWaveQueue.some(wave => wave.zoneIndex === zoneIndex)) continue;
    if (zombies.pool.getActive().some(z => z.hp > 0 && z.campaignZoneIndex === zoneIndex)) continue;
    campaignActiveWaveZones.delete(zoneIndex);
    campaignWaveAlertText = 'KHU VỰC ĐÃ SẠCH · LỐI ĐI ĐÃ MỞ';
    campaignWaveAlertTimer = 3.2;
    if (stage.layout?.zones[zoneIndex].role === 'hold') campaignHoldWaveTimer = 4.25;
  }
}

function updateCampaignObjective(dt: number): void {
  const stage = STAGES[currentStageIndex];
  const pressed = input.interactPressed;
  if (!stage) return;
  const currentNode = stage.objectiveNodes[stageObjectiveIndex];
  const nodeNeedsInteraction = currentNode && !stageBossSpawned && stage.id !== 10 && !(stage.id === 9 && stageObjectiveIndex < 2);
  const nearObjective = !!nodeNeedsInteraction && Math.hypot(player.x - currentNode.x, player.y - currentNode.y) <= 88;
  const nearExit = !!stage.exitSpawn && bossKilledThisRun && Math.hypot(player.x - stage.exitSpawn.x, player.y - stage.exitSpawn.y) <= 88;
  if (stage.exitSpawn && bossKilledThisRun && !stageExitActivated) {
    stageExitActive = true;
    if (bossWeaponDrop) return;
    if (pressed && Math.hypot(player.x - stage.exitSpawn.x, player.y - stage.exitSpawn.y) <= 88) {
      stageExitActivated = true;
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
      audio.objectiveActivate();
    }
    if (near && (stage.id !== 9 || stageObjectiveHoldStarted)) stageObjectiveHoldTime += dt;
    else stageObjectiveHoldTime = 0;
    if (stageObjectiveHoldTime >= (stage.objectiveHoldSeconds ?? 5)) {
      stageObjectiveIndex++; stageObjectiveHoldTime = 0; audio.objectiveComplete();
      setCampaignGateState(stageObjectiveIndex, stageBossSpawned, bossKilledThisRun);
    }
    return;
  }
  if (pressed && Math.hypot(player.x - node.x, player.y - node.y) <= 82) {
    stageObjectiveIndex++;
    audio.objectiveComplete();
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
  const bossEndurance = stage.id === 1 ? 1 : 1.65 + (stage.id - 2) * .07;
  boss.hp = Math.round(stage.bossHp * bossEndurance); boss.maxHp = boss.hp;
  boss.damage = 20 + stage.id * 2;
  boss.speed = 32;
  boss.xpValue = 80 + stage.id * 15;
  campaignBossDirector.reset();
  camera.shake(7, .35);
  particles.emit(boss.x, boss.y, 38, '#a9473d', 145, .9, 6);
}

function upgradeLevel(id: string): number { return player.upgrades.get(id) || 0; }
function upgradeValue(id: string, fallback = 0): number {
  const level = upgradeLevel(id);
  const def = UPGRADES.find(value => value.id === id);
  return level > 0 && def ? (def.values[level - 1] ?? fallback) : fallback;
}

function updateSurvivalWaves(dt: number): ReturnType<Spawner['updateWave']> {
  if (survivalPhase === 'intermission') {
    survivalPhaseTimer = Math.max(0, survivalPhaseTimer - dt);
    if (survivalPhaseTimer > 0) return [];
    survivalWave++;
    if (survivalWave % 3 === 0) {
      const cycleBoss = Math.floor((Math.ceil(survivalWave / 3) - 1) / STAGES.length);
      const profileIndex = (Math.ceil(survivalWave / 3) - 1) % STAGES.length;
      survivalBossStageId = STAGES[profileIndex].id;
      survivalBossSummonsSpawned = 0;
      survivalPhase = 'boss-warning';
      survivalPhaseTimer = 3.4 + Math.min(.8, cycleBoss * .15);
      return [];
    }
    survivalPhase = 'regular';
    survivalSpawnRemaining = Math.min(42 * SURVIVAL_HORDE_MULTIPLIER,
      (8 + survivalWave * 3) * SURVIVAL_HORDE_MULTIPLIER);
    spawner.beginWave();
  }

  if (survivalPhase === 'boss-warning') {
    survivalPhaseTimer = Math.max(0, survivalPhaseTimer - dt);
    if (survivalPhaseTimer <= 0) {
      const stage = STAGES.find(value => value.id === survivalBossStageId);
      if (stage) spawnSurvivalBoss(stage);
      survivalPhase = 'boss';
    }
    return [];
  }

  if (survivalPhase === 'regular') {
    const spawns = spawner.updateWave(dt, gameTime, zombies.pool.activeCount, camera,
      player.x, player.y, survivalSpawnRemaining);
    survivalSpawnRemaining = Math.max(0, survivalSpawnRemaining - spawns.length);
    if (survivalSpawnRemaining === 0 && zombies.pool.activeCount === 0) {
      survivalPhase = 'intermission';
      survivalPhaseTimer = 4.2;
    }
    return spawns;
  }

  if (survivalPhase === 'boss' && zombies.pool.activeCount === 0) {
    survivalPhase = 'intermission';
    survivalPhaseTimer = 5.2;
  }
  return [];
}

function spawnSurvivalBoss(stage: StageDef): void {
  const def = [...ZOMBIE_TYPES, ...HORROR_TYPES].find(entry => entry.id === stage.bossTypeId)
    ?? ZOMBIE_TYPES.find(entry => entry.id === 'boss_1')!;
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.max(440, Math.min(760, Math.max(camera.width, camera.height) * .62));
  const x = Math.max(110, Math.min(MAP_CONFIG.width - 110, player.x + Math.cos(angle) * distance));
  const y = Math.max(110, Math.min(MAP_CONFIG.height - 110, player.y + Math.sin(angle) * distance));
  const boss = zombies.spawn(def, x, y, 1, 1, 1);
  boss.campaignBossId = stage.id;
  boss.isBoss = true;
  boss.typeId = stage.bossTypeId;
  boss.size = stage.id === 9 ? 88 : stage.id === 10 ? 82 : 55 + Math.min(18, stage.id * 1.8);
  [boss.x, boss.y] = resolveBuildingCollision(boss.x, boss.y, boss.size * .8);
  const circuit = Math.floor((Math.ceil(survivalWave / 3) - 1) / STAGES.length);
  const endurance = stage.id === 1 ? 1.12 : 1.45 + (stage.id - 2) * .055;
  boss.hp = Math.round(stage.bossHp * endurance * (1 + circuit * .2));
  boss.maxHp = boss.hp;
  boss.damage = 20 + stage.id * 2;
  boss.speed = 32;
  boss.xpValue = 200 + stage.id * 35;
  campaignBossDirector.reset();
  camera.shake(7, .35);
  particles.emit(boss.x, boss.y, 36, '#9f4942', 140, .8, 5);
}

function updateBossEncounter(dt: number, stage: StageDef, boss: Zombie | undefined, survival = false): number {
  return campaignBossDirector.update(dt, stage, boss, player.x, player.y, () => {
    const bossCircuit = survival ? Math.floor((Math.ceil(survivalWave / 3) - 1) / STAGES.length) : 0;
    const summonCap = stage.id === 1 ? (survival ? Math.min(6, 4 + bossCircuit) : 4)
      : stage.id === 10 ? (survival ? Math.min(5, 3 + bossCircuit) : 3) : 0;
    let spawned = survival ? survivalBossSummonsSpawned : stageBossSummonsSpawned;
    if (!summonCap || spawned >= summonCap || !boss || zombies.pool.activeCount >= (survival ? 22 : CAMPAIGN_ACTIVE_ZOMBIE_LIMIT)) return;
    const summonIds = stage.id === 10 ? ['normal', 'runner', 'spitter'] : ['normal', 'normal', 'normal', 'normal'];
    for (let i = 0; i < 2 && spawned < summonCap && zombies.pool.activeCount < (survival ? 22 : CAMPAIGN_ACTIVE_ZOMBIE_LIMIT); i++) {
      const type = ZOMBIE_TYPES.find(entry => entry.id === summonIds[spawned % summonIds.length]);
      if (!type) continue;
      const angle = Math.PI * (.35 + i * .3);
      const mob = zombies.spawn(type, boss.x + Math.cos(angle) * 105, boss.y + Math.sin(angle) * 105, 1, 1, 1);
      if (!survival) {
        mob.campaignZoneIndex = stage.layout?.zones.length ? stage.layout.zones.length - 1 : -1;
        mob.hp = Math.round(mob.hp * stage.difficultyMult); mob.maxHp = mob.hp;
        mob.damage = Math.round(mob.damage * stage.difficultyMult);
      }
      [mob.x, mob.y] = resolveBuildingCollision(mob.x, mob.y, survival ? mob.size * .72 : mob.size);
      spawned++;
    }
    if (survival) survivalBossSummonsSpawned = spawned;
    else stageBossSummonsSpawned = spawned;
  }, (move, actor, angle) => {
    const muzzle = actor.size * .72;
    if (move.kind === 'ring') {
      const projectileType: 'boss_acid' | 'boss_shard' | 'boss_wave' = stage.id === 10
        ? 'boss_wave' : [2, 4, 8, 9].includes(stage.id) ? 'boss_acid' : 'boss_shard';
      const count = stage.id === 1 ? 8 : stage.id >= 8 ? 18 : stage.id >= 5 ? 15 : 12;
      const speed = stage.id === 1 ? 118 : stage.id >= 8 ? 188 : stage.id >= 5 ? 164 : 142;
      const damage = Math.max(5, Math.round(move.damage * (stage.id === 1 ? .38 : .48)));
      enemyProjectiles.fireRing(actor.x, actor.y, count, speed, damage, projectileType, Math.random() * Math.PI * 2);
      camera.shake(stage.id === 1 ? 2 : 3.1, .16);
      particles.emit(actor.x, actor.y, 12, projectileType === 'boss_acid' ? '#a7c568' : '#c8c5b7', 82, .3, 3.6);
      return;
    }
    if (move.kind !== 'fan') return;
    const type = stage.id === 2 || [4, 8, 9].includes(stage.id) ? 'boss_acid' : 'boss_shard';
    const count = stage.id === 1 ? 7 : stage.id >= 7 ? 10 : stage.id >= 5 ? 9 : stage.id === 2 ? 9 : 8;
    const spread = stage.id === 2 ? .68 : stage.id >= 7 ? .44 : .48;
    // The lock stays inside the telegraphed lane, while each volley shifts a
    // little so the boss does not trace the same exact line every time.
    const volleyAngle = angle + (Math.random() - .5) * .2;
    enemyProjectiles.fireFan(actor.x + Math.cos(angle) * muzzle, actor.y + Math.sin(angle) * muzzle,
      volleyAngle, count, spread, stage.id === 1 ? 320 : stage.id === 2 ? 310 : 390, move.damage, type);
    camera.shake(stage.id === 2 ? 2.4 : 1.7, .12);
    particles.emit(actor.x + Math.cos(angle) * muzzle, actor.y + Math.sin(angle) * muzzle,
      stage.id === 2 ? 8 : 7, type === 'boss_acid' ? '#a7c568' : '#c8c5b7', 65, .24, 3);
  });
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
    audio.objectiveComplete();
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
  bloodStains.add(z.x, z.y, z.size, z.isBoss, z.facingAngle);
  if (gameMode === 'endless') horrorRemains.add(z);

  player.kills++;
  weapons.loadout.addRageOnKill();

  if (z.isBoss) {
    bossKilledThisRun = true;
    camera.shake(8, 0.3);
    particles.emit(z.x, z.y, 16, '#ff44ff', 140, 0.6, 4);
    if (gameMode === 'stage') collapseCampaignBossRoomSpawns();
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
    if (z.isBoss) {
      const reward = campaignGuns.find(gun => !['p9', 'ar7'].includes(gun.id) && !weapons.loadout.hasGun(gun.id));
      if (reward) mapPickups.spawnWeaponPickup(z.x, z.y, reward.id, true);
      const finiteAmmoSlot = weapons.loadout.canAddAmmoForGun(weapons.loadout.activeSlot.def.id)
        ? weapons.loadout.activeSlot : weapons.loadout.unlockedSlots.find(slot => weapons.loadout.canAddAmmoForGun(slot.def.id));
      if (finiteAmmoSlot) {
        mapPickups.spawnAmmoPickup(z.x + (reward ? 28 : 0), z.y + (reward ? 10 : 0), finiteAmmoSlot.def.id,
          finiteAmmoSlot.def.magSize * (reward ? 2 : 3));
      }
    } else if (!weapons.loadout.hasGun('sg12')) {
      mapPickups.spawnWeaponPickup(z.x, z.y, 'sg12');
    } else if (!weapons.loadout.hasGun('smg9')) {
      mapPickups.spawnWeaponPickup(z.x, z.y, 'smg9');
    }
  }

  if (gameMode === 'endless' && !z.isBoss && Math.random() < (z.isElite ? .24 : .085)
      && mapPickups.pool.getActive().filter(item => item.itemId.startsWith('ammo_')).length < 22) {
    const candidates = weapons.loadout.unlockedSlots.filter(slot => weapons.loadout.canAddAmmoForGun(slot.def.id));
    if (candidates.length) {
      const chapterStep = Math.min(10, Math.floor(survivalWave / 3) + 2);
      const eligibleGuns = campaignGuns.filter(gun => (gun.unlockStage ?? 1) <= chapterStep);
      const preferredId = eligibleGuns[eligibleGuns.length - 1]?.id;
      const totalWeight = candidates.reduce((sum, slot) => sum + (slot.def.id === preferredId ? 5 : slot === weapons.loadout.activeSlot ? 2 : 1), 0);
      let roll = Math.random() * totalWeight;
      for (const slot of candidates) {
        roll -= slot.def.id === preferredId ? 5 : slot === weapons.loadout.activeSlot ? 2 : 1;
        if (roll > 0) continue;
        mapPickups.spawnAmmoPickup(z.x, z.y, slot.def.id, slot.def.magSize * (z.isElite ? 2 : 1));
        break;
      }
    }
  }

  if (player.lifestealAmount > 0) {
    player.heal(player.lifestealAmount);
  }
  if (z.isBoss || z.isElite) {
    const healing = upgradeValue('field_medic');
    if (healing > 0) {
      player.heal(healing);
      damageNumbers.spawn(player.x, player.y - 24, healing, '#8bbf78', false, '+');
      particles.emit(player.x, player.y, 6, '#8bbf78', 48, .28, 2.3);
    }
  }

  if (gameMode === 'stage') {
    const threat = z.campaignBossId !== null ? 100 + currentStageIndex * 25
      : z.isElite ? 15 : ['rat_king', 'mutant', 'multihead', 'tank'].includes(z.typeId) ? 8
      : ['runner', 'spider', 'spitter', 'armed', 'exploder'].includes(z.typeId) ? 4 : 2;
    const guaranteedCredit = z.campaignBossId !== null || z.isElite;
    const dropChance = guaranteedCredit ? 1 : threat >= 8 ? .82 : threat >= 4 ? .72 : .62;
    if (Math.random() < dropChance) {
      const valueScale = z.campaignBossId !== null ? .82 : z.isElite ? .78 : .65;
      campaignCredits.drop(z.x, z.y, Math.max(1, Math.floor(threat * valueScale)));
    }
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
    particles.burst(z.x, z.y, 26, '#a92731', Math.random() * Math.PI * 2, Math.PI * 2, 185, .48);
    particles.emit(z.x, z.y, 14, '#702126', 95, .62, 5);
    handleExplosion(z.x, z.y, z.explosionRadius, z.explosionDamage, 1.85);
  } else {
    // Normal / Elite zombie death
    const bloodCount = z.isBoss ? 24 : z.isElite ? 12 : 8;
    particles.burst(z.x, z.y, bloodCount, '#bb1122', Math.random() * Math.PI * 2, Math.PI * 2,
      z.isBoss ? 145 : z.isElite ? 112 : 94, z.isBoss ? .38 : .3);
    particles.emit(z.x, z.y, 3, z.color, 60, 0.2, 2.5);
    camera.shake(z.isBoss ? 8 : z.isElite ? 1.8 : 0.6, z.isBoss ? 0.3 : 0.05);
  }

  zombies.pool.release(z);
}

/** Collapse only the boss-arena portals. Already spawned support mobs remain alive. */
function collapseCampaignBossRoomSpawns(): void {
  const bossZoneIndex = STAGES[currentStageIndex]?.layout?.zones.length;
  if (bossZoneIndex === undefined || bossZoneIndex <= 0) return;
  const bossZone = bossZoneIndex - 1;
  const collapsedPoints: Point[] = [];
  const addPoint = (point: Point): void => {
    if (!collapsedPoints.some(existing => existing.x === point.x && existing.y === point.y)) collapsedPoints.push(point);
  };

  for (let waveIndex = campaignWaveQueue.length - 1; waveIndex >= 0; waveIndex--) {
    const wave = campaignWaveQueue[waveIndex];
    if (wave.zoneIndex !== bossZone) continue;
    for (let portalIndex = 0; portalIndex < wave.portalPoints.length; portalIndex++) {
      if (wave.sealedPortals[portalIndex]) continue;
      wave.sealedPortals[portalIndex] = true;
      wave.portalHp[portalIndex] = 0;
      campaignDestroyedPortals.add(campaignPortalKey(bossZone, wave.portalPoints[portalIndex]));
      addPoint(wave.portalPoints[portalIndex]);
    }
    // Discard only the pending boss-room spawn queue. Zombies already spawned
    // are independent entities and will continue fighting the player.
    campaignWaveQueue.splice(waveIndex, 1);
  }

  if (campaignPortalFlash?.zoneIndex === bossZone) {
    addPoint(campaignPortalFlash.point);
    campaignDestroyedPortals.add(campaignPortalKey(bossZone, campaignPortalFlash.point));
    campaignPortalFlash = null;
  }
  campaignSealedSpawnZones.add(bossZone);
  if (!collapsedPoints.length) return;

  for (const point of collapsedPoints) {
    particles.burst(point.x, point.y, 24, '#9b3938', Math.random() * Math.PI * 2, Math.PI * 2, 112, .42);
    particles.emit(point.x, point.y, 10, '#443330', 54, .45, 4);
  }
  camera.shake(2.8, .22);
  audio.explosion();
}

function handleExplosion(x: number, y: number, radius: number, damage: number, visualScale = 1.35): void {
  audio.explosion();
  camera.shake(4.2, 0.18);
  explosionEffects.spawn(x, y, Math.max(82, radius * visualScale));
  particles.emit(x, y, 22, '#ff672b', 180, 0.38, 5.5);
  particles.emit(x, y, 12, '#ffd45f', 140, 0.24, 4);
  particles.burst(x, y, 16, '#9f2a2c', Math.random() * Math.PI * 2, Math.PI * 2, 165, 0.42);

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
    bloodStains.draw(ctx, camera);
    LightingRenderer.get().drawCampaignLighting(ctx, camera, campaignStage, player.x, player.y, player.aimAngle, viewportWidth, viewportHeight);
    weapons.loadout.casings.draw(ctx, camera);
    const queuedWave = campaignWaveQueue[0];
    const visiblePortalFlash = campaignPortalFlash && campaignPortalFlash.timer > 0 ? campaignPortalFlash : undefined;
    const spawnCue = queuedWave?.started
      ? { ...queuedWave, gameTime, sealedPortalPoints: queuedWave.sealedPortals, playerX: player.x, playerY: player.y,
          activePortalPoint: visiblePortalFlash?.point, activePortalTimer: visiblePortalFlash?.timer }
      : visiblePortalFlash
        ? { zoneIndex: visiblePortalFlash.zoneIndex, portalPoints: [visiblePortalFlash.point], warningTimer: 0,
            gameTime, playerX: player.x, playerY: player.y, activePortalPoint: visiblePortalFlash.point, activePortalTimer: visiblePortalFlash.timer }
        : undefined;
    campaignMapRenderer.draw(ctx, camera, campaignStage, stageObjectiveIndex, stageBossSpawned, stageExitActive, stageExitActivated,
      stageObjectiveHp, spawnCue, { playerX: player.x, playerY: player.y, gameTime, holdStarted: stageObjectiveHoldStarted, exitInteractable: !bossWeaponDrop });
    campaignResources.draw(ctx, camera);
  } else {
    groundRenderer.draw(ctx, camera);
    bloodStains.draw(ctx, camera);
    drawMapBorder();
    weapons.loadout.casings.draw(ctx, camera);
    propRenderer.draw(ctx, camera, 'ground', true);
  }

  if (gameMode === 'endless') {
    horrorRemains.draw(ctx, camera);
  }
  zombies.drawWarnings(ctx, camera);
  const directorStageId = campaignStage?.id ?? (gameMode === 'endless' && survivalPhase === 'boss' ? survivalBossStageId : 0);
  if (directorStageId) campaignBossDirector.draw(ctx, camera, zombies.pool.getActive().find((z) => z.campaignBossId === directorStageId));

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
  explosionEffects.draw(ctx, camera);
  damageNumbers.draw(ctx, camera);

  // Floating reload indicator in world coordinates
  weapons.loadout.drawInWorld(ctx, camera, player);
  if (campaignStage) drawCampaignHoldProgress(campaignStage);

  ctx.restore();
  
  LightingRenderer.get().drawVignette(ctx, campaignStage ? .25 : 1);

  if (previewCleanCapture) return;

  // HUD
  const campaignBossForHud = campaignStage && stageBossSpawned
    ? zombies.pool.getActive().find(z => z.campaignBossId === campaignStage.id && z.hp > 0)
    : undefined;
  const survivalBossForHud = gameMode === 'endless' && survivalPhase === 'boss'
    ? zombies.pool.getActive().find(z => z.campaignBossId === survivalBossStageId && z.hp > 0)
    : undefined;
  hud.draw(ctx, viewportWidth, viewportHeight, player, gameTime, input, zombies, mapPickups, camera,
    campaignStage ? { stage: campaignStage, activeNode: stageObjectiveIndex, bossSpawned: stageBossSpawned,
      bossName: campaignStage.bossName,
      bossHpRatio: campaignBossForHud ? campaignBossForHud.hp / Math.max(1, campaignBossForHud.maxHp) : 0,
      exitActive: stageExitActive, exitActivated: stageExitActivated,
      credits: save.data.campaign.credits, creditGain: creditGainTimer > 0 ? lastCreditGain : 0 } : undefined,
    gameMode === 'endless' && !previewEncounter ? {
      wave: Math.max(1, survivalWave), phase: survivalPhase,
      bossName: survivalPhase === 'boss' || survivalPhase === 'boss-warning'
        ? STAGES.find(value => value.id === survivalBossStageId)?.bossName : undefined,
      bossHpRatio: survivalBossForHud ? survivalBossForHud.hp / Math.max(1, survivalBossForHud.maxHp) : 0,
    } : undefined);

  // Active buffs display
  drawActiveBuffs();

  // Stage mode objective display
  if (gameMode === 'stage' && currentStageIndex < STAGES.length) {
    drawStageObjective();
  }

  // ─── Tactical Gun Loadout Bottom HUD Card (Matches User Spec) ───
  if (menuUI.currentScreen === 'playing') {
    weapons.loadout.drawHUD(ctx, viewportWidth, viewportHeight, player);
    drawTouchActionButtons(ctx, viewportWidth, viewportHeight, {
      dashCooldown: player.dashCooldown,
      dashCooldownMax: player.dashMaxCooldown,
      ragePercent: weapons.loadout.ragePercent,
      rageCooldown: weapons.loadout.rageCooldownTimer,
      rageCooldownMax: weapons.loadout.rageCooldownDuration,
      rageActiveTimer: weapons.loadout.rageActiveTimer,
    });
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
  const y = !stageBossSpawned && viewportWidth >= 700 && viewportWidth < 1050 ? 117 : 70;

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
    const holdNear = holding && Math.hypot(player.x - node.x, player.y - node.y) <= 110;
    const holdSeconds = stage.objectiveHoldSeconds ?? 5;
    objectiveText = stage.id === 10 || stage.id === 9 && stageObjectiveIndex < 2
      ? `BẮN PHÁ Ổ DỊCH / LÕI  ${stageObjectiveIndex + 1}/${stage.objectiveNodes.length}  •  ${Math.max(0, Math.ceil(stageObjectiveHp))} HP`
      : holding
      ? stage.id === 9 && !stageObjectiveHoldStarted
        ? `PHÁ Ổ DỊCH CUỐI${near ? '  •  NHẤN E ĐỂ BẮT ĐẦU' : '  •  ĐẾN GẦN Ổ DỊCH'}`
        : holdNear
          ? `GIỮ VỊ TRÍ  •  ${stageObjectiveHoldTime.toFixed(1)}/${holdSeconds}s`
          : `ĐI VÀO VÙNG SÁNG  •  GIỮ ${holdSeconds} GIÂY`
      : `${stage.objectiveLabel}  ${stageObjectiveIndex}/${stage.objectiveNodes.length}${near ? '  •  NHẤN E ĐỂ TƯƠNG TÁC' : '  •  THEO DẤU CHỈ HƯỚNG'}`;
    if (holding) {
      ctx.fillStyle = 'rgba(38,43,41,.95)'; ctx.fillRect(x - panelW*.38, y + 27, panelW*.76, 3);
      ctx.fillStyle = '#a8c08b'; ctx.fillRect(x - panelW*.38, y + 27, panelW*.76 * Math.min(1, stageObjectiveHoldTime / (stage.objectiveHoldSeconds ?? 5)), 3);
    }
  }
  if (stageExitActive && stage.exitSpawn && !stageExitActivated) {
    const nearExit = Math.hypot(player.x - stage.exitSpawn.x, player.y - stage.exitSpawn.y) <= 88;
    objectiveText = nearExit ? 'ĐIỂM THOÁT ĐÃ MỞ  •  NHẤN E ĐỂ KẾT THÚC' : 'ĐI THEO DẤU CHỈ HƯỚNG ĐẾN ĐIỂM THOÁT';
  }
  if (bossWeaponDrop) objectiveText = `NHẶT ${campaignGuns.find(gun => gun.id === bossWeaponDrop!.gunId)?.shortName ?? 'VŨ KHÍ'} BOSS ĐỂ MỞ ĐIỂM THOÁT`;
  if (campaignActiveWaveZones.has(currentZoneIndex)) {
    const holdingObjective = stage.objectiveHoldAt === stageObjectiveIndex && stage.layout?.zones[currentZoneIndex]?.role === 'hold';
    const holdNode = holdingObjective ? stage.objectiveNodes[stageObjectiveIndex] : undefined;
    const atHoldPoint = !!holdNode && Math.hypot(player.x - holdNode.x, player.y - holdNode.y) <= 110;
    const holdSeconds = stage.objectiveHoldSeconds ?? 5;
    const canShootPortal = campaignWaveQueue.some(wave => wave.zoneIndex === currentZoneIndex && wave.remaining > 0 && wave.sealedPortals.some(sealed => !sealed));
    if (holdingObjective) {
      const holdStatus = stage.id === 9 && !stageObjectiveHoldStarted
        ? atHoldPoint ? 'NHẤN E ĐỂ BẮT ĐẦU' : 'ĐI VÀO VÙNG SÁNG'
        : atHoldPoint ? `GIỮ VỊ TRÍ ${stageObjectiveHoldTime.toFixed(1)}/${holdSeconds}s` : `ĐI VÀO VÙNG SÁNG • GIỮ ${holdSeconds}s`;
      objectiveText = `${holdStatus}${canShootPortal ? ' • BẮN PHÁ Ổ SPAWN' : ''}`;
    } else objectiveText = `GIAO TRANH • HẠ QUÁI${canShootPortal ? ' / BẮN PHÁ Ổ SPAWN' : ''}`;
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

function drawCampaignHoldProgress(stage: typeof STAGES[number]): void {
  if (stage.id === 9 && !stageObjectiveHoldStarted) return;
  if (stage.objectiveHoldAt !== stageObjectiveIndex || stageBossSpawned) return;
  const node = stage.objectiveNodes[stageObjectiveIndex];
  if (!node || Math.hypot(player.x - node.x, player.y - node.y) > 110) return;

  const duration = stage.objectiveHoldSeconds ?? 5;
  const progress = Math.max(0, Math.min(1, stageObjectiveHoldTime / duration));
  const remaining = Math.max(0, duration - stageObjectiveHoldTime);
  const [x, y] = camera.worldToScreen(player.x, player.y - player.size - 58);
  const panelW = 126;
  const panelH = 31;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#ffd47d';
  ctx.shadowBlur = 8;
  ctx.fillStyle = 'rgba(10, 14, 15, .94)';
  ctx.strokeStyle = `rgba(255, 211, 126, ${.72 + .2 * Math.sin(gameTime * 7)})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x - panelW / 2, y - panelH / 2, panelW, panelH, 6);
  ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff0ca';
  ctx.font = `bold 9px 'Segoe UI', Arial, sans-serif`;
  ctx.fillText(`GIỮ VỊ TRÍ  •  ${remaining.toFixed(1)}s`, x, y - 7);
  ctx.fillStyle = 'rgba(57, 62, 57, .96)';
  ctx.fillRect(x - 52, y + 3, 104, 5);
  ctx.fillStyle = progress >= 1 ? '#b9f28c' : '#ffd47d';
  ctx.fillRect(x - 52, y + 3, 104 * progress, 5);
  ctx.restore();
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
    if (!previewEncounter) {
      stock.ammoPacks = 0;
      stock.medKits = 0;
      stock.lastStage = currentStageIndex + 1;
      stock.hasCheckpoint = true;
      save.save();
    }
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
  campaignDestroyedPortals.clear();
  campaignSealedSpawnZones.clear();
  campaignWaveQueue.length = 0;
  explosionEffects.clear();
  campaignPortalFlash = null;
  campaignSupplyNotice = '';
  campaignSupplyNoticeTimer = 0;
  campaignWaveAlertText = '';
  campaignWaveAlertTimer = 0;
  campaignEncounterTriggered = false;
  campaignWavePreview = false;
  campaignHoldWaveTimer = 5.5;
  campaignBossWaveTimer = 0;
  campaignBossDirector.reset();
  survivalWave = 0;
  survivalPhase = 'intermission';
  survivalPhaseTimer = 2.7;
  survivalSpawnRemaining = 0;
  survivalBossStageId = 0;
  survivalBossSummonsSpawned = 0;
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
  bloodStains.clear();
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
