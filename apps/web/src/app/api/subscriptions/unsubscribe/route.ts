import { forwardSubscriptionRequest } from "../../../../lib/subscription-api";

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (token) {
    return forwardSubscriptionRequest("/subscriptions/unsubscribe", new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }));
  }
  return forwardSubscriptionRequest("/subscriptions/unsubscribe", request);
}
