import {clamp,circleCollision,closestPoint} from './physics.ts';
import type {Vec,Body} from './physics.ts';
export const TABLE={width:1000,height:540,left:60,right:940,top:60,bottom:480,radius:12};
export const POCKETS=[{x:60,y:60},{x:500,y:54},{x:940,y:60},{x:60,y:480},{x:500,y:486},{x:940,y:480}];
export type PoolMode='solo'|'cpu'|'two';
export type PoolLayoutId='standard'|'line-drill'|'bank-shot';
export type CpuDifficulty='easy'|'standard'|'hard';
export type Group='solids'|'stripes';
export type PoolBall=Body&{id:number;pocketed:boolean;rotation:number};
export type Shot={firstContact:number|null;potted:number[];pockets:Record<number,number>;rail:boolean;calledPocket:number|null;breakShot:boolean;remaining:number};
export type PoolState={balls:PoolBall[];mode:PoolMode;layout:PoolLayoutId;phase:'aim'|'rolling'|'placement'|'over';turn:number;groups:(Group|null)[];winner:number|null;shots:number;fouls:number[];shot:Shot|null;note:string;time:number;settle:number;spin:number;events:number;lastPocket:number;lastShot:string;started:boolean};
export const groupOf=(id:number):Group|null=>id>0&&id<8?'solids':id>8?'stripes':null;
export function remaining(s:PoolState,player=s.turn){const group=s.groups[player];return s.balls.filter(b=>!b.pocketed&&groupOf(b.id)===group&&group!==null).length}
export function legalTargets(s:PoolState){if(s.mode==='solo')return s.balls.filter(b=>b.id&&!b.pocketed);const group=s.groups[s.turn];return s.balls.filter(b=>!b.pocketed&&b.id>0&&(group?(remaining(s)?groupOf(b.id)===group:b.id===8):b.id!==8))}
export function createPool(mode:PoolMode='solo',layout:PoolLayoutId='standard'):PoolState{
 const balls:PoolBall[]=[{id:0,x:270,y:270,vx:0,vy:0,r:12,pocketed:false,rotation:0}],order=[1,9,2,10,8,3,11,4,12,5,6,13,7,14,15];let i=0;
 for(let row=0;row<5;row++)for(let col=0;col<=row;col++)balls.push({id:order[i++],x:690+row*Math.sqrt(3)*12.03,y:270+(col*2-row)*12.03,vx:0,vy:0,r:12,pocketed:false,rotation:0});
 if(layout==='line-drill'){
  Object.assign(balls[0],{x:235,y:270});
  for(const b of balls.slice(1)){const slot=b.id<=5?b.id-1:-1;if(slot<0)b.pocketed=true;else Object.assign(b,{x:455+slot*88,y:270,pocketed:false})}
 }else if(layout==='bank-shot'){
  Object.assign(balls[0],{x:230,y:270});const positions:Record<number,[number,number]>={1:[510,145],9:[510,395],2:[735,270]};
  for(const b of balls.slice(1)){const pos=positions[b.id];if(pos)Object.assign(b,{x:pos[0],y:pos[1],pocketed:false});else b.pocketed=true}
 }
 const note=layout==='standard'?(mode==='solo'?'Clear all 15 balls. Aim, set your power, and shoot.':'Player 1 breaks. The first legal pocket assigns groups.'):`${layout==='line-drill'?'Line drill':'Bank shot'} practice. Clear the balls on the table.`;
 return {balls,mode,layout,phase:'aim',turn:0,groups:[null,null],winner:null,shots:0,fouls:[0,0],shot:null,note,time:0,settle:0,spin:0,events:0,lastPocket:-1,lastShot:'',started:false};
}
export function strike(s:PoolState,angle:number,power:number,calledPocket:number|null=null,spin=0){
 if(s.phase!=='aim'||!Number.isFinite(angle)||!Number.isFinite(power))return false;
 if(s.mode!=='solo'&&s.groups[s.turn]&&remaining(s)===0&&(calledPocket===null||calledPocket<0||calledPocket>5)){s.note='Call a pocket for the eight ball before you shoot.';return false}
 const ball=s.balls[0],speed=180+clamp(power,0,1)*920;ball.vx=Math.cos(angle)*speed;ball.vy=Math.sin(angle)*speed;
 s.shot={firstContact:null,potted:[],pockets:{},rail:false,calledPocket,breakShot:s.shots===0,remaining:remaining(s)};s.shots++;s.phase='rolling';s.settle=0;s.spin=clamp(spin,-1,1);s.started=true;s.note='Shot in motion…';return true;
}
export function canPlaceCue(s:PoolState,x:number,y:number){return Number.isFinite(x)&&Number.isFinite(y)&&x>=TABLE.left+13&&x<=TABLE.right-13&&y>=TABLE.top+13&&y<=TABLE.bottom-13&&!s.balls.some(b=>b.id&&!b.pocketed&&Math.hypot(b.x-x,b.y-y)<25)&&!POCKETS.some(p=>Math.hypot(p.x-x,p.y-y)<32)}
export function placeCue(s:PoolState,x:number,y:number){if(s.phase!=='placement'||!canPlaceCue(s,x,y))return false;Object.assign(s.balls[0],{x,y,vx:0,vy:0,pocketed:false});s.phase='aim';s.note=s.mode==='solo'?'Cue ball placed. Keep clearing the table.':`Player ${s.turn+1}: cue placed. Aim your next shot.`;return true}
function respotEight(s:PoolState){const ball=s.balls.find(b=>b.id===8)!;for(let x=690;x>=TABLE.left+20;x-=26)if(!s.balls.some(b=>b!==ball&&!b.pocketed&&Math.hypot(b.x-x,b.y-270)<25)){Object.assign(ball,{x,y:270,vx:0,vy:0,pocketed:false});return}for(let y=90;y<460;y+=26)for(let x=90;x<920;x+=26)if(!s.balls.some(b=>b!==ball&&!b.pocketed&&Math.hypot(b.x-x,b.y-y)<25)){Object.assign(ball,{x,y,vx:0,vy:0,pocketed:false});return}}
export function finishShot(s:PoolState){
 const shot=s.shot;if(!shot||s.phase!=='rolling')return;
 const scratch=shot.potted.includes(0),objects=shot.potted.filter(id=>id>0),eight=objects.includes(8),group=s.groups[s.turn];let foul='';
 if(s.mode==='solo'){
  if(s.balls.slice(1).every(b=>b.pocketed)){s.phase='over';s.winner=0;s.note=`Table cleared in ${s.shots} shots.`}
  else if(scratch){s.phase='placement';s.fouls[0]++;s.note='Scratch. Place the cue ball anywhere clear on the cloth.'}
  else{s.phase='aim';s.note=objects.length?`${objects.length} pocketed. ${15-s.balls.slice(1).filter(b=>b.pocketed).length} to go.`:'Aim your next shot.'}
  s.lastShot=s.note;return;
 }
 if(scratch)foul='Cue ball scratched';
 else if(shot.firstContact===null)foul='No object ball contacted';
 else if(!shot.breakShot&&((group&&shot.remaining>0&&groupOf(shot.firstContact)!==group)||(group&&shot.remaining===0&&shot.firstContact!==8)||(!group&&shot.firstContact===8)))foul='Wrong first contact';
 else if(!objects.length&&!shot.rail)foul='No ball reached a cushion after contact';
 if(eight&&shot.breakShot)respotEight(s);
 else if(eight){const legal=!foul&&group!==null&&shot.remaining===0&&shot.calledPocket===shot.pockets[8];s.winner=legal?s.turn:1-s.turn;s.phase='over';s.note=legal?`Player ${s.turn+1} wins. Eight ball in the called pocket.`:`Player ${2-s.turn} wins. ${foul||'Eight ball pocketed early or in an uncalled pocket'}.`;s.lastShot=s.note;return}
 if(foul){s.fouls[s.turn]++;s.turn=1-s.turn;s.phase='placement';s.balls[0].pocketed=true;s.note=`${foul}. Player ${s.turn+1} has ball in hand.`}
 else{
  const first=objects.find(id=>groupOf(id));if(!group&&first){s.groups[s.turn]=groupOf(first);s.groups[1-s.turn]=s.groups[s.turn]==='solids'?'stripes':'solids'}
  const keep=objects.some(id=>groupOf(id)===s.groups[s.turn])||(shot.breakShot&&eight);if(!keep)s.turn=1-s.turn;
  s.phase='aim';s.note=`Player ${s.turn+1} · ${s.groups[s.turn]||'open table'}. ${eight&&shot.breakShot?'Eight on the break is re-spotted. ':''}${keep?'Pocket made. Shoot again.':'Your turn.'}`;
 }
 s.lastShot=s.note;
}
export function stepPool(s:PoolState,dt:number){
 if(s.phase!=='rolling')return;const steps=Math.ceil(clamp(dt,0,.05)*240),h=steps?clamp(dt,0,.05)/steps:0;
 for(let sub=0;sub<steps;sub++){
  s.time+=h;const shot=s.shot!;
  for(const b of s.balls){if(b.pocketed)continue;b.x+=b.vx*h;b.y+=b.vy*h;const speed=Math.hypot(b.vx,b.vy),next=Math.max(0,speed-82*h);if(speed){b.vx*=next/speed;b.vy*=next/speed}b.rotation+=speed*h/12;
   const pocket=POCKETS.findIndex(p=>Math.hypot(b.x-p.x,b.y-p.y)<26);if(pocket!==-1){b.pocketed=true;b.vx=b.vy=0;shot.potted.push(b.id);shot.pockets[b.id]=pocket;s.lastPocket=pocket;s.events++;continue}
   let rail=false;if(b.x<TABLE.left+b.r){b.x=TABLE.left+b.r;b.vx=Math.abs(b.vx)*.88;rail=true}if(b.x>TABLE.right-b.r){b.x=TABLE.right-b.r;b.vx=-Math.abs(b.vx)*.88;rail=true}if(b.y<TABLE.top+b.r){b.y=TABLE.top+b.r;b.vy=Math.abs(b.vy)*.88;rail=true}if(b.y>TABLE.bottom-b.r){b.y=TABLE.bottom-b.r;b.vy=-Math.abs(b.vy)*.88;rail=true}if(rail&&shot.firstContact!==null)shot.rail=true;
  }
  for(let i=0;i<s.balls.length;i++)for(let j=i+1;j<s.balls.length;j++){const a=s.balls[i],b=s.balls[j];if(a.pocketed||b.pocketed)continue;const touched=circleCollision(a,b,.96);if(touched&&a.id===0&&shot.firstContact===null){shot.firstContact=b.id;if(s.spin){const scale=1+s.spin*.3;a.vx*=scale;a.vy*=scale}s.events++}}
  if(s.balls.every(b=>b.pocketed||Math.hypot(b.vx,b.vy)<.8)){s.settle+=h;if(s.settle>.22){for(const b of s.balls)b.vx=b.vy=0;finishShot(s);return}}else s.settle=0;
 }
}
export function aimTrace(s:PoolState,angle:number){
 const cue=s.balls[0],dir={x:Math.cos(angle),y:Math.sin(angle)};let length=1200,target:PoolBall|null=null;
 for(const b of s.balls){if(!b.id||b.pocketed)continue;const dx=b.x-cue.x,dy=b.y-cue.y,along=dx*dir.x+dy*dir.y,side=dx*dir.y-dy*dir.x;if(along<=0||Math.abs(side)>24)continue;const hit=along-Math.sqrt(24**2-side**2);if(hit>=0&&hit<length){length=hit;target=b}}
 for(const [boundary,axis] of [[TABLE.left+12,'x'],[TABLE.right-12,'x'],[TABLE.top+12,'y'],[TABLE.bottom-12,'y']] as const){const t=(boundary-cue[axis])/dir[axis];if(t>0&&t<length){length=t;target=null}}
 return {end:{x:cue.x+dir.x*length,y:cue.y+dir.y*length},target,length};
}
function pathClear(s:PoolState,a:Vec,b:Vec,ignore:number[]){return !s.balls.some(ball=>!ball.pocketed&&!ignore.includes(ball.id)&&Math.hypot(closestPoint(ball,a,b).x-ball.x,closestPoint(ball,a,b).y-ball.y)<24)}
export function cpuShot(s:PoolState,difficulty:CpuDifficulty='standard'){
 const cue=s.balls[0],targets=legalTargets(s),options:{angle:number;power:number;pocket:number;score:number;targetId:number}[]=[],minimumAlignment=difficulty==='easy'?.05:difficulty==='hard'?.3:.15;
 for(const target of targets)for(let pocket=0;pocket<POCKETS.length;pocket++){const p=POCKETS[pocket],distance=Math.hypot(p.x-target.x,p.y-target.y),dx=(p.x-target.x)/distance,dy=(p.y-target.y)/distance,ghost={x:target.x-dx*24.2,y:target.y-dy*24.2},cueDistance=Math.hypot(ghost.x-cue.x,ghost.y-cue.y),alignment=((ghost.x-cue.x)*dx+(ghost.y-cue.y)*dy)/(cueDistance||1);
  if(alignment<minimumAlignment||ghost.x<73||ghost.x>927||ghost.y<73||ghost.y>467||!pathClear(s,cue,ghost,[0,target.id])||!pathClear(s,target,p,[0,target.id]))continue;
  const score=difficulty==='hard'?alignment*2200-distance*1.15-cueDistance*.9:difficulty==='easy'?alignment*900-distance-cueDistance*.8:alignment*1500-distance-cueDistance*.6;
  let angle=Math.atan2(ghost.y-cue.y,ghost.x-cue.x),power=clamp((Math.sqrt(2*95*(distance+cueDistance))/Math.max(.45,alignment)-100)/920,.18,.92);
  if(difficulty==='easy'){angle+=.045;power=clamp(power*.78,.14,.75)}else if(difficulty==='hard')power=clamp(power,.22,.84);
  options.push({angle,power,pocket,score,targetId:target.id});
 }
 options.sort((a,b)=>b.score-a.score);
 if(options.length)return options[difficulty==='easy'?Math.min(1,options.length-1):0];
 const target=targets[0];return {angle:target?Math.atan2(target.y-cue.y,target.x-cue.x):0,power:s.shots===0?.92:.48,pocket:0,score:0,targetId:target?.id??null};
}
export function cpuPlace(s:PoolState){for(let x=260;x<900;x+=45)for(let y=120;y<440;y+=40)if(placeCue(s,x,y))return true;return false}
