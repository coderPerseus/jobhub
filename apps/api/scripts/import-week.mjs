import { execFileSync } from "node:child_process";

import { createRequest, parseResponse } from "../src/tikhub.ts";

const token = process.env.TIKHUB_API_KEY;
if (!token) throw new Error("TIKHUB_API_KEY is required");

const targetPerPlatform = Number(process.env.TARGET_PER_PLATFORM ?? 100);
const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;

function sql(value) {
  if (value == null) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "0";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function runSql(statement) {
  const output = execFileSync(
    "pnpm",
    ["exec", "wrangler", "d1", "execute", "folk-job", "--remote", "--command", statement, "--json"],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
  );
  const payload = JSON.parse(output);
  if (!payload.every((result) => result.success)) throw new Error(output);
  return payload;
}

function currentCount(platform) {
  const result = runSql(`SELECT COUNT(*) AS count FROM jobs WHERE platform = ${sql(platform)}`);
  return Number(result[0].results[0]?.count ?? 0);
}

function trimPlatform(platform) {
  runSql(`DELETE FROM jobs WHERE id IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY published_at DESC, id) AS row_number
      FROM jobs WHERE platform = ${sql(platform)}
    ) ranked WHERE row_number > ${targetPerPlatform}
  )`);
}

function isRecruitment(job) {
  const pattern = job.platform === "XHS"
    ? /(招聘|招人|急聘|诚聘|招募|岗位|内推|加入我们|招聘启事|招聘信息)/i
    : /(we(?:'|’)re hiring|we are hiring|hiring for|job opening|open role|open position|vacanc(?:y|ies)|join our team|now hiring|apply for|recruiting)/i;
  return new Date(job.publishedAt).valueOf() >= cutoff && pattern.test(`${job.title}\n${job.body}`);
}

function storeJobs(batchId, acceptedJobs) {
  if (acceptedJobs.length) {
    const now = new Date().toISOString();
    const statements = acceptedJobs.map((job) => `INSERT INTO jobs
      (id, platform, platform_post_id, title, body, excerpt, author_name, author_handle,
       source_url, published_at, first_seen_at, last_seen_at, likes, comments, reposts,
       views, image_url, raw_batch_id, content_type)
     VALUES (${[
       job.id, job.platform, job.platformPostId, job.title, job.body, job.excerpt,
       job.authorName, job.authorHandle, job.sourceUrl, job.publishedAt, now, now,
       job.likes, job.comments, job.reposts, job.views, job.imageUrl, batchId, job.contentType,
     ].map(sql).join(", ")})
     ON CONFLICT (platform, platform_post_id) DO UPDATE SET
       title = excluded.title, body = excluded.body, excerpt = excluded.excerpt,
       author_name = excluded.author_name, author_handle = excluded.author_handle,
       source_url = excluded.source_url, published_at = excluded.published_at,
       last_seen_at = excluded.last_seen_at, likes = excluded.likes,
       comments = excluded.comments, reposts = excluded.reposts, views = excluded.views,
       image_url = excluded.image_url, raw_batch_id = excluded.raw_batch_id,
       content_type = excluded.content_type;`);
    runSql(statements.join("\n"));
  }
}

function storeBatch({ input, requestUrl, rawText, parsed, acceptedJobs }) {
  const now = new Date().toISOString();
  const pageCursor = input.platform === "XHS" ? String(input.page ?? 1) : input.cursor ?? null;
  const batchResult = runSql(
    `INSERT INTO crawl_batches
      (platform, query, request_url, provider_request_id, page_cursor, fetched_at, item_count, raw_response)
     VALUES (${[
       input.platform,
       input.query,
       requestUrl.toString(),
       parsed.providerRequestId,
       pageCursor,
       now,
       parsed.jobs.length,
       rawText,
     ].map(sql).join(", ")})`,
  );
  const batchId = Number(batchResult[0].meta.last_row_id);
  storeJobs(batchId, acceptedJobs);

  return batchId;
}

function reprocessStoredBatches() {
  const payload = runSql("SELECT id, platform, raw_response FROM crawl_batches ORDER BY id");
  for (const row of payload[0].results) {
    const parsed = parseResponse(row.platform, JSON.parse(row.raw_response));
    storeJobs(Number(row.id), parsed.jobs.filter(isRecruitment));
  }
}

async function ingest(input) {
  const requestUrl = createRequest(input);
  const response = await fetch(requestUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const rawText = await response.text();
  if (!response.ok) throw new Error(`TikHub ${response.status}: ${rawText.slice(0, 500)}`);
  const parsed = parseResponse(input.platform, JSON.parse(rawText));
  const acceptedJobs = parsed.jobs.filter(isRecruitment);
  const batchId = storeBatch({ input, requestUrl, rawText, parsed, acceptedJobs });
  const total = currentCount(input.platform);
  const summary = {
    batchId,
    platform: input.platform,
    received: parsed.jobs.length,
    accepted: acceptedJobs.length,
    total,
    next: parsed.next,
    providerRequestId: parsed.providerRequestId,
  };
  console.log(JSON.stringify(summary));
  return summary;
}

async function importXhs() {
  const queries = ["招聘", "招人", "急聘", "诚聘", "招募"];
  let total = currentCount("XHS");
  for (const query of queries) {
    let page = 1;
    let searchId;
    let searchSessionId;
    while (total < targetPerPlatform && page <= 12) {
      const result = await ingest({ platform: "XHS", query, page, searchId, searchSessionId });
      total = result.total;
      searchId = result.next.searchId ?? searchId;
      searchSessionId = result.next.searchSessionId ?? searchSessionId;
      page = result.next.page ?? page + 1;
      if (result.received === 0) break;
    }
    if (total >= targetPerPlatform) break;
  }
  return total;
}

async function importX() {
  const since = new Date(cutoff).toISOString().slice(0, 10);
  const queries = [
    `(\"we are hiring\" OR \"job opening\" OR \"join our team\") since:${since}`,
    `(\"we're hiring\" OR \"open position\" OR \"open role\") since:${since}`,
    `(\"now hiring\" OR \"hiring for\" OR vacancies) since:${since}`,
  ];
  let total = currentCount("X");
  for (const query of queries) {
    let cursor;
    let pages = 0;
    while (total < targetPerPlatform && pages < 20) {
      const result = await ingest({ platform: "X", query, cursor });
      total = result.total;
      cursor = result.next.cursor;
      pages += 1;
      if (!cursor || result.received === 0) break;
    }
    if (total >= targetPerPlatform) break;
  }
  return total;
}

reprocessStoredBatches();
trimPlatform("XHS");
trimPlatform("X");
await importXhs();
await importX();
trimPlatform("XHS");
trimPlatform("X");
console.log(JSON.stringify({ done: true, XHS: currentCount("XHS"), X: currentCount("X") }));
