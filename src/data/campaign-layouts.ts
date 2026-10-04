import type { CampaignLayout, CampaignRect, CampaignZone, StageDef } from './meta';

type Chapter = {
  bends: number[];
  zones: Array<[string, CampaignZone['role'], string, string[]]>;
  objectiveZones: number[];
  props: string[];
  floors: string[];
};

// Every chapter has an authored procession of places. The coordinates are
// derived from these bends; no stage shares the old square world layout.
const CHAPTERS: Chapter[] = [
  { bends: [1150, 820, 1490, 770, 1160], objectiveZones: [1, 3], props: ['car', 'house', 'fence', 'radio', 'ambulance'], floors: ['road', 'yard', 'road', 'plaza', 'rescue'], zones: [
    ['Chốt vào ngoại ô', 'entry', 'Xe dân sự và chốt chắn', ['normal']],
    ['Cụm nhà và sân nhỏ', 'objective', 'Nhà mở cửa và radio sân', ['normal', 'normal', 'runner']],
    ['Đường xe bị chặn', 'combat', 'Vườn sau và hàng rào đổ', ['runner', 'normal']],
    ['Quảng trường radio', 'objective', 'Cột phát sóng cứu hộ', ['normal', 'runner']],
    ['Sân trạm cứu hộ', 'boss', 'Cổng trạm và còi cứu hộ', []],
  ] },
  { bends: [1090, 820, 1450, 780, 1290], objectiveZones: [1, 2, 3], props: ['signfuel', 'pump', 'shelf', 'tanker', 'pump'], floors: ['oily', 'forecourt', 'shop', 'oily', 'garage'], zones: [
    ['Bãi xe dẫn vào', 'entry', 'Xe bỏ lại', ['normal']],
    ['Sân cột bơm', 'objective', 'Mái che và vòi bơm', ['normal', 'runner']],
    ['Cửa hàng tiện lợi', 'objective', 'Quầy hàng đổ', ['normal', 'exploder']],
    ['Bãi xe bồn', 'objective', 'Xe bồn lật và ống dẫn', ['runner', 'exploder']],
    ['Sân bảo dưỡng', 'boss', 'Trạm sửa xe cháy', []],
  ] },
  { bends: [860, 1330, 790, 1450, 910], objectiveZones: [1, 3], props: ['ambulance', 'tent', 'bed', 'shelf', 'surgery'], floors: ['parking', 'canvas', 'vinyl', 'vinyl', 'tile'], zones: [
    ['Bãi xe cứu thương', 'entry', 'Xe cứu thương hỏng', ['normal', 'runner']],
    ['Lều cấp cứu', 'objective', 'Máy phát điện và cáng', ['normal', 'runner']],
    ['Hành lang bệnh viện', 'combat', 'Cửa bệnh phòng và đèn chập', ['spitter', 'runner']],
    ['Phòng vật tư', 'objective', 'Tủ thuốc và kho vật tư', ['normal', 'spitter', 'glowing']],
    ['Khu cấp cứu cuối', 'boss', 'Bàn mổ và rèm máu', []],
  ] },
  { bends: [890, 1540, 1710, 930, 930], objectiveZones: [1, 2, 3], props: ['drain', 'pipe', 'valve', 'bridge', 'nest'], floors: ['brick', 'water', 'valve', 'water', 'nest'], zones: [
    ['Miệng cống', 'entry', 'Cầu thoát nước', ['normal']],
    ['Nhánh cống thấp', 'objective', 'Hốc nhện và van một', ['spider', 'normal']],
    ['Phòng van lớn', 'objective', 'Máy bơm và van hai', ['spitter', 'spider']],
    ['Cầu cửa xả', 'objective', 'Cầu sắt và van ba', ['exploder', 'normal']],
    ['Ổ chuột', 'boss', 'Tổ đuôi xoắn', []],
  ] },
  { bends: [950, 950, 1590, 1590, 950], objectiveZones: [1, 2, 3], props: ['barricade', 'tower', 'armor', 'gatehouse', 'sandbag'], floors: ['road', 'concrete', 'parking', 'concrete', 'arena'], zones: [
    ['Đường chống xe', 'entry', 'Rào thép và bánh xe', ['normal', 'runner']],
    ['Bao cát và chòi gác', 'objective', 'Chòi gác quân sự', ['armed', 'runner']],
    ['Bãi xe bọc thép', 'objective', 'Xe bọc thép và máy liên lạc', ['tank', 'exploder']],
    ['Cổng chính', 'objective', 'Khóa cổng tiền đồn', ['runner', 'armed']],
    ['Sân tập sau cổng', 'boss', 'Cổng phá và giáp gãy', []],
  ] },
  { bends: [830, 830, 1430, 1430, 910], objectiveZones: [1, 2, 3], props: ['glass', 'shopfront', 'foodcourt', 'escalator', 'stage'], floors: ['glass', 'shop', 'food', 'atrium', 'stage'], zones: [
    ['Cửa vào sập kính', 'entry', 'Kính vỡ và cửa hàng tối', ['normal', 'runner']],
    ['Dãy cửa hàng', 'objective', 'Biển hiệu và kệ hàng', ['armed', 'spitter']],
    ['Food court', 'objective', 'Quầy ăn và bàn đổ', ['tank', 'glowing']],
    ['Sảnh trung tâm', 'hold', 'Thang cuốn hỏng', ['spider', 'armed', 'spitter']],
    ['Sảnh biểu diễn', 'boss', 'Sân khấu gãy', []],
  ] },
  { bends: [1160, 760, 1520, 760, 1140], objectiveZones: [1, 2, 3], props: ['signal', 'container', 'wagon', 'switch', 'engine'], floors: ['gravel', 'container', 'rail', 'control', 'rail'], zones: [
    ['Lối vào đường ray', 'entry', 'Tín hiệu đường sắt', ['runner', 'normal']],
    ['Vành đai container', 'objective', 'Hai vòng container', ['tank', 'armed']],
    ['Sân toa hàng', 'objective', 'Toa tàu bỏ hoang', ['tank', 'runner']],
    ['Phòng tín hiệu', 'objective', 'Bàn chuyển ray', ['exploder', 'runner']],
    ['Đoạn ray cuối', 'boss', 'Đầu tàu gỉ', []],
  ] },
  { bends: [820, 820, 1530, 1530, 910], objectiveZones: [1, 2, 3], props: ['reception', 'chamber', 'culture', 'console', 'tank'], floors: ['clean', 'glass', 'culture', 'control', 'test'], zones: [
    ['Sảnh tiếp nhận', 'entry', 'Bảng hướng dẫn hỏng', ['normal', 'runner']],
    ['Hành lang buồng kính', 'objective', 'Kính nứt và thẻ truy cập', ['spitter', 'glowing']],
    ['Khu nuôi cấy', 'objective', 'Bồn cấy nhiễm bệnh', ['spider', 'exploder']],
    ['Phòng kiểm soát', 'objective', 'Máy khóa buồng', ['mutant', 'multihead']],
    ['Buồng thử nghiệm số không', 'boss', 'Ống mô và kính gãy', []],
  ] },
  { bends: [1050, 700, 1430, 1820, 1110, 920], objectiveZones: [2, 3, 4], props: ['barricade', 'store', 'nest', 'fence', 'quarantine', 'web'], floors: ['road', 'rubble', 'plaza', 'road', 'ash', 'web'], zones: [
    ['Chốt cách ly', 'entry', 'Dấu kiểm dịch', ['normal', 'runner']],
    ['Cửa hàng đổ nát', 'combat', 'Cửa hiệu thủng mái', ['tank', 'armed']],
    ['Quảng trường ổ dịch', 'objective', 'Ổ lây nhiễm một', ['spitter', 'spider']],
    ['Phố nối', 'objective', 'Ổ lây nhiễm hai', ['glowing', 'exploder']],
    ['Quảng trường phong tỏa', 'hold', 'Ổ lây nhiễm cuối', ['mutant', 'multihead', 'runner']],
    ['Tổ nhện cuối phố', 'boss', 'Kén khổng lồ', []],
  ] },
  { bends: [920, 1510, 840, 1570, 950, 950], objectiveZones: [1, 2, 3], props: ['bone', 'core', 'core', 'core', 'rib', 'heart'], floors: ['concrete', 'flesh', 'flesh', 'flesh', 'rib', 'heart'], zones: [
    ['Miệng vùng nhiễm', 'entry', 'Bê tông bị mô xâm lấn', ['tank', 'armed']],
    ['Nhánh lõi thứ nhất', 'objective', 'Lõi phụ một', ['spitter', 'exploder']],
    ['Nhánh lõi thứ hai', 'objective', 'Lõi phụ hai', ['mutant', 'tank']],
    ['Nhánh lõi thứ ba', 'objective', 'Lõi phụ ba', ['multihead', 'spitter']],
    ['Tiền sảnh lõi', 'combat', 'Xương sườn kiến trúc', ['armed', 'mutant']],
    ['Phòng tim', 'boss', 'Tim chôn sống', []],
  ] },
];

const room = (cx: number, cy: number, w: number, h: number): CampaignRect => ({ x: cx - w / 2, y: cy - h / 2, w, h });

export function applyCampaignLayouts(stages: StageDef[]): void {
  stages.forEach((stage, chapterIndex) => {
    const chapter = CHAPTERS[chapterIndex];
    stage.floorColor = ['#667273','#786b58','#657c7e','#5c746b','#727368','#746b74','#65727a','#6e8587','#786b68','#795f60'][chapterIndex];
    const centers = chapter.bends.map((y, i) => ({ x: 690 + i * 1210 + (i === chapter.bends.length - 1 ? 400 : 0), y }));
    const rawWaveSizes = chapter.zones.map(([, role], i) => role === 'boss' ? 0 : Math.min(9, 2 + chapterIndex / 2 + i * .7) | 0);
    const safeZoneCount = Math.min(2, chapter.zones.length - 1);
    const divertedOpeningBudget = rawWaveSizes.slice(0, safeZoneCount).reduce((sum, size) => sum + size, 0);
    const triggerZoneIndexes = chapter.zones
      .map(([, role], i) => i)
      .filter(i => i >= safeZoneCount && chapter.zones[i][1] !== 'boss');
    const zones: CampaignZone[] = chapter.zones.map(([name, role, landmark, mobs], i) => {
      const boss = role === 'boss';
      const waveTrigger = !boss && i >= safeZoneCount;
      const redistributed = waveTrigger && triggerZoneIndexes.length
        ? Math.floor(divertedOpeningBudget / triggerZoneIndexes.length) + (triggerZoneIndexes.indexOf(i) < divertedOpeningBudget % triggerZoneIndexes.length ? 1 : 0)
        : 0;
      // The opening stays quiet; its original encounter budget is reassigned to
      // later authored triggers so the total Campaign horde remains unchanged.
      const waveSize = waveTrigger ? rawWaveSizes[i] + redistributed : 0;
      const width = boss ? 1200 : i === 0 && stage.id <= 3 ? 1060 : 820;
      const height = boss ? 1080 : 690;
      const zoneRect = room(centers[i].x, centers[i].y, width, height);
      const portalOffsets: Array<[number, number]> = [
        [-.34,-.34],[0,-.36],[.34,-.34],[-.38,0],[.38,0],[-.34,.34],[0,.36],[.34,.34],
        [-.18,-.40],[.18,-.40],[-.18,.40],[.18,.40],
      ];
      return { ...zoneRect,
        name, role, landmark, floor: chapter.floors[i], mobs, waveSize, waveTrigger,
        spawnPoints: waveTrigger || boss ? portalOffsets.map(([ox, oy]) => ({ x: centers[i].x + ox * width, y: centers[i].y + oy * height })) : [] };
    });
    const corridors: CampaignRect[] = [];
    const gates = [] as CampaignLayout['gates'];
    for (let i = 0; i < zones.length - 1; i++) {
      const a = centers[i], b = centers[i + 1];
      const bendX = Math.round((a.x + b.x) / 2);
      const left = a.x + zones[i].w / 2 - 8;
      const right = b.x - zones[i + 1].w / 2 + 8;
      corridors.push(room((left + bendX) / 2, a.y, bendX - left + 12, 250));
      if (Math.abs(a.y - b.y) > 20) corridors.push(room(bendX, (a.y + b.y) / 2, 250, Math.abs(a.y - b.y) + 250));
      corridors.push(room((bendX + right) / 2, b.y, right - bendX + 12, 250));
      const requiredObjectives = chapter.objectiveZones.filter(zoneIndex => zoneIndex <= i).length;
      gates.push({ ...room(right - 35, b.y, 36, 250), afterZone: i, requiredObjectives });
    }
    const decorations: CampaignLayout['decorations'] = [];
    zones.forEach((zone, i) => {
      const cx = zone.x + zone.w / 2, cy = zone.y + zone.h / 2;
      const kind = chapter.props[i];
      if (stage.id <= 3) {
        const authoredProps: Record<number, string[][]> = {
          1: [
            ['car','bloodstain','streetlight','trafficcone','roadcrack','mailbox','tree','shrub','roadSign','trash','yarddebris','brokenFence'],
            ['fence','mailbox','yarddebris','tree','car','gardenlamp','shrub','porchsteps','gardenpatch','trash','mailbox','brokenFence'],
            ['car','barricade','fence','debris','streetlight','roadSign','tire','shrub','roadcrack','trash','bloodstain','yarddebris'],
            ['radio','rescuevan','streetlight','barrier','debris','wire','fence','streetlight','shrub','bloodstain','roadSign','trafficcone'],
            ['car','barricade','gardenlamp','crate','roadSign','debris','tree','shrub','brokenFence','trash','bloodstain','roadcrack'],
          ],
          2: [
            ['signfuel','bloodstain','oilspill','tire','car','trafficcone','barrel','fuelhose','canopy','bollard','trash','pallet'],
            ['canopy','pump','pump','fuelhose','bollard','oilspill','car','barrier','barrel','tire','roadDebris','lightbar'],
            ['shopfront','shelf','cooler','crate','brokenGlass','sign','car','trash','pallet','barrel','fuelhose','roadDebris'],
            ['tanker','fuelhose','oilspill','pallet','tire','barrel','crate','car','trafficcone','trash','brokenGlass','bollard'],
            ['workbench','tire','barrel','toolcart','car','crate','oilspill','sign','pallet','roadDebris','fuelhose','lightbar'],
          ],
          3: [
            ['ambulance','generator','tent','medicalSign','crate','lightbar','gurney','roadSign','oxygen','medicalCart','curtain','waste'],
            ['tent','gurney','curtain','supplyCrate','examLamp','chair','oxygen','medicalCart','lightbar','waste','instrument','medicalSign'],
            ['divider','gurney','oxygen','curtain','wetfloor','examLamp','chair','medicalSign','medicalCart','instrument','waste','supplyCrate'],
            ['shelf','medicalCart','cabinet','oxygen','monitor','crate','curtain','gurney','wetfloor','instrument','waste','lightbar'],
            ['surgery','gurney','instrument','examLamp','curtain','waste','oxygen','medicalCart','monitor','supplyCrate','divider','lightbar'],
          ],
        };
        const props = authoredProps[stage.id][i];
        const bossArena = zone.role === 'boss';
        const placementsByZone = [
          [[-300,-250],[260,-292],[-380,-67],[360,-82],[-250,222],[350,268],[-74,-306],[98,300],[-270,154],[340,164],[-150,112],[198,-118]],
          [[-300,-284],[320,-244],[-260,-112],[360,-22],[-290,242],[250,282],[-92,-306],[142,292],[-280,126],[310,183],[-204,84],[205,-126]],
          [[-300,-284],[290,-292],[-270,-104],[355,-66],[-330,242],[278,288],[-132,-303],[97,300],[-265,146],[315,191],[-176,107],[221,-128]],
          [[-290,-293],[310,-262],[-350,-73],[330,-115],[-275,250],[326,294],[-65,-307],[138,302],[-310,177],[300,187],[-188,88],[180,-137]],
          [[-300,-249],[286,-302],[-305,-119],[340,-43],[-310,275],[300,240],[-95,-302],[76,304],[-305,172],[320,153],[-198,94],[208,-117]],
        ];
        const placements = bossArena
          ? [[-470,-380],[470,-380],[-470,380],[470,380],[-510,-80],[510,90],[-145,-425],[155,425],[-335,-210],[335,210],[-280,250],[280,-250]]
          : placementsByZone[i];
        const placementOverrides: Record<number, [number, number]> = stage.id === 1 && i === 0
          ? { 1: [390,-300], 6: [315,-320] }
          : stage.id === 2 && i === 0
            ? { 1: [390,-300], 6: [-430,80], 11: [-400,260] }
            : {};
        props.forEach((propKind, n) => {
          if (propKind === 'roadcrack') return;
          const [ox, oy] = placementOverrides[n] ?? placements[n];
          const large = ['car','ambulance','tanker','canopy','shopfront','tent','gurney','surgery','generator','workbench'].includes(propKind);
          const width = large ? propKind === 'tanker' ? 240 : propKind === 'canopy' ? 230 : propKind === 'shopfront' ? 210 : propKind === 'ambulance' ? 190 : propKind === 'surgery' ? 190 : propKind === 'tent' ? 190 : 160 + (n % 2) * 18 : ['signfuel','radio','pump','medicalSign','streetlight','trafficcone','mailbox','tire','bollard','examLamp','chair','oxygen','barrel','crate'].includes(propKind) ? (propKind === 'signfuel' ? 132 : propKind === 'radio' ? 118 : propKind === 'pump' ? 86 : propKind === 'medicalSign' ? 82 : 48 + (n % 2) * 12) : 76 + (n % 3) * 13;
          const height = large ? propKind === 'canopy' ? 142 : propKind === 'tanker' ? 104 : propKind === 'tent' || propKind === 'surgery' ? 132 : propKind === 'ambulance' ? 100 : 88 : ['streetlight','trafficcone','mailbox','tire','bollard','examLamp','chair','oxygen','barrel','crate'].includes(propKind) ? 46 : propKind === 'signfuel' ? 102 : propKind === 'radio' ? 112 : propKind === 'pump' ? 94 : propKind === 'medicalSign' ? 104 : 58;
          const solid = ['car','ambulance','tanker','canopy','shopfront','tent','gurney','surgery','generator','workbench','barricade','barrier','fence','tree','crate','cooler','shelf','supplyCrate','divider','cabinet','barrel','roadDebris','roadSign','bollard','tire','shrub','brokenFence','porchsteps'].includes(propKind);
          decorations.push({ ...room(cx + ox, cy + oy, width, height), kind: propKind, solid: solid && !bossArena });
        });
        return;
      }
      const solid = !['drain','signfuel','signal','bone','core','rib','web','nest','quarantine'].includes(kind);
      if (zone.role === 'boss') {
        decorations.push({ ...room(cx + 310, cy - 285, 190, 96), kind, solid: false });
        return;
      }
      if (stage.id === 1 && i === 1) {
        decorations.push({ ...room(cx - 345, cy + 85, 95, 55), kind: 'fence', solid: true });
        return;
      }
      if (stage.id === 1 && i === 2) {
        decorations.push({ ...room(cx + 180, cy + 205, 130, 72), kind: 'fence', solid: true });
        return;
      }
      const large = ['tanker','wagon','container','engine','foodcourt','escalator','bridge','armor','shopfront','store','chamber','culture'].includes(kind);
      const width = large ? 225 + (i % 2) * 36 : 116 + (i % 3) * 21;
      const height = large ? 102 : 68 + (i % 2) * 15;
      // Landmark placement varies by district and zone, while the central
      // combat lane and both sides of each room remain open.
      const stagger = ((stage.id * 31 + i * 47) % 112) - 56;
      decorations.push({ ...room(cx - 192 + stagger, cy - 216 - (i % 2) * 18, width, height), kind, solid });
      decorations.push({ ...room(cx + 191 - stagger * .55, cy + 208 + ((stage.id + i) % 3) * 14, width * .86, height), kind, solid });
    });
    // Dark stone memorials belong to the mall atrium and quarantine plaza;
    // their footprints are solid and stay off the central route.
    if (stage.id === 6 || stage.id === 9) {
      const plaza = centers[stage.id === 6 ? 3 : 2];
      decorations.push({ ...room(plaza.x - 310, plaza.y + 180, 94, 94), kind: 'statue', solid: true });
      decorations.push({ ...room(plaza.x + 310, plaza.y - 180, 94, 94), kind: 'statue', solid: true });
    }
    stage.layout = { bounds: { x: 0, y: 0, w: centers.at(-1)!.x + 740, h: 2500 }, zones, corridors, gates, decorations };
    stage.playerStart = { x: centers[0].x - 180, y: centers[0].y };
    stage.objectiveNodes = chapter.objectiveZones.map((zoneIndex, i) => ({ x: centers[zoneIndex].x + (i % 2 ? 70 : -45), y: centers[zoneIndex].y + (i % 2 ? -60 : 55) }));
    stage.bossSpawn = { x: centers.at(-1)!.x + 140, y: centers.at(-1)!.y };
    stage.exitSpawn = { x: centers.at(-1)!.x + 490, y: centers.at(-1)!.y };
    // The first suburb retains a real enterable house; all other chapters use
    // their own large silhouette props rather than repainted generic warehouses.
    stage.buildings = stage.id === 1 ? [
      { x: centers[0].x + 35, y: centers[0].y - 225, halfWidth: 190, halfHeight: 132, kind: 'warehouse', large: true, rotation: -.045, variant: 'suburb' },
      { x: centers[1].x - 210, y: centers[1].y - 175, halfWidth: 175, halfHeight: 125, kind: 'warehouse', large: true, rotation: -.035, variant: 'suburb' },
      { x: centers[1].x + 180, y: centers[1].y + 155, halfWidth: 165, halfHeight: 112, kind: 'warehouse', large: true, rotation: .025, variant: 'suburb' },
      { x: centers[2].x - 40, y: centers[2].y - 215, halfWidth: 175, halfHeight: 120, kind: 'warehouse', large: true, rotation: -.02, variant: 'suburb' },
    ] : stage.id === 2 ? [
      { x: centers[0].x + 110, y: centers[0].y - 226, halfWidth: 190, halfHeight: 118, kind: 'warehouse', large: true, rotation: -.025, variant: 'fuel' },
      { x: centers[2].x - 280, y: centers[2].y - 220, halfWidth: 190, halfHeight: 132, kind: 'warehouse', large: true, rotation: .025, variant: 'fuel' },
      { x: centers[4].x + 305, y: centers[4].y + 265, halfWidth: 165, halfHeight: 116, kind: 'ruin', large: true, rotation: -.035, variant: 'fuel' },
    ] : stage.id === 3 ? [
      { x: centers[1].x - 285, y: centers[1].y - 215, halfWidth: 188, halfHeight: 132, kind: 'warehouse', large: true, rotation: -.025, variant: 'medical' },
      { x: centers[2].x + 275, y: centers[2].y + 210, halfWidth: 178, halfHeight: 120, kind: 'ruin', large: true, rotation: .03, variant: 'medical' },
    ] : [];
  });
}
