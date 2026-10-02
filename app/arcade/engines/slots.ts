export const SYMBOLS=[{id:'chip',name:'Circuit',weight:7,payout:8},{id:'gem',name:'Crystal',weight:6,payout:12},{id:'orbit',name:'Orbit',weight:4,payout:20},{id:'bolt',name:'Lightning',weight:2,payout:45},{id:'seven',name:'Neon seven',weight:1,payout:150}] as const;
export const PAYLINES=[[0,0,0],[1,1,1],[2,2,2],[0,1,2],[2,1,0]] as const;
export type SymbolId=typeof SYMBOLS[number]['id'];
export type SlotGrid=SymbolId[][];
export type SlotWin={line:number;symbol:SymbolId;multiplier:number;award:number};
export type SpinResult={grid:SlotGrid;wins:SlotWin[];bet:number;cost:number;payout:number;id:string;at:number};
export type SlotWallet={version:1;credits:number;spins:number;totalBet:number;totalWon:number;bestWin:number;history:SpinResult[]};
export const freshWallet=():SlotWallet=>({version:1,credits:2000,spins:0,totalBet:0,totalWon:0,bestWin:0,history:[]});
export function randomIndex(max:number){if(!Number.isSafeInteger(max)||max<1||max>0xffffffff)throw Error('Invalid random range');const limit=0x100000000-(0x100000000%max),array=new Uint32Array(1);do{crypto.getRandomValues(array)}while(array[0]>=limit);return array[0]%max}
export function sampleSymbol(pick:(max:number)=>number=randomIndex):SymbolId{let draw=pick(20);if(!Number.isInteger(draw)||draw<0||draw>=20)throw Error('Invalid random sample');for(const s of SYMBOLS){draw-=s.weight;if(draw<0)return s.id}throw Error('Invalid symbol sample')}
export function evaluateSlots(grid:SlotGrid,bet:number){
 if(![1,2,5,10].includes(bet)||grid.length!==3||grid.some(column=>column.length!==3||column.some(id=>!SYMBOLS.some(s=>s.id===id))))throw Error('Invalid spin');
 const wins:SlotWin[]=[];PAYLINES.forEach((rows,line)=>{const id=grid[0][rows[0]];if(grid[1][rows[1]]===id&&grid[2][rows[2]]===id){const multiplier=SYMBOLS.find(s=>s.id===id)!.payout;wins.push({line:line+1,symbol:id,multiplier,award:multiplier*bet})}});return {wins,payout:wins.reduce((n,w)=>n+w.award,0),cost:bet*5};
}
export function spinSlots(wallet:SlotWallet,bet:number,pick:(max:number)=>number=randomIndex,id=crypto.randomUUID(),at=Date.now()){
 if(wallet.credits<bet*5)throw Error('Not enough play credits for this spin. Refill to keep playing.');
 const grid=Array.from({length:3},()=>Array.from({length:3},()=>sampleSymbol(pick))),evaluation=evaluateSlots(grid,bet),result:SpinResult={grid,...evaluation,bet,id,at};
 const next:SlotWallet={version:1,credits:wallet.credits-result.cost+result.payout,spins:wallet.spins+1,totalBet:wallet.totalBet+result.cost,totalWon:wallet.totalWon+result.payout,bestWin:Math.max(wallet.bestWin,result.payout),history:[result,...wallet.history].slice(0,12)};
 return {wallet:next,result};
}
export function readWallet(value:string|null):SlotWallet{
 try{const data=JSON.parse(value||'null');if(!data||data.version!==1||['credits','spins','totalBet','totalWon','bestWin'].some(k=>!Number.isSafeInteger(data[k])||data[k]<0||data[k]>1e12))return freshWallet();
  const history=(Array.isArray(data.history)?data.history:[]).slice(0,12).filter((r:SpinResult)=>{try{const evaluation=evaluateSlots(r.grid,r.bet);return typeof r.id==='string'&&Number.isFinite(r.at)&&evaluation.cost===r.cost&&evaluation.payout===r.payout&&JSON.stringify(evaluation.wins)===JSON.stringify(r.wins)}catch{return false}});
  return {...data,history};
 }catch{return freshWallet()}
}
