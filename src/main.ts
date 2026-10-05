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
import { MenuUI } from './ui/menu';
import { CrosshairRenderer } from './ui/crosshair';
import { drawTouchActionButtons } from './ui/touch-controls';
import { UI_PALETTE } from './ui/palette';

import { MAP_CONFIG, PLAYER_DEFAULTS, WEAPON_PARTS } from './data/items';
import { PERM_UPGRADES, CHARACTERS, STAGES, type CampaignZone, type Point, type StageDef } from './data/meta';
import { UPGRADES } from './data/upgrades';
import { getCampaignGunnerAttack, getCampaignVariantAttack, getHorrorAttack, CAMPAIGN_VARIANT_TYPES, HORROR_TYPES, ZOMBIE_TYPES, type ZombieTypeDef } from './data/zombies';
import { horrorAttackHits } from './systems/horror-ai';
import { HorrorRemains } from './entities/horror-remains';
import { BloodStains } from './entities/blood-stains';
import { campaignSpawnPosition, isCampaignGateClosed, isCampaignWalkable, isInsideBuilding, nearestCampaignZone, resolveBuildingCollision, setCampaignGateState, setCampaignGeometry } from './entities/map-geometry';
import { CampaignMapRenderer } from './graphics/campaign-map-renderer';
import { CampaignTerrainRenderer } from './graphics/campaign-terrain';
import { CampaignBossDirector } from './systems/campaign-boss';
import { canDamageCampaignSpawnPortal } from './systems/campaign-portal-rules';
import { CampaignResources } from './systems/campaign-resources';
import { CampaignUI } from './ui/campaign-ui';
import { createCampaignGunDefs } from './systems/gun-loadout';
import { getStageCopy, getUiTerm, localizeZoneName, sentenceCaseDisplay } from './data/localization';

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
audio.setMusicEnabled(save.data.musicEnabled);
const horrorRemains = new HorrorRemains();
const bloodStains = new BloodStains();
const groundRenderer = new GroundRenderer();
const propRenderer = new PropRenderer();
const campaignMapRenderer = new CampaignMapRenderer();
const campaignTerrainRenderer = new CampaignTerrainRenderer();
const campaignBossDirector = new CampaignBossDirector();
const campaignResources = new CampaignResources();

type DevPerformanceOverlay = import('./dev/performance-overlay').PerformanceOverlay;
let devPerformanceOverlay: DevPerformanceOverlay | null = null;
let performanceUpdateMs = 0;
let performanceZombieUpdateMs = 0;
let performanceRenderMs = 0;
let lastIdleUiRenderAt = -Infinity;
let lastIdleUiScreen = '';

if (import.meta.env.DEV) {
  void import('./dev/performance-overlay').then(({ PerformanceOverlay }) => {
    devPerformanceOverlay = new PerformanceOverlay();
  });
}

function shouldRenderIdleUi(timestamp: number, forced: boolean): boolean {
  const screen = menuUI.currentScreen;
  const screenChanged = screen !== lastIdleUiScreen;
  const intervalElapsed = timestamp - lastIdleUiRenderAt >= 1000 / 30;
  if (!forced && !screenChanged && !intervalElapsed) return false;
  lastIdleUiRenderAt = timestamp;
  lastIdleUiScreen = screen;
  return true;
}

function renderMeasured(timestamp: number, render: () => void): void {
  const start = performance.now();
  render();
  performanceRenderMs = performance.now() - start;
  const overlay = devPerformanceOverlay;
  if (!overlay?.isEnabled) return;
  const blood = bloodStains.performanceStats;
  const sound = audio.performanceStats;
  const bullet = bullets.performanceStats;
  const lighting = LightingRenderer.get().performanceStats;
  overlay.draw(ctx, timestamp, {
    updateMs: performanceUpdateMs,
    zombieUpdateMs: performanceZombieUpdateMs,
    renderMs: performanceRenderMs,
    zombies: zombies.pool.activeCount,
    playerBullets: bullet.activeBullets,
    enemyBullets: enemyProjectiles.pool.activeCount,
    particles: particles.pool.activeCount,
    bloodCells: blood.cells,
    bloodCanvases: blood.canvasCount,
    bloodCanvasBytes: blood.estimatedCanvasBytes,
    bloodStainRecords: blood.stainRecords,
    visibleLamps: lighting.visibleCampaignLamps,
    audioClips: sound.loadedRecordedClips,
    queuedAudioClips: sound.queuedRecordedClips,
    audioVoices: sound.activeRecordedVoices,
    audioBytes: sound.decodedAudioBytes,
  });
}

// ─── UI ───
const hud = new HUD();
const menuUI = new MenuUI();
const campaignUI = new CampaignUI();

// ─── Game State ───
let gameTime = 0;
let paused = false;
let lastTimestamp = 0;
let gameMode: 'endless' | 'stage' = 'endless';
let currentStageIndex = 0;
let stageComplete = false;
let campaignSessionEnded = false;
let bossKilledThisRun = false;
let bossWeaponDrop: (Point & { gunId: string }) | null = null;
let stageObjectiveIndex = 0;
let stageBossSpawned = false;
let stageObjectiveHoldTime = 0;
let stageObjectiveHoldStarted = false;
let stageBossSummonsSpawned = 0;
let campaignBossAddsSpawned = 0;
let campaignNestCharge: {
  stageId: number;
  pickupPoint: Point;
  targetPoint: Point;
  status: 'available' | 'carried' | 'planted' | 'destroyed' | 'cancelled';
  fuseRemaining: number;
  fuseDuration: number;
} | null = null;
let stageExitActive = false;
let stageExitActivated = false;
const campaignTriggeredZones = new Set<number>();
const campaignActiveWaveZones = new Set<number>();
const campaignTriggeredTransitLinks = new Set<number>();
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
  groupBreakTimer: number;
  countsForGate: boolean;
  supportOnly: boolean;
}
const campaignWaveQueue: CampaignWaveQueueEntry[] = [];
let campaignPortalFlash: { zoneIndex: number; point: Point; timer: number } | null = null;
let campaignBossPortals: { zoneIndex: number; points: Point[]; hp: number[]; maxHp: number } | null = null;
let campaignWaveAlertText = '';
let campaignWaveAlertTimer = 0;
let campaignEncounterTriggered = false;
let campaignBossWaveTimer = 0;
let campaignGunnerSoundCooldown = 0;
const CAMPAIGN_SPAWN_PRESSURE_MULTIPLIER = 6;
const CAMPAIGN_MOB_HP_MULTIPLIER = 1.15;
const CAMPAIGN_STAGE_WAVE_MULTIPLIERS: Readonly<Record<number, number>> = { 8: 0.5 };
const CAMPAIGN_ACTIVE_ZOMBIE_LIMIT = 120;
const CAMPAIGN_BOSS_ACTIVE_ADD_LIMIT = 6;
const CAMPAIGN_BOSS_ADD_TOTAL_LIMIT = 9;
const CAMPAIGN_BOSS_NEST_HP_BASE = 600;
const CAMPAIGN_BOSS_NEST_HP_PER_STAGE = 95;
const CAMPAIGN_WAVE_WARNING_SECONDS = 1.65;
const CAMPAIGN_WAVE_GROUP_BREAK = 1.6;
const CAMPAIGN_MIN_PORTAL_DISTANCE = 300;
const CAMPAIGN_PORTAL_SCATTER: ReadonlyArray<readonly [number, number]> = [
  [0,0],[-38,-20],[38,20],[-22,38],[22,-38],[-48,26],[48,-26],[0,48],
];

function campaignDifficultyFactors(): { health: number; damage: number } {
  switch (save.data.campaign.difficulty) {
    case 'hard': return { health: 1.3, damage: 1.3 };
    case 'impossible': return { health: 1.5, damage: 1.5 };
    default: return { health: 1, damage: 1 };
  }
}

function applyCampaignDifficultyToMob(mob: Zombie): void {
  const factors = campaignDifficultyFactors();
  mob.hp = Math.max(1, Math.round(mob.hp * factors.health));
  mob.maxHp = mob.hp;
  mob.damage = Math.max(1, Math.round(mob.damage * factors.damage));
}

function campaignStageMobHealthMultiplier(stageId: number, mobId: string): number {
  if (stageId !== 8) return 1;
  if (mobId === 'tank') return 0.65;
  if (mobId === 'mutant') return 0.72;
  if (mobId === 'multihead') return 0.68;
  return 1;
}

function showCampaignSkillDirections(): boolean {
  return gameMode !== 'stage' || save.data.campaign.difficulty === 'normal';
}

let lastCreditGain = 0;
let creditGainTimer = 0;
let campaignSupplyNotice = '';
let campaignSupplyNoticeTimer = 0;
let campaignMedkitFlashTimer = 0;
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
  const menuScene = menuUI.currentScreen === 'main' || menuUI.currentScreen === 'newgame' || menuUI.currentScreen === 'savegame' || menuUI.currentScreen === 'settings' || menuUI.currentScreen === 'campaign' || menuUI.currentScreen === 'hunter_profile' || menuUI.currentScreen === 'tutorial';
  if (menuScene) {
    activeMusicThreat = 'calm';
    hasSeenZombiesThisRun = false;
    audio.setMusicScene('menu');
    return;
  }
  if (menuUI.currentScreen === 'paused' || paused) {
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

  // Campaign boss rooms have an explicit scene mapped to Music 2. It remains
  // selected after the boss dies because stageBossSpawned stays true until exit.
  audio.setMusicScene(campaignBossRoomMusic ? 'campaignBoss' : activeMusicThreat);
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
      menuUI.reviveAdPending = false;
      campaignUI.reviveAdPending = false;
      const stillAtDeathScreen = menuUI.currentScreen === 'gameover' ||
        (gameMode === 'stage' && menuUI.currentScreen === 'campaign' && campaignUI.page === 'failure');
      const impossibleCampaign = gameMode === 'stage' && save.data.campaign.difficulty === 'impossible';
      if (!menuUI.canWatchRevive || !campaignUI.canWatchRevive || impossibleCampaign || !stillAtDeathScreen) return;
      menuUI.canWatchRevive = false;
      campaignUI.canWatchRevive = false;
      if (gameMode === 'stage') campaignSessionEnded = false;
      player.hp = Math.round(player.maxHp * 0.3);
      player.invulnTimer = 2.0;
      menuUI.currentScreen = 'playing';
      paused = false;
      particles.emit(player.x, player.y, 30, '#ffff00', 200, 0.8, 5);
      audio.revive();
      adWrapper.gameplayStart();
    } else if (placement === 'double_gold') {
      save.data.gold += goldEarned; // double it
      save.save();
      menuUI.finalGold = goldEarned * 2;
    }
  },
  onSkipped: (placement) => {
    if (placement === 'revive') {
      menuUI.reviveAdPending = false;
      campaignUI.reviveAdPending = false;
    }
  },
  onError: (placement) => {
    if (placement === 'revive') {
      menuUI.reviveAdPending = false;
      campaignUI.reviveAdPending = false;
    }
  },
});

// ─── Main Loop ───
function gameLoop(timestamp: number): void {
  requestAnimationFrame(gameLoop);

  const rawDt = (timestamp - lastTimestamp) / 1000;
  const dt = Math.min(rawDt, 0.1);
  lastTimestamp = timestamp;
  const updateStartedAt = performance.now();
  performanceZombieUpdateMs = 0;
  syncMusicForThreat();
  input.touchButtonsEnabled = menuUI.currentScreen === 'playing' && !paused;

  if (!spriteLoader.ready) {
    ctx.fillStyle = '#060906';
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(save.data.language === 'en' ? 'Loading assets' : 'Đang tải dữ liệu', viewportWidth / 2, viewportHeight / 2);
    return;
  }

  input.update();
  menuUI.setPointer(input.mouseX, input.mouseY);
  if (menuUI.currentScreen === 'paused' && input.pausePressed) handleMenuAction('resume');

  const click = input.uiClick;

  if (click && menuUI.currentScreen === 'playing' && !paused) {
    if (weapons.loadout.handleClick(click.x, click.y, viewportWidth, viewportHeight, audio)) input.clearUiFire();
  }

  // ─── Menu screens ───
  if (menuUI.currentScreen !== 'playing') {
    if (click) {
      if (menuUI.currentScreen === 'campaign') {
        const action = campaignUI.click(click.x, click.y, save);
        if (action === 'main') { menuUI.currentScreen = 'main'; gameMode = 'endless'; }
        else if (action === 'start' || action === 'retry') {
          gameMode = 'stage'; currentStageIndex = action === 'retry' && campaignUI.impossibleDeath
            ? 0 : campaignUI.selectedStage; previewEncounter = false; startGame();
        }
        else if (action === 'revive_ad') { audio.menuSelect(); handleMenuAction(action); }
        else if (action) audio.menuSelect();
      } else {
        const action = menuUI.handleClick(click.x, click.y, viewportWidth, viewportHeight, audio, save);
        handleMenuAction(action);
      }
    }

  }

  if (menuUI.currentScreen !== 'playing') {
    performanceUpdateMs = performance.now() - updateStartedAt;
    if (!shouldRenderIdleUi(timestamp, !!click)) return;

    // Draw appropriate screen at up to 30 FPS while keeping input and game
    // timing on the regular animation-frame loop.
    canvas.style.cursor = 'default';
    if (menuUI.currentScreen === 'campaign') {
      renderMeasured(timestamp, () => campaignUI.draw(ctx, viewportWidth, viewportHeight, save));
      return;
    }
    if (menuUI.currentScreen === 'main' || menuUI.currentScreen === 'newgame' || menuUI.currentScreen === 'savegame' || menuUI.currentScreen === 'settings' || menuUI.currentScreen === 'hunter_profile' || menuUI.currentScreen === 'tutorial') {
      renderMeasured(timestamp, () => menuUI.draw(ctx, viewportWidth, viewportHeight, save));
      return;
    }
    if (menuUI.currentScreen === 'paused') {
      renderMeasured(timestamp, () => {
        drawGame();
        menuUI.draw(ctx, viewportWidth, viewportHeight, save);
      });
      return;
    }
    if (menuUI.currentScreen === 'gameover') {
      renderMeasured(timestamp, () => {
        drawGame();
        menuUI.draw(ctx, viewportWidth, viewportHeight, save);
      });
      return;
    }
    if (menuUI.currentScreen === 'stage_complete' as any) {
      renderMeasured(timestamp, () => {
        drawGame();
        menuUI.draw(ctx, viewportWidth, viewportHeight, save);
      });
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
    performanceUpdateMs = performance.now() - updateStartedAt;
    if (!shouldRenderIdleUi(timestamp, false)) return;
    renderMeasured(timestamp, () => {
      drawGame();
      menuUI.draw(ctx, viewportWidth, viewportHeight, save);
    });
    return;
  }

  updateGame(dt);
  performanceUpdateMs = performance.now() - updateStartedAt;
  renderMeasured(timestamp, drawGame);
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
    case 'open_new_game':
      menuUI.confirmNewGame = false;
      menuUI.newGameStep = 'mode';
      menuUI.selectedCampaignDifficulty = 'normal';
      menuUI.currentScreen = 'newgame';
      break;
    case 'open_new_game_confirm':
      menuUI.confirmNewGame = true;
      break;
    case 'cancel_new_game':
      menuUI.confirmNewGame = false;
      break;
    case 'new_game':
      menuUI.confirmNewGame = false;
      save.resetCampaign(menuUI.selectedCampaignDifficulty);
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
    case 'open_settings':
      menuUI.currentScreen = 'settings';
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
      if (gameMode === 'stage' && !previewEncounter) {
        persistCampaignAmmo();
        campaignSessionEnded = true;
      }
      resetGame();
      if (gameMode === 'stage' && !previewEncounter) { campaignUI.page = 'stages'; menuUI.currentScreen = 'campaign'; }
      else menuUI.currentScreen = 'main';
      break;
    case 'retry':
      if (gameMode === 'endless' && menuUI.currentScreen === 'gameover') endRun();
      previewEncounter = false;
      startGame();
      break;
    case 'revive_ad':
      if (menuUI.canWatchRevive && !menuUI.reviveAdPending &&
          !(gameMode === 'stage' && save.data.campaign.difficulty === 'impossible')) {
        menuUI.reviveAdPending = true;
        campaignUI.reviveAdPending = true;
        adWrapper.showRewarded('revive');
      }
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
  campaignMedkitFlashTimer = Math.max(0, campaignMedkitFlashTimer - dt);
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
  if (gameMode === 'stage') updateCampaignNestCharge(dt);

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
  const zombieUpdateStartedAt = performance.now();
  zombies.update(dt, player.x, player.y, true, z => {
    const distance = Math.hypot(z.x - player.x, z.y - player.y);
    const kind = getCampaignVariantAttack(z.typeId)?.burstCount ? 'projectile'
      : z.typeId === 'spider' ? 'charge'
        : z.typeId === 'mutant' || z.typeId === 'multihead' ? 'slam' : 'thrust';
    audio.creatureTelegraph(z.typeId, kind, Math.max(-1, Math.min(1, (z.x - player.x) / 600)), distance);
  });
  performanceZombieUpdateMs = performance.now() - zombieUpdateStartedAt;
  if (stage) {
    const boss = zombies.pool.getActive().find((z) => z.campaignBossId === stage.id);
    const bossDamage = updateBossEncounter(dt, stage, boss);
    if (bossDamage > 0) {
      const hit = applyPlayerDamage(bossDamage);
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
        const hit = applyPlayerDamage(bossDamage);
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
  campaignGunnerSoundCooldown = Math.max(0, campaignGunnerSoundCooldown - dt);
  if (spitterGlobalCooldown <= 0) {
    spitterGlobalCooldown = 1.5; // fire every 1.5s
    let campaignShots = 0;
    const campaignShotLimit = gameMode === 'stage' ? 5 : Infinity;
    for (const z of zombies.pool.getActive()) {
      // Campaign bosses use their own telegraphed attacks; the legacy ranged
      // loop must never add an unannounced projectile during their fight.
      if (!z.ranged || z.hp <= 0 || z.campaignBossId !== null || getCampaignGunnerAttack(z.typeId)) continue;
      const dx = player.x - z.x;
      const dy = player.y - z.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < z.attackRange && z.attackCooldown <= 0) {
        const angle = Math.atan2(dy, dx);
        enemyProjectiles.fire(z.x, z.y, angle, z.projectileSpeed, z.damage, 'poison');
        audio.creatureSkill(z.typeId, 'spit', Math.max(-1, Math.min(1, (z.x - player.x) / 600)), dist);
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
        audio.creatureSkill(z.typeId, 'ring', Math.max(-1, Math.min(1, (z.x - player.x) / 600)), Math.sqrt((z.x - player.x) ** 2 + (z.y - player.y) ** 2), true);
        enemyProjectiles.fireRing(z.x, z.y, 12, 120, z.damage, 'boss_orb');
        camera.shake(5, 0.2);
      } else if (bossAttackPhase % 3 === 1) {
        // Aimed burst at player
        audio.creatureSkill(z.typeId, 'fan', Math.max(-1, Math.min(1, (z.x - player.x) / 600)), Math.sqrt((z.x - player.x) ** 2 + (z.y - player.y) ** 2), true);
        const angle = Math.atan2(player.y - z.y, player.x - z.x);
        enemyProjectiles.fireBurst(z.x, z.y, 5, 150, z.damage, angle);
      } else {
        // Slow wave in all directions
        audio.creatureSkill(z.typeId, 'ring', Math.max(-1, Math.min(1, (z.x - player.x) / 600)), Math.sqrt((z.x - player.x) ** 2 + (z.y - player.y) ** 2), true);
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
      const hit = applyPlayerDamage(p.damage);
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
    if (gameMode === 'stage' && stageBossSpawned) {
      const stage = STAGES[currentStageIndex];
      const bossZoneIndex = (stage.layout?.zones.length ?? 0) - 1;
      const portals = campaignBossPortals;
      if (portals && portals.zoneIndex === bossZoneIndex) {
        for (let portalIndex = 0; portalIndex < portals.points.length; portalIndex++) {
          const point = portals.points[portalIndex];
          if (portals.hp[portalIndex] <= 0 || !canDamageCampaignSpawnPortal(stageBossSpawned,
              portals.zoneIndex, bossZoneIndex, isProtectedChargeTarget(stage, portals.zoneIndex, point))) continue;
          const dx = b.x - point.x, dy = b.y - point.y;
          const hitRadius = b.size + 46;
          if (dx * dx + dy * dy >= hitRadius * hitRadius) continue;
          portals.hp[portalIndex] = Math.max(0, portals.hp[portalIndex] - b.damage);
          for (const wave of campaignWaveQueue) {
            if (wave.zoneIndex !== portals.zoneIndex) continue;
            const waveIndex = wave.portalPoints.findIndex(candidate => candidate.x === point.x && candidate.y === point.y);
            if (waveIndex >= 0) wave.portalHp[waveIndex] = portals.hp[portalIndex];
          }
          particles.emit(point.x, point.y, 3, '#a23e3a', 38, .2, 2.2);
          if (portals.hp[portalIndex] <= 0) destroyCampaignPortalAt(stage, portals.zoneIndex, point);
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
        if (getHorrorAttack(z.typeId) || getCampaignVariantAttack(z.typeId)) {
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
    const variantAttack = getCampaignVariantAttack(z.typeId);
    const attack = getHorrorAttack(z.typeId) ?? variantAttack;
    if (z.campaignBossId !== null || z.hp <= 0 || !attack) continue;
    const distance = Math.hypot(player.x - z.x, player.y - z.y);
    const pan = Math.max(-1, Math.min(1, (z.x - player.x) / 420));
    if (z.specialStarted) {
      if (variantAttack?.burstCount && variantAttack.projectileType && variantAttack.bulletSpeed) {
        const muzzleX = z.x + Math.cos(z.specialAngle) * z.size * 1.8;
        const muzzleY = z.y + Math.sin(z.specialAngle) * z.size * 1.8;
        for (let shot = 0; shot < variantAttack.burstCount; shot++) {
          const spread = variantAttack.burstCount <= 1 ? 0 : (shot / (variantAttack.burstCount - 1) - .5) * (variantAttack.burstSpread ?? .14);
          enemyProjectiles.fire(muzzleX, muzzleY, z.specialAngle + spread, variantAttack.bulletSpeed,
            Math.max(1, Math.round(z.damage * (variantAttack.bulletDamageMult ?? .6))), variantAttack.projectileType);
        }
        const muzzleColor = z.typeId === 'gunner_red' ? '#ef6557' : z.typeId === 'gunner_orange' ? '#f1a34d' : '#dfd7a3';
        particles.emit(muzzleX, muzzleY, variantAttack.burstCount + 2, muzzleColor, 74, .14, 2.7);
        audio.creatureSkill(z.typeId, 'projectile', pan, distance);
        z.visualStrike = .18;
        if (campaignGunnerSoundCooldown <= 0) {
          audio.shoot(variantAttack.weaponSound ?? 'rifle');
          campaignGunnerSoundCooldown = .16;
        }
      } else {
        audio.creatureSkill(z.typeId, 'charge', pan, distance);
        audio.zombieAttack(pan, z.typeId, distance);
      }
      if (horrorPreview) previewAudit.attacks++;
    }
    if (!horrorAttackHits(z, player.x, player.y, player.size, true)) continue;
    z.specialHit = true;
    const hit = applyPlayerDamage(z.damage);
    if (hit.damaged) {
      audio.playerHit();
      camera.shake(z.typeId.includes('mutant') ? 2.8 : 2.1, 0.12);
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
    if ((getHorrorAttack(z.typeId) ?? getCampaignVariantAttack(z.typeId)) && z.campaignBossId === null) continue;
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
        const hit = applyPlayerDamage(z.damage);
        if (hit.dead) {
          handlePlayerDeath();
          return;
        }
        if (hit.medkitUsed) z.attackCooldown = 0.5;
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
    }
  }

  if (gameMode === 'stage') {
    const supplies = campaignResources.collectNearby(player, weapons.loadout, upgradeValue('ammo_scavenger', 1), save.data.language);
    if (supplies.length) {
      const last = supplies[supplies.length - 1];
      campaignSupplyNotice = supplies.length > 1
        ? `${last.label} · +${supplies.length - 1} ${save.data.language === 'en' ? 'crates' : 'thùng'}`
        : sentenceCaseDisplay(last.label, save.data.language);
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
        if (!item.isBossReward) return false;
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
      const gunName = campaignGuns.find(gun => gun.id === gunId)?.shortName ?? gunId.toUpperCase();
      campaignSupplyNotice = save.data.language === 'en' ? `${gunName} ammo +${added}` : `Đạn ${gunName} +${added}`;
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
      const gunName = campaignGuns.find(gun => gun.id === gunId)?.shortName ?? gunId.toUpperCase();
      campaignSupplyNotice = save.data.language === 'en'
        ? `Weapon recovered: ${gunName} · select with a number key`
        : `Đã nhặt ${gunName} · đổi bằng phím số`;
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
      const gunName = campaignGuns.find(gun => gun.id === gunId)?.shortName ?? gunId.toUpperCase();
      campaignSupplyNotice = save.data.language === 'en' ? `${gunName} ammo +${added}` : `Đạn ${gunName} +${added}`;
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
      const gunName = campaignGuns.find(gun => gun.id === gunId)?.shortName ?? gunId.toUpperCase();
      campaignSupplyNotice = wasOwned
        ? save.data.language === 'en' ? `${gunName} ammo refilled` : `Đã tiếp đạn ${gunName}`
        : save.data.language === 'en' ? `Weapon recovered: ${gunName} · select with a number key` : `Đã nhặt ${gunName} · đổi bằng phím số`;
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
  }
}

function handleCrateDestruction(crate: any): void {
  audio.explosion();
  camera.shake(5, 0.2);
  particles.emit(crate.x, crate.y, 15, '#ffaa00', 100, 0.5, 4);

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

function persistCampaignAmmo(force = false): void {
  if (gameMode !== 'stage' || previewEncounter || (campaignSessionEnded && !force) || !weapons.loadout.campaignMode) return;
  save.data.campaign.gunAmmo = weapons.loadout.getCampaignAmmoState();
  save.save();
}

function applyPlayerDamage(amount: number): ReturnType<Player['takeDamage']> {
  const hit = player.takeDamage(amount);
  const stock = save.data.campaign;
  if (!hit.dead || gameMode !== 'stage' || previewEncounter || stock.medKits <= 0) return hit;

  stock.medKits--;
  const healed = Math.max(1, Math.ceil(player.maxHp * .5));
  player.hp = Math.min(player.maxHp, healed);
  player.invulnTimer = Math.max(player.invulnTimer, 1.1);
  player.flashTimer = 0;
  campaignMedkitFlashTimer = .9;
  particles.emit(player.x, player.y, 28, '#67ef91', 145, .72, 4.5);
  damageNumbers.spawn(player.x, player.y - 24, healed, '#70f09a', false, '+');
  audio.supplyPickup('med');
  save.save();
  return { damaged: false, dead: false, actualDamage: 0, medkitUsed: true };
}

function handlePlayerDeath(): void {
  const impossibleCampaign = gameMode === 'stage' && save.data.campaign.difficulty === 'impossible';
  // Check for revive (perm upgrade or ad)
  if (hasRevive && !impossibleCampaign) {
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
    campaignSessionEnded = true;
    persistCampaignAmmo(true);
    campaignUI.impossibleDeath = impossibleCampaign;
    campaignUI.canWatchRevive = !impossibleCampaign;
    menuUI.canWatchRevive = !impossibleCampaign;
    if (impossibleCampaign) {
      hasRevive = false;
      save.resetCampaignAfterImpossibleDeath();
    }
    campaignUI.selectedStage = currentStageIndex;
    const totalScore = save.data.campaign.totalScore;
    campaignUI.showResult({ time: gameTime, kills: player.kills, reward: 0, newStage: 0,
      optional: campaignResources.used, score: 0, scoreAdded: 0, previousTotalScore: totalScore, totalScore });
    campaignUI.page = 'failure';
    menuUI.currentScreen = 'campaign';
    paused = true;
    return;
  }

  // Preview the reward here; commit the run only if the player declines revive
  // by retrying or returning to the menu.
  goldEarned = save.calculateGold(gameTime, player.kills, player.level);

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

function updateCampaignWaves(stage: typeof STAGES[number], dt: number): void {
  const layout = stage.layout;
  if (!layout) return;
  campaignWaveAlertTimer = Math.max(0, campaignWaveAlertTimer - dt);
  updateCampaignSpawnQueue(stage, dt);
  updateCampaignWaveClears(stage);
  updateCampaignTransitAmbushes(stage);

  if (stageBossSpawned) {
    if (bossKilledThisRun) return;
    const bossZoneIndex = layout.zones.length - 1;
    const bossWaveQueued = campaignWaveQueue.some(wave => wave.zoneIndex === bossZoneIndex);
    const livingBossAdds = zombies.pool.getActive().filter(z => z.hp > 0 && z.campaignZoneIndex === bossZoneIndex && z.campaignBossId === null).length;
    const queuedBossAdds = campaignWaveQueue.filter(wave => wave.zoneIndex === bossZoneIndex && wave.supportOnly)
      .reduce((sum, wave) => sum + wave.remaining, 0);
    if (!bossWaveQueued && livingBossAdds < CAMPAIGN_BOSS_ACTIVE_ADD_LIMIT &&
        !(campaignBossPortals?.zoneIndex === bossZoneIndex && campaignBossPortals.hp.every(hp => hp <= 0)) &&
        campaignBossAddsSpawned + queuedBossAdds < CAMPAIGN_BOSS_ADD_TOTAL_LIMIT &&
        zombies.pool.activeCount < CAMPAIGN_ACTIVE_ZOMBIE_LIMIT) campaignBossWaveTimer -= dt;
    if (campaignBossWaveTimer <= 0 && !bossWaveQueued) {
      campaignBossWaveTimer = Math.max(5.5, 8 - stage.id * .22);
      if (livingBossAdds < CAMPAIGN_BOSS_ACTIVE_ADD_LIMIT && campaignBossAddsSpawned + queuedBossAdds < CAMPAIGN_BOSS_ADD_TOTAL_LIMIT)
        spawnCampaignZoneWave(stage, bossZoneIndex, 1, true, true);
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
}

/** A small one-off patrol can interrupt the quiet walk between two authored rooms. */
function updateCampaignTransitAmbushes(stage: typeof STAGES[number]): void {
  const layout = stage.layout;
  if (!layout || !campaignEncounterTriggered || stageBossSpawned || bossKilledThisRun) return;
  // Keep the opening exploration quiet; route patrols begin after the first
  // authored encounter and stay out of the boss approach.
  for (let linkIndex = 1; linkIndex < layout.zones.length - 2; linkIndex++) {
    if (campaignTriggeredTransitLinks.has(linkIndex) || isCampaignGateClosed(linkIndex)) continue;
    const from = layout.zones[linkIndex];
    const to = layout.zones[linkIndex + 1];
    if (!from.waveTrigger || !campaignTriggeredZones.has(linkIndex)) continue;
    if (campaignWaveQueue.some(wave => wave.zoneIndex === linkIndex) ||
        zombies.pool.getActive().some(z => z.hp > 0 && z.campaignZoneIndex === linkIndex)) continue;
    if (campaignWaveQueue.some(wave => wave.zoneIndex === linkIndex + 1) || campaignActiveWaveZones.has(linkIndex + 1)) continue;

    const fromX = from.x + from.w / 2, fromY = from.y + from.h / 2;
    const toX = to.x + to.w / 2, toY = to.y + to.h / 2;
    const routeX = Math.round((fromX + toX) / 2);
    const routeY = Math.round((fromY + toY) / 2);
    const inZone = (zone: CampaignZone) => player.x >= zone.x && player.x <= zone.x + zone.w &&
      player.y >= zone.y && player.y <= zone.y + zone.h;
    if (inZone(from) || inZone(to) || Math.hypot(player.x - routeX, player.y - routeY) > 450) continue;

    const allowedIds = new Set([...from.mobs, ...to.mobs]);
    const roster = [...ZOMBIE_TYPES, ...HORROR_TYPES, ...CAMPAIGN_VARIANT_TYPES]
      .filter(type => !type.isBoss && stage.mobIds.includes(type.id) && allowedIds.has(type.id));
    if (!roster.length || zombies.pool.activeCount >= CAMPAIGN_ACTIVE_ZOMBIE_LIMIT - 3) continue;

    // Follow the authored L-shaped route: use its long axis for separation and
    // keep every emergence point inside the walkable corridor footprint.
    const offsets = Math.abs(toY - fromY) > 20
      ? [[0,-166],[0,166],[-76,0],[76,0],[0,-96],[0,96]]
      : [[-166,0],[166,0],[0,-76],[0,76],[-104,-54],[104,54]];
    const desiredCount = stage.id >= 5 && stage.id !== 8 ? 3 : 2;
    const chosen: Array<{ x: number; y: number; type: ZombieTypeDef }> = [];
    const distanceFromPlayer = Math.max(165, player.size + 68);
    for (let attempt = 0; attempt < offsets.length && chosen.length < desiredCount; attempt++) {
      const [ox, oy] = offsets[(attempt + (stage.id + linkIndex) % offsets.length) % offsets.length];
      const type = chooseCampaignWaveMob(roster, stage.id);
      const x = routeX + ox + (Math.random() - .5) * 24;
      const y = routeY + oy + (Math.random() - .5) * 24;
      const radius = type.size * .72;
      if (Math.hypot(player.x - x, player.y - y) < distanceFromPlayer ||
          !isCampaignWalkable(x, y, radius) || isInsideBuilding(x, y) ||
          campaignPointInsideBuildingFootprint(stage, x, y, radius) ||
          layout.decorations.some(prop => prop.solid && x + radius > prop.x && x - radius < prop.x + prop.w &&
            y + radius > prop.y && y - radius < prop.y + prop.h) ||
          zombies.pool.getActive().some(z => z.hp > 0 && Math.hypot(x - z.x, y - z.y) < (type.size + z.size) * .52) ||
          chosen.some(other => Math.hypot(x - other.x, y - other.y) < (type.size + other.type.size) * .72)) continue;
      chosen.push({ x, y, type });
    }
    if (!chosen.length) continue;

    for (const spawn of chosen) {
      const mob = zombies.spawn(spawn.type, spawn.x, spawn.y, 1, 1, 1);
      mob.campaignZoneIndex = linkIndex;
      mob.hp = Math.round(mob.hp * stage.difficultyMult * CAMPAIGN_MOB_HP_MULTIPLIER * campaignStageMobHealthMultiplier(stage.id, mob.typeId));
      mob.maxHp = mob.hp;
      mob.damage = Math.round(mob.damage * stage.difficultyMult);
      applyCampaignDifficultyToMob(mob);
      mob.speed *= 1.12;
      particles.emit(spawn.x, spawn.y, 4, '#866652', 32, .18, 1.8);
    }
    campaignTriggeredTransitLinks.add(linkIndex);
    campaignEncounterTriggered = true;
  }
}

function spawnCampaignZoneWave(stage: typeof STAGES[number], zoneIndex: number, count: number, useStageRoster = false, supportOnly = false): boolean {
  const zone = stage.layout?.zones[zoneIndex];
  if (!zone || count <= 0 || campaignSealedSpawnZones.has(zoneIndex)) return false;
  const allowedIds = useStageRoster || zone.mobs.length === 0 ? stage.mobIds : zone.mobs;
  let roster = [...ZOMBIE_TYPES, ...HORROR_TYPES, ...CAMPAIGN_VARIANT_TYPES]
    .filter(type => allowedIds.includes(type.id) && stage.mobIds.includes(type.id) && !type.isBoss);
  if (supportOnly) {
    const readableSupport = new Set(['normal', 'runner', 'orange_mutant', 'gunner', 'gunner_orange']);
    roster = roster.filter(type => readableSupport.has(type.id));
  }
  if (!roster.length) return false;
  const bossZoneIndex = (stage.layout?.zones.length ?? 0) - 1;
  const isBossSupport = stageBossSpawned && zoneIndex === bossZoneIndex && campaignBossPortals?.zoneIndex === zoneIndex;
  const portalPoints = isBossSupport
    ? campaignBossPortals!.points
    : chooseCampaignPortalPoints(stage, zoneIndex, 4);
  if (!portalPoints.length) return false;
  const bossPortalState = isBossSupport ? campaignBossPortals : null;
  if (bossPortalState && bossPortalState.hp.every(hp => hp <= 0)) return false;
  // Use one authored density multiplier: the old 10x and 3x settings stacked
  // into 30–42x and made each finite wave look endless. Later stages get a
  // small additional bump without multiplying the pressure setting again.
  const stageWaveMultiplier = CAMPAIGN_STAGE_WAVE_MULTIPLIERS[stage.id] ?? 1;
  const hordeMultiplier = stage.id === 1
    ? CAMPAIGN_SPAWN_PRESSURE_MULTIPLIER
    : Math.max(1, Math.round(CAMPAIGN_SPAWN_PRESSURE_MULTIPLIER * 1.4 * stageWaveMultiplier));
  const queuedBossAdds = campaignWaveQueue.filter(wave => wave.zoneIndex === zoneIndex && wave.supportOnly)
    .reduce((sum, wave) => sum + wave.remaining, 0);
  const total = supportOnly ? Math.min(3, CAMPAIGN_BOSS_ADD_TOTAL_LIMIT - campaignBossAddsSpawned - queuedBossAdds)
    : count * hordeMultiplier;
  if (total <= 0) return false;
  // Keep the original number of clear-and-pause groups while doubling the
  // enemies inside each group alongside the doubled wave budget.
  const groupSize = supportOnly ? total : 2 * Math.max(5, Math.min(10, 5 + Math.floor(stage.id / 2)));
  const portalMaxHp = CAMPAIGN_BOSS_NEST_HP_BASE + stage.id * CAMPAIGN_BOSS_NEST_HP_PER_STAGE;
  campaignWaveQueue.push({ zoneIndex, roster, portalPoints,
    portalHp: bossPortalState ? [...bossPortalState.hp] : portalPoints.map(() => portalMaxHp), portalMaxHp, remaining: total, total, spawned: 0, portalCursor: 0,
    sealedPortals: portalPoints.map((_, index) => bossPortalState ? bossPortalState.hp[index] <= 0 : false),
    started: false, warningTimer: 0, spawnTimer: 0, groupSpawned: 0,
    groupSize, groupBreakTimer: 0,
    countsForGate: !useStageRoster && zone.waveTrigger, supportOnly });
  if (!useStageRoster && zone.waveTrigger) campaignActiveWaveZones.add(zoneIndex);
  return true;
}

function chooseCampaignWaveMob(roster: ZombieTypeDef[], stageId?: number): ZombieTypeDef {
  // Brutes stay as occasional heavy threats instead of occupying half of a
  // small authored roster. Their data weight is further reduced for Campaign.
  const weights = roster.map(type => {
    let weight = type.weight * (type.id === 'tank' ? 0.22 : 1);
    if (stageId === 8) {
      if (type.id === 'tank') weight *= 0.5;
      else if (type.id === 'mutant') weight *= 0.65;
      else if (type.id === 'multihead') weight *= 0.5;
    }
    return weight;
  });
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

function isProtectedChargeTarget(stage: typeof STAGES[number], zoneIndex: number, point: Point): boolean {
  return stageBossSpawned && campaignNestCharge?.stageId === stage.id &&
    campaignNestCharge.status !== 'destroyed' && campaignNestCharge.status !== 'cancelled' &&
    zoneIndex === (stage.layout?.zones.length ?? 0) - 1 &&
    point.x === campaignNestCharge.targetPoint.x && point.y === campaignNestCharge.targetPoint.y;
}

function destroyCampaignPortalAt(stage: typeof STAGES[number], zoneIndex: number, point: Point): void {
  const bossZoneIndex = (stage.layout?.zones.length ?? 0) - 1;
  if (zoneIndex !== bossZoneIndex || !campaignBossPortals || campaignBossPortals.zoneIndex !== zoneIndex) return;
  const key = campaignPortalKey(zoneIndex, point);
  if (campaignDestroyedPortals.has(key)) return;
  const portalIndex = campaignBossPortals.points.findIndex(candidate => candidate.x === point.x && candidate.y === point.y);
  if (portalIndex < 0) return;
  campaignDestroyedPortals.add(key);
  campaignBossPortals.hp[portalIndex] = 0;
  if (campaignNestCharge?.stageId === stage.id && campaignNestCharge.targetPoint.x === point.x && campaignNestCharge.targetPoint.y === point.y)
    campaignNestCharge.status = 'destroyed';

  const allNestsDestroyed = campaignBossPortals.hp.every(hp => hp <= 0);
  for (let waveIndex = campaignWaveQueue.length - 1; waveIndex >= 0; waveIndex--) {
    const wave = campaignWaveQueue[waveIndex];
    if (wave.zoneIndex !== zoneIndex) continue;
    const index = wave.portalPoints.findIndex(candidate => candidate.x === point.x && candidate.y === point.y);
    if (index >= 0) { wave.sealedPortals[index] = true; wave.portalHp[index] = 0; }
    // Keep each nest's damage persistent across boss support waves. If every
    // boss-room nest is gone, discard pending spawns but leave existing mobs.
    if (allNestsDestroyed) campaignWaveQueue.splice(waveIndex, 1);
  }
  if (allNestsDestroyed) campaignSealedSpawnZones.add(zoneIndex);

  particles.burst(point.x, point.y, 24, '#9b3938', Math.random() * Math.PI * 2, Math.PI * 2, 112, .42);
  particles.emit(point.x, point.y, 10, '#443330', 54, .45, 4);
  camera.shake(1.8, .15);
  audio.explosion();
  campaignWaveAlertText = 'Ổ SPAWN ĐÃ BỊ PHÁ';
  campaignWaveAlertTimer = 2.4;
  if (campaignPortalFlash?.point.x === point.x && campaignPortalFlash.point.y === point.y) campaignPortalFlash = null;
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

function chooseCampaignPortalPoints(stage: typeof STAGES[number], zoneIndex: number, maxPoints: number, allowNearPlayer = false): Point[] {
  const zone = stage.layout?.zones[zoneIndex];
  if (!zone) return [];
  const minimumDistance = allowNearPlayer ? 0 : Math.max(CAMPAIGN_MIN_PORTAL_DISTANCE, player.size + 120);
  const candidates = zone.spawnPoints.filter(point => !campaignDestroyedPortals.has(campaignPortalKey(zoneIndex, point)) &&
    isCampaignPortalPointValid(stage, zone, point.x, point.y, 44) &&
    Math.hypot(point.x - player.x, point.y - player.y) >= minimumDistance);
  // Prefer points on different sides of the room, with the farthest portal first.
  candidates.sort((a, b) => Math.hypot(b.x - player.x, b.y - player.y) - Math.hypot(a.x - player.x, a.y - player.y));
  const targetPointIndex = stage.bossRoomNestCharge?.targetSpawnPointIndex;
  const targetPoint = zoneIndex === (stage.layout?.zones.length ?? 0) - 1 && campaignNestCharge?.stageId === stage.id &&
    campaignNestCharge.status !== 'destroyed' && campaignNestCharge.status !== 'cancelled' && targetPointIndex !== undefined
    ? zone.spawnPoints[targetPointIndex] : undefined;
  const reservedTarget = targetPoint && candidates.find(point => point.x === targetPoint.x && point.y === targetPoint.y);
  const chosen: Point[] = reservedTarget ? [reservedTarget] : [];
  if (reservedTarget) candidates.splice(candidates.indexOf(reservedTarget), 1);
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
  if (wave.supportOnly && zombies.pool.getActive().filter(z => z.hp > 0 &&
      z.campaignZoneIndex === wave.zoneIndex && z.campaignBossId === null).length >= CAMPAIGN_BOSS_ACTIVE_ADD_LIMIT) return false;
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
      if (wave.supportOnly) campaignBossAddsSpawned++;
      mob.hp = Math.round(mob.hp * stage.difficultyMult * CAMPAIGN_MOB_HP_MULTIPLIER * campaignStageMobHealthMultiplier(stage.id, mob.typeId));
      mob.maxHp = mob.hp;
      mob.damage = Math.round(mob.damage * stage.difficultyMult);
      applyCampaignDifficultyToMob(mob);
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
  if (wave.groupBreakTimer > 0) {
    wave.groupBreakTimer = Math.max(0, wave.groupBreakTimer - dt);
    return;
  }
  wave.spawnTimer -= dt;
  if (wave.spawnTimer > 0 || zombies.pool.activeCount >= CAMPAIGN_ACTIVE_ZOMBIE_LIMIT) return;
  const spawnRate = stage.id === 8 ? 2.8 : Math.min(4, 2.5 + (stage.id - 1) * .17);
  const type = chooseCampaignWaveMob(wave.roster, stage.id);
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
    wave.groupBreakTimer = CAMPAIGN_WAVE_GROUP_BREAK;
    campaignWaveAlertText = 'QUÁI MỚI ĐANG TRÀN VÀO';
    campaignWaveAlertTimer = 2.4;
  }
  if (wave.remaining <= 0) campaignWaveQueue.shift();
}

function updateCampaignWaveClears(_stage: typeof STAGES[number]): void {
  for (const zoneIndex of campaignActiveWaveZones) {
    if (campaignWaveQueue.some(wave => wave.zoneIndex === zoneIndex)) continue;
    if (zombies.pool.getActive().some(z => z.hp > 0 && z.campaignZoneIndex === zoneIndex)) continue;
    campaignActiveWaveZones.delete(zoneIndex);
    campaignWaveAlertText = 'KHU VỰC ĐÃ SẠCH · LỐI ĐI ĐÃ MỞ';
    campaignWaveAlertTimer = 3.2;
  }
}

function updateCampaignObjective(dt: number): void {
  const stage = STAGES[currentStageIndex];
  const pressed = input.interactPressed;
  if (!stage) return;
  const nearExit = !!stage.exitSpawn && bossKilledThisRun && Math.hypot(player.x - stage.exitSpawn.x, player.y - stage.exitSpawn.y) <= 88;
  if (stage.exitSpawn && bossKilledThisRun && !stageExitActivated) {
    stageExitActive = true;
    if (bossWeaponDrop) return;
    if (nearExit) {
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
  const difficulty = campaignDifficultyFactors();
  boss.hp = Math.round(stage.bossHp * bossEndurance * difficulty.health); boss.maxHp = boss.hp;
  boss.damage = Math.round((20 + stage.id * 2) * difficulty.damage);
  boss.speed = 32;
  boss.xpValue = 80 + stage.id * 15;
  campaignBossAddsSpawned = 0;
  campaignNestCharge = null;
  const chargeConfig = stage.bossRoomNestCharge;
  const bossZone = stage.layout?.zones.at(-1);
  const targetPoint = bossZone?.spawnPoints[chargeConfig?.targetSpawnPointIndex ?? -1];
  if (chargeConfig && bossZone && targetPoint &&
      isCampaignPortalPointValid(stage, bossZone, targetPoint.x, targetPoint.y, 44)) {
    const pickupPoint = { x: bossZone.x + bossZone.w / 2 + chargeConfig.pickupOffset.x,
      y: bossZone.y + bossZone.h / 2 + chargeConfig.pickupOffset.y };
    if (isCampaignPortalPointValid(stage, bossZone, pickupPoint.x, pickupPoint.y, 24)) {
      campaignNestCharge = { stageId: stage.id, pickupPoint, targetPoint,
        status: 'available', fuseRemaining: chargeConfig.fuseSeconds, fuseDuration: chargeConfig.fuseSeconds };
    }
  }
  const bossZoneIndex = (stage.layout?.zones.length ?? 0) - 1;
  const portalPoints = chooseCampaignPortalPoints(stage, bossZoneIndex, 4, true);
  const nestHp = CAMPAIGN_BOSS_NEST_HP_BASE + stage.id * CAMPAIGN_BOSS_NEST_HP_PER_STAGE;
  campaignBossPortals = portalPoints.length
    ? { zoneIndex: bossZoneIndex, points: portalPoints, hp: portalPoints.map(() => nestHp), maxHp: nestHp }
    : null;
  campaignBossDirector.reset();
  camera.shake(7, .35);
  particles.emit(boss.x, boss.y, 38, '#a9473d', 145, .9, 6);
}

function updateCampaignNestCharge(dt: number): void {
  const charge = campaignNestCharge;
  const stage = STAGES[currentStageIndex];
  if (gameMode !== 'stage' || !stage || !stageBossSpawned || !charge || charge.stageId !== stage.id ||
      charge.status === 'destroyed' || charge.status === 'cancelled') return;
  if (bossKilledThisRun) { charge.status = 'cancelled'; return; }

  if (charge.status === 'available' && input.interactPressed &&
      Math.hypot(player.x - charge.pickupPoint.x, player.y - charge.pickupPoint.y) <= 82) {
    charge.status = 'carried';
    audio.objectiveActivate();
    particles.emit(charge.pickupPoint.x, charge.pickupPoint.y, 15, '#e6b45f', 70, .45, 3);
    return;
  }
  if (charge.status === 'carried' && input.interactPressed &&
      Math.hypot(player.x - charge.targetPoint.x, player.y - charge.targetPoint.y) <= 92) {
    charge.status = 'planted';
    charge.fuseRemaining = stage.bossRoomNestCharge?.fuseSeconds ?? 4.5;
    audio.objectiveActivate();
    particles.emit(charge.targetPoint.x, charge.targetPoint.y, 10, '#e6a34e', 54, .28, 2.6);
    return;
  }
  if (charge.status === 'planted') {
    charge.fuseRemaining = Math.max(0, charge.fuseRemaining - dt);
    if (charge.fuseRemaining <= 0) {
      const bossZoneIndex = (stage.layout?.zones.length ?? 0) - 1;
      destroyCampaignPortalAt(stage, bossZoneIndex, charge.targetPoint);
      charge.status = 'destroyed';
    }
  }
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
  const damageMultiplier = survival ? 1 : campaignDifficultyFactors().damage;
  const contactDamage = campaignBossDirector.update(dt, stage, boss, player.x, player.y, () => {
    const bossCircuit = survival ? Math.floor((Math.ceil(survivalWave / 3) - 1) / STAGES.length) : 0;
    const summonCap = stage.id === 1 ? (survival ? Math.min(6, 4 + bossCircuit) : 4)
      : stage.id === 10 ? (survival ? Math.min(5, 3 + bossCircuit) : 3) : 0;
    const bossZoneIndex = (stage.layout?.zones.length ?? 0) - 1;
    const activeCampaignAdds = () => zombies.pool.getActive().filter(z => z.hp > 0 &&
      z.campaignZoneIndex === bossZoneIndex && z.campaignBossId === null).length;
    let spawned = survival ? survivalBossSummonsSpawned : stageBossSummonsSpawned;
    if (!summonCap || spawned >= summonCap || !boss || zombies.pool.activeCount >= (survival ? 22 : CAMPAIGN_ACTIVE_ZOMBIE_LIMIT) ||
        !survival && (campaignBossAddsSpawned >= CAMPAIGN_BOSS_ADD_TOTAL_LIMIT || activeCampaignAdds() >= CAMPAIGN_BOSS_ACTIVE_ADD_LIMIT)) return;
    const summonIds = stage.id === 10 ? ['normal', 'runner', 'spitter'] : ['normal', 'normal', 'normal', 'normal'];
    for (let i = 0; i < 2 && spawned < summonCap && zombies.pool.activeCount < (survival ? 22 : CAMPAIGN_ACTIVE_ZOMBIE_LIMIT) &&
         (survival || campaignBossAddsSpawned < CAMPAIGN_BOSS_ADD_TOTAL_LIMIT && activeCampaignAdds() < CAMPAIGN_BOSS_ACTIVE_ADD_LIMIT); i++) {
      const type = ZOMBIE_TYPES.find(entry => entry.id === summonIds[spawned % summonIds.length]);
      if (!type) continue;
      const angle = Math.PI * (.35 + i * .3);
      const mob = zombies.spawn(type, boss.x + Math.cos(angle) * 105, boss.y + Math.sin(angle) * 105, 1, 1, 1);
      if (!survival) {
        mob.campaignZoneIndex = stage.layout?.zones.length ? stage.layout.zones.length - 1 : -1;
        mob.hp = Math.round(mob.hp * stage.difficultyMult * CAMPAIGN_MOB_HP_MULTIPLIER); mob.maxHp = mob.hp;
        mob.damage = Math.round(mob.damage * stage.difficultyMult);
        applyCampaignDifficultyToMob(mob);
      }
      [mob.x, mob.y] = resolveBuildingCollision(mob.x, mob.y, survival ? mob.size * .72 : mob.size);
      spawned++;
      if (!survival) campaignBossAddsSpawned++;
    }
    if (survival) survivalBossSummonsSpawned = spawned;
    else stageBossSummonsSpawned = spawned;
  }, (move, actor, angle) => {
    const pan = Math.max(-1, Math.min(1, (actor.x - player.x) / 600));
    const distance = Math.hypot(actor.x - player.x, actor.y - player.y);
    audio.creatureSkill(actor.typeId, move.kind, pan, distance, true);
    const muzzle = actor.size * .72;
    if (move.kind === 'ring') {
      const projectileType: 'boss_acid' | 'boss_shard' | 'boss_wave' = stage.id === 10
        ? 'boss_wave' : [2, 4, 8, 9].includes(stage.id) ? 'boss_acid' : 'boss_shard';
      const count = stage.id === 1 ? 8 : stage.id >= 8 ? 18 : stage.id >= 5 ? 15 : 12;
      const speed = stage.id === 1 ? 118 : stage.id >= 8 ? 188 : stage.id >= 5 ? 164 : 142;
      const damage = Math.max(5, Math.round(move.damage * (stage.id === 1 ? .38 : .48) * damageMultiplier));
      // Keep the volley aligned with the boss's telegraph, including combo casts.
      enemyProjectiles.fireRing(actor.x, actor.y, count, speed, damage, projectileType, angle);
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
      volleyAngle, count, spread, stage.id === 1 ? 320 : stage.id === 2 ? 310 : 390,
      Math.round(move.damage * damageMultiplier), type);
    camera.shake(stage.id === 2 ? 2.4 : 1.7, .12);
    particles.emit(actor.x + Math.cos(angle) * muzzle, actor.y + Math.sin(angle) * muzzle,
      stage.id === 2 ? 8 : 7, type === 'boss_acid' ? '#a7c568' : '#c8c5b7', 65, .24, 3);
  }, survival ? 1 : 2, (move, actor) => {
    const pan = Math.max(-1, Math.min(1, (actor.x - player.x) / 600));
    const distance = Math.hypot(actor.x - player.x, actor.y - player.y);
    audio.creatureTelegraph(actor.typeId, move.kind, pan, distance, true);
  });
  return survival ? contactDamage : Math.round(contactDamage * damageMultiplier);
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
    campaignSessionEnded = true;
    persistCampaignAmmo(true);
    audio.objectiveComplete();
    const gold = save.completeCampaignStage(stage.id, stage.reward, player.kills, campaignResources.used);
    const score = stage.id * 1000
      + player.kills * (15 + stage.id * 5)
      + Math.round(Math.max(0, player.hp) / Math.max(1, player.maxHp) * 500 * stage.id)
      + campaignResources.used * 200 * stage.id;
    const previousTotalScore = save.data.campaign.totalScore;
    const scoreRecord = save.recordCampaignScore(stage.id, score);

    menuUI.finalTime = gameTime;
    menuUI.finalKills = player.kills;
    menuUI.finalLevel = player.level;
    menuUI.finalGold = gold;
    campaignUI.selectedStage = currentStageIndex;
    campaignUI.showResult({ time: gameTime, kills: player.kills, reward: gold,
      newStage: gold > 0 && stage.id < STAGES.length ? stage.id + 1 : 0, optional: campaignResources.used,
      score, scoreAdded: scoreRecord.added, previousTotalScore, totalScore: scoreRecord.total });
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

  if (z.typeId.startsWith('gunner')) {
    const debris = z.typeId === 'gunner_red' ? '#8a4841' : z.typeId === 'gunner_orange' ? '#bb7942' : '#8b9290';
    particles.emit(z.x, z.y, 5, debris, 96, .28, 2.4);
    particles.emit(z.x, z.y, 3, '#514c45', 58, .22, 1.8);
  } else if (z.typeId === 'orange_mutant' || z.typeId === 'red_mutant') {
    particles.emit(z.x, z.y, 5, z.typeId === 'orange_mutant' ? '#c66b32' : '#843638', 72, .26, 2.8);
  }

  if (z.isBoss) {
    bossKilledThisRun = true;
    camera.shake(8, 0.3);
    particles.emit(z.x, z.y, 16, '#ff44ff', 140, 0.6, 4);
    if (gameMode === 'stage') {
      if (campaignNestCharge && campaignNestCharge.status !== 'destroyed') campaignNestCharge.status = 'cancelled';
      collapseCampaignBossRoomSpawns();
    }
    if (gameMode === 'stage' && z.campaignBossId !== null) {
      const reward = campaignGuns.find(gun => gun.unlockStage === z.campaignBossId! + 1);
      if (reward && !save.data.campaign.ownedGuns.includes(reward.id)) {
        const [dropX, dropY] = campaignSpawnPosition(z.x, z.y, z.x + 82, z.y + 24, 26);
        bossWeaponDrop = { x: dropX, y: dropY, gunId: reward.id };
        mapPickups.spawnWeaponPickup(dropX, dropY, reward.id, true);
      }
    }
  }

  // Survival weapon unlocks are boss rewards, ordered like the Campaign's
  // chapter rewards. Once owned, that boss drops ammo for its associated gun.
  if (gameMode === 'endless' && z.isBoss) {
    const bossStageId = z.campaignBossId ?? survivalBossStageId;
    const finalUnlockStage = Math.max(1, ...campaignGuns.map(gun => gun.unlockStage ?? 1));
    const rewardStage = Math.min(bossStageId + 1, finalUnlockStage);
    const reward = campaignGuns.find(gun => gun.unlockStage === rewardStage && gun.id !== 'p9');
    const canCollectBossGun = reward && (!weapons.loadout.hasGun(reward.id)
      || weapons.loadout.canAddAmmoForGun(reward.id));
    if (reward && canCollectBossGun) {
      mapPickups.spawnWeaponPickup(z.x, z.y, reward.id, true);
    }

    const finiteAmmoSlot = weapons.loadout.canAddAmmoForGun(weapons.loadout.activeSlot.def.id)
      ? weapons.loadout.activeSlot : weapons.loadout.unlockedSlots.find(slot => weapons.loadout.canAddAmmoForGun(slot.def.id));
    if (finiteAmmoSlot) {
      mapPickups.spawnAmmoPickup(z.x + (canCollectBossGun ? 28 : 0), z.y + (canCollectBossGun ? 10 : 0), finiteAmmoSlot.def.id,
        finiteAmmoSlot.def.magSize * (canCollectBossGun ? 2 : 3));
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
      : z.isElite ? 15 : ['rat_king', 'mutant', 'multihead', 'tank', 'red_mutant', 'gunner_red'].includes(z.typeId) ? 8
      : ['runner', 'spider', 'spitter', 'armed', 'exploder', 'orange_mutant', 'gunner', 'gunner_orange'].includes(z.typeId) ? 4 : 2;
    const guaranteedCredit = z.campaignBossId !== null || z.isElite;
    const dropChance = guaranteedCredit ? 1 : threat >= 8 ? .82 : threat >= 4 ? .72 : .62;
    if (Math.random() < dropChance) {
      const valueScale = z.campaignBossId !== null ? .82 : z.isElite ? .78 : .65;
      campaignCredits.drop(z.x, z.y, Math.max(1, Math.floor(threat * valueScale)));
    }
    if (z.campaignBossId === null && Math.random() < (z.isElite ? .30 : .14)
      && mapPickups.pool.getActive().filter(item => item.itemId.startsWith('ammo_')).length < 32) {
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
    if (z.campaignBossId === null && Math.random() < (z.isElite ? .16 : .08)
      && mapPickups.pool.getActive().filter(item => item.itemId === 'health_pack').length < 10) {
      mapPickups.spawnHealthPickup(z.x, z.y, z.isElite ? 40 : 30);
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

  if (campaignBossPortals?.zoneIndex === bossZone) {
    campaignBossPortals.points.forEach((point, index) => {
      if (campaignBossPortals!.hp[index] <= 0) return;
      campaignBossPortals!.hp[index] = 0;
      campaignDestroyedPortals.add(campaignPortalKey(bossZone, point));
      addPoint(point);
    });
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
    const hit = applyPlayerDamage(Math.round(damage * 0.3 * (1 - pDist / radius)));
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
    campaignTerrainRenderer.draw(ctx, camera, campaignStage, stageObjectiveIndex, player.x, player.y, gameTime, save.data.language);
    bloodStains.draw(ctx, camera);
    LightingRenderer.get().drawCampaignLighting(ctx, camera, campaignStage, player.x, player.y, player.aimAngle,
      viewportWidth, viewportHeight, save.data.campaign.flashlightLevel);
    weapons.loadout.casings.draw(ctx, camera);
    const queuedWave = campaignWaveQueue[0];
    const visiblePortalFlash = campaignPortalFlash && campaignPortalFlash.timer > 0 ? campaignPortalFlash : undefined;
    const bossZoneIndex = (campaignStage.layout?.zones.length ?? 0) - 1;
    const bossPortals = campaignBossPortals?.zoneIndex === bossZoneIndex && stageBossSpawned ? campaignBossPortals : null;
    const spawnCue = bossPortals
      ? { zoneIndex: bossPortals.zoneIndex, portalPoints: bossPortals.points, sealedPortalPoints: bossPortals.hp.map(hp => hp <= 0),
          portalHp: bossPortals.hp, portalMaxHp: bossPortals.maxHp,
          portalDestructible: bossPortals.points.map(point => canDamageCampaignSpawnPortal(stageBossSpawned,
            bossPortals.zoneIndex, bossZoneIndex, isProtectedChargeTarget(campaignStage, bossPortals.zoneIndex, point))),
          warningTimer: queuedWave?.started && queuedWave.zoneIndex === bossZoneIndex ? queuedWave.warningTimer : 0,
          gameTime, playerX: player.x, playerY: player.y,
          activePortalPoint: visiblePortalFlash?.point, activePortalTimer: visiblePortalFlash?.timer }
      : queuedWave?.started
        ? { ...queuedWave, gameTime, sealedPortalPoints: queuedWave.sealedPortals, playerX: player.x, playerY: player.y,
            portalDestructible: queuedWave.portalPoints.map(() => false),
            activePortalPoint: visiblePortalFlash?.point, activePortalTimer: visiblePortalFlash?.timer }
        : visiblePortalFlash
          ? { zoneIndex: visiblePortalFlash.zoneIndex, portalPoints: [visiblePortalFlash.point], warningTimer: 0,
              gameTime, playerX: player.x, playerY: player.y, activePortalPoint: visiblePortalFlash.point, activePortalTimer: visiblePortalFlash.timer }
          : undefined;
    campaignMapRenderer.draw(ctx, camera, campaignStage, stageObjectiveIndex, stageBossSpawned, stageExitActive, stageExitActivated,
      spawnCue, { playerX: player.x, playerY: player.y, gameTime, holdStarted: stageObjectiveHoldStarted, exitInteractable: !bossWeaponDrop,
        nestCharge: campaignNestCharge?.stageId === campaignStage.id ? campaignNestCharge : undefined }, save.data.language);
    campaignResources.draw(ctx, camera, save.data.language);
  } else {
    groundRenderer.draw(ctx, camera);
    bloodStains.draw(ctx, camera);
    drawMapBorder();
    weapons.loadout.casings.draw(ctx, camera);
    propRenderer.draw(ctx, camera, 'ground', true, save.data.language);
  }

  if (gameMode === 'endless') {
    horrorRemains.draw(ctx, camera);
  }
  const showSkillDirections = showCampaignSkillDirections();
  zombies.drawWarnings(ctx, camera, showSkillDirections);
  const directorStageId = campaignStage?.id ?? (gameMode === 'endless' && survivalPhase === 'boss' ? survivalBossStageId : 0);
  if (directorStageId) campaignBossDirector.draw(ctx, camera,
    zombies.pool.getActive().find((z) => z.campaignBossId === directorStageId), showSkillDirections, save.data.language);

  // Draw entities
  mapPickups.draw(ctx, camera, save.data.language);
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

  if (!campaignStage) propRenderer.draw(ctx, camera, 'above', true, save.data.language);

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
      bossName: getStageCopy(campaignStage, save.data.language).bossName,
      bossHpRatio: campaignBossForHud ? campaignBossForHud.hp / Math.max(1, campaignBossForHud.maxHp) : 0,
      exitActive: stageExitActive, exitActivated: stageExitActivated,
      credits: save.data.campaign.credits, creditGain: creditGainTimer > 0 ? lastCreditGain : 0 } : undefined,
    gameMode === 'endless' && !previewEncounter ? {
      wave: Math.max(1, survivalWave), phase: survivalPhase,
      bossName: survivalPhase === 'boss' || survivalPhase === 'boss-warning'
        ? (() => { const stage = STAGES.find(value => value.id === survivalBossStageId); return stage ? getStageCopy(stage, save.data.language).bossName : undefined; })() : undefined,
      bossHpRatio: survivalBossForHud ? survivalBossForHud.hp / Math.max(1, survivalBossForHud.maxHp) : 0,
    } : undefined, save.data.language);

  // Active buffs display
  drawActiveBuffs();

  // Stage mode objective display
  if (gameMode === 'stage' && currentStageIndex < STAGES.length) {
    drawStageObjective();
  }

  // ─── Tactical Gun Loadout Bottom HUD Card (Matches User Spec) ───
  if (menuUI.currentScreen === 'playing') {
    weapons.loadout.drawHUD(ctx, viewportWidth, viewportHeight, player, gameMode === 'stage' ? {
      armorLevel: save.data.campaign.armorLevel,
      medKits: save.data.campaign.medKits,
      flashlightLevel: save.data.campaign.flashlightLevel,
    } : undefined, save.data.language);
    if (gameMode === 'stage' && campaignMedkitFlashTimer > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(.7, campaignMedkitFlashTimer * .8);
      ctx.strokeStyle = '#67ef91'; ctx.lineWidth = 5;
      ctx.strokeRect(2.5, 2.5, viewportWidth - 5, viewportHeight - 5);
      ctx.restore();
    }
    drawTouchActionButtons(ctx, viewportWidth, viewportHeight, {
      dashCooldown: player.dashCooldown,
      dashCooldownMax: player.dashMaxCooldown,
      ragePercent: weapons.loadout.ragePercent,
      rageCooldown: weapons.loadout.rageCooldownTimer,
      rageCooldownMax: weapons.loadout.rageCooldownDuration,
      rageActiveTimer: weapons.loadout.rageActiveTimer,
    }, save.data.language);
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
    const buffLabels: Record<string, [string, string]> = {
      speed_boost: ['Tăng tốc', 'Speed boost'],
      double_xp: ['Nhân đôi XP', 'Double XP'],
      invincible: ['Bất tử', 'Invulnerability'],
      freeze: ['Đóng băng', 'Freeze'],
      shield: ['Lá chắn', 'Shield'],
    };
    const label = buffLabels[key]?.[save.data.language === 'en' ? 1 : 0]
      ?? sentenceCaseDisplay(key.replaceAll('_', ' '), save.data.language);
    ctx.fillText(label, x - 5, y - 3);
    ctx.fillStyle = UI_PALETTE.text;
    ctx.fillText(`${Math.ceil(buff.duration)}s`, x - 5, y + 8);

    y += 25;
  }
}

function drawStageObjective(): void {
  if (currentStageIndex >= STAGES.length) return;
  const stage = STAGES[currentStageIndex];
  const english = save.data.language === 'en';
  const copy = getStageCopy(stage, save.data.language);

  const panelW = Math.min(330, Math.max(210, viewportWidth * .52));
  const x = viewportWidth - panelW / 2 - 12;
  const y = !stageBossSpawned && viewportWidth >= 700 && viewportWidth < 1050 ? 117 : 70;
  const chargeTask = stageBossSpawned && campaignNestCharge?.stageId === stage.id && campaignNestCharge.status !== 'cancelled'
    ? campaignNestCharge : undefined;
  const panelHeight = chargeTask ? 82 : 78;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(13,17,19,.9)'; ctx.strokeStyle = stageBossSpawned ? '#a9473d' : '#a9966d'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.roundRect(x - panelW / 2, y - panelHeight / 2 + 3, panelW, panelHeight, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#d4c7a2'; ctx.font = `bold 10px 'Segoe UI', Arial, sans-serif`;
  const currentZoneIndex = nearestCampaignZone(player.x, player.y);
  const zoneName = localizeZoneName(stage.layout?.zones[currentZoneIndex]?.name ?? copy.name, save.data.language);
  const alertCopy: Record<string, [string, string]> = {
    'Ổ SPAWN ĐÃ BỊ PHÁ': ['Ổ sinh quái đã bị phá', 'Spawn nest destroyed'],
    'CỔNG MÁU ĐANG MỞ': ['Cổng máu đang mở', 'The blood gate is opening'],
    'QUÁI MỚI ĐANG TRÀN VÀO': ['Quái đang tràn vào', 'Enemies are closing in'],
    'KHU VỰC ĐÃ SẠCH · LỐI ĐI ĐÃ MỞ': ['Khu vực đã sạch · lối đi đã mở', 'Area clear · route open'],
  };
  const heading = campaignWaveAlertTimer > 0 && campaignWaveAlertText
    ? alertCopy[campaignWaveAlertText]?.[english ? 1 : 0] ?? sentenceCaseDisplay(campaignWaveAlertText, save.data.language)
    : !campaignEncounterTriggered ? `${english ? 'Approach' : 'Tiếp cận'} · ${zoneName}`
      : `${getUiTerm('mission', save.data.language)} ${stage.id}/10 · ${zoneName}`;
  const headingY = y - panelHeight / 2 + 16;
  ctx.fillText(heading, x, headingY, panelW - 20);
  let objectiveText: string;
  if (stageBossSpawned) objectiveText = `${english ? 'Defeat the boss' : 'Hạ trùm'}: ${copy.bossName}`;
  else if (stageObjectiveIndex >= stage.objectiveNodes.length) objectiveText = stage.id === 1
    ? (english ? 'Reach the boss · use Shift to dodge' : 'Đến khu vực trùm · dùng Shift để lướt')
    : (english ? 'Proceed to the boss arena' : 'Tiến vào phòng trùm');
  else {
    const node = stage.objectiveNodes[stageObjectiveIndex];
    const near = Math.hypot(player.x - node.x, player.y - node.y) < 82;
    const holding = stage.objectiveHoldAt === stageObjectiveIndex;
    const holdNear = holding && Math.hypot(player.x - node.x, player.y - node.y) <= 110;
    const holdSeconds = stage.objectiveHoldSeconds ?? 5;
    objectiveText = holding
      ? stage.id === 9 && !stageObjectiveHoldStarted
        ? (near ? english ? 'Start the final hold · press E' : 'Bắt đầu giữ điểm · nhấn E'
          : english ? 'Move to the marked point' : 'Đến điểm được đánh dấu')
        : holdNear
          ? `${english ? 'Hold position' : 'Giữ vị trí'} · ${stageObjectiveHoldTime.toFixed(1)}/${holdSeconds}s`
          : `${english ? 'Enter the marked zone · hold for' : 'Vào vùng được đánh dấu · giữ'} ${holdSeconds}${english ? 's' : ' giây'}`
      : `${copy.objectiveLabel} ${stageObjectiveIndex}/${stage.objectiveNodes.length}${near
        ? (english ? ' · Press E to interact' : ' · Nhấn E để tương tác')
        : (english ? ' · Follow the marker' : ' · Theo dấu chỉ hướng')}`;
    if (holding) {
      ctx.fillStyle = 'rgba(38,43,41,.95)'; ctx.fillRect(x - panelW*.38, y + 27, panelW*.76, 3);
      ctx.fillStyle = '#a8c08b'; ctx.fillRect(x - panelW*.38, y + 27, panelW*.76 * Math.min(1, stageObjectiveHoldTime / (stage.objectiveHoldSeconds ?? 5)), 3);
    }
  }
  if (stageExitActive && stage.exitSpawn && !stageExitActivated) {
    const nearExit = Math.hypot(player.x - stage.exitSpawn.x, player.y - stage.exitSpawn.y) <= 88;
    objectiveText = nearExit
      ? (english ? 'Enter the exit zone to finish' : 'Vào vùng thoát để kết thúc')
      : (english ? 'Follow the marker to the exit' : 'Theo dấu chỉ hướng đến lối thoát');
  }
  if (bossWeaponDrop) objectiveText = english
    ? `Recover ${campaignGuns.find(gun => gun.id === bossWeaponDrop!.gunId)?.shortName ?? 'weapon'} · unlock the exit`
    : `Nhặt ${campaignGuns.find(gun => gun.id === bossWeaponDrop!.gunId)?.shortName ?? 'vũ khí'} của trùm · mở lối thoát`;
  if (campaignActiveWaveZones.has(currentZoneIndex)) {
    const holdingObjective = stage.objectiveHoldAt === stageObjectiveIndex && stage.layout?.zones[currentZoneIndex]?.role === 'hold';
    const holdNode = holdingObjective ? stage.objectiveNodes[stageObjectiveIndex] : undefined;
    const atHoldPoint = !!holdNode && Math.hypot(player.x - holdNode.x, player.y - holdNode.y) <= 110;
    const holdSeconds = stage.objectiveHoldSeconds ?? 5;
    if (holdingObjective) {
      const holdStatus = stage.id === 9 && !stageObjectiveHoldStarted
        ? atHoldPoint ? (english ? 'Press E to begin' : 'Nhấn E để bắt đầu') : (english ? 'Enter the marked zone' : 'Vào vùng được đánh dấu')
        : atHoldPoint ? `${english ? 'Hold position' : 'Giữ vị trí'} ${stageObjectiveHoldTime.toFixed(1)}/${holdSeconds}s`
          : `${english ? 'Enter the marked zone · hold for' : 'Vào vùng được đánh dấu · giữ'} ${holdSeconds}s`;
      objectiveText = holdStatus;
    } else objectiveText = english ? 'Combat · clear the area' : 'Giao tranh · hạ quái';
  }
  if (campaignSupplyNoticeTimer > 0) objectiveText = campaignSupplyNotice;
  ctx.fillStyle = stageExitActive ? '#9fc4af' : stageBossSpawned ? '#e47a68' : '#f0eadc';
  ctx.font = `bold ${viewportWidth < 700 ? 10 : 11}px 'Segoe UI', Arial, sans-serif`;
  const drawTaskLine = (text: string, lineY: number, color: string): void => {
    const left = x - panelW / 2 + 16;
    ctx.textAlign = 'left'; ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(left, lineY, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillText(text, left + 9, lineY, panelW - 42);
  };
  if (chargeTask) {
    const nearPickup = Math.hypot(player.x - chargeTask.pickupPoint.x, player.y - chargeTask.pickupPoint.y) <= 82;
    const nearTarget = Math.hypot(player.x - chargeTask.targetPoint.x, player.y - chargeTask.targetPoint.y) <= 92;
    const chargeText = chargeTask.status === 'available'
      ? nearPickup ? (english ? 'Side objective · press E to take the charge' : 'Nhiệm vụ phụ · nhấn E để nhặt thuốc nổ')
        : (english ? 'Side objective · find the charge in the boss room' : 'Nhiệm vụ phụ · tìm thuốc nổ trong phòng trùm')
      : chargeTask.status === 'carried'
        ? nearTarget ? (english ? 'Plant the charge at the marked nest · press E' : 'Đặt thuốc nổ tại ổ được đánh dấu · nhấn E')
          : (english ? 'Carry the charge to the marked spawn nest' : 'Mang thuốc nổ đến ổ sinh quái được đánh dấu')
        : chargeTask.status === 'planted' ? `${english ? 'Charge planted · move clear' : 'Đã đặt thuốc nổ · lùi ra'} ${chargeTask.fuseRemaining.toFixed(1)}s`
          : (english ? 'Target spawn nest destroyed' : 'Ổ sinh quái mục tiêu đã bị phá');
    drawTaskLine(objectiveText, y - 7, stageBossSpawned ? '#e47a68' : '#f0eadc');
    drawTaskLine(chargeText, y + 14, chargeTask.status === 'destroyed' ? '#c4d3bd' : '#f0c775');
  } else {
    const lines = objectiveText.split(/\s+•\s+/).slice(0, 2);
    const firstY = lines.length > 1 ? y - 3 : y + 7;
    lines.forEach((text, index) => drawTaskLine(text, firstY + index * 17,
      index === 0 ? (stageExitActive ? '#9fc4af' : stageBossSpawned ? '#e47a68' : '#f0eadc') : '#c5cfca'));
  }
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
  ctx.fillText(`${save.data.language === 'en' ? 'Hold position' : 'Giữ vị trí'} · ${remaining.toFixed(1)}s`, x, y - 7);
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
  if (gameMode === 'stage') persistCampaignAmmo();
  input.campaignMode = gameMode === 'stage';
  resetGame();
  campaignSessionEnded = false;
  input.clearUiFire();
  const stage = gameMode === 'stage' ? STAGES[currentStageIndex] : undefined;
  bloodStains.setWorldBounds(stage?.layout?.bounds.w ?? MAP_CONFIG.width,
    stage?.layout?.bounds.h ?? MAP_CONFIG.height);
  if (stage) {
    setCampaignGeometry(stage.buildings, stage.layout);
    camera.zoom = viewportWidth < 700 ? 0.95 : 1.42;
    player.x = stage.playerStart.x; player.y = stage.playerStart.y;
    player.dashMaxCooldown = 1.0;
    camera.x = player.x - camera.width / 2; camera.y = player.y - camera.height / 2;
    const stock = save.data.campaign;
    const legacyAmmoPacks = Object.keys(stock.gunAmmo).length === 0 ? stock.ammoPacks : 0;
    if (!previewEncounter) {
      stock.lastStage = currentStageIndex + 1;
      stock.hasCheckpoint = true;
    }
    weapons.loadout.configureCampaign(stock.ownedGuns, stock.equippedGun, stock.gunLevels,
      stock.gunAmmo, currentStageIndex + 1, legacyAmmoPacks);
    stock.gunAmmo = weapons.loadout.getCampaignAmmoState();
    stock.ammoPacks = 0;
    campaignResources.reset(stage);
    if (!previewEncounter) save.save();
  } else {
    camera.zoom = 1.42;
    player.dashMaxCooldown = 3;
  }
  player.loadout = weapons.loadout;
  audio.init();
  if (stage) {
    const droneLevel = Math.min(4, Math.max(0, save.data.campaign.cardLevels.drone ?? 0));
    for (let n = 0; n < droneLevel; n++) player.applyUpgrade('drone');
  }
  applyPermUpgrades();
  if (stage) {
    player.hp = player.maxHp;
    player.damageReduction = [1, .90, .82, .75][save.data.campaign.armorLevel] ?? 1;
  }
  const selectedCharacterId = stage ? save.data.campaign.selectedCharacter : save.data.selectedCharacter;
  const selectedCharacter = CHARACTERS.find(character => character.id === selectedCharacterId);
  if (selectedCharacter?.bonuses.damageReduction) player.damageReduction *= selectedCharacter.bonuses.damageReduction;
  adWrapper.gameplayStart();
  menuUI.currentScreen = 'playing';
  paused = false;
  stageComplete = false;
  bossKilledThisRun = false;
  bossWeaponDrop = null;

}

function resetGame(): void {
  menuUI.canWatchRevive = true;
  menuUI.reviveAdPending = false;
  campaignUI.canWatchRevive = true;
  campaignUI.reviveAdPending = false;
  campaignUI.impossibleDeath = false;
  campaignMedkitFlashTimer = 0;
  setCampaignGeometry();
  bossWeaponDrop = null;
  stageObjectiveIndex = 0;
  stageBossSpawned = false;
  stageObjectiveHoldTime = 0;
  stageObjectiveHoldStarted = false;
  stageBossSummonsSpawned = 0;
  campaignBossAddsSpawned = 0;
  campaignNestCharge = null;
  stageExitActive = false;
  stageExitActivated = false;
  campaignTriggeredZones.clear();
  campaignActiveWaveZones.clear();
  campaignTriggeredTransitLinks.clear();
  campaignDestroyedPortals.clear();
  campaignSealedSpawnZones.clear();
  campaignBossPortals = null;
  campaignWaveQueue.length = 0;
  explosionEffects.clear();
  campaignPortalFlash = null;
  campaignSupplyNotice = '';
  campaignSupplyNoticeTimer = 0;
  campaignWaveAlertText = '';
  campaignWaveAlertTimer = 0;
  campaignEncounterTriggered = false;
  campaignWavePreview = false;
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
  gameTime = 0;
  paused = false;
  hasRevive = false;
  spitterGlobalCooldown = 0;
  campaignGunnerSoundCooldown = 0;
  bossAttackTimer = 3;
  bossAttackPhase = 0;
  goldEarned = 0;
}

// ─── Initialization ───
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
window.addEventListener('beforeunload', () => {
  if (menuUI.currentScreen === 'gameover') endRun();
  persistCampaignAmmo();
});

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
      const type = [...ZOMBIE_TYPES, ...HORROR_TYPES, ...CAMPAIGN_VARIANT_TYPES].find(t => t.id === typeId);
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
