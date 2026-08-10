import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { router } from "./router";
import { syncJobDetails } from "./detail-sync";
import {
  confirmSubscription,
  dispatchJobNotifications,
  subscribe,
  unsubscribe,
} from "./email-subscriptions";
import { classifyInternetJob, jobCategoryIds } from "./job-classification";
import { enrichJob } from "./job-enrichment";
import { createRequest, parseResponse, type IngestInput, type Platform } from "./tikhub";

const app = new Hono<{ Bindings: CloudflareBindings }>();
export { app };

async function enqueueJobIds(env: CloudflareBindings, jobIds: string[]) {
  const uniqueIds = [...new Set(jobIds)];
  if (uniqueIds.length === 0) return 0;
  const now = new Date().toISOString();
  await env.DB.batch(uniqueIds.map((jobId) => env.DB.prepare(
    `INSERT INTO job_enrichment_tasks
      (job_id, status, queued_at, started_at, completed_at, attempts, last_error)
     VALUES (?, 'queued', ?, NULL, NULL, 0, NULL)
     ON CONFLICT(job_id) DO UPDATE SET status='queued', queued_at=excluded.queued_at,
       started_at=NULL, completed_at=NULL, last_error=NULL`,
  ).bind(jobId, now)));
  try {
    for (let start = 0; start < uniqueIds.length; start += 100) {
      await env.ENRICHMENT_QUEUE.sendBatch(
        uniqueIds.slice(start, start + 100).map((jobId) => ({ body: { jobId } })),
      );
    }
  } catch (error) {
    await env.DB.batch(uniqueIds.map((jobId) => env.DB.prepare(
      "UPDATE job_enrichment_tasks SET status='failed', last_error=? WHERE job_id=?",
    ).bind(error instanceof Error ? error.message : String(error), jobId)));
    throw error;
  }
  return uniqueIds.length;
}

app.use(
  "/rpc/*",
  cors({
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    origin: "*",
  }),
);

app.get("/", (c) =>
  c.json({
    name: "folk-job-api",
    rpc: "/rpc",
  }),
);

app.get("/health", (c) =>
  c.json({
    service: "folk-job-api",
    status: "ok",
    timestamp: new Date().toISOString(),
  }),
);

app.get("/jobs", async (c) => {
  const requestedPage = Number(c.req.query("page") ?? 1);
  const requestedPageSize = Number(c.req.query("pageSize") ?? c.req.query("limit") ?? 100);
  const page = Math.max(Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1, 1);
  const pageSize = Math.min(Math.max(Number.isFinite(requestedPageSize) ? Math.floor(requestedPageSize) : 100, 1), 100);
  const platforms = (c.req.query("platform") ?? "").split(",").filter((value) => value === "XHS" || value === "X");
  const requestedCategories = (c.req.query("category") ?? "").split(",");
  const categories = requestedCategories.filter((value) => jobCategoryIds.includes(value as typeof jobCategoryIds[number]));
  const cutoff = c.req.query("since");
  const search = c.req.query("q")?.trim();
  const sort = c.req.query("sort") === "popular" ? "popular" : "latest";
  const conditions: string[] = ["j.category IS NOT NULL"];
  const bindings: (string | number)[] = [];

  if (platforms.length) {
    conditions.push(`j.platform IN (${platforms.map(() => "?").join(", ")})`);
    bindings.push(...platforms);
  }
  if (categories.length) {
    conditions.push(`j.category IN (${categories.map(() => "?").join(", ")})`);
    bindings.push(...categories);
  }
  if (cutoff) {
    conditions.push("j.published_at >= ?");
    bindings.push(cutoff);
  }
  if (search) {
    conditions.push("(j.title LIKE ? OR j.body LIKE ? OR j.author_name LIKE ? OR s.company_name LIKE ? OR s.position_title LIKE ? OR s.work_location LIKE ?)");
    const pattern = `%${search}%`;
    bindings.push(pattern, pattern, pattern, pattern, pattern, pattern);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const count = await c.env.DB.prepare(
    `SELECT COUNT(*) AS total FROM jobs j LEFT JOIN job_structured_details s ON s.job_id = j.id ${where}`,
  ).bind(...bindings).first<{ total: number }>();
  const total = Number(count?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const orderBy = sort === "popular"
    ? "COALESCE(q.score, -1) DESC, j.likes + j.comments + j.reposts DESC, j.published_at DESC"
    : "COALESCE(q.score, -1) DESC, j.published_at DESC";
  const result = await c.env.DB.prepare(
    `SELECT j.id, j.platform, j.platform_post_id, j.title, j.body, j.excerpt, j.author_name,
      j.author_handle, j.source_url, j.published_at, j.first_seen_at, j.last_seen_at,
      j.likes, j.comments, j.reposts, j.views, j.image_url, j.category,
      s.company_name, s.company_nature, s.recruitment_target, s.position_title,
      s.positions_json, s.work_location, s.work_mode, s.employment_type, s.salary,
      s.experience_requirement, s.education_requirement, s.skills_json, s.benefits_json,
      s.application_url, s.contact, s.application_deadline, s.summary AS structured_summary,
      s.language, s.confidence, s.structured_at,
      o.status AS ocr_status, o.image_count AS ocr_image_count,
      r.content_completeness, r.credibility_signal, r.factual_verification_status,
      r.should_publish, r.risk_flags_json, r.reason AS review_reason, r.reviewed_at
     FROM jobs j
     LEFT JOIN job_structured_details s ON s.job_id = j.id
     LEFT JOIN job_ocr_results o ON o.job_id = j.id
     LEFT JOIN job_ai_reviews r ON r.job_id = j.id
     LEFT JOIN job_ai_scores q ON q.job_id = j.id ${where}
     ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
  ).bind(...bindings, pageSize, (currentPage - 1) * pageSize).all();

  return c.json({
    jobs: result.results,
    count: result.results.length,
    total,
    page: currentPage,
    pageSize,
    totalPages,
  });
});

async function findJob(db: D1Database, id: string) {
  return db.prepare(
    `SELECT j.id, j.platform, j.platform_post_id, j.title, j.body, j.excerpt, j.author_name,
      j.author_handle, j.source_url, j.published_at, j.first_seen_at, j.last_seen_at,
      j.likes, j.comments, j.reposts, j.views, j.image_url, j.category,
      s.company_name, s.company_nature, s.recruitment_target, s.position_title,
      s.positions_json, s.work_location, s.work_mode, s.employment_type, s.salary,
      s.experience_requirement, s.education_requirement, s.skills_json, s.benefits_json,
      s.application_url, s.contact, s.application_deadline, s.summary AS structured_summary,
      s.language, s.confidence, s.structured_at,
      o.status AS ocr_status, o.image_count AS ocr_image_count, o.combined_text AS ocr_text,
      r.content_completeness, r.credibility_signal, r.factual_verification_status,
      r.should_publish, r.risk_flags_json, r.missing_fields_json,
      r.reason AS review_reason, r.search_evidence_json, r.reviewed_at
     FROM jobs j
     LEFT JOIN job_structured_details s ON s.job_id = j.id
     LEFT JOIN job_ocr_results o ON o.job_id = j.id
     LEFT JOIN job_ai_reviews r ON r.job_id = j.id
     WHERE j.id = ?`,
  ).bind(id).first();
}

app.get("/job", async (c) => {
  const id = c.req.query("id");
  if (!id) return c.json({ error: "id is required" }, 400);

  const job = await findJob(c.env.DB, id);
  return job ? c.json({ job }) : c.json({ error: "Job not found" }, 404);
});

app.get("/jobs/:id", async (c) => {
  const job = await findJob(c.env.DB, c.req.param("id"));

  return job ? c.json({ job }) : c.json({ error: "Job not found" }, 404);
});

app.get("/stats", async (c) => {
  const counts = await c.env.DB.prepare(
    "SELECT platform, COUNT(*) AS count FROM jobs GROUP BY platform ORDER BY platform",
  ).all();
  const batches = await c.env.DB.prepare(
    "SELECT COUNT(*) AS count, MAX(fetched_at) AS last_fetched_at FROM crawl_batches",
  ).first();
  return c.json({ jobs: counts.results, batches });
});

app.post("/subscriptions", async (c) => {
  let input: { email?: unknown; categories?: unknown };
  try {
    input = await c.req.json();
  } catch {
    return c.json({ error: "提交有点问题，请重试" }, 400);
  }

  try {
    const result = await subscribe(c.env.DB, c.env.EMAIL, input);
    if (!result.ok) return c.json({ error: result.error }, result.status as 400);
    return c.json({ message: result.message }, 202);
  } catch (error) {
    console.error(JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      message: "Failed to create email subscription",
    }));
    return c.json({ error: "邮件暂时发不出去，请稍后再试" }, 503);
  }
});

app.post("/subscriptions/confirm", async (c) => {
  let input: { token?: unknown };
  try {
    input = await c.req.json();
  } catch {
    return c.json({ error: "提交有点问题，请重试" }, 400);
  }
  const confirmed = await confirmSubscription(c.env.DB, input.token);
  return confirmed
    ? c.json({ message: "订阅成功，有新机会会通知你" })
    : c.json({ error: "这个链接无效或已经用过了" }, 400);
});

app.post("/subscriptions/unsubscribe", async (c) => {
  let input: { token?: unknown };
  try {
    input = await c.req.json();
  } catch {
    input = { token: c.req.query("token") };
  }
  const removed = await unsubscribe(c.env.DB, input.token ?? c.req.query("token"));
  return removed
    ? c.json({ message: "已退订，不会再收到邮件" })
    : c.json({ error: "这个链接无效或已经失效了" }, 400);
});

app.post("/admin/notifications/dispatch", async (c) => {
  const authorization = c.req.header("Authorization");
  if (!c.env.INGEST_TOKEN || authorization !== `Bearer ${c.env.INGEST_TOKEN}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const result = await dispatchJobNotifications(c.env.DB, c.env.EMAIL);
  return c.json(result);
});

app.post("/admin/enrichment/enqueue", async (c) => {
  const authorization = c.req.header("Authorization");
  if (!c.env.INGEST_TOKEN || authorization !== `Bearer ${c.env.INGEST_TOKEN}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  let input: { limit?: unknown; force?: unknown; jobId?: unknown } = {};
  try {
    input = await c.req.json();
  } catch {
    // An empty body uses the safe defaults below.
  }
  const limit = Math.min(Math.max(Number(input.limit ?? 100), 1), 500);
  const force = input.force === true;
  const jobId = typeof input.jobId === "string" && input.jobId.trim() ? input.jobId.trim() : null;
  const result = jobId
    ? await c.env.DB.prepare("SELECT id FROM jobs WHERE id = ?").bind(jobId).all<{ id: string }>()
    : await c.env.DB.prepare(
      `SELECT j.id FROM jobs j
       LEFT JOIN job_ai_reviews r ON r.job_id = j.id
       LEFT JOIN job_enrichment_tasks t ON t.job_id = j.id
       WHERE (? = 1 OR (r.job_id IS NULL AND t.job_id IS NULL))
       ORDER BY j.published_at DESC LIMIT ?`,
    ).bind(force ? 1 : 0, limit).all<{ id: string }>();
  const queued = await enqueueJobIds(c.env, result.results.map((job) => job.id));
  return c.json({ queued, force });
});

app.post("/admin/ingest/tikhub", async (c) => {
  const authorization = c.req.header("Authorization");
  if (!c.env.INGEST_TOKEN || authorization !== `Bearer ${c.env.INGEST_TOKEN}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const input = await c.req.json<IngestInput>();
  if ((input.platform !== "XHS" && input.platform !== "X") || !input.query?.trim()) {
    return c.json({ error: "platform and query are required" }, 400);
  }

  const requestUrl = createRequest({ ...input, query: input.query.trim() });
  const upstream = await fetch(requestUrl, {
    headers: { Authorization: `Bearer ${c.env.TIKHUB_API_KEY}` },
  });
  const rawText = await upstream.text();
  let payload: unknown;
  try {
    payload = JSON.parse(rawText);
  } catch {
    return c.json({ error: "TikHub returned invalid JSON", status: upstream.status }, 502);
  }
  if (!upstream.ok) {
    return c.json({ error: "TikHub request failed", status: upstream.status, payload }, 502);
  }

  const parsed = parseResponse(input.platform, payload);
  const now = new Date().toISOString();
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recruitmentPattern = input.platform === "XHS"
    ? /(招聘|招人|急聘|诚聘|招募|岗位|内推|加入我们|招聘启事|招聘信息)/i
    : /(we(?:'|’)re hiring|we are hiring|hiring for|job opening|open role|open position|vacanc(?:y|ies)|join our team|now hiring|apply for|recruiting)/i;
  const acceptedJobs = parsed.jobs.flatMap((job) => {
    const text = `${job.title}\n${job.body}`;
    const category = classifyInternetJob(text);
    return new Date(job.publishedAt).valueOf() >= cutoff
      && recruitmentPattern.test(text)
      && category
      ? [{ ...job, category }]
      : [];
  });
  const pageCursor = input.platform === "XHS"
    ? String(input.page ?? 1)
    : input.cursor ?? null;
  const batch = await c.env.DB.prepare(
    `INSERT INTO crawl_batches
      (platform, query, request_url, provider_request_id, page_cursor, fetched_at, item_count, raw_response)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  ).bind(
    input.platform,
    input.query.trim(),
    requestUrl.toString(),
    parsed.providerRequestId,
    pageCursor,
    now,
    parsed.jobs.length,
    rawText,
  ).first<{ id: number }>();

  if (!batch) return c.json({ error: "Failed to store crawl batch" }, 500);

  const statements = acceptedJobs.map((job) => c.env.DB.prepare(
    `INSERT INTO jobs
      (id, platform, platform_post_id, title, body, excerpt, author_name, author_handle,
       source_url, published_at, first_seen_at, last_seen_at, likes, comments, reposts,
       views, image_url, raw_batch_id, content_type, category)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (platform, platform_post_id) DO UPDATE SET
       title = CASE WHEN jobs.detail_fetched_at IS NULL THEN excluded.title ELSE jobs.title END,
       body = CASE WHEN jobs.detail_fetched_at IS NULL THEN excluded.body ELSE jobs.body END,
       excerpt = CASE WHEN jobs.detail_fetched_at IS NULL THEN excluded.excerpt ELSE jobs.excerpt END,
       author_name = CASE WHEN jobs.detail_fetched_at IS NULL THEN excluded.author_name ELSE jobs.author_name END,
       author_handle = CASE WHEN jobs.detail_fetched_at IS NULL THEN excluded.author_handle ELSE jobs.author_handle END,
       source_url = CASE WHEN jobs.detail_fetched_at IS NULL THEN excluded.source_url ELSE jobs.source_url END,
       published_at = excluded.published_at,
       last_seen_at = excluded.last_seen_at,
       likes = excluded.likes,
       comments = excluded.comments,
       reposts = excluded.reposts,
       views = excluded.views,
       image_url = CASE WHEN jobs.detail_fetched_at IS NULL THEN excluded.image_url ELSE jobs.image_url END,
       raw_batch_id = excluded.raw_batch_id,
       content_type = excluded.content_type,
       category = COALESCE(jobs.category, excluded.category)`,
  ).bind(
    job.id,
    job.platform,
    job.platformPostId,
    job.title,
    job.body,
    job.excerpt,
    job.authorName,
    job.authorHandle,
    job.sourceUrl,
    job.publishedAt,
    now,
    now,
    job.likes,
    job.comments,
    job.reposts,
    job.views,
    job.imageUrl,
    batch.id,
    job.contentType,
    job.category,
  ));

  if (statements.length) await c.env.DB.batch(statements);
  const details = await syncJobDetails(c.env.DB, c.env.TIKHUB_API_KEY, acceptedJobs);
  const newJobs = acceptedJobs.filter((job) => job.id).map((job) => job.id);
  if (newJobs.length) {
    const placeholders = newJobs.map(() => "?").join(", ");
    const pending = await c.env.DB.prepare(
      `SELECT j.id FROM jobs j
       LEFT JOIN job_ai_reviews r ON r.job_id = j.id
       LEFT JOIN job_enrichment_tasks t ON t.job_id = j.id
       WHERE j.id IN (${placeholders}) AND r.job_id IS NULL AND t.job_id IS NULL`,
    ).bind(...newJobs).all<{ id: string }>();
    if (pending.results.length) {
      await enqueueJobIds(c.env, pending.results.map((job) => job.id));
    }
  }
  const total = await c.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM jobs WHERE platform = ?",
  ).bind(input.platform as Platform).first<{ count: number }>();

  c.executionCtx.waitUntil(
    dispatchJobNotifications(c.env.DB, c.env.EMAIL).then((notificationResult) => {
      console.log(JSON.stringify({ message: "Job notifications dispatched", ...notificationResult }));
    }).catch((error) => {
      console.error(JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        message: "Job notification dispatch failed",
      }));
    }),
  );

  return c.json({
    batchId: batch.id,
    platform: input.platform,
    received: parsed.jobs.length,
    accepted: acceptedJobs.length,
    details,
    total: total?.count ?? 0,
    next: parsed.next,
    providerRequestId: parsed.providerRequestId,
  });
});

const rpcHandler = new RPCHandler(router, {
  interceptors: [
    onError((error) => {
      console.error(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
          message: "oRPC request failed",
        }),
      );
    }),
  ],
});

app.use("/rpc/*", async (c, next) => {
  const { matched, response } = await rpcHandler.handle(c.req.raw, {
    context: {},
    prefix: "/rpc",
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  await next();
});

app.notFound((c) => c.json({ error: "Not found" }, 404));

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<{ jobId: string }>, env: CloudflareBindings) {
    await Promise.all(batch.messages.map(async (message) => {
      try {
        const startedAt = new Date().toISOString();
        await env.DB.prepare(
          `INSERT INTO job_enrichment_tasks
            (job_id, status, queued_at, started_at, completed_at, attempts, last_error)
           VALUES (?, 'processing', ?, ?, NULL, 1, NULL)
           ON CONFLICT(job_id) DO UPDATE SET status='processing', started_at=excluded.started_at,
             completed_at=NULL, attempts=job_enrichment_tasks.attempts+1, last_error=NULL`,
        ).bind(message.body.jobId, startedAt, startedAt).run();
        const result = await enrichJob(env, message.body.jobId);
        await env.DB.prepare(
          "UPDATE job_enrichment_tasks SET status='completed', completed_at=?, last_error=NULL WHERE job_id=?",
        ).bind(new Date().toISOString(), message.body.jobId).run();
        console.log(JSON.stringify({ message: "Job enrichment completed", ...result }));
        message.ack();
      } catch (error) {
        await env.DB.prepare(
          "UPDATE job_enrichment_tasks SET status='failed', last_error=? WHERE job_id=?",
        ).bind(error instanceof Error ? error.message : String(error), message.body.jobId).run();
        console.error(JSON.stringify({
          message: "Job enrichment failed",
          jobId: message.body.jobId,
          error: error instanceof Error ? error.message : String(error),
        }));
        message.retry();
      }
    }));
  },
};
