CREATE TABLE crawl_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL,
  window_start TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  last_error TEXT
);

CREATE TABLE crawl_run_states (
  run_id INTEGER NOT NULL REFERENCES crawl_runs(id),
  platform TEXT NOT NULL CHECK (platform IN ('XHS', 'X')),
  category TEXT NOT NULL,
  query TEXT NOT NULL,
  page_number INTEGER NOT NULL DEFAULT 1,
  cursor TEXT,
  search_id TEXT,
  search_session_id TEXT,
  consecutive_no_new_pages INTEGER NOT NULL DEFAULT 0,
  pages_fetched INTEGER NOT NULL DEFAULT 0,
  jobs_inserted INTEGER NOT NULL DEFAULT 0,
  details_fetched INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  last_error TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (run_id, platform, category)
);

ALTER TABLE crawl_batches ADD COLUMN run_id INTEGER REFERENCES crawl_runs(id);
ALTER TABLE crawl_batches ADD COLUMN category TEXT;
ALTER TABLE crawl_batches ADD COLUMN search_id TEXT;
ALTER TABLE crawl_batches ADD COLUMN search_session_id TEXT;
ALTER TABLE crawl_batches ADD COLUMN next_page_cursor TEXT;

ALTER TABLE jobs ADD COLUMN category TEXT;

CREATE INDEX idx_crawl_run_states_status
  ON crawl_run_states (run_id, status, platform, category);
CREATE INDEX idx_jobs_category_published_at
  ON jobs (category, published_at DESC);
