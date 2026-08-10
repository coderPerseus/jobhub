import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cache } from "react";

export type Platform = "XHS" | "X";
export type JobCategory = "ai" | "fullstack" | "frontend" | "backend" | "mobile" | "product" | "design" | "data" | "operations" | "marketing" | "other";
export type TimeRange = "24h" | "3d" | "7d" | "all";
export type JobSort = "latest" | "popular";
export type CredibilitySignal = "positive" | "mixed" | "negative";
export type FactualVerificationStatus =
  | "not_applicable"
  | "unverified"
  | "partially_verified"
  | "verified"
  | "conflicting";
export type Job = {
  id: string;
  platform: Platform;
  platformPostId: string;
  sourceTitle: string;
  title: string;
  excerpt: string;
  author: string;
  authorHandle: string | null;
  location: string;
  mode: string;
  type: string;
  companyName: string | null;
  companyNature: string | null;
  recruitmentTarget: string | null;
  positions: string[];
  salary: string | null;
  experienceRequirement: string | null;
  educationRequirement: string | null;
  skills: string[];
  benefits: string[];
  applicationUrl: string | null;
  contact: string | null;
  applicationDeadline: string | null;
  confidence: number | null;
  structuredAt: string | null;
  contentCompleteness: number | null;
  credibilitySignal: CredibilitySignal | null;
  factualVerificationStatus: FactualVerificationStatus | null;
  shouldPublish: boolean | null;
  reviewReason: string | null;
  tags: string[];
  relativeTime: string;
  updatedRelativeTime: string;
  publishedAt: string;
  updatedAt: string;
  publishedMinutesAgo: number;
  likes: number;
  comments: number;
  reposts: number;
  views: number;
  originalText: string;
  sourceUrl: string;
  imageUrl: string | null;
  category: JobCategory;
};

type ApiJob = {
  id: string;
  platform: Platform;
  platform_post_id: string;
  title: string;
  body: string;
  excerpt: string;
  author_name: string;
  author_handle: string | null;
  source_url: string;
  published_at: string;
  last_seen_at: string;
  likes: number;
  comments: number;
  reposts: number;
  views: number;
  image_url: string | null;
  category: JobCategory;
  company_name: string | null;
  company_nature: string | null;
  recruitment_target: string | null;
  position_title: string | null;
  positions_json: string | null;
  work_location: string | null;
  work_mode: string | null;
  employment_type: string | null;
  salary: string | null;
  experience_requirement: string | null;
  education_requirement: string | null;
  skills_json: string | null;
  benefits_json: string | null;
  application_url: string | null;
  contact: string | null;
  application_deadline: string | null;
  structured_summary: string | null;
  confidence: number | null;
  structured_at: string | null;
  content_completeness: number | null;
  credibility_signal: CredibilitySignal | null;
  factual_verification_status: FactualVerificationStatus | null;
  should_publish: boolean | number | null;
  review_reason: string | null;
};

export type JobPage = {
  jobs: Job[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type JobQuery = {
  page?: number;
  query?: string;
  categories?: JobCategory[];
  platforms?: Platform[];
  timeRange?: TimeRange;
  sort?: JobSort;
};

export const categoryLabels: Record<JobCategory, string> = {
  ai: "AI / 算法",
  fullstack: "全栈",
  frontend: "前端",
  backend: "后端",
  mobile: "移动端",
  product: "产品",
  design: "设计",
  data: "数据",
  operations: "运营",
  marketing: "营销",
  other: "其他",
};

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787").replace(/\/$/, "");

async function fetchApi(path: string) {
  if (process.env.NODE_ENV === "production") {
    try {
      const { env } = getCloudflareContext();
      if (env.API) return env.API.fetch(`https://folk-job-api${path}`);
    } catch {
      // A standalone Next.js build can run without Cloudflare bindings.
    }
  }
  return fetch(`${apiUrl}${path}`, { cache: "no-store" });
}

function normalizeJobId(id: string) {
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

function relativeTime(publishedAt: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(publishedAt).valueOf()) / 60_000));
  if (minutes < 60) return { label: `${Math.max(1, minutes)} 分钟前`, minutes };
  if (minutes < 1_440) return { label: `${Math.floor(minutes / 60)} 小时前`, minutes };
  return { label: `${Math.floor(minutes / 1_440)} 天前`, minutes };
}

function parseList(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function toJob(value: ApiJob): Job {
  const published = relativeTime(value.published_at);
  const updated = relativeTime(value.last_seen_at);
  const positions = parseList(value.positions_json);
  const skills = parseList(value.skills_json);
  const companyName = value.company_name || null;
  const positionTitle = value.position_title || value.title;
  const displayTitle = /^(多个岗位|Multiple roles)$/i.test(positionTitle) && positions.length
    ? `${positions[0]}${positions.length > 1 ? ` 等 ${positions.length} 个岗位` : ""}`
    : positionTitle;
  return {
    id: value.id,
    platform: value.platform,
    platformPostId: value.platform_post_id,
    sourceTitle: value.title,
    title: displayTitle,
    excerpt: value.structured_summary || value.excerpt,
    author: value.author_name,
    authorHandle: value.author_handle,
    location: value.work_location || "地点待确认",
    mode: value.work_mode || "办公方式待确认",
    type: value.employment_type || "类型待确认",
    companyName,
    companyNature: value.company_nature || null,
    recruitmentTarget: value.recruitment_target || null,
    positions: positions.length ? positions : [positionTitle],
    salary: value.salary || null,
    experienceRequirement: value.experience_requirement || null,
    educationRequirement: value.education_requirement || null,
    skills,
    benefits: parseList(value.benefits_json),
    applicationUrl: value.application_url || null,
    contact: value.contact || null,
    applicationDeadline: value.application_deadline || null,
    confidence: value.confidence,
    structuredAt: value.structured_at,
    contentCompleteness: value.content_completeness,
    credibilitySignal: value.credibility_signal,
    factualVerificationStatus: value.factual_verification_status,
    shouldPublish: value.should_publish == null
      ? null
      : value.should_publish === true || value.should_publish === 1,
    reviewReason: value.review_reason,
    tags: [categoryLabels[value.category], value.platform === "XHS" ? "小红书" : "X"],
    relativeTime: published.label,
    updatedRelativeTime: updated.label,
    publishedAt: value.published_at,
    updatedAt: value.last_seen_at,
    publishedMinutesAgo: published.minutes,
    likes: value.likes,
    comments: value.comments,
    reposts: value.reposts,
    views: value.views,
    originalText: value.body,
    sourceUrl: value.source_url,
    imageUrl: value.image_url,
    category: value.category,
  };
}

export async function getJobs(options: JobQuery = {}): Promise<JobPage> {
  const params = new URLSearchParams({
    page: String(options.page ?? 1),
    pageSize: "20",
    sort: options.sort ?? "latest",
  });
  if (options.query) params.set("q", options.query);
  if (options.categories?.length) params.set("category", options.categories.join(","));
  if (options.platforms?.length) params.set("platform", options.platforms.join(","));
  const range = options.timeRange ?? "7d";
  if (range !== "all") {
    const days = { "24h": 1, "3d": 3, "7d": 7 }[range];
    params.set("since", new Date(Date.now() - days * 86_400_000).toISOString());
  }
  const response = await fetchApi(`/jobs?${params}`);
  if (!response.ok) throw new Error(`Failed to load jobs: ${response.status}`);
  const payload = await response.json() as Omit<JobPage, "jobs"> & { jobs: ApiJob[] };
  return { ...payload, jobs: payload.jobs.map(toJob) };
}

export const getJob = cache(async (id: string): Promise<Job | null> => {
  const response = await fetchApi(`/job?id=${encodeURIComponent(normalizeJobId(id))}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to load job: ${response.status}`);
  const payload = await response.json() as { job: ApiJob };
  return toJob(payload.job);
});

export async function getSitemapJobs() {
  const jobs: { id: string; updatedAt: string }[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const response = await fetchApi(`/jobs?page=${page}&pageSize=100`);
    if (!response.ok) break;
    const payload = await response.json() as { jobs: ApiJob[]; totalPages: number };
    jobs.push(...payload.jobs.map((job) => ({ id: job.id, updatedAt: job.last_seen_at })));
    totalPages = payload.totalPages;
    page += 1;
  } while (page <= totalPages);
  return jobs;
}
