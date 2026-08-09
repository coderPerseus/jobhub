ALTER TABLE jobs ADD COLUMN content_type TEXT;
ALTER TABLE jobs ADD COLUMN detail_fetched_at TEXT;

CREATE TABLE job_detail_fetches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL CHECK (platform IN ('XHS', 'X')),
  platform_post_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  provider_request_id TEXT,
  fetched_at TEXT NOT NULL,
  raw_response TEXT NOT NULL,
  UNIQUE (platform, platform_post_id)
);

CREATE INDEX idx_job_detail_fetches_fetched_at
  ON job_detail_fetches (fetched_at DESC);
