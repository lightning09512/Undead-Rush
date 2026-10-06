interface CharacterRender {
  image: HTMLImageElement;
}

const characterRenderCache = new Map<string, CharacterRender>();
// Normalized trim boxes for the transparent 640 x 960 character renders.
const CHARACTER_ART_CROP: Record<string, { x: number; y: number; w: number; h: number }> = {
  survivor: { x: .227, y: 0, w: .555, h: 1 },
  soldier: { x: .200, y: .006, w: .671, h: .994 },
  scout: { x: .253, y: 0, w: .562, h: 1 },
  medic: { x: .240, y: 0, w: .586, h: 1 },
  engineer: { x: .218, y: 0, w: .590, h: 1 },
  berserker: { x: .141, y: .006, w: .766, h: .994 },
};

function characterArtPath(id: string): string {
  return `/assets/characters/${id}.webp`;
}

function loadCharacterRender(id: string): CharacterRender {
  const cached = characterRenderCache.get(id);
  if (cached) return cached;

  const render: CharacterRender = { image: new Image() };
  characterRenderCache.set(id, render);
  render.image.src = characterArtPath(id);
  return render;
}

/** Detailed 3D-style character renders for the Campaign preparation screen. */
export function drawHunterPortrait(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, id: string, accent: string): void {
  const render = loadCharacterRender(id);
  if (render.image.complete && render.image.naturalWidth > 0) {
    const crop = CHARACTER_ART_CROP[id] ?? { x: 0, y: 0, w: 1, h: 1 };
    const source = {
      x: render.image.naturalWidth * crop.x,
      y: render.image.naturalHeight * crop.y,
      w: render.image.naturalWidth * crop.w,
      h: render.image.naturalHeight * crop.h,
    };
    const targetHeight = h * .98;
    const aspect = source.w / source.h;
    // A slight horizontal emphasis helps detailed full-body renders read at the
    // compact scale of this 2D game's character selection card.
    const targetWidth = Math.min(w * .88, targetHeight * aspect * 1.18);
    const targetY = y + (h - targetHeight) / 2;
    const targetX = x + (w - targetWidth) / 2;

    ctx.save();
    ctx.globalAlpha = .25;
    ctx.fillStyle = '#050808';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h - 5, Math.min(w * .32, targetWidth * .76), 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(render.image, source.x, source.y, source.w, source.h,
      targetX, targetY, targetWidth, targetHeight);
    ctx.restore();
    return;
  }

  drawHunterPortraitFallback(ctx, x, y, w, h, id, accent);
}

/** Lightweight local fallback while a character render is loading or unavailable. */
function drawHunterPortraitFallback(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, id: string, accent: string): void {
  ctx.save();
  ctx.translate(x + w / 2, y + h * .1);
  ctx.scale(Math.min(w / 116, h / 195), Math.min(w / 116, h / 195));
  ctx.fillStyle = '#111819'; ctx.beginPath(); ctx.ellipse(2, 170, 48, 9, 0, 0, Math.PI * 2); ctx.fill();
  const coat = id === 'medic' ? '#a6afa6' : id === 'scout' ? '#746d55' : id === 'berserker' ? '#5a3839' : id === 'soldier' ? '#596954' : id === 'engineer' ? '#70695a' : '#50636b';
  const skin = id === 'scout' ? '#c79e7d' : id === 'medic' ? '#d7b597' : '#b89376';
  // Boots and uneven utility trousers.
  ctx.fillStyle = '#252b2c'; ctx.fillRect(-29, 150, 24, 19); ctx.fillRect(8, 150, 25, 19);
  ctx.fillStyle = '#3a4240'; ctx.beginPath(); ctx.moveTo(-31,90); ctx.lineTo(26,90); ctx.lineTo(31,151); ctx.lineTo(7,151); ctx.lineTo(1,112); ctx.lineTo(-6,151); ctx.lineTo(-29,151); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1b2528'; ctx.fillRect(-31, 97, 60, 7);
  // Arms frame a front-facing torso. One hand rests on a carried weapon.
  ctx.fillStyle = skin; ctx.fillRect(-48, 83, 12, 28); ctx.fillRect(36, 83, 12, 28);
  ctx.fillStyle = coat; ctx.beginPath(); ctx.moveTo(-38,38); ctx.lineTo(33,38); ctx.lineTo(43,96); ctx.lineTo(19,111); ctx.lineTo(-30,106); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#263233'; ctx.fillRect(-35, 84, 69, 10);
  ctx.fillStyle = accent; ctx.fillRect(-29, 54, 9, 27);
  if (id === 'medic') { ctx.fillStyle = '#e4ded2'; ctx.fillRect(10,53,17,19); ctx.fillStyle = '#a7504e'; ctx.fillRect(17,55,4,15); ctx.fillRect(12,60,14,4); }
  if (id === 'engineer') { ctx.fillStyle = '#c8a96f'; ctx.fillRect(-27,77,19,10); ctx.fillRect(16,80,14,8); }
  if (id === 'soldier') { ctx.fillStyle = '#232c27'; ctx.fillRect(-15,46,30,30); ctx.strokeStyle = '#96a285'; ctx.strokeRect(-15,46,30,30); }
  if (id === 'berserker') { ctx.strokeStyle = '#9b5d54'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-35,48); ctx.lineTo(-17,80); ctx.moveTo(30,47); ctx.lineTo(16,80); ctx.stroke(); }
  if (id === 'scout') { ctx.fillStyle = '#c3a568'; ctx.fillRect(-11,46,22,5); ctx.fillRect(-17,76,31,4); }
  // Visible face, eyes and mouth below headgear.
  ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(0,22,18,23,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#232726'; ctx.fillRect(-13,17,8,3); ctx.fillRect(5,17,8,3);
  ctx.fillStyle = '#e7dfc5'; ctx.fillRect(-9,20,5,2); ctx.fillRect(5,20,5,2);
  ctx.strokeStyle = '#72584a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-5,34); ctx.quadraticCurveTo(1,37,7,33); ctx.stroke();
  ctx.fillStyle = id === 'medic' ? '#d1d1c2' : id === 'scout' ? '#665f4e' : '#303b3b';
  ctx.beginPath(); ctx.moveTo(-20,15); ctx.lineTo(-16,-2); ctx.quadraticCurveTo(0,-14,17,-2); ctx.lineTo(21,14); ctx.lineTo(11,9); ctx.lineTo(-13,9); ctx.closePath(); ctx.fill();
  if (id === 'scout') { ctx.strokeStyle = '#c2aa78'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-20,14);ctx.lineTo(20,14);ctx.stroke(); }
  // Compact rifle/sidearm carried at chest height.
  ctx.fillStyle = '#222d31'; ctx.fillRect(-33,102,69,8); ctx.fillRect(15,96,24,5); ctx.fillRect(-14,109,14,18);
  ctx.fillStyle = '#8f958c'; ctx.fillRect(-20,99,24,3); ctx.fillRect(23,104,19,2);
  ctx.restore();
}

export type GunArtView = 'side' | 'muzzle' | 'stock';

const GUN_ART_SIZE = 510;
const gunArtCache = new Map<string, HTMLCanvasElement>();

function gunPalette(id: string) {
  const energy = id === 'rail_lance';
  const polymer = id === 'smg9' || id === 'flamer8' || id === 'rpg4' || id === 'bulldog';
  return {
    metal: energy ? '#435457' : '#384443',
    lightMetal: energy ? '#778b88' : '#697770',
    darkMetal: '#20292a',
    edge: energy ? '#a1d8d7' : '#99a49b',
    wood: id === 'ar7' || id === 'dmr55' || id === 'sg12' ? '#85583d' : polymer ? '#303a37' : '#665442',
    woodLight: id === 'ar7' || id === 'dmr55' || id === 'sg12' ? '#bd8960' : '#64716a',
  };
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  r: number, fill: string, stroke = '#1a2122', line = 1.2): void {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill; ctx.fill();
  if (line > 0) { ctx.strokeStyle = stroke; ctx.lineWidth = line; ctx.stroke(); }
}

function polygon(ctx: CanvasRenderingContext2D, points: Array<[number, number]>, fill: string,
  stroke = '#1a2122', line = 1.2): void {
  ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  if (line > 0) { ctx.strokeStyle = stroke; ctx.lineWidth = line; ctx.stroke(); }
}

function detailLine(ctx: CanvasRenderingContext2D, points: Array<[number, number]>, color: string, width = 1): void {
  ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
}

function screw(ctx: CanvasRenderingContext2D, x: number, y: number, colors: ReturnType<typeof gunPalette>): void {
  ctx.fillStyle = colors.darkMetal; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
  detailLine(ctx, [[x - 1, y], [x + 1, y]], colors.edge, .6);
}

function renderGunSide(ctx: CanvasRenderingContext2D, id: string): void {
  const c = gunPalette(id);
  const pistol = id === 'p9';
  const shotgun = id === 'sg12' || id === 'bulldog';
  const smg = id === 'smg9';
  const dmr = id === 'dmr55';
  const lmg = id === 'lmg6';
  const flamer = id === 'flamer8';
  const rpg = id === 'rpg4';
  const rail = id === 'rail_lance';
  const bullpup = id === 'bulldog';

  // A soft, baked shadow keeps the silhouette readable over either dark or light UI.
  ctx.fillStyle = 'rgba(0,0,0,.34)'; ctx.beginPath(); ctx.ellipse(88, 43, pistol ? 55 : 76, 5, 0, 0, Math.PI * 2); ctx.fill();

  if (pistol) {
    polygon(ctx, [[51,20],[61,15],[120,16],[132,20],[145,22],[147,29],[125,31],[62,30],[53,27]], c.metal);
    polygon(ctx, [[57,17],[68,13],[118,14],[128,18],[127,20],[58,20]], c.lightMetal, '#273031', .8);
    rounded(ctx, 75, 29, 21, 25, 4, '#303b39');
    detailLine(ctx, [[77,34],[94,32],[91,50],[79,52]], '#5b655e', 1.2);
    rounded(ctx, 79, 39, 12, 11, 3, c.wood, '#2d302c', .8);
    rounded(ctx, 127, 21, 30, 5, 2, c.darkMetal);
    rounded(ctx, 150, 22, 9, 4, 1, '#151b1c');
    rounded(ctx, 66, 21, 19, 2, 1, c.edge, c.edge, 0);
    detailLine(ctx, [[99,31],[103,37],[115,37],[119,31]], '#151c1d', 1.4);
    rounded(ctx, 106, 23, 13, 5, 1, '#283132', '#1a2021', .8);
    detailLine(ctx, [[108,24],[116,24]], c.edge, .8);
    screw(ctx, 68, 26, c); screw(ctx, 121, 25, c);
    polygon(ctx, [[96,29],[102,30],[101,37],[97,39]], '#252e2d', '#141a1b', .8);
    return;
  }

  if (rpg) {
    rounded(ctx, 17, 20, 139, 15, 7, '#48524c', '#171e1f', 2);
    rounded(ctx, 21, 22, 126, 4, 2, '#778176', '#778176', 0);
    rounded(ctx, 14, 18, 10, 19, 4, '#262e2d');
    polygon(ctx, [[151,19],[166,24],[166,31],[151,36]], '#927b58', '#252a27', 1.5);
    rounded(ctx, 26, 15, 26, 5, 2, c.darkMetal); rounded(ctx, 27, 13, 19, 3, 1, c.lightMetal);
    rounded(ctx, 42, 33, 12, 13, 3, c.wood); rounded(ctx, 115, 33, 17, 10, 3, '#343d39');
    detailLine(ctx, [[50,39],[63,39],[66,45]], '#9da394', 1.5);
    rounded(ctx, 72, 18, 32, 2, 1, '#141a1b');
    for (let i=0;i<5;i++) detailLine(ctx, [[78+i*5,18],[78+i*5,20]], c.edge, .7);
    screw(ctx, 57, 27, c); screw(ctx, 137, 27, c);
    return;
  }

  // Stock and butt pad; the wood/polymer treatment is specific to each platform.
  if (!bullpup) {
    const stockEnd = dmr ? 47 : lmg ? 53 : smg ? 49 : 53;
    polygon(ctx, [[12,22],[21,19],[stockEnd,20],[61,24],[61,34],[stockEnd,38],[20,39],[12,35]], c.wood, '#1d2423', 1.8);
    polygon(ctx, [[12,22],[20,21],[20,37],[12,35]], '#282f2d', '#141a1b', 1.2);
    detailLine(ctx, [[23,23],[stockEnd-5,22],[57,25]], c.woodLight, 1.5);
    if (dmr || lmg) {
      detailLine(ctx, [[21,29],[stockEnd-2,29],[54,31]], '#343b37', 1.4);
      detailLine(ctx, [[22,34],[stockEnd-5,35]], c.woodLight, 1);
    }
  } else {
    polygon(ctx, [[14,21],[34,19],[58,21],[63,25],[61,35],[53,38],[18,37],[12,33]], '#303a37', '#18201f', 1.7);
    detailLine(ctx, [[17,23],[48,22],[58,25]], '#849087', 1.1);
  }

  // Magazine or feed box is drawn behind the receiver to preserve its outline.
  if (lmg) {
    rounded(ctx, 75, 32, 32, 19, 4, '#64533d', '#1c2424', 1.8);
    detailLine(ctx, [[81,36],[101,36],[101,45],[81,45],[81,36]], '#a4895d', 1.2);
    for (let i=0;i<4;i++) detailLine(ctx, [[83,38+i*2],[99,38+i*2]], '#3a3931', .8);
  } else if (bullpup) {
    polygon(ctx, [[83,30],[101,31],[111,54],[103,57],[89,39]], '#393d36', '#171f20', 1.6);
    detailLine(ctx, [[91,36],[105,51]], '#8d7652', 1.2);
  } else if (!rpg) {
    const magX = shotgun ? 83 : dmr ? 81 : 77;
    const magW = shotgun ? 12 : 15;
    polygon(ctx, [[magX,32],[magX+magW,32],[magX+magW+7,54],[magX+3,56]], shotgun ? '#6e5038' : '#303936', '#171f20', 1.5);
    detailLine(ctx, [[magX+3,36],[magX+magW-1,36],[magX+magW+4,50]], shotgun ? '#b3845e' : '#69756d', 1);
    if (dmr) detailLine(ctx, [[magX+3,41],[magX+magW+1,49]], '#9aa196', .8);
  }

  // Receiver shell with bevels and a dark lower rail.
  const receiverX = bullpup ? 31 : 51;
  const receiverW = bullpup ? 84 : dmr ? 78 : 73;
  polygon(ctx, [[receiverX+5,19],[receiverX+14,15],[receiverX+receiverW-8,16],
    [receiverX+receiverW,21],[receiverX+receiverW-2,33],[receiverX+receiverW-13,37],
    [receiverX+2,35],[receiverX,27]], c.metal, '#151c1d', 2);
  polygon(ctx, [[receiverX+12,17],[receiverX+receiverW-10,17],[receiverX+receiverW-4,21],
    [receiverX+17,21]], c.lightMetal, '#303a39', .8);
  rounded(ctx, receiverX+19, 22, receiverW-34, 8, 2, '#252f30', '#151b1c', 1);
  detailLine(ctx, [[receiverX+22,24],[receiverX+receiverW-19,24]], '#879188', .8);
  rounded(ctx, receiverX+25, 26, 16, 4, 1, '#394343', '#1b2425', .7);
  detailLine(ctx, [[receiverX+27,27],[receiverX+38,27]], c.edge, .8);
  detailLine(ctx, [[receiverX+4,36],[receiverX+receiverW-9,36]], '#121819', 2);
  // Trigger, guard, safety and bolt details.
  detailLine(ctx, [[receiverX+36,34],[receiverX+39,42],[receiverX+54,42],[receiverX+58,35]], '#111718', 1.7);
  detailLine(ctx, [[receiverX+45,34],[receiverX+47,39]], c.lightMetal, 1.1);
  detailLine(ctx, [[receiverX+8,30],[receiverX+2,32],[receiverX+8,34]], '#bd9560', 1.2);
  screw(ctx, receiverX+13, 27, c); screw(ctx, receiverX+receiverW-13, 29, c);

  if (bullpup) {
    // Bullpup receiver sits farther back; the short fore-end carries the barrel.
    rounded(ctx, 107, 21, 29, 13, 3, '#444e49', '#1a2222', 1.4);
    for (let i=0;i<5;i++) detailLine(ctx, [[111+i*4,23],[111+i*4,31]], '#222b2b', 1);
    rounded(ctx, 135, 24, 26, 5, 2, c.darkMetal);
  } else if (rail) {
    rounded(ctx, 114, 20, 37, 13, 3, '#33484a', '#131c1d', 1.5);
    for (let i=0;i<5;i++) {
      rounded(ctx, 117+i*6, 22, 3, 9, 1, i%2 ? '#71cad1' : '#526b6c', '#1b292a', .6);
    }
    rounded(ctx, 145, 24, 19, 5, 2, '#88cbd0', '#263a3a', 1);
    ctx.fillStyle='rgba(111,224,231,.3)';ctx.fillRect(119,24,27,2);
  } else {
    // Fore-end with vents, upper rail and barrel profile.
    const handguardX = receiverX + receiverW - 5;
    const handguardW = dmr ? 29 : smg ? 24 : 33;
    rounded(ctx, handguardX, 20, handguardW, 13, 3, flamer ? '#555d51' : c.metal, '#182020', 1.5);
    detailLine(ctx, [[handguardX+3,21],[handguardX+handguardW-4,21]], c.lightMetal, 1);
    for (let i=0;i<4;i++) rounded(ctx, handguardX+4+i*6, 25, 3, 5, 1, '#222c2c', '#59635b', .5);
    rounded(ctx, handguardX+handguardW-2, 24, dmr ? 31 : 35, 5, 2, '#303938', '#161d1e', 1);
    detailLine(ctx, [[handguardX+handguardW+3,25],[160,25]], '#7e8981', .9);
    rounded(ctx, 157, 23, 10, 7, 2, '#252d2c', '#14191a', 1.2);
    detailLine(ctx, [[160,24],[160,29]], '#a4aaa0', .7);
  }

  // Different sight packages make the silhouettes recognizable at a glance.
  if (dmr) {
    rounded(ctx, 78, 10, 34, 8, 3, '#202829', '#101718', 1.5);
    rounded(ctx, 84, 8, 21, 3, 1, '#78857e', '#202829', .8);
    ctx.fillStyle='#99ad9d';ctx.beginPath();ctx.ellipse(108,14,3,4,0,0,Math.PI*2);ctx.fill();
    detailLine(ctx, [[81,18],[111,18]], '#1c2323', 1.3);
  } else if (lmg) {
    rounded(ctx, 76, 11, 30, 5, 2, '#303a38', '#151c1d', 1.2);
    for (let i=0;i<5;i++) detailLine(ctx, [[80+i*5,11],[80+i*5,15]], '#899187', .8);
    rounded(ctx, 89, 7, 5, 4, 1, '#202727');
    detailLine(ctx, [[141,32],[145,48],[151,48]], '#323c3b', 2.2);
    detailLine(ctx, [[147,32],[151,46]], '#7d8980', 1.2);
  } else if (rail) {
    rounded(ctx, 76, 12, 35, 7, 3, '#243234', '#101718', 1);
    detailLine(ctx, [[80,15],[108,15]], '#76dfe5', 2);
  } else {
    rounded(ctx, 76, 13, 23, 4, 2, '#222a2a', '#111718', 1);
    for (let i=0;i<4;i++) detailLine(ctx, [[80+i*5,13],[80+i*5,16]], '#7a857d', .7);
    rounded(ctx, 61, 15, 28, 2, 1, '#1b2324', '#111718', .6);
  }

  if (shotgun) {
    // Separate magazine tube and pump furniture read clearly from the side.
    rounded(ctx, 77, 34, 61, 4, 2, '#293231', '#111819', 1.1);
    rounded(ctx, 86, 33, 32, 7, 2, c.wood, '#252522', 1);
    detailLine(ctx, [[89,35],[114,35]], c.woodLight, 1);
    rounded(ctx, 121, 35, 21, 2, 1, '#818980', '#252d2c', .6);
  } else if (smg) {
    polygon(ctx, [[17,22],[20,18],[45,18],[56,22],[51,26],[25,25]], '#48534e', '#172020', 1.3);
    detailLine(ctx, [[22,20],[43,20]], '#9ba398', 1);
    polygon(ctx, [[56,31],[68,32],[65,49],[59,47]], '#39413c', '#1a2221', 1.2);
  } else if (flamer) {
    rounded(ctx, 44, 33, 25, 13, 6, '#985c3d', '#281d19', 1.5);
    rounded(ctx, 48, 35, 17, 8, 4, '#c37b4e', '#4d3024', 1);
    detailLine(ctx, [[51,37],[62,37]], '#edb477', 1);
    rounded(ctx, 123, 33, 27, 7, 3, '#35403c', '#131a1b', 1.2);
    rounded(ctx, 148, 31, 18, 10, 4, '#252b27', '#111718', 1.2);
    polygon(ctx, [[162,33],[170,35],[162,39]], '#bd7045', '#30221c', 1);
  }

  if (!bullpup && !rpg) {
    // Distinct grip shapes, front strap and small stamped hardware.
    polygon(ctx, [[receiverX+28,35],[receiverX+39,36],[receiverX+37,50],[receiverX+31,53],[receiverX+27,49]], '#343d39', '#161e1f', 1.4);
    detailLine(ctx, [[receiverX+31,39],[receiverX+35,48]], '#829087', .8);
  }
  if (rail) {
    ctx.strokeStyle='#6de2e5';ctx.lineWidth=1;ctx.globalAlpha=.8;
    for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(129+i*5,27,7+i*2,-.75,.75);ctx.stroke();}
    ctx.globalAlpha=1;
  }
}

function renderGunAxial(ctx: CanvasRenderingContext2D, id: string, fromStock: boolean): void {
  const c = gunPalette(id);
  const pistol = id === 'p9';
  const shotgun = id === 'sg12' || id === 'bulldog';
  const energy = id === 'rail_lance';
  const centerX = 85;
  if (!fromStock) {
    // View down the barrel: concentric muzzle, front sight ears and handguard.
    ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.ellipse(centerX,53,26,4,0,0,Math.PI*2);ctx.fill();
    rounded(ctx, centerX-22, 19, 44, 31, 8, c.metal, '#151c1d', 2);
    rounded(ctx, centerX-17, 10, 34, 18, 8, '#404b47', '#171f20', 1.6);
    ctx.fillStyle='#222b2b';ctx.beginPath();ctx.ellipse(centerX,13,11,8,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=energy?'#77dce2':'#68726b';ctx.beginPath();ctx.ellipse(centerX,12,7.3,5.3,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#111819';ctx.beginPath();ctx.ellipse(centerX,12,4.5,3,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=energy?'#89f0f0':'#090e0f';ctx.beginPath();ctx.ellipse(centerX,12,2.2,1.5,0,0,Math.PI*2);ctx.fill();
    if (!pistol && !id.startsWith('rpg')) {
      polygon(ctx, [[centerX-27,16],[centerX-23,4],[centerX-15,8],[centerX-16,22]], '#313a39', '#151c1d', 1.4);
      polygon(ctx, [[centerX+27,16],[centerX+23,4],[centerX+15,8],[centerX+16,22]], '#313a39', '#151c1d', 1.4);
      detailLine(ctx, [[centerX-23,7],[centerX-18,12]], c.edge, 1);
      detailLine(ctx, [[centerX+23,7],[centerX+18,12]], c.edge, 1);
    }
    // Receiver narrows toward the grip; magazine/pump details vary by weapon.
    polygon(ctx, [[centerX-17,27],[centerX+17,27],[centerX+21,42],[centerX+13,52],[centerX-13,52],[centerX-21,42]], c.lightMetal, '#172020', 1.8);
    rounded(ctx, centerX-10, 31, 20, 8, 3, c.darkMetal, '#1a2223', 1);
    detailLine(ctx, [[centerX-7,34],[centerX+7,34]], c.edge, .8);
    if (shotgun) {
      ctx.fillStyle='#252d2c';ctx.beginPath();ctx.ellipse(centerX,22,5,3,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#866349';ctx.fillRect(centerX-3,37,6,14);
    } else if (id === 'rpg4') {
      rounded(ctx, centerX-16, 5, 32, 17, 8, '#4c554e', '#1c2322', 1.6);
      ctx.fillStyle='#171e1f';ctx.beginPath();ctx.ellipse(centerX,10,7,4,0,0,Math.PI*2);ctx.fill();
    } else {
      polygon(ctx, [[centerX-7,43],[centerX+7,43],[centerX+12,59],[centerX-12,59]], '#303a37', '#172020', 1.2);
      if (id === 'lmg6') { rounded(ctx, centerX-19, 39, 9, 14, 3, '#69553d'); rounded(ctx, centerX+10,39,9,14,3,'#69553d'); }
      if (energy) { detailLine(ctx, [[centerX-12,29],[centerX+12,29]], '#79e2e4', 2); }
    }
    for (let i=0;i<3;i++) detailLine(ctx, [[centerX-18,25+i*4],[centerX-14,25+i*4]], '#9aa39a', .8);
    return;
  }

  // Rear stock end: butt plate in the foreground, receiver and bore receding away.
  ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.ellipse(centerX,53,28,4,0,0,Math.PI*2);ctx.fill();
  rounded(ctx, centerX-28, 38, 56, 17, 5, '#242c2b', '#101718', 2);
  rounded(ctx, centerX-22, 41, 44, 10, 3, pistol || id === 'rpg4' ? c.darkMetal : c.wood, '#1b2222', 1.2);
  detailLine(ctx, [[centerX-18,43],[centerX+18,43]], c.woodLight, 1.4);
  polygon(ctx, [[centerX-19,39],[centerX-14,26],[centerX-9,19],[centerX+9,19],[centerX+14,26],[centerX+19,39]], c.metal, '#131b1c', 1.7);
  rounded(ctx, centerX-10, 21, 20, 16, 5, '#46514c', '#171f20', 1.2);
  ctx.fillStyle='#1d2525';ctx.beginPath();ctx.ellipse(centerX,18,8,5,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=energy?'#76dce1':'#111718';ctx.beginPath();ctx.ellipse(centerX,18,4.5,2.8,0,0,Math.PI*2);ctx.fill();
  if (!pistol) {
    polygon(ctx, [[centerX-24,27],[centerX-18,22],[centerX-13,30],[centerX-17,37]], c.darkMetal, '#141b1b', 1);
    polygon(ctx, [[centerX+24,27],[centerX+18,22],[centerX+13,30],[centerX+17,37]], c.darkMetal, '#141b1b', 1);
  }
  if (shotgun) rounded(ctx, centerX-5, 31, 10, 8, 3, '#866349');
}

function createGunArt(id: string, view: GunArtView): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = GUN_ART_SIZE; canvas.height = GUN_ART_SIZE * 60 / 170;
  const art = canvas.getContext('2d')!;
  art.scale(GUN_ART_SIZE / 170, GUN_ART_SIZE / 170);
  art.lineCap = 'round'; art.lineJoin = 'round';
  if (view === 'side') renderGunSide(art, id);
  else renderGunAxial(art, id, view === 'stock');
  return canvas;
}

/** Cached high-resolution, original vector gun illustrations shared by the armory, HUD and pickups. */
export function drawGunArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  id: string, view: GunArtView = 'side'): void {
  const key = `${id}:${view}`;
  let art = gunArtCache.get(key);
  if (!art) { art = createGunArt(id, view); gunArtCache.set(key, art); }
  const ratio = art.width / art.height;
  const drawW = Math.min(w, h * ratio), drawH = drawW / ratio;
  ctx.save(); ctx.imageSmoothingEnabled = true;
  ctx.drawImage(art, x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH);
  ctx.restore();
}
