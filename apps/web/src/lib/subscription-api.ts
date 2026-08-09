import { getCloudflareContext } from "@opennextjs/cloudflare";

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787").replace(/\/$/, "");

export async function forwardSubscriptionRequest(path: string, request: Request) {
  const body = await request.text();
  const init: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  };

  if (process.env.NODE_ENV === "production") {
    try {
      const { env } = getCloudflareContext();
      if (env.API) return env.API.fetch(`https://folk-job-api${path}`, init);
    } catch {
      // Standalone Next.js builds do not have Cloudflare service bindings.
    }
  }
  return fetch(`${apiUrl}${path}`, init);
}
