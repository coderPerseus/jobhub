CREATE TABLE crawl_batch_raw_chunks (
  crawl_batch_id INTEGER NOT NULL REFERENCES crawl_batches(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  encoding TEXT NOT NULL DEFAULT 'base64',
  raw_chunk TEXT NOT NULL,
  PRIMARY KEY (crawl_batch_id, chunk_index)
);

