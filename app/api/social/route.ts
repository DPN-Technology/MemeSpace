import {rawDatabase} from '@/db/raw';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {identity,body,failure} from '../common';
import {communityWritable,communityVisiblePostFilter} from '@/lib/social-community.mjs';
import {createNotice,notifyPost} from '@/lib/social-notifications.mjs';

export const runtime='nodejs';
const topics=['general','memes','gaming','culture','web3'] as const;
const validId=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);
const noStore={'Cache-Control':'no-store'};
type PostRow={id:string;user_id:string;body:string;topic:string;reply_to:string|null;quote_post_id:string|null;community_id:string|null;created_at:number;edited_at:number;author:string;bio:string;reactions:number;replies:number;reacted:number;saved:number;following:number;followers:number;has_media:number};
const tagPattern=/(?:^|[^a-zA-Z0-9_])#([a-zA-Z][a-zA-Z0-9_]{0,29})(?![a-zA-Z0-9_])/g;
function tags(text:string){return [...new Set([...text.matchAll(tagPattern)].map(match=>match[1].toLowerCase()))].slice(0,10);}
function indexTags(db:ReturnType<typeof rawDatabase>,id:string,text:string){
 db.prepare('DELETE FROM social_hashtags WHERE post_id=?').run(id);
 const add=db.prepare('INSERT OR IGNORE INTO social_hashtags(post_id,tag) VALUES(?,?)');
 for(const tag of tags(text))add.run(id,tag);
}
function postQuery(userId:string,where:string,args:(string|number)[],limit=20,offset=0,order='p.created_at DESC,p.id DESC'){
 const db=rawDatabase();
 const sql="SELECT p.id,p.user_id,p.body,p.topic,p.reply_to,p.quote_post_id,p.community_id,p.created_at,p.edited_at,"+
 "COALESCE(pr.name,a.display_name,'Explorer') AS author,COALESCE(pr.bio,'') AS bio,"+
 "(SELECT COUNT(*) FROM social_reactions r WHERE r.post_id=p.id) AS reactions,"+
 "(SELECT COUNT(*) FROM social_posts child WHERE child.reply_to=p.id AND child.hidden_at=0 AND NOT EXISTS(SELECT 1 FROM social_community_removed_posts rm WHERE rm.post_id=child.id)) AS replies,"+
 "EXISTS(SELECT 1 FROM social_reactions r WHERE r.post_id=p.id AND r.user_id=?) AS reacted,"+
 "EXISTS(SELECT 1 FROM social_bookmarks b WHERE b.post_id=p.id AND b.user_id=?) AS saved,"+
 "EXISTS(SELECT 1 FROM social_follows f WHERE f.following_id=p.user_id AND f.follower_id=?) AS following,"+
 "(SELECT COUNT(*) FROM social_follows f WHERE f.following_id=p.user_id) AS followers,"+
 "EXISTS(SELECT 1 FROM social_media media WHERE media.post_id=p.id) AS has_media "+
 "FROM social_posts p JOIN accounts a ON a.user_id=p.user_id AND a.deleted_at=0 AND a.suspended_at=0 "+
 "LEFT JOIN profiles pr ON pr.user_id=p.user_id WHERE p.hidden_at=0 AND "+communityVisiblePostFilter('p',true)+" "+
 "AND NOT EXISTS(SELECT 1 FROM social_relationships sr WHERE sr.actor_id=? AND sr.target_id=p.user_id AND sr.kind IN ('block','mute')) "+
 "AND NOT EXISTS(SELECT 1 FROM social_relationships sr WHERE sr.actor_id=p.user_id AND sr.target_id=? AND sr.kind='block') AND "+where+" ORDER BY "+order+" LIMIT ? OFFSET ?";
 return db.prepare(sql).all(userId,userId,userId,userId,userId,userId,...args,limit,offset) as PostRow[];
}
function quotePreview(id:string,viewer:string){
 if(!visible(id,viewer))return null;
 const q=rawDatabase().prepare(
  "SELECT p.id,p.user_id AS userId,p.body,COALESCE(pr.name,a.display_name,'Explorer') AS author "+
  "FROM social_posts p JOIN accounts a ON a.user_id=p.user_id LEFT JOIN profiles pr ON pr.user_id=p.user_id WHERE p.id=?"
 ).get(id) as {id:string;userId:string;body:string;author:string}|undefined;
 return q||null;
}
function present(row:PostRow,userId:string){
 return {id:row.id,userId:row.user_id,body:row.body,topic:row.topic,replyTo:row.reply_to,communityId:row.community_id,
  quotePostId:row.quote_post_id,quote:row.quote_post_id?quotePreview(row.quote_post_id,userId):null,tags:tags(row.body),
  mediaUrl:row.has_media?'/api/social/media/'+row.id:null,
  createdAt:row.created_at,editedAt:row.edited_at,author:row.author,bio:row.bio,
  reactions:row.reactions,replies:row.replies,reacted:!!row.reacted,saved:!!row.saved,
  following:!!row.following,followers:row.followers,mine:row.user_id===userId};
}
function visible(id:string,viewer=''){
 return rawDatabase().prepare("SELECT p.id,p.user_id,p.reply_to,p.topic,p.community_id FROM social_posts p JOIN accounts a ON a.user_id=p.user_id WHERE p.id=? AND p.hidden_at=0 AND a.deleted_at=0 AND a.suspended_at=0 AND "+communityVisiblePostFilter('p',true)+" "+
 "AND NOT EXISTS(SELECT 1 FROM social_relationships sr WHERE sr.actor_id=? AND sr.target_id=p.user_id AND sr.kind IN ('block','mute')) "+
 "AND NOT EXISTS(SELECT 1 FROM social_relationships sr WHERE sr.actor_id=p.user_id AND sr.target_id=? AND sr.kind='block')").get(id,viewer,viewer,viewer) as {id:string;user_id:string;reply_to:string|null;topic:string;community_id:string|null}|undefined;
}
function restricted(){return rawDatabase().prepare("SELECT value FROM platform_settings WHERE key='chat_readonly'").get()?.value==='true';}
function readonlyResponse(){return Response.json({error:'Community posting is temporarily paused.'},{status:403,headers:noStore});}

export async function GET(request:Request){
 try{
  const user=await getChatGPTUser(),uid=user?.userId||'',query=new URL(request.url).searchParams;
  const mode=query.get('mode')||'feed',q=(query.get('q')||'').trim(),topic=query.get('topic')||'all';
  if(q.length>90||!['all',...topics].includes(topic))throw Error('INPUT');
  if(mode==='trends'){
   const trends=rawDatabase().prepare(
    "SELECT h.tag,COUNT(*) AS posts FROM social_hashtags h "+
    "JOIN social_posts p ON p.id=h.post_id AND p.hidden_at=0 AND p.reply_to IS NULL "+
    "JOIN accounts a ON a.user_id=p.user_id AND a.deleted_at=0 AND a.suspended_at=0 "+
    "WHERE "+communityVisiblePostFilter('p',true)+" AND NOT EXISTS(SELECT 1 FROM social_relationships sr WHERE sr.actor_id=? AND sr.target_id=p.user_id AND sr.kind IN ('block','mute')) "+
    "AND NOT EXISTS(SELECT 1 FROM social_relationships sr WHERE sr.actor_id=p.user_id AND sr.target_id=? AND sr.kind='block') "+
    "GROUP BY h.tag ORDER BY posts DESC,h.tag ASC LIMIT 8"
   ).all(uid,uid,uid);
   return Response.json({trends},{headers:noStore});
  }
  if(mode==='people'){
   const args:(string|number)[]=[uid,uid,uid,uid],filters=["a.deleted_at=0","a.suspended_at=0","a.user_id<>?"];
   if(q){filters.push("(instr(lower(COALESCE(p.name,a.display_name)),lower(?))>0 OR instr(lower(COALESCE(p.bio,'')),lower(?))>0)");args.push(q,q);}
   const people=rawDatabase().prepare(
    "SELECT a.user_id AS userId,COALESCE(p.name,a.display_name) AS name,COALESCE(p.bio,'') AS bio,"+
    "(SELECT COUNT(*) FROM social_posts s WHERE s.user_id=a.user_id AND s.hidden_at=0 AND s.reply_to IS NULL AND NOT EXISTS(SELECT 1 FROM social_community_removed_posts rm WHERE rm.post_id=s.id) AND NOT EXISTS(SELECT 1 FROM social_communities c WHERE c.id=s.community_id AND c.visibility='private')) AS posts,"+
    "(SELECT COUNT(*) FROM social_follows f WHERE f.following_id=a.user_id) AS followers,"+
    "EXISTS(SELECT 1 FROM social_follows f WHERE f.following_id=a.user_id AND f.follower_id=?) AS following,"+
    "EXISTS(SELECT 1 FROM social_relationships sr WHERE sr.actor_id=? AND sr.target_id=a.user_id AND sr.kind='block') AS blocked,"+
    "EXISTS(SELECT 1 FROM social_relationships sr WHERE sr.actor_id=? AND sr.target_id=a.user_id AND sr.kind='mute') AS muted "+
    "FROM accounts a LEFT JOIN profiles p ON p.user_id=a.user_id WHERE "+filters.join(' AND ')+
    " ORDER BY followers DESC,a.created_at DESC LIMIT 20"
   ).all(...args);
   return Response.json({people},{headers:noStore});
  }
  if(mode==='profile'){
   const target=query.get('id');
   if(!validId(target))throw Error('INPUT');
   const profile=rawDatabase().prepare(
    "SELECT a.user_id AS userId,COALESCE(p.name,a.display_name) AS name,COALESCE(p.bio,'') AS bio,a.created_at AS joinedAt,"+
    "(SELECT COUNT(*) FROM social_posts s WHERE s.user_id=a.user_id AND s.hidden_at=0 AND s.reply_to IS NULL AND NOT EXISTS(SELECT 1 FROM social_community_removed_posts rm WHERE rm.post_id=s.id) AND NOT EXISTS(SELECT 1 FROM social_communities c WHERE c.id=s.community_id AND c.visibility='private')) AS posts,"+
    "(SELECT COUNT(*) FROM social_follows f WHERE f.following_id=a.user_id) AS followers,"+
    "(SELECT COUNT(*) FROM social_follows f WHERE f.follower_id=a.user_id) AS followingCount,"+
    "EXISTS(SELECT 1 FROM social_follows f WHERE f.following_id=a.user_id AND f.follower_id=?) AS following,"+
    "EXISTS(SELECT 1 FROM social_relationships sr WHERE sr.actor_id=? AND sr.target_id=a.user_id AND sr.kind='block') AS blocked,"+
    "EXISTS(SELECT 1 FROM social_relationships sr WHERE sr.actor_id=? AND sr.target_id=a.user_id AND sr.kind='mute') AS muted,"+
    "EXISTS(SELECT 1 FROM social_relationships sr WHERE sr.actor_id=a.user_id AND sr.target_id=? AND sr.kind='block') AS blockedBy "+
    "FROM accounts a LEFT JOIN profiles p ON p.user_id=a.user_id WHERE a.user_id=? AND a.deleted_at=0 AND a.suspended_at=0"
   ).get(uid,uid,uid,uid,target) as {userId:string;name:string;bio:string;joinedAt:number;posts:number;followers:number;followingCount:number;following:number;blocked:number;muted:number;blockedBy:number}|undefined;
   if(!profile||profile.blockedBy)return Response.json({error:'Member not found.'},{status:404,headers:noStore});
   const {blockedBy,...publicProfile}=profile;
   return Response.json({profile:{...publicProfile,following:!!profile.following,blocked:!!profile.blocked,muted:!!profile.muted,mine:target===uid}},{headers:noStore});
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
    "WHERE activity.owner_id=? AND activity.actor_id<>? "+
    "AND NOT EXISTS(SELECT 1 FROM social_relationships sr WHERE sr.actor_id=? AND sr.target_id=activity.actor_id AND sr.kind IN ('block','mute')) "+
    "AND NOT EXISTS(SELECT 1 FROM social_relationships sr WHERE sr.actor_id=activity.actor_id AND sr.target_id=? AND sr.kind='block') "+
    "AND (activity.post_id IS NULL OR EXISTS(SELECT 1 FROM social_posts postcheck WHERE postcheck.id=activity.post_id AND "+communityVisiblePostFilter('postcheck',true)+")) "+
    "ORDER BY activity.created_at DESC LIMIT 40"
   ).all(uid,uid,uid,uid,uid);
   return Response.json({activity,signedIn:true},{headers:noStore});
  }
  if(mode==='thread'){
   const threadId=query.get('id');
   if(!validId(threadId))throw Error('INPUT');
   const root=visible(threadId,uid);
   if(!root)return Response.json({error:'Post not found.'},{status:404,headers:noStore});
   const main=postQuery(uid,'p.id=?',[threadId],1)[0];
   const replies=postQuery(uid,'p.reply_to=?',[threadId],50,0,'p.created_at ASC,p.id ASC');
   return Response.json({root:present(main,uid),replies:replies.map(p=>present(p,uid)),signedIn:!!user},{headers:noStore});
  }
  if(mode!=='feed')throw Error('INPUT');
  const view=query.get('view')||'all',sort=query.get('sort')||'latest',target=query.get('user'),tag=query.get('tag')||'',community=query.get('community')||'';
  const page=Number(query.get('page')||0);
  if(!['all','following','mine','saved','profile'].includes(view)||!['latest','popular'].includes(sort)||!Number.isSafeInteger(page)||page<0||page>100)throw Error('INPUT');
  if(tag&&!/^[a-z][a-z0-9_]{0,29}$/.test(tag))throw Error('INPUT');
  if(community&&!validId(community))throw Error('INPUT');
  const conditions=['p.reply_to IS NULL'],args:(string|number)[]=[];
  if(community){conditions.push('p.community_id=?');args.push(community);}
  if(tag){conditions.push('EXISTS(SELECT 1 FROM social_hashtags h WHERE h.post_id=p.id AND h.tag=?)');args.push(tag);}
  if(topic!=='all'){conditions.push('p.topic=?');args.push(topic);}
  if(q){conditions.push("(instr(lower(p.body),lower(?))>0 OR instr(lower(COALESCE(pr.name,a.display_name)),lower(?))>0)");args.push(q,q);}
  if(view==='following'){conditions.push('EXISTS(SELECT 1 FROM social_follows f WHERE f.following_id=p.user_id AND f.follower_id=?)');args.push(uid||'__guest__');}
  if(view==='mine'){conditions.push('p.user_id=?');args.push(uid||'__guest__');}
  if(view==='saved'){conditions.push('EXISTS(SELECT 1 FROM social_bookmarks b WHERE b.post_id=p.id AND b.user_id=?)');args.push(uid||'__guest__');}
  if(view==='profile'){if(!validId(target))throw Error('INPUT');conditions.push('p.user_id=?');args.push(target);}
  const order=sort==='popular'?'(SELECT COUNT(*) FROM social_reactions r WHERE r.post_id=p.id) DESC,p.created_at DESC,p.id DESC':'p.created_at DESC,p.id DESC';
  const rows=postQuery(uid,conditions.join(' AND '),args,21,page*20,order);
  const db=rawDatabase();
  const stats={posts:Number(db.prepare("SELECT COUNT(*) AS count FROM social_posts p WHERE p.hidden_at=0 AND p.reply_to IS NULL AND "+communityVisiblePostFilter('p')).get()?.count||0),
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
   const quote=d.quotePostId;
   const parent=d.replyTo;
   const communityId=d.communityId;
   if(communityId!==undefined&&!validId(communityId))throw Error('INPUT');
   if(quote!==undefined&&(!validId(quote)||parent!==undefined))throw Error('INPUT');
   if(quote&&!visible(quote,uid))return Response.json({error:'The quoted post is unavailable.'},{status:404,headers:noStore});
   if(parent!==undefined&&(!validId(parent)||!visible(parent,uid)))return Response.json({error:'This conversation is no longer available.'},{status:404,headers:noStore});
   const root=parent?visible(parent,uid):null;
   const replyTo=root?(root.reply_to||root.id):null;
   if(root&&communityId!==undefined&&communityId!==root.community_id)throw Error('INPUT');
   const resolvedCommunity=root?root.community_id:(communityId||null);
   if(resolvedCommunity&&!communityWritable(db,resolvedCommunity,uid))return Response.json({error:'Join this community before posting.'},{status:403,headers:noStore});
   const topic=root?root.topic:d.topic;
   const postId=crypto.randomUUID();
   db.exec('BEGIN IMMEDIATE');
   try{
    const result=db.prepare(
     "INSERT INTO social_posts(id,user_id,body,topic,reply_to,quote_post_id,community_id,created_at) SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM social_posts WHERE user_id=? AND created_at>?)<5"
    ).run(postId,uid,d.text.trim(),topic,replyTo,quote||null,resolvedCommunity,now,uid,now-60000);
    if(!result.changes){db.exec('ROLLBACK');return Response.json({error:'You can publish up to five posts or replies per minute.'},{status:429,headers:noStore});}
    indexTags(db,postId,d.text.trim());
    notifyPost(db,uid,postId,d.text.trim(),replyTo,resolvedCommunity,now);
    db.exec('COMMIT');
   }catch(e){try{db.exec('ROLLBACK')}catch{}throw e;}
   return Response.json({ok:true,id:postId},{status:201,headers:noStore});
  }
  if(action==='block'||action==='mute'){
   if(!validId(d.userId)||typeof d.enabled!=='boolean'||d.userId===uid)throw Error('INPUT');
   const target=db.prepare('SELECT user_id FROM accounts WHERE user_id=? AND deleted_at=0 AND suspended_at=0').get(d.userId);
   if(d.enabled&&!target)return Response.json({error:'This member is unavailable.'},{status:404,headers:noStore});
   if(d.enabled){
    db.exec('BEGIN IMMEDIATE');
    try{
     db.prepare('INSERT OR IGNORE INTO social_relationships(actor_id,target_id,kind,created_at) VALUES(?,?,?,?)').run(uid,d.userId,action,now);
     if(action==='block')db.prepare('DELETE FROM social_follows WHERE (follower_id=? AND following_id=?) OR (follower_id=? AND following_id=?)').run(uid,d.userId,d.userId,uid);
     db.exec('COMMIT');
    }catch(e){db.exec('ROLLBACK');throw e;}
   }else db.prepare('DELETE FROM social_relationships WHERE actor_id=? AND target_id=? AND kind=?').run(uid,d.userId,action);
   return Response.json({ok:true},{headers:noStore});
  }
  if(action==='follow'){
   if(!validId(d.userId)||typeof d.enabled!=='boolean'||d.userId===uid)throw Error('INPUT');
   const target=db.prepare('SELECT user_id FROM accounts WHERE user_id=? AND deleted_at=0 AND suspended_at=0').get(d.userId);
   if(!target)return Response.json({error:'This member is unavailable.'},{status:404,headers:noStore});
   if(d.enabled&&db.prepare("SELECT 1 FROM social_relationships WHERE kind='block' AND ((actor_id=? AND target_id=?) OR (actor_id=? AND target_id=?))").get(uid,d.userId,d.userId,uid))
    return Response.json({error:'You cannot follow a blocked member.'},{status:403,headers:noStore});
   if(d.enabled){
    db.exec('BEGIN IMMEDIATE');
    try{
     const saved=db.prepare('INSERT OR IGNORE INTO social_follows(follower_id,following_id,created_at) VALUES(?,?,?)').run(uid,d.userId,now);
     if(saved.changes)createNotice(db,{recipientId:d.userId,actorId:uid,kind:'follow',now});
     db.exec('COMMIT');
    }catch(e){try{db.exec('ROLLBACK')}catch{}throw e;}
   }else db.prepare('DELETE FROM social_follows WHERE follower_id=? AND following_id=?').run(uid,d.userId);
   return Response.json({ok:true},{headers:noStore});
  }
  if(!validId(d.postId)||typeof d.enabled!=='boolean'&&action!=='report')throw Error('INPUT');
  if(!visible(d.postId,uid))return Response.json({error:'This post is unavailable.'},{status:404,headers:noStore});
  if(action==='react'||action==='bookmark'){
   const table=action==='react'?'social_reactions':'social_bookmarks';
   if(d.enabled){
    db.exec('BEGIN IMMEDIATE');
    try{
     const inserted=db.prepare('INSERT OR IGNORE INTO '+table+'(user_id,post_id,created_at) VALUES(?,?,?)').run(uid,d.postId,now);
     if(action==='react'&&inserted.changes){
      const post=db.prepare('SELECT user_id AS userId,community_id AS communityId FROM social_posts WHERE id=?').get(d.postId) as {userId:string;communityId:string|null};
      createNotice(db,{recipientId:post.userId,actorId:uid,kind:'reaction',postId:d.postId,communityId:post.communityId,now});
     }
     db.exec('COMMIT');
    }catch(e){try{db.exec('ROLLBACK')}catch{}throw e;}
   }else db.prepare('DELETE FROM '+table+' WHERE user_id=? AND post_id=?').run(uid,d.postId);
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
  const db=rawDatabase();db.exec('BEGIN IMMEDIATE');
  try{
   const result=db.prepare('UPDATE social_posts SET body=?,edited_at=? WHERE id=? AND user_id=? AND hidden_at=0').run(d.text.trim(),Date.now(),d.id,uid);
   if(!result.changes){db.exec('ROLLBACK');return Response.json({error:'Post not found.'},{status:404,headers:noStore});}
   indexTags(db,d.id,d.text.trim());db.exec('COMMIT');
   return Response.json({ok:true},{headers:noStore});
  }catch(e){try{db.exec('ROLLBACK')}catch{}throw e;}
 }catch(e){return failure(e);}
}
export async function DELETE(request:Request){
 try{
  const uid=await identity(request),d=await body(request);
  if(!validId(d.id))throw Error('INPUT');
  const db=rawDatabase(),row=db.prepare('SELECT id FROM social_posts WHERE id=? AND user_id=? AND hidden_at=0').get(d.id,uid);
  if(!row)return Response.json({error:'Post not found.'},{status:404,headers:noStore});
  const now=Date.now();
  db.exec('BEGIN IMMEDIATE');
  try{
   db.prepare('UPDATE social_posts SET hidden_at=? WHERE (id=? OR reply_to=?) AND hidden_at=0').run(now,d.id,d.id);
   // Author-initiated removal purges their own binary content, not another member's replies.
   db.prepare('DELETE FROM social_media WHERE post_id=? AND user_id=?').run(d.id,uid);
   db.prepare('DELETE FROM social_hashtags WHERE post_id=?').run(d.id);
   db.exec('COMMIT');
  }catch(e){try{db.exec('ROLLBACK')}catch{}throw e;}
  return Response.json({ok:true},{headers:noStore});
 }catch(e){return failure(e);}
}
