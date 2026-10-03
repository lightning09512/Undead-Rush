import type { Camera } from '../core/camera';
import type { CampaignAttackDef, StageDef } from '../data/meta';
import type { Zombie } from '../entities/zombies';
import { resolveBuildingCollision } from '../entities/map-geometry';

type Phase = 'approach' | 'windup' | 'active' | 'recover';

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

  reset(): void {
    this.phase = 'approach'; this.phaseTime = 0; this.cooldown = 1.6;
    this.attackIndex = 0; this.attack = null; this.hitThisMove = false; this.chargeTravel = 0;
    this.bossPhase = 1;
  }

  update(dt: number, stage: StageDef, boss: Zombie | undefined, playerX: number, playerY: number, onSummon?: () => void): number {
    if (!boss || boss.hp <= 0) { this.phase = 'approach'; this.attack = null; return 0; }
    const moves = campaignMoves(stage.id);
    if (!moves.length) return 0;
    const hpRatio = boss.hp / boss.maxHp;
    const phase = stage.id === 10 ? hpRatio <= .33 ? 3 : hpRatio <= .66 ? 2 : 1 : hpRatio <= .32 ? 2 : 1;
    if (phase > this.bossPhase) {
      this.bossPhase = phase;
      this.attackIndex = stage.id === 10 ? phase - 1 : this.attackIndex;
      this.cooldown = .7;
      boss.flashTimer = .22;
    }
    boss.campaignPhase = phase;
    boss.specialState = this.phase === 'approach' ? 'chase' : this.phase;
    boss.specialTimer = this.phaseTime;

    if (this.phase === 'approach') {
      boss.speed = Math.max(18, 42 - stage.id * 1.1);
      this.cooldown -= dt;
      if (this.cooldown <= 0) {
        this.attack = moves[this.attackIndex++ % moves.length];
        this.ox = boss.x; this.oy = boss.y;
        this.angle = Math.atan2(playerY - boss.y, playerX - boss.x);
        this.phase = 'windup'; this.phaseTime = 0; this.hitThisMove = false; this.chargeTravel = 0;
        boss.speed = 0; boss.vx = boss.vy = 0;
      }
      return 0;
    }

    const move = this.attack!;
    this.phaseTime += dt;
    boss.speed = 0; boss.vx = boss.vy = 0;
    if (this.phase === 'windup') {
      boss.visualWindup = Math.min(1, this.phaseTime / move.telegraph);
      if (this.phaseTime >= move.telegraph) {
        this.phase = 'active'; this.phaseTime = 0; this.lastX = boss.x; this.lastY = boss.y;
        boss.specialHit = false;
        if (move.kind === 'summon') onSummon?.();
      }
      return 0;
    }

    if (this.phase === 'active') {
      boss.visualWindup = 1;
      let hit = false;
      const dx = playerX - this.ox, dy = playerY - this.oy;
      const distance = Math.hypot(dx, dy);
      const relativeAngle = Math.atan2(dy, dx) - this.angle;
      const wrapped = Math.atan2(Math.sin(relativeAngle), Math.cos(relativeAngle));
      if (move.kind === 'charge') {
        const step = Math.min(move.speed ?? 360, 520) * dt;
        this.chargeTravel = Math.min(move.reach, this.chargeTravel + step);
        const nextX = this.ox + Math.cos(this.angle) * this.chargeTravel;
        const nextY = this.oy + Math.sin(this.angle) * this.chargeTravel;
        [boss.x, boss.y] = resolveBuildingCollision(nextX, nextY, boss.size * .8);
        hit = pointSegmentDistanceSq(playerX, playerY, this.lastX, this.lastY, boss.x, boss.y) < (boss.size + 18) ** 2;
        this.lastX = boss.x; this.lastY = boss.y;
        if (this.chargeTravel >= move.reach) this.phaseTime = Math.max(this.phaseTime, .48);
      } else if (move.kind === 'sweep') hit = distance < move.reach && Math.abs(wrapped) < .86;
      else if (move.kind === 'fan') hit = distance < move.reach && Math.abs(wrapped) < .58;
      else if (move.kind === 'slam' || move.kind === 'stomp') {
        const activeAt = move.kind === 'stomp' ? .34 : .06;
        hit = this.phaseTime >= activeAt && this.phaseTime < activeAt + .09 && distance < move.reach;
      } else if (move.kind === 'ring') {
        const inner = move.reach * .56;
        hit = distance >= inner && distance < move.reach;
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
      const duration = move.kind === 'charge' ? .58 : move.kind === 'stomp' ? .72 : .3;
      if (this.phaseTime >= duration) { this.phase = 'recover'; this.phaseTime = 0; boss.visualWindup = 0; }
      return 0;
    }

    if (this.phase === 'recover') {
      boss.visualWindup = 0;
      if (this.phaseTime >= move.recovery) {
        this.phase = 'approach'; this.phaseTime = 0;
        this.cooldown = Math.max(.48, 1.5 - stage.id * .075) * (hpRatio < .34 ? .76 : 1);
        this.attack = null;
      }
    }
    return 0;
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera, boss: Zombie | undefined): void {
    if (!boss || boss.hp <= 0 || !this.attack || (this.phase !== 'windup' && this.phase !== 'active')) return;
    const move = this.attack;
    const [x, y] = camera.worldToScreen(this.ox, this.oy);
    const remain = this.phase === 'windup' ? Math.max(0, 1 - this.phaseTime / move.telegraph) : .36;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.fillStyle = `rgba(180, 48, 40, ${.08 + remain * .1})`;
    ctx.strokeStyle = `rgba(222, 95, 78, ${.72 + remain * .22})`; ctx.lineWidth = 3;
    if (move.kind === 'slam' || move.kind === 'stomp') {
      ctx.beginPath(); ctx.arc(x, y, move.reach, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.arc(x, y, move.reach * .55, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    } else if (move.kind === 'ring') {
      ctx.beginPath(); ctx.arc(x, y, move.reach, 0, Math.PI * 2); ctx.arc(x, y, move.reach * .56, 0, Math.PI * 2, true); ctx.fill('evenodd');
      ctx.beginPath(); ctx.arc(x, y, move.reach, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, move.reach * .56, 0, Math.PI * 2); ctx.stroke();
    } else if (move.kind === 'sweep' || move.kind === 'fan') {
      const arc = move.kind === 'sweep' ? .86 : .58;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, move.reach, this.angle - arc, this.angle + arc); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (move.kind === 'charge') {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(this.angle) * move.reach, y + Math.sin(this.angle) * move.reach); ctx.stroke();
      ctx.strokeStyle = `rgba(222,95,78,${.18 + remain * .2})`; ctx.lineWidth = (boss.size + 18) * 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(this.angle) * move.reach, y + Math.sin(this.angle) * move.reach); ctx.stroke();
    } else if (move.kind === 'summon') {
      ctx.beginPath(); ctx.arc(x, y, 76, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.setLineDash([5, 7]); ctx.beginPath(); ctx.arc(x, y, 76 * (.7 + .3 * (1-remain)), 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    } else {
      const a = this.angle; const ex = x + Math.cos(a) * move.reach; const ey = y + Math.sin(a) * move.reach;
      ctx.strokeStyle = `rgba(222,95,78,${.2 + remain * .25})`; ctx.lineWidth = 76;
      ctx.beginPath(); ctx.moveTo(x - Math.sin(a)*move.reach, y + Math.cos(a)*move.reach); ctx.lineTo(x + Math.sin(a)*move.reach, y - Math.cos(a)*move.reach); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = '#df725f'; ctx.lineWidth = 2; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
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
