import { describe, expect, it, vi } from "vitest";

import { isQueryableAuthor, parseBingRss, searchWeb, splitOcrBatches, unwrapOutput } from "../src/job-enrichment";

describe("job enrichment", () => {
  it("only considers identifiable author names or IP accounts queryable", () => {
    expect(isQueryableAuthor("小红书用户")).toBe(false);
    expect(isQueryableAuthor("招聘信息")).toBe(false);
    expect(isQueryableAuthor("张三")).toBe(true);
    expect(isQueryableAuthor("专注喵")).toBe(true);
  });

  it("parses Bing RSS results without accepting invalid links", () => {
    const results = parseBingRss(`<?xml version="1.0"?><rss><channel>
      <item><title><![CDATA[Example &amp; Company]]></title><link>https://example.com/jobs</link><description><![CDATA[Official <b>jobs</b> page]]></description></item>
      <item><title>Unsafe</title><link>javascript:alert(1)</link><description>ignored</description></item>
    </channel></rss>`);
    expect(results).toEqual([{ title: "Example & Company", url: "https://example.com/jobs", snippet: "Official jobs page" }]);
  });

  it("uses the fixed Bing RSS endpoint for web search", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(
      "<rss><channel><item><title>Company</title><link>https://company.example</link><description>Official site</description></item></channel></rss>",
      { status: 200 },
    ));
    await expect(searchWeb("Company 招聘", fetcher)).resolves.toHaveLength(1);
    const requested = new URL(String(fetcher.mock.calls[0][0]));
    expect(requested.origin).toBe("https://www.bing.com");
    expect(requested.searchParams.get("format")).toBe("rss");
    expect(requested.searchParams.get("q")).toBe("Company 招聘");
  });

  it("accepts DeepSeek responses nested under output", () => {
    expect(unwrapOutput({ output: { content_completeness: 70 } })).toEqual({ content_completeness: 70 });
    expect(unwrapOutput({ content_completeness: 60 })).toEqual({ content_completeness: 60 });
  });

  it("splits posts with more than ten images into OCR batches", () => {
    expect(splitOcrBatches(Array.from({ length: 23 }, (_, index) => index)).map((batch) => batch.length))
      .toEqual([10, 10, 3]);
  });
});
