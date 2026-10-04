import { CAMPAIGN_ATTACKS, STAGES, type CampaignRect, type Point, type StageDef } from '../data/meta';
import { CAMPAIGN_VARIANT_TYPES, HORROR_TYPES, ZOMBIE_TYPES, getCampaignVariantAttack } from '../data/zombies';
import { createAllGunDefs, createCampaignGunDefs } from '../systems/gun-loadout';
import { canDamageCampaignSpawnPortal } from '../systems/campaign-portal-rules';

function inside(x: number, y: number, rect: CampaignRect): boolean {
  return x >= rect.x && y >= rect.y && x <= rect.x + rect.w && y <= rect.y + rect.h;
}

function distance(a: Point, b: Point): number { return Math.hypot(a.x - b.x, a.y - b.y); }

function clearSpawnPoint(stage: StageDef, zoneIndex: number, point: Point): boolean {
  const layout = stage.layout!;
  const zone = layout.zones[zoneIndex];
  const pad = 52;
  if (!inside(point.x, point.y, zone) || layout.decorations.some(prop => prop.solid &&
      point.x + pad > prop.x && point.x - pad < prop.x + prop.w &&
      point.y + pad > prop.y && point.y - pad < prop.y + prop.h)) return false;
  return !stage.buildings.some(building => Math.abs(point.x - building.x) < building.halfWidth + pad &&
    Math.abs(point.y - building.y) < building.halfHeight + pad);
}

function reachable(stage: StageDef, start: Point, goal: Point, blockedGate = -1): boolean {
  const layout = stage.layout!;
  const radius = 18;
  const step = 24;
  const cols = Math.ceil(layout.bounds.w / step) + 1;
  const rows = Math.ceil(layout.bounds.h / step) + 1;
  const cell = (x: number, y: number) => Math.round(y / step) * cols + Math.round(x / step);
  const startId = cell(start.x, start.y), goalId = cell(goal.x, goal.y);
  const visited = new Uint8Array(cols * rows);
  const queue = new Int32Array(cols * rows);
  let head = 0, tail = 0;
  queue[tail++] = startId; visited[startId] = 1;
  while (head < tail) {
    const id = queue[head++];
    if (id === goalId) return true;
    const cx = id % cols, cy = Math.floor(id / cols);
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const next = ny * cols + nx;
      if (visited[next]) continue;
      const px = nx * step, py = ny * step;
      if (blockedGate >= 0) {
        const gate = layout.gates[blockedGate];
        if (px + radius > gate.x && px - radius < gate.x + gate.w &&
            py + radius > gate.y && py - radius < gate.y + gate.h) continue;
      }
      if (!layout.zones.some(z => inside(px, py, z)) && !layout.corridors.some(r => inside(px, py, r))) continue;
      if (layout.decorations.some(p => p.solid && px + radius > p.x && px - radius < p.x + p.w &&
          py + radius > p.y && py - radius < p.y + p.h)) continue;
      // Houses are conservatively treated as solid here; the separate doorway
      // can only add routes, and no mandatory objective is placed inside one.
      if (stage.buildings.some(b => Math.abs(px - b.x) < b.halfWidth + radius &&
          Math.abs(py - b.y) < b.halfHeight + radius)) continue;
      visited[next] = 1; queue[tail++] = next;
    }
  }
  return false;
}

/** Deterministic geometry audit in the development panel; never touches save. */
export function runCampaignChecks(): string[] {
  const results: string[] = [];
  if (canDamageCampaignSpawnPortal(false, 4, 4, false) ||
      canDamageCampaignSpawnPortal(true, 3, 4, false) ||
      !canDamageCampaignSpawnPortal(true, 4, 4, false) ||
      canDamageCampaignSpawnPortal(true, 4, 4, true))
    throw new Error('Campaign spawn damage must be boss-room only, with the planted-charge target locked to its objective');
  results.push('PASS spawn damage: ordinary zones are invulnerable; boss-room portals take gunfire; the selected charge nest requires its objective');

  const chargeStages = STAGES.filter(stage => stage.bossRoomNestCharge).map(stage => stage.id);
  if (chargeStages.join(',') !== '9,10') throw new Error(`Boss-room explosive task stages changed unexpectedly: ${chargeStages.join(',')}`);
  for (const stage of STAGES) {
    const config = stage.bossRoomNestCharge;
    if (!config) continue;
    const bossZoneIndex = stage.layout!.zones.length - 1;
    const bossZone = stage.layout!.zones[bossZoneIndex];
    const target = bossZone.spawnPoints[config.targetSpawnPointIndex];
    const pickup = { x: bossZone.x + bossZone.w / 2 + config.pickupOffset.x,
      y: bossZone.y + bossZone.h / 2 + config.pickupOffset.y };
    if (!target || !clearSpawnPoint(stage, bossZoneIndex, target) || !clearSpawnPoint(stage, bossZoneIndex, pickup) ||
        !reachable(stage, pickup, target) || config.fuseSeconds < 3 || config.fuseSeconds > 8)
      throw new Error(`Màn ${stage.id}: thuốc nổ hoặc ổ spawn nhiệm vụ không hợp lệ/không tới được`);
  }
  results.push('PASS thuốc nổ boss room: chỉ màn 9–10; vật phẩm, mục tiêu và đường tiếp cận hợp lệ');
  const introductions: Record<string, number> = {
    orange_mutant: 2, gunner: 4, gunner_orange: 6, red_mutant: 7, gunner_red: 8,
  };
  for (const type of CAMPAIGN_VARIANT_TYPES) {
    const introStage = introductions[type.id];
    const attack = getCampaignVariantAttack(type.id);
    if (!introStage || !attack || HORROR_TYPES.some(other => other.id === type.id) || ZOMBIE_TYPES.some(other => other.id === type.id))
      throw new Error(`${type.id}: Campaign-only data/attack missing or leaked into shared roster`);
    if (STAGES[0].mobIds.includes(type.id) || STAGES.slice(0, introStage - 1).some(stage => stage.mobIds.includes(type.id)))
      throw new Error(`${type.id}: appears before its planned introduction`);
    if (!STAGES.slice(introStage - 1).some(stage => stage.layout?.zones.some(zone => zone.waveTrigger && zone.mobs.includes(type.id))))
      throw new Error(`${type.id}: never appears in an authored active-wave zone after its introduction`);
    if (type.ranged && (!attack.burstCount || !attack.projectileType || attack.windup < .7 || attack.recovery <= 0))
      throw new Error(`${type.id}: gunner lacks a readable, recoverable burst`);
    if (!type.ranged && attack.dashSpeed <= 0)
      throw new Error(`${type.id}: mutant is missing its telegraphed pounce`);
  }
  const guns = createCampaignGunDefs().sort((a, b) => (a.unlockStage ?? 0) - (b.unlockStage ?? 0));
  if (guns.length !== 10 || guns.some((gun, index) => gun.unlockStage !== index + 1) || guns[0].id !== 'p9')
    throw new Error('Campaign weapons are not ordered from P-9 through one unlock per stage');
  const campaignBase = new Map(createCampaignGunDefs(false).map(gun => [gun.id, gun]));
  const survival = new Map(createAllGunDefs().map(gun => [gun.id, gun]));
  if ([...campaignBase].some(([id, gun]) => survival.get(id)?.baseDamage !== gun.baseDamage ||
      survival.get(id)?.extraBurnDamage !== gun.extraBurnDamage || survival.get(id)?.extraBlastRadius !== gun.extraBlastRadius))
    throw new Error('Campaign power tuning leaked into Survival weapon data');
  const damage = new Map(guns.map(gun => [gun.id, gun.baseDamage]));
  if (damage.get('smg9') !== 15 || damage.get('sg12') !== 14 || damage.get('dmr55') !== 52 ||
      damage.get('lmg6') !== 20 || damage.get('flamer8') !== 11 || damage.get('rpg4') !== 100 || damage.get('rail_lance') !== 122)
    throw new Error('Campaign weapon tiers are missing their calibrated power steps');
  results.push('PASS roster: 5 quái mới chỉ thuộc Campaign, được giới thiệu đúng mốc và có báo đòn/nhịp hồi phục');
  results.push(`PASS vũ khí: ${guns.map(gun => `${gun.unlockStage}:${gun.shortName}`).join(' → ')}; P-9 mở đầu, boss trao súng kế tiếp; tăng lực chỉ ở Campaign`);
  for (const stage of STAGES) {
    const layout = stage.layout;
    if (!layout) throw new Error(`Màn ${stage.id}: thiếu layout`);
    if (layout.zones.length < 4 || layout.zones.length > 6) throw new Error(`Màn ${stage.id}: số khu sai`);
    if (layout.gates.length !== layout.zones.length - 1) throw new Error(`Màn ${stage.id}: số cổng sai`);
    if (layout.zones.some(zone => !Number.isInteger(zone.waveSize) || zone.waveSize < 0 || !Number.isFinite(zone.waveSize)) ||
        layout.zones.at(-1)!.waveTrigger || layout.zones.at(-1)!.waveSize !== 0)
      throw new Error(`Màn ${stage.id}: ngân sách wave phải hữu hạn theo khu và boss room không phải wave thường`);
    if (layout.bounds.w / layout.bounds.h < 2) throw new Error(`Màn ${stage.id}: tuyến chưa đủ dài`);
    const firstTrigger = layout.zones.findIndex(zone => zone.waveTrigger);
    if (firstTrigger < 2 || layout.zones.slice(0, firstTrigger).some(zone => zone.waveTrigger || zone.waveSize !== 0))
      throw new Error(`Màn ${stage.id}: khu mở đầu không hoàn toàn an toàn`);
    if (layout.zones.slice(0, firstTrigger).some(zone => !zone.landmark || !layout.decorations.some(prop =>
        prop.x + prop.w >= zone.x && prop.x <= zone.x + zone.w && prop.y + prop.h >= zone.y && prop.y <= zone.y + zone.h)))
      throw new Error(`Màn ${stage.id}: khu mở đầu thiếu landmark hoặc vật thể khám phá`);
    if (layout.zones.some(zone => zone.waveTrigger && (zone.waveSize < 1 || zone.spawnPoints.filter(point =>
        clearSpawnPoint(stage, layout.zones.indexOf(zone), point) &&
        distance(point, { x: zone.x + 12, y: zone.y + zone.h / 2 }) >= 300).length < 2)))
      throw new Error(`Màn ${stage.id}: khu giao tranh thiếu lối spawn an toàn`);
    if (layout.zones.at(-1)!.spawnPoints.filter(point => clearSpawnPoint(stage, layout.zones.length - 1, point) &&
        distance(point, stage.bossSpawn) >= 300).length < 2)
      throw new Error(`Màn ${stage.id}: đấu trường boss thiếu cửa vào hỗ trợ`);
    const routePoints: Point[] = [stage.playerStart, ...layout.zones.map(zone => ({ x: zone.x + zone.w / 2, y: zone.y + zone.h / 2 })), stage.bossSpawn];
    const routeLength = routePoints.slice(1).reduce((sum, point, i) => sum + distance(routePoints[i], point), 0);
    const firstTriggerDistance = routePoints.slice(1, firstTrigger + 2).reduce((sum, point, i) => sum + distance(routePoints[i], point), 0);
    if (firstTriggerDistance / routeLength < .2) throw new Error(`Màn ${stage.id}: đoạn yên lặng dưới 20% tuyến`);
    const moves = CAMPAIGN_ATTACKS[stage.id];
    if (!moves || new Set(moves.map(move => move.kind)).size < 4 || !moves.some(move => move.telegraph >= .9))
      throw new Error(`Màn ${stage.id}: thiếu đòn đa dạng hoặc đòn trì hoãn`);
    if (layout.zones.some(zone => zone.mobs.some(id => !stage.mobIds.includes(id)))) throw new Error(`Màn ${stage.id}: mob ngoài roster`);
    const points = [stage.playerStart, ...stage.objectiveNodes, stage.bossSpawn, stage.exitSpawn!];
    if (points.some(p => !layout.zones.some(z => inside(p.x, p.y, z)))) throw new Error(`Màn ${stage.id}: mục tiêu ngoài khu`);
    if (!reachable(stage, stage.playerStart, stage.exitSpawn!)) throw new Error(`Màn ${stage.id}: lối thoát không thông`);
    for (const objective of stage.objectiveNodes)
      if (!reachable(stage, stage.playerStart, objective)) throw new Error(`Màn ${stage.id}: mục tiêu không tới được`);
    for (let i = 0; i < layout.gates.length; i++) {
      const zone = layout.zones[i + 1];
      const target = { x: zone.x + zone.w / 2, y: zone.y + zone.h / 2 };
      if (reachable(stage, stage.playerStart, target, i)) throw new Error(`Màn ${stage.id}: đi tắt qua cổng ${i + 1}`);
    }
    const plannedHorde = layout.zones.reduce((sum, zone) => sum + zone.waveSize, 0);
    const originalBudget = layout.zones.reduce((sum, zone, i) => sum + (zone.role === 'boss' ? 0 : Math.min(9, 2 + (stage.id - 1) / 2 + i * .7) | 0), 0);
    if (plannedHorde !== originalBudget) throw new Error(`Màn ${stage.id}: tổng lượng quái thay đổi (${plannedHorde}/${originalBudget})`);
    const activeZones = layout.zones.filter(zone => zone.waveTrigger).length;
    const tunedWaveMultiplier = stage.id === 1 ? 6 : 8;
    results.push(`PASS ${stage.id}: ${layout.zones.length} khu • mở đầu an toàn ${Math.round(firstTriggerDistance / routeLength * 100)}% • ${activeZones} trigger • tối đa ${plannedHorde * tunedWaveMultiplier} mob theo kế hoạch • tuyến/cổng thông`);
  }
  let distinctPairs = 0;
  for (let i = 0; i < STAGES.length; i++) for (let j = i + 1; j < STAGES.length; j++) {
    const a = STAGES[i], b = STAGES[j];
    const aFloors = a.layout!.zones.map(z => z.floor).join(','), bFloors = b.layout!.zones.map(z => z.floor).join(',');
    const aProps = a.layout!.decorations.map(p => p.kind).join(','), bProps = b.layout!.decorations.map(p => p.kind).join(',');
    if (aFloors === bFloors || aProps === bProps || a.floorColor === b.floorColor) throw new Error(`Màn ${a.id}/${b.id}: bản sắc dữ liệu quá giống`);
    distinctPairs++;
  }
  results.push(`PASS ${distinctPairs} cặp màn có chất liệu, vật thể và màu nền khác nhau`);
  return results;
}
