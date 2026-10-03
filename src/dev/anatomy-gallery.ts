import { ZOMBIE_TYPES, HORROR_TYPES, getHorrorAttack } from '../data/zombies';
import { ZombieSystem } from '../entities/zombies';
import { ZombieRenderer } from '../graphics/zombie-renderer';
import { drawHorrorWarning } from '../systems/horror-ai';
import { drawHorrorCorpse } from '../graphics/horror-renderer';

/** Isolated visual fixtures: no game/save state, no production import. */
export function openAnatomyGallery(): void {
  if (document.getElementById('anatomy-gallery')) return;
  const root = document.createElement('section'); root.id = 'anatomy-gallery';
  root.style.cssText = 'position:fixed;inset:0;z-index:50;background:#171d23;color:#c9cdc6;overflow:auto;padding:16px;font:13px system-ui';
  const toolbar = document.createElement('div'); toolbar.style.cssText = 'position:sticky;top:0;background:#171d23;padding:8px;z-index:2;display:flex;gap:8px;flex-wrap:wrap';
  root.append(toolbar);
  let phase = 'walk', stage = false, closed = false;
  for (const [label, value] of [['Đi / thở', 'walk'], ['Báo đòn', 'windup'], ['Ra đòn', 'active'], ['Hồi sức', 'recover'], ['Trúng đạn', 'hit'], ['Xác', 'dead']]) {
    const b = document.createElement('button'); b.textContent = label; b.onclick = () => { phase = value; }; toolbar.append(b);
  }
  const compare = document.createElement('button'); compare.textContent = 'So sánh Stage'; compare.onclick = () => { stage = !stage; compare.textContent = stage ? 'Trở về Sinh tồn' : 'So sánh Stage'; }; toolbar.append(compare);
  const close = document.createElement('button'); close.textContent = 'Đóng thư viện'; close.onclick = () => { closed = true; root.remove(); }; toolbar.append(close);
  const note = document.createElement('p'); note.textContent = 'Tỷ lệ chơi 1.42× • kích thước quái +62,5% so với gốc • 13 loại • hoạt ảnh mẫu tách biệt khỏi combat • đám đông 78 quái'; root.append(note);
  const grid = document.createElement('div'); grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:8px'; root.append(grid);
  const system = new ZombieSystem();
  const fixtures = [...ZOMBIE_TYPES, ...HORROR_TYPES].map(type => {
    const item = document.createElement('div'); item.style.cssText = 'border:1px solid #3c4449;background:#20262c;text-align:center;overflow:hidden';
    const title = document.createElement('div'); title.textContent = type.id; item.append(title);
    const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:300px;height:300px';
    const dpr = devicePixelRatio || 1; canvas.width = canvas.height = 300 * dpr;
    item.append(canvas); grid.append(item);
    const z = system.spawn(type, 0, 0, 1, 1, 1); z.facingAngle = -0.25; z.wobble = z.id * 1.3;
    return { canvas, ctx: canvas.getContext('2d')!, z, dpr };
  });
  const crowd = document.createElement('canvas'); crowd.style.cssText = 'display:block;width:100%;height:250px;margin-top:12px;background:#1c2229'; root.append(crowd);
  document.body.append(root);
  const render = (ms: number) => {
    if (closed) return;
    const t = ms / 1000;
    for (const {ctx, z, dpr} of fixtures) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, 300, 300);
      ctx.translate(150, 150); ctx.scale(1.42, 1.42);
      z.walkDist = phase === 'walk' ? t * z.speed * 0.08 : 0;
      z.animTimer = t; z.specialState = phase === 'windup' || phase === 'active' || phase === 'recover' ? phase : 'chase';
      z.specialDuration = 1; z.specialTimer = 1 - (t * 0.7 % 1); z.specialAngle = z.facingAngle;
      z.visualWindup = phase === 'windup' ? 1 - z.specialTimer : 0;
      z.visualStrike = phase === 'active' ? z.specialTimer * 0.25 : 0;
      z.attackAnim = phase === 'active' ? 1 : 0; z.attackTimer = t * 10;
      if (phase === 'dead') drawHorrorCorpse(ctx, z.typeId, 0, 0, z.size, z.facingAngle, z.id);
      else {
        if (getHorrorAttack(z.typeId)) drawHorrorWarning(ctx, z, 0, 0);
        ZombieRenderer.drawZombie(ctx, z, 0, 0, phase === 'hit' && t % 0.5 < 0.08, !stage);
      }
    }
    const w = crowd.clientWidth, dpr = devicePixelRatio || 1;
    if (crowd.width !== Math.round(w * dpr)) { crowd.width = Math.round(w * dpr); crowd.height = 250 * dpr; }
    const c = crowd.getContext('2d')!; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, 250);
    c.scale(1.42, 1.42);
    for (let i = 0; i < 78; i++) {
      const z = fixtures[i % fixtures.length].z;
      const x = 25 + ((i * 83) % Math.max(30, w / 1.42 - 50));
      const y = 25 + ((i * 47) % 125);
      ZombieRenderer.drawZombie(c, z, x, y, false, !stage);
    }
    requestAnimationFrame(render);
  };
  requestAnimationFrame(render);
}
