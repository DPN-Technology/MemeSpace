CREATE TABLE social_media (
 post_id TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL,
 mime TEXT NOT NULL,
 content BLOB NOT NULL,
 byte_size INTEGER NOT NULL,
 width INTEGER NOT NULL,
 height INTEGER NOT NULL,
 created_at INTEGER NOT NULL,
 CHECK(mime IN ('image/png','image/jpeg','image/gif')),
 CHECK(byte_size > 0 AND byte_size <= 2097152)
);
CREATE INDEX idx_social_media_owner ON social_media(user_id);
