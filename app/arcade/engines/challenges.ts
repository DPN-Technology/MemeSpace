export type ChallengeGame='pinball'|'pool'|'slots';
export type ChallengeEvent='pinball-mission'|'pool-rack'|'slot-bonus';
export type ChallengeState={version:1;counts:{pinballMissions:number;poolRacks:number;slotBonuses:number};daily:{date:string;complete:Record<ChallengeGame,boolean>}};
export type DailyChallenge={id:string;game:ChallengeGame;title:string;description:string;progress:number;target:1;complete:boolean};
export type MilestoneProgress={game:ChallengeGame;count:number;thresholds:number[];unlocked:number;next:number|null};
const games:ChallengeGame[]=['pinball','pool','slots'];
const titles:Record<ChallengeGame,string[]>={pinball:['Route Runner','Orbit Sequence','Reactor Mission'],pool:['Rack Runner','Clean Table','Practice Circuit'],slots:['Scatter Signal','Bonus Frequency','Free Spin Circuit']};
const descriptions:Record<ChallengeGame,string>={pinball:'Complete a Left Orbit → Spinner → Right Orbit mission.',pool:'Clear a practice rack.',slots:'Trigger a Scatter bonus round.'};
const thresholds:Record<ChallengeGame,number[]>={pinball:[1,10,50],pool:[5,25],slots:[1,10,25]};
export function utcChallengeDate(at=new Date()){return `${at.getUTCFullYear()}-${String(at.getUTCMonth()+1).padStart(2,'0')}-${String(at.getUTCDate()).padStart(2,'0')}`}
export function challengeStorageKey(scope:string){return `memespace-arcade-challenges:${scope}`}
export function createChallengeState(at=new Date()):ChallengeState{return {version:1,counts:{pinballMissions:0,poolRacks:0,slotBonuses:0},daily:{date:utcChallengeDate(at),complete:{pinball:false,pool:false,slots:false}}}}
function dated(state:ChallengeState,at:Date){const date=utcChallengeDate(at);return state.daily.date===date?state:{...state,daily:{date,complete:{pinball:false,pool:false,slots:false}}}}
function fieldFor(event:ChallengeEvent){return event==='pinball-mission'?'pinballMissions':event==='pool-rack'?'poolRacks':'slotBonuses'}
function gameFor(event:ChallengeEvent):ChallengeGame{return event==='pinball-mission'?'pinball':event==='pool-rack'?'pool':'slots'}
export function recordChallengeEvent(state:ChallengeState,event:ChallengeEvent,at=new Date()):ChallengeState{
 const current=dated(state,at),field=fieldFor(event),game=gameFor(event);
 return {...current,counts:{...current.counts,[field]:Math.min(1_000_000_000,current.counts[field]+1)},daily:{...current.daily,complete:{...current.daily.complete,[game]:true}}};
}
export function dailyChallenges(at=new Date(),state:ChallengeState=createChallengeState(at)):DailyChallenge[]{
 const current=dated(state,at),date=utcChallengeDate(at),day=Math.floor(Date.UTC(at.getUTCFullYear(),at.getUTCMonth(),at.getUTCDate())/86_400_000);
 return games.map((game,index)=>({id:`${game}:${date}`,game,title:titles[game][(day+index)%titles[game].length],description:descriptions[game],progress:current.daily.complete[game]?1:0,target:1,complete:current.daily.complete[game]}));
}
export function milestoneProgress(state:ChallengeState):MilestoneProgress[]{
 return games.map(game=>{const count=game==='pinball'?state.counts.pinballMissions:game==='pool'?state.counts.poolRacks:state.counts.slotBonuses,levels=thresholds[game];return {game,count,thresholds:levels,unlocked:levels.filter(level=>count>=level).length,next:levels.find(level=>count<level)??null}});
}
export function readChallengeState(value:string|null,at=new Date()):ChallengeState{
 try{const data=JSON.parse(value||'null');if(!data||data.version!==1||!data.counts||['pinballMissions','poolRacks','slotBonuses'].some(key=>!Number.isSafeInteger(data.counts[key])||data.counts[key]<0||data.counts[key]>1_000_000_000))return createChallengeState(at);
  const complete=data.daily?.complete;if(typeof data.daily?.date!=='string'||!complete||games.some(game=>typeof complete[game]!=='boolean'))return createChallengeState(at);
  return dated({version:1,counts:{...data.counts},daily:{date:data.daily.date,complete:{pinball:complete.pinball,pool:complete.pool,slots:complete.slots}}},at);
 }catch{return createChallengeState(at)}
}
