import Link from "next/link";

import { JobCard } from "../components/job-card";
import { JobAlertSignup } from "../components/job-alert-signup";
import { SiteHeader } from "../components/site-header";
import { PlatformIcon } from "../components/platform-icon";
import { getJobs, type Job } from "../lib/jobs";

export const dynamic = "force-dynamic";

const signals = [
  {
    label: "小红书",
    platform: "XHS" as const,
    value: "生活社区里的招聘",
    detail: "很多机会先发在这里，还没上招聘网站",
    tone: "red" as const,
  },
  {
    label: "X",
    platform: "X" as const,
    value: "全球实时分享",
    detail: "创始人、团队和猎头常在这里公开招人",
    tone: "black" as const,
  },
];

const values = [
  { icon: "◷", title: "新鲜优先", desc: "优先展示最近发布的机会" },
  { icon: "↻", title: "持续更新", desc: "每天都有新岗位进入列表" },
  { icon: "▽", title: "不重复打扰", desc: "同一岗位只出现一次" },
];

/** Mix platforms for hero cards so preview isn't all X or all 小红书. */
function pickPreviewJobs(jobs: Job[], count = 3): Job[] {
  const xhs = jobs.filter((job) => job.platform === "XHS");
  const x = jobs.filter((job) => job.platform === "X");
  const picked: Job[] = [];

  // Prefer one 小红书 + one X first, then fill the rest.
  if (xhs[0]) picked.push(xhs[0]);
  if (x[0]) picked.push(x[0]);
  if (xhs[1] && picked.length < count) picked.push(xhs[1]);
  else if (x[1] && picked.length < count) picked.push(x[1]);

  for (const job of jobs) {
    if (picked.length >= count) break;
    if (!picked.some((item) => item.id === job.id)) picked.push(job);
  }
  return picked;
}

export default async function Home() {
  const { jobs, total } = await getJobs({ timeRange: "24h" });
  const hasBothPlatforms =
    jobs.some((job) => job.platform === "XHS") && jobs.some((job) => job.platform === "X");
  // If the last 24h is one-sided, widen to 7d so the hero still shows both sources.
  const previewSource = hasBothPlatforms ? jobs : (await getJobs({ timeRange: "7d" })).jobs;
  const previewJobs = pickPreviewJobs(previewSource, 3);

  return (
    <main>
      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "jobhub",
            url: "https://jobhub.islumi.com",
            description: "在小红书和 X 上发现互联网工作机会。",
            potentialAction: {
              "@type": "SearchAction",
              target: "https://jobhub.islumi.com/jobs?q={search_term_string}",
              "query-input": "required name=search_term_string",
            },
          }).replace(/</g, "\\u003c"),
        }}
        type="application/ld+json"
      />
      <SiteHeader />

      <section className="landing-hero page-shell">
        <div className="hero-copy reveal">
          <p className="kicker">
            <span /> 互联网工作机会
          </p>
          <h1>
            散落在社交网络里的
            <br />
            工作机会，都在这里。
          </h1>
          <p className="hero-intro">
            小红书和 X 上每天都有人在招人。jobhub 帮你把这些机会整理好，让你更快看到值得投的岗位。
          </p>

          <form className="hero-search" action="/jobs">
            <label className="sr-only" htmlFor="hero-query">
              搜索工作机会
            </label>
            <span aria-hidden="true">⌕</span>
            <input
              id="hero-query"
              name="q"
              placeholder="试试：前端、远程、设计师、实习…"
            />
            <button type="submit">
              开始找工作 <b aria-hidden="true">↗</b>
            </button>
          </form>

          <div className="live-line" aria-label="更新动态">
            <strong>
              <i /> 今日动态
            </strong>
            <span>覆盖小红书与 X</span>
            {total > 0 && (
              <>
                <span className="live-dot" aria-hidden="true" />
                <Link className="live-link" href="/jobs?time=24h">
                  近 24 小时 {total} 个新机会 →
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="hero-preview reveal reveal-delay" aria-label="工作机会预览">
          <span className="orbit orbit-one" />
          <span className="orbit orbit-two" />
          {previewJobs.map((job, index) => (
            <div className={`floating-card floating-card-${index + 1}`} key={job.id}>
              <JobCard job={job} compact />
            </div>
          ))}
          {previewJobs.length === 0 && (
            <div className="hero-preview-empty">
              <p>新机会马上就到…</p>
              <Link href="/jobs">先看看全部岗位 →</Link>
            </div>
          )}
        </div>
      </section>

      <section className="source-section page-shell" id="sources">
        <div className="source-copy">
          <p className="section-label">机会从哪来</p>
          <h2>越来越多的招聘信息在社媒上发布。</h2>
        </div>
        <div className="signal-grid">
          {signals.map((signal) => (
            <article className="signal-card" key={signal.label}>
              <span className={`platform-mark platform-mark-${signal.tone}`}>
                <PlatformIcon platform={signal.platform} size={22} />
              </span>
              <div>
                <strong>{signal.label}</strong>
                <span className="signal-value">{signal.value}</span>
                <span className="signal-detail">{signal.detail}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="value-strip">
        <div className="page-shell value-grid">
          {values.map((item) => (
            <article key={item.title}>
              <span aria-hidden="true">{item.icon}</span>
              <div>
                <strong>{item.title}</strong>
                <p>{item.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="alert-section page-shell" id="alerts">
        <JobAlertSignup />
      </section>

      <section className="landing-cta page-shell" id="about">
        <p>今天或许就有适合你的岗位</p>
        <h2>
          少刷一点信息流，
          <br />
          多看一点新机会。
        </h2>
        <Link className="button-primary" href="/jobs">
          浏览全部机会 <span>↗</span>
        </Link>
      </section>

      <footer className="site-footer">
        <div className="page-shell">
          <strong>jobhub</strong>
          <span>© 2026 · 在社交网络里找工作</span>
        </div>
      </footer>
    </main>
  );
}
