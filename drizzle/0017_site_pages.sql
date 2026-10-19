-- Admin page editor: draft/published pages made of validated content blocks, with revision history.
CREATE TABLE site_pages (
 id TEXT PRIMARY KEY NOT NULL,
 slug TEXT NOT NULL UNIQUE,
 title TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
 draft_blocks TEXT NOT NULL DEFAULT '[]',
 live_title TEXT NOT NULL DEFAULT '',
 live_description TEXT NOT NULL DEFAULT '',
 live_blocks TEXT NOT NULL DEFAULT '[]',
 version INTEGER NOT NULL DEFAULT 1,
 created_by TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 published_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_site_pages_status ON site_pages(status, updated_at);
CREATE TABLE site_page_revisions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 page_id TEXT NOT NULL REFERENCES site_pages(id) ON DELETE CASCADE,
 version INTEGER NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('draft','publish','restore')),
 title TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 blocks TEXT NOT NULL,
 author TEXT NOT NULL,
 note TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL
);
CREATE INDEX idx_site_page_revisions_page ON site_page_revisions(page_id, id);
