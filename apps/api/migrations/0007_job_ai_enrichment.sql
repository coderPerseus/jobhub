CREATE TABLE job_media (
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  source_url TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  raw_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (job_id, position)
);

CREATE INDEX idx_job_media_job_id ON job_media (job_id, position);

CREATE TABLE job_ocr_results (
  job_id TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('not_required', 'completed', 'partial', 'failed')),
  image_count INTEGER NOT NULL DEFAULT 0,
  processed_count INTEGER NOT NULL DEFAULT 0,
  combined_text TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL,
  raw_response TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  processed_at TEXT NOT NULL
);

CREATE INDEX idx_job_ocr_status ON job_ocr_results (status, processed_at DESC);

CREATE TABLE job_ai_reviews (
  job_id TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  is_recruitment INTEGER NOT NULL CHECK (is_recruitment IN (0, 1)),
  content_completeness INTEGER NOT NULL CHECK (content_completeness BETWEEN 0 AND 100),
  credibility_signal TEXT NOT NULL CHECK (credibility_signal IN ('positive', 'mixed', 'negative')),
  factual_verification_status TEXT NOT NULL CHECK (factual_verification_status IN ('not_applicable', 'unverified', 'partially_verified', 'verified', 'conflicting')),
  should_publish INTEGER NOT NULL CHECK (should_publish IN (0, 1)),
  company_name TEXT,
  lookup_targets_json TEXT NOT NULL DEFAULT '[]',
  risk_flags_json TEXT NOT NULL DEFAULT '[]',
  missing_fields_json TEXT NOT NULL DEFAULT '[]',
  reason TEXT NOT NULL,
  search_evidence_json TEXT NOT NULL DEFAULT '[]',
  source_hash TEXT NOT NULL,
  model TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  raw_ai_response TEXT NOT NULL,
  reviewed_at TEXT NOT NULL
);

CREATE INDEX idx_job_ai_reviews_publish ON job_ai_reviews (should_publish, credibility_signal);
CREATE INDEX idx_job_ai_reviews_company ON job_ai_reviews (company_name);
