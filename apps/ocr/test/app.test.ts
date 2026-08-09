import { describe, expect, it } from "vitest";

import worker from "../src/index";

describe("OCR worker", () => {
  it("reports its health without invoking Workers AI", async () => {
    const response = await worker.fetch(
      new Request("https://jobhub-ocr.internal/health"),
      {} as CloudflareBindings,
    );
    await expect(response.json()).resolves.toMatchObject({
      service: "jobhub-ocr",
      status: "ok",
    });
  });

  it("rejects an OCR request without images", async () => {
    const response = await worker.fetch(
      new Request("https://jobhub-ocr.internal/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: [] }),
      }),
      {} as CloudflareBindings,
    );
    expect(response.status).toBe(400);
  });
});
