CREATE TABLE social_relationships (
 actor_id TEXT NOT NULL,
 target_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('block','mute')),
 created_at INTEGER NOT NULL,
 PRIMARY KEY(actor_id,target_id,kind),
 CHECK(actor_id <> target_id)
);
CREATE INDEX idx_social_relationships_target ON social_relationships(target_id,kind);
