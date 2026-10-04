import type { Camera } from '../core/camera';
import type { StageDef } from '../data/meta';
import { isCampaignGateClosed } from '../entities/map-geometry';
import { CampaignGroundDetails } from './campaign-ground-details';

const accents = ['#8a9994','#bd9a55','#8baaa5','#729584','#a99b74','#9e9295','#a68a6e','#79aaa7','#a86f68','#b56b69'];

/** Stage footprint, landmarks, props and gates share campaign-layout data with collision. */
export class CampaignTerrainRenderer {
  private patterns = new Map<string, CanvasPattern>();
  private zoneDetails = new Map<string, HTMLCanvasElement>();
  private readonly groundDetails = new CampaignGroundDetails();

  draw(ctx: CanvasRenderingContext2D, camera: Camera, stage: StageDef, activeNode: number,
    playerX: number, playerY: number, gameTime: number): void {
    const layout = stage.layout;
    if (!layout) return;
    if (stage.id <= 3) this.drawAmbientBackdrop(ctx, camera, stage);
    else { ctx.fillStyle = '#080b0d'; ctx.fillRect(0, 0, camera.width, camera.height); }
    for (const r of [...layout.corridors, ...layout.zones]) {
      if (!camera.isVisible(r.x + r.w / 2, r.y + r.h / 2, Math.max(r.w, r.h))) continue;
      const [x,y] = camera.worldToScreen(r.x, r.y);
      const floor = 'floor' in r ? String(r.floor) : 'passage';
      const floorPaint = this.pattern(ctx, stage, floor);
      if (typeof floorPaint !== 'string') floorPaint.setTransform(new DOMMatrix().translate(-camera.x + camera.shakeX, -camera.y + camera.shakeY));
      ctx.fillStyle = floorPaint; ctx.fillRect(x,y,r.w,r.h);
      const zoneIndex = 'floor' in r ? layout.zones.findIndex(zone => zone === r)
        : -1 - layout.corridors.findIndex(corridor => corridor === r);
      this.staticFloorDetails(ctx, x, y, r.w, r.h, stage, floor, zoneIndex);
      this.groundDetails.drawBugs(ctx, camera, stage, zoneIndex, r, playerX, playerY, gameTime);
      if (stage.id === 1 && floor === 'road') {
        ctx.strokeStyle = 'rgba(209,194,148,.28)'; ctx.lineWidth = 4; ctx.setLineDash([28,24]);
        ctx.beginPath(); ctx.moveTo(x+30,y+r.h/2); ctx.lineTo(x+r.w-30,y+r.h/2); ctx.stroke(); ctx.setLineDash([]);
      }
      if (stage.id > 3) {
        ctx.strokeStyle = stage.id === 10 ? 'rgba(104,61,58,.45)' : 'rgba(18,23,24,.55)'; ctx.lineWidth = 2;
        ctx.strokeRect(x,y,r.w,r.h);
        ctx.strokeStyle = accents[stage.id-1]; ctx.globalAlpha = .16; ctx.lineWidth = 2;
        ctx.strokeRect(x+13,y+13,r.w-26,r.h-26); ctx.globalAlpha = 1;
      }
    }
    for (const prop of layout.decorations) {
      if (!camera.isVisible(prop.x+prop.w/2,prop.y+prop.h/2,Math.max(prop.w,prop.h))) continue;
      const [x,y] = camera.worldToScreen(prop.x,prop.y);
      this.prop(ctx,x,y,prop.w,prop.h,prop.kind,stage.id,prop.solid,prop.x,prop.y);
    }
    layout.gates.forEach((g,i) => {
      if (!camera.isVisible(g.x+g.w/2,g.y+g.h/2,160)) return;
      const [x,y] = camera.worldToScreen(g.x,g.y);
      const closed = isCampaignGateClosed(i);
      ctx.fillStyle = closed ? '#493431' : '#3c544b'; ctx.strokeStyle = closed ? '#d39175' : '#a3d0ae'; ctx.lineWidth = 4;
      if (closed) { ctx.fillRect(x,y,g.w,g.h); ctx.strokeRect(x,y,g.w,g.h); }
      else { ctx.fillRect(x-5,y-12,g.w+10,12); ctx.fillRect(x-5,y+g.h,g.w+10,12); }
      ctx.fillStyle = closed ? '#e2ae98' : '#b7dfbd'; ctx.font = 'bold 12px Segoe UI, Arial'; ctx.textAlign='center';
      ctx.fillText(closed ? 'KHÓA' : 'MỞ',x+g.w/2,y-20);
    });
    // Guidance follows the actual corridor sequence, not a straight line
    // through locked rooms or walls.
    const targetZone = Math.min(layout.zones.length-1,
      activeNode < stage.objectiveNodes.length ? this.zoneFor(stage.objectiveNodes[activeNode].x,stage.objectiveNodes[activeNode].y,stage) : layout.zones.length-1);
    for (let i=0;i<Math.min(targetZone,layout.gates.length);i++) {
      const g=layout.gates[i]; if (isCampaignGateClosed(i)) break;
      const [x,y]=camera.worldToScreen(g.x-85,g.y+g.h/2);
      ctx.strokeStyle='#b7b494'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(x-18,y-12);ctx.lineTo(x,y);ctx.lineTo(x-18,y+12);ctx.stroke();
      const a=layout.zones[i], b=layout.zones[i+1];
      const bendX=(a.x+a.w/2+b.x+b.w/2)/2;
      const bendY=((a.y+a.h/2)+(b.y+b.h/2))/2;
      if (Math.abs(a.y-b.y)>100 && camera.isVisible(bendX,bendY,80)) {
        const [turnX,turnY]=camera.worldToScreen(bendX,bendY);
        ctx.save();ctx.translate(turnX,turnY);ctx.rotate(b.y>a.y?Math.PI/2:-Math.PI/2);
        ctx.fillStyle='#b7b494';ctx.beginPath();ctx.moveTo(16,0);ctx.lineTo(-11,-10);ctx.lineTo(-5,0);ctx.lineTo(-11,10);ctx.closePath();ctx.fill();ctx.restore();
      }
    }
  }

  private zoneFor(x:number,y:number,stage:StageDef):number {
    return stage.layout!.zones.findIndex(z=>x>=z.x&&x<=z.x+z.w&&y>=z.y&&y<=z.y+z.h);
  }

  private drawAmbientBackdrop(ctx:CanvasRenderingContext2D,camera:Camera,stage:StageDef):void {
    // Flat underlay: location-specific details are baked into each world-space zone.
    ctx.fillStyle=stage.id===1?'#38413e':stage.id===2?'#625d51':'#6d7875';
    ctx.fillRect(0,0,camera.width,camera.height);
  }

  private staticFloorDetails(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,stage:StageDef,floor:string,zone:number):void {
    const id = stage.id;
    const key=`${id}:${floor}:${zone}:${Math.ceil(w)}:${Math.ceil(h)}`;
    let layer=this.zoneDetails.get(key);
    if(!layer){
      layer=document.createElement('canvas');layer.width=Math.ceil(w);layer.height=Math.ceil(h);
      const paint = layer.getContext('2d')!;
      if (zone >= 0) {
        if (id <= 3) this.paintFirstThreeFloorDetails(paint,0,0,w,h,id,floor,zone);
        else { this.zoneMarks(paint,0,0,w,h,id,zone); this.wear(paint,0,0,w,h,id,zone); }
      }
      this.groundDetails.paint(paint, stage, zone, w, h, floor);
      if (this.zoneDetails.size >= 12) this.zoneDetails.delete(this.zoneDetails.keys().next().value!);
      this.zoneDetails.set(key,layer);
    }
    ctx.drawImage(layer,x,y,w,h);
  }

  private paintFirstThreeFloorDetails(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,id:number,floor:string,zone:number):void {
    ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
    const cx=x+w/2,cy=y+h/2;
    if(id===1){
      if(floor==='road'){
        ctx.fillStyle='rgba(189,180,151,.27)';ctx.fillRect(x+12,y+14,w-24,34);ctx.fillRect(x+12,y+h-48,w-24,34);
        ctx.fillStyle='rgba(49,54,52,.35)';ctx.fillRect(x+12,y+44,w-24,6);ctx.fillRect(x+12,y+h-51,w-24,6);
        ctx.strokeStyle='rgba(221,207,163,.53)';ctx.lineWidth=4;ctx.setLineDash([34,25]);ctx.beginPath();ctx.moveTo(x+42,cy+((zone%2)?-48:42));ctx.lineTo(x+w-40,cy+((zone%2)?-48:42));ctx.stroke();ctx.setLineDash([]);
        const crosswalkX=zone%2?x+w*.68:x+w*.29;
        if(zone===0||zone===2){ctx.fillStyle='rgba(220,209,174,.37)';for(let k=0;k<6;k++)ctx.fillRect(crosswalkX+k*14,cy-50,8,100);}
        ctx.fillStyle='rgba(38,44,43,.18)';ctx.beginPath();ctx.ellipse(cx-80,cy+22,90,17,-.08,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='rgba(87,92,77,.36)';ctx.beginPath();ctx.ellipse(x+w*.16,cy+125,44,24,-.2,0,Math.PI*2);ctx.fill();
      }else if(floor==='yard'||floor==='rescue'){
        ctx.fillStyle='rgba(116,128,87,.36)';ctx.beginPath();ctx.moveTo(cx-320,cy-214);ctx.lineTo(cx-202,cy-242);ctx.lineTo(cx-147,cy-185);ctx.lineTo(cx-183,cy-106);ctx.lineTo(cx-303,cy-119);ctx.closePath();ctx.fill();
        ctx.fillStyle='rgba(175,164,127,.31)';ctx.beginPath();ctx.moveTo(cx+108,cy+80);ctx.lineTo(cx+240,cy+51);ctx.lineTo(cx+301,cy+119);ctx.lineTo(cx+260,cy+202);ctx.lineTo(cx+132,cy+188);ctx.closePath();ctx.fill();
        ctx.strokeStyle='rgba(67,73,57,.54)';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(cx+78,cy-114);ctx.lineTo(cx+60,cy-46);ctx.lineTo(cx+93,cy-8);ctx.moveTo(cx-262,cy+24);ctx.lineTo(cx-223,cy+56);ctx.lineTo(cx-239,cy+94);ctx.stroke();
        ctx.strokeStyle='rgba(204,189,143,.45)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(cx-89,cy-272);ctx.lineTo(cx-52,cy-242);ctx.lineTo(cx-8,cy-258);ctx.moveTo(cx+276,cy-25);ctx.lineTo(cx+316,cy-40);ctx.stroke();
      }else if(floor==='plaza'){
        ctx.fillStyle='rgba(180,165,126,.22)';ctx.beginPath();ctx.moveTo(cx-255,cy-190);ctx.lineTo(cx-135,cy-208);ctx.lineTo(cx-91,cy-139);ctx.lineTo(cx-143,cy-96);ctx.closePath();ctx.fill();
        ctx.strokeStyle='rgba(87,79,63,.52)';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x+125,y+80);ctx.lineTo(x+180,y+60);ctx.lineTo(x+215,y+86);ctx.moveTo(cx+120,cy-148);ctx.lineTo(cx+160,cy-96);ctx.lineTo(cx+202,cy-119);ctx.stroke();
        ctx.fillStyle='rgba(112,70,56,.42)';ctx.beginPath();ctx.ellipse(cx+185,cy+138,63,25,-.25,0,Math.PI*2);ctx.fill();
      }
    }else if(id===2){
      if(floor==='forecourt'){
        ctx.strokeStyle='rgba(231,190,111,.48)';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(cx-225,cy-160);ctx.lineTo(cx-130,cy-174);ctx.moveTo(cx+130,cy+155);ctx.lineTo(cx+238,cy+144);ctx.moveTo(cx+18,cy-194);ctx.lineTo(cx+111,cy-205);ctx.stroke();
        ctx.fillStyle='rgba(52,49,41,.34)';ctx.beginPath();ctx.moveTo(cx+82,cy+104);ctx.quadraticCurveTo(cx+102,cy+76,cx+148,cy+88);ctx.lineTo(cx+184,cy+119);ctx.lineTo(cx+157,cy+146);ctx.lineTo(cx+104,cy+140);ctx.closePath();ctx.fill();
        ctx.strokeStyle='rgba(34,34,30,.50)';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x+75,cy+40);ctx.quadraticCurveTo(x+144,cy+69,x+185,cy+43);ctx.moveTo(x+w-225,cy-8);ctx.lineTo(x+w-203,cy+26);ctx.lineTo(x+w-164,cy+39);ctx.stroke();
      }else if(floor==='oily'||floor==='garage'){
        ctx.fillStyle='rgba(35,34,30,.42)';ctx.beginPath();ctx.moveTo(cx-290,cy+185);ctx.quadraticCurveTo(cx-263,cy+145,cx-219,cy+171);ctx.lineTo(cx-191,cy+210);ctx.lineTo(cx-228,cy+236);ctx.lineTo(cx-280,cy+225);ctx.closePath();ctx.fill();
        ctx.strokeStyle='rgba(193,158,91,.54)';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(cx-135,cy+43);ctx.quadraticCurveTo(cx-66,cy+10,cx+2,cy+33);ctx.moveTo(cx+104,cy-179);ctx.quadraticCurveTo(cx+159,cy-206,cx+211,cy-164);ctx.stroke();
        ctx.strokeStyle='rgba(42,44,39,.5)';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(cx+245,cy+171);ctx.lineTo(cx+209,cy+125);ctx.lineTo(cx+219,cy+90);ctx.moveTo(cx-305,cy-112);ctx.lineTo(cx-274,cy-147);ctx.stroke();
      }else if(floor==='shop'){
        ctx.fillStyle='rgba(80,73,59,.35)';ctx.fillRect(x+54,y+42,w-108,36);ctx.fillRect(x+74,y+h-75,w-148,28);
        ctx.fillStyle='rgba(179,147,93,.28)';ctx.fillRect(x+66,y+48,82,21);ctx.fillRect(x+w-172,y+h-69,91,18);
        ctx.strokeStyle='rgba(41,45,42,.47)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(cx-214,cy-75);ctx.lineTo(cx-173,cy-46);ctx.lineTo(cx-181,cy-4);ctx.moveTo(cx+188,cy+36);ctx.lineTo(cx+151,cy+71);ctx.lineTo(cx+189,cy+99);ctx.stroke();
      }
    }else{
      if(floor==='parking'){
        ctx.strokeStyle='rgba(207,211,196,.52)';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x+80,y+100);ctx.lineTo(x+80,y+260);ctx.moveTo(x+110,y+100);ctx.lineTo(x+110,y+260);ctx.moveTo(x+w-280,y+70);ctx.lineTo(x+w-280,y+223);ctx.moveTo(x+w-250,y+70);ctx.lineTo(x+w-250,y+223);ctx.stroke();
        ctx.strokeStyle='rgba(119,62,57,.38)';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(cx+218,cy+132);ctx.lineTo(cx+261,cy+112);ctx.lineTo(cx+298,cy+128);ctx.stroke();
        ctx.fillStyle='rgba(90,102,96,.40)';ctx.beginPath();ctx.moveTo(cx-347,cy+202);ctx.lineTo(cx-295,cy+170);ctx.lineTo(cx-249,cy+198);ctx.lineTo(cx-277,cy+246);ctx.closePath();ctx.fill();
      }else if(floor==='canvas'){
        ctx.fillStyle='rgba(217,207,178,.28)';ctx.fillRect(x+34,y+25,w-68,30);ctx.fillRect(x+34,y+h-55,w-68,30);
        ctx.strokeStyle='rgba(106,99,80,.48)';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(cx-198,cy-90);ctx.quadraticCurveTo(cx-86,cy-130,cx+8,cy-88);ctx.moveTo(cx-12,cy+103);ctx.quadraticCurveTo(cx+78,cy+64,cx+205,cy+98);ctx.moveTo(cx-315,cy+223);ctx.lineTo(cx-290,cy+177);ctx.lineTo(cx-245,cy+168);ctx.stroke();
        ctx.strokeStyle='rgba(162,147,116,.42)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+48,y+86);ctx.lineTo(x+122,y+106);ctx.moveTo(x+w-168,y+h-106);ctx.lineTo(x+w-77,y+h-82);ctx.stroke();
      }else if(floor==='vinyl'||floor==='tile'){
        ctx.fillStyle='rgba(189,197,187,.22)';ctx.fillRect(x+35,y+38,w-70,24);ctx.fillRect(x+35,y+h-65,w-70,22);
        ctx.strokeStyle='rgba(215,219,203,.44)';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x+80,cy-150);ctx.lineTo(x+61,cy-18);ctx.lineTo(x+94,cy+12);ctx.moveTo(x+w-123,cy+72);ctx.lineTo(x+w-145,cy+161);ctx.moveTo(cx-210,cy+45);ctx.lineTo(cx-153,cy+19);ctx.lineTo(cx-125,cy+62);ctx.stroke();
        if(floor==='tile'&&zone===4){ctx.fillStyle='rgba(138,53,50,.37)';ctx.beginPath();ctx.moveTo(cx-85,cy-78);ctx.quadraticCurveTo(cx+45,cy-118,cx+144,cy-49);ctx.lineTo(cx+124,cy+13);ctx.quadraticCurveTo(cx+21,cy+39,cx-85,cy-78);ctx.fill();}
      }else{
        ctx.strokeStyle='rgba(203,210,196,.48)';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x+40,cy+((zone%2)?-70:60));ctx.lineTo(x+w-40,cy+((zone%2)?-70:60));ctx.stroke();
        ctx.strokeStyle='rgba(153,75,70,.43)';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(cx-165,cy-138);ctx.lineTo(cx-122,cy-76);ctx.lineTo(cx-160,cy-29);ctx.moveTo(cx+255,cy+136);ctx.lineTo(cx+212,cy+98);ctx.stroke();
      }
    }
    // Distinct, broad material cues are baked into this offscreen zone layer;
    // they break up flat floors without adding repetitive grids or dots.
    if(id===1&&floor==='road'){
      ctx.strokeStyle='rgba(203,196,164,.55)';ctx.lineWidth=7;ctx.beginPath();
      ctx.moveTo(x+10,cy-150);ctx.lineTo(x+w*.23,cy-143);ctx.quadraticCurveTo(x+w*.34,cy-132,x+w*.46,cy-146);
      ctx.moveTo(x+w*.59,cy+147);ctx.quadraticCurveTo(x+w*.72,cy+132,x+w*.83,cy+145);ctx.lineTo(x+w-10,cy+138);ctx.stroke();
      ctx.fillStyle='rgba(36,42,42,.25)';ctx.beginPath();ctx.moveTo(cx-260,cy-103);ctx.lineTo(cx-206,cy-124);ctx.lineTo(cx-146,cy-110);ctx.lineTo(cx-163,cy-83);ctx.lineTo(cx-235,cy-77);ctx.closePath();ctx.fill();
      ctx.fillStyle='rgba(111,110,91,.28)';ctx.beginPath();ctx.moveTo(cx+154,cy+93);ctx.lineTo(cx+221,cy+80);ctx.lineTo(cx+261,cy+101);ctx.lineTo(cx+238,cy+126);ctx.lineTo(cx+171,cy+120);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(46,51,49,.55)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(cx-18,cy+109);ctx.lineTo(cx+24,cy+109);ctx.moveTo(cx-18,cy+117);ctx.lineTo(cx+24,cy+117);ctx.moveTo(cx-18,cy+125);ctx.lineTo(cx+24,cy+125);ctx.stroke();
    }else if(id===1&&floor==='yard'){
      ctx.fillStyle='rgba(95,110,72,.24)';ctx.beginPath();ctx.moveTo(cx+120,cy-208);ctx.lineTo(cx+280,cy-225);ctx.lineTo(cx+327,cy-159);ctx.lineTo(cx+287,cy-102);ctx.lineTo(cx+151,cy-121);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(179,164,125,.48)';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(cx-58,cy+258);ctx.quadraticCurveTo(cx+38,cy+177,cx+165,cy+193);ctx.lineTo(cx+233,cy+164);ctx.stroke();
    }else if(id===1&&floor==='plaza'){
      ctx.fillStyle='rgba(168,157,127,.19)';ctx.beginPath();ctx.moveTo(cx-185,cy+177);ctx.lineTo(cx-87,cy+150);ctx.lineTo(cx-34,cy+193);ctx.lineTo(cx-76,cy+229);ctx.lineTo(cx-168,cy+216);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(91,82,65,.46)';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(cx+40,cy-251);ctx.lineTo(cx+76,cy-208);ctx.lineTo(cx+57,cy-169);ctx.moveTo(cx+266,cy+4);ctx.lineTo(cx+301,cy+25);ctx.lineTo(cx+276,cy+65);ctx.stroke();
    }else if(id===2&&floor==='forecourt'){
      ctx.fillStyle='rgba(203,164,89,.15)';ctx.beginPath();ctx.moveTo(cx-82,cy-118);ctx.lineTo(cx+76,cy-133);ctx.lineTo(cx+103,cy-78);ctx.lineTo(cx-59,cy-59);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(230,194,122,.55)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(cx-82,cy-118);ctx.lineTo(cx+76,cy-133);ctx.lineTo(cx+103,cy-78);ctx.lineTo(cx-59,cy-59);ctx.closePath();ctx.stroke();
      ctx.strokeStyle='rgba(225,190,113,.39)';ctx.lineWidth=4;ctx.setLineDash([39,22]);ctx.beginPath();ctx.moveTo(cx-335,cy+203);ctx.lineTo(cx-202,cy+184);ctx.moveTo(cx+204,cy+211);ctx.lineTo(cx+340,cy+189);ctx.stroke();ctx.setLineDash([]);
    }else if(id===2&&floor==='shop'){
      ctx.fillStyle='rgba(191,157,95,.16)';ctx.beginPath();ctx.moveTo(cx-125,cy-176);ctx.lineTo(cx+178,cy-192);ctx.lineTo(cx+198,cy-151);ctx.lineTo(cx-145,cy-133);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(48,47,42,.56)';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(cx-285,cy+173);ctx.lineTo(cx-240,cy+126);ctx.lineTo(cx-183,cy+139);ctx.moveTo(cx+212,cy-41);ctx.lineTo(cx+250,cy-79);ctx.lineTo(cx+289,cy-66);ctx.stroke();
    }else if(id===2&&(floor==='oily'||floor==='garage')){
      ctx.fillStyle='rgba(36,36,32,.30)';ctx.beginPath();ctx.moveTo(cx+17,cy-209);ctx.quadraticCurveTo(cx+112,cy-235,cx+169,cy-189);ctx.lineTo(cx+139,cy-154);ctx.lineTo(cx+48,cy-163);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(210,169,91,.36)';ctx.lineWidth=8;ctx.setLineDash([17,13]);ctx.beginPath();ctx.moveTo(cx-344,cy+15);ctx.lineTo(cx-260,cy+2);ctx.moveTo(cx+238,cy+221);ctx.lineTo(cx+347,cy+206);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle='rgba(34,35,31,.40)';ctx.beginPath();ctx.moveTo(cx+128,cy+37);ctx.quadraticCurveTo(cx+195,cy+3,cx+256,cy+31);ctx.lineTo(cx+291,cy+73);ctx.quadraticCurveTo(cx+264,cy+106,cx+210,cy+89);ctx.lineTo(cx+153,cy+111);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(201,168,101,.42)';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(cx+159,cy+54);ctx.quadraticCurveTo(cx+220,cy+24,cx+269,cy+53);ctx.stroke();
      ctx.strokeStyle='rgba(48,47,41,.44)';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(cx-55,cy+91);ctx.quadraticCurveTo(cx+8,cy+68,cx+59,cy+82);ctx.moveTo(cx-41,cy+108);ctx.quadraticCurveTo(cx+10,cy+88,cx+67,cy+101);ctx.stroke();
    }else if(id===3&&floor==='parking'){
      ctx.fillStyle='rgba(101,151,145,.15)';ctx.beginPath();ctx.moveTo(cx-382,cy-142);ctx.lineTo(cx-211,cy-163);ctx.lineTo(cx-182,cy-89);ctx.lineTo(cx-363,cy-67);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(163,198,185,.46)';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(cx-362,cy-132);ctx.lineTo(cx-222,cy-149);ctx.moveTo(cx-351,cy-82);ctx.lineTo(cx-195,cy-101);ctx.stroke();
      ctx.fillStyle='rgba(111,157,149,.14)';ctx.beginPath();ctx.moveTo(cx+88,cy-36);ctx.lineTo(cx+351,cy-54);ctx.lineTo(cx+373,cy+45);ctx.lineTo(cx+122,cy+68);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(180,205,190,.43)';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(cx+111,cy-29);ctx.lineTo(cx+338,cy-45);ctx.moveTo(cx+126,cy+54);ctx.lineTo(cx+361,cy+35);ctx.stroke();
      ctx.fillStyle='rgba(221,224,209,.48)';ctx.font='bold 15px Segoe UI, Arial';ctx.textAlign='center';ctx.fillText('TRIAGE  •  BAY 02',cx+230,cy+12);
      ctx.strokeStyle='rgba(119,62,57,.58)';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(cx+194,cy+111);ctx.quadraticCurveTo(cx+245,cy+86,cx+274,cy+104);ctx.lineTo(cx+310,cy+132);ctx.stroke();
      ctx.strokeStyle='rgba(74,86,82,.52)';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(cx-68,cy+130);ctx.lineTo(cx-22,cy+111);ctx.lineTo(cx+32,cy+122);ctx.moveTo(cx+68,cy-127);ctx.lineTo(cx+121,cy-145);ctx.lineTo(cx+156,cy-134);ctx.stroke();
    }else if(id===3&&floor==='canvas'){
      ctx.fillStyle='rgba(127,139,127,.19)';ctx.beginPath();ctx.moveTo(cx-315,cy-202);ctx.lineTo(cx-178,cy-229);ctx.lineTo(cx-109,cy-181);ctx.lineTo(cx-154,cy-117);ctx.lineTo(cx-294,cy-135);ctx.closePath();ctx.fill();
    }else if(id===3&&floor==='vinyl'){
      ctx.fillStyle='rgba(107,151,144,.12)';ctx.beginPath();ctx.moveTo(cx-205,cy-194);ctx.lineTo(cx+39,cy-216);ctx.lineTo(cx+92,cy-172);ctx.lineTo(cx-154,cy-147);ctx.closePath();ctx.fill();
      ctx.fillStyle='rgba(121,55,52,.25)';ctx.beginPath();ctx.moveTo(cx+118,cy+180);ctx.quadraticCurveTo(cx+193,cy+137,cx+256,cy+162);ctx.lineTo(cx+229,cy+197);ctx.lineTo(cx+145,cy+211);ctx.closePath();ctx.fill();
    }else if(id===3&&floor==='tile'){
      ctx.fillStyle='rgba(119,54,51,.35)';ctx.beginPath();ctx.moveTo(cx-138,cy-89);ctx.quadraticCurveTo(cx-58,cy-140,cx+29,cy-110);ctx.lineTo(cx+92,cy-50);ctx.quadraticCurveTo(cx+29,cy-5,cx-40,cy-38);ctx.lineTo(cx-129,cy-27);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(163,183,172,.42)';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(cx+212,cy-206);ctx.lineTo(cx+188,cy-157);ctx.lineTo(cx+231,cy-117);ctx.moveTo(cx-304,cy+114);ctx.lineTo(cx-263,cy+86);ctx.lineTo(cx-229,cy+103);ctx.stroke();
    }
    ctx.restore();
  }

  private pattern(ctx:CanvasRenderingContext2D,stage:StageDef,floor:string):CanvasPattern|string {
    if(stage.id<=3){
      const floors:Record<number,Record<string,string>>={
        1:{road:'#555d5c',yard:'#5a6151',plaza:'#746e5c',rescue:'#586358',passage:'#4b5550'},
        2:{oily:'#71654e',forecourt:'#857255',shop:'#817764',garage:'#766d58',passage:'#7b705a'},
        3:{parking:'#626e69',canvas:'#918874',vinyl:'#7b8882',tile:'#989d91',passage:'#87918a'},
      };
      return floors[stage.id][floor]??stage.floorColor;
    }
    const key=stage.id+':'+floor;
    const cached=this.patterns.get(key); if(cached) return cached;
    const c=document.createElement('canvas'); c.width=c.height=128; const p=c.getContext('2d')!;
    p.fillStyle=stage.floorColor; p.fillRect(0,0,128,128);
    const floorWash: Record<string,string> = {
      yard:'rgba(81,96,65,.25)',plaza:'rgba(167,158,126,.17)',rescue:'rgba(105,85,67,.20)',
      forecourt:'rgba(150,119,61,.20)',shop:'rgba(106,97,78,.24)',garage:'rgba(57,67,67,.25)',
      canvas:'rgba(159,149,123,.22)',vinyl:'rgba(116,144,143,.17)',tile:'rgba(180,176,154,.23)',
      water:'rgba(40,91,79,.34)',valve:'rgba(114,117,92,.23)',nest:'rgba(96,70,55,.28)',
      parking:'rgba(95,100,97,.18)',concrete:'rgba(108,111,100,.17)',arena:'rgba(107,94,73,.20)',
      food:'rgba(143,115,94,.23)',atrium:'rgba(147,126,134,.21)',stage:'rgba(101,72,89,.27)',
      gravel:'rgba(104,102,89,.19)',container:'rgba(93,103,109,.26)',rail:'rgba(83,90,87,.26)',control:'rgba(105,101,86,.25)',
      clean:'rgba(127,161,158,.19)',glass:'rgba(70,131,136,.24)',culture:'rgba(78,131,109,.26)',test:'rgba(71,116,123,.22)',
      rubble:'rgba(113,91,77,.20)',ash:'rgba(78,71,70,.28)',web:'rgba(105,85,82,.23)',
      flesh:'rgba(126,49,59,.28)',rib:'rgba(151,126,106,.18)',heart:'rgba(131,45,53,.36)',
    };
    p.fillStyle=floorWash[floor]??'rgba(0,0,0,.05)';p.fillRect(0,0,128,128);
    p.fillStyle=stage.id===10?'rgba(125,45,48,.10)':stage.id===8?'rgba(82,151,151,.09)':'rgba(180,165,130,.055)'; p.fillRect(0,0,128,128);
    const pattern=ctx.createPattern(c,'repeat');if(pattern){this.patterns.set(key,pattern);return pattern;}return stage.floorColor;
  }

  /** Broad floor landmarks read at actual combat zoom and never obstruct movement. */
  private zoneMarks(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,id:number,zone:number):void {
    ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
    const cx=x+w/2,cy=y+h/2;
    if(id===1){
      ctx.fillStyle='rgba(182,178,148,.11)';ctx.fillRect(x,y,w,45);ctx.fillRect(x,y+h-45,w,45);
      if(zone===1||zone===3){ctx.fillStyle='rgba(203,193,160,.19)';for(let k=0;k<6;k++)ctx.fillRect(cx-160+k*55,cy-125,34,64);}
    } else if(id===2){
      ctx.strokeStyle='rgba(210,175,105,.25)';ctx.lineWidth=5;
      for(let k=0;k<4;k++){ctx.strokeRect(x+55+k*(w-110)/4,y+78,(w-110)/5,h-156);}
      ctx.fillStyle='rgba(20,23,20,.16)';ctx.beginPath();ctx.ellipse(cx+75,cy-10,105,48,-.3,0,Math.PI*2);ctx.fill();
    } else if(id===3){
      ctx.fillStyle='rgba(205,192,173,.08)';ctx.fillRect(x+42,y+36,w-84,h-72);
      ctx.fillStyle='rgba(165,62,63,.18)';ctx.fillRect(cx-16,cy-108,32,216);ctx.fillRect(cx-108,cy-16,216,32);
      ctx.strokeStyle='rgba(170,183,177,.23)';ctx.lineWidth=4;for(let k=-1;k<=1;k++){ctx.beginPath();ctx.moveTo(cx+k*90,y);ctx.lineTo(cx+k*90,y+h);ctx.stroke();}
    } else if(id===4){
      ctx.fillStyle='rgba(34,76,67,.33)';ctx.fillRect(x,y+h*.32,w,h*.36);
      ctx.strokeStyle='rgba(162,174,146,.26)';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(x+18,y+h*.32);ctx.lineTo(x+w-18,y+h*.32);ctx.moveTo(x+18,y+h*.68);ctx.lineTo(x+w-18,y+h*.68);ctx.stroke();
      ctx.strokeStyle='rgba(115,156,135,.24)';ctx.lineWidth=3;for(let k=0;k<7;k++){ctx.beginPath();ctx.arc(x+60+k*125,cy,22,0,Math.PI);ctx.stroke();}
    } else if(id===5){
      ctx.fillStyle='rgba(191,159,96,.13)';ctx.fillRect(x+35,y+35,w-70,58);ctx.fillRect(x+35,y+h-93,w-70,58);
      ctx.strokeStyle='rgba(203,180,119,.29)';ctx.lineWidth=4;ctx.setLineDash([28,16]);ctx.strokeRect(x+72,y+98,w-144,h-196);ctx.setLineDash([]);
      ctx.fillStyle='rgba(204,194,154,.15)';ctx.font='bold 65px Segoe UI, Arial';ctx.textAlign='center';ctx.fillText(`0${zone+1}`,cx,cy+22);
    } else if(id===6){
      ctx.strokeStyle='rgba(211,193,187,.22)';ctx.lineWidth=13;ctx.strokeRect(x+46,y+42,w-92,h-84);
      ctx.strokeStyle='rgba(190,162,170,.14)';ctx.lineWidth=3;
      ctx.beginPath();ctx.moveTo(x+92,cy-25);ctx.lineTo(cx-80,cy-30);
      ctx.moveTo(cx+115,cy+77);ctx.lineTo(x+w-110,cy+81);ctx.stroke();
      if(zone===3||zone===4){ctx.beginPath();ctx.ellipse(cx,cy,175,122,0,0,Math.PI*2);ctx.stroke();}
    } else if(id===7){
      ctx.strokeStyle='rgba(170,155,123,.35)';ctx.lineWidth=8;for(const py of [cy-96,cy+96]){ctx.beginPath();ctx.moveTo(x,py);ctx.lineTo(x+w,py);ctx.stroke();}
      ctx.fillStyle='rgba(95,80,64,.27)';for(let k=0;k<18;k++)ctx.fillRect(x+35+k*55,cy-113,13,226);
    } else if(id===8){
      ctx.strokeStyle='rgba(137,209,204,.22)';ctx.lineWidth=5;ctx.strokeRect(x+55,y+50,w-110,h-100);
      ctx.strokeStyle='rgba(94,155,157,.20)';ctx.lineWidth=3;ctx.setLineDash([24,14]);ctx.strokeRect(cx-155,cy-120,310,240);ctx.setLineDash([]);
      ctx.fillStyle='rgba(138,214,204,.14)';ctx.fillRect(cx-16,cy-175,32,350);
    } else if(id===9){
      ctx.strokeStyle='rgba(196,107,92,.28)';ctx.lineWidth=9;ctx.setLineDash([34,19]);ctx.strokeRect(x+62,y+55,w-124,h-110);ctx.setLineDash([]);
      ctx.beginPath();ctx.moveTo(cx-130,cy-95);ctx.lineTo(cx+130,cy+95);ctx.moveTo(cx+130,cy-95);ctx.lineTo(cx-130,cy+95);ctx.stroke();
    } else if(id===10){
      ctx.strokeStyle='rgba(152,73,71,.35)';ctx.lineCap='round';
      for(let k=-2;k<=2;k++){ctx.lineWidth=9+Math.abs(k)*3;ctx.beginPath();ctx.moveTo(x,cy+k*90);ctx.bezierCurveTo(cx-160,cy+k*65,cx+100,cy-k*65,x+w,cy-k*90);ctx.stroke();}
      ctx.fillStyle='rgba(156,66,69,.15)';ctx.beginPath();ctx.ellipse(cx,cy,170,112,0,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }

  private wear(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,id:number,zone:number):void {
    ctx.save(); ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
    if (id === 10) {
      ctx.strokeStyle = 'rgba(145,68,64,.21)'; ctx.lineCap='round';
      for (let k=0;k<8;k++) {
        const sx=x+35+((zone*91+k*137)%Math.max(140,w-100));
        const sy=y+20+((zone*57+k*109)%Math.max(120,h-90));
        ctx.lineWidth=3+(k%3)*2;ctx.beginPath();ctx.moveTo(sx,sy);
        ctx.bezierCurveTo(sx+45,sy-32,sx+78,sy+52,sx+155,sy+28);ctx.stroke();
      }
    }
    const stain = id===10?'rgba(111,38,42,.20)':id===4?'rgba(73,124,98,.12)':id===8?'rgba(117,168,166,.11)':'rgba(15,17,18,.13)';
    for(let k=0;k<11;k++){
      const sx=x+70+((id*97+zone*47+k*139)%Math.max(140,w-140));
      const sy=y+55+((id*41+zone*111+k*83)%Math.max(110,h-110));
      ctx.strokeStyle=stain;ctx.lineWidth=2+(k%3);
      ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(sx+14+(k%4)*9,sy-8+(k%5)*5);ctx.lineTo(sx+24+(k%3)*10,sy+4+(k%3)*7);ctx.stroke();
      if(k%3===0){ctx.fillStyle=stain;ctx.beginPath();ctx.ellipse(sx+18,sy+13,17+(k%4)*6,5+(k%3)*3,.2,0,Math.PI*2);ctx.fill();}
    }
    ctx.restore();
  }

  private prop(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,kind:string,id:number,solid:boolean,worldX:number,worldY:number):void {
    ctx.save(); ctx.fillStyle='rgba(0,0,0,.22)';
    if(solid){ctx.beginPath();ctx.roundRect(x+8,y+9,w,h,Math.min(18,Math.min(w,h)*.16));ctx.fill();}
    if (kind === 'statue') {
      const stone = id === 6 ? '#30373a' : '#35302d';
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath();
      ctx.ellipse(x+w*.55,y+h*.83,w*.48,h*.22,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#24292a'; ctx.strokeStyle = '#a6a9a0'; ctx.lineWidth = 2;
      ctx.fillRect(x+5,y+h*.59,w-10,h*.27); ctx.strokeRect(x+5,y+h*.59,w-10,h*.27);
      ctx.fillStyle = stone; ctx.strokeStyle = '#77807d';
      ctx.beginPath(); ctx.moveTo(x+w*.26,y+h*.56); ctx.lineTo(x+w*.19,y+h*.21);
      ctx.lineTo(x+w*.39,y+h*.09); ctx.lineTo(x+w*.55,y+h*.19);
      ctx.lineTo(x+w*.7,y+h*.11); ctx.lineTo(x+w*.79,y+h*.55); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#545b57'; ctx.fillRect(x+w*.23,y+h*.56,w*.54,h*.08);
      ctx.strokeStyle = '#a6aba2'; ctx.lineWidth = 1.5; ctx.beginPath();
      ctx.moveTo(x+w*.3,y+h*.22); ctx.lineTo(x+w*.44,y+h*.18);
      ctx.moveTo(x+w*.29,y+h*.63); ctx.lineTo(x+w*.68,y+h*.63); ctx.stroke();
      ctx.restore(); return;
    }
    const metal=['#4a5556','#6d5946','#8b9185','#526c61','#676b55','#777078','#6a6e70','#687d7c','#6d5b56','#684344'][id-1];
    ctx.fillStyle=metal;ctx.strokeStyle='#15191a';ctx.lineWidth=4;
    if(id===1&&['streetlight','gardenlamp','trafficcone','mailbox','tree','shrub','roadSign','roadcrack','wire','radio','rescuevan','barrier','debris','yarddebris','ambush','bloodstain','brokenFence','porchsteps','gardenpatch','trash'].includes(kind)){
      if(kind==='streetlight'||kind==='gardenlamp'){
        ctx.strokeStyle='#343837';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(x+w*.52,y+h);ctx.lineTo(x+w*.48,y+h*.28);ctx.lineTo(x+w*.82,y+h*.2);ctx.stroke();
        ctx.fillStyle='#d6ad61';ctx.beginPath();ctx.arc(x+w*.82,y+h*.2,8,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(224,178,91,.18)';ctx.beginPath();ctx.ellipse(x+w*.76,y+h*.26,24,13,-.2,0,Math.PI*2);ctx.fill();
      }else if(kind==='trafficcone'){
        ctx.fillStyle='#b96f37';ctx.beginPath();ctx.moveTo(x+w*.5,y+3);ctx.lineTo(x+w*.84,y+h-5);ctx.lineTo(x+w*.16,y+h-5);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#d7c6a0';ctx.fillRect(x+w*.28,y+h*.61,w*.44,5);
      }else if(kind==='mailbox'){
        ctx.fillStyle='#6f5140';ctx.fillRect(x+w*.36,y+h*.36,w*.48,h*.44);ctx.strokeRect(x+w*.36,y+h*.36,w*.48,h*.44);ctx.fillStyle='#aa6b45';ctx.fillRect(x+w*.28,y+h*.2,w*.56,h*.31);ctx.strokeRect(x+w*.28,y+h*.2,w*.56,h*.31);ctx.fillStyle='#d2b98f';ctx.fillRect(x+w*.61,y+h*.34,w*.12,4);
      }else if(kind==='tree'){
        ctx.fillStyle='rgba(0,0,0,.28)';ctx.beginPath();ctx.ellipse(x+w*.55,y+h*.66,w*.49,h*.29,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#66644e';ctx.fillRect(x+w*.43,y+h*.43,w*.18,h*.5);ctx.fillStyle='#707454';ctx.beginPath();ctx.ellipse(x+w*.47,y+h*.38,w*.43,h*.36,-.2,0,Math.PI*2);ctx.ellipse(x+w*.7,y+h*.28,w*.28,h*.27,.3,0,Math.PI*2);ctx.fill();
      }else if(kind==='shrub'){
        ctx.fillStyle='rgba(0,0,0,.34)';ctx.beginPath();ctx.ellipse(x+w*.53,y+h*.73,w*.45,h*.23,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#384b3f';ctx.strokeStyle='#28382f';ctx.lineWidth=3;
        for(const [px,py,rx,ry] of [[.28,.57,.22,.25],[.47,.42,.25,.29],[.7,.52,.24,.27],[.52,.67,.34,.19]]){
          ctx.beginPath();ctx.ellipse(x+w*px,y+h*py,w*rx,h*ry,-.12,0,Math.PI*2);ctx.fill();ctx.stroke();
        }
        ctx.strokeStyle='#718267';ctx.lineWidth=2;ctx.beginPath();
        ctx.moveTo(x+w*.19,y+h*.5);ctx.lineTo(x+w*.29,y+h*.44);
        ctx.moveTo(x+w*.42,y+h*.34);ctx.lineTo(x+w*.53,y+h*.29);
        ctx.moveTo(x+w*.67,y+h*.43);ctx.lineTo(x+w*.77,y+h*.48);ctx.stroke();
      }else if(kind==='bloodstain'){
        const angle=Math.sin(worldX*.013+worldY*.021)*.42;
        ctx.save();ctx.translate(x+w*.5,y+h*.5);ctx.rotate(angle);
        ctx.lineCap='round';ctx.lineJoin='round';
        ctx.strokeStyle='rgba(36,7,12,.35)';ctx.lineWidth=h*.66;ctx.beginPath();ctx.moveTo(-w*.48,-h*.02);ctx.bezierCurveTo(-w*.2,-h*.42,w*.13,h*.4,w*.47,-h*.08);ctx.stroke();
        ctx.fillStyle='rgba(72,10,18,.52)';ctx.beginPath();ctx.moveTo(-w*.43,-h*.1);ctx.bezierCurveTo(-w*.3,-h*.44,-w*.12,-h*.17,w*.02,-h*.31);ctx.bezierCurveTo(w*.2,-h*.45,w*.31,-h*.08,w*.46,-h*.14);ctx.bezierCurveTo(w*.54,h*.05,w*.31,h*.33,w*.16,h*.19);ctx.bezierCurveTo(-w*.03,h*.44,-w*.13,h*.1,-w*.28,h*.27);ctx.bezierCurveTo(-w*.42,h*.29,-w*.5,h*.08,-w*.43,-h*.1);ctx.closePath();ctx.fill();
        ctx.fillStyle='rgba(121,20,28,.37)';ctx.beginPath();ctx.moveTo(-w*.29,-h*.06);ctx.bezierCurveTo(-w*.14,-h*.26,w*.03,-h*.05,w*.15,-h*.18);ctx.bezierCurveTo(w*.31,-h*.3,w*.36,-h*.02,w*.26,h*.1);ctx.bezierCurveTo(w*.09,h*.25,-w*.04,h*.01,-w*.16,h*.17);ctx.closePath();ctx.fill();
        ctx.strokeStyle='rgba(46,7,13,.39)';ctx.lineWidth=Math.max(2,h*.11);ctx.beginPath();ctx.moveTo(-w*.32,h*.06);ctx.bezierCurveTo(-w*.06,-h*.13,w*.12,h*.19,w*.4,h*.01);ctx.stroke();
        for(let d=0;d<9;d++){
          const a=d*2.399,spread=.28+(d%4)*.14,px=Math.cos(a)*w*spread,py=Math.sin(a)*h*(.48+(d%3)*.1);
          const radius=Math.max(1.5,h*(.025+(d%3)*.012));
          ctx.fillStyle=d%4===0?'rgba(119,20,28,.48)':'rgba(42,7,13,.43)';
          ctx.beginPath();ctx.ellipse(px,py,radius*1.6,radius*.62,a,0,Math.PI*2);ctx.fill();
        }
        ctx.restore();
      }else if(kind==='brokenFence'){
        ctx.strokeStyle='#695e4b';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(x+w*.08,y+h*.17);ctx.lineTo(x+w*.42,y+h*.39);ctx.lineTo(x+w*.91,y+h*.23);ctx.moveTo(x+w*.12,y+h*.57);ctx.lineTo(x+w*.54,y+h*.69);ctx.lineTo(x+w*.86,y+h*.56);ctx.stroke();ctx.strokeStyle='#b49c70';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x+w*.28,y+h*.08);ctx.lineTo(x+w*.35,y+h*.83);ctx.moveTo(x+w*.73,y+h*.14);ctx.lineTo(x+w*.67,y+h*.72);ctx.stroke();
      }else if(kind==='porchsteps'){
        ctx.fillStyle='#8c8270';ctx.strokeStyle='#4b4e48';ctx.lineWidth=3;for(let k=0;k<4;k++){ctx.fillRect(x+w*.12+k*3,y+h*.16+k*h*.18,w*.76-k*6,h*.12);ctx.strokeRect(x+w*.12+k*3,y+h*.16+k*h*.18,w*.76-k*6,h*.12);}
      }else if(kind==='gardenpatch'){
        ctx.fillStyle='#6f7652';ctx.beginPath();ctx.moveTo(x+w*.07,y+h*.27);ctx.lineTo(x+w*.37,y+h*.12);ctx.lineTo(x+w*.88,y+h*.24);ctx.lineTo(x+w*.78,y+h*.76);ctx.lineTo(x+w*.32,y+h*.88);ctx.lineTo(x+w*.12,y+h*.65);ctx.closePath();ctx.fill();ctx.strokeStyle='#95855f';ctx.lineWidth=3;ctx.stroke();ctx.strokeStyle='#9ca071';ctx.lineWidth=2;for(let k=0;k<5;k++){const px=x+w*(.2+k*.13);ctx.beginPath();ctx.moveTo(px,y+h*.55);ctx.lineTo(px-6,y+h*.36);ctx.moveTo(px,y+h*.55);ctx.lineTo(px+8,y+h*.33);ctx.stroke();}
      }else if(kind==='trash'){
        ctx.fillStyle='#5a574c';ctx.beginPath();ctx.moveTo(x+w*.12,y+h*.75);ctx.lineTo(x+w*.2,y+h*.32);ctx.lineTo(x+w*.79,y+h*.26);ctx.lineTo(x+w*.9,y+h*.7);ctx.closePath();ctx.fill();ctx.strokeRect(x+w*.12,y+h*.34,w*.77,h*.4);ctx.fillStyle='#9a8d69';ctx.fillRect(x+w*.27,y+h*.44,w*.13,h*.2);ctx.fillStyle='#a24f45';ctx.fillRect(x+w*.61,y+h*.46,w*.13,h*.13);
      }else if(kind==='roadSign'){
        ctx.strokeStyle='#424441';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(x+w*.5,y+h);ctx.lineTo(x+w*.5,y+h*.25);ctx.stroke();ctx.fillStyle='#6a5744';ctx.fillRect(x+w*.12,y+h*.05,w*.76,h*.43);ctx.strokeRect(x+w*.12,y+h*.05,w*.76,h*.43);ctx.fillStyle='#ddc68c';ctx.font='bold 12px Segoe UI, Arial';ctx.textAlign='center';ctx.fillText('STOP',x+w*.5,y+h*.34);
      }else if(kind==='radio'){
        ctx.fillStyle='#48514e';ctx.fillRect(x+w*.17,y+h*.35,w*.56,h*.55);ctx.strokeRect(x+w*.17,y+h*.35,w*.56,h*.55);ctx.fillStyle='#b7965d';ctx.fillRect(x+w*.25,y+h*.43,w*.39,h*.13);ctx.strokeStyle='#333b39';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+w*.56,y+h*.35);ctx.lineTo(x+w*.77,y+4);ctx.moveTo(x+w*.2,y+h*.62);ctx.lineTo(x+w*.69,y+h*.62);ctx.stroke();ctx.fillStyle='#b55748';ctx.beginPath();ctx.arc(x+w*.69,y+h*.77,4,0,Math.PI*2);ctx.fill();
      }else if(kind==='rescuevan'){
        this.drawVehicle(ctx,x,y,w,h,'ambulance');
      }else if(kind==='wire'){
        ctx.strokeStyle='#3c3934';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x,y+h*.8);ctx.bezierCurveTo(x+w*.25,y-h*.2,x+w*.55,y+h*1.2,x+w,y+h*.22);ctx.stroke();ctx.fillStyle='#6b6051';ctx.fillRect(x+w*.2,y+h*.64,7,h*.36);ctx.fillRect(x+w*.72,y+h*.5,7,h*.5);
      }else if(kind==='roadcrack'||kind==='debris'||kind==='yarddebris'){
        ctx.strokeStyle='#383b38';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x+w*.06,y+h*.23);ctx.lineTo(x+w*.4,y+h*.47);ctx.lineTo(x+w*.5,y+h*.27);ctx.lineTo(x+w*.78,y+h*.68);ctx.lineTo(x+w*.96,y+h*.51);ctx.stroke();ctx.fillStyle='#aba28a';ctx.fillRect(x+w*.56,y+h*.58,Math.max(8,w*.18),Math.max(6,h*.18));
      }else if(kind==='barrier'||kind==='barricade'){
        ctx.fillStyle='#675b45';ctx.fillRect(x,y+h*.28,w,h*.44);ctx.strokeRect(x,y+h*.28,w,h*.44);ctx.fillStyle='#d5bb75';for(let k=0;k<4;k++)ctx.fillRect(x+7+k*w*.24,y+h*.34,w*.1,h*.29);
      }else{
        ctx.fillStyle='#5d4840';ctx.fillRect(x+w*.12,y+h*.45,w*.72,h*.36);ctx.strokeRect(x+w*.12,y+h*.45,w*.72,h*.36);ctx.fillStyle='#9b7856';ctx.fillRect(x+w*.23,y+h*.22,w*.48,h*.3);
      }
    }else if(id===2&&['canopy','shopfront','fuelhose','oilspill','tire','barrel','workbench','toolcart','cooler','shelf','brokenGlass','sign','roadDebris','trash','pallet','bollard','barrier','lightbar'].includes(kind)){
      if(kind==='canopy'){
        ctx.fillStyle='rgba(21,24,22,.2)';ctx.fillRect(x+10,y+h*.3,w-2,h*.57);ctx.fillStyle='#746b53';ctx.fillRect(x+4,y+12,w-8,h*.37);ctx.strokeStyle='#303632';ctx.lineWidth=5;ctx.strokeRect(x+4,y+12,w-8,h*.37);ctx.fillStyle='#c49249';for(let k=0;k<5;k++)ctx.fillRect(x+12+k*(w-26)/5,y+18,(w-26)/10,h*.25);ctx.fillStyle='#e0c684';ctx.fillRect(x+12,y+h*.31,w-24,8);
        ctx.fillStyle='#3e4440';for(const px of [x+14,x+w*.49,x+w-23]){ctx.fillRect(px,y+h*.39,10,h*.57);ctx.fillStyle='#aa8f59';ctx.fillRect(px-4,y+h*.39,18,7);ctx.fillStyle='#3e4440';}
        ctx.fillStyle='#c4a35f';ctx.font='bold 12px Segoe UI, Arial';ctx.textAlign='center';ctx.fillText('GAS  /  24',x+w*.5,y+h*.27);
      }else if(kind==='shopfront'){
        ctx.fillStyle='#554b3d';ctx.fillRect(x+4,y+7,w-8,h-14);ctx.strokeStyle='#282d2a';ctx.lineWidth=4;ctx.strokeRect(x+4,y+7,w-8,h-14);
        ctx.fillStyle='#b97643';ctx.fillRect(x+11,y+11,w-22,h*.2);ctx.fillStyle='#d1a15c';ctx.fillRect(x+13,y+13,w-26,5);ctx.fillStyle='#303a39';ctx.fillRect(x+12,y+h*.27,w-24,h*.44);
        ctx.fillStyle='rgba(136,176,169,.55)';ctx.fillRect(x+20,y+h*.3,w*.36,h*.32);ctx.fillRect(x+w*.62,y+h*.3,w*.27,h*.32);ctx.strokeStyle='#242b29';ctx.lineWidth=3;ctx.strokeRect(x+20,y+h*.3,w*.36,h*.32);ctx.strokeRect(x+w*.62,y+h*.3,w*.27,h*.32);
        ctx.fillStyle='#837150';for(let k=0;k<3;k++){const sx=x+w*(.19+k*.25);ctx.fillRect(sx,y+h*.7,w*.17,h*.12);ctx.fillStyle='#b99d69';ctx.fillRect(sx+3,y+h*.72,w*.11,4);ctx.fillStyle='#837150';}
        ctx.strokeStyle='#c7c5b1';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+w*.49,y+h*.29);ctx.lineTo(x+w*.55,y+h*.46);ctx.lineTo(x+w*.5,y+h*.59);ctx.stroke();ctx.fillStyle='#222725';ctx.fillRect(x+w*.42,y+h*.79,w*.18,h*.15);
      }else if(kind==='fuelhose'){
        ctx.strokeStyle='#202624';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(x+w*.1,y+h*.15);ctx.bezierCurveTo(x+w*.96,y+h*.1,x+w*.93,y+h*.91,x+w*.37,y+h*.78);ctx.stroke();ctx.strokeStyle='#c1a464';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+w*.12,y+h*.19);ctx.bezierCurveTo(x+w*.9,y+h*.13,x+w*.87,y+h*.83,x+w*.37,y+h*.74);ctx.stroke();
      }else if(kind==='oilspill'){
        ctx.fillStyle='rgba(30,31,27,.58)';ctx.beginPath();ctx.moveTo(x+w*.08,y+h*.55);ctx.lineTo(x+w*.19,y+h*.25);ctx.lineTo(x+w*.44,y+h*.14);ctx.lineTo(x+w*.63,y+h*.29);ctx.lineTo(x+w*.91,y+h*.23);ctx.lineTo(x+w*.94,y+h*.57);ctx.lineTo(x+w*.72,y+h*.83);ctx.lineTo(x+w*.44,y+h*.77);ctx.lineTo(x+w*.23,y+h*.91);ctx.closePath();ctx.fill();ctx.strokeStyle='rgba(203,176,111,.48)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+w*.21,y+h*.51);ctx.lineTo(x+w*.38,y+h*.35);ctx.lineTo(x+w*.57,y+h*.42);ctx.stroke();
      }else if(kind==='tire'){
        ctx.fillStyle='#292d2c';ctx.beginPath();ctx.ellipse(x+w*.5,y+h*.5,w*.47,h*.45,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#737369';ctx.lineWidth=5;ctx.stroke();ctx.fillStyle='#858174';ctx.beginPath();ctx.ellipse(x+w*.5,y+h*.5,w*.2,h*.19,0,0,Math.PI*2);ctx.fill();
      }else if(kind==='barrel'){
        ctx.fillStyle='#795b3d';ctx.fillRect(x+w*.18,y+h*.08,w*.64,h*.84);ctx.strokeRect(x+w*.18,y+h*.08,w*.64,h*.84);ctx.strokeStyle='#b09a70';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x+w*.2,y+h*.3);ctx.lineTo(x+w*.8,y+h*.3);ctx.moveTo(x+w*.2,y+h*.72);ctx.lineTo(x+w*.8,y+h*.72);ctx.stroke();
      }else if(kind==='workbench'||kind==='toolcart'){
        ctx.fillStyle='#66543d';ctx.fillRect(x+3,y+h*.18,w-6,h*.32);ctx.strokeRect(x+3,y+h*.18,w-6,h*.32);ctx.fillStyle='#373b38';ctx.fillRect(x+w*.12,y+h*.5,w*.13,h*.46);ctx.fillRect(x+w*.75,y+h*.5,w*.13,h*.46);ctx.strokeStyle='#c09c58';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+w*.18,y+h*.16);ctx.lineTo(x+w*.35,y+4);ctx.moveTo(x+w*.58,y+h*.16);ctx.lineTo(x+w*.8,y+h*.06);ctx.stroke();
      }else if(kind==='cooler'||kind==='shelf'){
        ctx.fillStyle=kind==='cooler'?'#58625b':'#514d42';ctx.fillRect(x+4,y+5,w-8,h-10);ctx.strokeRect(x+4,y+5,w-8,h-10);ctx.strokeStyle='#b8aa87';ctx.lineWidth=3;for(let k=1;k<4;k++){const yy=y+k*h/4;ctx.beginPath();ctx.moveTo(x+8,yy);ctx.lineTo(x+w-8,yy);ctx.stroke();}if(kind==='cooler'){ctx.fillStyle='rgba(157,184,173,.38)';ctx.fillRect(x+9,y+9,w-18,h-18);}
      }else if(kind==='brokenGlass'){
        ctx.fillStyle='rgba(179,198,191,.25)';ctx.beginPath();ctx.moveTo(x+w*.1,y+h*.8);ctx.lineTo(x+w*.26,y+h*.12);ctx.lineTo(x+w*.47,y+h*.55);ctx.lineTo(x+w*.72,y+h*.08);ctx.lineTo(x+w*.92,y+h*.78);ctx.closePath();ctx.fill();ctx.strokeStyle='#bdc5b2';ctx.lineWidth=2;ctx.stroke();
      }else if(kind==='roadDebris'||kind==='trash'){
        ctx.fillStyle=kind==='trash'?'#69614f':'#4d514d';ctx.beginPath();ctx.moveTo(x+w*.08,y+h*.62);ctx.lineTo(x+w*.32,y+h*.16);ctx.lineTo(x+w*.48,y+h*.53);ctx.lineTo(x+w*.8,y+h*.25);ctx.lineTo(x+w*.92,y+h*.74);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#b39a67';ctx.fillRect(x+w*.54,y+h*.57,w*.2,Math.max(5,h*.11));
      }else if(kind==='pallet'){
        ctx.fillStyle='#775c3e';ctx.fillRect(x+w*.09,y+h*.16,w*.82,h*.68);ctx.strokeRect(x+w*.09,y+h*.16,w*.82,h*.68);ctx.strokeStyle='#bd9d69';ctx.lineWidth=4;for(let k=1;k<4;k++){ctx.beginPath();ctx.moveTo(x+w*(.1+k*.2),y+h*.17);ctx.lineTo(x+w*(.1+k*.2),y+h*.82);ctx.stroke();}ctx.fillStyle='#363a35';ctx.fillRect(x+w*.17,y+h*.76,w*.66,h*.13);
      }else if(kind==='bollard'){
        ctx.fillStyle='#3e4541';ctx.beginPath();ctx.ellipse(x+w*.5,y+h*.54,w*.33,h*.37,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#252a27';ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#c09b56';ctx.fillRect(x+w*.39,y+h*.29,w*.22,h*.2);ctx.fillStyle='#77786b';ctx.beginPath();ctx.ellipse(x+w*.5,y+h*.3,w*.2,h*.1,0,0,Math.PI*2);ctx.fill();
      }else if(kind==='barrier'){
        ctx.fillStyle='#4e514a';ctx.beginPath();ctx.moveTo(x+w*.07,y+h*.38);ctx.lineTo(x+w*.2,y+h*.19);ctx.lineTo(x+w*.8,y+h*.19);ctx.lineTo(x+w*.94,y+h*.38);ctx.lineTo(x+w*.84,y+h*.74);ctx.lineTo(x+w*.16,y+h*.74);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#d2aa5c';ctx.beginPath();ctx.moveTo(x+w*.15,y+h*.43);ctx.lineTo(x+w*.31,y+h*.27);ctx.lineTo(x+w*.43,y+h*.27);ctx.lineTo(x+w*.28,y+h*.46);ctx.moveTo(x+w*.53,y+h*.46);ctx.lineTo(x+w*.69,y+h*.27);ctx.lineTo(x+w*.82,y+h*.27);ctx.lineTo(x+w*.67,y+h*.46);ctx.fill();
      }else if(kind==='lightbar'){
        ctx.fillStyle='#353c3a';ctx.fillRect(x+w*.12,y+h*.35,w*.76,h*.31);ctx.strokeRect(x+w*.12,y+h*.35,w*.76,h*.31);ctx.fillStyle='#b95746';ctx.fillRect(x+w*.2,y+h*.4,w*.26,h*.2);ctx.fillStyle='#7b9c9c';ctx.fillRect(x+w*.53,y+h*.4,w*.26,h*.2);
      }else{
        ctx.fillStyle='#835b39';ctx.fillRect(x+5,y+6,w-10,h*.53);ctx.strokeRect(x+5,y+6,w-10,h*.53);ctx.fillStyle='#dbb767';ctx.font='bold 12px Segoe UI, Arial';ctx.textAlign='center';ctx.fillText('OPEN 24H',x+w/2,y+h*.42);
      }
    }else if(id===3&&['generator','medicalSign','lightbar','gurney','curtain','supplyCrate','examLamp','chair','divider','oxygen','wetfloor','medicalCart','cabinet','monitor','instrument','waste','surgery','tent'].includes(kind)){
      if(kind==='tent'){
        ctx.fillStyle='#c3b899';ctx.beginPath();ctx.moveTo(x+w*.5,y+3);ctx.lineTo(x+w-4,y+h*.25);ctx.lineTo(x+w*.84,y+h-4);ctx.lineTo(x+w*.16,y+h-4);ctx.lineTo(x+4,y+h*.25);ctx.closePath();ctx.fill();ctx.strokeStyle='#555b55';ctx.lineWidth=4;ctx.stroke();ctx.strokeStyle='#8f4e48';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+w*.5,y+7);ctx.lineTo(x+w*.5,y+h*.83);ctx.stroke();
      }else if(kind==='generator'){
        ctx.fillStyle='#58605a';ctx.fillRect(x+4,y+8,w-8,h-16);ctx.strokeRect(x+4,y+8,w-8,h-16);ctx.fillStyle='#363d39';ctx.fillRect(x+w*.16,y+h*.24,w*.42,h*.48);ctx.fillStyle='#b94e46';ctx.beginPath();ctx.arc(x+w*.77,y+h*.45,6,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#b7a986';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x+w*.77,y+h*.52);ctx.lineTo(x+w*.77,y+h*.83);ctx.stroke();
      }else if(kind==='medicalSign'){
        ctx.fillStyle='#dedbd0';ctx.fillRect(x+3,y+4,w-6,h*.7);ctx.strokeRect(x+3,y+4,w-6,h*.7);ctx.fillStyle='#9e4f4b';ctx.fillRect(x+w*.46,y+h*.17,w*.12,h*.42);ctx.fillRect(x+w*.31,y+h*.31,w*.42,h*.13);ctx.fillStyle='#464d4b';ctx.fillRect(x+w*.46,y+h*.7,w*.1,h*.3);
      }else if(kind==='lightbar'){
        ctx.fillStyle='#c7c8bb';ctx.fillRect(x+4,y+h*.25,w-8,h*.46);ctx.fillStyle='#b9504a';ctx.fillRect(x+9,y+h*.3,w*.38,h*.36);ctx.fillStyle='#7ca9ad';ctx.fillRect(x+w*.53,y+h*.3,w*.38,h*.36);ctx.strokeStyle='#555b57';ctx.lineWidth=3;ctx.strokeRect(x+4,y+h*.25,w-8,h*.46);
      }else if(kind==='gurney'){
        ctx.strokeStyle='#46514e';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x+w*.13,y+h*.23);ctx.lineTo(x+w*.87,y+h*.23);ctx.moveTo(x+w*.22,y+h*.28);ctx.lineTo(x+w*.22,y+h*.82);ctx.moveTo(x+w*.78,y+h*.28);ctx.lineTo(x+w*.78,y+h*.82);ctx.stroke();ctx.fillStyle='#b2b3a7';ctx.fillRect(x+w*.16,y+h*.23,w*.68,h*.3);ctx.strokeStyle='#9b5550';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+w*.5,y+h*.25);ctx.lineTo(x+w*.5,y+h*.49);ctx.stroke();ctx.fillStyle='#303735';ctx.beginPath();ctx.arc(x+w*.22,y+h*.86,5,0,Math.PI*2);ctx.arc(x+w*.78,y+h*.86,5,0,Math.PI*2);ctx.fill();
      }else if(kind==='curtain'||kind==='divider'){
        ctx.strokeStyle='#4b5956';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x+4,y+8);ctx.lineTo(x+w-4,y+8);ctx.stroke();ctx.fillStyle=kind==='curtain'?'rgba(161,181,174,.48)':'rgba(137,149,143,.42)';ctx.fillRect(x+10,y+11,w-20,h-15);ctx.strokeStyle='rgba(217,219,204,.6)';ctx.lineWidth=2;for(let k=1;k<4;k++){ctx.beginPath();ctx.moveTo(x+10+k*(w-20)/4,y+13);ctx.lineTo(x+10+k*(w-20)/4,y+h-5);ctx.stroke();}
      }else if(kind==='oxygen'){
        ctx.fillStyle='#b5bbb2';ctx.fillRect(x+w*.24,y+4,w*.52,h-8);ctx.strokeRect(x+w*.24,y+4,w*.52,h-8);ctx.fillStyle='#718a84';ctx.fillRect(x+w*.36,y+13,w*.28,h*.42);ctx.fillStyle='#a34e49';ctx.fillRect(x+w*.42,y+h*.05,w*.16,7);ctx.strokeStyle='#4f605b';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+w*.5,y+h*.2);ctx.lineTo(x+w*.8,y+h*.1);ctx.lineTo(x+w*.8,y+h*.4);ctx.stroke();
      }else if(kind==='examLamp'){
        ctx.strokeStyle='#505957';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x+w*.5,y+h);ctx.lineTo(x+w*.46,y+h*.36);ctx.lineTo(x+w*.74,y+h*.19);ctx.lineTo(x+w*.88,y+h*.2);ctx.stroke();ctx.fillStyle='#d9d2ad';ctx.beginPath();ctx.ellipse(x+w*.88,y+h*.2,13,8,-.2,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(214,203,157,.18)';ctx.beginPath();ctx.ellipse(x+w*.79,y+h*.34,28,18,0,0,Math.PI*2);ctx.fill();
      }else if(kind==='chair'){
        ctx.fillStyle='#777b72';ctx.fillRect(x+w*.22,y+h*.12,w*.56,h*.46);ctx.strokeRect(x+w*.22,y+h*.12,w*.56,h*.46);ctx.fillRect(x+w*.28,y+h*.58,w*.44,h*.17);ctx.strokeStyle='#4f5652';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+w*.31,y+h*.75);ctx.lineTo(x+w*.2,y+h);ctx.moveTo(x+w*.69,y+h*.75);ctx.lineTo(x+w*.8,y+h);ctx.stroke();
      }else if(kind==='medicalCart'||kind==='cabinet'||kind==='supplyCrate'){
        ctx.fillStyle=kind==='cabinet'?'#72766e':'#685d49';ctx.fillRect(x+3,y+5,w-6,h-10);ctx.strokeRect(x+3,y+5,w-6,h-10);ctx.strokeStyle='#b8b7a8';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+8,y+h*.46);ctx.lineTo(x+w-8,y+h*.46);ctx.stroke();ctx.fillStyle='#a75049';ctx.fillRect(x+w*.42,y+h*.14,w*.17,h*.2);ctx.fillStyle='#d8d6c9';ctx.fillRect(x+w*.48,y+h*.11,w*.07,h*.27);ctx.fillRect(x+w*.37,y+h*.2,w*.29,h*.07);
      }else if(kind==='monitor'){
        ctx.fillStyle='#4a5451';ctx.fillRect(x+3,y+4,w-6,h*.67);ctx.strokeRect(x+3,y+4,w-6,h*.67);ctx.strokeStyle='#89b9b0';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+8,y+h*.4);ctx.lineTo(x+w*.28,y+h*.4);ctx.lineTo(x+w*.39,y+h*.22);ctx.lineTo(x+w*.53,y+h*.55);ctx.lineTo(x+w*.67,y+h*.32);ctx.lineTo(x+w-8,y+h*.32);ctx.stroke();ctx.fillStyle='#414744';ctx.fillRect(x+w*.43,y+h*.72,w*.14,h*.25);
      }else if(kind==='instrument'||kind==='waste'){
        ctx.fillStyle=kind==='waste'?'#6a5246':'#a8aaa0';ctx.beginPath();ctx.ellipse(x+w*.5,y+h*.57,w*.4,h*.3,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#434b48';ctx.lineWidth=3;ctx.stroke();if(kind==='instrument'){ctx.strokeStyle='#c7c3b1';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x+w*.2,y+h*.52);ctx.lineTo(x+w*.8,y+h*.28);ctx.moveTo(x+w*.35,y+h*.7);ctx.lineTo(x+w*.82,y+h*.48);ctx.stroke();}else{ctx.fillStyle='#7c4544';ctx.beginPath();ctx.ellipse(x+w*.52,y+h*.48,w*.22,h*.13,-.2,0,Math.PI*2);ctx.fill();}
      }else{
        ctx.fillStyle='#777c75';ctx.fillRect(x+4,y+8,w-8,h-16);ctx.strokeRect(x+4,y+8,w-8,h-16);ctx.fillStyle='#a4aaa0';ctx.fillRect(x+10,y+14,w-20,8);ctx.fillStyle='#9d4e48';ctx.fillRect(x+w*.46,y+h*.4,w*.1,h*.32);
      }
    }else if(kind==='car'){
      this.drawCar(ctx,x,y,w,h,id);
    }else if(kind==='tanker'){
      ctx.fillStyle='#514c3e';ctx.beginPath();ctx.roundRect(x+3,y+h*.2,w-6,h*.6,h*.3);ctx.fill();ctx.strokeStyle='#292d2b';ctx.lineWidth=4;ctx.stroke();
      ctx.fillStyle='#95805a';ctx.beginPath();ctx.roundRect(x+w*.19,y+h*.27,w*.64,h*.46,h*.22);ctx.fill();ctx.strokeStyle='#4d4b41';ctx.lineWidth=3;ctx.stroke();
      ctx.strokeStyle='#c4aa70';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x+w*.28,y+h*.27);ctx.lineTo(x+w*.28,y+h*.73);ctx.moveTo(x+w*.72,y+h*.27);ctx.lineTo(x+w*.72,y+h*.73);ctx.stroke();
      ctx.fillStyle='#292d2b';for(const px of [x+w*.13,x+w*.86]){ctx.beginPath();ctx.ellipse(px,y+h*.2,w*.07,h*.17,0,0,Math.PI*2);ctx.ellipse(px,y+h*.8,w*.07,h*.17,0,0,Math.PI*2);ctx.fill();}
    }else if(['ambulance','armor','wagon','container','engine'].includes(kind)) {
      ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);
      ctx.fillStyle=kind==='ambulance'?'#c9c7bc':kind==='tanker'?'#665841':'#273134';ctx.fillRect(x+w*.2,y+9,w*.6,h-18);
      ctx.fillStyle=kind==='ambulance'?'#9a4c48':'#1a2021';
      if(kind==='ambulance'){ctx.fillRect(x+w*.46,y+9,9,h-18);ctx.fillRect(x+w*.31,y+h*.43,w*.4,9);}
      else if(kind==='container'||kind==='wagon')for(let a=x+12;a<x+w-8;a+=18)ctx.fillRect(a,y+8,3,h-16);
      else {ctx.fillRect(x+10,y+h*.3,w-20,5);ctx.fillRect(x+10,y+h*.7,w-20,5);}
    } else if(kind==='signfuel') {
      ctx.fillStyle='#383735';ctx.fillRect(x+w*.46,y+h*.54,10,h*.46);ctx.fillStyle='#8d4f35';ctx.fillRect(x+10,y,w-20,h*.65);ctx.strokeRect(x+10,y,w-20,h*.65);
      ctx.fillStyle='#e8bd74';ctx.font='bold 24px Segoe UI, Arial';ctx.textAlign='center';ctx.fillText('FUEL',x+w/2,y+h*.43);
    } else if(kind==='drain') {
      ctx.fillStyle='#33413c';ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);ctx.strokeStyle='#a7aa8c';ctx.lineWidth=4;
      for(let i=10;i<w-10;i+=16){ctx.beginPath();ctx.moveTo(x+i,y+7);ctx.lineTo(x+i,y+h-7);ctx.stroke();}
    } else if(kind==='barricade'||kind==='fence') {
      ctx.fillStyle='#373b3a';ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);ctx.strokeStyle=id===9?'#b76b60':'#c4a668';ctx.lineWidth=9;
      for(let i=-h;i<w;i+=25){ctx.beginPath();ctx.moveTo(x+i,y+h);ctx.lineTo(x+i+h,y);ctx.stroke();}
    } else if(kind==='glass') {
      ctx.fillStyle='#384e50';ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);ctx.strokeStyle='#9bc4c5';ctx.lineWidth=3;
      ctx.beginPath();ctx.moveTo(x+12,y+h-9);ctx.lineTo(x+w*.45,y+8);ctx.lineTo(x+w*.64,y+h*.52);ctx.lineTo(x+w-9,y+9);ctx.stroke();
    } else if(kind==='signal') {
      ctx.fillStyle='#303639';ctx.fillRect(x+w*.48,y,9,h);ctx.fillStyle='#574734';ctx.beginPath();ctx.arc(x+w*.52,y+18,16,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#d6af5a';ctx.beginPath();ctx.arc(x+w*.52,y+18,8,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#9b9081';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x,y+h-10);ctx.lineTo(x+w,y+h-10);ctx.stroke();
    } else if(kind==='bone') {
      ctx.strokeStyle='#c4b8a3';ctx.lineWidth=8;
      for(let i=0;i<4;i++){const py=y+i*15;ctx.beginPath();ctx.moveTo(x+8,py);ctx.quadraticCurveTo(x+w*.50,py+28,x+w-8,py);ctx.stroke();}
    } else if(kind==='pipe') {
      ctx.fillStyle='#273c38';ctx.fillRect(x,y+h*.30,w,h*.4);ctx.strokeRect(x,y+h*.30,w,h*.4);
      ctx.fillStyle='#63796d';for(let k=0;k<4;k++)ctx.fillRect(x+10+k*(w-20)/4,y+h*.22,9,h*.56);
      ctx.strokeStyle='#9b9a77';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+8,y+h*.36);ctx.lineTo(x+w-8,y+h*.36);ctx.stroke();
    } else if(kind==='bridge') {
      ctx.fillStyle='#514d3e';ctx.fillRect(x,y+h*.12,w,h*.76);ctx.strokeRect(x,y+h*.12,w,h*.76);
      ctx.fillStyle='#8d8060';for(let k=0;k<6;k++)ctx.fillRect(x+5+k*w/6,y+h*.17,w/6-5,h*.66);
      ctx.strokeStyle='#a9a58c';ctx.lineWidth=5;for(const py of [y+7,y+h-7]){ctx.beginPath();ctx.moveTo(x,py);ctx.lineTo(x+w,py);ctx.stroke();}
    } else if(kind==='pump') {
      ctx.fillStyle='#555c54';ctx.fillRect(x+8,y+4,w-16,h-8);ctx.strokeRect(x+8,y+4,w-16,h-8);
      ctx.fillStyle='#b49b65';ctx.fillRect(x+19,y+10,w*.27,h-20);ctx.fillRect(x+w*.58,y+10,w*.27,h-20);
      ctx.fillStyle='#1c2727';ctx.fillRect(x+24,y+15,w*.18,15);ctx.fillRect(x+w*.63,y+15,w*.18,15);
      ctx.strokeStyle='#272c29';ctx.lineWidth=4;ctx.beginPath();ctx.arc(x+w*.88,y+h*.65,12,-Math.PI/2,Math.PI*.65);ctx.stroke();
    } else if(kind==='foodcourt') {
      ctx.fillStyle='#625447';ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);
      for(let k=0;k<3;k++){const tx=x+21+k*(w-36)/3;ctx.fillStyle='#92765e';ctx.fillRect(tx,y+10,27,h-20);ctx.strokeRect(tx,y+10,27,h-20);
        ctx.fillStyle='#b8a487';ctx.beginPath();ctx.arc(tx+14,y+h*.5,7,0,Math.PI*2);ctx.fill();}
    } else if(kind==='escalator') {
      ctx.fillStyle='#252b2d';ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);
      ctx.fillStyle='#687074';ctx.fillRect(x+10,y+5,w*.36,h-10);ctx.fillRect(x+w*.56,y+5,w*.36,h-10);
      ctx.strokeStyle='#b1a99a';ctx.lineWidth=3;for(let k=8;k<h-5;k+=11){ctx.beginPath();ctx.moveTo(x+12,y+k);ctx.lineTo(x+w*.40,y+k);ctx.moveTo(x+w*.58,y+k);ctx.lineTo(x+w-12,y+k);ctx.stroke();}
    } else if(kind==='stage') {
      ctx.fillStyle='#43343a';ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);
      ctx.fillStyle='#736069';ctx.fillRect(x+9,y+9,w-18,h*.5);ctx.fillStyle='#2a262a';ctx.fillRect(x+9,y+h*.62,w-18,h*.24);
      ctx.strokeStyle='#b99e8e';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x+w*.15,y+h*.61);ctx.quadraticCurveTo(x+w*.5,y+h*.35,x+w*.85,y+h*.61);ctx.stroke();
    } else if(kind==='sandbag') {
      for(let row=0;row<2;row++)for(let k=0;k<4;k++){ctx.fillStyle=row?'#847b60':'#9c8b65';ctx.beginPath();ctx.ellipse(x+16+k*(w-30)/4+(row?8:0),y+17+row*24,19,13,-.18,0,Math.PI*2);ctx.fill();ctx.stroke();}
    } else if(kind==='tower') {
      ctx.fillStyle='#3b4540';ctx.fillRect(x+14,y+10,w-28,h-20);ctx.strokeRect(x+14,y+10,w-28,h-20);
      ctx.strokeStyle='#b7aa80';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x+w*.5,y+12);ctx.lineTo(x+w*.5,y+h-10);ctx.moveTo(x+20,y+h-18);ctx.lineTo(x+w-20,y+18);ctx.stroke();
      ctx.fillStyle='#a4544b';ctx.beginPath();ctx.arc(x+w*.5,y+h*.5,9,0,Math.PI*2);ctx.fill();
    } else if(kind==='surgery') {
      ctx.fillStyle='#526260';ctx.fillRect(x+7,y+9,w-14,h-18);ctx.strokeRect(x+7,y+9,w-14,h-18);
      ctx.fillStyle='#c1c4b6';ctx.fillRect(x+w*.35,y+13,w*.3,h-26);ctx.fillStyle='#7a4648';ctx.fillRect(x+w*.43,y+h*.38,w*.14,h*.28);
      ctx.strokeStyle='#abb7af';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+12,y+h*.5);ctx.lineTo(x+w-12,y+h*.5);ctx.stroke();
    } else if(kind==='chamber'||kind==='tank'||kind==='culture') {
      ctx.fillStyle='#34484a';ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);
      ctx.fillStyle=kind==='culture'?'#496b55':'#476b70';ctx.beginPath();ctx.ellipse(x+w*.5,y+h*.5,w*.36,h*.39,0,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#a6d3c7';ctx.lineWidth=4;ctx.stroke();ctx.fillStyle='#a2bcb4';ctx.fillRect(x+7,y+7,11,h-14);ctx.fillRect(x+w-18,y+7,11,h-14);
      if(kind==='culture'){ctx.strokeStyle='#9aa978';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x+w*.5,y+h*.76);ctx.lineTo(x+w*.42,y+h*.32);ctx.lineTo(x+w*.65,y+h*.43);ctx.stroke();}
    } else if(kind==='core'||kind==='heart'||kind==='nest'||kind==='web'||kind==='quarantine') {
      if(kind==='quarantine'){
        ctx.fillStyle='#4d3c37';ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);ctx.strokeStyle='#cf7766';ctx.lineWidth=7;
        ctx.beginPath();ctx.moveTo(x+8,y+8);ctx.lineTo(x+w-8,y+h-8);ctx.moveTo(x+w-8,y+8);ctx.lineTo(x+8,y+h-8);ctx.stroke();
      } else {
        ctx.fillStyle=kind==='web'?'#5d5551':'#683d3d';ctx.beginPath();ctx.ellipse(x+w/2,y+h/2,w*.47,h*.42,.2,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle=kind==='web'?'#b2a6a0':'#ad6b67';ctx.lineWidth=kind==='web'?2:6;
        for(let k=0;k<6;k++){const a=k*Math.PI/3;ctx.beginPath();ctx.moveTo(x+w/2,y+h/2);ctx.lineTo(x+w/2+Math.cos(a)*w*.45,y+h/2+Math.sin(a)*h*.4);ctx.stroke();}
        if(kind!=='web'){ctx.fillStyle=kind==='heart'?'#bf6a69':'#9d6660';ctx.beginPath();ctx.ellipse(x+w/2,y+h/2,w*.18,h*.22,0,0,Math.PI*2);ctx.fill();}
      }
    } else if(['tent','house','shopfront','store','gatehouse','reception'].includes(kind)) {
      ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);ctx.strokeStyle='#b2a899';ctx.beginPath();ctx.moveTo(x+8,y+8);ctx.lineTo(x+w/2,y+h*.48);ctx.lineTo(x+w-8,y+8);ctx.stroke();
      ctx.fillStyle='#12181a';ctx.fillRect(x+w*.38,y+h*.68,w*.24,h*.32);
    } else if(['pump','valve','switch','console','signal','tower','surgery','chamber','tank','culture'].includes(kind)) {
      ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);ctx.fillStyle=id===8?'#6da9a4':id===4?'#92a983':'#c0a267';ctx.fillRect(x+13,y+11,w-26,12);
      if(kind==='valve'||kind==='switch'){ctx.strokeStyle='#d3b990';ctx.beginPath();ctx.arc(x+w*.5,y+h*.58,17,0,Math.PI*2);ctx.stroke();}
      else {ctx.fillStyle='#182225';ctx.fillRect(x+17,y+29,w-34,h-38);}
    } else if(['nest','core','heart','bone','rib','web','quarantine'].includes(kind)) {
      ctx.fillStyle='#67413e';ctx.beginPath();ctx.ellipse(x+w/2,y+h/2,w*.48,h*.44,.2,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ae726b';ctx.lineWidth=5;
      for(let i=0;i<5;i++){const px=x+12+i*(w-24)/4;ctx.beginPath();ctx.moveTo(px,y+6);ctx.quadraticCurveTo(x+w/2,y+h*.57,px+9,y+h-5);ctx.stroke();}
    } else {ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);ctx.strokeStyle='#baa677';for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(x+7,y+13+i*16);ctx.lineTo(x+w-7,y+13+i*16);ctx.stroke();}}
    ctx.restore();
  }

  private drawVehicle(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,kind:string):void {
    ctx.fillStyle=kind==='ambulance'?'#d8d4c7':'#626660';ctx.beginPath();ctx.moveTo(x+w*.08,y+h*.18);ctx.lineTo(x+w*.78,y+h*.12);ctx.quadraticCurveTo(x+w*.95,y+h*.16,x+w*.96,y+h*.35);ctx.lineTo(x+w*.93,y+h*.83);ctx.lineTo(x+w*.08,y+h*.86);ctx.closePath();ctx.fill();ctx.strokeStyle='#383d3a';ctx.lineWidth=4;ctx.stroke();
    ctx.fillStyle='#333d3b';ctx.fillRect(x+w*.23,y+h*.24,w*.28,h*.28);ctx.fillRect(x+w*.57,y+h*.23,w*.2,h*.29);ctx.fillStyle='#252a29';ctx.fillRect(x+w*.15,y+h*.76,w*.19,h*.16);ctx.fillRect(x+w*.68,y+h*.76,w*.19,h*.16);
    ctx.fillStyle='#59625e';ctx.beginPath();ctx.moveTo(x+w*.23,y+h*.55);ctx.lineTo(x+w*.76,y+h*.55);ctx.lineTo(x+w*.69,y+h*.75);ctx.lineTo(x+w*.31,y+h*.75);ctx.closePath();ctx.fill();
    if(kind==='ambulance'){ctx.fillStyle='#ad5148';ctx.fillRect(x+w*.43,y+h*.13,w*.09,h*.6);ctx.fillRect(x+w*.24,y+h*.37,w*.47,h*.11);ctx.fillStyle='#ab554b';ctx.fillRect(x+w*.37,y+h*.02,w*.27,h*.08);ctx.fillStyle='#ece2d0';ctx.fillRect(x+w*.45,y+h*.19,w*.05,h*.33);ctx.fillRect(x+w*.32,y+h*.32,w*.31,h*.06);ctx.fillStyle='#d8d4c7';ctx.fillRect(x+w*.3,y+h*.57,w*.08,h*.12);ctx.fillRect(x+w*.61,y+h*.57,w*.08,h*.12);ctx.strokeStyle='#656c68';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+w*.53,y+h*.56);ctx.lineTo(x+w*.53,y+h*.76);ctx.moveTo(x+w*.17,y+h*.17);ctx.lineTo(x+w*.17,y+h*.69);ctx.stroke();}
  }

  private drawCar(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,id:number):void {
    const angle=((Math.round(x*13+y*7)%3)-1)*.12;
    ctx.save();ctx.translate(x+w/2,y+h/2);ctx.rotate(angle);ctx.translate(-w/2,-h/2);
    ctx.fillStyle=id===2?'#555b57':'#68695e';ctx.beginPath();ctx.roundRect(w*.08,h*.11,w*.84,h*.78,h*.24);ctx.fill();ctx.strokeStyle='#303533';ctx.lineWidth=4;ctx.stroke();
    ctx.fillStyle='#242a29';for(const wy of [h*.2,h*.67]){ctx.beginPath();ctx.roundRect(w*.13,wy,w*.18,h*.16,4);ctx.fill();ctx.beginPath();ctx.roundRect(w*.69,wy,w*.18,h*.16,4);ctx.fill();}
    ctx.fillStyle='#424c4b';ctx.beginPath();ctx.moveTo(w*.28,h*.2);ctx.lineTo(w*.69,h*.2);ctx.lineTo(w*.75,h*.37);ctx.lineTo(w*.25,h*.37);ctx.closePath();ctx.fill();
    ctx.fillStyle='#323b3b';ctx.beginPath();ctx.moveTo(w*.25,h*.61);ctx.lineTo(w*.75,h*.61);ctx.lineTo(w*.7,h*.78);ctx.lineTo(w*.3,h*.78);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(200,187,151,.6)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(w*.5,h*.39);ctx.lineTo(w*.5,h*.6);ctx.stroke();
    ctx.fillStyle='#b35c49';ctx.fillRect(w*.1,h*.22,w*.05,h*.11);ctx.fillRect(w*.85,h*.22,w*.05,h*.11);
    ctx.strokeStyle='#c5bda7';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(w*.62,h*.37);ctx.lineTo(w*.55,h*.47);ctx.lineTo(w*.67,h*.54);ctx.stroke();ctx.restore();
  }
}
