import {rawDatabase} from '@/db/raw';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {identity,body,failure} from '../../../common';
import {getProfileOverview,setWalletVisibility} from '@/lib/profile-overview.mjs';

export const runtime='nodejs';
const headers={'Cache-Control':'no-store'};
const idValid=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);

export async function GET(request:Request){
 try{
  const uid=(await getChatGPTUser())?.userId||'',id=new URL(request.url).searchParams.get('id')||uid;
  if(!idValid(id))throw Error('INPUT');
  const overview=getProfileOverview(rawDatabase(),id,uid);
  return overview?Response.json({overview},{headers}):Response.json({error:'Creator profile unavailable.'},{status:404,headers});
 }catch(e){return failure(e);}
}
export async function PATCH(request:Request){
 try{
  const uid=await identity(request),d=await body(request);
  if(typeof d.showWallets!=='boolean')throw Error('INPUT');
  return Response.json({ok:true,showWallets:setWalletVisibility(rawDatabase(),uid,d.showWallets)},{headers});
 }catch(e){return failure(e);}
}
