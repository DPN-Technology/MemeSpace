CREATE TABLE social_communities (
 id TEXT PRIMARY KEY NOT NULL,
 slug TEXT UNIQUE NOT NULL,
 name TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 owner_id TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX idx_social_communities_owner ON social_communities(owner_id);
CREATE TABLE social_community_members (
 community_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner','moderator','member')),
 joined_at INTEGER NOT NULL,
 PRIMARY KEY(community_id,user_id)
);
CREATE INDEX idx_social_community_members_user ON social_community_members(user_id,community_id);
CREATE TABLE social_community_bans (
 community_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 actor_id TEXT NOT NULL,
 reason TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL,
 PRIMARY KEY(community_id,user_id)
);
CREATE TABLE social_community_removed_posts (
 community_id TEXT NOT NULL,
 post_id TEXT PRIMARY KEY NOT NULL,
 actor_id TEXT NOT NULL,
 reason TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL
);
ALTER TABLE social_posts ADD COLUMN community_id TEXT;
CREATE INDEX idx_social_posts_community ON social_posts(community_id,hidden_at,created_at DESC);
