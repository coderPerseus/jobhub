import { execFileSync } from "node:child_process";

import { parseDetailResponse } from "../src/tikhub.ts";

function sql(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function query(statement) {
  const output = execFileSync(
    "pnpm",
    ["exec", "wrangler", "d1", "execute", "folk-job", "--remote", "--command", statement, "--json"],
    { encoding: "utf8", maxBuffer: 80 * 1024 * 1024 },
  );
  const payload = JSON.parse(output);
  if (!payload.every((result) => result.success)) throw new Error(output);
  return payload[0]?.results ?? [];
}

const rows = query(`SELECT j.id, j.platform, f.raw_response
  FROM jobs j JOIN job_detail_fetches f
    ON f.platform = j.platform AND f.platform_post_id = j.platform_post_id
  WHERE j.platform = 'XHS'
  ORDER BY j.published_at DESC`);

let inserted = 0;
let failed = 0;
const statements = [];
const now = new Date().toISOString();
for (const row of rows) {
  try {
    const parsed = parseDetailResponse(row.platform, JSON.parse(row.raw_response));
    statements.push(`DELETE FROM job_media WHERE job_id = ${sql(row.id)};`);
    for (const media of parsed.detail.media) {
      statements.push(`INSERT INTO job_media
        (job_id, position, media_type, source_url, width, height, raw_json, created_at)
        VALUES (${sql(row.id)}, ${media.position}, ${sql(media.mediaType)}, ${sql(media.sourceUrl)},
          ${media.width ?? "NULL"}, ${media.height ?? "NULL"}, ${sql(JSON.stringify(media.raw))}, ${sql(now)});`);
      inserted += 1;
    }
  } catch (error) {
    failed += 1;
    console.error(JSON.stringify({ jobId: row.id, error: error instanceof Error ? error.message : String(error) }));
  }
}

for (let start = 0; start < statements.length; start += 50) {
  query(statements.slice(start, start + 50).join("\n"));
}

console.log(JSON.stringify({ jobs: rows.length, inserted, failed }));
if (failed) process.exitCode = 1;
