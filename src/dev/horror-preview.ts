import { CAMPAIGN_VARIANT_TYPES, HORROR_TYPES, ZOMBIE_TYPES } from '../data/zombies';
import { openAnatomyGallery } from './anatomy-gallery';
import { runHorrorChecks } from './horror-checks';
import { CAMPAIGN_ATTACKS, STAGES, type CampaignAttackKind } from '../data/meta';
import { runCampaignChecks } from './campaign-checks';

interface Snapshot {
  screen: string; playerHp: number; kills: number; xp: number; gems: number;
  hits: number; attacks: number; deaths: number; drops: number; phases: string[];
  creature: { type: string; hp: number; x: number; y: number; phase: string; flash: number;
    attack: string; moveProgress: number; campaignPhase: number } | null;
}
interface PreviewHost {
  encounter(type: string, wall?: boolean): void;
  campaign(stageIndex: number, bossPreview: boolean, zoneIndex?: number, attackKind?: CampaignAttackKind): void;
  campaignWave(stageIndex: number, zoneIndex: number): void;
  captureClean(enabled: boolean): void;
  shoot(): void; menu(): void; survive(): void; gameOver(): void; snapshot(): Snapshot;
}

/** Dynamically imported behind import.meta.env.DEV; absent from the production bundle. */
export function mountHorrorPreview(host: PreviewHost): void {
  const panel = document.createElement('details');
  panel.open = true;
  panel.id = 'horror-preview';
  panel.style.cssText = 'position:fixed;left:10px;top:180px;z-index:30;width:min(310px,calc(100vw - 20px));max-height:52vh;overflow:auto;background:#111b20ed;border:1px solid #76b4c1;color:#edf0e9;font:12px/1.5 system-ui;padding:10px;box-sizing:border-box';
  const summary = document.createElement('summary');
  summary.textContent = 'DEV • Quái / Campaign • Không ghi save';
  panel.append(summary);
  panel.addEventListener('toggle', () => {
    panel.style.top = panel.open ? '180px' : 'auto';
    panel.style.bottom = panel.open ? 'auto' : '8px';
    panel.style.width = panel.open ? 'min(310px,calc(100vw - 20px))' : 'auto';
    panel.style.maxHeight = panel.open ? '52vh' : '40px';
  });
  const controls = document.createElement('div');
  controls.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;margin:8px 0';
  panel.append(controls);
  const status = document.createElement('pre');
  status.id = 'horror-status';
  status.style.cssText = 'white-space:pre-wrap;margin:6px 0;font:11px/1.5 monospace';
  const results = document.createElement('pre');
  results.id = 'horror-check-results';
  results.style.cssText = status.style.cssText;
  panel.append(status, results);
  document.body.append(panel);
  let chosen = HORROR_TYPES[0].id;
  let running = false;
  let contactSheetUrl: string | null = null;
  let contactSheetLink: HTMLAnchorElement | null = null;
  const buttons: HTMLButtonElement[] = [];
  const button = (label: string, action: () => void) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = label;
    b.style.cssText = 'padding:6px 8px;background:#29363c;color:#edf0e9;border:1px solid #526870;border-radius:3px;cursor:pointer;font:12px system-ui';
    b.onclick = action; controls.append(b); buttons.push(b);
  };
  button('Thư viện hình thể', openAnatomyGallery);
  for (const stage of STAGES) {
    button(`${String(stage.id).padStart(2, '0')} • map`, () => host.campaign(stage.id - 1, false));
    button(`${String(stage.id).padStart(2, '0')} • boss`, () => host.campaign(stage.id - 1, true));
  }
  const stageSelect = document.createElement('select');
  const zoneSelect = document.createElement('select');
  const attackSelect = document.createElement('select');
  for (const stage of STAGES) {
    const option = document.createElement('option'); option.value = String(stage.id - 1); option.textContent = `${stage.id}. ${stage.name}`; stageSelect.append(option);
  }
  const refreshZones = () => {
    zoneSelect.replaceChildren();
    const stage = STAGES[Number(stageSelect.value)];
    stage.layout?.zones.forEach((zone, index) => {
      const option = document.createElement('option'); option.value = String(index); option.textContent = `K${index + 1} ${zone.waveTrigger ? '• WAVE' : '• YÊN'} · ${zone.name}`; zoneSelect.append(option);
    });
    attackSelect.replaceChildren();
    for(const move of CAMPAIGN_ATTACKS[stage.id]??[]){
      const option=document.createElement('option');option.value=move.kind;option.textContent=`${move.name} · ${move.kind}`;attackSelect.append(option);
    }
  };
  stageSelect.onchange = refreshZones;
  stageSelect.style.cssText = zoneSelect.style.cssText = attackSelect.style.cssText = 'max-width:100%;background:#233136;color:#edf0e9;border:1px solid #526870;padding:5px';
  controls.append(stageSelect, zoneSelect, attackSelect); refreshZones();
  button('Nhảy tới khu', () => host.campaign(Number(stageSelect.value), false, Number(zoneSelect.value)));
  button('Thử wave khu đã chọn', () => {
    const stageIndex = Number(stageSelect.value), zoneIndex = Number(zoneSelect.value);
    if (!STAGES[stageIndex].layout?.zones[zoneIndex]?.waveTrigger) {
      results.textContent = 'Khu này là đoạn tiếp cận an toàn; hãy chọn khu có nhãn WAVE.';
      return;
    }
    results.textContent = 'Preview wave đang chạy trong môi trường dev; save người chơi không bị thay đổi.';
    host.campaignWave(stageIndex, zoneIndex);
  });
  button('Thử riêng chiêu boss',()=>host.campaign(Number(stageSelect.value),true,undefined,attackSelect.value as CampaignAttackKind));
  button('Kiểm tra 10 tuyến', () => {
    try { results.textContent = runCampaignChecks().join('\n'); }
    catch (error) { results.textContent = `FAIL ${String(error)}`; console.error(error); }
  });
  button('Xuất ảnh 3 map đầu', () => { void (async () => {
    if (running) return;
    const gameCanvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
    if (!gameCanvas) return;
    running = true;
    for (const b of buttons) b.disabled = true;
    host.captureClean(true);
    const tileW = 640, tileH = 392, imageH = 360;
    const sheet = document.createElement('canvas');
    const campaignSamples = STAGES.slice(0, 3);
    sheet.width = tileW * 4; sheet.height = tileH * campaignSamples.length;
    const sheetCtx = sheet.getContext('2d')!;
    sheetCtx.fillStyle = '#0a0d0e'; sheetCtx.fillRect(0, 0, sheet.width, sheet.height);
    const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    try {
      for (let stageIndex = 0; stageIndex < campaignSamples.length; stageIndex++) {
        const stage = campaignSamples[stageIndex];
        const lastZone = (stage.layout?.zones.length ?? 5) - 1;
        const views = [0, Math.max(1, Math.floor(lastZone / 2)), Math.max(1, lastZone - 1), lastZone];
        for (let column = 0; column < views.length; column++) {
          const zoneIndex = views[column];
          host.campaign(stageIndex, column === 3, column === 3 ? undefined : zoneIndex);
          await nextFrame();
          const x = column * tileW, y = stageIndex * tileH;
          sheetCtx.drawImage(gameCanvas, x, y, tileW, imageH);
          sheetCtx.fillStyle = '#11191c'; sheetCtx.fillRect(x, y + imageH, tileW, tileH - imageH);
          sheetCtx.fillStyle = '#e7e5d9'; sheetCtx.font = 'bold 20px Segoe UI, Arial';
          const zone = stage.layout?.zones[zoneIndex];
          sheetCtx.fillText(`${stage.id}. ${stage.name} — ${zone?.name ?? 'Boss'}`, x + 10, y + imageH + 23, tileW - 20);
        }
        results.textContent = `Đang chụp ${stageIndex + 1}/3 map…`;
      }
      const blob = await new Promise<Blob>((resolve, reject) => sheet.toBlob(value => value ? resolve(value) : reject(new Error('Không xuất được ảnh')), 'image/jpeg', .9));
      if (contactSheetUrl) URL.revokeObjectURL(contactSheetUrl);
      contactSheetLink?.remove();
      contactSheetUrl = URL.createObjectURL(blob);
      contactSheetLink = document.createElement('a');
      contactSheetLink.href = contactSheetUrl;
      contactSheetLink.download = 'campaign-first-3-map-contact-sheet.jpg';
      contactSheetLink.textContent = 'Tải bảng ảnh 3 map đầu';
      contactSheetLink.style.cssText = 'display:block;margin:8px 0;color:#b8e4df;font-weight:bold';
      panel.append(contactSheetLink);
      results.textContent = 'Đã chụp 12 góc nhìn gameplay của 3 map đầu, gồm khu đầu, giữa và boss.';
    } catch (error) {
      results.textContent = `FAIL ${String(error)}`; console.error(error);
    } finally {
      host.captureClean(false);
      running = false;
      for (const b of buttons) b.disabled = false;
    }
  })(); });
  for (const type of [...ZOMBIE_TYPES, ...HORROR_TYPES, ...CAMPAIGN_VARIANT_TYPES]) button(type.name, () => { chosen = type.id; host.encounter(type.id); });
  button('Sát tường', () => host.encounter(chosen, true));
  button('Đạn kiểm tra', () => host.shoot());
  button('Menu', () => host.menu());
  button('Sinh tồn', () => host.survive());
  button('Game Over', () => host.gameOver());
  const wait = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms));
  button('Kiểm tra AI + đạn', () => { void (async () => {
    if (running) return;
    running = true;
    for (const b of buttons) b.disabled = true;
    results.textContent = '';
    try {
      const checks = runHorrorChecks();
      results.textContent = checks.join('\n') + '\n';
      for (const type of HORROR_TYPES) {
        host.encounter(type.id);
        const initial = host.snapshot().creature!;
        const deadline = performance.now() + 14000;
        while (host.snapshot().attacks < 1 && performance.now() < deadline) await wait(80);
        await wait(650);
        const attacking = host.snapshot();
        if (!attacking.creature || attacking.attacks < 1 || !attacking.phases.includes('windup') ||
            Math.hypot(attacking.creature.x - initial.x, attacking.creature.y - initial.y) < 10) {
          throw new Error(`${type.id}: spawn/movement/windup/attack failed`);
        }
        if (attacking.playerHp >= 100) throw new Error(`${type.id}: actual player damage missing`);
        const killDeadline = performance.now() + 5500;
        while (host.snapshot().deaths === 0 && performance.now() < killDeadline) { host.shoot(); await wait(90); }
        const dead = host.snapshot();
        if (dead.hits === 0 || dead.deaths !== 1 || dead.drops !== type.xpValue || dead.kills !== 1) {
          throw new Error(`${type.id}: projectile/death/XP reward failed: ${JSON.stringify(dead)}`);
        }
        results.textContent += `PASS ${type.id}: di chuyển → báo đòn → gây sát thương → đạn trúng → chết → ${dead.drops} XP\n`;
        await wait(400);
      }
      results.textContent += 'PASS Tất cả kiểm tra tích hợp. Save thường không được đọc/ghi.\n';
    } catch (error) {
      results.textContent += `FAIL ${String(error)}\n`;
      console.error(error);
    } finally {
      running = false;
      for (const b of buttons) b.disabled = false;
    }
  })(); });
  window.setInterval(() => {
    const s = host.snapshot();
    status.textContent = `${s.screen} • HP ${s.playerHp} • hạ ${s.kills}\n${s.creature ? `${s.creature.type} • ${s.creature.phase} • HP ${s.creature.hp.toFixed(0)}${s.creature.attack ? `\nChiêu ${s.creature.attack} • ${Math.round(s.creature.moveProgress * 100)}% • pha ${s.creature.campaignPhase}` : ''}` : 'Không có quái'}\nĐạn trúng ${s.hits} • ra đòn ${s.attacks} • chết ${s.deaths} • XP rơi ${s.drops}`;
  }, 150);
}
