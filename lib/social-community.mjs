// Shared permission and visibility checks for public creator communities.
export const communitySlug=/^[a-z][a-z0-9-]{2,39}$/;
export function communityMembership(db,id,userId){
 return id?db.prepare('SELECT role FROM social_community_members WHERE community_id=? AND user_id=?').get(id,userId)||null:null;
}
export function communityWritable(db,id,userId){
 if(!id)return true;
 return !!db.prepare(
  "SELECT 1 FROM social_communities c JOIN social_community_members m ON m.community_id=c.id AND m.user_id=? "+
  "WHERE c.id=? AND NOT EXISTS(SELECT 1 FROM social_community_bans b WHERE b.community_id=c.id AND b.user_id=?)"
 ).get(userId,id,userId);
}
export function communityVisiblePostFilter(alias='p'){
 return "NOT EXISTS(SELECT 1 FROM social_community_removed_posts rm WHERE rm.post_id="+alias+".id OR rm.post_id="+alias+".reply_to)";
}
