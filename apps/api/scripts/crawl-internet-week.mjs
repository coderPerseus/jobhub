import { execFileSync } from "node:child_process";
import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import {
  createDetailRequest,
  createRequest,
  parseDetailResponse,
  parseResponse,
} from "../src/tikhub.ts";
import { classifyInternetJob } from "../src/job-classification.ts";

const token = process.env.TIKHUB_API_KEY;
if (!token) throw new Error("TIKHUB_API_KEY is required");

const SCOPE = "internet-jobs-week";
const MAX_PAGES_PER_QUERY = 30;
const STOP_AFTER_NO_NEW_PAGES = 3;
const DETAIL_CONCURRENCY = 8;
const REQUEST_TIMEOUT_MS = 30_000;
const INLINE_RAW_RESPONSE_LIMIT = 30_000;
const RAW_CHUNK_SIZE = 25_000;
const D1_FILE_CHUNK_SIZE = 40_000;

const categories = [
  {
    id: "ai",
    xhs: "AI 人工智能 招聘",
    x: '("AI engineer" OR "machine learning engineer" OR "LLM engineer") (hiring OR "job opening")',
    pattern: /(AI|人工智能|机器学习|大模型|LLM|AIGC|machine learning)/i,
  },
  {
    id: "fullstack",
    xhs: "全栈 开发 招聘",
    x: '("full stack" OR fullstack) (engineer OR developer) (hiring OR "job opening")',
    pattern: /(全栈|full[ -]?stack|fullstack)/i,
  },
  {
    id: "frontend",
    xhs: "前端 开发 招聘",
    x: '("frontend engineer" OR "front end developer") (hiring OR "job opening")',
    pattern: /(前端|frontend|front-end|front end)/i,
  },
  {
    id: "backend",
    xhs: "后端 开发 招聘",
    x: '("backend engineer" OR "back end developer") (hiring OR "job opening")',
    pattern: /(后端|服务端|backend|back-end|back end)/i,
  },
  {
    id: "mobile",
    xhs: "客户端 移动开发 招聘",
    x: '("mobile engineer" OR "iOS engineer" OR "Android engineer") (hiring OR "job opening")',
    pattern: /(客户端|移动开发|iOS|Android|Flutter|mobile engineer)/i,
  },
  {
    id: "product",
    xhs: "互联网 产品经理 招聘",
    x: '("product manager" OR "product lead") (hiring OR "job opening")',
    pattern: /(产品经理|产品负责人|product manager|product lead)/i,
  },
  {
    id: "design",
    xhs: "互联网 UI UX 设计 招聘",
    x: '("product designer" OR "UX designer" OR "UI designer") (hiring OR "job opening")',
    pattern: /(UI|UX|交互设计|视觉设计|产品设计|product designer|UX designer|UI designer)/i,
  },
  {
    id: "data",
    xhs: "数据分析 数据工程 招聘",
    x: '("data analyst" OR "data engineer" OR "data scientist") (hiring OR "job opening")',
    pattern: /(数据分析|数据工程|数据科学|data analyst|data engineer|data scientist)/i,
  },
  {
    id: "operations",
    xhs: "互联网 运营 招聘",
    x: '("community manager" OR "customer success" OR "developer relations" OR operations) (hiring OR "job opening")',
    pattern: /(互联网运营|内容运营|用户运营|社区运营|客户成功|开发者关系|community manager|customer success|developer relations|DevRel)/i,
  },
  {
    id: "marketing",
    xhs: "互联网 营销 市场 增长 招聘",
    x: '("growth marketing" OR "digital marketing" OR "marketing manager") (hiring OR "job opening")',
    pattern: /(营销|市场|增长|投放|品牌|growth marketing|digital marketing|marketing manager)/i,
  },
];

const recruitmentPatterns = {
  XHS: /(招聘|招人|急聘|诚聘|招募|岗位|内推|加入我们|招聘启事|招聘信息)/i,
  X: /(we(?:'|’)re hiring|we are hiring|hiring for|job opening|open role|open position|vacanc(?:y|ies)|join our team|now hiring|apply for|recruiting|hiring)/i,
};

function sql(value) {
  if (value == null) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "0";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function wrangler(args) {
  return execFileSync("pnpm", ["exec", "wrangler", ...args], {
    encoding: "utf8",
    maxBuffer: 80 * 1024 * 1024,
  });
}

function parseWranglerJson(output) {
  const lines = output.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const candidate = lines.slice(index).join("\n").trim();
    if (!candidate.startsWith("[") && !candidate.startsWith("{")) continue;
    try {
      return JSON.parse(candidate);
    } catch {
      // Wrangler can print progress lines before the JSON payload for file uploads.
    }
  }
  throw new Error(`Unable to parse Wrangler JSON output: ${output.slice(-1000)}`);
}

function query(statement) {
  const payload = parseWranglerJson(wrangler([
    "d1", "execute", "folk-job", "--remote", "--command", statement, "--json",
  ]));
  if (!payload.every((result) => result.success)) throw new Error(JSON.stringify(payload));
  return payload[0]?.results ?? [];
}

function executeFile(statement, label) {
  const path = join(tmpdir(), `folk-job-crawl-${process.pid}-${label}.sql`);
  writeFileSync(path, statement);
  try {
    const payload = parseWranglerJson(wrangler([
      "d1", "execute", "folk-job", "--remote", "--file", path, "--json",
    ]));
    if (!payload.every((result) => result.success)) throw new Error(JSON.stringify(payload));
    return payload;
  } finally {
    unlinkSync(path);
  }
}

function executeStatements(statements, label) {
  let group = [];
  let length = 0;
  let groupIndex = 0;
  for (const statement of statements) {
    if (group.length > 0 && length + statement.length > D1_FILE_CHUNK_SIZE) {
      executeFile(group.join("\n"), `${label}-${groupIndex}`);
      group = [];
      length = 0;
      groupIndex += 1;
    }
    group.push(statement);
    length += statement.length;
  }
  if (group.length > 0) executeFile(group.join("\n"), `${label}-${groupIndex}`);
}

function brief(value) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 220 ? `${normalized.slice(0, 219)}…` : normalized;
}

function rawResponseStorage(rawText) {
  if (rawText.length <= INLINE_RAW_RESPONSE_LIMIT) {
    return { storedValue: rawText, chunks: [] };
  }
  const encoded = gzipSync(Buffer.from(rawText, "utf8")).toString("base64");
  const chunks = [];
  for (let index = 0; index < encoded.length; index += RAW_CHUNK_SIZE) {
    chunks.push(encoded.slice(index, index + RAW_CHUNK_SIZE));
  }
  return {
    storedValue: JSON.stringify({ storage: "crawl_batch_raw_chunks", encoding: "gzip+base64", chunks: chunks.length }),
    chunks,
  };
}

function isoTime(value) {
  const time = new Date(value).valueOf();
  return Number.isFinite(time) && time > Date.UTC(2000, 0, 1) ? time : null;
}

function acceptedJobs(jobs, category, cutoffTime) {
  return jobs.flatMap((job) => {
    const text = `${job.title}\n${job.body}`;
    const publishedTime = isoTime(job.publishedAt);
    const classifiedCategory = classifyInternetJob(text);
    const accepted = publishedTime != null
      && publishedTime >= cutoffTime
      && recruitmentPatterns[job.platform].test(text)
      && category.pattern.test(text)
      && classifiedCategory === category.id;
    return accepted ? [{ ...job, category: classifiedCategory }] : [];
  });
}

async function fetchWithRetry(url, target, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const rawText = await response.text();
      if (!response.ok) throw new Error(`${target} returned ${response.status}: ${rawText.slice(0, 300)}`);
      return rawText;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
    }
  }
  throw lastError;
}

function existingRows(platform, jobs) {
  if (jobs.length === 0) return new Map();
  const ids = jobs.map((job) => sql(job.platformPostId)).join(", ");
  const rows = query(
    `SELECT j.platform_post_id, d.id IS NOT NULL AS has_detail
     FROM jobs j
     LEFT JOIN job_detail_fetches d
       ON d.platform = j.platform AND d.platform_post_id = j.platform_post_id
     WHERE j.platform = ${sql(platform)} AND j.platform_post_id IN (${ids})`,
  );
  return new Map(rows.map((row) => [row.platform_post_id, Boolean(row.has_detail)]));
}

function jobUpsert(job, categoryId, now) {
  return `INSERT INTO jobs
    (id, platform, platform_post_id, title, body, excerpt, author_name, author_handle,
     source_url, published_at, first_seen_at, last_seen_at, likes, comments, reposts,
     views, image_url, raw_batch_id, content_type, category)
   VALUES (${[
     job.id, job.platform, job.platformPostId, job.title, job.body, job.excerpt,
     job.authorName, job.authorHandle, job.sourceUrl, job.publishedAt, now, now,
     job.likes, job.comments, job.reposts, job.views, job.imageUrl,
   ].map(sql).join(", ")},
   (SELECT seq FROM sqlite_sequence WHERE name = 'crawl_batches'),
   ${sql(job.contentType)}, ${sql(categoryId)})
   ON CONFLICT (platform, platform_post_id) DO UPDATE SET
     title = CASE WHEN jobs.detail_fetched_at IS NULL THEN excluded.title ELSE jobs.title END,
     body = CASE WHEN jobs.detail_fetched_at IS NULL THEN excluded.body ELSE jobs.body END,
     excerpt = CASE WHEN jobs.detail_fetched_at IS NULL THEN excluded.excerpt ELSE jobs.excerpt END,
     author_name = CASE WHEN jobs.detail_fetched_at IS NULL THEN excluded.author_name ELSE jobs.author_name END,
     author_handle = CASE WHEN jobs.detail_fetched_at IS NULL THEN excluded.author_handle ELSE jobs.author_handle END,
     source_url = CASE WHEN jobs.detail_fetched_at IS NULL THEN excluded.source_url ELSE jobs.source_url END,
     published_at = excluded.published_at,
     last_seen_at = excluded.last_seen_at,
     likes = excluded.likes, comments = excluded.comments,
     reposts = excluded.reposts, views = excluded.views,
     image_url = CASE WHEN jobs.detail_fetched_at IS NULL THEN excluded.image_url ELSE jobs.image_url END,
     raw_batch_id = excluded.raw_batch_id,
     content_type = excluded.content_type,
     category = COALESCE(jobs.category, excluded.category);`;
}

function storeSearchPage({ runId, state, requestUrl, rawText, parsed, jobs, newCount, next, completed }) {
  const now = new Date().toISOString();
  const requestedCursor = state.platform === "XHS" ? String(state.page_number) : state.cursor;
  const nextCursor = state.platform === "XHS" ? String(next.page ?? state.page_number + 1) : next.cursor;
  const noNewPages = newCount === 0 ? state.consecutive_no_new_pages + 1 : 0;
  const status = completed ? "complete" : "running";
  const rawStorage = rawResponseStorage(rawText);
  const statements = [
    `INSERT INTO crawl_batches
      (platform, query, request_url, provider_request_id, page_cursor, fetched_at,
       item_count, raw_response, run_id, category, search_id, search_session_id, next_page_cursor)
     VALUES (${[
       state.platform, state.query, requestUrl.toString(), parsed.providerRequestId,
       requestedCursor, now, parsed.jobs.length, rawStorage.storedValue, runId, state.category,
       next.searchId ?? state.search_id, next.searchSessionId ?? state.search_session_id,
       nextCursor,
     ].map(sql).join(", ")});`,
    ...rawStorage.chunks.map((chunk, index) => `INSERT INTO crawl_batch_raw_chunks
      (crawl_batch_id, chunk_index, encoding, raw_chunk)
     VALUES ((SELECT seq FROM sqlite_sequence WHERE name = 'crawl_batches'),
       ${sql(index)}, 'gzip+base64', ${sql(chunk)});`),
    ...jobs.map((job) => jobUpsert(job, job.category, now)),
    `UPDATE crawl_run_states SET
       page_number = ${sql(next.page ?? state.page_number + 1)},
       cursor = ${sql(next.cursor)},
       search_id = ${sql(next.searchId ?? state.search_id)},
       search_session_id = ${sql(next.searchSessionId ?? state.search_session_id)},
       consecutive_no_new_pages = ${sql(noNewPages)},
       pages_fetched = pages_fetched + 1,
       jobs_inserted = jobs_inserted + ${sql(newCount)},
       status = ${sql(status)}, last_error = NULL, updated_at = ${sql(now)}
     WHERE run_id = ${sql(runId)} AND platform = ${sql(state.platform)}
       AND category = ${sql(state.category)};`,
    `UPDATE crawl_runs SET status = 'running', updated_at = ${sql(now)}, last_error = NULL
     WHERE id = ${sql(runId)};`,
  ];
  executeStatements(statements, `search-${runId}-${state.platform}-${state.category}-${state.pages_fetched}`);
  return { noNewPages, status };
}

async function fetchDetails(targets) {
  const fetched = [];
  const failures = [];
  for (let start = 0; start < targets.length; start += DETAIL_CONCURRENCY) {
    const settled = await Promise.allSettled(targets.slice(start, start + DETAIL_CONCURRENCY).map(async (target) => {
      const requestUrl = createDetailRequest(target);
      const rawText = await fetchWithRetry(requestUrl, `${target.platform}:${target.platformPostId}`);
      const parsed = parseDetailResponse(target.platform, JSON.parse(rawText));
      return { target, requestUrl, rawText, parsed };
    }));
    fetched.push(...settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []));
    failures.push(...settled.flatMap((result) => result.status === "rejected" ? [String(result.reason)] : []));
  }
  return { fetched, failures };
}

function storeDetails(runId, state, fetched) {
  if (fetched.length === 0) return;
  const now = new Date().toISOString();
  const statements = [];
  for (const { target, requestUrl, rawText, parsed } of fetched) {
    const detail = parsed.detail;
    statements.push(
      `INSERT INTO job_detail_fetches
        (platform, platform_post_id, endpoint, provider_request_id, fetched_at, raw_response)
       VALUES (${[
         target.platform, target.platformPostId, requestUrl.pathname,
         parsed.providerRequestId, now, rawText,
       ].map(sql).join(", ")})
       ON CONFLICT (platform, platform_post_id) DO NOTHING;`,
      `UPDATE jobs SET
        title = COALESCE(${sql(detail.title)}, title),
        body = COALESCE(${sql(detail.body)}, body),
        excerpt = COALESCE(${sql(detail.body ? brief(detail.body) : null)}, excerpt),
        author_name = COALESCE(${sql(detail.authorName)}, author_name),
        author_handle = COALESCE(${sql(detail.authorHandle)}, author_handle),
        source_url = COALESCE(${sql(detail.sourceUrl)}, source_url),
        published_at = COALESCE(${sql(detail.publishedAt)}, published_at),
        likes = ${sql(detail.likes)}, comments = ${sql(detail.comments)},
        reposts = ${sql(detail.reposts)}, views = ${sql(detail.views)},
        image_url = COALESCE(${sql(detail.imageUrl)}, image_url),
        detail_fetched_at = ${sql(now)}, category = COALESCE(category, ${sql(state.category)})
       WHERE platform = ${sql(target.platform)} AND platform_post_id = ${sql(target.platformPostId)};`,
    );
  }
  statements.push(
    `UPDATE crawl_run_states SET details_fetched = details_fetched + ${sql(fetched.length)},
       updated_at = ${sql(now)}
     WHERE run_id = ${sql(runId)} AND platform = ${sql(state.platform)}
       AND category = ${sql(state.category)};`,
  );
  executeStatements(statements, `detail-${runId}-${state.platform}-${state.category}-${state.pages_fetched}`);
}

function createOrResumeRun() {
  const existing = query(
    `SELECT id, window_start FROM crawl_runs
     WHERE scope = ${sql(SCOPE)} AND status IN ('running', 'interrupted')
     ORDER BY id DESC LIMIT 1`,
  )[0];
  if (existing) return { id: Number(existing.id), windowStart: existing.window_start };

  const now = new Date().toISOString();
  const windowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000).toISOString();
  const result = executeFile(
    `INSERT INTO crawl_runs (scope, window_start, status, started_at, updated_at)
     VALUES (${[SCOPE, windowStart, "running", now, now].map(sql).join(", ")}) RETURNING id;`,
    `run-${Date.now()}`,
  );
  const id = Number(result.flatMap((entry) => entry.results ?? [])[0]?.id);
  if (!id) throw new Error("Failed to create crawl run");
  return { id, windowStart };
}

function initializeStates(runId, windowStart) {
  const since = windowStart.slice(0, 10);
  const now = new Date().toISOString();
  const statements = [];
  for (const category of categories) {
    for (const platform of ["XHS", "X"]) {
      const queryText = platform === "XHS" ? category.xhs : `${category.x} since:${since}`;
      statements.push(
        `INSERT INTO crawl_run_states
          (run_id, platform, category, query, updated_at)
         VALUES (${[runId, platform, category.id, queryText, now].map(sql).join(", ")})
         ON CONFLICT (run_id, platform, category) DO NOTHING;`,
      );
    }
  }
  executeStatements(statements, `states-${runId}`);
}

function loadStates(runId) {
  return query(
    `SELECT * FROM crawl_run_states
     WHERE run_id = ${sql(runId)} AND status != 'complete'
     ORDER BY pages_fetched, category, platform`,
  );
}

async function backfillMissingRunDetails(runId) {
  const missing = query(
    `SELECT j.platform, j.platform_post_id, j.content_type,
            COALESCE(j.category, b.category) AS category
     FROM jobs j
     JOIN crawl_batches b ON b.id = j.raw_batch_id
     LEFT JOIN job_detail_fetches d
       ON d.platform = j.platform AND d.platform_post_id = j.platform_post_id
     WHERE b.run_id = ${sql(runId)} AND d.id IS NULL
     ORDER BY j.platform, category, j.platform_post_id`,
  );
  const groups = new Map();
  for (const row of missing) {
    const key = `${row.platform}:${row.category}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({
      platform: row.platform,
      platformPostId: row.platform_post_id,
      contentType: row.content_type,
    });
  }
  for (const [key, targets] of groups) {
    const [platform, category] = key.split(":");
    const details = await fetchDetails(targets);
    storeDetails(runId, { platform, category, pages_fetched: "backfill" }, details.fetched);
    console.log(JSON.stringify({
      runId,
      platform,
      category,
      backfillTargets: targets.length,
      details: details.fetched.length,
      detailFailures: details.failures.length,
    }));
    if (details.failures.length > 0) {
      throw new Error(`Failed to backfill ${details.failures.length} ${key} detail records`);
    }
  }
}

async function processPage(runId, windowStart, state) {
  const category = categories.find((value) => value.id === state.category);
  if (!category) throw new Error(`Unknown category: ${state.category}`);
  const input = state.platform === "XHS"
    ? {
        platform: "XHS",
        query: state.query,
        page: Number(state.page_number),
        searchId: state.search_id ?? undefined,
        searchSessionId: state.search_session_id ?? undefined,
      }
    : { platform: "X", query: state.query, cursor: state.cursor ?? undefined };
  const requestUrl = createRequest(input);
  const rawText = await fetchWithRetry(requestUrl, `${state.platform}:${state.category}:search`);
  const parsed = parseResponse(state.platform, JSON.parse(rawText));
  const accepted = acceptedJobs(parsed.jobs, category, new Date(windowStart).valueOf());
  const existing = existingRows(state.platform, accepted);
  const newJobs = accepted.filter((job) => !existing.has(job.platformPostId));
  const detailTargets = accepted.filter((job) => !existing.get(job.platformPostId));
  const validTimes = parsed.jobs.map((job) => isoTime(job.publishedAt)).filter((value) => value != null);
  const reachedOldPosts = validTimes.length > 0 && Math.min(...validTimes) < new Date(windowStart).valueOf();
  const next = parsed.next;
  const projectedNoNew = newJobs.length === 0 ? Number(state.consecutive_no_new_pages) + 1 : 0;
  const noNext = state.platform === "X"
    ? !next.cursor
    : parsed.jobs.length === 0 || Number(next.page) <= Number(state.page_number);
  const completed = noNext
    || reachedOldPosts
    || projectedNoNew >= STOP_AFTER_NO_NEW_PAGES
    || Number(state.pages_fetched) + 1 >= MAX_PAGES_PER_QUERY;

  const progress = storeSearchPage({
    runId,
    state,
    requestUrl,
    rawText,
    parsed,
    jobs: accepted,
    newCount: newJobs.length,
    next,
    completed,
  });
  const details = await fetchDetails(detailTargets);
  storeDetails(runId, state, details.fetched);
  console.log(JSON.stringify({
    runId,
    platform: state.platform,
    category: state.category,
    page: state.platform === "XHS" ? state.page_number : Number(state.pages_fetched) + 1,
    received: parsed.jobs.length,
    accepted: accepted.length,
    newJobs: newJobs.length,
    details: details.fetched.length,
    detailFailures: details.failures.length,
    consecutiveNoNew: progress.noNewPages,
    complete: completed,
  }));
}

const run = createOrResumeRun();
initializeStates(run.id, run.windowStart);

try {
  await backfillMissingRunDetails(run.id);
  while (true) {
    const states = loadStates(run.id);
    if (states.length === 0) break;
    for (const state of states) await processPage(run.id, run.windowStart, state);
  }
  const now = new Date().toISOString();
  executeFile(
    `UPDATE crawl_runs SET status = 'complete', completed_at = ${sql(now)},
       updated_at = ${sql(now)}, last_error = NULL WHERE id = ${sql(run.id)};`,
    `complete-${run.id}`,
  );
  const summary = query(
    `SELECT platform, category, pages_fetched, jobs_inserted, details_fetched, status
     FROM crawl_run_states WHERE run_id = ${sql(run.id)} ORDER BY platform, category`,
  );
  console.log(JSON.stringify({ done: true, runId: run.id, windowStart: run.windowStart, summary }));
} catch (error) {
  const now = new Date().toISOString();
  executeFile(
    `UPDATE crawl_runs SET status = 'interrupted', updated_at = ${sql(now)},
       last_error = ${sql(String(error))} WHERE id = ${sql(run.id)};`,
    `interrupted-${run.id}`,
  );
  throw error;
}
