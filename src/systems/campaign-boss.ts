import type { Camera } from '../core/camera';
import type { GameLanguage } from '../data/localization';
import type { CampaignAttackDef, CampaignAttackKind, StageDef } from '../data/meta';
import type { Zombie } from '../entities/zombies';
import { resolveBuildingCollision, resolveCampaignMovement } from '../entities/map-geometry';
import { getBossSignature, type BossProjectileType } from '../data/boss-signatures';

type Phase = 'approach' | 'transition' | 'windup' | 'active' | 'recover';
type ProjectileComboMove = { move: CampaignAttackDef; angle: number };

/** Shared telegraphs and hit checks for the authored Campaign boss profiles. */
export class CampaignBossDirector {
  private phase: Phase = 'approach';
  private phaseTime = 0;
  private cooldown = 1.6;
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
  private projectileCombo: ProjectileComboMove[] = [];

  reset(): void {
    this.phase = 'approach'; this.phaseTime = 0; this.cooldown = 1.6;
    this.attack = null; this.hitThisMove = false; this.chargeTravel = 0;
    this.bossPhase = 1;
    this.recentKinds = [];
    this.chainDepth = 0;
    this.hazardX = this.hazardY = 0;
    this.forcedMove = null;
    this.nextFanBurstAt = 0;
    this.projectileCombo = [];
  }

  forceNextAttack(kind:CampaignAttackKind):void { this.forcedMove=kind; }

  update(dt: number, stage: StageDef, boss: Zombie | undefined, playerX: number, playerY: number,
    onSummon?: () => void, onAction?: (move:CampaignAttackDef,boss:Zombie,angle:number,repeat?:boolean)=>void,
    speedMultiplier = 1, onTelegraph?: (move: CampaignAttackDef, boss: Zombie, angle: number) => void): number {
    if (!boss || boss.hp <= 0) { this.phase = 'approach'; this.attack = null; this.projectileCombo = []; return 0; }
    const moves = campaignMoves(stage.id);
    if (!moves.length) return 0;
    const hpRatio = boss.hp / boss.maxHp;
    const phase = hpRatio <= .5 ? 2 : 1;
    if (phase > this.bossPhase) {
      this.bossPhase = phase;
      this.phase = 'transition'; this.phaseTime = 0; this.attack = null;
      this.projectileCombo = [];
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
      boss.speed = this.chaseSpeed(stage.id) * speedMultiplier;
      boss.campaignAttackProgress=0;
      this.cooldown -= dt;
      if (this.cooldown <= 0) {
        this.attack = this.forcedMove ? moves.find(move=>move.kind===this.forcedMove)??this.chooseMove(moves,Math.hypot(playerX-boss.x,playerY-boss.y),stage.id) : this.chooseMove(moves, Math.hypot(playerX - boss.x, playerY - boss.y), stage.id);
        this.forcedMove=null;
        this.chainDepth = 0;
        this.ox = boss.x; this.oy = boss.y;
        this.angle = Math.atan2(playerY - boss.y, playerX - boss.x);
        this.prepareProjectileCombo(moves, this.attack, this.angle, stage.id);
        this.hazardX=playerX+Math.cos(this.angle)*55;this.hazardY=playerY+Math.sin(this.angle)*55;
        boss.campaignAttackKind=this.attack.kind;boss.campaignAttackProgress=0;boss.specialAngle=this.angle;boss.facingAngle=this.angle;
        onTelegraph?.(this.attack, boss, this.angle);
        for (const combo of this.projectileCombo.slice(1)) onTelegraph?.(combo.move, boss, combo.angle);
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
        this.nextFanBurstAt = this.fanInterval(stage.id) * (this.bossPhase >= 2 ? .76 : 1);
        boss.specialHit = false;
        if (move.kind === 'summon') onSummon?.();
        onAction?.(move,boss,this.angle,false);
        for (const combo of this.projectileCombo.slice(1)) onAction?.(combo.move,boss,combo.angle,false);
        boss.visualStrike=.22;
      }
      return 0;
    }

    if (this.phase === 'active') {
      boss.visualWindup = 1;
      boss.specialAngle=this.angle;boss.facingAngle=this.angle;
      const duration = this.attackDuration(move, stage.id, speedMultiplier);
      if (move.kind === 'fan' && this.phaseTime >= this.nextFanBurstAt && this.phaseTime < duration - .08) {
        // Each marked fan is a real volley of moving, collidable projectiles.
        // A short interval makes the attack feel sustained without a single
        // invisible damage check spanning the entire cone.
        onAction?.(move, boss, this.angle, true);
        this.nextFanBurstAt += this.fanInterval(stage.id) * (this.bossPhase >= 2 ? .76 : 1);
      }
      boss.campaignAttackProgress=Math.min(1,this.phaseTime/duration);
      let hit = false;
      const dx = playerX - this.ox, dy = playerY - this.oy;
      const distance = Math.hypot(dx, dy);
      const relativeAngle = Math.atan2(dy, dx) - this.angle;
      const wrapped = Math.atan2(Math.sin(relativeAngle), Math.cos(relativeAngle));
      if (move.kind === 'charge') {
        const step = this.chaseSpeed(stage.id) * speedMultiplier * 5 * dt;
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
            this.prepareProjectileCombo(moves, followup, this.angle, stage.id);
            this.hazardX=playerX+Math.cos(this.angle)*55;this.hazardY=playerY+Math.sin(this.angle)*55;boss.campaignAttackKind=followup.kind;boss.specialAngle=this.angle;boss.facingAngle=this.angle;
            onTelegraph?.(followup, boss, this.angle);
            this.hitThisMove = false; this.phase = 'windup'; this.phaseTime = 0;
            return 0;
          }
        }
        this.phase = 'approach'; this.phaseTime = 0;
        this.cooldown = stage.id === 1
          ? Math.max(.22, 1.05 - stage.id * .065) * (this.bossPhase >= 2 ? .62 : 1)
          : Math.max(.18, .64 - (stage.id - 2) * .045) * (this.bossPhase >= 2 ? .58 : 1);
        this.attack = null;
        this.projectileCombo = [];
      }
    }
    return 0;
  }

  private chaseSpeed(stageId: number): number { return Math.max(38, 52 - stageId) * 3; }

  private attackDuration(move: CampaignAttackDef, stageId: number, speedMultiplier: number): number {
    if (move.kind === 'charge') return Math.max(.8, move.reach / (this.chaseSpeed(stageId) * speedMultiplier * 5));
    if (move.kind === 'stomp' || move.kind === 'slam') return .68;
    if (move.kind === 'ring') return .98;
    if (move.kind === 'summon') return .78;
    if (move.kind === 'thrust') return .34;
    if (move.kind === 'sweep') return .43;
    if (move.kind === 'fan') return stageId === 1 ? .88 : stageId >= 7 ? .96 : .92;
    return .52;
  }

  private recoveryDuration(move: CampaignAttackDef, stageId: number, hpRatio: number): number {
    const cadence = stageId === 1
      ? Math.max(.42, .78 - stageId * .035)
      : Math.max(.36, .66 - (stageId - 2) * .035);
    return Math.max(stageId === 1 ? .32 : .26, move.recovery * cadence * (this.bossPhase >= 2 ? .72 : 1));
  }

  private prepareProjectileCombo(moves: CampaignAttackDef[], primary: CampaignAttackDef, angle: number, stageId: number): void {
    this.projectileCombo = [{ move: primary, angle }];
    if (this.bossPhase < 2 || (primary.kind !== 'fan' && primary.kind !== 'ring')) return;
    const count = stageId >= 5 && Math.random() < .58 ? 3 : 2;
    for (let index = 1; index < count; index++) {
      const kind = index === 1 ? (primary.kind === 'fan' ? 'ring' : 'fan') : 'fan';
      const candidates = moves.filter(move => move.kind === kind);
      const source = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : primary;
      const side = index === 1 ? 1 : -1;
      const offset = source.kind === 'fan' ? side * (primary.kind === 'ring' ? .48 : .58) : 0;
      this.projectileCombo.push({
        move: { ...source, damage: Math.max(1, Math.round(source.damage * .64)) },
        angle: angle + offset,
      });
    }
  }

  private chooseMove(moves: CampaignAttackDef[], distance: number, stageId: number): CampaignAttackDef {
    // Vary the opener too, then suppress the last two move types whenever the
    // profile has alternatives. Range and spell weights keep the pressure up
    // without making the exact next attack deterministic.
    const recent = this.recentKinds.slice(-2);
    const alternatives = moves.filter(move => !recent.includes(move.kind));
    const candidates = alternatives.length ? alternatives : moves;
    const weighted = candidates.map(move => {
      const rangeFit = distance > move.reach * 1.1
        ? (move.kind === 'charge' || move.kind === 'web' || move.kind === 'fan' ? 1.3 : 0)
        : (move.kind === 'sweep' || move.kind === 'slam' || move.kind === 'ring' || move.kind === 'stomp' ? 1.1 : 0);
      const pounceBias = move.kind === 'charge' ? stageId === 1 ? .45 : stageId >= 7 ? 2.8 : stageId >= 4 ? 2.3 : 1.8 : 0;
      const rangedBias = move.kind === 'fan' && distance > move.reach * .45 ? stageId === 1 ? 1.4 : 2.5 : 0;
      const radialBias = move.kind === 'ring' ? stageId === 1 ? 1.1 : 2.3 : 0;
      const phaseTwoSpellBias = this.bossPhase >= 2 && (move.kind === 'fan' || move.kind === 'ring') ? 1.25 : 0;
      const weight = Math.max(.2, 1 + rangeFit + pounceBias + rangedBias + radialBias + phaseTwoSpellBias + Math.random() * 1.25);
      return { move, weight };
    });
    let roll = Math.random() * weighted.reduce((sum, entry) => sum + entry.weight, 0);
    let selected = candidates[candidates.length - 1];
    for (const entry of weighted) {
      roll -= entry.weight;
      if (roll <= 0) { selected = entry.move; break; }
    }
    this.recentKinds.push(selected.kind);
    if (this.recentKinds.length > 3) this.recentKinds.shift();
    return selected;
  }

  private fanInterval(stageId: number): number {
    if (stageId === 1) return .3;
    return Math.max(.19, .24 - (stageId - 2) * .005);
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera, boss: Zombie | undefined, showSkillDirection = true, language: GameLanguage = 'vi'): void {
    if (!showSkillDirection) return;
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
    const signature=getBossSignature(boss.campaignBossId);
    const color=signature.colors.warning;
    const danger=signature.colors.glow;
    const progress=Math.max(0,Math.min(1,boss.campaignAttackProgress));
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
    ctx.strokeStyle=color;ctx.fillStyle=withAlpha(signature.colors.glow,.16);ctx.lineWidth=3;
    if(windup){
      this.drawChargeMotif(ctx,boss,x,y,progress,signature.projectile,signature.colors.core,signature.colors.glow);
      if(move.kind==='slam'||move.kind==='stomp'){
        ctx.beginPath();ctx.arc(x,y,move.reach,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([13,10]);ctx.beginPath();ctx.arc(x,y,move.reach*.72,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
      }else if(move.kind==='ring'){
        ctx.fillStyle=withAlpha(signature.colors.glow,.18);ctx.beginPath();ctx.ellipse(hx,hy,move.reach,move.reach*.72,-.2,0,Math.PI*2);ctx.fill();ctx.strokeStyle=color;ctx.beginPath();ctx.ellipse(hx,hy,move.reach,move.reach*.72,-.2,0,Math.PI*2);ctx.stroke();
        ctx.fillStyle=signature.colors.core;ctx.font='bold 12px Segoe UI, Arial';ctx.textAlign='center';ctx.fillText(signature.warningText[language],hx,hy-move.reach*.74,move.reach*1.7);
        // Dashed radial spokes warn that the boss will also release a real
        // outward projectile ring from its body when the windup ends.
        ctx.strokeStyle=danger;ctx.globalAlpha=.78;ctx.lineWidth=2;ctx.setLineDash([7,8]);
        const radialReach=Math.max(boss.size*1.8,Math.min(move.reach,360));
        for(let i=0;i<10;i++){
          const a=this.angle+i*Math.PI/5;
          ctx.beginPath();ctx.moveTo(x+Math.cos(a)*boss.size*.9,y+Math.sin(a)*boss.size*.9);
          ctx.lineTo(x+Math.cos(a)*radialReach,y+Math.sin(a)*radialReach);ctx.stroke();
        }
        ctx.setLineDash([]);ctx.globalAlpha=1;
      }else if(move.kind==='sweep'){
        ctx.beginPath();ctx.moveTo(x,y);ctx.arc(x,y,move.reach,this.angle-.92,this.angle+.92);ctx.closePath();ctx.fill();ctx.stroke();
        ctx.strokeStyle=color;ctx.lineWidth=7;ctx.beginPath();ctx.arc(x,y,move.reach*.88,this.angle-.86+progress*.16,this.angle+.86-progress*.16);ctx.stroke();
      }else if(move.kind==='thrust'){
        const ex=x+Math.cos(this.angle)*move.reach,ey=y+Math.sin(this.angle)*move.reach;
        ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(ex,ey);ctx.strokeStyle=danger;ctx.lineWidth=48;ctx.globalAlpha=.16;ctx.stroke();ctx.globalAlpha=1;ctx.lineWidth=3;ctx.setLineDash([8,8]);ctx.stroke();ctx.setLineDash([]);
        ctx.fillStyle=color;for(let k=1;k<=3;k++){const d=move.reach*k/4,px=x+Math.cos(this.angle)*d,py=y+Math.sin(this.angle)*d;ctx.beginPath();ctx.moveTo(px+Math.cos(this.angle)*12,py+Math.sin(this.angle)*12);ctx.lineTo(px-Math.cos(this.angle)*8-Math.sin(this.angle)*8,py-Math.sin(this.angle)*8+Math.cos(this.angle)*8);ctx.lineTo(px-Math.cos(this.angle)*8+Math.sin(this.angle)*8,py-Math.sin(this.angle)*8-Math.cos(this.angle)*8);ctx.closePath();ctx.fill();}
      }else if(move.kind==='fan'){
        // Include the small per-volley aim variation so every projectile stays
        // inside the warning cone shown to the player.
        const halfSpread = boss.campaignBossId === 2 ? .78 : (boss.campaignBossId ?? 0) >= 7 ? .54 : .58;
        const left=this.angle-halfSpread,right=this.angle+halfSpread;
        ctx.fillStyle=withAlpha(signature.colors.glow,.2);
        ctx.beginPath();ctx.moveTo(x,y);ctx.arc(x,y,move.reach,left,right);ctx.closePath();ctx.fill();
        ctx.strokeStyle=color;ctx.lineWidth=3;ctx.setLineDash([9,7]);
        ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(left)*move.reach,y+Math.sin(left)*move.reach);ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(right)*move.reach,y+Math.sin(right)*move.reach);ctx.stroke();ctx.setLineDash([]);
        ctx.strokeStyle=danger;ctx.globalAlpha=.45;ctx.lineWidth=1.5;
        const volleyCount=(boss.campaignBossId ?? 0)>=7?10:(boss.campaignBossId ?? 0)>=5?9:boss.campaignBossId===2?9:8;
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
        const radius=move.reach*Math.min(1,this.phaseTime/.52);ctx.strokeStyle=signature.colors.core;ctx.lineWidth=8;ctx.globalAlpha=.8;ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=.35;ctx.lineWidth=18;ctx.beginPath();ctx.arc(x,y,Math.max(0,radius-13),0,Math.PI*2);ctx.stroke();
      }else if(move.kind==='ring'){
        const age=this.phaseTime;
        ctx.fillStyle=withAlpha(signature.colors.glow,.36);ctx.strokeStyle=age<.68?signature.colors.warning:signature.colors.core;ctx.lineWidth=4;
        ctx.beginPath();ctx.ellipse(hx,hy,move.reach*(.72+.28*Math.min(1,age/.65)),move.reach*.54*(.72+.28*Math.min(1,age/.65)),-.2,0,Math.PI*2);ctx.fill();ctx.stroke();
        if(age<.45){for(let k=0;k<4;k++){const t=Math.min(1,age/.45),px=x+(hx-x)*t+Math.sin(age*15+k*2)*7,py=y+(hy-y)*t+Math.cos(age*13+k*2)*5;ctx.fillStyle=signature.colors.core;ctx.beginPath();ctx.ellipse(px,py,6+k%2*2,9+k%2*2,.3+k*.4,0,Math.PI*2);ctx.fill();}}
        else if(age>=.68){ctx.strokeStyle=signature.colors.core;ctx.lineWidth=7;ctx.beginPath();ctx.ellipse(hx,hy,move.reach*Math.min(1,(age-.68)*7),move.reach*.72*Math.min(1,(age-.68)*7),-.2,0,Math.PI*2);ctx.stroke();}
      }else if(move.kind==='summon'){
        ctx.strokeStyle=color;ctx.lineWidth=5;ctx.globalAlpha=.65;for(let k=0;k<3;k++){const r=45+k*36+Math.sin(this.phaseTime*8+k)*5;ctx.beginPath();ctx.arc(bx,by,r,0,Math.PI*2);ctx.stroke();}ctx.globalAlpha=1;
      }else if(move.kind==='sweep'){
        ctx.strokeStyle=danger;ctx.lineWidth=9;ctx.globalAlpha=.72;ctx.beginPath();ctx.arc(bx,by,move.reach*.83,this.angle-.92,this.angle+.92);ctx.stroke();ctx.globalAlpha=1;
      }else if(move.kind==='thrust'){
        ctx.strokeStyle=color;ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(bx+Math.cos(this.angle)*move.reach*.92,by+Math.sin(this.angle)*move.reach*.92);ctx.stroke();
      }
    }
    if (windup && this.projectileCombo.length > 1) {
      for (const combo of this.projectileCombo.slice(1)) this.drawComboTelegraph(ctx, camera, boss, combo);
    }
    ctx.restore();
  }

  private drawChargeMotif(ctx: CanvasRenderingContext2D, boss: Zombie, x: number, y: number,
    progress: number, projectile: BossProjectileType, core: string, glow: string): void {
    const pulse = .9 + Math.sin(boss.animTimer * 8) * .1;
    const radius = boss.size * (1.08 + progress * .08) * pulse;
    ctx.save(); ctx.globalAlpha = .24 + progress * .34; ctx.lineWidth = 1.5;
    ctx.strokeStyle = glow; ctx.setLineDash([3, 7]); ctx.beginPath();
    ctx.arc(x, y, radius, boss.animTimer * .2, boss.animTimer * .2 + Math.PI * 1.7); ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < 6; i++) {
      const angle = boss.animTimer * .55 + i * Math.PI / 3;
      const px = x + Math.cos(angle) * radius, py = y + Math.sin(angle) * radius;
      const size = 3.5 + progress * 2.5;
      ctx.fillStyle = i % 2 ? core : glow;
      ctx.strokeStyle = core; ctx.lineWidth = 1;
      ctx.beginPath();
      if (projectile === 'boss_arcane') {
        ctx.moveTo(px, py - size); ctx.lineTo(px + size * .72, py); ctx.lineTo(px, py + size); ctx.lineTo(px - size * .72, py); ctx.closePath();
      } else if (projectile === 'boss_fire') {
        ctx.moveTo(px, py + size); ctx.lineTo(px - size * .52, py); ctx.lineTo(px, py - size * 1.25); ctx.lineTo(px + size * .6, py + size * .1); ctx.closePath();
      } else if (projectile === 'boss_acid') {
        ctx.ellipse(px, py, size * .55, size, angle, 0, Math.PI * 2);
      } else if (projectile === 'boss_blood') {
        ctx.moveTo(px, py - size); ctx.quadraticCurveTo(px + size, py - size * .15, px, py + size); ctx.quadraticCurveTo(px - size, py - size * .15, px, py - size); ctx.closePath();
      } else {
        ctx.moveTo(px - size, py - size * .25); ctx.lineTo(px + size, py - size * .55); ctx.lineTo(px + size * .35, py + size * .65); ctx.closePath();
      }
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  private drawComboTelegraph(ctx: CanvasRenderingContext2D, camera: Camera, boss: Zombie,
    combo: ProjectileComboMove): void {
    const [x, y] = camera.worldToScreen(this.ox, this.oy);
    const range = Math.min(combo.move.reach, 390);
    const signature = getBossSignature(boss.campaignBossId);
    const color = signature.colors.warning;
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.globalAlpha = .72; ctx.setLineDash([8, 8]);
    if (combo.move.kind === 'fan') {
      const bossId = boss.campaignBossId ?? 0;
      const spread = bossId === 2 ? .78 : bossId >= 7 ? .54 : .58;
      const left = combo.angle - spread, right = combo.angle + spread;
      ctx.fillStyle = withAlpha(signature.colors.glow,.12);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, range, left, right); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(left) * range, y + Math.sin(left) * range);
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(right) * range, y + Math.sin(right) * range);
      ctx.stroke();
      ctx.setLineDash([3, 8]); ctx.globalAlpha = .38;
      for (let i = 1; i <= 3; i++) {
        const angle = combo.angle - spread + spread * 2 * i / 4;
        ctx.beginPath(); ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(angle) * range, y + Math.sin(angle) * range); ctx.stroke();
      }
    } else {
      const radialReach = Math.max(boss.size * 1.8, range * .78);
      ctx.beginPath(); ctx.arc(x, y, radialReach, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const angle = combo.angle + i * Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(angle) * boss.size * .9, y + Math.sin(angle) * boss.size * .9);
        ctx.lineTo(x + Math.cos(angle) * radialReach, y + Math.sin(angle) * radialReach);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

import { CAMPAIGN_ATTACKS as ATTACKS } from '../data/meta';

const campaignMoveCache = new Map<number, CampaignAttackDef[]>();

function campaignMoves(stageId: number): CampaignAttackDef[] {
  const cached = campaignMoveCache.get(stageId);
  if (cached) return cached;
  const authored = ATTACKS[stageId] || [];
  const radialSpell: CampaignAttackDef = {
    name: 'Chưởng tỏa vòng', kind: 'ring', damage: stageId === 1 ? 15 : 20 + stageId * 2,
    reach: 150 + stageId * 13, telegraph: stageId === 1 ? 1.1 : .98, recovery: 1.35,
  };
  const moves: CampaignAttackDef[] = authored.some(move => move.kind === 'ring') ? authored : [...authored, radialSpell];
  campaignMoveCache.set(stageId, moves);
  return moves;
}

function pointSegmentDistanceSq(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq));
  const qx = x1 + t * dx, qy = y1 + t * dy;
  return (px - qx) ** 2 + (py - qy) ** 2;
}

function withAlpha(color: string, alpha: number): string {
  const value = color.replace('#', '');
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
