CREATE TABLE job_structured_details (
  job_id TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  company_name TEXT,
  company_nature TEXT,
  recruitment_target TEXT,
  position_title TEXT NOT NULL,
  positions_json TEXT NOT NULL DEFAULT '[]',
  work_location TEXT,
  work_mode TEXT,
  employment_type TEXT,
  salary TEXT,
  experience_requirement TEXT,
  education_requirement TEXT,
  skills_json TEXT NOT NULL DEFAULT '[]',
  benefits_json TEXT NOT NULL DEFAULT '[]',
  application_url TEXT,
  contact TEXT,
  application_deadline TEXT,
  summary TEXT NOT NULL,
  language TEXT,
  confidence REAL NOT NULL DEFAULT 0,
  source_hash TEXT NOT NULL,
  source_updated_at TEXT NOT NULL,
  structured_at TEXT NOT NULL,
  model TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  raw_ai_response TEXT NOT NULL
);

CREATE INDEX idx_job_structured_company_name
  ON job_structured_details (company_name);
CREATE INDEX idx_job_structured_position_title
  ON job_structured_details (position_title);
CREATE INDEX idx_job_structured_work_location
  ON job_structured_details (work_location);
