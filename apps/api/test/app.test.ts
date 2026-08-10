import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { appContract } from "@folk-job/contracts";
import { describe, expect, it, vi } from "vitest";

import { app } from "../src/index";
import { subscribe } from "../src/email-subscriptions";
import { classifyInternetJob } from "../src/job-classification";
import { parseDetailResponse } from "../src/tikhub";

function databaseReturning(job: Record<string, unknown> | null) {
  const first = vi.fn().mockResolvedValue(job);
  const bind = vi.fn(() => ({ first }));
  const prepare = vi.fn(() => ({ bind }));
  return { db: { prepare } as unknown as D1Database, bind };
}

describe("API", () => {
  it("returns its health status", async () => {
    const response = await app.request("http://localhost/health");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      service: "folk-job-api",
      status: "ok",
    });
  });

  it("serves the shared oRPC contract through Hono", async () => {
    const link = new RPCLink({
      fetch: async (request) => app.fetch(request),
      url: "http://localhost/rpc",
    });
    const client: ContractRouterClient<typeof appContract> = createORPCClient(link);

    await expect(client.greeting.hello({ name: "folk-job" })).resolves.toEqual({
      message: "你好，folk-job！",
    });
  });

  it.each([
    ["x:2086311904025411686", "X"],
    ["xhs:6a7804a500000000350174a7", "XHS"],
  ])("loads a %s composite job ID through the query endpoint", async (id, platform) => {
    const { bind, db } = databaseReturning({ id, platform, title: "招聘机会" });
    const response = await app.request(
      `http://localhost/job?id=${encodeURIComponent(id)}`,
      undefined,
      { DB: db } as CloudflareBindings,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ job: { id, platform } });
    expect(bind).toHaveBeenCalledWith(id);
  });

  it("distinguishes a missing ID from an unavailable API", async () => {
    const { db } = databaseReturning(null);
    const missingParameter = await app.request(
      "http://localhost/job",
      undefined,
      { DB: db } as CloudflareBindings,
    );
    const missingJob = await app.request(
      "http://localhost/job?id=x%3Amissing",
      undefined,
      { DB: db } as CloudflareBindings,
    );

    expect(missingParameter.status).toBe(400);
    expect(missingJob.status).toBe(404);
  });

  it("paginates and filters jobs by category", async () => {
    const countFirst = vi.fn().mockResolvedValue({ total: 230 });
    const rowsAll = vi.fn().mockResolvedValue({ results: [{ id: "x:1", category: "frontend" }] });
    const countBind = vi.fn(() => ({ first: countFirst }));
    const rowsBind = vi.fn(() => ({ all: rowsAll }));
    const prepare = vi.fn((statement: string) => statement.includes("COUNT(*)")
      ? { bind: countBind }
      : { bind: rowsBind });

    const response = await app.request(
      "http://localhost/jobs?page=2&pageSize=100&category=frontend,backend",
      undefined,
      { DB: { prepare } as unknown as D1Database } as CloudflareBindings,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      total: 230,
      page: 2,
      pageSize: 100,
      totalPages: 3,
    });
    expect(rowsBind).toHaveBeenCalledWith("frontend", "backend", 100, 100);
    expect(prepare.mock.calls.every(([statement]) => statement.includes("LEFT JOIN job_structured_details"))).toBe(true);
    expect(prepare.mock.calls.some(([statement]) => statement.includes("s.company_name"))).toBe(true);
    expect(prepare.mock.calls.some(([statement]) => statement.includes("LEFT JOIN job_ai_scores q"))).toBe(true);
    expect(prepare.mock.calls.some(([statement]) => statement.includes("ORDER BY COALESCE(q.score, -1) DESC"))).toBe(true);
  });

  it("rejects an email subscription without a selected job category", async () => {
    const response = await app.request(
      "http://localhost/subscriptions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "reader@example.com", categories: [] }),
      },
      {} as CloudflareBindings,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "请先选择想关注的方向" });
  });

  it("stores a pending subscription and sends a confirmation email", async () => {
    const run = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const first = vi.fn().mockResolvedValue(null);
    const prepare = vi.fn((statement: string) => ({
      bind: vi.fn(() => statement.includes("SELECT id, email") ? { first } : { run }),
    }));
    const send = vi.fn().mockResolvedValue({ messageId: "message-1" });

    const result = await subscribe(
      { prepare } as unknown as D1Database,
      { send } as SendEmail,
      { email: "Reader@Example.com", categories: ["frontend", "ai"] },
    );

    expect(result).toMatchObject({ ok: true, status: 202 });
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0]).toMatchObject({
      to: "reader@example.com",
      subject: "确认订阅 jobhub 新机会提醒",
    });
    expect(prepare.mock.calls.some(([statement]) => statement.includes("INSERT INTO email_subscriptions"))).toBe(true);
  });
});

describe("TikHub detail parsing", () => {
  it("reads a Xiaohongshu note from the nested detail response", () => {
    const parsed = parseDetailResponse("XHS", {
      code: 200,
      request_id: "xhs-request",
      data: {
        data: [{
          note_list: [{
            title: "招聘内容编辑",
            desc: "这里是详情接口返回的完整正文",
            time: 1_786_000_000,
            user: { nickname: "招聘方", user_id: "user-1" },
            share_info: { link: "https://www.xiaohongshu.com/explore/note-1" },
            images_list: [{ url_size_large: "https://example.com/image.jpg" }],
          }],
        }],
      },
    });

    expect(parsed.providerRequestId).toBe("xhs-request");
    expect(parsed.detail).toMatchObject({
      title: "招聘内容编辑",
      body: "这里是详情接口返回的完整正文",
      authorName: "招聘方",
      sourceUrl: "https://www.xiaohongshu.com/explore/note-1",
      imageUrl: "https://example.com/image.jpg",
      media: [{
        position: 0,
        mediaType: "image",
        sourceUrl: "https://example.com/image.jpg",
      }],
    });
  });

  it("reads a Twitter post from its detail response", () => {
    const parsed = parseDetailResponse("X", {
      code: 200,
      data: {
        id: "2086311904025411686",
        text: "We are hiring a product designer.",
        created_at: "2026-08-08T00:00:00.000Z",
        author: { name: "Folk", screen_name: "folk_jobs" },
      },
    });

    expect(parsed.detail).toMatchObject({
      body: "We are hiring a product designer.",
      authorName: "Folk",
      sourceUrl: "https://x.com/folk_jobs/status/2086311904025411686",
    });
  });
});

describe("internet job classification", () => {
  it.each([
    ["招聘前端开发工程师，负责 Web 产品", "frontend"],
    ["We are hiring a Senior AI Engineer for our LLM platform", "ai"],
    ["跨境电商招聘数字营销经理，负责增长投放", "marketing"],
    ["SaaS 平台招聘产品经理", "product"],
    ["云计算平台招聘 DevOps 工程师", "other"],
    ["跨境电商招聘 AI 视频剪辑师", "design"],
  ])("classifies %s", (text, category) => {
    expect(classifyInternetJob(text)).toBe(category);
  });

  it.each([
    "雪茄吧招聘女侍茄师",
    "酒店招聘 Marketing Manager",
    "Hotel is hiring a Marketing Manager. Apply today.",
    "AI 自学中心招聘督学老师",
    "服装厂招聘缝纫工",
  ])("rejects a non-internet job: %s", (text) => {
    expect(classifyInternetJob(text)).toBeNull();
  });
});
