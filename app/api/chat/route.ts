import {database,rawDatabase} from '@/db/raw';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {identity,body,failure} from '../common';
import {chatChannels, type ChatMessage} from '@/app/chat-types';
const channels:readonly string[]=chatChannels.map(channel=>channel.id);
type MessageRow = Omit<ChatMessage,'liked'|'mine'|'parent'> & {
 user_id:string; liked:number; parent_id:string|null; parent_name:string|null; parent_text:string|null;
};
const messageSelect = `SELECT m.id,m.user_id,m.text,m.created_at,m.edited_at,m.reply_to,
 COALESCE(p.name,a.display_name,'Explorer') AS name,
 (SELECT COUNT(*) FROM likes l WHERE l.message_id=m.id) AS likes,
 (SELECT COUNT(*) FROM likes l WHERE l.message_id=m.id AND l.user_id=?) AS liked,
 (SELECT COUNT(*) FROM messages r WHERE r.reply_to=m.id AND r.channel=m.channel AND r.hidden_at=0) AS replyCount,
 parent.id AS parent_id,parent.text AS parent_text,COALESCE(pp.name,pa.display_name,'Explorer') AS parent_name
 FROM messages m
 LEFT JOIN profiles p ON p.user_id=m.user_id LEFT JOIN accounts a ON a.user_id=m.user_id
 LEFT JOIN messages parent ON parent.id=m.reply_to AND parent.channel=m.channel AND parent.hidden_at=0
 LEFT JOIN profiles pp ON pp.user_id=parent.user_id LEFT JOIN accounts pa ON pa.user_id=parent.user_id`;
function publicMessage(m:MessageRow,userId?:string):ChatMessage {
 return {id:m.id,text:m.text,created_at:m.created_at,edited_at:m.edited_at,reply_to:m.reply_to,
  name:m.name,likes:m.likes,liked:!!m.liked,mine:m.user_id===userId,replyCount:m.replyCount,
  parent:m.parent_id?{id:m.parent_id,name:m.parent_name||'Explorer',text:m.parent_text||''}:null};
}
function readOnly(){return rawDatabase().prepare("SELECT value FROM platform_settings WHERE key='chat_readonly'").get()?.value==='true'}
function paused(){return Response.json({error:'Chat is temporarily read only. You can still browse conversations.'},{status:403})}
export async function GET(request:Request){
 try{
  const user=await getChatGPTUser(),params=new URL(request.url).searchParams;
  const channel=params.get('channel')||'general',query=(params.get('q')||'').trim(),filter=params.get('filter')||'all';
  const before=params.get('before'),threadId=params.get('thread'),contextId=params.get('context');
  if(!channels.includes(channel)||query.length>100||!['all','liked','replies'].includes(filter))throw Error('INPUT');
  const conditions=['m.channel=?','m.hidden_at=0'],values:(string|number)[]=[user?.userId||'',channel];
  if(query){conditions.push("(instr(lower(m.text),lower(?))>0 OR instr(lower(COALESCE(p.name,a.display_name,'Explorer')),lower(?))>0)");values.push(query,query)}
  if(filter==='liked')conditions.push('EXISTS(SELECT 1 FROM likes l WHERE l.message_id=m.id)');
  if(filter==='replies')conditions.push('m.reply_to IS NOT NULL');
  if(before){
   if(before.length>512)throw Error('INPUT');
   let cursor;try{cursor=JSON.parse(Buffer.from(before,'base64url').toString())}catch{throw Error('INPUT')}
   if(!cursor||!Number.isSafeInteger(cursor.time)||cursor.time<0||typeof cursor.id!=='string'||! /^[a-zA-Z0-9_-]{1,80}$/.test(cursor.id))throw Error('INPUT');
   conditions.push('(m.created_at<? OR (m.created_at=? AND m.id<?))');values.push(cursor.time,cursor.time,cursor.id);
  }
  const db=rawDatabase();let thread:ChatMessage|null=null,context:ChatMessage|null=null;
  if(contextId){
   if(!/^[a-zA-Z0-9_-]{1,80}$/.test(contextId))throw Error('INPUT');
   const row=db.prepare(messageSelect+' WHERE m.id=? AND m.channel=? AND m.hidden_at=0').get(user?.userId||'',contextId,channel) as MessageRow|undefined;
   if(row)context=publicMessage(row,user?.userId);
  }
  if(threadId){
   if(!/^[a-zA-Z0-9_-]{1,80}$/.test(threadId))throw Error('INPUT');
   const root=db.prepare(messageSelect+' WHERE m.id=? AND m.channel=? AND m.hidden_at=0').get(user?.userId||'',threadId,channel) as MessageRow|undefined;
   if(!root)return Response.json({error:'This conversation is no longer available.'},{status:404,headers:{'Cache-Control':'no-store'}});
   thread=publicMessage(root,user?.userId);conditions.push('m.reply_to=?');values.push(threadId);
  }
  const rows=db.prepare(messageSelect+' WHERE '+conditions.join(' AND ')+' ORDER BY m.created_at DESC,m.id DESC LIMIT 51').all(...values) as MessageRow[];
  const page=rows.slice(0,50),last=page.at(-1);
  const counts=db.prepare('SELECT channel,COUNT(*) AS messages,COUNT(DISTINCT user_id) AS voices,MAX(created_at) AS lastActivity FROM messages WHERE hidden_at=0 GROUP BY channel').all() as {channel:string;messages:number;voices:number;lastActivity:number}[];
  return Response.json({messages:page.reverse().map(m=>publicMessage(m,user?.userId)),
   channels:chatChannels.map(c=>{const count=counts.find(row=>row.channel===c.id);return {...c,messages:count?.messages||0,voices:count?.voices||0,lastActivity:count?.lastActivity||0}}),
   nextCursor:rows.length>50&&last?Buffer.from(JSON.stringify({time:last.created_at,id:last.id})).toString('base64url'):null,
   thread,context,signedIn:!!user,readOnly:readOnly()},{headers:{'Cache-Control':'no-store'}});
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
