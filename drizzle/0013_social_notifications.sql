-- Native persistent social notifications and creator handles. No outbound provider required.
CREATE TABLE social_handles (
 user_id TEXT PRIMARY KEY NOT NULL,
 handle TEXT NOT NULL UNIQUE COLLATE NOCASE,
 updated_at INTEGER NOT NULL
);
CREATE TABLE social_notification_prefs (
 user_id TEXT PRIMARY KEY NOT NULL,
 social INTEGER NOT NULL DEFAULT 1 CHECK(social IN (0,1)),
 mentions INTEGER NOT NULL DEFAULT 1 CHECK(mentions IN (0,1)),
 communities INTEGER NOT NULL DEFAULT 1 CHECK(communities IN (0,1)),
 moderation INTEGER NOT NULL DEFAULT 1 CHECK(moderation IN (0,1)),
 updated_at INTEGER NOT NULL
);
CREATE TABLE social_notifications (
 id TEXT PRIMARY KEY NOT NULL,
 recipient_id TEXT NOT NULL,
 actor_id TEXT,
 kind TEXT NOT NULL CHECK(kind IN ('follow','reaction','reply','mention','post_removed','post_restored','ban','unban','appeal_review','join_review','report_review')),
 post_id TEXT,
 community_id TEXT,
 message TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL,
 read_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_social_notifications_inbox ON social_notifications(recipient_id,created_at DESC);
CREATE INDEX idx_social_notifications_unread ON social_notifications(recipient_id,read_at,created_at DESC);
CREATE UNIQUE INDEX idx_social_notifications_post ON social_notifications(recipient_id,actor_id,kind,post_id) WHERE post_id IS NOT NULL;
