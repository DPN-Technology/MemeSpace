// Profile overview for the tabbed creator profile (issue #25). Read-only aggregation over
// existing social tables plus an opt-in privacy flag for linked wallet addresses.
const ACHIEVEMENTS = Object.freeze([
  { id: 'first-post', title: 'First transmission', description: 'Publish your first post.', stat: 'posts', goal: 1 },
  { id: 'ten-posts', title: 'Regular signal', description: 'Publish 10 posts.', stat: 'posts', goal: 10 },
  { id: 'fifty-posts', title: 'Broadcast tower', description: 'Publish 50 posts.', stat: 'posts', goal: 50 },
  { id: 'first-follower', title: 'Someone is listening', description: 'Gain your first follower.', stat: 'followers', goal: 1 },
  { id: 'ten-followers', title: 'Small crowd', description: 'Reach 10 followers.', stat: 'followers', goal: 10 },
  { id: 'reacted', title: 'Resonance', description: 'Receive 25 reactions.', stat: 'reactions', goal: 25 },
  { id: 'joiner', title: 'Community member', description: 'Join a community.', stat: 'communities', goal: 1 },
  { id: 'wallet', title: 'Wallet connected', description: 'Link a Solana wallet.', stat: 'wallets', goal: 1 },
]);

export function computeAchievements(stats) {
  return ACHIEVEMENTS.map(({ id, title, description, stat, goal }) => {
    const value = Math.max(0, Number(stats?.[stat] ?? 0));
    return { id, title, description, goal, progress: Math.min(value, goal), earned: value >= goal };
  });
}

export function setWalletVisibility(db, userId, visible, now = Date.now()) {
  db.prepare('INSERT INTO social_profile_privacy(user_id,show_wallets,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET show_wallets=excluded.show_wallets,updated_at=excluded.updated_at')
    .run(userId, visible ? 1 : 0, now);
  return Boolean(visible);
}

const count = (db, sql, ...args) => Number(db.prepare(sql).get(...args)?.n ?? 0);

export function getProfileOverview(db, targetId, viewerId = '') {
  const account = db.prepare('SELECT created_at FROM accounts WHERE user_id=? AND deleted_at=0 AND suspended_at=0').get(targetId);
  if (!account) return null;
  const blocked = viewerId && db.prepare("SELECT 1 FROM social_relationships WHERE actor_id=? AND target_id=? AND kind='block'").get(targetId, viewerId);
  if (blocked) return null;
  const mine = targetId === viewerId;
  const wallets = db.prepare('SELECT address,linked_at FROM wallet_links WHERE user_id=? ORDER BY linked_at').all(targetId);
  const showWallets = Boolean(db.prepare('SELECT show_wallets FROM social_profile_privacy WHERE user_id=?').get(targetId)?.show_wallets);
  const communities = db.prepare(
    "SELECT c.id,c.slug,c.name,m.role FROM social_community_members m JOIN social_communities c ON c.id=m.community_id " +
    "WHERE m.user_id=? AND (c.visibility='public' OR ?=1 OR EXISTS(SELECT 1 FROM social_community_members v WHERE v.community_id=c.id AND v.user_id=?)) " +
    "ORDER BY m.joined_at DESC LIMIT 50",
  ).all(targetId, mine ? 1 : 0, viewerId || '');
  const visibleWallets = mine || showWallets ? wallets.map((w) => ({ address: w.address, linkedAt: Number(w.linked_at) })) : [];
  const stats = {
    posts: count(db, 'SELECT COUNT(*) AS n FROM social_posts WHERE user_id=? AND hidden_at=0 AND reply_to IS NULL AND community_id IS NULL', targetId),
    replies: count(db, 'SELECT COUNT(*) AS n FROM social_posts WHERE user_id=? AND hidden_at=0 AND reply_to IS NOT NULL', targetId),
    reactions: count(db, 'SELECT COUNT(*) AS n FROM social_reactions r JOIN social_posts p ON p.id=r.post_id WHERE p.user_id=? AND p.hidden_at=0 AND r.user_id<>?', targetId, targetId),
    followers: count(db, 'SELECT COUNT(*) AS n FROM social_follows WHERE following_id=?', targetId),
    following: count(db, 'SELECT COUNT(*) AS n FROM social_follows WHERE follower_id=?', targetId),
    communities: communities.length,
    wallets: visibleWallets.length,
  };
  return {
    userId: targetId,
    mine,
    joinedAt: Number(account.created_at),
    stats,
    communities,
    achievements: computeAchievements(stats),
    walletsVisible: showWallets,
    wallets: visibleWallets,
  };
}
