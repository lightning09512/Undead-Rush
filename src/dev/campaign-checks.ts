import { CAMPAIGN_ATTACKS, STAGES, type CampaignRect, type Point, type StageDef } from '../data/meta';

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
  for (const stage of STAGES) {
    const layout = stage.layout;
    if (!layout) throw new Error(`Màn ${stage.id}: thiếu layout`);
    if (layout.zones.length < 4 || layout.zones.length > 6) throw new Error(`Màn ${stage.id}: số khu sai`);
    if (layout.gates.length !== layout.zones.length - 1) throw new Error(`Màn ${stage.id}: số cổng sai`);
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
    results.push(`PASS ${stage.id}: ${layout.zones.length} khu • mở đầu an toàn ${Math.round(firstTriggerDistance / routeLength * 100)}% • ${activeZones} trigger • ${plannedHorde * 10} mob theo kế hoạch • tuyến/cổng thông`);
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
