CREATE TABLE crawl_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL CHECK (platform IN ('XHS', 'X')),
  query TEXT NOT NULL,
  request_url TEXT NOT NULL,
  provider_request_id TEXT,
  page_cursor TEXT,
  fetched_at TEXT NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0,
  raw_response TEXT NOT NULL
);

CREATE INDEX idx_crawl_batches_platform_fetched_at
  ON crawl_batches (platform, fetched_at DESC);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('XHS', 'X')),
  platform_post_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_handle TEXT,
  source_url TEXT NOT NULL,
  published_at TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  reposts INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  raw_batch_id INTEGER NOT NULL REFERENCES crawl_batches(id),
  UNIQUE (platform, platform_post_id)
);

CREATE INDEX idx_jobs_published_at ON jobs (published_at DESC);
CREATE INDEX idx_jobs_platform_published_at ON jobs (platform, published_at DESC);
