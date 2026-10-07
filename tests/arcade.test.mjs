import test from 'node:test';
import assert from 'node:assert/strict';
import {circleCollision,capsuleCollision,finiteBody} from '../app/arcade/engines/physics.ts';
import {createPinball,launchPinball,stepPinball,nudgePinball,pinballHit,drainPinball,pinballFeatureHit} from '../app/arcade/engines/pinball.ts';
import {sweptFeatureTrigger} from '../app/arcade/engines/pinball-layout.ts';
import {createPool,strike,stepPool,finishShot,placeCue,canPlaceCue,cpuShot,cpuPlace,aimTrace,legalTargets} from '../app/arcade/engines/pool.ts';
import {SYMBOLS,PAYLINES,sampleSymbol,evaluateSlots,spinSlots,freshWallet,readWallet,randomIndex,theoreticalReturn} from '../app/arcade/engines/slots.ts';
import {dragToShot,beginPoolDrag,movePoolDrag,finishPoolDrag,cancelPoolDrag} from '../app/arcade/engines/pool-input.ts';

test('pool drag points opposite the pull direction',()=>{
  const horizontal=dragToShot({x:100,y:100},{x:190,y:100});assert.ok(Math.abs(Math.abs(horizontal.angle)-Math.PI)<1e-12);
  const diagonal=dragToShot({x:100,y:100},{x:136,y:136});assert.ok(Math.abs(diagonal.angle-(-3*Math.PI/4))<1e-12);
});
test('pool drag power clamps to the playable range',()=>{
  assert.equal(dragToShot({x:0,y:0},{x:12,y:0}).power,12/180);
  assert.equal(dragToShot({x:0,y:0},{x:90,y:0}).power,.5);
  assert.equal(dragToShot({x:0,y:0},{x:240,y:0}).power,1);
});
test('pool zero-length drag stays finite',()=>{
  assert.equal(dragToShot({x:0,y:0},{x:0,y:0}),null);assert.equal(dragToShot({x:0,y:0},{x:11,y:0}),null);
});
test('pool pointer gestures require a nearby cue in aim phase and finish once',()=>{
  const cue={x:100,y:100};assert.equal(beginPoolDrag(4,{x:133,y:100},cue,'aim'),null);assert.equal(beginPoolDrag(4,{x:100,y:100},cue,'rolling'),null);
  let gesture=beginPoolDrag(4,{x:120,y:100},cue,'aim');assert.ok(gesture);gesture=movePoolDrag(gesture,4,{x:190,y:100});assert.deepEqual(gesture.current,{x:190,y:100});
  assert.equal(finishPoolDrag(gesture,5),null);assert.equal(finishPoolDrag(gesture,4).power,.5);assert.equal(cancelPoolDrag(gesture,4),null);
  const short=beginPoolDrag(4,cue,cue,'aim');assert.equal(finishPoolDrag(movePoolDrag(short,4,{x:105,y:100}),4),null);
});

test('ball collisions transfer momentum, preserve tangential motion and separate overlap',()=>{
  const a={x:0,y:0,r:12,vx:100,vy:3},b={x:23,y:0,r:12,vx:0,vy:3};
  assert.equal(circleCollision(a,b,1),true);assert.equal(a.vx,0);assert.equal(b.vx,100);assert.equal(a.vy,3);assert.ok(b.x-a.x>=24);
  const separating={x:23,y:0,r:12,vx:40,vy:0},other={x:0,y:0,r:12,vx:-20,vy:0};circleCollision(other,separating);assert.equal(other.vx,-20);assert.equal(separating.vx,40);
  const ball={x:10,y:5,r:9,vx:30,vy:-100};capsuleCollision(ball,{x:0,y:0},{x:30,y:0},0,.8);assert.equal(ball.vx,30);assert.equal(ball.vy,80);assert.ok(ball.y>9);
});
test('pinball returns a settled shooter-lane ball to the plunger without spending a ball',()=>{
  const s=createPinball();launchPinball(s,.5);s.ballTime=13;
  Object.assign(s.balls[0],{x:512,y:771,vx:2,vy:-4});
  stepPinball(s,1/60,{left:false,right:false});assert.equal(s.phase,'ready');assert.equal(s.ballNumber,1);
  launchPinball(s,.8);assert.ok(s.ballTime>=13,'a relaunch does not renew the ball-save timer');
});
test('pinball launch strengths reach the playfield and remain finite through complete rounds',()=>{
  for(const power of [.15,.5,.8,1]){
    const s=createPinball();let entered=false;
    for(let frame=0;frame<120*120&&s.phase!=='over';frame++){
      if(s.phase==='ready')launchPinball(s,s.returned ? .8 : power);
      stepPinball(s,1/120,{left:false,right:false});
      for(const ball of s.balls){assert.ok(finiteBody(ball));if(ball.x<480&&ball.y<600)entered=true}
    }
    assert.ok(entered,`power ${power} reached the playfield`);assert.equal(s.phase,'over',`power ${power} completes the three-ball round`);assert.ok(s.score>=0);
  }
});
test('pinball circuits award multiball once, cooldowns prevent duplicate hits and tilt disables awards',()=>{
  const s=createPinball();launchPinball(s);pinballHit(s,0);const first=s.score;pinballHit(s,0);assert.equal(s.score,first);
  for(let i=0;i<3;i++){s.time+=.2;pinballHit(s,i,true)}assert.equal(s.balls.length,3);assert.equal(s.multiplier,2);assert.ok(s.score>=2250);
  for(let i=0;i<3;i++){s.time+=.2;pinballHit(s,i,true)}assert.equal(s.balls.length,3);assert.equal(s.multiplier,3);
  for(let i=0;i<4;i++){s.time+=1;assert.ok(nudgePinball(s))}assert.ok(s.tilted);const before=s.score;pinballHit(s,0);assert.equal(s.score,before);
  stepPinball(s,.05,{left:true,right:true});assert.equal(s.left,.34);assert.equal(s.right,Math.PI-.34);
});
test('pinball ball-save is single use and the third drained ball ends the game',()=>{
  const s=createPinball();launchPinball(s);s.balls=[];s.ballTime=2;drainPinball(s);assert.equal(s.ballNumber,1);assert.ok(s.saverUsed);assert.equal(s.phase,'ready');
  launchPinball(s);s.balls=[];s.ballTime=2;drainPinball(s);assert.equal(s.ballNumber,2);assert.equal(s.saverUsed,false);
  launchPinball(s);s.balls=[];s.ballTime=10;drainPinball(s);assert.equal(s.ballNumber,3);
  launchPinball(s);s.balls=[];s.ballTime=10;drainPinball(s);assert.equal(s.phase,'over');assert.equal(launchPinball(s),false);
});
test('pinball routes activate features and award a mission once',()=>{
  const s=createPinball();s.phase='playing';s.multiplier=2;const before=s.score;pinballFeatureHit(s,'left-orbit');s.time=1;pinballFeatureHit(s,'spinner');s.time=2;pinballFeatureHit(s,'right-orbit');assert.equal(s.missionsCompleted,1);assert.equal(s.missionStep,0);assert.ok(s.score>=before+1000*2);
  s.time=10;pinballFeatureHit(s,'left-orbit');s.time=17;pinballFeatureHit(s,'spinner');s.time=18;pinballFeatureHit(s,'right-orbit');assert.equal(s.missionsCompleted,1);
});
test('pinball drop targets reset and award a bank clear',()=>{
  const s=createPinball();for(let i=0;i<3;i++){s.time+=.2;pinballHit(s,i,true)}assert.deepEqual(s.dropTargets,[false,false,false]);assert.equal(s.featureHits['drop-bank'],1);assert.ok(s.score>=1750);assert.equal(s.balls.length,3);
});
test('pinball trigger cooldown and tilt suppress duplicate awards',()=>{
  const s=createPinball();s.phase='playing';pinballFeatureHit(s,'left-orbit');const first=s.score;pinballFeatureHit(s,'left-orbit');assert.equal(s.score,first);s.time+=.3;pinballFeatureHit(s,'left-orbit');assert.ok(s.score>first);s.tilted=true;const tilted=s.score;pinballFeatureHit(s,'spinner');assert.equal(s.score,tilted);assert.equal(s.spinnerCharge,0);
});
test('pinball swept sensors catch a fast ball between frames',()=>{
  assert.equal(sweptFeatureTrigger({x:0,y:0},{x:100,y:0},{x:50,y:0,r:5}),true);assert.equal(sweptFeatureTrigger({x:0,y:0},{x:100,y:0},{x:50,y:12,r:5}),false);
});
function runPool(s,seconds=25,dt=1/120){for(let i=0;i<seconds/dt&&s.phase==='rolling';i++)stepPool(s,dt);return s}
function shot(s,{contact=1,potted=[],pocket=0,rail=true,called=null}={}){
  assert.equal(strike(s,0,.5,called),true);s.shot.firstContact=contact;s.shot.rail=rail;
  for(const id of potted){s.balls.find(b=>b.id===id).pocketed=true;s.shot.potted.push(id);s.shot.pockets[id]=pocket}
  for(const b of s.balls)b.vx=b.vy=0;finishShot(s);return s;
}
test('pool opening break disperses the rack and settles across fixed frame rates',()=>{
  const states=[1/30,1/60,1/120].map(dt=>{const s=createPool('two');strike(s,0,1);return runPool(s,25,dt)});
  for(const s of states){assert.notEqual(s.phase,'rolling');assert.ok(s.shot.firstContact);assert.ok(s.balls.every(finiteBody));assert.ok(s.balls.filter(b=>b.id&&!b.pocketed&&Math.abs(b.x-690)>100).length>=3);assert.ok(s.balls.every(b=>b.pocketed||Math.hypot(b.vx,b.vy)===0))}
  for(let i=1;i<states.length;i++)for(let b=0;b<16;b++)assert.ok(Math.hypot(states[i].balls[b].x-states[0].balls[b].x,states[i].balls[b].y-states[0].balls[b].y)<.01);
});
test('pool collision paths pocket an object ball and detect cue scratches',()=>{
  const s=createPool();s.balls.slice(1).forEach(b=>b.pocketed=true);const object=s.balls.find(b=>b.id===1);Object.assign(object,{x:500,y:130,pocketed:false});Object.assign(s.balls[0],{x:500,y:240});assert.equal(aimTrace(s,-Math.PI/2).target.id,1);strike(s,-Math.PI/2,.25);runPool(s);assert.ok(object.pocketed);assert.equal(s.phase,'over');
  const scratch=createPool();scratch.balls.slice(1).forEach(b=>{b.x=700;b.y=300+b.id*2});Object.assign(scratch.balls[0],{x:500,y:160});strike(scratch,-Math.PI/2,.25);runPool(scratch);assert.equal(scratch.phase,'placement');assert.equal(scratch.fouls[0],1);assert.equal(placeCue(scratch,300,250),true);assert.equal(scratch.balls[0].pocketed,false);
});
test('eight-ball assigns groups, switches turns, and gives ball in hand for fouls',()=>{
  const s=createPool('two');shot(s,{potted:[2],contact:2});assert.deepEqual(s.groups,['solids','stripes']);assert.equal(s.turn,0);
  shot(s,{contact:1,potted:[],rail:true});assert.equal(s.turn,1);
  shot(s,{contact:1,potted:[],rail:true});assert.equal(s.phase,'placement');assert.equal(s.turn,0);assert.equal(s.fouls[1],1);
  assert.equal(canPlaceCue(s,60,60),false);assert.equal(canPlaceCue(s,s.balls[1].x,s.balls[1].y),false);assert.equal(placeCue(s,280,220),true);
  shot(s,{contact:1,rail:false});assert.equal(s.phase,'placement');assert.equal(s.turn,1);
  assert.ok(cpuPlace(s));shot(s,{contact:null});assert.equal(s.phase,'placement');assert.match(s.note,/No object ball/);
});
test('eight-ball requires the cleared group and called pocket; break eights are re-spotted',()=>{
  const breakEight=createPool('two');shot(breakEight,{potted:[8],contact:1});assert.notEqual(breakEight.phase,'over');assert.equal(breakEight.balls.find(b=>b.id===8).pocketed,false);
  const early=createPool('two');early.shots=1;early.groups=['solids','stripes'];shot(early,{contact:1,potted:[8],called:0});assert.equal(early.winner,1);
  for(const correct of [true,false]){const s=createPool('two');s.shots=1;s.groups=['solids','stripes'];s.balls.forEach(b=>{if(b.id>0&&b.id<8)b.pocketed=true});assert.equal(strike(s,0,.5),false);shot(s,{contact:8,potted:[8],pocket:2,called:correct?2:0});assert.equal(s.phase,'over');assert.equal(s.winner,correct?0:1)}
  const scratch=createPool('two');scratch.shots=1;scratch.groups=['solids','stripes'];scratch.balls.forEach(b=>{if(b.id>0&&b.id<8)b.pocketed=true});shot(scratch,{contact:8,potted:[8,0],called:0});assert.equal(scratch.winner,1);
});
test('computer finds and executes an unobstructed legal pool shot',()=>{
  const s=createPool('cpu');s.turn=1;s.shots=1;s.groups=['stripes','solids'];s.balls.slice(1).forEach(b=>b.pocketed=true);const target=s.balls.find(b=>b.id===1);Object.assign(target,{x:500,y:150,pocketed:false});Object.assign(s.balls[0],{x:500,y:310});
  const plan=cpuShot(s);assert.ok(Number.isFinite(plan.angle));assert.ok(plan.power>0&&plan.power<=1);assert.equal(strike(s,plan.angle,plan.power,plan.pocket),true);runPool(s);assert.ok(target.pocketed);assert.equal(s.turn,1);
});
test('pool practice layouts start with fixed playable positions',()=>{
  const standard=createPool('solo'),line=createPool('solo','line-drill'),bank=createPool('solo','bank-shot');
  assert.equal(standard.layout,'standard');assert.equal(line.layout,'line-drill');assert.equal(bank.layout,'bank-shot');
  assert.deepEqual([line.balls[0].x,line.balls[0].y],[235,270]);assert.equal(line.balls.filter(b=>b.id&&!b.pocketed).length,5);
  assert.equal(bank.balls.filter(b=>b.id&&!b.pocketed).length,3);assert.notDeepEqual(bank.balls.slice(0,4).map(b=>[b.x,b.y]),line.balls.slice(0,4).map(b=>[b.x,b.y]));
});
test('pool cpu profiles select legal targets with bounded controlled shots',()=>{
  for(const difficulty of ['easy','standard','hard']){const s=createPool('cpu');s.turn=1;s.shots=1;s.groups=['stripes','solids'];s.balls.slice(1).forEach(b=>b.pocketed=true);const target=s.balls.find(b=>b.id===1);Object.assign(target,{x:500,y:150,pocketed:false});Object.assign(s.balls[0],{x:500,y:310});const plan=cpuShot(s,difficulty);assert.ok(legalTargets(s).some(b=>b.id===plan.targetId));assert.ok(Number.isFinite(plan.angle));assert.ok(plan.power>=.05&&plan.power<=1);assert.ok(plan.pocket>=0&&plan.pocket<6);if(difficulty!=='easy'){assert.equal(strike(s,plan.angle,plan.power,plan.pocket),true);runPool(s);assert.equal(target.pocketed,true)}}
});
test('slot evaluator scores the 5x3 paylines and longest match',()=>{
  const grid=Array.from({length:5},(_,col)=>['seven',['circuit','crystal','lightning','orbit','crystal'][col],['crystal','orbit','circuit','wild','lightning'][col]]);
  const evaluation=evaluateSlots(grid,1);assert.equal(PAYLINES.length,10);assert.equal(grid.length,5);assert.ok(grid.every(column=>column.length===3));assert.deepEqual(evaluation.wins.map(w=>w.line),[1]);assert.equal(evaluation.payout,400);assert.equal(evaluation.cost,10);
});
test('wild substitutes for regular symbols but scatter ends a payline',()=>{
  const grid=Array.from({length:5},()=>['circuit','orbit','lightning']);['circuit','wild','circuit','circuit','wild'].forEach((id,col)=>grid[col][0]=id);
  assert.equal(evaluateSlots(grid,2).wins[0].award,40);grid[1][0]='scatter';assert.equal(evaluateSlots(grid,2).wins.some(w=>w.line===1),false);
});
test('three scatters trigger five free spins without a scatter award',()=>{
  let draw=0;const picks=[19,19,19],{wallet,result}=spinSlots(freshWallet(),1,()=>picks[draw++]??0,'bonus-spin',1000);
  assert.equal(result.bonusTriggered,true);assert.equal(result.freeSpinsAwarded,5);assert.equal(result.payout,0);assert.equal(result.cost,10);assert.equal(wallet.freeSpins,5);assert.equal(wallet.credits,1990);
});
test('free spin costs no credits, pays at 1.5x, and cannot retrigger',()=>{
  const trigger=spinSlots(freshWallet(),1,()=>19,'trigger',1000).wallet;
  const free=spinSlots(trigger,1,()=>0,'free-1',1001);assert.equal(free.result.cost,0);assert.equal(free.result.freeSpinIndex,1);assert.equal(free.result.payout,300);assert.equal(free.wallet.credits,trigger.credits+free.result.payout);assert.equal(free.wallet.freeSpins,4);
  const noRetrigger=spinSlots(free.wallet,1,()=>19,'free-2',1002);assert.equal(noRetrigger.result.bonusTriggered,false);assert.equal(noRetrigger.result.freeSpinsAwarded,0);assert.equal(noRetrigger.wallet.freeSpins,3);
});
test('slot draws use documented weights and calculate exact theoretical return',()=>{
  const counts=Object.fromEntries(SYMBOLS.map(s=>[s.id,0]));for(let n=0;n<20;n++)counts[sampleSymbol(()=>n)]++;for(const s of SYMBOLS)assert.equal(counts[s.id],s.weight);
  assert.throws(()=>sampleSymbol(()=>20));assert.throws(()=>randomIndex(0));assert.equal(PAYLINES.length,10);assert.ok(Math.abs(theoreticalReturn()-0.8664350938499594)<1e-9);
});
test('slot wallet migrates legacy history and prevents duplicate settlement IDs',()=>{
  const old={version:1,credits:145,spins:7,totalBet:20,totalWon:42,bestWin:20,history:[{grid:[['chip','gem','orbit'],['gem','seven','bolt'],['orbit','chip','gem']],wins:[{line:1}],bet:1,cost:5,payout:8,id:'legacy-1',at:900}]};
  const migrated=readWallet(JSON.stringify(old));assert.equal(migrated.version,2);assert.equal(migrated.credits,145);assert.equal(migrated.history[0].legacy,true);assert.equal(migrated.history[0].id,'legacy-1');
  const first=spinSlots(freshWallet(),1,()=>0,'once',1000);assert.throws(()=>spinSlots(first.wallet,1,()=>0,'once',1001),/already settled/);
  const bonus=spinSlots(freshWallet(),1,()=>19,'reload-bonus',1002).wallet,reloaded=readWallet(JSON.stringify(bonus));assert.equal(reloaded.freeSpins,5);assert.equal(reloaded.history[0].id,'reload-bonus');assert.ok(reloaded.settlementIds.includes('reload-bonus'));
  assert.deepEqual(readWallet('{broken'),freshWallet());assert.deepEqual(readWallet(JSON.stringify({...first.wallet,credits:-1})),freshWallet());
});
