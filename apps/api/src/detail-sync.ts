import {
  createDetailRequest,
  parseDetailResponse,
  type DetailTarget,
  type NormalizedJob,
} from "./tikhub";

const MAX_DETAIL_BYTES = 2_000_000;
const DETAIL_CONCURRENCY = 10;

async function readLimitedText(response: Response) {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_DETAIL_BYTES) throw new Error("TikHub detail response is too large");
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_DETAIL_BYTES) {
      await reader.cancel();
      throw new Error("TikHub detail response is too large");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function missingTargets(db: D1Database, jobs: NormalizedJob[]) {
  if (jobs.length === 0) return [];
  const checks = await db.batch(jobs.map((job) => db.prepare(
    "SELECT 1 AS found FROM job_detail_fetches WHERE platform = ? AND platform_post_id = ?",
  ).bind(job.platform, job.platformPostId)));
  return jobs.filter((_, index) => checks[index]?.results.length === 0);
}

async function fetchDetail(apiKey: string, target: DetailTarget) {
  const requestUrl = createDetailRequest(target);
  const response = await fetch(requestUrl, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const rawText = await readLimitedText(response);
  if (!response.ok) throw new Error(`TikHub detail request failed with ${response.status}`);
  const parsed = parseDetailResponse(target.platform, JSON.parse(rawText));
  return { requestUrl, rawText, parsed, target };
}

function brief(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 220 ? `${normalized.slice(0, 219)}…` : normalized;
}

export async function syncJobDetails(db: D1Database, apiKey: string, jobs: NormalizedJob[]) {
  const targets = await missingTargets(db, jobs);
  let synced = 0;
  let failed = 0;

  for (let start = 0; start < targets.length; start += DETAIL_CONCURRENCY) {
    const batch = targets.slice(start, start + DETAIL_CONCURRENCY);
    const settled = await Promise.allSettled(batch.map((target) => fetchDetail(apiKey, target)));
    const fetched = settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    failed += settled.length - fetched.length;
    const now = new Date().toISOString();

    const statements = fetched.flatMap(({ parsed, rawText, requestUrl, target }) => {
      const detail = parsed.detail;
      return [
        db.prepare(
          `INSERT INTO job_detail_fetches
            (platform, platform_post_id, endpoint, provider_request_id, fetched_at, raw_response)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (platform, platform_post_id) DO NOTHING`,
        ).bind(target.platform, target.platformPostId, requestUrl.pathname, parsed.providerRequestId, now, rawText),
        db.prepare(
          `UPDATE jobs SET
            title = COALESCE(?, title), body = COALESCE(?, body), excerpt = COALESCE(?, excerpt),
            author_name = COALESCE(?, author_name), author_handle = COALESCE(?, author_handle),
            source_url = COALESCE(?, source_url), published_at = COALESCE(?, published_at),
            likes = ?, comments = ?, reposts = ?, views = ?, image_url = COALESCE(?, image_url),
            detail_fetched_at = ?
           WHERE platform = ? AND platform_post_id = ?`,
        ).bind(
          detail.title,
          detail.body,
          detail.body ? brief(detail.body) : null,
          detail.authorName,
          detail.authorHandle,
          detail.sourceUrl,
          detail.publishedAt,
          detail.likes,
          detail.comments,
          detail.reposts,
          detail.views,
          detail.imageUrl,
          now,
          target.platform,
          target.platformPostId,
        ),
      ];
    });
    if (statements.length) await db.batch(statements);
    synced += fetched.length;
  }

  return { requested: targets.length, synced, failed };
}
