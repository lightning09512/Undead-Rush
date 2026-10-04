import type { GunDef } from '../systems/gun-loadout';

export type HeldGunShape = { muzzle: number; grip: number; support: number; casing: 'small' | 'rifle' | 'shell' | 'heavy' | 'none' };

/** World-scale silhouettes share the live GunDef id with the inventory and firing code. */
export function heldGunShape(def: GunDef): HeldGunShape {
  switch (def.id) {
    case 'p9': return { muzzle: 24, grip: 13, support: 19, casing: 'small' };
    case 'smg9': return { muzzle: 31, grip: 13, support: 23, casing: 'small' };
    case 'sg12': return { muzzle: 38, grip: 13, support: 27, casing: 'shell' };
    case 'bulldog': return { muzzle: 35, grip: 13, support: 26, casing: 'shell' };
    case 'dmr55': return { muzzle: 43, grip: 13, support: 29, casing: 'rifle' };
    case 'lmg6': return { muzzle: 39, grip: 13, support: 29, casing: 'heavy' };
    case 'flamer8': return { muzzle: 37, grip: 13, support: 27, casing: 'none' };
    case 'rpg4': return { muzzle: 41, grip: 12, support: 30, casing: 'none' };
    case 'rail_lance': return { muzzle: 45, grip: 13, support: 31, casing: 'none' };
    default: return { muzzle: 35, grip: 13, support: 25, casing: 'rifle' };
  }
}

export function drawHeldGun(ctx: CanvasRenderingContext2D, def: GunDef, reloadProgress: number): void {
  const s = heldGunShape(def);
  const id = def.id;
  const shotgun = id === 'sg12' || id === 'bulldog';
  const pistol = id === 'p9';
  const heavy = id === 'lmg6' || id === 'rpg4' || id === 'rail_lance';
  const metal = id === 'rail_lance' ? '#596e70' : id === 'flamer8' ? '#555b50' : '#485553';
  ctx.fillStyle = '#171d1e';
  ctx.fillRect(pistol ? 6 : 4, -3.8, s.muzzle - (pistol ? 8 : 5), 7.6);
  ctx.fillStyle = metal;
  ctx.fillRect(11, -2.7, s.muzzle - 14, 5.4);
  ctx.fillStyle = '#111719';
  ctx.fillRect(s.muzzle - 3, -1.9, 5, 3.8);
  ctx.fillStyle = '#87918a';
  ctx.fillRect(15, -3.1, Math.max(5, s.muzzle - 20), 1);

  if (pistol) {
    ctx.fillStyle = '#353e3d';ctx.fillRect(11, 3.2, 5, 9);
    ctx.fillStyle = '#737f77';ctx.fillRect(8, -5, 12, 2);
  } else if (shotgun) {
    ctx.fillStyle = '#69523a';ctx.fillRect(-5, -2.5, 10, 5);
    ctx.fillRect(18, 3, 10, 3);
    ctx.fillStyle = '#2e3938';ctx.fillRect(19, -5.6, s.muzzle - 22, 2);
    if (id === 'bulldog') { ctx.fillStyle = '#aa8052';ctx.fillRect(26, -4, 5, 8); }
  } else if (id === 'smg9') {
    ctx.fillStyle = '#2e3a39';ctx.fillRect(-3, -2.2, 9, 4.4);
    ctx.fillStyle = '#74614b';ctx.fillRect(16, 3, 5, 9);
    ctx.fillStyle = '#7d8a80';ctx.fillRect(13, -6, 10, 2);
  } else if (id === 'flamer8') {
    ctx.fillStyle = '#a66a46';ctx.beginPath();ctx.ellipse(8, 6, 5, 7, 0, 0, Math.PI * 2);ctx.fill();
    ctx.fillStyle = '#303936';ctx.fillRect(19, -6, 10, 2);
    ctx.fillStyle = '#bd8758';ctx.fillRect(27, 3, 6, 5);
  } else if (id === 'rpg4') {
    ctx.fillStyle = '#747d69';ctx.fillRect(8, -5, 30, 10);
    ctx.fillStyle = '#a9a58c';ctx.beginPath();ctx.moveTo(36,-5);ctx.lineTo(44,0);ctx.lineTo(36,5);ctx.fill();
    ctx.fillStyle = '#6b5540';ctx.fillRect(12,5,4,8);
  } else {
    ctx.fillStyle = '#313e3b';ctx.fillRect(-6, -3, 10, 6);
    ctx.fillStyle = id === 'rail_lance' ? '#7cbec3' : '#76634e';
    ctx.fillRect(14, 3, heavy ? 8 : 5, heavy ? 11 : 8);
    ctx.fillStyle = '#7f8982';ctx.fillRect(16, -6, heavy ? 14 : 10, 2);
    if (id === 'dmr55') {ctx.fillStyle='#9daaa0';ctx.fillRect(24,-8,11,2);}
    if (id === 'lmg6') {ctx.fillStyle='#80674d';ctx.fillRect(20,4,14,7);}
    if (id === 'rail_lance') {ctx.fillStyle='#8bc9cf';ctx.fillRect(30,-4,9,1.5);}
  }

  // Magazine or shell motion follows the existing reload progress only.
  if (reloadProgress > .08 && reloadProgress < .83) {
    ctx.fillStyle = shotgun ? '#aa8150' : '#695c49';
    const travel = Math.sin((reloadProgress - .08) / .75 * Math.PI) * 8;
    ctx.fillRect(s.grip + 1, 5 + travel, shotgun ? 5 : 6, shotgun ? 3 : 7);
  }
  ctx.fillStyle = '#1c2425';
  ctx.fillRect(s.grip - 2, 2, 5, 6);
}
