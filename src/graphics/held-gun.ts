import type { GunDef } from '../systems/gun-loadout';
import { drawGunArt } from './campaign-menu-art';

export type HeldGunShape = { muzzle: number; grip: number; support: number; casing: 'small' | 'rifle' | 'shell' | 'heavy' | 'none' };

/** World-scale anchors for the same weapon silhouettes used by the armory and HUD. */
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

const holdAnchors: Record<string, [trigger: number, foreEnd: number, muzzle: number]> = {
  p9: [103, 131, 159],
  ar7: [96, 138, 164],
  smg9: [96, 138, 160],
  sg12: [96, 136, 163],
  bulldog: [76, 126, 163],
  dmr55: [96, 131, 166],
  lmg6: [96, 143, 165],
  flamer8: [95, 135, 168],
  rpg4: [49, 126, 166],
  rail_lance: [96, 138, 164],
};

/** The player's in-world gun uses the same cached drawing as the armory, rotated by the player renderer. */
export function drawHeldGun(ctx: CanvasRenderingContext2D, def: GunDef, reloadProgress: number): void {
  const shape = heldGunShape(def);
  const [triggerAnchor, foreEndAnchor, muzzleAnchor] = holdAnchors[def.id] ?? holdAnchors.ar7;
  const handScale = (shape.support - shape.grip) / (foreEndAnchor - triggerAnchor);
  const muzzleScale = (shape.muzzle - shape.grip) / (muzzleAnchor - triggerAnchor);
  const scale = Math.max(.16, Math.min(.52, handScale * .65 + muzzleScale * .35));
  const artWidth = 170 * scale;
  const artHeight = 60 * scale;
  const artX = shape.grip - triggerAnchor * scale;
  const artY = -artHeight / 2;
  drawGunArt(ctx, artX, artY, artWidth, artHeight, def.id);

  // Show a detached magazine during the existing reload window. Shotguns keep
  // their tube in place and show a shell instead, matching their reload motion.
  if (reloadProgress > .08 && reloadProgress < .83 && shape.casing !== 'none') {
    const shotgun = shape.casing === 'shell';
    const travel = Math.sin((reloadProgress - .08) / .75 * Math.PI) * 8;
    const triggerX = artX + triggerAnchor * scale;
    const magazineX = shotgun ? shape.grip + 2 : artX + 91 * scale;
    const magazineY = shotgun ? 3 : artY + 43 * scale;
    if (!shotgun) {
      ctx.fillStyle = '#182122';
      ctx.fillRect(magazineX - 1, magazineY - 1, 16 * scale, 13 * scale);
      ctx.strokeStyle = '#66736c'; ctx.lineWidth = Math.max(.5, scale * 2);
      ctx.strokeRect(magazineX - 1, magazineY - 1, 16 * scale, 13 * scale);
    }
    ctx.save(); ctx.translate(triggerX + 1, travel);
    ctx.fillStyle = shotgun ? '#b18457' : '#695c49';
    ctx.beginPath();
    if (shotgun) ctx.roundRect(-2.5, 2, 5, 3, 1);
    else ctx.roundRect(-3, 2, 6, 8, 1.5);
    ctx.fill(); ctx.strokeStyle = '#171e1f'; ctx.lineWidth = .7; ctx.stroke();
    ctx.restore();
  }
}
