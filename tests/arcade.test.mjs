import test from 'node:test';
import assert from 'node:assert/strict';
import {circleCollision,capsuleCollision,finiteBody} from '../app/arcade/engines/physics.ts';
import {createPinball,launchPinball,stepPinball,nudgePinball,pinballHit,drainPinball} from '../app/arcade/engines/pinball.ts';
import {createPool,strike,stepPool,finishShot,placeCue,canPlaceCue,cpuShot,cpuPlace,aimTrace} from '../app/arcade/engines/pool.ts';
import {SYMBOLS,PAYLINES,sampleSymbol,evaluateSlots,spinSlots,freshWallet,readWallet,randomIndex} from '../app/arcade/engines/slots.ts';
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
test('slot weights cover each sample exactly and have the documented mathematical return',()=>{
  const counts=Object.fromEntries(SYMBOLS.map(s=>[s.id,0]));for(let n=0;n<20;n++)counts[sampleSymbol(()=>n)]++;
  for(const s of SYMBOLS)assert.equal(counts[s.id],s.weight);assert.throws(()=>sampleSymbol(()=>20));assert.throws(()=>randomIndex(0));
  let payout=0;for(let a=0;a<20;a++)for(let b=0;b<20;b++)for(let c=0;c<20;c++){const ids=[a,b,c].map(n=>sampleSymbol(()=>n));if(ids.every(id=>id===ids[0]))payout+=SYMBOLS.find(s=>s.id===ids[0]).payout}assert.equal(payout/8000,.89075);
});
test('slot payouts cover all five lines, add wins, and reject malformed spins',()=>{
  const allSeven=Array.from({length:3},()=>['seven','seven','seven']);const evaluation=evaluateSlots(allSeven,2);assert.equal(evaluation.wins.length,5);assert.equal(evaluation.payout,1500);assert.equal(evaluation.cost,10);
  for(let line=0;line<5;line++){const grid=[['chip','gem','orbit'],['gem','orbit','chip'],['orbit','chip','gem']];PAYLINES[line].forEach((row,col)=>grid[col][row]='bolt');assert.ok(evaluateSlots(grid,5).wins.some(w=>w.line===line+1&&w.award===225))}
  for(const bet of [-1,0,3,NaN,Infinity])assert.throws(()=>evaluateSlots(allSeven,bet));assert.throws(()=>evaluateSlots([['made-up']],1));
});
test('slot settlement debits once, retains twelve outcomes and survives reload without replay',()=>{
  const initial=freshWallet(),copy=structuredClone(initial);let {wallet,result}=spinSlots(initial,2,()=>19,'known-spin',1000);assert.deepEqual(initial,copy);assert.equal(wallet.credits,3490);assert.equal(wallet.spins,1);assert.equal(result.payout,1500);
  const reloaded=readWallet(JSON.stringify(wallet));assert.equal(reloaded.credits,3490);assert.equal(reloaded.history[0].id,'known-spin');assert.equal(reloaded.spins,1);
  for(let i=0;i<16;i++)wallet=spinSlots(wallet,1,()=>0,'spin-'+i,2000+i).wallet;assert.equal(wallet.history.length,12);assert.equal(wallet.history[0].id,'spin-15');assert.equal(wallet.spins,17);
  const poor={...freshWallet(),credits:4};assert.throws(()=>spinSlots(poor,1),/Not enough/);assert.equal(poor.credits,4);assert.equal(poor.spins,0);
  assert.deepEqual(readWallet('{broken'),freshWallet());assert.deepEqual(readWallet(JSON.stringify({...wallet,credits:-1})),freshWallet());assert.equal(readWallet(JSON.stringify({...wallet,history:[{...result,payout:999999}]})).history.length,0);
});
