export const GAME_CATALOG=Object.freeze([
  {id:'pinball',title:'Reactor Pinball',genre:'Physics arcade',modes:'One player',description:'Three balls, bumper chains, target circuits and multiball.',record:'Personal best score'},
  {id:'pool',title:'After Hours Pool',genre:'Billiards',modes:'Solo · Computer · Two players',description:'Six pockets, aiming guides and simplified eight-ball house rules.',record:'Solo clearance and match record'},
  {id:'slots',title:'Quantum Reels',genre:'Free play reels',modes:'One player',description:'Five fixed paylines, a visible paytable and independent outcomes.',record:'Local play credits and twelve recent spins'},
  {id:'memory',title:'Binary Match',genre:'Memory',modes:'One player',description:'Find matching binary pairs in as few turns as possible.',record:'Current round'},
  {id:'reactor',title:'Binary Reactor',genre:'Logic',modes:'One player',description:'Decode the signal in a sixty-second number challenge.',record:'Current round'},
  {id:'sequence',title:'Signal Sequence',genre:'Recall',modes:'One player',description:'Rebuild an increasingly long sequence of neural signals.',record:'Browser best round'}
]);
export function arcadeCatalog(db){
  const values=new Map(db.prepare("SELECT key,value,updated_at FROM platform_settings WHERE key LIKE 'game_%_enabled'").all().map(row=>[row.key,row]));
  return GAME_CATALOG.map(game=>{const setting=values.get('game_'+game.id+'_enabled');return {...game,enabled:setting?.value==='true',updatedAt:setting?.updated_at||0}});
}
