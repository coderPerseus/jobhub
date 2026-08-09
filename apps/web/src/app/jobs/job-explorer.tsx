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
  { label: "X", value: "X" },
];
const timeOptions = [
  { value: "24h" as const, label: "最近 24 小时" },
  { value: "3d" as const, label: "最近 3 天" },
  { value: "7d" as const, label: "最近 7 天" },
  { value: "all" as const, label: "全部" },
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

  const hasActiveFilters =
    Boolean(filters.query) ||
    filters.categories.length > 0 ||
    filters.platforms.length > 0 ||
    filters.timeRange !== "7d" ||
    filters.sort !== "latest";

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

  const clearAll = () => {
    setQuery("");
    navigate({ q: null, category: null, platform: null, time: null, sort: null });
  };

  const pages = Array.from({ length: result.totalPages }, (_, index) => index + 1).filter(
    (page) => page === 1 || page === result.totalPages || Math.abs(page - result.page) <= 2,
  );

  const activeChips: { key: string; label: string; clear: () => void }[] = [];
  if (filters.query) {
    activeChips.push({
      key: "q",
      label: filters.query,
      clear: () => {
        setQuery("");
        navigate({ q: null });
      },
    });
  }
  for (const category of filters.categories) {
    activeChips.push({
      key: `cat-${category}`,
      label: categoryLabels[category],
      clear: () => toggle(category, filters.categories, "category"),
    });
  }
  for (const platform of filters.platforms) {
    activeChips.push({
      key: `plat-${platform}`,
      label: platform === "XHS" ? "小红书" : "X",
      clear: () => toggle(platform, filters.platforms, "platform"),
    });
  }
  if (filters.timeRange !== "7d") {
    const label = timeOptions.find((item) => item.value === filters.timeRange)?.label ?? filters.timeRange;
    activeChips.push({ key: "time", label, clear: () => navigate({ time: null }) });
  }
  if (filters.sort === "popular") {
    activeChips.push({ key: "sort", label: "最热", clear: () => navigate({ sort: null }) });
  }

  return (
    <section className={`explorer page-shell${isPending ? " is-loading" : ""}`}>
      <aside className="filters" aria-label="筛选">
        <div className="filter-block">
          <h2>岗位方向</h2>
          <div className="filter-chip-list">
            {categoryOptions.map(([value, label]) => {
              const active = filters.categories.includes(value);
              return (
                <button
                  aria-pressed={active}
                  className={`filter-chip${active ? " is-active" : ""}`}
                  key={value}
                  onClick={() => toggle(value, filters.categories, "category")}
                  type="button"
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="filter-block">
          <h2>来自</h2>
          <div className="filter-option-list">
            {platformOptions.map((option) => {
              const active = filters.platforms.includes(option.value);
              return (
                <button
                  aria-pressed={active}
                  className={`filter-option${active ? " is-active" : ""}`}
                  key={option.value}
                  onClick={() => toggle(option.value, filters.platforms, "platform")}
                  type="button"
                >
                  <span className="filter-check" aria-hidden="true" />
                  <span className="filter-platform">
                    <PlatformIcon platform={option.value} size={16} />
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <fieldset className="filter-block">
          <legend>发布时间</legend>
          <div className="filter-option-list">
            {timeOptions.map((option) => {
              const active = filters.timeRange === option.value;
              return (
                <label
                  className={`filter-option filter-option-radio${active ? " is-active" : ""}`}
                  key={option.value}
                >
                  <input
                    checked={active}
                    name="time"
                    onChange={() => navigate({ time: option.value === "7d" ? null : option.value })}
                    type="radio"
                    value={option.value}
                  />
                  <span className="filter-radio" aria-hidden="true" />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {hasActiveFilters && (
          <button className="reset-button" onClick={clearAll} type="button">
            清除筛选
          </button>
        )}
      </aside>

      <div className="job-results">
        <div className="result-toolbar">
          <form
            className="result-search"
            onSubmit={(event) => {
              event.preventDefault();
              navigate({ q: query.trim() || null });
            }}
          >
            <span aria-hidden="true" className="result-search-icon">
              ⌕
            </span>
            <input
              aria-label="搜索职位"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索职位、公司或关键词"
              value={query}
            />
            <button type="submit">搜索</button>
          </form>
          <div className="result-sort">
            <label className="sr-only" htmlFor="job-sort">
              排序
            </label>
            <select
              id="job-sort"
              onChange={(event) => navigate({ sort: event.target.value === "popular" ? "popular" : null })}
              value={filters.sort}
            >
              <option value="latest">最新</option>
              <option value="popular">最热</option>
            </select>
          </div>
        </div>

        <div className="result-meta">
          <div className="result-count">
            <strong>{result.total.toLocaleString("zh-CN")}</strong>
            <span> 个机会</span>
            {result.total > 0 && result.totalPages > 1 && (
              <span className="result-page-hint">
                · 第 {result.page} / {result.totalPages} 页
              </span>
            )}
          </div>
          {activeChips.length > 0 && (
            <div className="active-filters" aria-label="已选条件">
              {activeChips.map((chip) => (
                <button className="active-filter-chip" key={chip.key} onClick={chip.clear} type="button">
                  {chip.label}
                  <span aria-hidden="true">×</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="job-list">
          {result.jobs.map((job) => (
            <JobCard job={job} key={job.id} />
          ))}
          {result.jobs.length === 0 && (
            <div className="empty-state">
              <span aria-hidden="true">⌕</span>
              <h2>暂时没有符合的机会</h2>
              <p>换个关键词，或放宽筛选条件试试。</p>
              <button onClick={clearAll} type="button">
                清除筛选
              </button>
            </div>
          )}
        </div>

        {result.totalPages > 1 && (
          <nav aria-label="分页" className="pagination">
            <button
              disabled={result.page === 1}
              onClick={() => navigate({ page: String(result.page - 1) }, false)}
              type="button"
            >
              ← 上一页
            </button>
            <div className="pagination-pages">
              {pages.map((page, index) => (
                <span key={page}>
                  {index > 0 && page - pages[index - 1] > 1 && <i>…</i>}
                  <button
                    aria-current={page === result.page ? "page" : undefined}
                    onClick={() => navigate({ page: String(page) }, false)}
                    type="button"
                  >
                    {page}
                  </button>
                </span>
              ))}
            </div>
            <button
              disabled={result.page === result.totalPages}
              onClick={() => navigate({ page: String(result.page + 1) }, false)}
              type="button"
            >
              下一页 →
            </button>
          </nav>
        )}
      </div>
    </section>
  );
}
