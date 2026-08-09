CREATE TABLE email_subscriptions (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  categories_json TEXT NOT NULL DEFAULT '[]',
  pending_categories_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'unsubscribed')),
  confirm_token_hash TEXT UNIQUE,
  unsubscribe_token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  confirmed_at TEXT,
  unsubscribed_at TEXT,
  last_confirmation_sent_at TEXT
);

CREATE INDEX idx_email_subscriptions_status
  ON email_subscriptions (status, confirmed_at);

CREATE TABLE email_notification_deliveries (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES email_subscriptions(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  job_count INTEGER NOT NULL,
  sent_at TEXT NOT NULL
);

CREATE INDEX idx_email_notification_deliveries_subscription
  ON email_notification_deliveries (subscription_id, sent_at DESC);

CREATE TABLE email_notification_jobs (
  subscription_id TEXT NOT NULL REFERENCES email_subscriptions(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  delivery_id TEXT NOT NULL REFERENCES email_notification_deliveries(id) ON DELETE CASCADE,
  sent_at TEXT NOT NULL,
  PRIMARY KEY (subscription_id, job_id)
);

CREATE INDEX idx_email_notification_jobs_delivery
  ON email_notification_jobs (delivery_id);
