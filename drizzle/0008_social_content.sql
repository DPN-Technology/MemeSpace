ALTER TABLE social_posts ADD COLUMN quote_post_id TEXT;
CREATE INDEX idx_social_posts_quotes ON social_posts(quote_post_id);
CREATE TABLE social_hashtags (
 post_id TEXT NOT NULL,
 tag TEXT NOT NULL,
 PRIMARY KEY(post_id,tag)
);
CREATE INDEX idx_social_hashtags_discover ON social_hashtags(tag,post_id);
