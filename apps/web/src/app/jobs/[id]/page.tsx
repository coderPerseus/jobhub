import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JobTrustPanel } from "../../../components/job-trust";
import { PlatformIcon } from "../../../components/platform-icon";
import { SiteHeader } from "../../../components/site-header";
import { getJob } from "../../../lib/jobs";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/jobs/[id]">): Promise<Metadata> {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) return {};
  const canonical = `https://jobhub.islumi.com/jobs/${encodeURIComponent(job.id)}`;
  return {
    title: `${job.title}${job.companyName ? `｜${job.companyName}` : ""}`,
    description: job.excerpt,
    alternates: { canonical },
    openGraph: {
      title: job.title,
      description: job.excerpt,
      type: "article",
      url: canonical,
      publishedTime: job.publishedAt,
      modifiedTime: job.updatedAt,
      images: ["/brand/jobhub-logo.png"],
    },
    twitter: {
      card: "summary",
      title: job.title,
      description: job.excerpt,
      images: ["/brand/jobhub-logo.png"],
    },
  };
}

function isPlaceholder(value: string | null | undefined) {
  if (!value) return true;
  return /待确认|未说明/.test(value);
}

export default async function JobDetailPage({ params }: PageProps<"/jobs/[id]">) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();
  const applicationHref = job.applicationUrl || job.sourceUrl;
  const platformLabel = job.platform === "XHS" ? "小红书" : "X";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: `${job.excerpt}\n\n${job.originalText}`,
    datePosted: job.publishedAt,
    hiringOrganization: { "@type": "Organization", name: job.companyName || job.author },
    employmentType: job.type.includes("待确认") ? undefined : job.type,
    jobLocationType: /远程|Remote/i.test(job.mode) ? "TELECOMMUTE" : undefined,
    jobLocation: job.location.includes("待确认")
      ? undefined
      : { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: job.location } },
    directApply: Boolean(job.applicationUrl),
    url: `https://jobhub.islumi.com/jobs/${encodeURIComponent(job.id)}`,
  };

  const facts = [
    { label: "公司", value: job.companyName },
    { label: "公司类型", value: job.companyNature },
    { label: "招聘对象", value: job.recruitmentTarget },
    { label: "地点", value: isPlaceholder(job.location) ? null : job.location },
    { label: "经验", value: job.experienceRequirement },
    { label: "学历", value: job.educationRequirement },
    { label: "薪资", value: job.salary },
    { label: "截止日期", value: job.applicationDeadline },
  ].filter((item) => item.value && !isPlaceholder(item.value));

  const chips = [
    !isPlaceholder(job.location) ? job.location : null,
    !isPlaceholder(job.mode) ? job.mode : null,
    !isPlaceholder(job.type) ? job.type : null,
  ].filter(Boolean) as string[];

  return (
    <main>
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        type="application/ld+json"
      />
      <SiteHeader />
      <div className="detail-shell page-shell">
        <nav className="breadcrumb" aria-label="面包屑">
          <Link href="/jobs">找工作</Link>
          <span>/</span>
          <span>{job.title}</span>
        </nav>

        <section className="detail-layout">
          <article className="detail-main">
            <header className="detail-header">
              <div className="job-card-topline">
                <span className={`platform-badge platform-${job.platform.toLowerCase()}`}>
                  <PlatformIcon platform={job.platform} />
                  {platformLabel}
                </span>
                <time dateTime={job.updatedAt}>{job.updatedRelativeTime}</time>
              </div>
              <h1>{job.title}</h1>
              <p className="detail-author">
                {job.companyName || job.author}
                {job.companyNature && <span> · {job.companyNature}</span>}
              </p>
              {(chips.length > 0 || (job.salary && !isPlaceholder(job.salary))) && (
                <div className="detail-facts">
                  {chips.map((chip) => (
                    <span key={chip}>{chip}</span>
                  ))}
                  {job.salary && !isPlaceholder(job.salary) && (
                    <span className="salary-fact">{job.salary}</span>
                  )}
                </div>
              )}
            </header>

            {job.excerpt && (
              <section className="detail-section">
                <p className="section-label">简介</p>
                <p className="detail-lead">{job.excerpt}</p>
              </section>
            )}

            {(facts.length > 0 || job.positions.length > 1 || job.skills.length > 0) && (
              <section className="detail-section structured-section">
                <p className="section-label">信息</p>
                {facts.length > 0 && (
                  <dl className="structured-grid">
                    {facts.map((fact) => (
                      <div key={fact.label}>
                        <dt>{fact.label}</dt>
                        <dd>{fact.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {job.positions.length > 1 && (
                  <div className="position-list">
                    <h2>在招岗位</h2>
                    <ul>
                      {job.positions.map((position) => (
                        <li key={position}>{position}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {job.skills.length > 0 && (
                  <div className="skill-list">
                    <h2>技能</h2>
                    <div>
                      {job.skills.map((skill) => (
                        <span className="tag" key={skill}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            <section className="detail-section original-post">
              <div className="detail-section-title">
                <div>
                  <p className="section-label">原帖</p>
                  <h2>发布内容</h2>
                </div>
              </div>
              <p>{job.originalText}</p>
              <div className="detail-tags">
                {job.tags.map((tag) => (
                  <span className="tag" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
            </section>

            <aside className="source-notice">
              <strong>提示</strong>
              <p>来自公开社交帖子。投递前请自行核实岗位、薪资与对方身份。</p>
            </aside>
          </article>

          <aside className="detail-aside">
            <div className="detail-summary">
              <p className="section-label">投递</p>
              <dl>
                <div>
                  <dt>公司</dt>
                  <dd>{job.companyName || job.author}</dd>
                </div>
                <div>
                  <dt>联系方式</dt>
                  <dd className="contact-value">{job.contact || "见原帖"}</dd>
                </div>
                <div>
                  <dt>来自</dt>
                  <dd>
                    <span className="inline-platform">
                      <PlatformIcon platform={job.platform} size={16} />
                      {platformLabel}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>发布时间</dt>
                  <dd>
                    <time dateTime={job.publishedAt}>{job.relativeTime}</time>
                  </dd>
                </div>
              </dl>
              <a className="detail-primary-action" href={applicationHref} rel="noreferrer" target="_blank">
                {job.applicationUrl ? "去投递" : "看原帖"} ↗
              </a>
              {job.applicationUrl && (
                <a className="detail-secondary-action" href={job.sourceUrl} rel="noreferrer" target="_blank">
                  打开原帖
                </a>
              )}
            </div>
            <JobTrustPanel job={job} />
            {(job.likes > 0 || job.comments > 0) && (
              <div className="detail-engagement">
                <span>
                  <strong>{job.likes}</strong> 点赞
                </span>
                <span>
                  <strong>{job.comments}</strong> 评论
                </span>
              </div>
            )}
            <Link className="back-link" href="/jobs">
              ← 返回列表
            </Link>
          </aside>
        </section>
      </div>
      <footer className="site-footer">
        <div className="page-shell">
          <strong>jobhub</strong>
          <span>岗位信息来自公开帖子 · 投递前请自行核实</span>
        </div>
      </footer>
    </main>
  );
}
