import type { Metadata } from "next";

import { SiteHeader } from "../../../components/site-header";
import { SubscriptionAction } from "../../../components/subscription-action";

export const metadata: Metadata = { title: "退订岗位提醒", robots: { index: false, follow: false } };

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return <main><SiteHeader /><section className="subscription-action-page page-shell"><SubscriptionAction action="unsubscribe" token={token} /></section></main>;
}
