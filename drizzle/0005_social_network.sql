CREATE TABLE social_posts (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL,
 body TEXT NOT NULL,
 topic TEXT NOT NULL DEFAULT 'general',
 reply_to TEXT,
 created_at INTEGER NOT NULL,
 edited_at INTEGER NOT NULL DEFAULT 0,
 hidden_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_social_posts_feed ON social_posts(hidden_at,reply_to,created_at DESC,id DESC);
CREATE INDEX idx_social_posts_author ON social_posts(user_id,created_at DESC);
CREATE INDEX idx_social_posts_topic ON social_posts(topic,hidden_at,created_at DESC);
CREATE TABLE social_reactions (
 user_id TEXT NOT NULL,
 post_id TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 PRIMARY KEY (user_id,post_id)
);
CREATE INDEX idx_social_reactions_post ON social_reactions(post_id);
CREATE TABLE social_follows (
 follower_id TEXT NOT NULL,
 following_id TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 PRIMARY KEY(follower_id,following_id),
 CHECK(follower_id <> following_id)
);
CREATE INDEX idx_social_follows_following ON social_follows(following_id);
CREATE TABLE social_bookmarks (
 user_id TEXT NOT NULL,
 post_id TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 PRIMARY KEY(user_id,post_id)
);
CREATE TABLE social_reports (
 user_id TEXT NOT NULL,
 post_id TEXT NOT NULL,
 reason TEXT NOT NULL DEFAULT 'community',
 created_at INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'open',
 PRIMARY KEY(user_id,post_id)
);
CREATE INDEX idx_social_reports_queue ON social_reports(status,created_at);
