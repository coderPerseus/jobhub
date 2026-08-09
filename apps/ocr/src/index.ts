const MODEL = "@cf/google/gemma-4-26b-a4b-it";
const MAX_IMAGES = 10;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

type OcrInput = { images?: unknown };

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function imageDataUrl(sourceUrl: string) {
  const url = new URL(sourceUrl);
  if (url.protocol !== "https:") throw new Error("Only HTTPS images are supported");
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`Image fetch failed with ${response.status}`);
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_IMAGE_BYTES) throw new Error("Image is too large");
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_IMAGE_BYTES) throw new Error("Image is too large");
  const contentType = response.headers.get("content-type")?.split(";")[0] ?? "image/webp";
  if (!contentType.startsWith("image/")) throw new Error("Source is not an image");

  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
  }
  return `data:${contentType};base64,${btoa(binary)}`;
}

async function recognize(ai: Ai, sourceUrl: string) {
  const image = await imageDataUrl(sourceUrl);
  const runner = ai as unknown as {
    run(model: string, input: Record<string, unknown>): Promise<{
      choices?: Array<{ message?: { content?: string } }>;
    }>;
  };
  const result = await runner.run(MODEL, {
    messages: [{
      role: "user",
      content: [
        {
          type: "text",
          text: "请逐字识别图片中的所有中文和英文文字，保留阅读顺序和换行。只输出识别文字，不翻译、不总结、不解释，不重复输出。",
        },
        { type: "image_url", image_url: { url: image, detail: "high" } },
      ],
    }],
    stream: false,
    temperature: 0,
    max_completion_tokens: 4_096,
    chat_template_kwargs: { thinking: false },
  });
  const text = result.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OCR model returned no text");
  return { text, raw: result };
}

async function recognizeWithRetry(ai: Ai, sourceUrl: string) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await recognize(ai, sourceUrl);
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw lastError;
}

export default {
  async fetch(request: Request, env: CloudflareBindings): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ service: "jobhub-ocr", status: "ok", model: MODEL });
    }
    if (request.method !== "POST" || url.pathname !== "/ocr") return jsonError("Not found", 404);

    let input: OcrInput;
    try {
      input = await request.json();
    } catch {
      return jsonError("Invalid JSON", 400);
    }
    const images = Array.isArray(input.images)
      ? input.images.filter((value): value is string => typeof value === "string" && value.length > 0)
      : [];
    if (images.length === 0) return jsonError("images is required", 400);
    if (images.length > MAX_IMAGES) return jsonError(`At most ${MAX_IMAGES} images are allowed`, 400);

    const results = await Promise.all(images.map(async (sourceUrl, position) => {
      try {
        const recognized = await recognizeWithRetry(env.AI, sourceUrl);
        return { position, sourceUrl, ok: true as const, text: recognized.text, raw: recognized.raw };
      } catch (error) {
        return {
          position,
          sourceUrl,
          ok: false as const,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }));

    return Response.json({ model: MODEL, results });
  },
};
