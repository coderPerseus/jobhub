import { execFileSync } from "node:child_process";
import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDetailRequest, parseDetailResponse } from "../src/tikhub.ts";

const token = process.env.TIKHUB_API_KEY;
if (!token) throw new Error("TIKHUB_API_KEY is required");

function sql(value) {
  if (value == null) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "0";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function wrangler(args) {
  return execFileSync("pnpm", ["exec", "wrangler", ...args], {
    encoding: "utf8",
    maxBuffer: 40 * 1024 * 1024,
  });
}

function query(statement) {
  return JSON.parse(wrangler(["d1", "execute", "folk-job", "--remote", "--command", statement, "--json"]))[0].results;
}

function executeFile(statement, index) {
  const path = join(tmpdir(), `folk-job-detail-${process.pid}-${index}.sql`);
  writeFileSync(path, statement);
  try {
    wrangler(["d1", "execute", "folk-job", "--remote", "--file", path, "--json"]);
  } finally {
    unlinkSync(path);
  }
}

async function fetchDetail(target) {
  const requestUrl = createDetailRequest(target);
  const response = await fetch(requestUrl, { headers: { Authorization: `Bearer ${token}` } });
  const rawText = await response.text();
  if (!response.ok) throw new Error(`${target.platform}:${target.platformPostId} returned ${response.status}`);
  return { target, requestUrl, rawText, parsed: parseDetailResponse(target.platform, JSON.parse(rawText)) };
}

function brief(value) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 220 ? `${normalized.slice(0, 219)}…` : normalized;
}

const targets = query(
  `SELECT platform, platform_post_id, content_type
   FROM jobs WHERE detail_fetched_at IS NULL
   ORDER BY platform, published_at DESC`,
).map((row) => ({
  platform: row.platform,
  platformPostId: row.platform_post_id,
  contentType: row.content_type,
}));

let succeeded = 0;
const failures = [];
for (let start = 0; start < targets.length; start += 10) {
  const settled = await Promise.allSettled(targets.slice(start, start + 10).map(fetchDetail));
  const fetched = settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  failures.push(...settled.flatMap((result) => result.status === "rejected" ? [String(result.reason)] : []));
  const now = new Date().toISOString();
  const statements = fetched.flatMap(({ target, requestUrl, rawText, parsed }) => {
    const detail = parsed.detail;
    return [
      `INSERT INTO job_detail_fetches
        (platform, platform_post_id, endpoint, provider_request_id, fetched_at, raw_response)
       VALUES (${[target.platform, target.platformPostId, requestUrl.pathname, parsed.providerRequestId, now, rawText].map(sql).join(", ")})
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
        detail_fetched_at = ${sql(now)}
       WHERE platform = ${sql(target.platform)} AND platform_post_id = ${sql(target.platformPostId)};`,
    ];
  });
  if (statements.length) executeFile(statements.join("\n"), start);
  succeeded += fetched.length;
  console.log(JSON.stringify({ processed: Math.min(start + 10, targets.length), total: targets.length, succeeded, failed: failures.length }));
}

console.log(JSON.stringify({ done: true, succeeded, failed: failures.length, failures }));
