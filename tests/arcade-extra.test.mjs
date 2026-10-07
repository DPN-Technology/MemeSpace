import test from 'node:test';
import assert from 'node:assert/strict';
import {createPinball,launchPinball,stepPinball,pinballFeatureHit} from '../app/arcade/engines/pinball.ts';
import {sweptFeatureTrigger} from '../app/arcade/engines/pinball-layout.ts';
import {createChallengeState,challengeStorageKey,dailyChallenges,recordChallengeEvent,readChallengeState,milestoneProgress} from '../app/arcade/engines/challenges.ts';

test('pinball spinner pays its eight-hit charge bonus once',()=>{
  const s=createPinball();s.phase='playing';for(let i=0;i<8;i++){s.time=i*.21;pinballFeatureHit(s,'spinner')}assert.equal(s.spinnerCharge,0);assert.equal(s.score,450);assert.equal(s.featureHits.spinner,8);
});
test('pinball swept sensors catch a fast ball between frames',()=>{
  assert.equal(sweptFeatureTrigger({x:0,y:0},{x:100,y:0},{x:50,y:0,r:5}),true);assert.equal(sweptFeatureTrigger({x:0,y:0},{x:100,y:0},{x:50,y:12,r:5}),false);
  const s=createPinball();launchPinball(s);Object.assign(s.balls[0],{x:76,y:190,vx:1200,vy:0});stepPinball(s,1/240,{left:false,right:false});assert.ok(s.featureHits['left-orbit']>0);
});
test('daily arcade challenges rotate on UTC dates and stay scoped by identity',()=>{
  const today=dailyChallenges(new Date('2026-10-07T23:59:59Z')),tomorrow=dailyChallenges(new Date('2026-10-08T00:00:01Z'));
  assert.equal(today.length,3);assert.equal(new Set(today.map(c=>c.game)).size,3);assert.notEqual(today[0].id,tomorrow[0].id);assert.equal(challengeStorageKey('player-7'),'memespace-arcade-challenges:player-7');
});
test('arcade challenge events complete daily goals and advance milestones',()=>{
  let s=createChallengeState(new Date('2026-10-07T12:00:00Z'));s=recordChallengeEvent(s,'pinball-mission',new Date('2026-10-07T13:00:00Z'));assert.equal(dailyChallenges(new Date('2026-10-07T13:00:00Z'),s).find(c=>c.game==='pinball').complete,true);assert.equal(milestoneProgress(s).find(m=>m.game==='pinball').unlocked,1);
  for(let i=0;i<5;i++)s=recordChallengeEvent(s,'pool-rack',new Date('2026-10-07T14:00:00Z'));assert.equal(milestoneProgress(s).find(m=>m.game==='pool').unlocked,1);assert.equal(s.counts.poolRacks,5);
  s=recordChallengeEvent(s,'slot-bonus',new Date('2026-10-08T00:01:00Z'));assert.equal(s.daily.date,'2026-10-08');assert.equal(dailyChallenges(new Date('2026-10-08T00:01:00Z'),s).find(c=>c.game==='slots').complete,true);
});
test('arcade challenge storage resets malformed data and preserves lifetime counts',()=>{
  assert.deepEqual(readChallengeState('{broken',new Date('2026-10-07T12:00:00Z')),createChallengeState(new Date('2026-10-07T12:00:00Z')));
  let s=createChallengeState(new Date('2026-10-07T12:00:00Z'));for(let i=0;i<25;i++)s=recordChallengeEvent(s,'slot-bonus',new Date('2026-10-07T12:00:00Z'));const restored=readChallengeState(JSON.stringify(s),new Date('2026-10-08T00:00:00Z'));assert.equal(restored.counts.slotBonuses,25);assert.equal(restored.daily.date,'2026-10-08');assert.equal(milestoneProgress(restored).find(m=>m.game==='slots').unlocked,3);
});
