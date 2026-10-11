import {rawDatabase} from '@/db/raw';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {identity,body,failure} from '../../common';
import {communitySlug,communityMembership} from '@/lib/social-community.mjs';

export const runtime='nodejs';
const noStore={'Cache-Control':'no-store'};
const validId=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);
type Role='owner'|'moderator'|'member';
function role(db:ReturnType<typeof rawDatabase>,id:string,uid:string):Role|null{
 return (communityMembership(db,id,uid) as {role:Role}|null)?.role||null;
}
function find(db:ReturnType<typeof rawDatabase>,id:string){
 return db.prepare('SELECT id,slug,name,description,owner_id AS ownerId,visibility,created_at AS createdAt,updated_at AS updatedAt FROM social_communities WHERE id=? OR slug=?').get(id,id) as {id:string;slug:string;name:string;description:string;ownerId:string;visibility:'public'|'private';createdAt:number;updatedAt:number}|undefined;
}
function decorated(db:ReturnType<typeof rawDatabase>,c:NonNullable<ReturnType<typeof find>>,uid:string){
 const counts=db.prepare("SELECT (SELECT COUNT(*) FROM social_community_members WHERE community_id=?) AS members,"+
  "(SELECT COUNT(*) FROM social_posts p WHERE p.community_id=? AND p.hidden_at=0 AND p.reply_to IS NULL "+
  "AND NOT EXISTS(SELECT 1 FROM social_community_removed_posts rm WHERE rm.post_id=p.id)) AS posts").get(c.id,c.id);
 const membership=role(db,c.id,uid);
 return {...c,...counts,posts:c.visibility==='private'&&!membership?null:(counts as {posts:number}).posts,role:membership,
  requested:!!(uid&&db.prepare('SELECT 1 FROM social_community_requests WHERE community_id=? AND user_id=?').get(c.id,uid)),
  banned:!!db.prepare('SELECT 1 FROM social_community_bans WHERE community_id=? AND user_id=?').get(c.id,uid)};
}
function reject(message:string,status=403){return Response.json({error:message},{status,headers:noStore});}
export async function GET(request:Request){
 try{
  const user=await getChatGPTUser(),uid=user?.userId||'',db=rawDatabase(),q=new URL(request.url).searchParams,id=q.get('id');
  if(id){
   if(!validId(id))throw Error('INPUT');
   const c=find(db,id);if(!c)return reject('Community not found.',404);
   const memberVisible=c.visibility==='public'||!!role(db,c.id,uid);
   const members=memberVisible?db.prepare("SELECT m.user_id AS userId,m.role,COALESCE(p.name,a.display_name) AS name,m.joined_at AS joinedAt "+
    "FROM social_community_members m JOIN accounts a ON a.user_id=m.user_id AND a.deleted_at=0 AND a.suspended_at=0 "+
    "LEFT JOIN profiles p ON p.user_id=m.user_id WHERE m.community_id=? "+
    "ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'moderator' THEN 1 ELSE 2 END,m.joined_at LIMIT 100").all(c.id):[];
   const canModerate=['owner','moderator'].includes(role(db,c.id,uid)||'');
   const bans=canModerate?db.prepare('SELECT user_id AS userId,reason,created_at AS createdAt FROM social_community_bans WHERE community_id=? ORDER BY created_at DESC LIMIT 100').all(c.id):[];
   const requests=canModerate?db.prepare("SELECT r.user_id AS userId,COALESCE(p.name,a.display_name) AS name,r.requested_at AS requestedAt "+
    "FROM social_community_requests r JOIN accounts a ON a.user_id=r.user_id AND a.deleted_at=0 AND a.suspended_at=0 "+
    "LEFT JOIN profiles p ON p.user_id=r.user_id WHERE r.community_id=? ORDER BY r.requested_at LIMIT 100").all(c.id):[];
   return Response.json({community:decorated(db,c,uid),members,bans,requests},{headers:noStore});
  }
  const search=(q.get('q')||'').trim();if(search.length>80)throw Error('INPUT');
  const list=db.prepare("SELECT id,slug,name,description,owner_id AS ownerId,visibility,created_at AS createdAt,updated_at AS updatedAt FROM social_communities "+
   "WHERE instr(lower(name),lower(?))>0 OR instr(lower(description),lower(?))>0 OR instr(lower(slug),lower(?))>0 ORDER BY created_at DESC LIMIT 60")
   .all(search,search,search) as NonNullable<ReturnType<typeof find>>[];
  return Response.json({communities:list.map(c=>decorated(db,c,uid))},{headers:noStore});
 }catch(e){return failure(e);}
}
export async function POST(request:Request){
 try{
  const uid=await identity(request),d=await body(request),db=rawDatabase(),now=Date.now();
  if(d.action==='create'){
   if(typeof d.slug!=='string'||!communitySlug.test(d.slug)||typeof d.name!=='string'||d.name.trim().length<3||d.name.length>64||typeof d.description!=='string'||d.description.length>400||!['public','private'].includes(d.visibility??'public'))throw Error('INPUT');
   if(db.prepare("SELECT value FROM platform_settings WHERE key='chat_readonly'").get()?.value==='true')return reject('Community creation is paused.');
   if((db.prepare('SELECT COUNT(*) AS n FROM social_communities WHERE owner_id=?').get(uid) as {n:number}).n>=5)return reject('You can create up to five communities.',429);
   if(db.prepare('SELECT 1 FROM social_communities WHERE slug=?').get(d.slug))return reject('That community URL is already taken.',409);
   const id=crypto.randomUUID();
   db.exec('BEGIN IMMEDIATE');
   try{
    db.prepare('INSERT INTO social_communities(id,slug,name,description,owner_id,visibility,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').run(id,d.slug,d.name.trim(),d.description.trim(),uid,d.visibility??'public',now,now);
    db.prepare("INSERT INTO social_community_members(community_id,user_id,role,joined_at) VALUES(?,?,'owner',?)").run(id,uid,now);
    db.exec('COMMIT');
   }catch(e){try{db.exec('ROLLBACK')}catch{}throw e;}
   return Response.json({ok:true,id},{status:201,headers:noStore});
  }
  if(!validId(d.communityId))throw Error('INPUT');
  const c=find(db,d.communityId);if(!c)return reject('Community not found.',404);
  const mine=role(db,c.id,uid);
  if(d.action==='join'){
   if(db.prepare('SELECT 1 FROM social_community_bans WHERE community_id=? AND user_id=?').get(c.id,uid))return reject('You cannot join this community.');
   db.prepare("INSERT OR IGNORE INTO social_community_members(community_id,user_id,role,joined_at) VALUES(?,?,'member',?)").run(c.id,uid,now);
   return Response.json({ok:true},{headers:noStore});
  }
  if(d.action==='leave'){
   if(mine==='owner')return reject('Owners cannot leave their communities.');
   db.prepare('DELETE FROM social_community_members WHERE community_id=? AND user_id=?').run(c.id,uid);
   return Response.json({ok:true},{headers:noStore});
  }
  if(d.action==='role'){
   if(mine!=='owner'||!validId(d.userId)||d.userId===c.ownerId||!['member','moderator'].includes(d.role))return reject('Only the owner can assign moderators.');
   const changed=db.prepare("UPDATE social_community_members SET role=? WHERE community_id=? AND user_id=? AND role<>'owner'").run(d.role,c.id,d.userId);
   return changed.changes?Response.json({ok:true},{headers:noStore}):reject('Member not found.',404);
  }
  if(!['owner','moderator'].includes(mine||''))return reject('Moderator access required.');
  if(d.action==='ban'||d.action==='unban'){
   if(!validId(d.userId)||d.userId===c.ownerId||d.userId===uid)throw Error('INPUT');
   if(role(db,c.id,d.userId)==='moderator'&&mine!=='owner')return reject('Moderators cannot ban other moderators.');
   if(d.action==='ban'){
    if(typeof d.reason!=='string'||d.reason.length>160)throw Error('INPUT');
    db.exec('BEGIN IMMEDIATE');
    try{
     db.prepare('INSERT OR REPLACE INTO social_community_bans(community_id,user_id,actor_id,reason,created_at) VALUES(?,?,?,?,?)').run(c.id,d.userId,uid,d.reason.trim(),now);
     db.prepare('DELETE FROM social_community_members WHERE community_id=? AND user_id=?').run(c.id,d.userId);
     db.exec('COMMIT');
    }catch(e){try{db.exec('ROLLBACK')}catch{}throw e;}
   }else db.prepare('DELETE FROM social_community_bans WHERE community_id=? AND user_id=?').run(c.id,d.userId);
   return Response.json({ok:true},{headers:noStore});
  }
  if(d.action==='remove_post'){
   if(!validId(d.postId)||typeof d.reason!=='string'||d.reason.length>160)throw Error('INPUT');
   const post=db.prepare('SELECT user_id FROM social_posts WHERE id=? AND community_id=? AND hidden_at=0').get(d.postId,c.id) as {user_id:string}|undefined;
   if(!post)return reject('Post not found in this community.',404);
   if(mine!=='owner'&&post.user_id===c.ownerId)return reject('Moderators cannot remove an owner post.');
   db.prepare('INSERT OR IGNORE INTO social_community_removed_posts(community_id,post_id,actor_id,reason,created_at) VALUES(?,?,?,?,?)').run(c.id,d.postId,uid,d.reason.trim(),now);
   return Response.json({ok:true},{headers:noStore});
  }
  return reject('Unsupported community action.',400);
 }catch(e){return failure(e);}
}
export async function PATCH(request:Request){
 try{
  const uid=await identity(request),d=await body(request),db=rawDatabase();
  if(!validId(d.communityId)||typeof d.name!=='string'||d.name.trim().length<3||d.name.length>64||typeof d.description!=='string'||d.description.length>400||(d.visibility!==undefined&&!['public','private'].includes(d.visibility)))throw Error('INPUT');
  const c=find(db,d.communityId);if(!c)return reject('Community not found.',404);
  if(c.ownerId!==uid)return reject('Only the owner can edit this community.');
  db.prepare('UPDATE social_communities SET name=?,description=?,visibility=?,updated_at=? WHERE id=?').run(d.name.trim(),d.description.trim(),d.visibility??c.visibility,Date.now(),c.id);
  return Response.json({ok:true},{headers:noStore});
 }catch(e){return failure(e);}
}
