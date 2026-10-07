import {clamp,capsuleCollision,circleCollision,closestPoint} from './physics.ts';
import type {Body,Vec} from './physics.ts';
import {PINBALL_SENSORS,PINBALL_SPINNER,RAILS,sweptFeatureTrigger} from './pinball-layout.ts';
import type {PinballFeatureId} from './pinball-layout.ts';
export {RAILS} from './pinball-layout.ts';
export const PIN={width:560,height:820};
export const BUMPERS=[{x:184,y:185,r:30},{x:360,y:185,r:30},{x:272,y:292,r:34}];
export const TARGETS=[{x:104,y:340,r:13},{x:442,y:342,r:13},{x:272,y:92,r:14}];
export type PinBall=Body&{id:number;trail:Vec[]};
export type PinState={balls:PinBall[];phase:'ready'|'playing'|'over';score:number;ballNumber:number;multiplier:number;targets:boolean[];dropTargets:boolean[];featureHits:Record<PinballFeatureId,number>;spinnerCharge:number;missionStep:number;missionAt:number;missionsCompleted:number;hits:number[];targetHits:number[];time:number;ballTime:number;saverUsed:boolean;returned:boolean;multiball:boolean;roundMultiball:boolean;left:number;right:number;nudgeCount:number;tilted:boolean;lastNudge:number;events:number;note:string;bestCombo:number;combo:number;lastBumper:number;cooldowns:Record<string,number>;id:number};
function makeBall(x:number,y:number,vx=0,vy=0,id=0):PinBall{return {x,y,vx,vy,r:9,id,trail:[]}}
const freshTargets=()=>[false,false,false];
export function createPinball():PinState{const targets=freshTargets();return {balls:[makeBall(512,749)],phase:'ready',score:0,ballNumber:1,multiplier:1,targets,dropTargets:targets,featureHits:{'left-orbit':0,spinner:0,'right-orbit':0,'left-lane':0,'center-lane':0,'right-lane':0,'drop-bank':0},spinnerCharge:0,missionStep:0,missionAt:-10,missionsCompleted:0,hits:[-10,-10,-10],targetHits:[-10,-10,-10],time:0,ballTime:0,saverUsed:false,returned:false,multiball:false,roundMultiball:false,left:.34,right:Math.PI-.34,nudgeCount:0,tilted:false,lastNudge:-10,events:0,note:'Launch the ball. Route Left Orbit → Spinner → Right Orbit within six seconds to complete a mission.',bestCombo:0,combo:0,lastBumper:-10,cooldowns:{},id:1}}
export function launchPinball(s:PinState,power=.8){if(s.phase!=='ready')return false;s.balls=[makeBall(512,749,-30,-(1000+clamp(power,0,1)*260),s.id++)];s.phase='playing';if(!s.returned)s.ballTime=0;s.returned=false;s.note=s.saverUsed?'Ball saved. Back into the reactor.':'Reactor online. Flippers ready.';s.events++;return true}
export function nudgePinball(s:PinState,direction=1){if(s.phase!=='playing'||s.time-s.lastNudge<.7||s.tilted)return false;s.lastNudge=s.time;s.nudgeCount++;if(s.nudgeCount>3){s.tilted=true;s.note='TILT — flippers disabled until this ball drains.';s.events++;return true}for(const ball of s.balls){ball.vx+=direction*110;ball.vy-=170}s.note=`Nudge ${s.nudgeCount}/3. One more after three will tilt.`;s.events++;return true}
function expireMission(s:PinState){if(s.missionStep>0&&s.time-s.missionAt>6){s.missionStep=0;s.missionAt=-10;s.events++}}
export function pinballFeatureHit(s:PinState,feature:PinballFeatureId,ballId=0){
 if(s.tilted)return false;const key=`feature:${ballId}:${feature}`;if(s.time-(s.cooldowns[key]??-20)<.2)return false;s.cooldowns[key]=s.time;expireMission(s);s.featureHits[feature]++;
 if(feature==='left-orbit'){s.score+=350*s.multiplier;if(s.missionStep===0||s.missionStep===2){s.missionStep=1;s.missionAt=s.time}}
 else if(feature==='right-orbit'){s.score+=350*s.multiplier;if(s.missionStep===2&&s.time-s.missionAt<=6){s.missionsCompleted++;s.score+=1000*s.multiplier;s.missionStep=0;s.missionAt=-10;s.note=`ROUTE COMPLETE · ${s.missionsCompleted} reactor mission${s.missionsCompleted===1?'':'s'}.`} }
 else if(feature==='spinner'){s.score+=25*s.multiplier;s.spinnerCharge++;if(s.spinnerCharge>=8){s.score+=250*s.multiplier;s.spinnerCharge=0;s.note='Spinner fully charged · 250 bonus.'}if(s.missionStep===1&&s.time-s.missionAt<=6)s.missionStep=2}
 else if(feature==='drop-bank')s.score+=500*s.multiplier;
 else s.score+=100*s.multiplier;
 if(!s.note.startsWith('ROUTE COMPLETE')&&feature!=='spinner')s.note=`${feature.replaceAll('-',' ').toUpperCase()} · ${s.multiplier}×`;s.events++;return true;
}
export function pinballHit(s:PinState,index:number,target=false,ballId=0){
 if(s.tilted)return;const key=(target?'target':'bumper')+ballId+':'+index;if(s.time-(s.cooldowns[key]??-20)<.12)return;s.cooldowns[key]=s.time;s.events++;
 if(target){s.targetHits[index]=s.time;s.targets[index]=true;s.dropTargets[index]=true;s.score+=250*s.multiplier;if(s.targets.every(Boolean)){s.score+=500*s.multiplier;s.featureHits['drop-bank']++;s.multiplier=Math.min(5,s.multiplier+1);s.targets=s.dropTargets=freshTargets();if(!s.roundMultiball){s.roundMultiball=true;s.multiball=true;s.balls.push(makeBall(210,114,180,80,s.id++),makeBall(346,114,-160,100,s.id++));s.note='DROP BANK CLEARED · multiball unlocked.'}else s.note=`Drop bank cleared. ${s.multiplier}× scoring.`}}
 else{s.hits[index]=s.time;s.combo=s.time-s.lastBumper<2?s.combo+1:1;s.bestCombo=Math.max(s.bestCombo,s.combo);s.lastBumper=s.time;s.score+=(100+Math.min(s.combo-1,10)*20)*s.multiplier;if(s.combo>=3)s.note=`${s.combo}-hit chain · ${s.multiplier}× multiplier.`}
}
export function drainPinball(s:PinState){
 if(s.balls.length)return;
 if(s.ballTime<9&&!s.saverUsed&&!s.tilted){s.saverUsed=true;s.phase='ready';s.balls=[makeBall(512,749,0,0,s.id++)];s.note='BALL SAVED — launch again.';s.events++;return}
 if(s.ballNumber>=3){s.phase='over';s.note='Reactor cooled. Your final score is locked in.';s.events++;return}
 s.ballNumber++;s.returned=false;s.phase='ready';s.balls=[makeBall(512,749,0,0,s.id++)];s.saverUsed=false;s.nudgeCount=0;s.tilted=false;s.multiball=false;s.combo=0;s.note=`Ball ${s.ballNumber} of 3. Launch when ready.`;s.events++;
}
function flipper(ball:PinBall,pivot:Vec,angle:number,omega:number){const end={x:pivot.x+Math.cos(angle)*95,y:pivot.y+Math.sin(angle)*95},point=closestPoint(ball,pivot,end),surface={x:-omega*(point.y-pivot.y),y:omega*(point.x-pivot.x)};capsuleCollision(ball,pivot,end,10,.78,surface)}
export function stepPinball(s:PinState,dt:number,input:{left:boolean;right:boolean}){
 if(s.phase==='over')return;const steps=Math.ceil(clamp(dt,0,.05)*240),h=steps?clamp(dt,0,.05)/steps:0;
 for(let n=0;n<steps;n++){
  s.time+=h;expireMission(s);const lTarget=input.left&&!s.tilted?-.57:.34,rTarget=input.right&&!s.tilted?Math.PI+.57:Math.PI-.34,oldL=s.left,oldR=s.right;
  s.left+=clamp(lTarget-s.left,-12*h,12*h);s.right+=clamp(rTarget-s.right,-12*h,12*h);if(s.phase!=='playing')continue;s.ballTime+=h;
  for(const ball of [...s.balls]){
   const from={x:ball.x,y:ball.y};ball.vy+=650*h;ball.vx*=Math.exp(-.07*h);ball.x+=ball.vx*h;ball.y+=ball.vy*h;const to={x:ball.x,y:ball.y};
   for(const [feature,sensor] of PINBALL_SENSORS)if(sweptFeatureTrigger(from,to,sensor))pinballFeatureHit(s,feature,ball.id);
   if(capsuleCollision(ball,{x:PINBALL_SPINNER.x1,y:PINBALL_SPINNER.y1},{x:PINBALL_SPINNER.x2,y:PINBALL_SPINNER.y2},2,.88))pinballFeatureHit(s,'spinner',ball.id);
   for(const [x1,y1,x2,y2] of RAILS)capsuleCollision(ball,{x:x1,y:y1},{x:x2,y:y2},3,.78);
   for(let i=0;i<BUMPERS.length;i++){const b=BUMPERS[i],dx=ball.x-b.x,dy=ball.y-b.y,d=Math.hypot(dx,dy);if(d<b.r+ball.r){const nx=dx/(d||1),ny=dy/(d||1);ball.x=b.x+nx*(b.r+ball.r+.1);ball.y=b.y+ny*(b.r+ball.r+.1);const dot=ball.vx*nx+ball.vy*ny;ball.vx+=nx*(Math.max(0,-dot*1.7)+240);ball.vy+=ny*(Math.max(0,-dot*1.7)+240);pinballHit(s,i,false,ball.id)}}
   for(let i=0;i<TARGETS.length;i++){const b=TARGETS[i],dx=ball.x-b.x,dy=ball.y-b.y,d=Math.hypot(dx,dy);if(d<b.r+ball.r){const nx=dx/(d||1),ny=dy/(d||1);ball.x=b.x+nx*(b.r+ball.r+.1);ball.y=b.y+ny*(b.r+ball.r+.1);const dot=ball.vx*nx+ball.vy*ny;ball.vx+=nx*(Math.max(0,-dot*1.6)+110);ball.vy+=ny*(Math.max(0,-dot*1.6)+110);pinballHit(s,i,true,ball.id)}}
   // Slingshot kickers above the flippers.
   for(const [i,x,y,dir] of [[0,120,461,1],[1,408,461,-1]])if(Math.hypot(ball.x-x,ball.y-y)<32&&s.time-(s.cooldowns['sling'+i]??-10)>.2){ball.vx+=dir*210;ball.vy-=240;s.cooldowns['sling'+i]=s.time;if(!s.tilted)s.score+=30*s.multiplier;s.events++}
   flipper(ball,{x:168,y:683},s.left,(s.left-oldL)/h);flipper(ball,{x:392,y:683},s.right,(s.right-oldR)/h);
   const speed=Math.hypot(ball.vx,ball.vy);
   if(s.balls.length===1&&ball.x>500&&ball.y>744&&speed<25){
    if(s.tilted){s.balls=[];drainPinball(s)}else{s.returned=true;s.phase='ready';s.balls=[makeBall(512,749,0,0,s.id++)];s.note='Ball returned to the plunger. Adjust your power and launch again.';s.events++}return;
   }
   if(speed>1550){ball.vx*=1550/speed;ball.vy*=1550/speed}
   if(ball.y>812||ball.x<-30||ball.x>590||!Number.isFinite(ball.x+ball.y+ball.vx+ball.vy))s.balls=s.balls.filter(b=>b!==ball);
  }
  for(let i=0;i<s.balls.length;i++)for(let j=i+1;j<s.balls.length;j++)circleCollision(s.balls[i],s.balls[j],.9);
  if(!s.balls.length){drainPinball(s);return}
 }
 for(const ball of s.balls){ball.trail.push({x:ball.x,y:ball.y});if(ball.trail.length>12)ball.trail.shift()}
}
