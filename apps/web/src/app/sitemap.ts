import type { MetadataRoute } from "next";

import { getSitemapJobs } from "../lib/jobs";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const jobs = await getSitemapJobs();
  const now = new Date();
  return [
    { url: "https://jobhub.islumi.com", lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: "https://jobhub.islumi.com/jobs", lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    ...jobs.map((job) => ({
      url: `https://jobhub.islumi.com/jobs/${encodeURIComponent(job.id)}`,
      lastModified: new Date(job.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
