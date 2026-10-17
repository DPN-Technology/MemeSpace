import {rawDatabase} from '@/db/raw';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {failure} from '../../../../common';

export const runtime='nodejs';
const noStore={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const {id}=await params,kind=new URL(request.url).searchParams.get('kind')||'avatar';
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id)||!['avatar','banner'].includes(kind))return new Response(null,{status:404,headers:noStore});
  const uid=(await getChatGPTUser())?.userId||'',db=rawDatabase(),col=kind==='avatar'?'avatar':'banner';
  const row=db.prepare('SELECT cp.'+col+'_mime AS mime,cp.'+col+'_content AS content FROM social_creator_profiles cp JOIN accounts a ON a.user_id=cp.user_id AND a.deleted_at=0 AND a.suspended_at=0 WHERE cp.user_id=? AND NOT EXISTS(SELECT 1 FROM social_relationships sr WHERE sr.kind=\'block\' AND ((sr.actor_id=? AND sr.target_id=cp.user_id) OR (sr.actor_id=cp.user_id AND sr.target_id=?)))').get(id,uid,uid) as {mime:string;content:Uint8Array}|undefined;
  if(!row||!row.content||!['image/png','image/jpeg','image/gif'].includes(row.mime))return new Response(null,{status:404,headers:noStore});
  return new Response(Buffer.from(row.content),{headers:{...noStore,'Content-Type':row.mime,'Content-Length':String(row.content.byteLength)}});
 }catch(e){return failure(e);}
}
