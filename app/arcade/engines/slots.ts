export const SYMBOLS=[
 {id:'circuit',name:'Circuit',weight:6},{id:'crystal',name:'Crystal',weight:5},{id:'orbit',name:'Orbit',weight:4},
 {id:'lightning',name:'Lightning',weight:2},{id:'seven',name:'Neon seven',weight:1},{id:'wild',name:'Wild',weight:1},{id:'scatter',name:'Scatter',weight:1},
] as const;
export const PAYLINES=[
 [0,0,0,0,0],[1,1,1,1,1],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],
 [0,0,1,2,2],[2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1],[0,1,1,1,0],
] as const;
export const PAYTABLE={circuit:{3:2,4:6,5:20},crystal:{3:3,4:10,5:35},orbit:{3:5,4:18,5:70},lightning:{3:10,4:40,5:160},seven:{3:20,4:100,5:400}} as const;
export type SymbolId=typeof SYMBOLS[number]['id'];
export type PaySymbol=keyof typeof PAYTABLE;
export type SlotGrid=SymbolId[][];
export type SlotWin={line:number;symbol:PaySymbol;multiplier:number;award:number};
export type SpinResult={grid:SlotGrid;wins:SlotWin[];bet:number;cost:number;payout:number;id:string;at:number;bonusTriggered:boolean;freeSpinsAwarded:number;freeSpinIndex:number|null};
export type LegacySpinResult={legacy:true;grid:string[][];wins:unknown[];bet:number;cost:number;payout:number;id:string;at:number};
export type SlotHistoryResult=SpinResult|LegacySpinResult;
export type SlotWallet={version:2;credits:number;spins:number;totalBet:number;totalWon:number;bestWin:number;freeSpins:number;settlementIds:string[];history:SlotHistoryResult[]};
export const freshWallet=():SlotWallet=>({version:2,credits:2000,spins:0,totalBet:0,totalWon:0,bestWin:0,freeSpins:0,settlementIds:[],history:[]});

export function randomIndex(max:number){if(!Number.isSafeInteger(max)||max<1||max>0xffffffff)throw Error('Invalid random range');const limit=0x100000000-(0x100000000%max),array=new Uint32Array(1);do{crypto.getRandomValues(array)}while(array[0]>=limit);return array[0]%max}
export function sampleSymbol(pick:(max:number)=>number=randomIndex):SymbolId{let draw=pick(20);if(!Number.isInteger(draw)||draw<0||draw>=20)throw Error('Invalid random sample');for(const s of SYMBOLS){draw-=s.weight;if(draw<0)return s.id}throw Error('Invalid symbol sample')}

function lineMultiplier(cells:SymbolId[]):{symbol:PaySymbol;count:number;multiplier:number}|null{
 if(cells[0]==='scatter')return null;
 const prefix=[] as SymbolId[];for(const id of cells){if(id==='scatter')break;prefix.push(id)}
 const symbol=(prefix.find(id=>id!=='wild')??'seven') as PaySymbol;
 let count=0;for(const id of prefix){if(id!==symbol&&id!=='wild')break;count++}
 if(count<3)return null;
 return {symbol,count,multiplier:PAYTABLE[symbol][count as 3|4|5]};
}
function validGrid(grid:unknown):grid is SlotGrid{return Array.isArray(grid)&&grid.length===5&&grid.every(column=>Array.isArray(column)&&column.length===3&&column.every(id=>SYMBOLS.some(s=>s.id===id)))}
export function evaluateSlots(grid:SlotGrid,bet:number,payoutMultiplier=1){
 if(![1,2,5,10].includes(bet)||!Number.isFinite(payoutMultiplier)||payoutMultiplier<1||!validGrid(grid))throw Error('Invalid spin');
 const wins:SlotWin[]=[];PAYLINES.forEach((rows,line)=>{const match=lineMultiplier(rows.map((row,col)=>grid[col][row]));if(match)wins.push({line:line+1,symbol:match.symbol,multiplier:match.multiplier*payoutMultiplier,award:match.multiplier*payoutMultiplier*bet})});
 return {wins,payout:wins.reduce((n,w)=>n+w.award,0),cost:bet*PAYLINES.length};
}
function scatterCount(grid:SlotGrid){return grid.reduce((n,column)=>n+column.filter(id=>id==='scatter').length,0)}
export function spinSlots(wallet:SlotWallet,bet:number,pick:(max:number)=>number=randomIndex,id=crypto.randomUUID(),at=Date.now()){
 if(![1,2,5,10].includes(bet))throw Error('Invalid spin');
 if(wallet.settlementIds.includes(id))throw Error('Spin already settled');
 const freeSpin=wallet.freeSpins>0,cost=freeSpin?0:bet*PAYLINES.length;
 if(wallet.credits<cost)throw Error('Not enough play credits for this spin. Refill to keep playing.');
 const grid:SlotGrid=Array.from({length:5},()=>Array.from({length:3},()=>sampleSymbol(pick))),bonusTriggered=!freeSpin&&scatterCount(grid)>=3,evaluation=evaluateSlots(grid,bet,freeSpin?1.5:1);
 const result:SpinResult={grid,...evaluation,bet,cost,id,at,bonusTriggered,freeSpinsAwarded:bonusTriggered?5:0,freeSpinIndex:freeSpin?6-wallet.freeSpins:null};
 const next:SlotWallet={version:2,credits:wallet.credits-cost+result.payout,spins:wallet.spins+1,totalBet:wallet.totalBet+cost,totalWon:wallet.totalWon+result.payout,bestWin:Math.max(wallet.bestWin,result.payout),freeSpins:Math.max(0,wallet.freeSpins-(freeSpin?1:0))+(bonusTriggered?5:0),settlementIds:[...wallet.settlementIds,id].slice(-128),history:[result,...wallet.history].slice(0,12)};
 return {wallet:next,result};
}

function validCounters(data:any){return data&&['credits','spins','totalBet','totalWon','bestWin'].every(k=>Number.isFinite(data[k])&&data[k]>=0&&data[k]<=1e12)&&Number.isSafeInteger(data.spins)&&Number.isSafeInteger(data.totalBet)}
function legacyHistory(value:unknown):LegacySpinResult|null{
 if(!value||typeof value!=='object')return null;const r=value as any;
 if(typeof r.id!=='string'||!Number.isFinite(r.at)||!Number.isFinite(r.bet)||!Number.isFinite(r.cost)||r.cost<0||!Number.isFinite(r.payout)||r.payout<0||!Array.isArray(r.grid)||!Array.isArray(r.wins))return null;
 if(![1,2,5,10].includes(r.bet)||r.cost!==r.bet*5||r.grid.length!==3||r.grid.some((col:unknown)=>!Array.isArray(col)||col.length!==3||col.some((id:unknown)=>typeof id!=='string'||!(['chip','gem','orbit','bolt','seven'] as string[]).includes(id))))return null;
 return {legacy:true,grid:r.grid,wins:r.wins,bet:r.bet,cost:r.cost,payout:r.payout,id:r.id,at:r.at};
}
function validSpin(value:unknown):value is SpinResult{
 if(!value||typeof value!=='object')return false;const r=value as SpinResult;
 try{if(typeof r.id!=='string'||!Number.isFinite(r.at)||!validGrid(r.grid)||typeof r.bonusTriggered!=='boolean'||!Number.isSafeInteger(r.freeSpinsAwarded)||(r.freeSpinIndex!==null&&(!Number.isSafeInteger(r.freeSpinIndex)||r.freeSpinIndex<1||r.freeSpinIndex>5)))return false;
  const free=r.freeSpinIndex!==null,bonus=!free&&scatterCount(r.grid)>=3;if(r.bonusTriggered!==bonus||r.freeSpinsAwarded!==(bonus?5:0))return false;
  const expected=evaluateSlots(r.grid,r.bet,free?1.5:1),cost=free?0:r.bet*PAYLINES.length;
  return r.cost===cost&&r.payout===expected.payout&&JSON.stringify(r.wins)===JSON.stringify(expected.wins);
 }catch{return false}
}
export function readWallet(value:string|null):SlotWallet{
 try{
  const data=JSON.parse(value||'null');if(!validCounters(data))return freshWallet();
  if(data.version===1){
   if(!Number.isSafeInteger(data.credits)||!Number.isSafeInteger(data.totalWon)||!Number.isSafeInteger(data.bestWin))return freshWallet();
   const history:LegacySpinResult[]=(Array.isArray(data.history)?data.history:[]).slice(0,12).map((record:unknown):LegacySpinResult|null=>legacyHistory(record)).filter((r:LegacySpinResult|null):r is LegacySpinResult=>r!==null);
   return {version:2,credits:data.credits,spins:data.spins,totalBet:data.totalBet,totalWon:data.totalWon,bestWin:data.bestWin,freeSpins:0,settlementIds:history.map(r=>r.id).slice(-128),history};
  }
  if(data.version!==2||!Number.isSafeInteger(data.freeSpins)||data.freeSpins<0||data.freeSpins>100||!Array.isArray(data.settlementIds)||data.settlementIds.some((id:unknown)=>typeof id!=='string'))return freshWallet();
  const ids:string[]=[...new Set(data.settlementIds as string[])].slice(-128),seen=new Set<string>(),history:SlotHistoryResult[]=(Array.isArray(data.history)?data.history:[]).slice(0,12).map((record:unknown):SlotHistoryResult|null=>{
   const spin=validSpin(record)?record:legacyHistory(record);if(!spin||seen.has(spin.id))return null;seen.add(spin.id);return spin;
  }).filter((r:SlotHistoryResult|null):r is SlotHistoryResult=>r!==null);
  const settlementIds=[...new Set([...ids,...history.map(record=>record.id)])].slice(-128);
  return {version:2,credits:data.credits,spins:data.spins,totalBet:data.totalBet,totalWon:data.totalWon,bestWin:data.bestWin,freeSpins:data.freeSpins,settlementIds,history};
 }catch{return freshWallet()}
}

let returnCache:number|undefined;
export function theoreticalReturn(){
 if(returnCache!==undefined)return returnCache;
 let lineNumerator=0;
 const visit=(cells:SymbolId[],weight:number)=>{if(cells.length===5){const win=lineMultiplier(cells);if(win)lineNumerator+=weight*win.multiplier;return}for(const symbol of SYMBOLS)visit([...cells,symbol.id],weight*symbol.weight)};
 visit([],1);
 let triggerNumerator=0;for(let k=3;k<=15;k++){let choose=1;for(let i=1;i<=k;i++)choose=choose*(16-i)/i;triggerNumerator+=choose*19**(15-k)}
 const lineExpected=lineNumerator/20**5,bonusProbability=triggerNumerator/20**15;
 returnCache=lineExpected*(1+5*1.5*bonusProbability);return returnCache;
}
