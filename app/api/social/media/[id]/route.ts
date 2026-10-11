import {rawDatabase} from '@/db/raw';
import {getChatGPTUser} from '@/app/chatgpt-auth';
export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){
 try{
  const {id}=await context.params;
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))return new Response(null,{status:404,headers});
  const user=await getChatGPTUser(),uid=user?.userId||'';
  const db=rawDatabase(),media=db.prepare(
   "SELECT m.mime,m.content FROM social_media m JOIN social_posts p ON p.id=m.post_id "+
   "JOIN accounts a ON a.user_id=p.user_id AND a.deleted_at=0 AND a.suspended_at=0 "+
   "WHERE m.post_id=? AND p.hidden_at=0 "+
   "AND (p.reply_to IS NULL OR EXISTS(SELECT 1 FROM social_posts parent WHERE parent.id=p.reply_to AND parent.hidden_at=0)) "+
   "AND NOT EXISTS(SELECT 1 FROM social_relationships r WHERE r.actor_id=? AND r.target_id=p.user_id AND r.kind IN ('block','mute')) "+
   "AND NOT EXISTS(SELECT 1 FROM social_relationships r WHERE r.actor_id=p.user_id AND r.target_id=? AND r.kind='block')"
  ).get(id,uid,uid) as {mime:string;content:Uint8Array}|undefined;
  if(!media)return new Response(null,{status:404,headers});
  return new Response(new Blob([Uint8Array.from(media.content)],{type:media.mime}),{status:200,headers:{...headers,'Content-Type':media.mime}});
 }catch{return new Response(null,{status:503,headers});}
}
