import { HORROR_TYPES, ZOMBIE_TYPES } from '../data/zombies';
import { openAnatomyGallery } from './anatomy-gallery';
import { runHorrorChecks } from './horror-checks';

interface Snapshot {
  screen: string; playerHp: number; kills: number; xp: number; gems: number;
  hits: number; attacks: number; deaths: number; drops: number; phases: string[];
  creature: { type: string; hp: number; x: number; y: number; phase: string; flash: number } | null;
}
interface PreviewHost {
  encounter(type: string, wall?: boolean): void;
  shoot(): void; menu(): void; survive(): void; gameOver(): void; snapshot(): Snapshot;
}

/** Dynamically imported behind import.meta.env.DEV; absent from the production bundle. */
export function mountHorrorPreview(host: PreviewHost): void {
  const panel = document.createElement('details');
  panel.open = true;
  panel.id = 'horror-preview';
  panel.style.cssText = 'position:fixed;left:10px;top:180px;z-index:30;width:min(310px,calc(100vw - 20px));max-height:52vh;overflow:auto;background:#111b20ed;border:1px solid #76b4c1;color:#edf0e9;font:12px/1.5 system-ui;padding:10px;box-sizing:border-box';
  const summary = document.createElement('summary');
  summary.textContent = 'DEV • Quái Sinh tồn • Save tạm';
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
  const buttons: HTMLButtonElement[] = [];
  const button = (label: string, action: () => void) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = label;
    b.style.cssText = 'padding:6px 8px;background:#29363c;color:#edf0e9;border:1px solid #526870;border-radius:3px;cursor:pointer;font:12px system-ui';
    b.onclick = action; controls.append(b); buttons.push(b);
  };
  button('Thư viện hình thể', openAnatomyGallery);
  for (const type of [...ZOMBIE_TYPES, ...HORROR_TYPES]) button(type.name, () => { chosen = type.id; host.encounter(type.id); });
  button('Sát tường', () => host.encounter(chosen, true));
  button('Đạn kiểm tra', () => host.shoot());
  button('Menu', () => host.menu());
  button('Sinh tồn', () => host.survive());
  button('Game Over', () => host.gameOver());
  const wait = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms));
  button('Kiểm tra 5 loài', () => { void (async () => {
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
    status.textContent = `${s.screen} • HP ${s.playerHp} • hạ ${s.kills}\n${s.creature ? `${s.creature.type} • ${s.creature.phase} • HP ${s.creature.hp.toFixed(0)}` : 'Không có quái'}\nĐạn trúng ${s.hits} • ra đòn ${s.attacks} • chết ${s.deaths} • XP rơi ${s.drops}`;
  }, 150);
}
