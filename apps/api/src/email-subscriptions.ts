import { jobCategoryIds, type JobCategory } from "./job-classification";

const APP_URL = "https://jobhub.islumi.com";
const SENDER_EMAIL = "jobhub@islumi.com";
const CONFIRMATION_COOLDOWN_MS = 10 * 60 * 1_000;
const MAX_JOBS_PER_DELIVERY = 250;

const categoryLabels: Record<JobCategory, string> = {
  ai: "AI / 算法",
  fullstack: "全栈",
  frontend: "前端",
  backend: "后端",
  mobile: "移动端",
  product: "产品",
  design: "UI / UX 设计",
  data: "数据",
  operations: "互联网运营",
  marketing: "数字营销",
  other: "其他技术",
};

type SubscriptionRow = {
  id: string;
  email: string;
  categories_json: string;
  pending_categories_json: string | null;
  status: "pending" | "active" | "unsubscribed";
  unsubscribe_token: string;
  last_confirmation_sent_at: string | null;
};

type NotificationJob = {
  id: string;
  category: JobCategory;
  title: string;
  company_name: string | null;
  position_title: string | null;
  work_location: string | null;
  salary: string | null;
  employment_type: string | null;
  structured_summary: string | null;
  excerpt: string;
};

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function normalizeCategories(value: unknown): JobCategory[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(jobCategoryIds);
  return [...new Set(value.filter((item): item is JobCategory => typeof item === "string" && allowed.has(item)))].sort();
}

function token() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function hashToken(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseCategories(value: string) {
  try {
    return normalizeCategories(JSON.parse(value));
  } catch {
    return [];
  }
}

function confirmationEmail(email: string, categories: JobCategory[], confirmToken: string) {
  const confirmUrl = `${APP_URL}/subscription/confirm?token=${encodeURIComponent(confirmToken)}`;
  const labels = categories.map((category) => categoryLabels[category]).join("、");
  return {
    from: { name: "jobhub", email: SENDER_EMAIL },
    to: email,
    subject: "确认你的 jobhub 岗位订阅",
    text: `你订阅的岗位：${labels}\n\n请打开下面的链接并确认订阅：\n${confirmUrl}\n\n如果这不是你的操作，可以忽略这封邮件。`,
    html: `<!doctype html><html><body style="margin:0;background:#f4f1e8;color:#20251f;font-family:Arial,'PingFang SC',sans-serif"><div style="max-width:600px;margin:0 auto;padding:40px 20px"><div style="background:#fffef9;border:1px solid #c9cec7;padding:32px"><p style="margin:0 0 10px;color:#21a65a;font-weight:700">jobhub 岗位提醒</p><h1 style="margin:0 0 18px;font-size:28px">确认你的邮箱订阅</h1><p style="line-height:1.8;color:#555">你关注的岗位：${escapeHtml(labels)}</p><a href="${confirmUrl}" style="display:inline-block;margin:18px 0;padding:13px 20px;background:#b8ea45;color:#20251f;text-decoration:none;font-weight:700">确认订阅</a><p style="margin-top:24px;color:#888;font-size:13px;line-height:1.7">确认后，只在你关注的岗位出现新机会时发送邮件。如果这不是你的操作，可以忽略这封邮件。</p></div></div></body></html>`,
  } satisfies EmailMessageBuilder;
}

export async function subscribe(
  db: D1Database,
  emailBinding: SendEmail,
  input: { email?: unknown; categories?: unknown },
) {
  const email = normalizeEmail(input.email);
  const categories = normalizeCategories(input.categories);
  if (!email) return { ok: false as const, status: 400, error: "请输入有效邮箱地址" };
  if (categories.length === 0) return { ok: false as const, status: 400, error: "请至少选择一个岗位" };

  const existing = await db.prepare(
    `SELECT id, email, categories_json, pending_categories_json, status,
      unsubscribe_token, last_confirmation_sent_at
     FROM email_subscriptions WHERE email = ? COLLATE NOCASE`,
  ).bind(email).first<SubscriptionRow>();
  const lastSent = existing?.last_confirmation_sent_at
    ? new Date(existing.last_confirmation_sent_at).valueOf()
    : 0;
  if (lastSent > Date.now() - CONFIRMATION_COOLDOWN_MS) {
    return { ok: true as const, status: 202, message: "确认邮件已发送，请前往邮箱完成订阅" };
  }

  const now = new Date().toISOString();
  const id = existing?.id ?? crypto.randomUUID();
  const unsubscribeToken = existing?.unsubscribe_token ?? token();
  const rawConfirmToken = token();
  const confirmTokenHash = await hashToken(rawConfirmToken);
  const categoriesJson = JSON.stringify(categories);

  await db.prepare(
    `INSERT INTO email_subscriptions
      (id, email, categories_json, pending_categories_json, status, confirm_token_hash,
       unsubscribe_token, created_at, updated_at)
     VALUES (?, ?, '[]', ?, 'pending', ?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       pending_categories_json = excluded.pending_categories_json,
       confirm_token_hash = excluded.confirm_token_hash,
       updated_at = excluded.updated_at,
       status = CASE WHEN email_subscriptions.status = 'active' THEN 'active' ELSE 'pending' END,
       unsubscribed_at = CASE WHEN email_subscriptions.status = 'active' THEN email_subscriptions.unsubscribed_at ELSE NULL END`,
  ).bind(id, email, categoriesJson, confirmTokenHash, unsubscribeToken, now, now).run();

  await emailBinding.send(confirmationEmail(email, categories, rawConfirmToken));
  await db.prepare(
    "UPDATE email_subscriptions SET last_confirmation_sent_at = ?, updated_at = ? WHERE id = ?",
  ).bind(now, now, id).run();

  return { ok: true as const, status: 202, message: "确认邮件已发送，请前往邮箱完成订阅" };
}

export async function confirmSubscription(db: D1Database, rawToken: unknown) {
  if (typeof rawToken !== "string" || rawToken.length < 20) return false;
  const tokenHash = await hashToken(rawToken);
  const now = new Date().toISOString();
  const result = await db.prepare(
    `UPDATE email_subscriptions SET
       categories_json = pending_categories_json,
       pending_categories_json = NULL,
       status = 'active', confirm_token_hash = NULL,
       confirmed_at = ?, unsubscribed_at = NULL, updated_at = ?
     WHERE confirm_token_hash = ? AND pending_categories_json IS NOT NULL`,
  ).bind(now, now, tokenHash).run();
  return Number(result.meta.changes ?? 0) > 0;
}

export async function unsubscribe(db: D1Database, rawToken: unknown) {
  if (typeof rawToken !== "string" || rawToken.length < 20) return false;
  const now = new Date().toISOString();
  const result = await db.prepare(
    `UPDATE email_subscriptions SET status = 'unsubscribed', unsubscribed_at = ?,
       pending_categories_json = NULL, confirm_token_hash = NULL, updated_at = ?
     WHERE unsubscribe_token = ?`,
  ).bind(now, now, rawToken).run();
  return Number(result.meta.changes ?? 0) > 0;
}

function notificationEmail(subscription: SubscriptionRow, jobs: NotificationJob[]) {
  const unsubscribeUrl = `${APP_URL}/subscription/unsubscribe?token=${encodeURIComponent(subscription.unsubscribe_token)}`;
  const oneClickUnsubscribeUrl = `${APP_URL}/api/subscriptions/unsubscribe?token=${encodeURIComponent(subscription.unsubscribe_token)}`;
  const categories = parseCategories(subscription.categories_json);
  const labels = categories.map((category) => categoryLabels[category]).join("、");
  const rows = jobs.slice(0, 5).map((job) => {
    const title = job.position_title || job.title;
    const company = job.company_name || "公司待确认";
    const facts = [job.work_location, job.salary, job.employment_type].filter(Boolean).join(" · ");
    const summary = job.structured_summary || job.excerpt;
    const url = `${APP_URL}/jobs/${encodeURIComponent(job.id)}`;
    return `<div style="padding:20px 0;border-top:1px solid #dfe3dc"><p style="margin:0 0 6px;color:#687068;font-size:13px">${escapeHtml(company)} · ${escapeHtml(categoryLabels[job.category])}</p><h2 style="margin:0 0 8px;font-size:19px"><a href="${url}" style="color:#20251f;text-decoration:none">${escapeHtml(title)}</a></h2>${facts ? `<p style="margin:0 0 8px;color:#39724f;font-size:13px;font-weight:700">${escapeHtml(facts)}</p>` : ""}<p style="margin:0;color:#5c625c;font-size:14px;line-height:1.7">${escapeHtml(summary)}</p></div>`;
  }).join("");
  const plainRows = jobs.slice(0, 5).map((job, index) => {
    const title = job.position_title || job.title;
    const facts = [job.company_name, job.work_location, job.salary].filter(Boolean).join(" · ");
    return `${index + 1}. ${title}${facts ? `\n   ${facts}` : ""}\n   ${APP_URL}/jobs/${encodeURIComponent(job.id)}`;
  }).join("\n\n");

  return {
    from: { name: "jobhub", email: SENDER_EMAIL },
    to: subscription.email,
    subject: `你关注的岗位新增 ${jobs.length} 条机会｜jobhub`,
    headers: {
      "List-Unsubscribe": `<${oneClickUnsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    text: `你关注的岗位（${labels}）新增 ${jobs.length} 条机会。\n\n${plainRows}\n\n管理或退订：${unsubscribeUrl}`,
    html: `<!doctype html><html><body style="margin:0;background:#f4f1e8;color:#20251f;font-family:Arial,'PingFang SC',sans-serif"><div style="max-width:640px;margin:0 auto;padding:36px 20px"><div style="background:#fffef9;border:1px solid #c9cec7;padding:30px"><p style="margin:0 0 10px;color:#21a65a;font-weight:700">jobhub 岗位提醒</p><h1 style="margin:0 0 12px;font-size:28px">你关注的岗位新增 ${jobs.length} 条机会</h1><p style="margin:0 0 22px;color:#687068;font-size:14px">关注岗位：${escapeHtml(labels)} · 以下展示最近 ${Math.min(jobs.length, 5)} 条</p>${rows}<a href="${APP_URL}/jobs" style="display:inline-block;margin-top:22px;padding:12px 18px;background:#b8ea45;color:#20251f;text-decoration:none;font-weight:700">查看全部机会</a><p style="margin:28px 0 0;color:#8a8f89;font-size:12px;line-height:1.7">你收到这封邮件，是因为你在 jobhub 订阅了岗位提醒。<a href="${unsubscribeUrl}" style="color:#687068">退订邮件</a></p></div></div></body></html>`,
  } satisfies EmailMessageBuilder;
}

export async function dispatchJobNotifications(db: D1Database, emailBinding: SendEmail) {
  const subscriptions = await db.prepare(
    `SELECT id, email, categories_json, pending_categories_json, status,
      unsubscribe_token, last_confirmation_sent_at
     FROM email_subscriptions WHERE status = 'active' AND confirmed_at IS NOT NULL`,
  ).all<SubscriptionRow>();
  let sent = 0;
  let failed = 0;
  let jobsSent = 0;

  for (const subscription of subscriptions.results) {
    const categories = parseCategories(subscription.categories_json);
    if (categories.length === 0) continue;
    const placeholders = categories.map(() => "?").join(", ");
    const result = await db.prepare(
      `SELECT j.id, j.category, j.title, j.excerpt,
        s.company_name, s.position_title, s.work_location, s.salary,
        s.employment_type, s.summary AS structured_summary
       FROM jobs j
       LEFT JOIN job_structured_details s ON s.job_id = j.id
       WHERE j.category IN (${placeholders})
         AND j.first_seen_at >= (SELECT confirmed_at FROM email_subscriptions WHERE id = ?)
         AND NOT EXISTS (
           SELECT 1 FROM email_notification_jobs n
           WHERE n.subscription_id = ? AND n.job_id = j.id
         )
       ORDER BY j.published_at DESC
       LIMIT ?`,
    ).bind(...categories, subscription.id, subscription.id, MAX_JOBS_PER_DELIVERY).all<NotificationJob>();
    const jobs = result.results;
    if (jobs.length === 0) continue;

    try {
      const mailResult = await emailBinding.send(notificationEmail(subscription, jobs));
      const deliveryId = crypto.randomUUID();
      const now = new Date().toISOString();
      await db.batch([
        db.prepare(
          `INSERT INTO email_notification_deliveries
            (id, subscription_id, message_id, job_count, sent_at) VALUES (?, ?, ?, ?, ?)`,
        ).bind(deliveryId, subscription.id, mailResult.messageId, jobs.length, now),
        ...jobs.map((job) => db.prepare(
          `INSERT OR IGNORE INTO email_notification_jobs
            (subscription_id, job_id, delivery_id, sent_at) VALUES (?, ?, ?, ?)`,
        ).bind(subscription.id, job.id, deliveryId, now)),
      ]);
      sent += 1;
      jobsSent += jobs.length;
    } catch (error) {
      failed += 1;
      console.error(JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        message: "Failed to send job notification",
        subscriptionId: subscription.id,
      }));
    }
  }

  return { subscribers: subscriptions.results.length, sent, failed, jobsSent };
}
