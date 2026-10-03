import { Camera } from '../core/camera';
import { HORROR_ATTACKS, HORROR_TYPES, ZOMBIE_TYPES, getHorrorAttack } from '../data/zombies';
import type { HorrorTypeId, ZombieTypeDef } from '../data/zombies';
import { ZombieSystem } from '../entities/zombies';
import type { Zombie } from '../entities/zombies';
import { SOLID_BUILDINGS, isInsideBuilding, segmentHitsBuilding } from '../entities/map-geometry';
import { horrorAttackHits, updateHorrorAI } from '../systems/horror-ai';
import { Spawner } from '../systems/spawner';

/** Invoked only by the development preview. Uses isolated systems, never the live run/save. */
export function runHorrorChecks(): string[] {
  if (!import.meta.env.DEV) return [];
  const passed: string[] = [];
  const assert = (condition: boolean, message: string): void => {
    if (!condition) throw new Error(`[Horror checks] ${message}`);
  };
  const close = (actual: number, expected: number, message: string): void => {
    assert(Math.abs(actual - expected) < 0.00001, `${message}: ${actual} !== ${expected}`);
  };
  const spawn = (system: ZombieSystem, type: ZombieTypeDef, x = 2000, y = 2000): Zombie =>
    system.spawn(type, x, y, 1, 1, 1);
  const forceActive = (z: Zombie, angle: number): void => {
    const attack = getHorrorAttack(z.typeId)!;
    z.specialState = 'active';
    z.specialAngle = angle;
    z.specialDuration = z.specialTimer = attack.active;
    z.specialHit = false;
  };
  const stateIs = (z: Zombie, expected: Zombie['specialState']): boolean => z.specialState === expected;
  const expectedIds = ['spider', 'armed', 'rat_king', 'mutant', 'multihead'];
  assert(HORROR_TYPES.length === 5 && expectedIds.every(id => HORROR_TYPES.some(type => type.id === id)), 'all five distinct creature definitions exist');
  assert(expectedIds.every(id => !ZOMBIE_TYPES.some(type => type.id === id)), 'legacy stage roster excludes new creatures');
  assert(getHorrorAttack('normal') === undefined && getHorrorAttack('toString') === undefined, 'special attack lookup rejects legacy/prototype keys');

  for (const type of HORROR_TYPES) {
    const attack = HORROR_ATTACKS[type.id as HorrorTypeId];
    const system = new ZombieSystem();
    const z = spawn(system, type);
    const startHP = z.hp;
    assert(attack.windup >= 0.65 && attack.recovery > 0 && attack.cooldown > 0, `${type.id}: readable warning and recovery timing`);
    assert(!horrorAttackHits(z, z.x, z.y, 12, false), `${type.id}: chase cannot hurt`);

    updateHorrorAI(z, 0.01, z.x + attack.triggerRange * 0.65, z.y, false);
    assert(stateIs(z, 'windup') && !z.specialStarted, `${type.id}: enters windup before attack`);
    assert(!horrorAttackHits(z, z.x + 1, z.y, 12, false), `${type.id}: overlapping player is safe during windup`);
    close(z.vx, 0, `${type.id}: windup stops movement`);
    close(z.vy, 0, `${type.id}: windup stops lateral movement`);
    const committedAngle = z.specialAngle;
    updateHorrorAI(z, attack.windup * 0.3, z.x, z.y + 80, false);
    close(z.specialAngle, committedAngle, `${type.id}: aim locks while player sidesteps`);
    close(z.facingAngle, committedAngle, `${type.id}: visible facing matches committed aim`);
    assert(!horrorAttackHits(z, z.x + 1, z.y, 12, false), `${type.id}: warning remains harmless`);

    updateHorrorAI(z, z.specialTimer + 0.0001, z.x - 80, z.y, false);
    assert(stateIs(z, 'active') && z.specialStarted, `${type.id}: active transition emits one attack cue`);
    close(z.specialAngle, committedAngle, `${type.id}: active aim stays locked`);
    assert(horrorAttackHits(z, z.x + attack.reach * 0.6, z.y, 12, false), `${type.id}: active hit inside declared reach`);
    assert(!horrorAttackHits(z, z.x + attack.reach + 12.01, z.y, 12, false), `${type.id}: no damage outside declared reach`);
    if (attack.arc < Math.PI * 2) {
      assert(!horrorAttackHits(z, z.x - attack.reach, z.y, 12, false), `${type.id}: player behind attack cone is safe`);
    }
    z.specialHit = true;
    assert(!horrorAttackHits(z, z.x + 1, z.y, 12, false), `${type.id}: consumed attack cannot hit twice`);
    updateHorrorAI(z, 0.001, z.x, z.y + 80, false);
    assert(!z.specialStarted, `${type.id}: attack cue clears on following frame`);
    z.specialHit = false;
    updateHorrorAI(z, z.specialTimer + 0.0001, z.x + 1, z.y, false);
    assert(stateIs(z, 'recover') && !horrorAttackHits(z, z.x + 1, z.y, 12, false), `${type.id}: recovery is harmless even without a prior hit`);
    close(z.vx, 0, `${type.id}: recovery stops charge`);
    updateHorrorAI(z, z.specialTimer + 0.0001, z.x + 1, z.y, false);
    assert(stateIs(z, 'chase') && z.attackCooldown > 0, `${type.id}: returns to chase with cooldown`);
    updateHorrorAI(z, 0.01, z.x + 1, z.y, false);
    assert(stateIs(z, 'chase'), `${type.id}: cooldown prevents immediate new warning`);
    close(z.hp, startHP, `${type.id}: AI never modifies monster health`);

    const slowedSystem = new ZombieSystem();
    const fullSystem = new ZombieSystem();
    const slowed = spawn(slowedSystem, type);
    const full = spawn(fullSystem, type);
    slowed.slowTimer = 1;
    slowed.slowMult = 0.4;
    slowedSystem.update(0.1, 2500, 2000, false);
    fullSystem.update(0.1, 2500, 2000, false);
    assert(full.x > 2000 && slowed.x > 2000, `${type.id}: real entity update moves toward player`);
    close(slowed.x - 2000, (full.x - 2000) * 0.4, `${type.id}: chase obeys slow debuff`);
    close(slowed.slowTimer, 0.9, `${type.id}: slow timer decrements once per frame`);
    if (attack.dashSpeed > 0) {
      forceActive(slowed, 0);
      updateHorrorAI(slowed, 0.05, slowed.x + 200, slowed.y, false);
      close(slowed.vx, attack.dashSpeed * 0.4, `${type.id}: dash also obeys slow debuff`);
    }
    full.hp = 0;
    forceActive(full, 0);
    const deadX = full.x;
    fullSystem.update(0.05, 2500, 2000, false);
    close(full.x, deadX, `${type.id}: dead creature does not move`);
    assert(fullSystem.pool.activeCount === 1 && !horrorAttackHits(full, full.x + 1, full.y, 12, false), `${type.id}: dead entity remains for reward owner and cannot attack`);
    passed.push(`PASS ${type.id}: warning, locked aim, active reach/arc, single hit, recovery, cooldown, movement, slow, death`);

    // Poison all transient fields, release, then acquire the same pooled object as a legacy type.
    const priorId = z.id;
    z.specialState = 'active'; z.specialTimer = 9; z.specialDuration = 9; z.specialAngle = 2;
    z.specialHit = true; z.specialStarted = true; z.deathHandled = true;
    z.flashTimer = 3; z.burnTimer = 5; z.burnDamage = 90; z.slowTimer = 4; z.slowMult = 0.2;
    z.vx = 400; z.vy = -500; z.knockbackX = 500; z.knockbackY = -500; z.attackCooldown = 8;
    z.attackAnim = 1; z.attackTimer = 9; z.isBoss = true; z.isElite = true; z.isGlowing = true;
    z.ranged = true; z.explodes = true;
    system.pool.release(z);
    assert(system.pool.activeCount === 0, `${type.id}: pool releases exactly once`);
    const reused = spawn(system, ZOMBIE_TYPES[0]);
    assert(reused === z && reused.id !== priorId, `${type.id}: pool reuses object with a new collision id`);
    assert(stateIs(reused, 'chase') && !reused.specialHit && !reused.specialStarted && !reused.deathHandled, `${type.id}: pooled attack/death flags reset`);
    assert(reused.specialTimer === 0 && reused.specialDuration === 1 && reused.specialAngle === 0, `${type.id}: pooled warning timing resets`);
    assert(reused.flashTimer === 0 && reused.burnTimer === 0 && reused.slowTimer === 0 && reused.slowMult === 1, `${type.id}: pooled debuffs reset`);
    assert(reused.vx === 0 && reused.vy === 0 && reused.knockbackX === 0 && reused.knockbackY === 0, `${type.id}: pooled velocities reset`);
    assert(reused.attackCooldown === 0 && reused.attackAnim === 0 && reused.attackTimer === 0, `${type.id}: pooled animation/cooldown reset`);
    assert(!reused.isBoss && !reused.isElite && !reused.isGlowing && !reused.ranged && !reused.explodes, `${type.id}: spawn replaces creature flags`);
    assert(!updateHorrorAI(reused, 0.01, reused.x + 1, reused.y, false), `${type.id}: reused normal zombie bypasses special AI`);
  }
  passed.push('PASS pool: every creature reuses cleanly as a legacy zombie; reward/death ownership preserved');

  const warehouse = SOLID_BUILDINGS.find(building => building.large)!;
  assert(!!warehouse, 'real enterable warehouse exists');
  const wallY = warehouse.y - warehouse.halfHeight;
  const doorY = warehouse.y + warehouse.halfHeight;
  assert(segmentHitsBuilding(warehouse.x, wallY - 40, warehouse.x, wallY + 70), 'line of sight intersects actual 24px warehouse wall');
  assert(!segmentHitsBuilding(warehouse.x, doorY + 45, warehouse.x, doorY - 80), 'line of sight passes through actual warehouse doorway');
  assert(!segmentHitsBuilding(2000, 2000, 2100, 2000), 'clear horizontal line remains clear');
  assert(!segmentHitsBuilding(2000, 2000, 2000, 2100), 'clear vertical line remains clear');

  for (const type of HORROR_TYPES) {
    const attack = getHorrorAttack(type.id)!;
    const wallSystem = new ZombieSystem();
    const z = spawn(wallSystem, type, warehouse.x, wallY - type.size - 4);
    const behindWallY = wallY + 24 + 5;
    updateHorrorAI(z, 0.01, warehouse.x, behindWallY, true);
    assert(stateIs(z, 'chase'), `${type.id}: wall prevents starting an attack`);
    // Place a target in reach across the wall, using a target radius to cover all charge reaches.
    forceActive(z, Math.PI / 2);
    assert(horrorAttackHits(z, warehouse.x, behindWallY, 40, false), `${type.id}: across-wall control target is geometrically in range`);
    assert(!horrorAttackHits(z, warehouse.x, behindWallY, 40, true), `${type.id}: wall blocks active damage`);

    if (attack.dashSpeed > 0) {
      // One slow frame would carry the center past the entire wall without substeps.
      z.y = wallY - type.size - 4;
      forceActive(z, Math.PI / 2);
      const dt = attack.active * 0.9;
      assert(z.y + attack.dashSpeed * dt > wallY + 24 + type.size, `${type.id}: tunneling regression travels past wall in one frame`);
      wallSystem.update(dt, warehouse.x, wallY + 140, true);
      assert(z.y <= wallY - z.size + 0.001 && !isInsideBuilding(z.x, z.y), `${type.id}: charge substeps prevent thin-wall tunneling`);
    }

    const doorSystem = new ZombieSystem();
    const walker = spawn(doorSystem, type, warehouse.x, doorY + type.size + 6);
    walker.attackCooldown = 10;
    for (let frame = 0; frame < 100; frame++) doorSystem.update(0.025, warehouse.x, doorY - 180, true);
    assert(walker.y < doorY - 8 && !isInsideBuilding(walker.x, walker.y), `${type.id}: real movement enters warehouse through door`);
    passed.push(`PASS ${type.id}: wall blocks attack/visibility${attack.dashSpeed ? ' and fast charge' : ''}; open doorway remains traversable`);
  }

  const camera = new Camera();
  camera.resize(1280, 720);
  camera.x = 1360; camera.y = 1640;
  const originalRandom = Math.random;
  const roster = [...ZOMBIE_TYPES, ...HORROR_TYPES];
  const availableAt = (time: number, survival: boolean): ZombieTypeDef[] =>
    (survival ? roster : ZOMBIE_TYPES).filter(type => !type.isBoss && type.minTime <= time);
  const midpoint = (available: ZombieTypeDef[], wanted: ZombieTypeDef): number => {
    const total = available.reduce((sum, type) => sum + type.weight, 0);
    const index = available.indexOf(wanted);
    assert(index >= 0 && wanted.weight > 0, `weight interval exists for ${wanted.id}`);
    const prior = available.slice(0, index).reduce((sum, type) => sum + type.weight, 0);
    return (prior + wanted.weight / 2) / total;
  };
  const choose = (time: number, random: number, survival?: boolean) => {
    Math.random = () => random;
    const spawner = new Spawner();
    const tier = spawner.getCurrentTier(time);
    const results = spawner.update(1 / tier.spawnRate + 0.00001, time, 0, camera, 2000, 2000, survival);
    const regular = results.filter(result => !result.type.isBoss);
    assert(regular.length === tier.batchSize, `spawner emits one complete batch at ${time}s`);
    assert(results.every(result => result.type.minTime <= time), `spawner respects unlock times at ${time}s`);
    return regular;
  };
  try {
    for (const unlocked of HORROR_TYPES) {
      const time = unlocked.minTime;
      const available = availableAt(time, true);
      for (const type of available) {
        const quantile = midpoint(available, type);
        const chosen = choose(time, quantile, true);
        assert(chosen.every(result => result.type.id === type.id), `${type.id}: survival weight interval selects the correct creature at ${time}s`);
        if (getHorrorAttack(type.id)) assert(chosen.every(result => !result.isElite), `${type.id}: special body bounds cannot gain an elite enlargement`);
        assert(choose(time - 0.001, quantile, true).every(result => result.type.id !== unlocked.id), `${unlocked.id}: never spawns before ${time}s`);
        assert(choose(time, quantile, false).every(result => !getHorrorAttack(result.type.id)), `stage roster remains unchanged at ${time}s`);
      }
      passed.push(`PASS spawn ${unlocked.id}: unlock ${time}s, weight ${unlocked.weight}, every available weighted interval validated`);
    }
    for (const time of [0, 24.999, 155, 300, 900]) {
      const legacy = availableAt(time, false);
      for (const type of legacy) {
        const quantile = midpoint(legacy, type);
        assert(choose(time, quantile).every(result => result.type.id === type.id), `default stage spawner preserves ${type.id} weight at ${time}s`);
      }
      assert(choose(time, 0.999999, false).every(result => !getHorrorAttack(result.type.id)), `stage tail interval excludes horror roster at ${time}s`);
    }
  } finally {
    Math.random = originalRandom;
  }
  assert(Math.random === originalRandom, 'random generator restored after deterministic checks');
  passed.push('PASS stage/default spawner: legacy weighted roster preserved through 900s; random generator restored; no save access');
  return passed;
}
