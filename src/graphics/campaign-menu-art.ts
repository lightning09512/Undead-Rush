interface HunterArtPalette { cloth: string; armor: string; shadow: string; light: string; trim: string; skin: string; }

function hunterArtPalette(id: string, accent: string): HunterArtPalette {
  const palettes: Record<string, Omit<HunterArtPalette, 'trim'>> = {
    survivor: { cloth: '#566a70', armor: '#303d41', shadow: '#1a2629', light: '#859a99', skin: '#b78e70' },
    soldier: { cloth: '#53624b', armor: '#303c32', shadow: '#1c261f', light: '#829076', skin: '#b89172' },
    scout: { cloth: '#766a4e', armor: '#393a31', shadow: '#22251f', light: '#b5a071', skin: '#c29a7a' },
    medic: { cloth: '#84928a', armor: '#3d4c49', shadow: '#202c2b', light: '#bac9bf', skin: '#c79d81' },
    engineer: { cloth: '#776a52', armor: '#393a34', shadow: '#22241f', light: '#b9a16f', skin: '#bd9274' },
    berserker: { cloth: '#704347', armor: '#38272b', shadow: '#21191d', light: '#aa6660', skin: '#b48772' },
  };
  return { ...(palettes[id] ?? palettes.survivor), trim: id === 'medic' ? '#b64e4b' : accent };
}

function heroLimb(ctx: CanvasRenderingContext2D, points: Array<[number, number]>, width: number, color: string, highlight: string): void {
  detailLine(ctx, points, '#151a1b', width + 5);
  detailLine(ctx, points, color, width);
  detailLine(ctx, points.map(([x, y]): [number, number] => [x - 1.2, y - 1.4]), highlight, Math.max(1, width * .16));
}

/** Hand-drawn Canvas portrait art, sharing the armory's inked metal-and-fabric style. */
export function drawHunterPortrait(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, id: string, accent: string): void {
  const palette = hunterArtPalette(id, accent);
  const scale = Math.min(w / 170, h / 244);
  if (!(scale > 0)) return;

  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.scale(scale, scale);
  ctx.translate(-80, -122);

  // Ground shadow and layered boots/utility trousers.
  ctx.fillStyle = 'rgba(0,0,0,.36)'; ctx.beginPath(); ctx.ellipse(81, 235, 39, 7, 0, 0, Math.PI * 2); ctx.fill();
  polygon(ctx, [[53,179],[78,181],[76,219],[71,229],[47,229],[45,220]], '#303734', '#171c1c', 2);
  polygon(ctx, [[82,181],[106,178],[113,218],[108,229],[83,229],[79,219]], '#373d39', '#171c1c', 2);
  rounded(ctx, 44, 218, 31, 15, 4, '#252b2b', '#111718', 2);
  rounded(ctx, 80, 218, 34, 15, 4, '#252b2b', '#111718', 2);
  detailLine(ctx, [[48,224],[70,224],[72,228]], '#7f8980', 1.2);
  detailLine(ctx, [[84,224],[108,224],[110,228]], '#7f8980', 1.2);
  rounded(ctx, 56, 188, 18, 14, 3, palette.armor, '#1a2020', 1.2);
  rounded(ctx, 84, 188, 18, 14, 3, palette.armor, '#1a2020', 1.2);
  detailLine(ctx, [[61,191],[69,197],[64,201]], palette.light, 1);
  detailLine(ctx, [[90,191],[98,197],[93,201]], palette.light, 1);
  detailLine(ctx, [[78,184],[79,214]], '#171d1e', 2.1);

  // Backpack, radio aerial and shoulder straps sit behind the torso.
  rounded(ctx, 34, 88, 22, 73, 7, palette.shadow, '#121819', 2);
  rounded(ctx, 37, 94, 16, 24, 4, palette.armor, '#101516', 1.1);
  detailLine(ctx, [[41,99],[49,99],[49,112],[41,112],[41,99]], palette.light, 1);
  rounded(ctx, 39, 127, 13, 17, 3, palette.cloth, '#171d1d', 1);
  detailLine(ctx, [[49,91],[51,69],[54,64]], '#9ca79a', 1.3);

  // Arms and gloves frame the weapon, with the same clean outlines as the gun art.
  heroLimb(ctx, [[51,99],[43,117],[57,139]], 13, palette.cloth, palette.light);
  heroLimb(ctx, [[108,98],[119,113],[113,139]], 14, palette.armor, palette.light);

  // Layered jacket and plate carrier.
  polygon(ctx, [[57,82],[70,76],[94,77],[108,86],[113,124],[105,165],[91,177],[62,171],[48,150],[49,111]], palette.cloth, '#171d1e', 2.4);
  polygon(ctx, [[62,86],[76,81],[93,82],[105,90],[108,119],[101,144],[90,155],[64,149],[56,130],[55,104]], palette.armor, '#151a1b', 2);
  polygon(ctx, [[64,87],[78,83],[92,85],[87,120],[70,122]], palette.light, '#242d2e', 1.1);
  polygon(ctx, [[91,84],[103,91],[104,119],[91,120],[87,97]], palette.shadow, '#141a1b', 1.1);
  detailLine(ctx, [[61,94],[69,104],[70,144]], '#a3a28b', 1.2);
  detailLine(ctx, [[100,94],[94,105],[94,144]], '#a3a28b', 1.2);
  rounded(ctx, 61, 126, 16, 17, 3, '#273131', '#111718', 1.4);
  rounded(ctx, 82, 128, 17, 16, 3, '#283131', '#111718', 1.4);
  detailLine(ctx, [[65,131],[73,131],[73,138],[65,138],[65,131]], palette.light, .9);
  detailLine(ctx, [[86,132],[95,132]], palette.light, .9);
  screw(ctx, 64, 91, { darkMetal: '#202727', edge: palette.light } as ReturnType<typeof gunPalette>);
  screw(ctx, 101, 93, { darkMetal: '#202727', edge: palette.light } as ReturnType<typeof gunPalette>);

  // Class insignia and equipment distinguish the existing six character classes.
  if (id === 'medic') {
    rounded(ctx, 96, 105, 12, 18, 2, '#d7ddd3', '#242c2b', 1);
    ctx.fillStyle = '#ad4a48'; ctx.fillRect(100, 108, 4, 12); ctx.fillRect(97, 112, 10, 4);
    rounded(ctx, 42, 112, 8, 17, 2, '#d5ddd2', '#28302e', .8);
    ctx.fillStyle = '#af4c49'; ctx.fillRect(44, 116, 4, 3); ctx.fillRect(45, 114, 2, 8);
  } else if (id === 'engineer') {
    rounded(ctx, 49, 146, 15, 12, 2, '#c49f5c', '#29261f', 1.2);
    detailLine(ctx, [[52,149],[61,149],[61,155],[52,155],[52,149]], '#e0c37e', .9);
    rounded(ctx, 92, 148, 17, 10, 3, '#333b39', '#141a1a', 1.1);
    detailLine(ctx, [[96,151],[105,151]], '#c8a45e', 1.2);
  } else if (id === 'soldier') {
    rounded(ctx, 68, 99, 23, 25, 3, '#28332d', '#111716', 1.4);
    detailLine(ctx, [[72,103],[86,103],[86,119],[72,119],[72,103]], '#96a182', 1.2);
    detailLine(ctx, [[78,108],[80,114]], palette.trim, 1.4);
  } else if (id === 'scout') {
    detailLine(ctx, [[59,91],[68,103],[91,141]], '#bca46e', 2.2);
    detailLine(ctx, [[95,91],[89,104],[68,140]], '#bca46e', 1.2);
    rounded(ctx, 87, 113, 12, 7, 2, '#b69b61', '#24231d', .8);
  } else if (id === 'berserker') {
    detailLine(ctx, [[56,101],[70,116],[99,145]], '#a64c49', 3);
    detailLine(ctx, [[104,99],[96,113],[69,147]], '#a64c49', 2.2);
    rounded(ctx, 51, 124, 10, 19, 3, '#473137', '#1b191b', 1);
  } else {
    rounded(ctx, 97, 105, 10, 16, 2, palette.shadow, '#111718', 1);
    detailLine(ctx, [[100,108],[104,108],[104,118]], palette.trim, 1.2);
  }

  // Collar, neck and face, built as beveled shapes rather than a raster portrait.
  polygon(ctx, [[68,75],[75,69],[88,69],[97,78],[92,91],[72,91]], '#343c3c', '#131819', 1.6);
  const faceGrad = ctx.createLinearGradient(68, 42, 93, 69);
  faceGrad.addColorStop(0, '#d0aa86'); faceGrad.addColorStop(1, '#88644e');
  ctx.fillStyle = faceGrad; ctx.strokeStyle = '#1b1b1a'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(67,46); ctx.lineTo(73,35); ctx.lineTo(91,36); ctx.lineTo(97,48);
  ctx.lineTo(93,67); ctx.lineTo(83,75); ctx.lineTo(72,69); ctx.closePath(); ctx.fill(); ctx.stroke();
  detailLine(ctx, [[72,54],[79,54]], '#1d2524', 2.5);
  detailLine(ctx, [[86,54],[93,53]], '#1d2524', 2.5);
  ctx.fillStyle = '#d8d0bd'; ctx.fillRect(74, 53, 3, 1.1); ctx.fillRect(87, 52, 3, 1.1);
  detailLine(ctx, [[78,65],[82,67],[87,65]], '#664f43', 1.4);

  // Distinct headgear: each silhouette and material remain hand-drawn and readable.
  if (id === 'scout') {
    polygon(ctx, [[63,47],[66,31],[77,25],[91,27],[99,37],[98,45],[88,41],[71,42]], '#675e48', '#171b1b', 2);
    polygon(ctx, [[72,39],[103,39],[108,44],[91,46],[72,44]], '#88734c', '#201e19', 1.4);
    rounded(ctx, 74, 36, 17, 5, 2, '#292e2e', '#121819', 1);
    detailLine(ctx, [[77,38],[87,38]], '#b5aa82', 1);
  } else if (id === 'medic') {
    polygon(ctx, [[63,49],[66,33],[75,25],[91,26],[99,35],[100,46],[93,44],[72,44]], '#bac6bd', '#171d1d', 2);
    rounded(ctx, 74, 30, 18, 12, 3, '#e0e3d9', '#7a8980', 1);
    ctx.fillStyle = '#b94d4a'; ctx.fillRect(81, 32, 4, 9); ctx.fillRect(78, 35, 10, 3);
    polygon(ctx, [[66,43],[99,43],[104,47],[67,48]], '#899890', '#252d2b', 1);
  } else if (id === 'engineer') {
    polygon(ctx, [[61,45],[64,35],[74,28],[91,29],[99,37],[99,45]], '#8f7444', '#191b18', 2);
    rounded(ctx, 68, 29, 28, 12, 4, '#b49a60', '#28271f', 1.5);
    detailLine(ctx, [[72,32],[91,32]], '#dcc784', 1.2);
    rounded(ctx, 74, 36, 17, 6, 2, '#283131', '#151a1a', 1);
    detailLine(ctx, [[78,39],[87,39]], '#8ed2d0', 1.2);
  } else if (id === 'berserker') {
    polygon(ctx, [[62,48],[65,33],[75,25],[91,27],[100,37],[98,48],[90,42],[72,43]], '#3a292d', '#171719', 2);
    polygon(ctx, [[63,41],[98,41],[103,47],[68,49]], '#8f4648', '#231b1d', 1.7);
    detailLine(ctx, [[68,42],[95,42]], '#d37a68', 1.5);
    rounded(ctx, 73, 34, 21, 7, 3, '#211e21', '#161718', 1);
    detailLine(ctx, [[76,37],[91,37]], '#be6659', 1.1);
  } else {
    polygon(ctx, [[62,47],[65,32],[76,24],[92,27],[100,38],[98,47],[89,42],[71,43]], id === 'soldier' ? '#4b5c46' : '#3b4646', '#141a1a', 2);
    polygon(ctx, [[62,43],[100,43],[104,48],[63,48]], id === 'soldier' ? '#7b8965' : '#626f70', '#202626', 1.5);
    rounded(ctx, 71, 34, 24, 8, 3, '#252d30', '#111718', 1.3);
    detailLine(ctx, [[75,36],[91,36]], id === 'soldier' ? '#b3bf91' : '#8de5e8', 1.6);
  }

  // Forearm support and hands hold the same crisp illustrated rifle used in the armory.
  heroLimb(ctx, [[46,117],[59,126],[69,137]], 7, palette.cloth, palette.light);
  heroLimb(ctx, [[117,115],[121,128],[112,137]], 7, palette.armor, palette.light);
  drawGunArt(ctx, 27, 119, 111, 40, id === 'medic' ? 'smg9' : id === 'scout' ? 'dmr55' : 'ar7');
  rounded(ctx, 64, 130, 11, 8, 3, '#262c2a', '#111616', 1.3);
  rounded(ctx, 108, 130, 11, 8, 3, '#262c2a', '#111616', 1.3);
  detailLine(ctx, [[67,133],[72,133]], '#a98c6c', 1);
  detailLine(ctx, [[111,133],[116,133]], '#a98c6c', 1);

  // Clear edge highlights and small rivets finish the illustration like the weapon sprites.
  detailLine(ctx, [[53,105],[57,91],[67,84]], 'rgba(205,218,198,.7)', 1.2);
  detailLine(ctx, [[105,91],[111,101],[109,115]], 'rgba(205,218,198,.55)', 1.1);
  screw(ctx, 56, 105, { darkMetal: '#202727', edge: palette.light } as ReturnType<typeof gunPalette>);
  screw(ctx, 105, 106, { darkMetal: '#202727', edge: palette.light } as ReturnType<typeof gunPalette>);
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
