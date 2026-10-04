import type { Camera } from '../core/camera';
import type { CampaignAttackDef, CampaignAttackKind, StageDef } from '../data/meta';
import type { Zombie } from '../entities/zombies';
import { resolveBuildingCollision, resolveCampaignMovement } from '../entities/map-geometry';

type Phase = 'approach' | 'transition' | 'windup' | 'active' | 'recover';

/** Campaign-only boss telegraphs and hit checks. Survival boss AI stays in main.ts. */
export class CampaignBossDirector {
  private phase: Phase = 'approach';
  private phaseTime = 0;
  private cooldown = 1.6;
  private attackIndex = 0;
  private attack: CampaignAttackDef | null = null;
  private ox = 0; private oy = 0; private angle = 0;
  private hitThisMove = false;
  private chargeTravel = 0;
  private lastX = 0; private lastY = 0;
  private bossPhase = 1;
  private recentKinds: CampaignAttackKind[] = [];
  private chainDepth = 0;
  private hazardX = 0;
  private hazardY = 0;
  private forcedMove: CampaignAttackKind | null = null;
  private nextFanBurstAt = 0;

  reset(): void {
    this.phase = 'approach'; this.phaseTime = 0; this.cooldown = 1.6;
    this.attackIndex = 0; this.attack = null; this.hitThisMove = false; this.chargeTravel = 0;
    this.bossPhase = 1;
    this.recentKinds = [];
    this.chainDepth = 0;
    this.hazardX = this.hazardY = 0;
    this.forcedMove = null;
    this.nextFanBurstAt = 0;
  }

  forceNextAttack(kind:CampaignAttackKind):void { this.forcedMove=kind; }

  update(dt: number, stage: StageDef, boss: Zombie | undefined, playerX: number, playerY: number,
    onSummon?: () => void, onAction?: (move:CampaignAttackDef,boss:Zombie,angle:number)=>void): number {
    if (!boss || boss.hp <= 0) { this.phase = 'approach'; this.attack = null; return 0; }
    const moves = campaignMoves(stage.id);
    if (!moves.length) return 0;
    const hpRatio = boss.hp / boss.maxHp;
    const phase = stage.id === 10 ? hpRatio <= .33 ? 3 : hpRatio <= .66 ? 2 : 1 : hpRatio <= .32 ? 2 : 1;
    if (phase > this.bossPhase) {
      this.bossPhase = phase;
      this.phase = 'transition'; this.phaseTime = 0; this.attack = null;
      boss.campaignAttackKind='';boss.campaignAttackProgress=0;
      this.cooldown = .5;
      boss.flashTimer = .9;
    }
    boss.campaignPhase = phase;
    boss.specialState = this.phase === 'approach' ? 'chase' : this.phase === 'transition' ? 'recover' : this.phase;
    boss.specialTimer = this.phaseTime;

    if (this.phase === 'transition') {
      boss.speed = 0; boss.vx = boss.vy = 0; boss.visualWindup = 0;
      this.phaseTime += dt;
      if (this.phaseTime >= 1.15) { this.phase = 'approach'; this.phaseTime = 0; }
      return 0;
    }

    if (this.phase === 'approach') {
      boss.speed = this.chaseSpeed(stage.id);
      boss.campaignAttackProgress=0;
      this.cooldown -= dt;
      if (this.cooldown <= 0) {
        this.attack = this.forcedMove ? moves.find(move=>move.kind===this.forcedMove)??this.chooseMove(moves,Math.hypot(playerX-boss.x,playerY-boss.y),stage.id) : this.chooseMove(moves, Math.hypot(playerX - boss.x, playerY - boss.y), stage.id);
        this.forcedMove=null;
        this.chainDepth = 0;
        this.ox = boss.x; this.oy = boss.y;
        this.angle = Math.atan2(playerY - boss.y, playerX - boss.x);
        this.hazardX=playerX+Math.cos(this.angle)*55;this.hazardY=playerY+Math.sin(this.angle)*55;
        boss.campaignAttackKind=this.attack.kind;boss.campaignAttackProgress=0;boss.specialAngle=this.angle;boss.facingAngle=this.angle;
        this.phase = 'windup'; this.phaseTime = 0; this.hitThisMove = false; this.chargeTravel = 0;
        this.nextFanBurstAt = 0;
        boss.speed = 0; boss.vx = boss.vy = 0;
      }
      return 0;
    }

    const move = this.attack!;
    this.phaseTime += dt;
    boss.speed = 0; boss.vx = boss.vy = 0;
    if (this.phase === 'windup') {
      boss.visualWindup = Math.min(1, this.phaseTime / move.telegraph);
      boss.campaignAttackProgress=boss.visualWindup;boss.specialAngle=this.angle;boss.facingAngle=this.angle;
      if (this.phaseTime >= move.telegraph) {
        this.phase = 'active'; this.phaseTime = 0; this.lastX = boss.x; this.lastY = boss.y;
        this.nextFanBurstAt = .34;
        boss.specialHit = false;
        if (move.kind === 'summon') onSummon?.();
        onAction?.(move,boss,this.angle);
        boss.visualStrike=.22;
      }
      return 0;
    }

    if (this.phase === 'active') {
      boss.visualWindup = 1;
      boss.specialAngle=this.angle;boss.facingAngle=this.angle;
      const duration = this.attackDuration(move, stage.id);
      if (move.kind === 'fan' && this.phaseTime >= this.nextFanBurstAt && this.phaseTime < duration - .08) {
        // Each marked fan is a real volley of moving, collidable projectiles.
        // A short interval makes the attack feel sustained without a single
        // invisible damage check spanning the entire cone.
        onAction?.(move, boss, this.angle);
        this.nextFanBurstAt += .34;
      }
      boss.campaignAttackProgress=Math.min(1,this.phaseTime/duration);
      let hit = false;
      const dx = playerX - this.ox, dy = playerY - this.oy;
      const distance = Math.hypot(dx, dy);
      const relativeAngle = Math.atan2(dy, dx) - this.angle;
      const wrapped = Math.atan2(Math.sin(relativeAngle), Math.cos(relativeAngle));
      if (move.kind === 'charge') {
        const step = this.chaseSpeed(stage.id) * 5 * dt;
        this.chargeTravel = Math.min(move.reach, this.chargeTravel + step);
        const nextX = this.ox + Math.cos(this.angle) * this.chargeTravel;
        const nextY = this.oy + Math.sin(this.angle) * this.chargeTravel;
        const [clearX, clearY] = resolveBuildingCollision(nextX, nextY, boss.size * .8);
        [boss.x, boss.y] = resolveCampaignMovement(this.lastX, this.lastY, clearX, clearY, boss.size * .8);
        hit = pointSegmentDistanceSq(playerX, playerY, this.lastX, this.lastY, boss.x, boss.y) < (boss.size + 18) ** 2;
        this.lastX = boss.x; this.lastY = boss.y;
        if (this.chargeTravel >= move.reach) this.phaseTime = Math.max(this.phaseTime, duration - .16);
      } else if (move.kind === 'sweep') hit = this.phaseTime>=.12&&this.phaseTime<.39&&distance < move.reach && Math.abs(wrapped) < .92;
      else if (move.kind === 'thrust') {
        const along=dx*Math.cos(this.angle)+dy*Math.sin(this.angle),across=Math.abs(-dx*Math.sin(this.angle)+dy*Math.cos(this.angle));
        hit=this.phaseTime>=.08&&this.phaseTime<.24&&along>0&&along<move.reach&&across<48;
      } else if (move.kind === 'slam' || move.kind === 'stomp') {
        const ringRadius=move.reach*Math.min(1,this.phaseTime/.52);
        const tolerance=Math.max(24,move.reach*dt/.52+15);
        hit=this.phaseTime>=.08&&this.phaseTime<.61&&Math.abs(distance-ringRadius)<tolerance;
      } else if (move.kind === 'ring') {
        hit=this.phaseTime>=.68&&this.phaseTime<.88&&Math.hypot(playerX-this.hazardX,playerY-this.hazardY)<move.reach;
      } else if (move.kind === 'fan') {
        // Fan attacks use visible, collidable projectiles spawned from the boss.
        hit=false;
      } else if (move.kind === 'web') {
        const along = dx * Math.cos(this.angle) + dy * Math.sin(this.angle);
        const across = Math.abs(-dx * Math.sin(this.angle) + dy * Math.cos(this.angle));
        hit = along > 0 && along < move.reach && across < 34;
      } else if (move.kind === 'cross') {
        const along = dx * Math.cos(this.angle) + dy * Math.sin(this.angle);
        const across = Math.abs(-dx * Math.sin(this.angle) + dy * Math.cos(this.angle));
        // Match the telegraph: a full side-to-side cut and a forward blood lane.
        hit = distance < move.reach && (Math.abs(along) < 38 || (along >= 0 && across < 38));
      }
      if (hit && !this.hitThisMove) { this.hitThisMove = true; boss.specialHit = true; return Math.round(move.damage * (hpRatio < .34 ? 1.08 : 1)); }
      if (this.phaseTime >= duration) { this.phase = 'recover'; this.phaseTime = 0; boss.visualWindup = 0; }
      return 0;
    }

    if (this.phase === 'recover') {
      boss.visualWindup = 0;
      const recovery = this.recoveryDuration(move, stage.id, hpRatio);
      boss.campaignAttackProgress=Math.max(0,1-this.phaseTime/recovery);
      if (this.phaseTime >= recovery) {
        const near = Math.hypot(playerX - boss.x, playerY - boss.y);
        const opensCombo = stage.id === 10
          ? move.kind === 'slam' || move.kind === 'ring'
          : move.kind === 'charge' || move.kind === 'sweep';
        if (this.chainDepth === 0 && this.bossPhase >= 2 && [5,6,7,8,9,10].includes(stage.id) &&
            opensCombo && near < 370) {
          const followup = moves.find(m => m.kind === 'stomp' || m.kind === 'slam');
          if (followup) {
            this.chainDepth = 1; this.attack = followup; this.recentKinds.push(followup.kind);
            this.ox = boss.x; this.oy = boss.y; this.angle = Math.atan2(playerY - boss.y, playerX - boss.x);
            this.hazardX=playerX+Math.cos(this.angle)*55;this.hazardY=playerY+Math.sin(this.angle)*55;boss.campaignAttackKind=followup.kind;boss.specialAngle=this.angle;boss.facingAngle=this.angle;
            this.hitThisMove = false; this.phase = 'windup'; this.phaseTime = 0;
            return 0;
          }
        }
        if (stage.id === 10 && this.bossPhase >= 3 && this.chainDepth === 1 && near < 450) {
          const followup = moves.find(m => m.kind === 'cross');
          if (followup) {
            this.chainDepth = 2; this.attack = followup; this.recentKinds.push(followup.kind);
            this.ox = boss.x; this.oy = boss.y; this.angle = Math.atan2(playerY - boss.y, playerX - boss.x);
            this.hazardX=playerX+Math.cos(this.angle)*55;this.hazardY=playerY+Math.sin(this.angle)*55;boss.campaignAttackKind=followup.kind;boss.specialAngle=this.angle;boss.facingAngle=this.angle;
            this.hitThisMove = false; this.phase = 'windup'; this.phaseTime = 0;
            return 0;
          }
        }
        this.phase = 'approach'; this.phaseTime = 0;
        this.cooldown = Math.max(.22, 1.05 - stage.id * .065) * (hpRatio < .34 ? .74 : 1);
        this.attack = null;
      }
    }
    return 0;
  }

  private chaseSpeed(stageId: number): number { return Math.max(38, 52 - stageId); }

  private attackDuration(move: CampaignAttackDef, stageId: number): number {
    if (move.kind === 'charge') return Math.max(.8, move.reach / (this.chaseSpeed(stageId) * 5));
    if (move.kind === 'stomp' || move.kind === 'slam') return .68;
    if (move.kind === 'ring') return .98;
    if (move.kind === 'summon') return .78;
    if (move.kind === 'thrust') return .34;
    if (move.kind === 'sweep') return .43;
    if (move.kind === 'fan') return .88;
    return .52;
  }

  private recoveryDuration(move: CampaignAttackDef, stageId: number, hpRatio: number): number {
    const cadence = Math.max(.42, .78 - stageId * .035) * (hpRatio < .34 ? .82 : 1);
    return Math.max(.32, move.recovery * cadence);
  }

  private chooseMove(moves: CampaignAttackDef[], distance: number, stageId: number): CampaignAttackDef {
    let best = moves[this.attackIndex++ % moves.length];
    if (this.attackIndex <= moves.length) {
      this.recentKinds.push(best.kind);
      return best;
    }
    let bestScore = -Infinity;
    for (const move of moves) {
      const recent = this.recentKinds.slice(-2).includes(move.kind);
      const rangeFit = distance > move.reach * 1.1
        ? (move.kind === 'charge' || move.kind === 'web' || move.kind === 'fan' ? 2 : 0)
        : (move.kind === 'sweep' || move.kind === 'slam' || move.kind === 'ring' || move.kind === 'stomp' ? 2 : 0);
      const pounceBias = move.kind === 'charge' ? (stageId >= 7 ? 2.4 : stageId >= 4 ? 1.35 : .35) : 0;
      const rangedBias = move.kind === 'fan' && distance > move.reach * .55 ? 1.1 : 0;
      const score = rangeFit + pounceBias + rangedBias - (recent ? 3 : 0) + Math.random() * 1.2;
      if (score > bestScore) { bestScore = score; best = move; }
    }
    this.recentKinds.push(best.kind);
    if (this.recentKinds.length > 3) this.recentKinds.shift();
    return best;
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera, boss: Zombie | undefined): void {
    if (boss && this.phase === 'transition') {
      const [px, py] = camera.worldToScreen(boss.x, boss.y);
      ctx.save(); ctx.strokeStyle = '#d4b58f'; ctx.lineWidth = 4; ctx.setLineDash([12, 9]);
      ctx.beginPath(); ctx.arc(px, py, boss.size * (1.3 + this.phaseTime * .25), 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      return;
    }
    if (!boss || boss.hp <= 0 || !this.attack || (this.phase !== 'windup' && this.phase !== 'active')) return;
    const move=this.attack;const windup=this.phase==='windup';
    const [x,y]=camera.worldToScreen(this.ox,this.oy);
    const [hx,hy]=camera.worldToScreen(this.hazardX,this.hazardY);
    const [bx,by]=camera.worldToScreen(boss.x,boss.y);
    const color=boss.campaignBossId===1?'#e1c48d':boss.campaignBossId===2?'#b9ca78':'#b8d1c6';
    const danger=boss.campaignBossId===2?'#92a953':boss.campaignBossId===3?'#b96459':'#bf785f';
    const progress=Math.max(0,Math.min(1,boss.campaignAttackProgress));
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
    ctx.strokeStyle=color;ctx.fillStyle=boss.campaignBossId===2?'rgba(155,185,85,.15)':boss.campaignBossId===3?'rgba(153,193,184,.15)':'rgba(209,180,119,.14)';ctx.lineWidth=3;
    if(windup){
      if(move.kind==='slam'||move.kind==='stomp'){
        ctx.beginPath();ctx.arc(x,y,move.reach,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([13,10]);ctx.beginPath();ctx.arc(x,y,move.reach*.72,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
      }else if(move.kind==='ring'){
        ctx.fillStyle='rgba(152,184,83,.15)';ctx.beginPath();ctx.ellipse(hx,hy,move.reach,move.reach*.72,-.2,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#b2c76c';ctx.beginPath();ctx.ellipse(hx,hy,move.reach,move.reach*.72,-.2,0,Math.PI*2);ctx.stroke();
        ctx.fillStyle='#e4cc8b';ctx.font='bold 12px Segoe UI, Arial';ctx.textAlign='center';ctx.fillText('DỊCH TÍCH TỤ',hx,hy-move.reach*.74);
      }else if(move.kind==='sweep'){
        ctx.beginPath();ctx.moveTo(x,y);ctx.arc(x,y,move.reach,this.angle-.92,this.angle+.92);ctx.closePath();ctx.fill();ctx.stroke();
        ctx.strokeStyle=color;ctx.lineWidth=7;ctx.beginPath();ctx.arc(x,y,move.reach*.88,this.angle-.86+progress*.16,this.angle+.86-progress*.16);ctx.stroke();
      }else if(move.kind==='thrust'){
        const ex=x+Math.cos(this.angle)*move.reach,ey=y+Math.sin(this.angle)*move.reach;
        ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(ex,ey);ctx.strokeStyle=danger;ctx.lineWidth=48;ctx.globalAlpha=.16;ctx.stroke();ctx.globalAlpha=1;ctx.lineWidth=3;ctx.setLineDash([8,8]);ctx.stroke();ctx.setLineDash([]);
        ctx.fillStyle=color;for(let k=1;k<=3;k++){const d=move.reach*k/4,px=x+Math.cos(this.angle)*d,py=y+Math.sin(this.angle)*d;ctx.beginPath();ctx.moveTo(px+Math.cos(this.angle)*12,py+Math.sin(this.angle)*12);ctx.lineTo(px-Math.cos(this.angle)*8-Math.sin(this.angle)*8,py-Math.sin(this.angle)*8+Math.cos(this.angle)*8);ctx.lineTo(px-Math.cos(this.angle)*8+Math.sin(this.angle)*8,py-Math.sin(this.angle)*8-Math.cos(this.angle)*8);ctx.closePath();ctx.fill();}
      }else if(move.kind==='fan'){
        const halfSpread=boss.campaignBossId===2?.39:.28;
        const left=this.angle-halfSpread,right=this.angle+halfSpread;
        ctx.fillStyle=boss.campaignBossId===2?'rgba(169,197,104,.2)':'rgba(200,197,183,.17)';
        ctx.beginPath();ctx.moveTo(x,y);ctx.arc(x,y,move.reach,left,right);ctx.closePath();ctx.fill();
        ctx.strokeStyle=color;ctx.lineWidth=3;ctx.setLineDash([9,7]);
        ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(left)*move.reach,y+Math.sin(left)*move.reach);ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(right)*move.reach,y+Math.sin(right)*move.reach);ctx.stroke();ctx.setLineDash([]);
        ctx.strokeStyle=danger;ctx.globalAlpha=.45;ctx.lineWidth=1.5;
        const volleyCount=boss.campaignBossId===2?7:6;
        for(let i=0;i<volleyCount;i++){
          const t=i/(volleyCount-1)-.5,a=this.angle+t*halfSpread*2;
          ctx.beginPath();ctx.moveTo(x+Math.cos(a)*boss.size*.8,y+Math.sin(a)*boss.size*.8);ctx.lineTo(x+Math.cos(a)*move.reach,y+Math.sin(a)*move.reach);ctx.stroke();
          const d=move.reach*(.28+progress*.16),px=x+Math.cos(a)*d,py=y+Math.sin(a)*d;
          ctx.fillStyle=color;ctx.beginPath();ctx.arc(px,py,4+progress*2,0,Math.PI*2);ctx.fill();
        }
        ctx.globalAlpha=1;
      }else if(move.kind==='charge'||move.kind==='web'){
        const ex=x+Math.cos(this.angle)*move.reach,ey=y+Math.sin(this.angle)*move.reach;
        ctx.strokeStyle=move.kind==='charge'?danger:color;ctx.globalAlpha=move.kind==='charge'?.23:.15;ctx.lineWidth=move.kind==='charge'?boss.size*1.55:62;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(ex,ey);ctx.stroke();ctx.globalAlpha=1;
        ctx.strokeStyle=color;ctx.lineWidth=3;ctx.setLineDash([11,9]);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(ex,ey);ctx.stroke();ctx.setLineDash([]);
        for(let k=0;k<3;k++){const d=move.reach*(.28+k*.24),px=x+Math.cos(this.angle)*d,py=y+Math.sin(this.angle)*d;ctx.beginPath();ctx.moveTo(px+Math.cos(this.angle)*11,py+Math.sin(this.angle)*11);ctx.lineTo(px-Math.cos(this.angle)*7-Math.sin(this.angle)*8,py-Math.sin(this.angle)*7+Math.cos(this.angle)*8);ctx.lineTo(px-Math.cos(this.angle)*7+Math.sin(this.angle)*8,py-Math.sin(this.angle)*7-Math.cos(this.angle)*8);ctx.closePath();ctx.fillStyle=color;ctx.fill();}
      }else if(move.kind==='summon'){
        ctx.strokeStyle=color;for(let k=0;k<3;k++){const r=36+k*32+progress*17;ctx.globalAlpha=.85-k*.18;ctx.lineWidth=4-k*.6;ctx.beginPath();ctx.arc(x,y,r,this.angle-.7,this.angle+.7);ctx.stroke();}ctx.globalAlpha=1;
      }else if(move.kind==='cross'){
        ctx.strokeStyle=color;ctx.lineWidth=38;ctx.globalAlpha=.18;ctx.beginPath();ctx.moveTo(x-Math.sin(this.angle)*move.reach,y+Math.cos(this.angle)*move.reach);ctx.lineTo(x+Math.sin(this.angle)*move.reach,y-Math.cos(this.angle)*move.reach);ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(this.angle)*move.reach,y+Math.sin(this.angle)*move.reach);ctx.stroke();ctx.globalAlpha=1;
      }
    }else{
      if(move.kind==='charge'){
        ctx.strokeStyle=danger;ctx.globalAlpha=.34;ctx.lineWidth=boss.size*1.1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(bx,by);ctx.stroke();ctx.globalAlpha=1;
        ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(bx,by);ctx.stroke();
      }else if(move.kind==='slam'||move.kind==='stomp'){
        const radius=move.reach*Math.min(1,this.phaseTime/.52);ctx.strokeStyle='#ead5ab';ctx.lineWidth=8;ctx.globalAlpha=.8;ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=.35;ctx.lineWidth=18;ctx.beginPath();ctx.arc(x,y,Math.max(0,radius-13),0,Math.PI*2);ctx.stroke();
      }else if(move.kind==='ring'){
        const age=this.phaseTime;
        ctx.fillStyle=age<.68?'rgba(159,191,84,.36)':'rgba(213,171,92,.42)';ctx.strokeStyle=age<.68?'#c9db8a':'#f2cd7b';ctx.lineWidth=4;
        ctx.beginPath();ctx.ellipse(hx,hy,move.reach*(.72+.28*Math.min(1,age/.65)),move.reach*.54*(.72+.28*Math.min(1,age/.65)),-.2,0,Math.PI*2);ctx.fill();ctx.stroke();
        if(age<.45){for(let k=0;k<4;k++){const t=Math.min(1,age/.45),px=x+(hx-x)*t+Math.sin(age*15+k*2)*7,py=y+(hy-y)*t+Math.cos(age*13+k*2)*5;ctx.fillStyle='#b8cf73';ctx.beginPath();ctx.ellipse(px,py,6+k%2*2,9+k%2*2,.3+k*.4,0,Math.PI*2);ctx.fill();}}
        else if(age>=.68){ctx.strokeStyle='#e8d794';ctx.lineWidth=7;ctx.beginPath();ctx.ellipse(hx,hy,move.reach*Math.min(1,(age-.68)*7),move.reach*.72*Math.min(1,(age-.68)*7),-.2,0,Math.PI*2);ctx.stroke();}
      }else if(move.kind==='summon'){
        ctx.strokeStyle=color;ctx.lineWidth=5;ctx.globalAlpha=.65;for(let k=0;k<3;k++){const r=45+k*36+Math.sin(this.phaseTime*8+k)*5;ctx.beginPath();ctx.arc(bx,by,r,0,Math.PI*2);ctx.stroke();}ctx.globalAlpha=1;
      }else if(move.kind==='sweep'){
        ctx.strokeStyle=danger;ctx.lineWidth=9;ctx.globalAlpha=.72;ctx.beginPath();ctx.arc(bx,by,move.reach*.83,this.angle-.92,this.angle+.92);ctx.stroke();ctx.globalAlpha=1;
      }else if(move.kind==='thrust'){
        ctx.strokeStyle=color;ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(bx+Math.cos(this.angle)*move.reach*.92,by+Math.sin(this.angle)*move.reach*.92);ctx.stroke();
      }
    }
    ctx.restore();
  }
}

function campaignMoves(stageId: number): CampaignAttackDef[] {
  // Imported data lazily at module level would make tests simpler; this local import is static.
  return ATTACKS[stageId] || [];
}

import { CAMPAIGN_ATTACKS as ATTACKS } from '../data/meta';

function pointSegmentDistanceSq(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq));
  const qx = x1 + t * dx, qy = y1 + t * dy;
  return (px - qx) ** 2 + (py - qy) ** 2;
}
