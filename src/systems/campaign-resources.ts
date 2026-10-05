import type { Camera } from '../core/camera';
import type { StageDef } from '../data/meta';
import type { Player } from '../entities/player';
import type { GunLoadout } from './gun-loadout';
import { isCampaignWalkable, segmentHitsBuilding } from '../entities/map-geometry';

type Supply = { x: number; y: number; kind: 'ammo' | 'med' | 'crate'; used: boolean };
export type CollectedSupply = { x: number; y: number; kind: Supply['kind']; label: string };

/** Fixed, visible supplies along each Campaign route, including one before the boss. */
export class CampaignResources {
  stations: Supply[] = [];
  used = 0;

  reset(stage?: StageDef): void {
    this.stations = []; this.used = 0;
    if (!stage?.layout) return;
    const zones = stage.layout.zones;
    const add = (zoneIndex: number, kind: Supply['kind'], side: number) => {
      const z = zones[Math.min(zoneIndex, zones.length - 2)];
      this.stations.push({ x: z.x + z.w / 2 + side * 155, y: z.y + z.h / 2 + 145, kind, used: false });
    };
    add(1, 'ammo', 1);
    add(Math.max(2, zones.length - 3), 'med', -1);
    add(zones.length - 2, 'crate', 1);
  }

  collectNearby(player: Player, guns: GunLoadout, ammoMultiplier = 1): CollectedSupply[] {
    const collected: CollectedSupply[] = [];
    for (const supply of this.stations) {
      if (supply.used || Math.hypot(supply.x - player.x, supply.y - player.y) > player.size + 29 ||
          !isCampaignWalkable(supply.x, supply.y, 15) || segmentHitsBuilding(player.x, player.y, supply.x, supply.y)) continue;
      const hpBefore = player.hp;
      const canAddAmmo = guns.canAddCampaignAmmo();
      if (supply.kind === 'med' && hpBefore >= player.maxHp) continue;
      if (supply.kind === 'ammo' && !canAddAmmo) continue;
      if (supply.kind === 'crate' && hpBefore >= player.maxHp && !canAddAmmo) continue;
      const magazines = supply.kind === 'crate' ? 4 : 3;
      if (supply.kind !== 'med' && canAddAmmo) guns.addCampaignAmmo(magazines * ammoMultiplier);
      if (supply.kind !== 'ammo') player.heal(supply.kind === 'crate' ? 35 : 50);
      supply.used = true; this.used++;
      const healed = Math.round(player.hp - hpBefore);
      collected.push({ x: supply.x, y: supply.y, kind: supply.kind,
        label: supply.kind === 'ammo' ? `ĐẠN DỰ TRỮ +${Math.round(magazines * ammoMultiplier)} BĂNG` : supply.kind === 'med' ? `MÁU +${healed}` :
          `TIẾP TẾ${healed ? ` · MÁU +${healed}` : ''}${canAddAmmo ? ` · ĐẠN +${Math.round(magazines * ammoMultiplier)} BĂNG` : ''}` });
    }
    return collected;
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    for (const s of this.stations) {
      if (!camera.isVisible(s.x, s.y, 60)) continue;
      const [x, y] = camera.worldToScreen(s.x, s.y);
      if (s.used) continue;
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = 'rgba(0,0,0,.54)';
      ctx.beginPath(); ctx.ellipse(2, 17, 28, 8, 0, 0, Math.PI * 2); ctx.fill();
      const med = s.kind === 'med', ammo = s.kind === 'ammo';
      const trim = med ? '#c8e6be' : ammo ? '#f0ce83' : '#a8d4d5';
      ctx.fillStyle = med ? '#376a4e' : ammo ? '#775a2e' : '#465e62';
      ctx.strokeStyle = trim; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(-23, -16, 46, 33, med ? 6 : 3); ctx.fill(); ctx.stroke();
      if (med) {
        ctx.fillStyle = '#e4f3dd'; ctx.fillRect(-4, -11, 8, 23); ctx.fillRect(-13, -3, 26, 8);
        ctx.fillStyle = '#203f33'; ctx.fillRect(-11, -21, 22, 5);
      } else if (ammo) {
        ctx.fillStyle = '#e4c67f';
        for (const dx of [-12, 0, 12]) {
          ctx.fillRect(dx - 3, -5, 6, 15);
          ctx.beginPath(); ctx.moveTo(dx - 3, -5); ctx.lineTo(dx, -11); ctx.lineTo(dx + 3, -5); ctx.fill();
        }
      } else {
        ctx.strokeStyle = '#1e3437'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(-14, -16); ctx.lineTo(-14, 17); ctx.moveTo(14, -16); ctx.lineTo(14, 17); ctx.stroke();
        ctx.fillStyle = '#dce9dd'; ctx.fillRect(-3, -9, 6, 18); ctx.fillRect(-10, -2, 20, 5);
        ctx.fillStyle = '#e2c77f'; ctx.fillRect(-21, -14, 8, 5);
      }
      ctx.fillStyle = '#f6f0dd'; ctx.font = 'bold 10px Segoe UI, Arial'; ctx.textAlign = 'center';
      ctx.fillText(med ? 'MÁU' : ammo ? 'ĐẠN' : 'TIẾP TẾ', 0, -27);
      ctx.restore();
    }
  }
}
