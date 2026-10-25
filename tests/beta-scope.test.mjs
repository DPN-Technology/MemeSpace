import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeCatalog,GAME_CATALOG,isFreeBeta} from '../lib/arcade-catalog.mjs';
const settings=GAME_CATALOG.map(({id})=>({key:'game_'+id+'_enabled',value:'true',updated_at:100}));
const db={prepare(){return {all:()=>settings}}};
test('server only enables approved skill cabinets in free beta, regardless of admin flags',()=>{
 const before=process.env.MEMESPACE_LAUNCH_SCOPE;
 try{
  process.env.MEMESPACE_LAUNCH_SCOPE='beta';
  assert.equal(isFreeBeta(),true);
  const games=arcadeCatalog(db);
  assert.deepEqual(games.filter(game=>game.enabled).map(game=>game.id),['memory','sequence']);
  for(const disallowed of ['slots','pinball','pool','reactor'])assert.equal(games.find(g=>g.id===disallowed).enabled,false);
  process.env.MEMESPACE_LAUNCH_SCOPE='standard';
  assert.equal(arcadeCatalog(db).every(game=>game.enabled),true);
 }finally{
  if(before===undefined)delete process.env.MEMESPACE_LAUNCH_SCOPE;
  else process.env.MEMESPACE_LAUNCH_SCOPE=before;
 }
});
