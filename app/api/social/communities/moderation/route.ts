import {rawDatabase} from '@/db/raw';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {identity,body,failure} from '../../../common';
import {communityMembership} from '@/lib/social-community.mjs';
import {createNotice} from '@/lib/social-notifications.mjs';

export const runtime='nodejs';
const headers={'Cache-Control':'no-store'};
const validId=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);
const response=(error:string,status=403)=>Response.json({error},{status,headers});
type Role='owner'|'moderator'|'member';
type Appeal={id:string;community_id:string;user_id:string;target_kind:'post'|'ban';target_id:string;status:string};
function group(db:ReturnType<typeof rawDatabase>,id:string){
 return db.prepare('SELECT id,owner_id AS ownerId,visibility FROM social_communities WHERE id=? OR slug=?').get(id,id) as {id:string;ownerId:string;visibility:string}|undefined;
}
function role(db:ReturnType<typeof rawDatabase>,communityId:string,uid:string):Role|null{
 return (communityMembership(db,communityId,uid) as {role:Role}|null)?.role||null;
}
function log(db:ReturnType<typeof rawDatabase>,c:string,uid:string,action:string,target:string,note:string,now:number){
 db.prepare('INSERT INTO social_community_audit(id,community_id,actor_id,action,target_id,note,created_at) VALUES(?,?,?,?,?,?,?)').run(crypto.randomUUID(),c,uid,action,target,note,now);
}
export async function GET(request:Request){
 try{
  const uid=(await getChatGPTUser())?.userId||'';
  if(!uid)return response('Sign in to review community cases.',401);
  const q=new URL(request.url).searchParams,cid=q.get('communityId')||'',mode=q.get('mode')||'mine';
  if(!validId(cid)||!['mine','dashboard'].includes(mode))throw Error('INPUT');
  const db=rawDatabase(),c=group(db,cid);if(!c)return response('Community unavailable.',404);
  if(mode==='mine'){
   const appeals=db.prepare('SELECT id,target_kind AS targetKind,target_id AS targetId,reason,status,resolution_note AS resolutionNote,created_at AS createdAt,reviewed_at AS reviewedAt FROM social_community_appeals WHERE community_id=? AND user_id=? ORDER BY created_at DESC LIMIT 30').all(c.id,uid);
   const removed=db.prepare('SELECT r.post_id AS postId,substr(p.body,1,240) AS excerpt,r.reason,r.created_at AS removedAt FROM social_community_removed_posts r JOIN social_posts p ON p.id=r.post_id AND p.user_id=? WHERE r.community_id=? AND p.hidden_at=0 ORDER BY r.created_at DESC LIMIT 30').all(uid,c.id);
   const banned=!!db.prepare('SELECT 1 FROM social_community_bans WHERE community_id=? AND user_id=?').get(c.id,uid);
   return Response.json({appeals,removed,banned},{headers});
  }
  if(!['owner','moderator'].includes(role(db,c.id,uid)||''))return response('Moderator access is required.');
  const removed=db.prepare('SELECT r.post_id AS postId,p.user_id AS userId,substr(p.body,1,260) AS excerpt,r.actor_id AS actorId,r.reason,r.created_at AS createdAt,p.hidden_at AS hiddenAt FROM social_community_removed_posts r JOIN social_posts p ON p.id=r.post_id WHERE r.community_id=? ORDER BY r.created_at DESC LIMIT 80').all(c.id);
  const appeals=db.prepare('SELECT a.id,a.user_id AS userId,a.target_kind AS targetKind,a.target_id AS targetId,a.reason,a.status,a.created_at AS createdAt,a.reviewed_at AS reviewedAt,a.resolution_note AS resolutionNote,COALESCE(pr.name,account.display_name,a.user_id) AS author FROM social_community_appeals a LEFT JOIN accounts account ON account.user_id=a.user_id LEFT JOIN profiles pr ON pr.user_id=a.user_id WHERE a.community_id=? ORDER BY CASE WHEN a.status=\'open\' THEN 0 ELSE 1 END,a.created_at DESC LIMIT 100').all(c.id);
  const reports=db.prepare("SELECT sr.post_id AS postId,sr.user_id AS reporterId,sr.reason,sr.created_at AS createdAt,substr(p.body,1,260) AS excerpt,p.user_id AS authorId "+
   "FROM social_reports sr JOIN social_posts p ON p.id=sr.post_id WHERE p.community_id=? AND sr.status='open' ORDER BY sr.created_at DESC LIMIT 80").all(c.id);
  const history=db.prepare('SELECT id,actor_id AS actorId,action,target_id AS targetId,note,created_at AS createdAt FROM social_community_audit WHERE community_id=? ORDER BY created_at DESC LIMIT 100').all(c.id);
  return Response.json({removed,appeals,reports,history},{headers});
 }catch(e){return failure(e);}
}
export async function POST(request:Request){
 try{
  const uid=await identity(request),d=await body(request),db=rawDatabase(),now=Date.now();
  if(!validId(d.communityId))throw Error('INPUT');
  const c=group(db,d.communityId);if(!c)return response('Community unavailable.',404);
  if(d.action==='appeal'){
   if(!['post','ban'].includes(d.targetKind)||typeof d.reason!=='string'||d.reason.trim().length<12||d.reason.length>500)throw Error('INPUT');
   const kind=d.targetKind as 'post'|'ban';
   const target=kind==='ban'?uid:d.targetId;
   if(!validId(target))throw Error('INPUT');
   const eligible=kind==='ban'
    ?db.prepare('SELECT 1 FROM social_community_bans WHERE community_id=? AND user_id=?').get(c.id,uid)
    :db.prepare('SELECT 1 FROM social_community_removed_posts r JOIN social_posts p ON p.id=r.post_id WHERE r.community_id=? AND r.post_id=? AND p.user_id=? AND p.hidden_at=0').get(c.id,target,uid);
   if(!eligible)return response('There is no active decision to appeal.',404);
   const count=db.prepare('SELECT COUNT(*) AS n FROM social_community_appeals WHERE user_id=? AND created_at>?').get(uid,now-86400000) as {n:number};
   if(count.n>=4)return response('Appeal limit reached. Try again tomorrow.',429);
   if(db.prepare("SELECT 1 FROM social_community_appeals WHERE community_id=? AND user_id=? AND target_kind=? AND target_id=? AND status='open'").get(c.id,uid,kind,target))return response('You already have a pending appeal.',409);
   const id=crypto.randomUUID();
   db.exec('BEGIN IMMEDIATE');
   try{
    db.prepare('INSERT INTO social_community_appeals(id,community_id,user_id,target_kind,target_id,reason,created_at) VALUES(?,?,?,?,?,?,?)').run(id,c.id,uid,kind,target,d.reason.trim(),now);
    log(db,c.id,uid,'appeal_submitted',id,kind,now);
    const moderators=db.prepare("SELECT user_id FROM social_community_members WHERE community_id=? AND role IN ('owner','moderator') LIMIT 25").all(c.id) as {user_id:string}[];
    for(const member of moderators)createNotice(db,{recipientId:member.user_id,actorId:uid,kind:'appeal_review',communityId:c.id,message:'A member submitted an appeal.',now});
    db.exec('COMMIT');
   }catch(e){try{db.exec('ROLLBACK')}catch{}throw e;}
   return Response.json({ok:true,id},{status:201,headers});
  }
  const staff=role(db,c.id,uid);
  if(!['owner','moderator'].includes(staff||''))return response('Moderator access is required.');
  if(d.action==='restore_post'){
   if(!validId(d.postId)||typeof d.note!=='string'||d.note.length>300)throw Error('INPUT');
   const post=db.prepare('SELECT p.user_id AS authorId,p.hidden_at AS hiddenAt FROM social_community_removed_posts r JOIN social_posts p ON p.id=r.post_id WHERE r.community_id=? AND r.post_id=? AND p.community_id=?').get(c.id,d.postId,c.id) as {authorId:string;hiddenAt:number}|undefined;
   if(!post)return response('No active community removal exists.',404);
   if(post.hiddenAt)return response('A platform-hidden or deleted post cannot be restored here.',409);
   db.exec('BEGIN IMMEDIATE');
   try{
    db.prepare('DELETE FROM social_community_removed_posts WHERE community_id=? AND post_id=?').run(c.id,d.postId);
    db.prepare("UPDATE social_community_appeals SET status='approved',reviewer_id=?,resolution_note=?,reviewed_at=? WHERE community_id=? AND target_kind='post' AND target_id=? AND status='open'").run(uid,d.note.trim()||'Post restored',now,c.id,d.postId);
    log(db,c.id,uid,'post_restored',d.postId,d.note.trim(),now);
    createNotice(db,{recipientId:post.authorId,actorId:uid,kind:'post_restored',communityId:c.id,message:'Your community post was restored.',now});
    db.exec('COMMIT');
   }catch(e){try{db.exec('ROLLBACK')}catch{}throw e;}
   return Response.json({ok:true},{headers});
  }
  if(d.action==='resolve_appeal'){
   if(!validId(d.appealId)||!['approve','deny'].includes(d.decision)||typeof d.note!=='string'||d.note.length>300)throw Error('INPUT');
   const appeal=db.prepare('SELECT id,community_id,user_id,target_kind,target_id,status FROM social_community_appeals WHERE id=? AND community_id=?').get(d.appealId,c.id) as Appeal|undefined;
   if(!appeal||appeal.status!=='open')return response('Appeal no longer pending.',404);
   if(appeal.user_id===uid)return response('You cannot review your own appeal.');
   if(d.decision==='approve'){
    const eligible=appeal.target_kind==='ban'
     ?db.prepare('SELECT 1 FROM social_community_bans WHERE community_id=? AND user_id=?').get(c.id,appeal.user_id)
     :db.prepare('SELECT 1 FROM social_community_removed_posts r JOIN social_posts p ON p.id=r.post_id WHERE r.community_id=? AND r.post_id=? AND p.user_id=? AND p.hidden_at=0').get(c.id,appeal.target_id,appeal.user_id);
    if(!eligible)return response('The appealed decision is no longer active.',409);
   }
   db.exec('BEGIN IMMEDIATE');
   try{
    if(d.decision==='approve'){
     if(appeal.target_kind==='ban'){
      db.prepare('DELETE FROM social_community_bans WHERE community_id=? AND user_id=?').run(c.id,appeal.user_id);
      log(db,c.id,uid,'member_unbanned',appeal.user_id,'Appeal accepted',now);
     }else{
      db.prepare('DELETE FROM social_community_removed_posts WHERE community_id=? AND post_id=?').run(c.id,appeal.target_id);
      log(db,c.id,uid,'post_restored',appeal.target_id,'Appeal accepted',now);
     }
    }
    db.prepare("UPDATE social_community_appeals SET status=?,reviewer_id=?,resolution_note=?,reviewed_at=? WHERE id=? AND status='open'").run(d.decision==='approve'?'approved':'denied',uid,d.note.trim(),now,appeal.id);
    log(db,c.id,uid,d.decision==='approve'?'appeal_approved':'appeal_denied',appeal.id,d.note.trim(),now);
    createNotice(db,{recipientId:appeal.user_id,actorId:uid,kind:'appeal_review',communityId:c.id,message:d.decision==='approve'?'Your community appeal was approved.':'Your community appeal was denied.',now});
    db.exec('COMMIT');
   }catch(e){try{db.exec('ROLLBACK')}catch{}throw e;}
   return Response.json({ok:true},{headers});
  }
  if(d.action==='review_report'){
   if(!validId(d.postId)||!validId(d.reporterId)||!['resolve','dismiss','remove'].includes(d.decision)||typeof d.note!=='string'||d.note.length>300)throw Error('INPUT');
   const report=db.prepare("SELECT p.user_id AS authorId,p.hidden_at AS hiddenAt FROM social_reports sr JOIN social_posts p ON p.id=sr.post_id WHERE sr.post_id=? AND sr.user_id=? AND sr.status='open' AND p.community_id=?").get(d.postId,d.reporterId,c.id) as {authorId:string;hiddenAt:number}|undefined;
   if(!report)return response('Report no longer pending.',404);
   if(d.decision==='remove'&&staff!=='owner'&&report.authorId===c.ownerId)return response('Only the owner can moderate owner posts.');
   if(d.decision==='remove'&&report.hiddenAt)return response('The platform has already hidden this post.',409);
   db.exec('BEGIN IMMEDIATE');
   try{
    if(d.decision==='remove'){
     const inserted=db.prepare('INSERT OR IGNORE INTO social_community_removed_posts(community_id,post_id,actor_id,reason,created_at) VALUES(?,?,?,?,?)').run(c.id,d.postId,uid,d.note.trim()||'Community report',now);
     if(inserted.changes){log(db,c.id,uid,'post_removed',d.postId,d.note.trim(),now);createNotice(db,{recipientId:report.authorId,actorId:uid,kind:'post_removed',communityId:c.id,message:'Your community post was removed following a report.',now});}
    }
    db.prepare('UPDATE social_reports SET status=?,reviewed_at=?,reviewed_by=?,resolution_note=? WHERE post_id=? AND user_id=? AND status=\'open\'').run(d.decision==='dismiss'?'dismissed':'resolved',now,uid,d.note.trim(),d.postId,d.reporterId);
    log(db,c.id,uid,d.decision==='dismiss'?'report_dismissed':'report_resolved',d.postId,d.note.trim(),now);
    db.exec('COMMIT');
   }catch(e){try{db.exec('ROLLBACK')}catch{}throw e;}
   return Response.json({ok:true},{headers});
  }
  throw Error('INPUT');
 }catch(e){return failure(e);}
}
