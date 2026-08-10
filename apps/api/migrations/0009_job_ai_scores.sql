CREATE TABLE job_ai_scores (
  job_id TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  reason TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  model TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  raw_ai_response TEXT NOT NULL,
  scored_at TEXT NOT NULL
);

CREATE INDEX idx_job_ai_scores_score ON job_ai_scores (score DESC);
