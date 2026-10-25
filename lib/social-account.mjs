export function exportSocialAccount(db,userId){
  return {
    socialPosts:db.prepare('SELECT * FROM social_posts WHERE user_id=? ORDER BY created_at ASC').all(userId),
    socialHashtags:db.prepare('SELECT h.* FROM social_hashtags h JOIN social_posts p ON p.id=h.post_id WHERE p.user_id=?').all(userId),
    socialMedia:db.prepare('SELECT post_id,user_id,mime,byte_size,width,height,created_at FROM social_media WHERE user_id=?').all(userId),
    socialReactions:db.prepare('SELECT * FROM social_reactions WHERE user_id=?').all(userId),
    socialBookmarks:db.prepare('SELECT * FROM social_bookmarks WHERE user_id=?').all(userId),
    socialFollows:db.prepare('SELECT * FROM social_follows WHERE follower_id=? OR following_id=?').all(userId,userId),
    socialReports:db.prepare('SELECT * FROM social_reports WHERE user_id=?').all(userId),
    socialRelationships:db.prepare('SELECT * FROM social_relationships WHERE actor_id=? OR target_id=?').all(userId,userId),
    socialHandle:db.prepare('SELECT * FROM social_handles WHERE user_id=?').get(userId)||null,
    socialNotificationPreferences:db.prepare('SELECT * FROM social_notification_prefs WHERE user_id=?').get(userId)||null,
    socialNotifications:db.prepare('SELECT * FROM social_notifications WHERE recipient_id=? ORDER BY created_at ASC').all(userId),
    creatorProfile:db.prepare('SELECT user_id,headline,location,website,interests,accent,avatar_mime IS NOT NULL AS has_avatar,banner_mime IS NOT NULL AS has_banner,updated_at FROM social_creator_profiles WHERE user_id=?').get(userId)||null,
    ownedCommunities:db.prepare('SELECT * FROM social_communities WHERE owner_id=?').all(userId),
    communityMemberships:db.prepare('SELECT * FROM social_community_members WHERE user_id=?').all(userId),
    communityBans:db.prepare('SELECT * FROM social_community_bans WHERE user_id=? OR actor_id=?').all(userId,userId),
    communityRequests:db.prepare('SELECT * FROM social_community_requests WHERE user_id=?').all(userId),
    communityTransfers:db.prepare('SELECT * FROM social_community_transfers WHERE old_owner_id=? OR new_owner_id=?').all(userId,userId),
    communityAppeals:db.prepare('SELECT * FROM social_community_appeals WHERE user_id=?').all(userId),
    communityAuditActions:db.prepare('SELECT * FROM social_community_audit WHERE actor_id=?').all(userId),
    communityRemovals:db.prepare('SELECT * FROM social_community_removed_posts WHERE actor_id=?').all(userId)
  };
}

// Called inside the account deletion transaction; never publish private content when disbanding a space.
export function deleteSocialAccount(db,userId,now){
  const owned="SELECT id FROM social_communities WHERE owner_id=?";
  db.prepare("UPDATE social_posts SET hidden_at=?,hidden_reason='Community closed' WHERE hidden_at=0 AND "+
    "(community_id IN (SELECT id FROM social_communities WHERE owner_id=? AND visibility='private') OR "+
    "id IN (SELECT rm.post_id FROM social_community_removed_posts rm WHERE rm.community_id IN ("+owned+")) OR "+
    "reply_to IN (SELECT rm.post_id FROM social_community_removed_posts rm WHERE rm.community_id IN ("+owned+")))").run(now,userId,userId,userId);
  db.prepare('DELETE FROM social_notifications WHERE recipient_id=? OR actor_id=? OR post_id IN (SELECT id FROM social_posts WHERE user_id=?) OR community_id IN ('+owned+')').run(userId,userId,userId,userId);
  db.prepare('UPDATE social_posts SET community_id=NULL WHERE community_id IN ('+owned+')').run(userId);
  db.prepare('DELETE FROM social_community_removed_posts WHERE community_id IN ('+owned+') OR post_id IN (SELECT id FROM social_posts WHERE user_id=?)').run(userId,userId);
  db.prepare('DELETE FROM social_community_appeals WHERE community_id IN ('+owned+') OR user_id=? OR reviewer_id=?').run(userId,userId,userId);
  db.prepare('DELETE FROM social_community_audit WHERE community_id IN ('+owned+') OR actor_id=?').run(userId,userId);
  db.prepare('DELETE FROM social_community_bans WHERE community_id IN ('+owned+') OR user_id=? OR actor_id=?').run(userId,userId,userId);
  db.prepare('DELETE FROM social_community_requests WHERE community_id IN ('+owned+') OR user_id=?').run(userId,userId);
  db.prepare('DELETE FROM social_community_transfers WHERE community_id IN ('+owned+') OR old_owner_id=? OR new_owner_id=?').run(userId,userId,userId);
  db.prepare('DELETE FROM social_community_members WHERE community_id IN ('+owned+') OR user_id=?').run(userId,userId);
  db.prepare('DELETE FROM social_communities WHERE owner_id=?').run(userId);
  for(const table of ['social_creator_profiles','social_notification_prefs','social_handles','social_media'])
    db.prepare(`DELETE FROM ${table} WHERE user_id=?`).run(userId);
  db.prepare('DELETE FROM social_hashtags WHERE post_id IN (SELECT id FROM social_posts WHERE user_id=?)').run(userId);
  for(const table of ['social_reactions','social_bookmarks','social_reports'])
    db.prepare(`DELETE FROM ${table} WHERE user_id=? OR post_id IN (SELECT id FROM social_posts WHERE user_id=?)`).run(userId,userId);
  db.prepare('DELETE FROM social_follows WHERE follower_id=? OR following_id=?').run(userId,userId);
  db.prepare('DELETE FROM social_relationships WHERE actor_id=? OR target_id=?').run(userId,userId);
  db.prepare("UPDATE social_posts SET hidden_at=?,hidden_reason='Account closed' WHERE hidden_at=0 AND reply_to IN (SELECT id FROM social_posts WHERE user_id=? AND reply_to IS NULL)").run(now,userId);
  db.prepare('DELETE FROM social_posts WHERE user_id=?').run(userId);
}
