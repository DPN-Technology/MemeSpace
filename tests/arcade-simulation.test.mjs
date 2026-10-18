import test from 'node:test';
import assert from 'node:assert/strict';
import {createPool,strike,stepPool,cpuShot,cpuPlace} from '../app/arcade/engines/pool.ts';
import {createPinball,launchPinball,stepPinball,pinballHit,laneBall,plungerReady} from '../app/arcade/engines/pinball.ts';

test('#18 simulated CPU matches never move the cue ball without ball in hand', () => {
  let shots=0,placements=0;
  for(const difficulty of ['easy','standard','hard'])for(let game=0;game<6;game++){
    const s=createPool('cpu');
    for(let guard=0;guard<400&&s.phase!=='over';guard++){
      if(s.phase==='placement'){assert.equal(s.inHand,true,'placement only with ball in hand');if(s.turn===1){cpuPlace(s);placements++}else{const ok=cpuPlace(s);assert.ok(ok)}continue}
      const cue=s.balls[0],before=[cue.x,cue.y];
      assert.equal(s.inHand,false);
      const plan=s.turn===1?cpuShot(s,difficulty):{angle:game*.9,power:.3+game*.1,pocket:0};
      if(s.groups[s.turn]&&s.balls.filter(b=>!b.pocketed&&b.id>0&&b.id<8===(s.groups[s.turn]==='solids')&&b.id!==8).length===0)plan.pocket=plan.pocket??0;
      if(!strike(s,plan.angle,plan.power,plan.pocket))continue;shots++;
      assert.deepEqual([cue.x,cue.y],before,'cue untouched when shot starts');
      for(let i=0;i<3000&&s.phase==='rolling';i++)stepPool(s,1/60);
      assert.notEqual(s.phase,'rolling');
    }
  }
  assert.ok(shots>50);
});

test('#17 multiball with repeated lane returns never soft-locks the plunger', () => {
  const s=createPinball();launchPinball(s);
  s.targets=[true,true,false];pinballHit(s,2,true);
  assert.equal(s.multiball,true);assert.ok(s.balls.length>=3);
  for(let cycle=0;cycle<5;cycle++){
    Object.assign(s.balls[0],{x:512,y:749,vx:0,vy:0});
    assert.ok(laneBall(s));assert.equal(plungerReady(s),true);
    assert.equal(launchPinball(s,.7),true);
    for(let i=0;i<20;i++)stepPinball(s,1/60,{left:false,right:false});
    if(s.phase==='over')break;
    assert.ok(s.balls.length>=1);
  }
});
