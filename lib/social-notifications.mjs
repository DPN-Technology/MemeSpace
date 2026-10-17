// Account-scoped in-app event delivery; no external push/SMS provider.
export const handlePattern=/^[a-z][a-z0-9_]{2,23}$/;
const mentionsPattern=/(?:^|[^a-zA-Z0-9_])@([a-z][a-z0-9_]{2,23})(?![a-zA-Z0-9_])/gi;
const allowedKinds=new Set(['follow','reaction','reply','mention','post_removed','post_restored','ban','unban','appeal_review','join_review','report_review']);
const category=kind=>kind==='mention'?'mentions':['post_removed','post_restored','ban','unban','appeal_review','report_review'].includes(kind)?'moderation':kind==='join_review'?'communities':'social';
export function canNotify(db,recipientId,actorId,kind,communityId=null){
 if(!recipientId||!allowedKinds.has(kind)||recipientId===actorId)return false;
 const account=db.prepare('SELECT user_id FROM accounts WHERE user_id=? AND deleted_at=0 AND suspended_at=0').get(recipientId);
 if(!account)return false;
 const setting=db.prepare('SELECT social,mentions,communities,moderation FROM social_notification_prefs WHERE user_id=?').get(recipientId);
 if(setting&&setting[category(kind)]===0)return false;
 if(actorId){
  if(db.prepare("SELECT 1 FROM social_relationships WHERE (actor_id=? AND target_id=? AND kind IN ('block','mute')) OR (actor_id=? AND target_id=? AND kind='block')").get(recipientId,actorId,actorId,recipientId))return false;
 }
 if(communityId&&['reply','mention','reaction'].includes(kind)){
  if(!db.prepare("SELECT 1 FROM social_communities c WHERE c.id=? AND (c.visibility='public' OR EXISTS(SELECT 1 FROM social_community_members m WHERE m.community_id=c.id AND m.user_id=?))").get(communityId,recipientId))return false;
 }
 return true;
}
/** @param {any} db
 * @param {{recipientId:string,actorId?:string|null,kind:string,postId?:string|null,communityId?:string|null,message?:string,now?:number}} event */
export function createNotice(db,{recipientId,actorId=null,kind,postId=null,communityId=null,message='',now=Date.now()}){
 if(!canNotify(db,recipientId,actorId,kind,communityId))return false;
 const result=db.prepare('INSERT OR IGNORE INTO social_notifications(id,recipient_id,actor_id,kind,post_id,community_id,message,created_at) VALUES(?,?,?,?,?,?,?,?)')
  .run(crypto.randomUUID(),recipientId,actorId,kind,postId,communityId,String(message).slice(0,160),now);
 if(result.changes)db.prepare('DELETE FROM social_notifications WHERE id IN (SELECT id FROM social_notifications WHERE recipient_id=? ORDER BY created_at DESC,id DESC LIMIT -1 OFFSET 300)').run(recipientId);
 return !!result.changes;
}
export function notifyPost(db,userId,postId,text,replyId,communityId,now=Date.now()){
 if(replyId){
  const p=db.prepare('SELECT user_id FROM social_posts WHERE id=?').get(replyId);
  if(p&&p.user_id!==userId)createNotice(db,{recipientId:p.user_id,actorId:userId,kind:'reply',postId:replyId,communityId,now});
 }
 const handles=[...new Set([...text.matchAll(mentionsPattern)].map(m=>m[1].toLowerCase()))].slice(0,5);
 for(const handle of handles){
  const member=db.prepare('SELECT user_id FROM social_handles WHERE handle=? COLLATE NOCASE').get(handle);
  if(member)createNotice(db,{recipientId:member.user_id,actorId:userId,kind:'mention',postId,communityId,now});
 }
}
