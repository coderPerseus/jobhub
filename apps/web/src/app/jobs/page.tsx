import type { Metadata } from "next";

import { SiteHeader } from "../../components/site-header";
import { JobAlertSignup } from "../../components/job-alert-signup";
import { getJobs, type JobCategory, type JobSort, type Platform, type TimeRange } from "../../lib/jobs";
import { JobExplorer } from "./job-explorer";

export const metadata: Metadata = {
  title: "最新工作机会",
  description: "浏览来自小红书与 X 的互联网招聘，按岗位、地点和关键词筛选。",
  alternates: { canonical: "/jobs" },
  openGraph: {
    title: "最新工作机会｜jobhub",
    description: "在小红书和 X 上发现互联网工作机会。",
    url: "/jobs",
    images: ["/brand/jobhub-logo.png"],
  },
  twitter: {
    card: "summary",
    title: "最新工作机会｜jobhub",
    description: "在小红书和 X 上发现互联网工作机会。",
    images: ["/brand/jobhub-logo.png"],
  },
};

export const dynamic = "force-dynamic";

const categories = new Set<JobCategory>([
  "ai",
  "fullstack",
  "frontend",
  "backend",
  "mobile",
  "product",
  "design",
  "data",
  "operations",
  "marketing",
  "other",
]);

function splitValues<T extends string>(value: string | string[] | undefined, allowed: Set<T>): T[] {
  const text = Array.isArray(value) ? value.join(",") : (value ?? "");
  return text.split(",").filter((item): item is T => allowed.has(item as T));
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = Array.isArray(params.q) ? params.q[0] : (params.q ?? "");
  const page = Math.max(Number(Array.isArray(params.page) ? params.page[0] : params.page) || 1, 1);
  const selectedCategories = splitValues(params.category, categories);
  const platforms = splitValues(params.platform, new Set<Platform>(["XHS", "X"]));
  const timeRangeValue = Array.isArray(params.time) ? params.time[0] : params.time;
  const timeRange: TimeRange = ["24h", "3d", "7d", "all"].includes(timeRangeValue ?? "")
    ? (timeRangeValue as TimeRange)
    : "7d";
  const sortValue = Array.isArray(params.sort) ? params.sort[0] : params.sort;
  const sort: JobSort = sortValue === "popular" ? "popular" : "latest";
  const result = await getJobs({ page, query, categories: selectedCategories, platforms, timeRange, sort });

  return (
    <main>
      <SiteHeader />
      <section className="jobs-heading page-shell">
        <div className="jobs-heading-copy">
          <p className="kicker">
            <span /> 每日更新
          </p>
          <h1>最新工作机会</h1>
          <p className="jobs-heading-desc">来自小红书与 X，帮你挑出值得看的岗位</p>
        </div>
      </section>
      <JobExplorer
        filters={{ query, categories: selectedCategories, platforms, timeRange, sort }}
        result={result}
      />
      <section className="alert-section alert-section-jobs page-shell" id="alerts">
        <JobAlertSignup compact />
      </section>
      <footer className="site-footer">
        <div className="page-shell">
          <strong>jobhub</strong>
          <span>岗位信息来自公开帖子 · 投递前请自行核实</span>
        </div>
      </footer>
    </main>
  );
}
