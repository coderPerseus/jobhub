CREATE TABLE job_enrichment_tasks (
  job_id TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  queued_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);

CREATE INDEX idx_job_enrichment_tasks_status ON job_enrichment_tasks (status, queued_at);

INSERT INTO job_enrichment_tasks
  (job_id, status, queued_at, started_at, completed_at, attempts, last_error)
SELECT job_id, 'completed', reviewed_at, reviewed_at, reviewed_at, 1, NULL
FROM job_ai_reviews;
