import {database,rawDatabase} from '@/db/raw';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {identity,body,failure} from '../common';
const channels=['general','memes','web3','gaming'];
function readOnly(){return rawDatabase().prepare("SELECT value FROM platform_settings WHERE key='chat_readonly'").get()?.value==='true'}
function paused(){return Response.json({error:'Chat is temporarily read only. You can still browse conversations.'},{status:403})}
export async function GET(request:Request){
 try{
  const user=await getChatGPTUser(),channel=new URL(request.url).searchParams.get('channel')||'general';
  if(!channels.includes(channel))throw Error('INPUT');
  const result=await database().prepare("SELECT m.id,m.user_id,m.text,m.created_at,m.edited_at,m.reply_to,COALESCE(p.name,a.display_name,'Explorer') AS name,(SELECT COUNT(*) FROM likes l WHERE l.message_id=m.id) AS likes,(SELECT COUNT(*) FROM likes l WHERE l.message_id=m.id AND l.user_id=?) AS liked FROM messages m LEFT JOIN profiles p ON p.user_id=m.user_id LEFT JOIN accounts a ON a.user_id=m.user_id WHERE m.channel=? AND m.hidden_at=0 ORDER BY m.created_at DESC LIMIT 100").bind(user?.userId||'',channel).all();
  return Response.json({messages:result.results.reverse().map((m:any)=>({id:m.id,text:m.text,created_at:m.created_at,edited_at:m.edited_at,reply_to:m.reply_to,name:m.name,likes:m.likes,liked:!!m.liked,mine:m.user_id===user?.userId})),signedIn:!!user,readOnly:readOnly()},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return failure(e)}
}
export async function POST(request:Request){
 try{
  const id=await identity(request);if(readOnly())return paused();const d=await body(request);
  if(!d||typeof d.text!=='string'||!d.text.trim()||d.text.length>1000||!channels.includes(d.channel||'general'))throw Error('INPUT');
  const db=database(),channel=d.channel||'general';
  if(d.replyTo&&(typeof d.replyTo!=='string'||!await db.prepare('SELECT id FROM messages WHERE id=? AND channel=? AND hidden_at=0').bind(d.replyTo,channel).first()))throw Error('INPUT');
  const now=Date.now();
  const result=await db.prepare('INSERT INTO messages (id,user_id,text,created_at,channel,reply_to) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM messages WHERE user_id=? AND created_at>?)<5').bind(crypto.randomUUID(),id,d.text.trim(),now,channel,d.replyTo||null,id,now-60000).run();
  if(!result.meta.changes)return Response.json({error:'You can send up to five messages per minute. Try again shortly.'},{status:429});
  return Response.json({ok:true},{status:201});
 }catch(e){return failure(e)}
}
export async function PATCH(request:Request){
 try{const id=await identity(request);if(readOnly())return paused();const d=await body(request);if(!d||typeof d.id!=='string'||typeof d.text!=='string'||!d.text.trim()||d.text.length>1000)throw Error('INPUT');
 const r=await database().prepare('UPDATE messages SET text=?,edited_at=? WHERE id=? AND user_id=? AND hidden_at=0').bind(d.text.trim(),Date.now(),d.id,id).run();
 if(!r.meta.changes)return Response.json({error:'This message is no longer available for editing.'},{status:404});return Response.json({ok:true});}catch(e){return failure(e)}
}
export async function DELETE(request:Request){try{const id=await identity(request),input=await body(request);if(typeof input.id!=='string')throw Error('INPUT');await database().prepare('DELETE FROM messages WHERE id=? AND user_id=?').bind(input.id,id).run();return Response.json({ok:true});}catch(e){return failure(e)}}
