import type { Zombie } from '../entities/zombies';

const PALE = '#aaa395', FLESH = '#593d3d', WOUND = '#843b3e', BONE = '#c3b69b', IRON = '#55595a';

function drawMouth(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number,
  teeth = 8, gape = 1, tone = '#a63238'): void {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#231315'; ctx.strokeStyle = '#170e10'; ctx.lineWidth = Math.max(1.5, rx * .075);
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry * gape, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = tone; ctx.beginPath(); ctx.ellipse(rx * .04, ry * .37 * gape, rx * .56, ry * .24 * gape, .08, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#d07870'; ctx.lineWidth = Math.max(1, rx * .045);
  ctx.beginPath(); ctx.moveTo(-rx * .55, -ry * .22 * gape); ctx.quadraticCurveTo(0, -ry * .64 * gape, rx * .57, -ry * .2 * gape); ctx.stroke();
  for (let i = 0; i < teeth; i++) {
    const t = teeth === 1 ? 0 : i / (teeth - 1) * 2 - 1;
    const tx = t * rx * .79, curve = Math.sqrt(Math.max(.12, 1 - t * t));
    const tw = Math.max(1.5, rx * .065), th = Math.max(2.2, ry * .32 * curve * gape);
    for (const side of [-1, 1]) {
      const ty = side * ry * .55 * curve * gape;
      ctx.fillStyle = i % 4 === 0 ? '#d0b58b' : '#e1d2b4';
      ctx.strokeStyle = '#493437'; ctx.lineWidth = Math.max(.7, rx * .018);
      ctx.beginPath(); ctx.moveTo(tx - tw, ty); ctx.lineTo(tx + tw, ty);
      ctx.lineTo(tx + (i % 2 ? tw * .2 : -tw * .2), ty - side * th); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawLateBossEight(ctx: CanvasRenderingContext2D, z: Zombie, r: number, flash: boolean): void {
  const pulse = 1 + Math.sin(z.animTimer * 3.2) * .035 + (z.specialState === 'windup' ? z.visualWindup * .1 : 0);
  const flesh = flash ? '#d1c3b1' : '#554039', fleshLight = flash ? '#eee0ca' : '#80604e';
  // Torn root fibers trail behind the upright maw and twitch as it breathes.
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 0; i < 7; i++) {
    const side = i % 2 ? 1 : -1, f = i / 6, twitch = Math.sin(z.animTimer * 4 + i * 1.8) * r * .045;
    const sx = -r * (.44 + f * .27), sy = side * r * (.25 + f * .13);
    ctx.strokeStyle = '#21181a'; ctx.lineWidth = r * (.105 - f * .035);
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.bezierCurveTo(sx - r * .35, sy + side * r * .28, sx - r * .52 + twitch, sy + side * r * .62, sx - r * (.37 + f * .18), sy + side * r * (.92 + f * .14)); ctx.stroke();
    ctx.strokeStyle = flash ? '#d5c6b4' : i % 2 ? '#784b43' : '#a04e49'; ctx.lineWidth = r * .035;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.bezierCurveTo(sx - r * .35, sy + side * r * .28, sx - r * .52 + twitch, sy + side * r * .62, sx - r * (.37 + f * .18), sy + side * r * (.92 + f * .14)); ctx.stroke();
    ctx.fillStyle = '#bd8873'; ctx.beginPath(); ctx.arc(sx - r * (.37 + f * .18), sy + side * r * (.92 + f * .14), r * .045, 0, Math.PI * 2); ctx.fill();
  }
  // Piled spinal tissue, ribs and a mask-like upper skull create the vertical silhouette.
  ctx.fillStyle = 'rgba(0,0,0,.24)'; ctx.beginPath(); ctx.ellipse(-r * .08, r * .1, r * 1.03, r * .91, -.12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = flash ? '#cfc1ae' : '#352a2b'; ctx.strokeStyle = '#1b1417'; ctx.lineWidth = r * .065;
  ctx.beginPath(); ctx.moveTo(-r * .88, -r * .42); ctx.quadraticCurveTo(-r * .89, -r * 1.05, -r * .37, -r * .96);
  ctx.quadraticCurveTo(-r * .07, -r * 1.22, r * .15, -r * .76); ctx.quadraticCurveTo(r * .74, -r * .92, r * .78, -r * .38);
  ctx.lineTo(r * 1.04, -r * .12); ctx.quadraticCurveTo(r * 1.17, 0, r * 1.02, r * .18);
  ctx.lineTo(r * .76, r * .44); ctx.quadraticCurveTo(r * .5, r * .85, r * .02, r * .8);
  ctx.quadraticCurveTo(-r * .62, r * .96, -r * .9, r * .43); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Exposed ribs and torn plates frame the main vertical feeding slit.
  for (let i = 0; i < 5; i++) {
    const yy = -r * .56 + i * r * .25;
    ctx.strokeStyle = flash ? '#e4d5c2' : '#a58a70'; ctx.lineWidth = r * .055;
    ctx.beginPath(); ctx.moveTo(-r * .66, yy); ctx.quadraticCurveTo(-r * .36, yy + r * .12, -r * .18, yy + r * .02); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * .64, yy - r * .07); ctx.quadraticCurveTo(r * .37, yy + r * .12, r * .19, yy + r * .04); ctx.stroke();
  }
  // Empty eye sockets above the mouth, with small, wet points deep inside.
  for (const side of [-1, 1]) {
    const ex = -r * .35, ey = side * r * .59;
    ctx.fillStyle = '#1b1215'; ctx.strokeStyle = '#86634f'; ctx.lineWidth = r * .045;
    ctx.beginPath(); ctx.ellipse(ex, ey, r * .22, r * .16, side * -.18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = flash ? '#e9d7c1' : '#a8423f'; ctx.beginPath(); ctx.ellipse(ex + r * .035, ey + side * r * .01, r * .055, r * .037, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1112'; ctx.beginPath(); ctx.arc(ex + r * .05, ey + side * r * .005, r * .02, 0, Math.PI * 2); ctx.fill();
  }
  const gape = pulse * (z.specialState === 'windup' ? 1 + z.visualWindup * .28 : 1);
  drawMouth(ctx, r * .42, 0, r * .48, r * .53, 10, gape, flash ? '#d99b8e' : '#86363b');
  // Tongue root and hanging strings of blood beneath the jaw.
  ctx.fillStyle = flash ? '#d98a80' : '#70272f'; ctx.beginPath(); ctx.moveTo(r * .18, r * .21); ctx.quadraticCurveTo(r * .42, r * .42, r * .72, r * .2); ctx.quadraticCurveTo(r * .56, r * .61, r * .29, r * .48); ctx.closePath(); ctx.fill();
  for (let i = 0; i < 6; i++) {
    const dx = r * (.1 + i * .13), len = r * (.15 + (i % 3) * .1 + Math.sin(z.animTimer * 5 + i) * .025);
    ctx.strokeStyle = i % 2 ? '#522128' : '#a84445'; ctx.lineWidth = Math.max(1.2, r * .022);
    ctx.beginPath(); ctx.moveTo(dx, r * .47); ctx.quadraticCurveTo(dx - r * .025, r * .47 + len * .6, dx + r * .02, r * .47 + len); ctx.stroke();
  }
  // Broken horn-like bone fragments mark the crown.
  ctx.strokeStyle = flash ? '#f0dfc8' : '#c1a98a'; ctx.lineWidth = r * .07; ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(-r * .12, side * r * .62); ctx.lineTo(-r * .28, side * r * .9); ctx.lineTo(-r * .45, side * r * .93); ctx.stroke();
  }
}

function drawLateBossNine(ctx: CanvasRenderingContext2D, z: Zombie, r: number, flash: boolean): void {
  const pulse = 1 + Math.sin(z.animTimer * 2.7) * .045 + (z.specialState === 'windup' ? z.visualWindup * .12 : 0);
  const skin = flash ? '#e0cbb6' : '#704638', limb = flash ? '#d7c1aa' : '#8d5142';
  // Eight jointed feelers give the queen a spider-like silhouette; each flexes independently.
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI + i * Math.PI / 4, wave = Math.sin(z.animTimer * 3.5 + i * 1.3) * r * .09;
    const sx = Math.cos(a) * r * .36, sy = Math.sin(a) * r * .28;
    const kx = Math.cos(a) * r * (.98 + (i % 2) * .15), ky = Math.sin(a) * r * (.82 + (i % 2) * .16) + wave;
    const ex = Math.cos(a) * r * (1.53 + (i % 3) * .09), ey = Math.sin(a) * r * (1.31 + (i % 2) * .12) + wave * 1.3;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#241719'; ctx.lineWidth = r * .16;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + Math.cos(a - .5) * r * .44, sy + Math.sin(a - .5) * r * .42, kx, ky); ctx.quadraticCurveTo(kx + Math.cos(a + .48) * r * .27, ky + Math.sin(a + .48) * r * .28, ex, ey); ctx.stroke();
    ctx.strokeStyle = limb; ctx.lineWidth = r * .105;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + Math.cos(a - .5) * r * .44, sy + Math.sin(a - .5) * r * .42, kx, ky); ctx.quadraticCurveTo(kx + Math.cos(a + .48) * r * .27, ky + Math.sin(a + .48) * r * .28, ex, ey); ctx.stroke();
    ctx.fillStyle = '#392322'; ctx.beginPath(); ctx.arc(kx, ky, r * .13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = flash ? '#f3dfc6' : '#bd765a'; ctx.beginPath(); ctx.arc(kx, ky, r * .067, 0, Math.PI * 2); ctx.fill();
    // Small hooked claws at the tips.
    ctx.strokeStyle = '#d0b393'; ctx.lineWidth = r * .045; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + Math.cos(a + .45) * r * .2, ey + Math.sin(a + .45) * r * .2); ctx.lineTo(ex + Math.cos(a + .85) * r * .27, ey + Math.sin(a + .85) * r * .27); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(-r * .02, r * .18, r * 1.06, r * .83, -.15, 0, Math.PI * 2); ctx.fill();
  // A swollen, asymmetrical body built from fused infected organs.
  ctx.fillStyle = skin; ctx.strokeStyle = '#2a191b'; ctx.lineWidth = r * .065;
  ctx.beginPath(); ctx.moveTo(-r * .82, -r * .1); ctx.quadraticCurveTo(-r * .94, -r * .74, -r * .34, -r * .8);
  ctx.quadraticCurveTo(-r * .09, -r * 1.1, r * .28, -r * .75); ctx.quadraticCurveTo(r * .9, -r * .66, r * .83, -r * .08);
  ctx.quadraticCurveTo(r * 1.02, r * .52, r * .38, r * .72); ctx.quadraticCurveTo(-r * .24, r * 1.05, -r * .73, r * .57); ctx.quadraticCurveTo(-r * 1.02, r * .32, -r * .82, -r * .1); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Tumor sacs and blinking sensory eyes are deliberately irregular, not a repeated grid.
  const sacs: Array<[number, number, number, number, number]> = [
    [-.53,-.38,.24,.20,.2],[-.12,-.57,.27,.20,-.3],[.36,-.43,.24,.22,.3],[-.55,.12,.21,.25,-.5],
    [.05,.36,.31,.25,.1],[.55,.29,.22,.24,-.25],[-.18,.02,.18,.14,.6],[.68,-.02,.13,.15,.1],
  ];
  sacs.forEach(([sx, sy, rx, ry, angle], i) => {
    ctx.fillStyle = i % 3 === 0 ? flash ? '#f1d7bf' : '#a05c47' : flash ? '#d5b39a' : '#8b5142';
    ctx.strokeStyle = '#442827'; ctx.lineWidth = r * .035;
    ctx.beginPath(); ctx.ellipse(sx * r, sy * r, rx * r * pulse, ry * r * pulse, angle, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = flash ? '#f5e0c7' : '#bd7660'; ctx.lineWidth = r * .025;
    ctx.beginPath(); ctx.arc(sx * r, sy * r, rx * r * .7, .1, 2.55); ctx.stroke();
    if (i % 2 === 0) {
      ctx.fillStyle = '#201416'; ctx.beginPath(); ctx.ellipse(sx * r, sy * r, rx * r * .34, ry * r * .23, angle, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = flash ? '#fff0d9' : '#e2a54d'; ctx.beginPath(); ctx.arc(sx * r + rx * r * .05, sy * r, r * .045, 0, Math.PI * 2); ctx.fill();
    }
  });
  // Main split jaw and dark throat sit at the leading edge of the creature.
  ctx.fillStyle = flash ? '#e5c8b5' : '#a85c48'; ctx.strokeStyle = '#341c20'; ctx.lineWidth = r * .05;
  ctx.beginPath(); ctx.moveTo(r * .05, -r * .2); ctx.quadraticCurveTo(r * .55, -r * .67, r * .93, -r * .25);
  ctx.quadraticCurveTo(r * 1.12, r * .13, r * .77, r * .46); ctx.quadraticCurveTo(r * .36, r * .56, r * .05, r * .2); ctx.closePath(); ctx.fill(); ctx.stroke();
  drawMouth(ctx, r * .53, r * .04, r * .37, r * .26, 8, pulse, flash ? '#d99180' : '#962e36');
  // Vascular cords tie the sacs into one breathing mass.
  ctx.strokeStyle = flash ? '#e1a898' : '#492326'; ctx.lineWidth = r * .032; ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 + .18, sx = Math.cos(a) * r * .18, sy = Math.sin(a) * r * .14;
    const ex = Math.cos(a + .22) * r * (.62 + (i % 2) * .12), ey = Math.sin(a + .22) * r * (.53 + (i % 2) * .1);
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.bezierCurveTo(sx + Math.cos(a - .5) * r * .3, sy + Math.sin(a - .5) * r * .3, ex, ey - r * .1, ex, ey); ctx.stroke();
  }
}

function drawLateBossTen(ctx: CanvasRenderingContext2D, z: Zombie, r: number, flash: boolean): void {
  const pulse = 1 + Math.sin(z.animTimer * 2.1) * .035 + (z.specialState === 'windup' ? z.visualWindup * .1 : 0);
  const flesh = flash ? '#d1b7a7' : '#512d32';
  // A broad, living barricade of folded muscle: its silhouette reads as a nest, not a humanoid.
  ctx.fillStyle = 'rgba(0,0,0,.38)'; ctx.beginPath(); ctx.ellipse(0, r * .2, r * 1.78, r * 1.38, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = flash ? '#bda99b' : '#351d23'; ctx.strokeStyle = '#180f14'; ctx.lineWidth = r * .075;
  ctx.beginPath(); ctx.moveTo(-r * 1.45, -r * .45); ctx.quadraticCurveTo(-r * 1.67, -r * 1.13, -r * .88, -r * 1.21);
  ctx.quadraticCurveTo(-r * .24, -r * 1.54, r * .24, -r * 1.22); ctx.quadraticCurveTo(r * 1.31, -r * 1.47, r * 1.52, -r * .65);
  ctx.quadraticCurveTo(r * 1.81, -.02 * r, r * 1.46, r * .62); ctx.quadraticCurveTo(r * .81, r * 1.34, r * .08, r * 1.18);
  ctx.quadraticCurveTo(-r * .77, r * 1.48, -r * 1.51, r * .76); ctx.quadraticCurveTo(-r * 1.78, r * .16, -r * 1.45, -r * .45); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Raised corded ridges and ribs radiate between the mouths.
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const x = -r * 1.3 + i * r * .32, wave = Math.sin(z.animTimer * 2.8 + i) * r * .035;
    ctx.strokeStyle = '#241519'; ctx.lineWidth = r * .105;
    ctx.beginPath(); ctx.moveTo(x, -r * .78); ctx.bezierCurveTo(x + wave, -r * .3, x - wave, r * .32, x + r * .08, r * .91); ctx.stroke();
    ctx.strokeStyle = flash ? '#e0c8b4' : i % 2 ? '#754149' : '#61353e'; ctx.lineWidth = r * .05;
    ctx.beginPath(); ctx.moveTo(x, -r * .78); ctx.bezierCurveTo(x + wave, -r * .3, x - wave, r * .32, x + r * .08, r * .91); ctx.stroke();
  }
  // Nested mouths across the mass open and close at slightly different rhythms.
  const mouths: Array<[number, number, number, number, number]> = [
    [-.99,-.67,.24,.18,.78],[-.43,-.78,.31,.21,1.02],[.32,-.77,.34,.22,.82],[1.0,-.56,.25,.19,.95],
    [-1.13,-.05,.27,.21,1.0],[-.53,-.16,.39,.27,.82],[.38,-.14,.47,.32,1.0],[1.13,.02,.27,.22,.75],
    [-.84,.61,.32,.23,.94],[-.05,.72,.39,.25,.76],[.83,.64,.34,.25,1.0],
  ];
  mouths.forEach(([mx, my, mw, mh, phase], i) => {
    const open = pulse * (.82 + .18 * Math.sin(z.animTimer * (2.2 + i % 3 * .4) + phase * 5));
    drawMouth(ctx, mx * r, my * r, mw * r, mh * r, i === 6 ? 9 : 6, open, flash ? '#d79d91' : i % 3 === 0 ? '#8e3037' : '#70262e');
    if (i % 2 === 0) {
      const eyeX = (mx + (mx > 0 ? -.22 : .22)) * r, eyeY = (my - .25) * r;
      ctx.fillStyle = '#1a1115'; ctx.beginPath(); ctx.ellipse(eyeX, eyeY, r * .105, r * .075, -.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = flash ? '#f0d4be' : '#d45143'; ctx.beginPath(); ctx.arc(eyeX + r * .016, eyeY, r * .034, 0, Math.PI * 2); ctx.fill();
    }
  });
  // A central, pulsing core sits behind a ring of bone-like teeth and torn tissue.
  ctx.fillStyle = flash ? '#dbb29e' : '#6e3035'; ctx.strokeStyle = '#271419'; ctx.lineWidth = r * .06;
  ctx.beginPath(); ctx.ellipse(r * .02, r * .04, r * .34 * pulse, r * .4 * pulse, -.12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#1a1114'; ctx.beginPath(); ctx.ellipse(r * .03, r * .04, r * .19, r * .27, -.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = flash ? '#f0d7bd' : z.campaignPhase >= 2 ? '#ed624b' : '#c43f3a';
  ctx.beginPath(); ctx.ellipse(r * .04, r * .03, r * .09, r * .15, -.1, 0, Math.PI * 2); ctx.fill();
  // Tattered tissue tongues and blood-dark fibers hang from the lower ridge.
  for (let i = 0; i < 11; i++) {
    const dx = -r * 1.3 + i * r * .26, len = r * (.12 + (i % 4) * .075 + Math.sin(z.animTimer * 3 + i) * .02);
    ctx.strokeStyle = i % 2 ? '#5e222c' : '#a13d40'; ctx.lineWidth = r * .028;
    ctx.beginPath(); ctx.moveTo(dx, r * .9); ctx.quadraticCurveTo(dx + r * .03, r * 1.02, dx - r * .02, r * .9 + len); ctx.stroke();
  }
}

function drawLateBossHealth(ctx: CanvasRenderingContext2D, z: Zombie, x: number, y: number, r: number): void {
  const span = z.campaignBossId === 10 ? r * 3.1 : z.campaignBossId === 9 ? r * 2.75 : r * 2.15;
  const top = y + r * (z.campaignBossId === 10 ? 1.48 : z.campaignBossId === 9 ? 1.64 : 1.22) + 10;
  ctx.fillStyle = 'rgba(14,9,12,.94)'; ctx.fillRect(x - span / 2, top, span, Math.max(7, r * .09));
  ctx.fillStyle = '#cf3d3b'; ctx.fillRect(x - span / 2 + 2, top + 2, Math.max(0, span - 4) * Math.max(0, z.hp / z.maxHp), Math.max(3, r * .09 - 4));
  ctx.strokeStyle = '#d4a08c'; ctx.lineWidth = 1.5; ctx.strokeRect(x - span / 2, top, span, Math.max(7, r * .09));
}

/** Campaign boss silhouettes, separate from the Survival renderer and stats. */
export function drawCampaignBoss(ctx: CanvasRenderingContext2D, z: Zombie, x: number, y: number, flash: boolean): void {
  const id = z.campaignBossId;
  if (id === null) return;
  const r = z.size;
  ctx.save(); ctx.translate(x, y); if (id !== 10) ctx.rotate(z.facingAngle);
  ctx.globalAlpha = z.hp > 0 ? 1 : .45;
  ctx.fillStyle = 'rgba(0,0,0,.42)';
  ctx.beginPath();
  if (id === 10) ctx.ellipse(4, 12, r * 1.78, r * 1.38, 0, 0, Math.PI * 2);
  else if (id === 9) ctx.ellipse(4, 10, r * 1.58, r * 1.34, 0, 0, Math.PI * 2);
  else ctx.ellipse(4, 7, r * 1.12, r * .78, 0, 0, Math.PI * 2);
  ctx.fill();
  if (id === 8 || id === 9 || id === 10) {
    if (id === 8) drawLateBossEight(ctx, z, r, flash);
    else if (id === 9) drawLateBossNine(ctx, z, r, flash);
    else drawLateBossTen(ctx, z, r, flash);
    ctx.restore();
    drawLateBossHealth(ctx, z, x, y, r);
    return;
  }
  if (id === 3) {
    // A battered operating gurney trails the butcher during its charge.
    ctx.fillStyle='rgba(0,0,0,.3)';ctx.fillRect(-r*1.5,-r*.47,r*1.62,r*.94);
    ctx.fillStyle='#4d5854';ctx.strokeStyle='#262d2b';ctx.lineWidth=Math.max(3,r*.07);
    ctx.fillRect(-r*1.42,-r*.39,r*1.4,r*.78);ctx.strokeRect(-r*1.42,-r*.39,r*1.4,r*.78);
    ctx.fillStyle='#b7b3a3';ctx.fillRect(-r*1.25,-r*.28,r*1.04,r*.56);ctx.strokeStyle='#444e4b';ctx.strokeRect(-r*1.25,-r*.28,r*1.04,r*.56);
    ctx.fillStyle='#8d514d';ctx.fillRect(-r*.83,-r*.2,r*.16,r*.39);
    ctx.strokeStyle='#aaa28f';ctx.lineWidth=Math.max(2,r*.045);ctx.beginPath();ctx.moveTo(-r*1.4,-r*.47);ctx.lineTo(r*.16,-r*.47);ctx.moveTo(-r*1.4,r*.47);ctx.lineTo(r*.16,r*.47);ctx.stroke();
    ctx.fillStyle='#292e2c';for(const wx of [-r*1.2,-r*.22])for(const wy of [-r*.49,r*.49]){ctx.beginPath();ctx.arc(wx,wy,r*.095,0,Math.PI*2);ctx.fill();}
  }
  if (id === 2) {
    // The Họng Bơm's ruptured hoses drag from its distended abdomen.
    ctx.strokeStyle = '#443a35'; ctx.lineWidth = Math.max(6,r*.105); ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      ctx.beginPath(); ctx.moveTo(r*.18,side*r*.32);
      ctx.bezierCurveTo(r*.82,side*r*.48,r*1.05,side*r*.9,r*1.22,side*r*.72);
      ctx.stroke();
      ctx.strokeStyle = '#89654d'; ctx.lineWidth = Math.max(2,r*.035); ctx.stroke();
      ctx.strokeStyle = '#443a35'; ctx.lineWidth = Math.max(6,r*.105);
    }
  }
  ctx.strokeStyle = id === 9 ? '#736253' : IRON; ctx.lineWidth = Math.max(4, r * .16); ctx.lineCap = 'round';
  // Asymmetric limbs establish each silhouette at the real gameplay scale.
  if (id === 9) {
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI * .88 + i * Math.PI * .22;
      const sx = Math.cos(a) * r * .28, sy = Math.sin(a) * r * .28;
      const kx = Math.cos(a) * r * .88, ky = Math.sin(a) * r * .82;
      const ex = Math.cos(a) * r * (1.22 + (i % 2) * .13), ey = Math.sin(a) * r * (1.12 + ((i + 1) % 2) * .16);
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(kx, ky); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = '#ad9b82'; ctx.beginPath(); ctx.arc(kx, ky, r*.055, 0, Math.PI*2); ctx.fill();
    }
  } else if(id===1||id===2||id===3){
    ctx.strokeStyle=id===1?'#555c52':id===2?'#493e37':'#606a65';ctx.lineWidth=Math.max(4,r*.13);ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(-r*.22,-r*.26);ctx.lineTo(-r*.72,-r*.38);ctx.lineTo(-r*.93,-r*.1);ctx.stroke();
    ctx.beginPath();ctx.moveTo(-r*.2,r*.24);ctx.lineTo(-r*.7,r*.47);ctx.lineTo(-r*.8,r*.83);ctx.stroke();
    ctx.beginPath();ctx.moveTo(r*.08,-r*.28);ctx.lineTo(r*.53,-r*.42);ctx.stroke();
    ctx.beginPath();ctx.moveTo(r*.1,r*.23);ctx.lineTo(r*.52,r*.43);ctx.lineTo(r*.66,r*.78);ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(-r * .22, -r * .35); ctx.lineTo(-r * .72, -r * .72); ctx.lineTo(-r * .92, -r * .3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * .18, r * .28); ctx.lineTo(-r * .68, r * .48); ctx.lineTo(-r * .84, r * .92); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * .08, -r * .25); ctx.lineTo(r * .65, -r * .42); ctx.lineTo(r * .8, -r * .1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * .1, r * .2); ctx.lineTo(r * .55, r * .5); ctx.lineTo(r * .72, r * .8); ctx.stroke();
  }

  const base = flash ? '#e8dbcd' : id === 7 ? '#4b4c51' : id === 2 || id === 10 ? '#554345' : PALE;
  ctx.fillStyle = base; ctx.strokeStyle = '#261f20'; ctx.lineWidth = Math.max(2, r * .07);
  ctx.beginPath();
  if (id === 9) { ctx.ellipse(0, 0, r * .78, r * .55, -.12, 0, Math.PI * 2); }
  else if (id === 10) { ctx.moveTo(-r*.8,-r*.35); ctx.quadraticCurveTo(-r*.8,-r*.78,-r*.35,-r*.7); ctx.quadraticCurveTo(-r*.1,-r*1.02,r*.12,-r*.55); ctx.quadraticCurveTo(r*.72,-r*.67,r*.68,-r*.12); ctx.quadraticCurveTo(r*.93,r*.24,r*.48,r*.45); ctx.quadraticCurveTo(r*.22,r*.88,-r*.12,r*.55); ctx.quadraticCurveTo(-r*.62,r*.78,-r*.8,r*.28); ctx.closePath(); }
  else if (id === 2) { const swell=z.campaignAttackKind==='fan'&&z.specialState==='windup'?1+z.visualWindup*.16:1;ctx.ellipse(-r*.12,0,r*.82*swell,r*.68*swell,-.16,0,Math.PI*2); }
  else { ctx.ellipse(-r*.06, 0, r*.7, r*.53, id === 5 ? -.38 : .12, 0, Math.PI*2); }
  ctx.fill(); ctx.stroke();

  if(id===1){
    // Militia jacket, radio harness and battered whistle silhouette.
    ctx.fillStyle=flash?'#dfd6c7':'#59604f';ctx.beginPath();ctx.moveTo(-r*.28,-r*.42);ctx.lineTo(r*.2,-r*.48);ctx.lineTo(r*.37,r*.33);ctx.lineTo(-r*.12,r*.47);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#2b302b';ctx.lineWidth=r*.055;ctx.beginPath();ctx.moveTo(-r*.13,-r*.38);ctx.lineTo(r*.11,r*.36);ctx.moveTo(-r*.23,r*.03);ctx.lineTo(r*.28,-r*.08);ctx.stroke();
    ctx.fillStyle='#c39c58';ctx.beginPath();ctx.arc(-r*.09,-r*.25,r*.07,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#716143';ctx.lineWidth=r*.045;ctx.beginPath();ctx.moveTo(r*.25,-r*.5);ctx.lineTo(r*.42,-r*.73);ctx.lineTo(r*.62,-r*.72);ctx.stroke();
  }else if(id===2){
    // Pale swollen sacs with stressed seams. Their swell is tied to the visible windup.
    const pulse=z.campaignAttackKind==='fan'&&z.specialState==='windup'?1+z.visualWindup*.18:1;
    ctx.fillStyle=flash?'#e3d5bd':'#835c50';ctx.strokeStyle='#493738';ctx.lineWidth=Math.max(2,r*.035);
    for(const [sx,sy,rx,ry] of [[-.42,-.3,.24,.19],[.05,-.39,.27,.2],[.48,-.18,.22,.19],[-.24,.34,.27,.18],[.35,.34,.24,.2]] as number[][]){
      ctx.beginPath();ctx.ellipse(sx*r,sy*r,rx*r*pulse,ry*r*pulse,.2,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.strokeStyle='#bf8b73';ctx.lineWidth=Math.max(1.5,r*.022);ctx.beginPath();ctx.arc(sx*r,sy*r,rx*r*.65,.3,2.35);ctx.stroke();ctx.strokeStyle='#493738';ctx.lineWidth=Math.max(2,r*.035);
    }
    ctx.fillStyle='#262923';ctx.beginPath();ctx.ellipse(r*.66,-r*.06,r*.18,r*.12,-.12,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#b1c570';ctx.beginPath();ctx.ellipse(r*.79,-r*.06,r*.09,r*.052,0,0,Math.PI*2);ctx.fill();
  }else if(id===3){
    // Blood-dark surgical apron and the medic's torn mask.
    ctx.fillStyle=flash?'#ddd8ca':'#697470';ctx.beginPath();ctx.moveTo(-r*.22,-r*.38);ctx.lineTo(r*.23,-r*.4);ctx.lineTo(r*.43,r*.42);ctx.lineTo(-r*.12,r*.48);ctx.closePath();ctx.fill();
    ctx.fillStyle='#753f3d';ctx.beginPath();ctx.moveTo(-r*.1,-r*.1);ctx.lineTo(r*.18,-r*.17);ctx.lineTo(r*.29,r*.34);ctx.lineTo(r*.01,r*.4);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#353d3a';ctx.lineWidth=r*.05;ctx.beginPath();ctx.moveTo(-r*.18,-r*.39);ctx.lineTo(r*.27,r*.34);ctx.stroke();
  }

  // Telegraphs drive a distinct, physical arm pose; active attacks complete the swing/thrust.
  if(id===1||id===2||id===3){
    const p=Math.max(0,Math.min(1,z.campaignAttackProgress));
    const active=z.specialState==='active',wind=z.specialState==='windup';
    let armAngle=-.28,reach=1.02;
    if(z.campaignAttackKind==='sweep')armAngle=wind?-.95*z.visualWindup:active?-1.22+2.44*p:-.28;
    else if(z.campaignAttackKind==='thrust')armAngle=wind?-.92*z.visualWindup:active?-1.04+1.04*p:-.12;
    else if(z.campaignAttackKind==='charge') {armAngle=active?.08:-.62*z.visualWindup;reach=1.3;}
    else if(z.campaignAttackKind==='fan')armAngle=wind?-1.05*z.visualWindup:active?-.7+.95*p:-.16;
    else if(z.campaignAttackKind==='slam'||z.campaignAttackKind==='stomp')armAngle=wind?-1.15*z.visualWindup:active?-.8+1.35*p:-.24;
    const shoulderX=r*.22,shoulderY=-r*.22,upper=r*.42,fore=r*.48*reach;
    const elbowX=shoulderX+Math.cos(armAngle)*upper,elbowY=shoulderY+Math.sin(armAngle)*upper;
    const wristX=elbowX+Math.cos(armAngle+.18)*fore,wristY=elbowY+Math.sin(armAngle+.18)*fore;
    ctx.strokeStyle=id===3?'#555e5a':id===2?'#644944':'#50584e';ctx.lineWidth=Math.max(5,r*.145);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(shoulderX,shoulderY);ctx.lineTo(elbowX,elbowY);ctx.lineTo(wristX,wristY);ctx.stroke();
    ctx.fillStyle=id===3?'#867b69':'#796856';ctx.beginPath();ctx.arc(wristX,wristY,r*.105,0,Math.PI*2);ctx.fill();
    if(id===1){
      const a=armAngle+.05;ctx.save();ctx.translate(wristX,wristY);ctx.rotate(a);ctx.strokeStyle='#353a39';ctx.lineWidth=r*.13;ctx.beginPath();ctx.moveTo(-r*.06,0);ctx.lineTo(r*.65,0);ctx.stroke();ctx.strokeStyle='#b3a27f';ctx.lineWidth=r*.045;ctx.beginPath();ctx.moveTo(r*.28,-r*.07);ctx.lineTo(r*.28,r*.07);ctx.stroke();ctx.restore();
    }else if(id===3){
      const a=armAngle+.18;ctx.save();ctx.translate(wristX,wristY);ctx.rotate(a);ctx.fillStyle='#a7aaa0';ctx.beginPath();ctx.moveTo(0,-r*.075);ctx.lineTo(r*.55,0);ctx.lineTo(0,r*.075);ctx.closePath();ctx.fill();ctx.strokeStyle='#e0d5bd';ctx.lineWidth=2;ctx.stroke();ctx.restore();
    }
  }

  if (id === 10 && z.campaignPhase >= 2) {
    ctx.strokeStyle = '#c36659'; ctx.lineWidth = r*.045;
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + .2;
      ctx.beginPath(); ctx.moveTo(Math.cos(a)*r*.16,Math.sin(a)*r*.13); ctx.lineTo(Math.cos(a+.12)*r*.34,Math.sin(a+.12)*r*.3); ctx.lineTo(Math.cos(a-.08)*r*.57,Math.sin(a-.08)*r*.46); ctx.stroke();
    }
  } else if (z.campaignPhase >= 2) {
    // Phase two visibly strains each boss's tissue so its faster spell cadence
    // has a clear, persistent visual cue even between attack telegraphs.
    const pulse = .68 + .22 * Math.sin(z.animTimer * 8);
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = id === 2 || id === 8 ? '#bd765e' : id === 7 ? '#c4a46c' : '#b65b50';
    ctx.lineWidth = Math.max(2, r * .038);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI * .5 + .32;
      const sx = Math.cos(a) * r * .1, sy = Math.sin(a) * r * .1;
      const mx = Math.cos(a + .14) * r * .34, my = Math.sin(a + .14) * r * .28;
      const ex = Math.cos(a - .1) * r * .61, ey = Math.sin(a - .1) * r * .46;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(mx, my); ctx.lineTo(ex, ey); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Distinct deformity: three-neck choir, multi-rat knot, knight plates, exposed core.
  if (id === 4) {
    // Six distinct rat bodies, joined by uneven tails around the central knot.
    const rats: Array<[number, number, number]> = [
      [-.50,-.34,-2.7],[-.08,-.48,-1.8],[.38,-.31,-.65],[-.44,.28,2.7],[.02,.43,1.9],[.43,.25,.45],
    ];
    ctx.strokeStyle = '#473638'; ctx.lineWidth = Math.max(2,r*.045);
    rats.forEach(([rx,ry,a],i) => {
      const hx=rx*r, hy=ry*r, s=r*(i%3===0?.31:.27);
      ctx.beginPath(); ctx.moveTo(hx-s*.55,hy+s*.08);
      ctx.bezierCurveTo(hx-Math.cos(a)*s,hy-Math.sin(a)*s,hx-Math.cos(a+.7)*r*.75,hy-Math.sin(a+.7)*r*.75,Math.cos(i*2.3)*r*.18,Math.sin(i*2.3)*r*.16);
      ctx.stroke();
    });
    rats.forEach(([rx,ry,a],i) => {
      const hx=rx*r, hy=ry*r, s=r*(i%3===0?.31:.27);
      ctx.save(); ctx.translate(hx,hy); ctx.rotate(a);
      ctx.fillStyle = i%2 ? '#796255' : '#8b7663'; ctx.strokeStyle='#382f30'; ctx.lineWidth=Math.max(1.5,r*.025);
      ctx.beginPath(); ctx.ellipse(-s*.18,0,s*.56,s*.39,-.12,0,Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = i%2 ? '#927b68' : '#a18a72';
      ctx.beginPath(); ctx.ellipse(s*.28,-s*.02,s*.39,s*.31,.08,0,Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#765c5a'; ctx.beginPath(); ctx.arc(s*.12,-s*.26,s*.17,0,Math.PI*2); ctx.arc(s*.43,-s*.26,s*.15,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#1d1919'; ctx.beginPath(); ctx.ellipse(s*.44,-s*.08,s*.055,s*.045,0,0,Math.PI*2); ctx.ellipse(s*.44,s*.06,s*.055,s*.045,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#aa7770'; ctx.beginPath(); ctx.ellipse(s*.64,s*.02,s*.14,s*.1,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#cfb99c'; ctx.lineWidth=Math.max(1,r*.018);
      ctx.beginPath(); ctx.moveTo(s*.57,0); ctx.lineTo(s*.9,-s*.15); ctx.moveTo(s*.57,s*.04); ctx.lineTo(s*.92,s*.16); ctx.stroke();
      ctx.restore();
    });
    ctx.strokeStyle = WOUND; ctx.lineWidth = r*.045; ctx.beginPath(); ctx.arc(0,0,r*.48,-2.6,2.4); ctx.stroke();
  } else if (id === 6 || id === 8) {
    const heads = id === 6 ? [-.55, -.08, .42] : [-.28, .34];
    for (let i = 0; i < heads.length; i++) {
      const hx = heads[i] * r; const hy = -r * (.6 + (i % 2) * .18);
      ctx.strokeStyle = FLESH; ctx.lineWidth = r*.15; ctx.beginPath(); ctx.moveTo(hx*.55,-r*.26); ctx.lineTo(hx,hy); ctx.stroke();
      ctx.fillStyle = id === 8 && i === 0 ? '#8e6a58' : PALE; ctx.beginPath(); ctx.ellipse(hx,hy,r*.23,r*.27,-.3,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#181717'; ctx.fillRect(hx-r*.12,hy-r*.03,r*.24,r*.055);
    }
    if (id === 8) {
      ctx.strokeStyle = '#6c857e'; ctx.lineWidth = r*.06;
      ctx.beginPath(); ctx.moveTo(-r*.42,-r*.2); ctx.bezierCurveTo(-r*.8,-r*.05,-r*.65,r*.45,-r*.25,r*.5); ctx.stroke();
      ctx.fillStyle = WOUND; ctx.beginPath(); ctx.ellipse(r*.12,r*.18,r*.24,r*.2,.2,0,Math.PI*2); ctx.fill();
    }
  } else if (id === 7) {
    ctx.fillStyle = '#414348'; ctx.fillRect(-r*.28,-r*.42,r*.55,r*.84);
    ctx.strokeStyle = '#999181'; ctx.lineWidth = r*.08; ctx.beginPath(); ctx.moveTo(-r*.52,-r*.32); ctx.lineTo(r*.3,r*.32); ctx.stroke();
    ctx.fillStyle = '#a3a091'; ctx.fillRect(r*.25,-r*.62,r*.52,r*.12);
  } else if (id === 5) {
    ctx.fillStyle = flash ? '#e8dbcd' : '#78575a'; ctx.strokeStyle = '#261f20'; ctx.lineWidth = r*.08;
    ctx.beginPath(); ctx.ellipse(r*.62,r*.32,r*.48,r*.64,-.38,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = BONE; ctx.lineWidth = r*.1; ctx.beginPath(); ctx.moveTo(r*.73,-r*.03); ctx.lineTo(r*.9,r*.39); ctx.lineTo(r*.68,r*.68); ctx.stroke();
  } else if (id === 1) {
    ctx.fillStyle = '#45484a'; ctx.beginPath(); ctx.ellipse(r*.38,-r*.39,r*.34,r*.27,-.12,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#221e1d'; ctx.beginPath(); ctx.ellipse(r*.48,-r*.35,r*.18,r*.1,.08,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#b79c69'; ctx.lineWidth = r*.07; ctx.beginPath(); ctx.moveTo(-r*.12,-r*.42); ctx.lineTo(-r*.17,-r*.78); ctx.lineTo(-r*.02,-r*.87); ctx.stroke();
    ctx.fillStyle = '#c9ad71'; ctx.beginPath(); ctx.arc(-r*.02,-r*.87,r*.09,0,Math.PI*2); ctx.fill();
  } else if (id === 3) {
    ctx.strokeStyle = '#a8a18f'; ctx.lineWidth = r*.09; ctx.beginPath(); ctx.moveTo(r*.25,-r*.26); ctx.lineTo(r*.98,-r*.54); ctx.lineTo(r*1.15,-r*.48); ctx.stroke();
    ctx.fillStyle = WOUND; ctx.beginPath(); ctx.ellipse(-r*.35,r*.08,r*.25,r*.16,-.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#2a2322'; ctx.beginPath(); ctx.ellipse(r*.38,-r*.38,r*.21,r*.11,0,0,Math.PI*2); ctx.fill();
  } else if (id === 2) {
    // Inflated infected sacs and a ruptured pump coupling identify this boss.
    ctx.fillStyle = '#75494a'; ctx.strokeStyle = '#382d2d'; ctx.lineWidth = Math.max(2,r*.035);
    for (const [sx,sy,rx,ry] of [[-.48,-.28,.24,.2],[.02,-.43,.28,.2],[.51,-.18,.22,.2],[-.28,.34,.27,.19],[.34,.35,.24,.2]] as number[][]) {
      ctx.beginPath(); ctx.ellipse(sx*r,sy*r,rx*r,ry*r,.2,0,Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle='#a66a63'; ctx.lineWidth=Math.max(1.5,r*.022); ctx.beginPath(); ctx.arc(sx*r,sy*r,rx*r*.62,.2,2.6); ctx.stroke();
      ctx.strokeStyle='#382d2d'; ctx.lineWidth=Math.max(2,r*.035);
    }
    ctx.fillStyle='#302b2b'; ctx.fillRect(r*.68,-r*.15,r*.3,r*.2);
    ctx.strokeStyle='#bd8b58'; ctx.lineWidth=Math.max(2,r*.045); ctx.strokeRect(r*.68,-r*.15,r*.3,r*.2);
    ctx.fillStyle='#d0a360'; ctx.beginPath(); ctx.ellipse(r*.87,-r*.05,r*.07,r*.045,0,0,Math.PI*2); ctx.fill();
  } else if (id === 10 || id === 8) {
    ctx.fillStyle = id === 10 ? '#b84345' : WOUND; ctx.beginPath(); ctx.ellipse(r*.12,0,r*.28,r*.3,.2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#e5a69a'; ctx.beginPath(); ctx.arc(r*.12,0,r*.09,0,Math.PI*2); ctx.fill();
  } else {
    ctx.fillStyle = id === 2 ? '#805d45' : id === 5 ? '#78575a' : PALE;
    ctx.beginPath(); ctx.ellipse(r*.42,-r*.38,r*.3,r*.24,.35,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#201a1a'; ctx.fillRect(r*.5,-r*.42,r*.15,r*.055);
  }
  // Open wounds and bone slivers break the clean cartoon-like body outline.
  ctx.strokeStyle = WOUND; ctx.lineWidth = Math.max(2, r*.075); ctx.beginPath(); ctx.moveTo(-r*.3,-r*.1); ctx.lineTo(-r*.08,r*.16); ctx.lineTo(r*.02,r*.06); ctx.stroke();
  ctx.strokeStyle = BONE; ctx.lineWidth = Math.max(2, r*.055); ctx.beginPath(); ctx.moveTo(-r*.57,r*.16); ctx.lineTo(-r*.4,r*.32); ctx.lineTo(-r*.19,r*.22); ctx.stroke();
  ctx.fillStyle = '#e4bdb0'; ctx.beginPath(); ctx.arc(r*.56,-r*.38,Math.max(2,r*.055),0,Math.PI*2); ctx.fill();
  ctx.restore();

  // Campaign-only boss health bar.
  ctx.fillStyle = 'rgba(12,13,15,.9)'; ctx.fillRect(x-r, y+r+12, r*2, 5);
  ctx.fillStyle = id === 10 ? '#b74b46' : '#a94a43'; ctx.fillRect(x-r, y+r+12, r*2*Math.max(0,z.hp/z.maxHp), 5);
}
