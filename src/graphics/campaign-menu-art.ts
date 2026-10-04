/** Original vector illustrations for the Campaign preparation screen. */
export function drawHunterPortrait(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, id: string, accent: string): void {
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

export function drawGunArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, id: string): void {
  ctx.save(); ctx.translate(x,y); ctx.scale(w/170,h/60);
  ctx.fillStyle='#101718'; ctx.fillRect(10,36,149,5);
  ctx.fillStyle='#65716c';
  if (id === 'p9') {
    ctx.fillRect(58,20,63,12); ctx.fillRect(116,23,22,4); ctx.fillStyle='#3a4646'; ctx.fillRect(78,30,14,24); ctx.fillStyle='#866d4f'; ctx.fillRect(74,39,19,5);
  } else if (id === 'sg12' || id === 'bulldog') {
    ctx.fillRect(30,22,108,10); ctx.fillRect(55,17,68,4); ctx.fillRect(130,23,28,5);
    ctx.fillStyle='#866a4c'; ctx.fillRect(17,22,35,11); ctx.fillRect(48,33,53,6); ctx.fillRect(94,27,18,17);
    if(id==='bulldog'){ctx.fillStyle='#bd9560';ctx.fillRect(46,15,71,3);ctx.fillRect(105,31,20,8);}
  } else if (id === 'smg9') {
    ctx.fillRect(25,20,103,15); ctx.fillRect(125,23,30,5); ctx.fillStyle='#3a4443'; ctx.fillRect(63,13,39,6);
    ctx.fillStyle='#7c6850'; ctx.fillRect(10,25,24,8); ctx.fillRect(77,34,12,21); ctx.fillRect(44,34,11,12);
  } else if (id === 'dmr55' || id === 'rail_lance') {
    ctx.fillRect(24,21,id==='rail_lance'?128:118,9); ctx.fillRect(143,23,23,4);
    ctx.fillStyle='#3a4443'; ctx.fillRect(70,14,id==='rail_lance'?53:36,7); ctx.fillRect(74,30,12,20); ctx.fillRect(33,30,30,5);
    ctx.fillStyle=id==='rail_lance'?'#75d5df':'#aab3a4'; ctx.fillRect(109,18,22,2);
  } else if (id === 'lmg6') {
    ctx.fillRect(30,18,108,16); ctx.fillRect(134,23,30,5); ctx.fillStyle='#3b4645'; ctx.fillRect(65,12,34,6); ctx.fillStyle='#80694e'; ctx.fillRect(73,34,25,17); ctx.fillRect(23,23,20,10);
  } else if (id === 'flamer8') {
    ctx.fillRect(27,20,110,13); ctx.fillRect(130,23,34,5); ctx.fillStyle='#3b4645'; ctx.fillRect(56,13,40,8); ctx.fillStyle='#a16545'; ctx.beginPath(); ctx.ellipse(47,27,13,17,0,0,Math.PI*2); ctx.fill(); ctx.fillRect(80,33,14,17);
  } else if (id === 'rpg4') {
    ctx.fillStyle='#596660'; ctx.fillRect(20,20,133,12); ctx.beginPath();ctx.moveTo(153,20);ctx.lineTo(169,26);ctx.lineTo(153,32);ctx.closePath();ctx.fill();
    ctx.fillStyle='#886846'; ctx.fillRect(25,14,23,4); ctx.fillRect(55,32,13,15); ctx.fillRect(113,32,15,12);ctx.fillStyle='#a6a18b';ctx.fillRect(132,22,18,8);
  } else {
    ctx.fillRect(29,20,106,12); ctx.fillRect(132,23,30,4); ctx.fillStyle='#414c4b'; ctx.fillRect(67,15,34,5);
    ctx.fillStyle='#866d4f'; ctx.fillRect(10,23,29,9); ctx.fillRect(82,31,13,22); ctx.fillRect(49,31,12,13);
    ctx.fillStyle='#a7ada1'; ctx.fillRect(109,17,5,3);
  }
  ctx.restore();
}
