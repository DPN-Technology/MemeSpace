import {rawDatabase} from '@/db/raw';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {identity,body,failure} from '../../common';
import {handlePattern} from '@/lib/social-notifications.mjs';
import {communityVisiblePostFilter} from '@/lib/social-community.mjs';

export const runtime='nodejs';
const noStore={'Cache-Control':'no-store'};
const categories=['social','mentions','communities','moderation'] as const;
type Settings={social:number;mentions:number;communities:number;moderation:number};
const defaults:Settings={social:1,mentions:1,communities:1,moderation:1};
const handleReserved=new Set(['admin','admins','support','system','memespace','official','security','moderator','everyone']);
const isId=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);
function ownSettings(db:ReturnType<typeof rawDatabase>,uid:string):Settings{
 return (db.prepare('SELECT social,mentions,communities,moderation FROM social_notification_prefs WHERE user_id=?').get(uid) as Settings|undefined)||defaults;
}
export async function GET(request:Request){
 try{
  const q=new URL(request.url).searchParams,mode=q.get('mode')||'list',db=rawDatabase();
  if(mode==='resolve'){
   const handle=q.get('handle')||'';
   if(!handlePattern.test(handle))throw Error('INPUT');
   const member=db.prepare('SELECT h.user_id AS userId FROM social_handles h JOIN accounts a ON a.user_id=h.user_id AND a.deleted_at=0 AND a.suspended_at=0 WHERE h.handle=? COLLATE NOCASE').get(handle);
   return member?Response.json({member},{headers:noStore}):Response.json({error:'Creator handle unavailable.'},{status:404,headers:noStore});
  }
  const uid=(await getChatGPTUser())?.userId;
  if(!uid)return Response.json({error:'Please sign in to view notifications.'},{status:401,headers:noStore});
  const current=db.prepare('SELECT handle FROM social_handles WHERE user_id=?').get(uid) as {handle:string}|undefined;
  const preferences=ownSettings(db,uid);
  if(mode==='settings')return Response.json({handle:current?.handle||'',preferences},{headers:noStore});
  if(!['list','count'].includes(mode))throw Error('INPUT');
  const access="(n.post_id IS NULL OR EXISTS(SELECT 1 FROM social_posts p JOIN accounts a ON a.user_id=p.user_id AND a.deleted_at=0 AND a.suspended_at=0 "+
   "WHERE p.id=n.post_id AND p.hidden_at=0 AND "+communityVisiblePostFilter('p',true)+" "+
   "AND NOT EXISTS(SELECT 1 FROM social_relationships rel WHERE rel.actor_id=? AND rel.target_id=p.user_id AND rel.kind IN ('block','mute')) "+
   "AND NOT EXISTS(SELECT 1 FROM social_relationships rel WHERE rel.actor_id=p.user_id AND rel.target_id=? AND rel.kind='block')))";
  const base=" FROM social_notifications n LEFT JOIN accounts author ON author.user_id=n.actor_id AND author.deleted_at=0 AND author.suspended_at=0 "+
   "LEFT JOIN profiles prof ON prof.user_id=n.actor_id WHERE n.recipient_id=? "+
   "AND (n.actor_id IS NULL OR author.user_id IS NOT NULL) "+
   "AND NOT EXISTS(SELECT 1 FROM social_relationships rel WHERE rel.actor_id=? AND rel.target_id=n.actor_id AND rel.kind IN ('block','mute')) "+
   "AND NOT EXISTS(SELECT 1 FROM social_relationships rel WHERE rel.actor_id=n.actor_id AND rel.target_id=? AND rel.kind='block') "+
   "AND "+access;
  const args=[uid,uid,uid,uid,uid,uid];
  const unseen=db.prepare("SELECT COUNT(*) AS n"+base+" AND n.read_at=0").get(...args) as {n:number};
  if(mode==='count')return Response.json({unread:unseen.n},{headers:noStore});
  const page=Number(q.get('page')||'0');
  if(!Number.isSafeInteger(page)||page<0||page>40)throw Error('INPUT');
  const filter=q.get('filter')||'all';if(!['all','unread'].includes(filter))throw Error('INPUT');
  const rows=db.prepare("SELECT n.id,n.kind,n.actor_id AS actorId,COALESCE(prof.name,author.display_name,'MemeSpace') AS actor,n.post_id AS postId,n.community_id AS communityId,n.message,n.created_at AS createdAt,n.read_at AS readAt "+
   base+(filter==='unread'?" AND n.read_at=0":"")+" ORDER BY n.created_at DESC,n.id DESC LIMIT 31 OFFSET ?").all(...args,page*30);
  return Response.json({notifications:rows.slice(0,30),hasMore:rows.length>30,unread:unseen.n,preferences,handle:current?.handle||''},{headers:noStore});
 }catch(e){return failure(e);}
}
export async function PATCH(request:Request){
 try{
  const uid=await identity(request),data=await body(request),db=rawDatabase(),now=Date.now();
  if(data.action==='read'){
   if(!isId(data.id))throw Error('INPUT');
   db.prepare('UPDATE social_notifications SET read_at=? WHERE recipient_id=? AND id=? AND read_at=0').run(now,uid,data.id);
   return Response.json({ok:true},{headers:noStore});
  }
  if(data.action==='read_all'){
   db.prepare('UPDATE social_notifications SET read_at=? WHERE recipient_id=? AND read_at=0').run(now,uid);
   return Response.json({ok:true},{headers:noStore});
  }
  if(data.action==='preferences'){
   if(!data.preferences||typeof data.preferences!=='object'||Array.isArray(data.preferences))throw Error('INPUT');
   const values=data.preferences as Record<string,unknown>,keys=Object.keys(values);
   if(keys.length===0||keys.some(k=>!categories.includes(k as typeof categories[number])||typeof values[k]!=='boolean'))throw Error('INPUT');
   const next={...ownSettings(db,uid)};
   for(const key of keys)next[key as keyof Settings]=values[key]?1:0;
   db.prepare('INSERT INTO social_notification_prefs(user_id,social,mentions,communities,moderation,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET social=excluded.social,mentions=excluded.mentions,communities=excluded.communities,moderation=excluded.moderation,updated_at=excluded.updated_at')
    .run(uid,next.social,next.mentions,next.communities,next.moderation,now);
   return Response.json({ok:true,preferences:next},{headers:noStore});
  }
  if(data.action==='handle'){
   if(typeof data.handle!=='string'||!handlePattern.test(data.handle)||handleReserved.has(data.handle))throw Error('INPUT');
   const current=db.prepare('SELECT handle,updated_at FROM social_handles WHERE user_id=?').get(uid) as {handle:string;updated_at:number}|undefined;
   if(current&&current.handle===data.handle)return Response.json({ok:true,handle:current.handle},{headers:noStore});
   if(current&&now-current.updated_at<7*86400000)return Response.json({error:'Creator handles can be updated once every seven days.'},{status:429,headers:noStore});
   if(db.prepare('SELECT 1 FROM social_handles WHERE handle=? COLLATE NOCASE AND user_id<>?').get(data.handle,uid))return Response.json({error:'This creator handle is already taken.'},{status:409,headers:noStore});
   db.prepare('INSERT INTO social_handles(user_id,handle,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET handle=excluded.handle,updated_at=excluded.updated_at').run(uid,data.handle,now);
   return Response.json({ok:true,handle:data.handle},{headers:noStore});
  }
  throw Error('INPUT');
 }catch(e){return failure(e);}
}
