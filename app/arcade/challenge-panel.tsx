'use client';
import {useEffect,useRef,useState} from 'react';
import {applyArcadeEvent,createChallengeState,challengeStorageKey,dailyChallenges,milestoneProgress,readChallengeState} from './engines/challenges';
import type {ArcadeEvent,ChallengeGame,ChallengeState} from './engines/challenges';

export function useArcadeChallenges(scope:string){
 const stateRef=useRef(createChallengeState()),ownerScope=useRef(scope),[state,setState]=useState(stateRef.current),[warning,setWarning]=useState('');
 useEffect(()=>{let next;try{next=readChallengeState(localStorage.getItem(challengeStorageKey(scope)))}catch{next=createChallengeState();setWarning('Progress could not be saved in this browser.')}stateRef.current=next;setState(next)},[scope]);
 function record(event:ArcadeEvent){const next=applyArcadeEvent(stateRef.current,event);stateRef.current=next;setState(next);try{localStorage.setItem(challengeStorageKey(ownerScope.current),JSON.stringify(next));setWarning('')}catch{setWarning('Progress could not be saved in this browser.')}}
 return {state,warning,record};
}

export function ArcadeChallengePanel({game,state,warning}:{game:ChallengeGame;state:ChallengeState;warning:string}){
 const daily=dailyChallenges(new Date(),state).find(challenge=>challenge.game===game)!,milestone=milestoneProgress(state).find(item=>item.game===game)!;
 return <section className="arcade-side-panel arcade-challenge-panel"><p className="arcade-eyebrow">DAILY ARCADE · UTC</p><h3>{daily.title}</h3><p>{daily.description}</p><div className="challenge-progress"><span>{daily.complete?'Complete':'Progress'}</span><b>{daily.complete?'1 / 1':'0 / 1'}</b><i className={daily.complete?'complete':''}/></div><p className="arcade-fine">Lifetime milestones</p><div className="challenge-milestones">{milestone.thresholds.map(level=><span key={level} className={milestone.count>=level?'complete':''}>{level}</span>)}</div><p className="arcade-fine">{milestone.count} completed · {milestone.next===null?'All milestones unlocked':`${milestone.next-milestone.count} to next milestone`}</p>{warning&&<p className="arcade-fine" role="status">{warning}</p>}</section>;
}

export function ArcadeDailyBoard({scope}:{scope:string}){
 const {state,warning}=useArcadeChallenges(scope),now=new Date(),daily=dailyChallenges(now,state),milestones=milestoneProgress(state),nextUtc=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1));
 return <section className="arcade-daily-board"><div className="arcade-section-heading"><div><p className="arcade-eyebrow">DAILY ARCADE · UTC RESET</p><h3>Three challenges. One more reason to play.</h3></div><span>RESETS {nextUtc.toLocaleString([], {weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})} LOCAL TIME</span></div><div className="arcade-daily-grid">{daily.map(challenge=>{const milestone=milestones.find(item=>item.game===challenge.game)!;return <article key={challenge.id} className={'arcade-daily-card '+(challenge.complete?'complete':'')}><small>{challenge.game.toUpperCase()} · {challenge.complete?'COMPLETE':'0 / 1'}</small><h4>{challenge.title}</h4><p>{challenge.description}</p><div>{milestone.unlocked} / {milestone.thresholds.length} milestones · {milestone.next===null?'all unlocked':`${milestone.next} lifetime`}</div></article>})}</div>{warning&&<p className="arcade-fine" role="status">{warning}</p>}</section>;
}
