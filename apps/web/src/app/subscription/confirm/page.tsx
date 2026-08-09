import type { Metadata } from "next";

import { SiteHeader } from "../../../components/site-header";
import { SubscriptionAction } from "../../../components/subscription-action";

export const metadata: Metadata = { title: "确认岗位订阅", robots: { index: false, follow: false } };

export default async function ConfirmSubscriptionPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return <main><SiteHeader /><section className="subscription-action-page page-shell"><SubscriptionAction action="confirm" token={token} /></section></main>;
}
