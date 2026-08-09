import { forwardSubscriptionRequest } from "../../../../lib/subscription-api";

export async function POST(request: Request) {
  return forwardSubscriptionRequest("/subscriptions/confirm", request);
}
