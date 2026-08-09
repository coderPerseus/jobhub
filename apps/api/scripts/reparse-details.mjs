import { execFileSync } from "node:child_process";
import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseDetailResponse } from "../src/tikhub.ts";

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
  const path = join(tmpdir(), `folk-job-reparse-${process.pid}-${index}.sql`);
  writeFileSync(path, statement);
  try {
    wrangler(["d1", "execute", "folk-job", "--remote", "--file", path, "--json"]);
  } finally {
    unlinkSync(path);
  }
}

function brief(value) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 220 ? `${normalized.slice(0, 219)}…` : normalized;
}

const rows = query(
  "SELECT platform, platform_post_id, fetched_at, raw_response FROM job_detail_fetches ORDER BY id",
);

for (let start = 0; start < rows.length; start += 25) {
  const statements = rows.slice(start, start + 25).map((row) => {
    const detail = parseDetailResponse(row.platform, JSON.parse(row.raw_response)).detail;
    return `UPDATE jobs SET
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
      detail_fetched_at = ${sql(row.fetched_at)}
     WHERE platform = ${sql(row.platform)} AND platform_post_id = ${sql(row.platform_post_id)};`;
  });
  executeFile(statements.join("\n"), start);
  console.log(JSON.stringify({ processed: Math.min(start + 25, rows.length), total: rows.length }));
}

console.log(JSON.stringify({ done: true, reparsed: rows.length }));
