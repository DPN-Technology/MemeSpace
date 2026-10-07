export type ChallengeGame='pinball'|'pool'|'slots';
export type ArcadeEvent=
 | {id:string;game:'pinball';type:'mission-complete'}
 | {id:string;game:'pool';type:'rack-clear'}
 | {id:string;game:'slots';type:'bonus-triggered'};
export type ChallengeState={version:1;counts:{pinballMissions:number;poolRacks:number;slotBonuses:number};daily:{date:string;complete:Record<ChallengeGame,boolean>};dailyHistory:Record<string,Record<ChallengeGame,boolean>>;eventIds:string[]};
export type DailyChallenge={id:string;game:ChallengeGame;title:string;description:string;progress:number;target:1;complete:boolean};
export type MilestoneProgress={game:ChallengeGame;count:number;thresholds:number[];unlocked:number;next:number|null};
const games:ChallengeGame[]=['pinball','pool','slots'];
const titles:Record<ChallengeGame,string[]>={pinball:['Route Runner','Orbit Sequence','Reactor Mission'],pool:['Rack Runner','Clean Table','Practice Circuit'],slots:['Scatter Signal','Bonus Frequency','Free Spin Circuit']};
const descriptions:Record<ChallengeGame,string>={pinball:'Complete a Left Orbit → Spinner → Right Orbit mission.',pool:'Clear a practice rack.',slots:'Trigger a Scatter bonus round.'};
const thresholds:Record<ChallengeGame,number[]>={pinball:[1,10,50],pool:[5,25],slots:[1,10,25]};
export function utcChallengeDate(at=new Date()){return `${at.getUTCFullYear()}-${String(at.getUTCMonth()+1).padStart(2,'0')}-${String(at.getUTCDate()).padStart(2,'0')}`}
export function challengeStorageKey(scope:string){return `memespace-arcade-challenges:${scope}`}
const emptyDaily=():Record<ChallengeGame,boolean>=>({pinball:false,pool:false,slots:false});
export function createChallengeState(at=new Date()):ChallengeState{const date=utcChallengeDate(at),complete=emptyDaily();return {version:1,counts:{pinballMissions:0,poolRacks:0,slotBonuses:0},daily:{date,complete},dailyHistory:{[date]:complete},eventIds:[]}}
function dated(state:ChallengeState,at:Date){const date=utcChallengeDate(at);if(state.daily.date===date)return state;const complete=state.dailyHistory[date]||emptyDaily();return {...state,daily:{date,complete}}}
export function applyArcadeEvent(state:ChallengeState,event:ArcadeEvent,at=new Date()):ChallengeState{
 if(!event.id||state.eventIds.includes(event.id))return state;
 const current=dated(state,at),field=event.game==='pinball'?'pinballMissions':event.game==='pool'?'poolRacks':'slotBonuses',complete={...current.daily.complete,[event.game]:true},dailyHistory={...current.dailyHistory,[current.daily.date]:complete};
 const dates=Object.keys(dailyHistory).sort().slice(-30),recent=Object.fromEntries(dates.map(date=>[date,dailyHistory[date]]));
 return {...current,counts:{...current.counts,[field]:Math.min(1_000_000_000,current.counts[field]+1)},daily:{...current.daily,complete},dailyHistory:recent,eventIds:[...current.eventIds,event.id].slice(-500)};
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
  const history=data.dailyHistory;if(!history||typeof history!=='object'||Array.isArray(history)||!Array.isArray(data.eventIds)||data.eventIds.some((id:unknown)=>typeof id!=='string'))return createChallengeState(at);
  const validHistory:ChallengeState['dailyHistory']={};for(const [date,complete] of Object.entries(history)){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!complete||games.some(game=>typeof (complete as any)[game]!=='boolean'))return createChallengeState(at);validHistory[date]=complete as Record<ChallengeGame,boolean>}
  const dates=Object.keys(validHistory).sort().slice(-30),dailyHistory=Object.fromEntries(dates.map(date=>[date,validHistory[date]])),date=utcChallengeDate(at),complete=dailyHistory[date]||emptyDaily();
  return {version:1,counts:{...data.counts},daily:{date,complete},dailyHistory,eventIds:[...new Set(data.eventIds as string[])].slice(-500)};
 }catch{return createChallengeState(at)}
}
