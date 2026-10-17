-- Community appeals and an auditable decision timeline.
CREATE TABLE social_community_appeals (
 id TEXT PRIMARY KEY NOT NULL,
 community_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 target_kind TEXT NOT NULL CHECK(target_kind IN ('post','ban')),
 target_id TEXT NOT NULL,
 reason TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','approved','denied')),
 reviewer_id TEXT,
 resolution_note TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL,
 reviewed_at INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX idx_community_appeal_one_open ON social_community_appeals(community_id,user_id,target_kind,target_id) WHERE status='open';
CREATE INDEX idx_community_appeals_queue ON social_community_appeals(community_id,status,created_at DESC);
CREATE INDEX idx_community_appeals_user ON social_community_appeals(user_id,created_at DESC);

CREATE TABLE social_community_audit (
 id TEXT PRIMARY KEY NOT NULL,
 community_id TEXT NOT NULL,
 actor_id TEXT NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('post_removed','post_restored','member_banned','member_unbanned','appeal_submitted','appeal_approved','appeal_denied','report_resolved','report_dismissed')),
 target_id TEXT NOT NULL,
 note TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL
);
CREATE INDEX idx_community_audit_recent ON social_community_audit(community_id,created_at DESC);
