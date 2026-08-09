"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { JobCard } from "../../components/job-card";
import { PlatformIcon } from "../../components/platform-icon";
import {
  categoryLabels,
  type JobCategory,
  type JobPage,
  type JobSort,
  type Platform,
  type TimeRange,
} from "../../lib/jobs";

const categoryOptions = Object.entries(categoryLabels) as [JobCategory, string][];
const platformOptions: { label: string; value: Platform }[] = [
  { label: "小红书", value: "XHS" },
  { label: "X / Twitter", value: "X" },
];

type Filters = {
  query: string;
  categories: JobCategory[];
  platforms: Platform[];
  timeRange: TimeRange;
  sort: JobSort;
};

export function JobExplorer({ filters, result }: { filters: Filters; result: JobPage }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(filters.query);
  const [isPending, startTransition] = useTransition();

  const navigate = (changes: Record<string, string | null>, resetPage = true) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    if (resetPage) params.delete("page");
    startTransition(() => router.push(`/jobs${params.size ? `?${params}` : ""}`));
  };

  const toggle = <T extends string>(value: T, selected: T[], key: string) => {
    const next = selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value];
    navigate({ [key]: next.length ? next.join(",") : null });
  };

  const pages = Array.from({ length: result.totalPages }, (_, index) => index + 1)
    .filter((page) => page === 1 || page === result.totalPages || Math.abs(page - result.page) <= 2);

  return (
    <section className={`explorer page-shell${isPending ? " is-loading" : ""}`}>
      <aside className="filters">
        <div className="filter-block position-filter">
          <h2>工作岗位</h2>
          {categoryOptions.map(([value, label]) => (
            <label className="check-row" key={value}>
              <input checked={filters.categories.includes(value)} onChange={() => toggle(value, filters.categories, "category")} type="checkbox" />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <div className="filter-block"><h2>平台</h2>{platformOptions.map((option) => (
          <label className="check-row" key={option.value}><input checked={filters.platforms.includes(option.value)} onChange={() => toggle(option.value, filters.platforms, "platform")} type="checkbox" /><span className="filter-platform"><PlatformIcon platform={option.value} size={16} />{option.label}</span></label>
        ))}</div>
        <div className="filter-block"><h2>发布时间</h2>{([['24h', '最近 24 小时'], ['3d', '最近 3 天'], ['7d', '最近 7 天'], ['all', '全部时间']] as const).map(([value, label]) => (
          <label className="radio-row" key={value}><input checked={filters.timeRange === value} name="time" onChange={() => navigate({ time: value === "7d" ? null : value })} type="radio" /><span>{label}</span></label>
        ))}</div>
        <button className="reset-button" onClick={() => { setQuery(""); navigate({ q: null, category: null, platform: null, time: null, sort: null }); }} type="button">清除筛选</button>
      </aside>

      <div className="job-results">
        <div className="result-controls">
          <form className="result-search" onSubmit={(event) => { event.preventDefault(); navigate({ q: query.trim() || null }); }}>
            <span>⌕</span><input aria-label="搜索职位" onChange={(event) => setQuery(event.target.value)} placeholder="搜索职位、公司或关键词" value={query} />
            <button type="submit">搜索</button>
          </form>
          <select aria-label="排序方式" onChange={(event) => navigate({ sort: event.target.value === "popular" ? "popular" : null })} value={filters.sort}><option value="latest">最新发布</option><option value="popular">最多讨论</option></select>
        </div>
        <div className="result-count"><strong>{result.total}</strong> 个互联网岗位 <span>· 每页 {result.pageSize} 条</span></div>
        <div className="job-list">
          {result.jobs.map((job) => <JobCard job={job} key={job.id} />)}
          {result.jobs.length === 0 && <div className="empty-state"><span>⌕</span><h2>没有找到匹配机会</h2><p>换一个关键词，或扩大发布时间范围。</p><button onClick={() => navigate({ q: null, category: null, platform: null, time: null, sort: null })} type="button">清除全部筛选</button></div>}
        </div>
        {result.totalPages > 1 && <nav aria-label="职位分页" className="pagination">
          <button disabled={result.page === 1} onClick={() => navigate({ page: String(result.page - 1) }, false)} type="button">← 上一页</button>
          <div>{pages.map((page, index) => <span key={page}>{index > 0 && page - pages[index - 1] > 1 && <i>…</i>}<button aria-current={page === result.page ? "page" : undefined} onClick={() => navigate({ page: String(page) }, false)} type="button">{page}</button></span>)}</div>
          <button disabled={result.page === result.totalPages} onClick={() => navigate({ page: String(result.page + 1) }, false)} type="button">下一页 →</button>
        </nav>}
      </div>
    </section>
  );
}
