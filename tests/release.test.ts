import assert from 'node:assert/strict';
import test from 'node:test';
import { Camera } from '../src/core/camera';
import { Player } from '../src/entities/player';
import { getCampaignDifficultyFactors, shouldShowCampaignSkillDirections } from '../src/systems/campaign-difficulty';
import { adWrapper } from '../src/systems/ads';
import { SaveSystem } from '../src/systems/save';
import { getSurvivalBossSelection, hasLivingSurvivalBoss, isSurvivalWaveSpawnBudgetExhausted } from '../src/systems/survival-flow';
import { Spawner, SURVIVAL_HORDE_MULTIPLIER } from '../src/systems/spawner';
import { MenuUI } from '../src/ui/menu';
import { getTouchActionButtons } from '../src/ui/touch-controls';
import { runCampaignChecks } from '../src/dev/campaign-checks';
import type { Audio } from '../src/core/audio';

function installStorage(initial?: Record<string, unknown>) {
  const values = new Map<string, string>();
  if (initial) values.set('undead_rush_save', JSON.stringify(initial));
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, String(value)); },
      removeItem: (key: string) => { values.delete(key); },
      clear: () => values.clear(),
    },
  });
  return values;
}

test('Survival score shards apply the active multiplier and records persist score, gold, and bests', () => {
  const player = new Player();
  player.scoreMultiplier = 1.5;
  assert.equal(player.addScore(10), 15);
  player.buffs.set('double_score', { duration: 3, value: 2 });
  assert.equal(player.addScore(5), 15);
  assert.equal(player.addScore(-20), 0);
  assert.equal(player.score, 30);

  const save = new SaveSystem(false);
  assert.equal(save.calculateGold(29, 13, 450), 8);
  assert.equal(save.recordRun(29, 13, player.score), 4);
  assert.equal(save.data.bestScore, 30);
  assert.equal(save.data.bestKills, 13);
  assert.equal(save.data.totalGamesPlayed, 1);
  save.recordRun(10, 2, 12);
  assert.equal(save.data.bestScore, 30);
  assert.equal(save.data.totalGamesPlayed, 2);
});

test('old saves migrate without losing checkpoint, weapons, ammo, or prior score records', () => {
  const store = installStorage({
    bestTime: 720, bestKills: 140, bestScore: 4200, bestLevel: 18,
    gold: 90, language: 'en', musicEnabled: false,
    campaign: {
      difficulty: 'hard', credits: 120, unlockedStage: 5, lastStage: 4, hasCheckpoint: true,
      completedStages: [1, 2, 3], ownedGuns: ['p9', 'ar7'], equippedGun: 'ar7',
      gunAmmo: { ar7: { currentAmmo: 7, reserveAmmo: 84 } },
      cardLevels: { damage: 2, drone: 2 }, upgradeSystemVersion: 0,
      stageScores: { 1: 540, 2: 720 }, totalScore: 1,
    },
  });
  const save = new SaveSystem(true);
  assert.equal(save.data.bestScore, 4200);
  assert.equal(save.data.bestLevel, 18); // legacy field remains readable
  assert.equal(save.data.language, 'en');
  assert.equal(save.data.musicEnabled, false);
  assert.equal(save.data.campaign.difficulty, 'hard');
  assert.equal(save.data.campaign.lastStage, 4);
  assert.equal(save.data.campaign.hasCheckpoint, true);
  assert.deepEqual(save.data.campaign.gunAmmo.ar7, { currentAmmo: 7, reserveAmmo: 84 });
  assert.deepEqual(save.data.campaign.ownedGuns, ['p9', 'ar7']);
  assert.deepEqual(save.data.campaign.cardLevels, { drone: 2 });
  assert.equal(save.data.campaign.totalScore, 1260);
  assert.equal(JSON.parse(store.get('undead_rush_save')!).campaign.upgradeSystemVersion, 1);
});

test('new campaign resets only Campaign data; checkpoint and Impossible death policy stay mode-local', () => {
  installStorage();
  const save = new SaveSystem(true);
  save.data.gold = 321;
  save.data.bestScore = 8800;
  save.data.campaign.ownedGuns.push('ar7');
  save.data.campaign.gunAmmo.ar7 = { currentAmmo: 4, reserveAmmo: 15 };
  save.resetCampaign('impossible');
  assert.equal(save.data.campaign.difficulty, 'impossible');
  assert.deepEqual(save.data.campaign.ownedGuns, ['p9']);
  assert.equal(save.data.gold, 321);
  assert.equal(save.data.bestScore, 8800);

  save.completeCampaignStage(2, 200, 9, 1);
  assert.equal(save.data.campaign.hasCheckpoint, true);
  assert.equal(save.data.campaign.lastStage, 3);
  assert.equal(save.data.campaign.unlockedStage, 3);
  assert.equal(save.completeCampaignStage(2, 200, 9, 1), 0);
  assert.deepEqual(save.recordCampaignScore(2, 720), { added: 720, total: 720 });
  assert.deepEqual(save.recordCampaignScore(2, 500), { added: 0, total: 720 });
  save.data.campaign.ownedGuns.push('smg9');
  save.data.campaign.gunAmmo.smg9 = { currentAmmo: 6, reserveAmmo: 60 };
  save.resetCampaignAfterImpossibleDeath();
  assert.equal(save.data.campaign.difficulty, 'impossible');
  assert.equal(save.data.campaign.hasCheckpoint, false);
  assert.deepEqual(save.data.campaign.ownedGuns, ['p9']);
  assert.equal(save.data.campaign.gunAmmo.smg9, undefined);
  assert.equal(save.data.gold, 321);
  assert.equal(save.data.bestScore, 8800);
});

test('New Game routes into Campaign difficulty or Survival, and Load Game requires a checkpoint', () => {
  const save = new SaveSystem(false);
  const audio = { menuSelect: () => {} } as unknown as Audio;
  const menu = new MenuUI();
  assert.equal(menu.handleClick(250, 350, 900, 720, audio, save), null);
  save.data.campaign.hasCheckpoint = true;
  assert.equal(menu.handleClick(250, 350, 900, 720, audio, save), 'load_game');

  menu.currentScreen = 'newgame';
  assert.equal(menu.handleClick(250, 385, 900, 720, audio, save), null);
  assert.equal(menu.newGameStep, 'difficulty');
  assert.equal(menu.handleClick(250, 210, 900, 720, audio, save), null);
  assert.equal(menu.selectedCampaignDifficulty, 'normal');
  assert.equal(menu.confirmNewGame, true);
  assert.equal(menu.handleClick(300, 430, 900, 720, audio, save), 'new_game');

  const survivalMenu = new MenuUI();
  survivalMenu.currentScreen = 'newgame';
  assert.equal(survivalMenu.handleClick(250, 440, 900, 720, audio, save), 'start_endless');
});

test('Campaign difficulty multipliers and skill warning visibility match the three modes', () => {
  assert.deepEqual(getCampaignDifficultyFactors('normal'), { health: 1, damage: 1 });
  assert.deepEqual(getCampaignDifficultyFactors('hard'), { health: 1.3, damage: 1.3 });
  assert.deepEqual(getCampaignDifficultyFactors('impossible'), { health: 1.5, damage: 1.5 });
  assert.equal(shouldShowCampaignSkillDirections('stage', 'normal'), true);
  assert.equal(shouldShowCampaignSkillDirections('stage', 'hard'), false);
  assert.equal(shouldShowCampaignSkillDirections('stage', 'impossible'), false);
  assert.equal(shouldShowCampaignSkillDirections('endless', 'impossible'), true);
});

test('Survival starts with a paced batch, respects its active cap, and ignores old stragglers for wave completion', () => {
  const camera = Object.assign(new Camera(), { x: 1000, y: 1000, width: 800, height: 600 });
  const spawner = new Spawner();
  spawner.beginWave();
  const first = spawner.updateWave(0, 0, 0, camera, 1400, 1300, 20);
  assert.equal(first.length, SURVIVAL_HORDE_MULTIPLIER);
  assert(first.every(spawn => spawn.type.minTime <= 0));
  assert(first.every(spawn => spawn.x < camera.x || spawn.x > camera.x + camera.width ||
    spawn.y < camera.y || spawn.y > camera.y + camera.height));

  spawner.beginWave();
  assert.equal(spawner.updateWave(0, 0, 1, camera, 1400, 1300, 20).length,
    SURVIVAL_HORDE_MULTIPLIER); // the next wave can start while a prior mob survives

  spawner.beginWave();
  assert.equal(spawner.updateWave(0, 0, 45, camera, 1400, 1300, 20).length, 0);
  spawner.beginWave();
  assert.equal(spawner.updateWave(0, 0, 44, camera, 1400, 1300, 20).length, 1);
  assert.equal(isSurvivalWaveSpawnBudgetExhausted(0), true);
  assert.equal(isSurvivalWaveSpawnBudgetExhausted(12), false);
});

test('only the living Survival encounter boss gates the next boss intermission', () => {
  const adds = [
    { isBoss: false, campaignBossId: null, hp: 12 },
    { isBoss: true, campaignBossId: 2, hp: 50 },
  ];
  assert.equal(hasLivingSurvivalBoss(adds, 2), true);
  assert.equal(hasLivingSurvivalBoss(adds, 1), false);
  assert.equal(hasLivingSurvivalBoss([
    ...adds,
    { isBoss: true, campaignBossId: 2, hp: 0 },
  ], 2), true);
  assert.equal(hasLivingSurvivalBoss([
    adds[0], { isBoss: true, campaignBossId: 2, hp: 0 },
  ], 2), false);
  // The exhausted spawn budget finishes the authored wave independently of live old mobs.
  assert.equal(isSurvivalWaveSpawnBudgetExhausted(0), true);
  assert.deepEqual(getSurvivalBossSelection(2, 10), null);
  assert.deepEqual(getSurvivalBossSelection(3, 10), { stageIndex: 0, circuit: 0 });
  assert.deepEqual(getSurvivalBossSelection(30, 10), { stageIndex: 9, circuit: 0 });
  assert.deepEqual(getSurvivalBossSelection(33, 10), { stageIndex: 0, circuit: 1 });
});

test('Campaign map, mission, boss and weapon progression audit stays valid', () => {
  const checks = runCampaignChecks();
  assert(checks.some(check => check.includes('boss room')));
  assert(checks.some(check => check.includes('vũ khí')));
  assert(checks.length >= 14);
});

test('touch skill controls remain inside narrow and desktop viewports in both locales', () => {
  for (const [width, height] of [[360, 740], [640, 360], [1920, 1080]]) {
    for (const language of ['vi', 'en'] as const) {
      const buttons = getTouchActionButtons(width, height, language);
      assert.deepEqual(buttons.map(button => button.id), ['rage', 'dash']);
      assert(buttons.every(button => button.x >= 0 && button.y >= 0 &&
        button.x + button.size <= width && button.y + button.size <= height));
      assert(buttons.every(button => button.label.length > 0));
    }
  }
});

test('unconfigured rewarded ads fail closed and the death UI cannot request or grant a revive', () => {
  let rewards = 0, skips = 0, errors = 0;
  adWrapper.init({
    onRewarded: () => { rewards++; },
    onSkipped: () => { skips++; },
    onError: (_placement, error) => { assert.equal(error, 'not_configured'); errors++; },
  });
  assert.equal(adWrapper.isAvailable(), false);
  adWrapper.showRewarded('revive');
  assert.equal(errors, 1);
  assert.equal(rewards, 0);
  assert.equal(skips, 0);

  let selections = 0;
  const menu = new MenuUI();
  menu.currentScreen = 'gameover';
  menu.canWatchRevive = true;
  menu.reviveAdAvailable = adWrapper.isAvailable();
  const audio = { menuSelect: () => { selections++; } } as unknown as Audio;
  assert.equal(menu.handleClick(260, 560, 900, 720, audio), null);
  assert.equal(selections, 0);
  assert.equal(rewards, 0);
});
