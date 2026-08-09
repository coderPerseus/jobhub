import Link from "next/link";

import { JobCard } from "../components/job-card";
import { JobAlertSignup } from "../components/job-alert-signup";
import { SiteHeader } from "../components/site-header";
import { PlatformIcon } from "../components/platform-icon";
import { getJobs } from "../lib/jobs";

export const dynamic = "force-dynamic";

const signals = [
  { label: "小红书", value: "持续监测", detail: "招聘与合作信息", tone: "red" },
  { label: "X", value: "实时追踪", detail: "公开招聘帖子", tone: "black" },
];

export default async function Home() {
  const { jobs } = await getJobs({ timeRange: "24h" });
  return (
    <main>
      <script dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "jobhub",
        url: "https://jobhub.islumi.com",
        description: "聚合小红书与 X 上的互联网招聘信息，并提取岗位、公司、地点与投递方式。",
        potentialAction: { "@type": "SearchAction", target: "https://jobhub.islumi.com/jobs?q={search_term_string}", "query-input": "required name=search_term_string" },
      }).replace(/</g, "\\u003c") }} type="application/ld+json" />
      <SiteHeader />

      <section className="landing-hero page-shell">
        <div className="hero-copy reveal">
          <p className="kicker"><span /> 社交网络工作机会雷达</p>
          <h1>散落在社交网络里的工作机会，都在这里。</h1>
          <p className="hero-intro">
            聚合小红书与 X 上正在发生的招聘和合作信息，去重筛选，帮你更快发现值得关注的机会。
          </p>

          <form className="hero-search" action="/jobs">
            <label className="sr-only" htmlFor="hero-query">搜索工作机会</label>
            <span aria-hidden="true">⌕</span>
            <input id="hero-query" name="q" placeholder="搜索职位、公司或关键词，例如：设计、远程、实习" />
            <button type="submit">查找机会 <b aria-hidden="true">↗</b></button>
          </form>

          <div className="live-line" aria-label="实时抓取动态">
            <strong><i /> 来源状态</strong>
            <span>小红书招聘信息持续监测</span>
            <span>X 最新招聘帖子同步追踪</span>
          </div>
        </div>

        <div className="hero-preview reveal reveal-delay" aria-label="工作机会预览">
          <span className="orbit orbit-one" />
          <span className="orbit orbit-two" />
          {jobs.slice(0, 3).map((job, index) => (
            <div className={`floating-card floating-card-${index + 1}`} key={job.id}>
              <JobCard job={job} compact />
            </div>
          ))}
        </div>
      </section>

      <section className="source-section page-shell" id="sources">
        <div>
          <p className="section-label">来自这些平台</p>
          <h2>找到那些还没进入招聘网站的机会。</h2>
        </div>
        <div className="signal-grid">
          {signals.map((signal) => (
            <article className="signal-card" key={signal.label}>
              <span className={`platform-mark platform-mark-${signal.tone}`}><PlatformIcon platform={signal.label === "小红书" ? "XHS" : "X"} size={26} /></span>
              <div><strong>{signal.value}</strong><span>{signal.detail}</span></div>
              <small>最近 24 小时</small>
            </article>
          ))}
        </div>
      </section>

      <section className="value-strip">
        <div className="page-shell value-grid">
          <article><span>◷</span><div><strong>最近 24 小时</strong><p>只展示仍有时效的工作机会</p></div></article>
          <article><span>↻</span><div><strong>每日更新</strong><p>持续追踪新的招聘信号</p></div></article>
          <article><span>▽</span><div><strong>去重聚合</strong><p>相同机会只需要看一次</p></div></article>
        </div>
      </section>

      <section className="alert-section page-shell" id="alerts">
        <JobAlertSignup />
      </section>

      <section className="landing-cta page-shell" id="about">
        <p>新的机会正在出现</p>
        <h2>少刷一点信息流，<br />多看一点新机会。</h2>
        <Link className="button-primary" href="/jobs">浏览全部机会 <span>↗</span></Link>
      </section>

      <footer className="site-footer"><div className="page-shell"><strong>jobhub</strong><span>© 2026 · 从公开社交信息中发现工作机会</span></div></footer>
    </main>
  );
}
