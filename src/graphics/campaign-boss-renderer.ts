import type { Zombie } from '../entities/zombies';

const PALE = '#aaa395', FLESH = '#593d3d', WOUND = '#843b3e', BONE = '#c3b69b', IRON = '#55595a';

/** Campaign boss silhouettes, separate from the Survival renderer and stats. */
export function drawCampaignBoss(ctx: CanvasRenderingContext2D, z: Zombie, x: number, y: number, flash: boolean): void {
  const id = z.campaignBossId;
  if (id === null) return;
  const r = z.size;
  ctx.save(); ctx.translate(x, y); ctx.rotate(z.facingAngle);
  ctx.globalAlpha = z.hp > 0 ? 1 : .45;
  ctx.fillStyle = 'rgba(0,0,0,.42)';
  ctx.beginPath(); ctx.ellipse(4, 7, r * 1.12, r * .78, 0, 0, Math.PI * 2); ctx.fill();
  if (id === 3) {
    ctx.fillStyle = '#44484a'; ctx.strokeStyle = '#242728'; ctx.lineWidth = Math.max(3, r * .08);
    ctx.fillRect(-r*.92,-r*.36,r*1.52,r*.72); ctx.strokeRect(-r*.92,-r*.36,r*1.52,r*.72);
    ctx.strokeStyle = '#aaa28f'; ctx.lineWidth = Math.max(2,r*.045);
    ctx.beginPath(); ctx.moveTo(-r*.72,-r*.47); ctx.lineTo(r*.7,-r*.47); ctx.moveTo(-r*.72,r*.47); ctx.lineTo(r*.7,r*.47); ctx.stroke();
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
  else if (id === 2) { ctx.ellipse(-r*.12,0,r*.82,r*.68,-.16,0,Math.PI*2); }
  else { ctx.ellipse(-r*.06, 0, r*.7, r*.53, id === 5 ? -.38 : .12, 0, Math.PI*2); }
  ctx.fill(); ctx.stroke();

  if (id === 10 && z.campaignPhase >= 2) {
    ctx.strokeStyle = z.campaignPhase >= 3 ? '#c36659' : '#8f514c'; ctx.lineWidth = r*.045;
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + .2;
      ctx.beginPath(); ctx.moveTo(Math.cos(a)*r*.16,Math.sin(a)*r*.13); ctx.lineTo(Math.cos(a+.12)*r*.34,Math.sin(a+.12)*r*.3); ctx.lineTo(Math.cos(a-.08)*r*.57,Math.sin(a-.08)*r*.46); ctx.stroke();
    }
    if (z.campaignPhase >= 3) {
      ctx.strokeStyle = '#674247'; ctx.lineWidth = r*.09;
      for (let i = 0; i < 4; i++) { const a = Math.PI * (.18 + i * .47); ctx.beginPath(); ctx.moveTo(Math.cos(a)*r*.48,Math.sin(a)*r*.42); ctx.quadraticCurveTo(Math.cos(a+.3)*r*.98,Math.sin(a+.3)*r*.96,Math.cos(a+.5)*r*1.18,Math.sin(a+.5)*r*.62); ctx.stroke(); }
    }
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
