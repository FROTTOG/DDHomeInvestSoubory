-- Funkce webu: koncepty/verze, workflow poptávek, hlídací pes a anonymní analytika.
ALTER TABLE contact_messages ADD COLUMN status TEXT NOT NULL DEFAULT 'new';
ALTER TABLE contact_messages ADD COLUMN admin_note TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS content_draft (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS content_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_content_versions_created_at ON content_versions(created_at DESC);

CREATE TABLE IF NOT EXISTS watch_subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  token TEXT NOT NULL UNIQUE,
  confirmed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TEXT,
  unsubscribed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_watch_subscribers_active ON watch_subscribers(confirmed, unsubscribed_at);

CREATE TABLE IF NOT EXISTS email_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  recipients INTEGER NOT NULL DEFAULT 0,
  UNIQUE(project_id, fingerprint)
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event TEXT NOT NULL,
  path TEXT NOT NULL DEFAULT '',
  project_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics_events(created_at DESC);
