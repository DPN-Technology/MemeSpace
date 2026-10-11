import {rawDatabase} from '@/db/raw';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {identity,body,failure} from '../common';

export const runtime='nodejs';
const topics=['general','memes','gaming','culture','web3'] as const;
const validId=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);
const noStore={'Cache-Control':'no-store'};
type PostRow={id:string;user_id:string;body:string;topic:string;reply_to:string|null;created_at:number;edited_at:number;author:string;bio:string;reactions:number;replies:number;reacted:number;saved:number;following:number;followers:number};
function postQuery(userId:string,where:string,args:(string|number)[],limit=20,offset=0,order='p.created_at DESC,p.id DESC'){
 const db=rawDatabase();
 const sql="SELECT p.id,p.user_id,p.body,p.topic,p.reply_to,p.created_at,p.edited_at,"+
 "COALESCE(pr.name,a.display_name,'Explorer') AS author,COALESCE(pr.bio,'') AS bio,"+
 "(SELECT COUNT(*) FROM social_reactions r WHERE r.post_id=p.id) AS reactions,"+
 "(SELECT COUNT(*) FROM social_posts child WHERE child.reply_to=p.id AND child.hidden_at=0) AS replies,"+
 "EXISTS(SELECT 1 FROM social_reactions r WHERE r.post_id=p.id AND r.user_id=?) AS reacted,"+
 "EXISTS(SELECT 1 FROM social_bookmarks b WHERE b.post_id=p.id AND b.user_id=?) AS saved,"+
 "EXISTS(SELECT 1 FROM social_follows f WHERE f.following_id=p.user_id AND f.follower_id=?) AS following,"+
 "(SELECT COUNT(*) FROM social_follows f WHERE f.following_id=p.user_id) AS followers "+
 "FROM social_posts p JOIN accounts a ON a.user_id=p.user_id AND a.deleted_at=0 AND a.suspended_at=0 "+
 "LEFT JOIN profiles pr ON pr.user_id=p.user_id WHERE p.hidden_at=0 AND "+where+" ORDER BY "+order+" LIMIT ? OFFSET ?";
 return db.prepare(sql).all(userId,userId,userId,...args,limit,offset) as PostRow[];
}
function present(row:PostRow,userId:string){
 return {id:row.id,userId:row.user_id,body:row.body,topic:row.topic,replyTo:row.reply_to,
  createdAt:row.created_at,editedAt:row.edited_at,author:row.author,bio:row.bio,
  reactions:row.reactions,replies:row.replies,reacted:!!row.reacted,saved:!!row.saved,
  following:!!row.following,followers:row.followers,mine:row.user_id===userId};
}
function visible(id:string){
 return rawDatabase().prepare("SELECT p.id,p.user_id,p.reply_to,p.topic FROM social_posts p JOIN accounts a ON a.user_id=p.user_id WHERE p.id=? AND p.hidden_at=0 AND a.deleted_at=0 AND a.suspended_at=0").get(id) as {id:string;user_id:string;reply_to:string|null;topic:string}|undefined;
}
function restricted(){return rawDatabase().prepare("SELECT value FROM platform_settings WHERE key='chat_readonly'").get()?.value==='true';}
function readonlyResponse(){return Response.json({error:'Community posting is temporarily paused.'},{status:403,headers:noStore});}

export async function GET(request:Request){
 try{
  const user=await getChatGPTUser(),uid=user?.userId||'',query=new URL(request.url).searchParams;
  const mode=query.get('mode')||'feed',q=(query.get('q')||'').trim(),topic=query.get('topic')||'all';
  if(q.length>90||!['all',...topics].includes(topic))throw Error('INPUT');
  if(mode==='people'){
   const args:(string|number)[]=[uid,uid],filters=["a.deleted_at=0","a.suspended_at=0","a.user_id<>?"];
   if(q){filters.push("(instr(lower(COALESCE(p.name,a.display_name)),lower(?))>0 OR instr(lower(COALESCE(p.bio,'')),lower(?))>0)");args.push(q,q);}
   const people=rawDatabase().prepare(
    "SELECT a.user_id AS userId,COALESCE(p.name,a.display_name) AS name,COALESCE(p.bio,'') AS bio,"+
    "(SELECT COUNT(*) FROM social_posts s WHERE s.user_id=a.user_id AND s.hidden_at=0 AND s.reply_to IS NULL) AS posts,"+
    "(SELECT COUNT(*) FROM social_follows f WHERE f.following_id=a.user_id) AS followers,"+
    "EXISTS(SELECT 1 FROM social_follows f WHERE f.following_id=a.user_id AND f.follower_id=?) AS following "+
    "FROM accounts a LEFT JOIN profiles p ON p.user_id=a.user_id WHERE "+filters.join(' AND ')+
    " ORDER BY followers DESC,a.created_at DESC LIMIT 20"
   ).all(...args);
   return Response.json({people},{headers:noStore});
  }
  if(mode==='activity'){
   if(!uid)return Response.json({activity:[],signedIn:false},{headers:noStore});
   const activity=rawDatabase().prepare(
    "SELECT activity.kind,activity.actor_id AS userId,COALESCE(pr.name,a.display_name,'Explorer') AS author,activity.post_id AS postId,activity.created_at AS createdAt "+
    "FROM (SELECT 'reaction' AS kind,r.user_id AS actor_id,r.post_id,p.user_id AS owner_id,r.created_at FROM social_reactions r JOIN social_posts p ON p.id=r.post_id AND p.hidden_at=0 "+
    "UNION ALL SELECT 'reply',child.user_id,root.id,root.user_id,child.created_at FROM social_posts child JOIN social_posts root ON root.id=child.reply_to AND root.hidden_at=0 WHERE child.hidden_at=0 "+
    "UNION ALL SELECT 'follow',f.follower_id,NULL,f.following_id,f.created_at FROM social_follows f) activity "+
    "JOIN accounts a ON a.user_id=activity.actor_id AND a.deleted_at=0 AND a.suspended_at=0 "+
    "LEFT JOIN profiles pr ON pr.user_id=activity.actor_id "+
    "WHERE activity.owner_id=? AND activity.actor_id<>? ORDER BY activity.created_at DESC LIMIT 40"
   ).all(uid,uid);
   return Response.json({activity,signedIn:true},{headers:noStore});
  }
  if(mode==='thread'){
   const threadId=query.get('id');
   if(!validId(threadId))throw Error('INPUT');
   const root=visible(threadId);
   if(!root)return Response.json({error:'Post not found.'},{status:404,headers:noStore});
   const main=postQuery(uid,'p.id=?',[threadId],1)[0];
   const replies=postQuery(uid,'p.reply_to=?',[threadId],50,0,'p.created_at ASC,p.id ASC');
   return Response.json({root:present(main,uid),replies:replies.map(p=>present(p,uid)),signedIn:!!user},{headers:noStore});
  }
  if(mode!=='feed')throw Error('INPUT');
  const view=query.get('view')||'all',sort=query.get('sort')||'latest',target=query.get('user');
  const page=Number(query.get('page')||0);
  if(!['all','following','mine','saved','profile'].includes(view)||!['latest','popular'].includes(sort)||!Number.isSafeInteger(page)||page<0||page>100)throw Error('INPUT');
  const conditions=['p.reply_to IS NULL'],args:(string|number)[]=[];
  if(topic!=='all'){conditions.push('p.topic=?');args.push(topic);}
  if(q){conditions.push("(instr(lower(p.body),lower(?))>0 OR instr(lower(COALESCE(pr.name,a.display_name)),lower(?))>0)");args.push(q,q);}
  if(view==='following'){conditions.push('EXISTS(SELECT 1 FROM social_follows f WHERE f.following_id=p.user_id AND f.follower_id=?)');args.push(uid||'__guest__');}
  if(view==='mine'){conditions.push('p.user_id=?');args.push(uid||'__guest__');}
  if(view==='saved'){conditions.push('EXISTS(SELECT 1 FROM social_bookmarks b WHERE b.post_id=p.id AND b.user_id=?)');args.push(uid||'__guest__');}
  if(view==='profile'){if(!validId(target))throw Error('INPUT');conditions.push('p.user_id=?');args.push(target);}
  const order=sort==='popular'?'(SELECT COUNT(*) FROM social_reactions r WHERE r.post_id=p.id) DESC,p.created_at DESC,p.id DESC':'p.created_at DESC,p.id DESC';
  const rows=postQuery(uid,conditions.join(' AND '),args,21,page*20,order);
  const db=rawDatabase();
  const stats={posts:Number(db.prepare("SELECT COUNT(*) AS count FROM social_posts WHERE hidden_at=0 AND reply_to IS NULL").get()?.count||0),
   members:Number(db.prepare("SELECT COUNT(*) AS count FROM accounts WHERE deleted_at=0 AND suspended_at=0 AND user_id<>'local_seedy'").get()?.count||0),
   following:uid?Number(db.prepare('SELECT COUNT(*) AS count FROM social_follows WHERE follower_id=?').get(uid)?.count||0):0};
  return Response.json({posts:rows.slice(0,20).map(p=>present(p,uid)),hasMore:rows.length>20,stats,signedIn:!!user,readOnly:restricted()},{headers:noStore});
 }catch(e){return failure(e);}
}
export async function POST(request:Request){
 try{
  const uid=await identity(request),d=await body(request),db=rawDatabase(),action=d.action||'create',now=Date.now();
  if(action==='create'){
   if(restricted())return readonlyResponse();
   if(typeof d.text!=='string'||d.text.trim().length<2||d.text.length>1200||!topics.includes(d.topic))throw Error('INPUT');
   const parent=d.replyTo;
   if(parent!==undefined&&(!validId(parent)||!visible(parent)))return Response.json({error:'This conversation is no longer available.'},{status:404,headers:noStore});
   const root=parent?visible(parent):null;
   const replyTo=root?(root.reply_to||root.id):null;
   const topic=root?root.topic:d.topic;
   const postId=crypto.randomUUID();
   const result=db.prepare(
    "INSERT INTO social_posts(id,user_id,body,topic,reply_to,created_at) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM social_posts WHERE user_id=? AND created_at>?)<5"
   ).run(postId,uid,d.text.trim(),topic,replyTo,now,uid,now-60000);
   if(!result.changes)return Response.json({error:'You can publish up to five posts or replies per minute.'},{status:429,headers:noStore});
   return Response.json({ok:true,id:postId},{status:201,headers:noStore});
  }
  if(action==='follow'){
   if(!validId(d.userId)||typeof d.enabled!=='boolean'||d.userId===uid)throw Error('INPUT');
   const target=db.prepare('SELECT user_id FROM accounts WHERE user_id=? AND deleted_at=0 AND suspended_at=0').get(d.userId);
   if(!target)return Response.json({error:'This member is unavailable.'},{status:404,headers:noStore});
   if(d.enabled)db.prepare('INSERT OR IGNORE INTO social_follows(follower_id,following_id,created_at) VALUES(?,?,?)').run(uid,d.userId,now);
   else db.prepare('DELETE FROM social_follows WHERE follower_id=? AND following_id=?').run(uid,d.userId);
   return Response.json({ok:true},{headers:noStore});
  }
  if(!validId(d.postId)||typeof d.enabled!=='boolean'&&action!=='report')throw Error('INPUT');
  if(!visible(d.postId))return Response.json({error:'This post is unavailable.'},{status:404,headers:noStore});
  if(action==='react'||action==='bookmark'){
   const table=action==='react'?'social_reactions':'social_bookmarks';
   if(d.enabled)db.prepare('INSERT OR IGNORE INTO '+table+'(user_id,post_id,created_at) VALUES(?,?,?)').run(uid,d.postId,now);
   else db.prepare('DELETE FROM '+table+' WHERE user_id=? AND post_id=?').run(uid,d.postId);
   return Response.json({ok:true},{headers:noStore});
  }
  if(action==='report'){
   if(!['spam','harassment','scam','privacy','other'].includes(d.reason))throw Error('INPUT');
   db.prepare('INSERT OR IGNORE INTO social_reports(user_id,post_id,reason,created_at) VALUES(?,?,?,?)').run(uid,d.postId,d.reason,now);
   return Response.json({ok:true},{headers:noStore});
  }
  throw Error('INPUT');
 }catch(e){return failure(e);}
}
export async function PATCH(request:Request){
 try{
  const uid=await identity(request),d=await body(request);
  if(restricted())return readonlyResponse();
  if(!validId(d.id)||typeof d.text!=='string'||d.text.trim().length<2||d.text.length>1200)throw Error('INPUT');
  const result=rawDatabase().prepare('UPDATE social_posts SET body=?,edited_at=? WHERE id=? AND user_id=? AND hidden_at=0').run(d.text.trim(),Date.now(),d.id,uid);
  return result.changes?Response.json({ok:true},{headers:noStore}):Response.json({error:'Post not found.'},{status:404,headers:noStore});
 }catch(e){return failure(e);}
}
export async function DELETE(request:Request){
 try{
  const uid=await identity(request),d=await body(request);
  if(!validId(d.id))throw Error('INPUT');
  const db=rawDatabase(),row=db.prepare('SELECT id FROM social_posts WHERE id=? AND user_id=? AND hidden_at=0').get(d.id,uid);
  if(!row)return Response.json({error:'Post not found.'},{status:404,headers:noStore});
  const now=Date.now();
  db.prepare('UPDATE social_posts SET hidden_at=? WHERE (id=? OR reply_to=?) AND hidden_at=0').run(now,d.id,d.id);
  return Response.json({ok:true},{headers:noStore});
 }catch(e){return failure(e);}
}
