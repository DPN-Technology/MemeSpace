import test from 'node:test';
import assert from 'node:assert/strict';
import {createPinball,launchPinball,stepPinball,laneBall,plungerReady} from '../app/arcade/engines/pinball.ts';
import {createPool,strike,stepPool,finishShot,placeCue,cpuPlace} from '../app/arcade/engines/pool.ts';

function rolled(s,shot){s.phase='rolling';s.shot={firstContact:null,potted:[],pockets:{},rail:false,calledPocket:null,breakShot:false,remaining:7,...shot};finishShot(s)}
function cpuMatch(){const s=createPool('cpu');s.shots=1;s.groups=['solids','stripes'];return s}

test('#18 a legal pocket keeps the turn and the cue ball where it stopped', () => {
  const s=cpuMatch();Object.assign(s.balls[0],{x:402,y:233});
  rolled(s,{firstContact:1,potted:[1],pockets:{1:0},rail:true});
  assert.equal(s.turn,0);assert.equal(s.phase,'aim');assert.equal(s.inHand,false);
  assert.deepEqual([s.balls[0].x,s.balls[0].y],[402,233]);
});

test('#18 a legal miss passes the turn without granting ball in hand', () => {
  const s=cpuMatch();Object.assign(s.balls[0],{x:402,y:233});
  rolled(s,{firstContact:1,potted:[],rail:true});
  assert.equal(s.turn,1);assert.equal(s.phase,'aim');assert.equal(s.inHand,false);
  assert.equal(cpuPlace(s),false);assert.equal(placeCue(s,300,300),false);
  assert.deepEqual([s.balls[0].x,s.balls[0].y],[402,233]);
});

test('#18 fouls and scratches award ball in hand exactly once', () => {
  const s=cpuMatch();rolled(s,{firstContact:9,potted:[],rail:true});
  assert.equal(s.turn,1);assert.equal(s.phase,'placement');assert.equal(s.inHand,true);
  assert.equal(cpuPlace(s),true);assert.equal(s.inHand,false);assert.equal(s.phase,'aim');
  assert.equal(placeCue(s,300,300),false);
  const t=cpuMatch();rolled(t,{firstContact:1,potted:[0],rail:true});
  assert.equal(t.inHand,true);assert.equal(placeCue(t,300,250),true);assert.equal(t.inHand,false);
});

test('#18 a non-scratch foul keeps the cue where it rested when the computer places', () => {
  const s=cpuMatch();Object.assign(s.balls[0],{x:402,y:233});
  rolled(s,{firstContact:null,potted:[],rail:false});
  assert.equal(s.inHand,true);assert.equal(cpuPlace(s),true);
  assert.deepEqual([s.balls[0].x,s.balls[0].y],[402,233]);
});

test('#18 repeated shots never reset ball positions without a foul', () => {
  const s=createPool('cpu');for(const b of s.balls.slice(1))b.pocketed=b.id>3;
  Object.assign(s.balls[0],{x:300,y:270});s.shots=1;
  assert.equal(strike(s,0,.2),true);for(let i=0;i<4000&&s.phase==='rolling';i++)stepPool(s,1/60);
  assert.notEqual(s.phase,'rolling');
  if(s.phase==='aim')assert.equal(s.inHand,false);
});

function park(ball){Object.assign(ball,{x:512,y:749,vx:0,vy:0})}

test('#17 a ball parked in the lane during multiball can be relaunched', () => {
  const s=createPinball();launchPinball(s);
  s.balls.push({x:210,y:114,vx:0,vy:0,r:9,id:90,trail:[]});park(s.balls[0]);
  assert.equal(s.phase,'playing');assert.equal(s.balls.length,2);
  assert.ok(laneBall(s));assert.equal(plungerReady(s),true);
  assert.equal(launchPinball(s,.9),true);
  assert.equal(s.balls.length,2);assert.ok(s.balls[0].vy<-1000);assert.equal(plungerReady(s),false);
});

test('#17 the plunger rearms across repeated multiball launch cycles', () => {
  const s=createPinball();launchPinball(s);
  s.balls.push({x:300,y:300,vx:0,vy:0,r:9,id:91,trail:[]});
  for(let cycle=0;cycle<3;cycle++){
    park(s.balls[0]);assert.equal(plungerReady(s),true,`cycle ${cycle}`);
    assert.equal(launchPinball(s,.8),true);assert.equal(launchPinball(s,.8),false);
    stepPinball(s,1/120,{left:false,right:false});
    assert.ok(s.balls.length>=1);
  }
});

test('#17 relaunch is refused when no ball is in the lane', () => {
  const s=createPinball();launchPinball(s);s.balls.push({x:300,y:300,vx:0,vy:0,r:9,id:92,trail:[]});
  assert.equal(laneBall(s),undefined);assert.equal(launchPinball(s),false);
});
