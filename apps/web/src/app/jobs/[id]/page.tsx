import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

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
    openGraph: { title: job.title, description: job.excerpt, type: "article", url: canonical, publishedTime: job.publishedAt, modifiedTime: job.updatedAt, images: ["/brand/jobhub-logo.png"] },
    twitter: { card: "summary", title: job.title, description: job.excerpt, images: ["/brand/jobhub-logo.png"] },
  };
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
    jobLocation: job.location.includes("待确认") ? undefined : { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: job.location } },
    directApply: Boolean(job.applicationUrl),
    url: `https://jobhub.islumi.com/jobs/${encodeURIComponent(job.id)}`,
  };

  return (
    <main>
      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} type="application/ld+json" />
      <SiteHeader />
      <div className="detail-shell page-shell">
        <nav className="breadcrumb" aria-label="面包屑">
          <Link href="/jobs">工作机会</Link><span>/</span><span>{job.title}</span>
        </nav>

        <section className="detail-layout">
          <article className="detail-main">
            <header className="detail-header">
              <div className="job-card-topline">
                <span className={`platform-badge platform-${job.platform.toLowerCase()}`}><PlatformIcon platform={job.platform} />{platformLabel}</span>
                <time dateTime={job.updatedAt}>更新于 {job.updatedRelativeTime}</time>
              </div>
              <h1>{job.title}</h1>
              <p className="detail-author">{job.companyName || job.author}{job.companyNature && <span> · {job.companyNature}</span>}</p>
              <div className="detail-facts"><span>{job.location}</span><span>{job.mode}</span><span>{job.type}</span>{job.salary && <span className="salary-fact">{job.salary}</span>}</div>
            </header>

            <section className="detail-section">
              <p className="section-label">机会概述</p>
              <p className="detail-lead">{job.excerpt}</p>
            </section>

            <section className="detail-section structured-section">
              <p className="section-label">结构化职位信息</p>
              <dl className="structured-grid">
                <div><dt>公司名称</dt><dd>{job.companyName || "未说明"}</dd></div>
                <div><dt>公司性质</dt><dd>{job.companyNature || "未说明"}</dd></div>
                <div><dt>招聘对象</dt><dd>{job.recruitmentTarget || "未说明"}</dd></div>
                <div><dt>工作地址</dt><dd>{job.location}</dd></div>
                <div><dt>经验要求</dt><dd>{job.experienceRequirement || "未说明"}</dd></div>
                <div><dt>学历要求</dt><dd>{job.educationRequirement || "未说明"}</dd></div>
                <div><dt>薪资待遇</dt><dd>{job.salary || "未说明"}</dd></div>
                <div><dt>投递截止</dt><dd>{job.applicationDeadline || "未说明"}</dd></div>
              </dl>
              {job.positions.length > 1 && <div className="position-list"><h2>招聘岗位</h2><ul>{job.positions.map((position) => <li key={position}>{position}</li>)}</ul></div>}
              {job.skills.length > 0 && <div className="skill-list"><h2>技能关键词</h2><div>{job.skills.map((skill) => <span className="tag" key={skill}>{skill}</span>)}</div></div>}
            </section>

            <section className="detail-section original-post">
              <div className="detail-section-title"><div><p className="section-label">平台原帖</p><h2>发布者提供的信息</h2></div><span>未改写</span></div>
              <p>{job.originalText}</p>
              <div className="detail-tags">{job.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>
            </section>

            <aside className="source-notice">
              <strong>信息说明</strong>
              <p>该机会来自公开社交帖子。jobhub 负责聚合、去重与结构化，不代表发布方；联系或申请前请核实岗位、薪资和身份信息。</p>
            </aside>
          </article>

          <aside className="detail-aside">
            <div className="detail-summary">
              <p className="section-label">申请信息</p>
              <dl>
                <div><dt>公司</dt><dd>{job.companyName || job.author}</dd></div>
                <div><dt>联系方式</dt><dd className="contact-value">{job.contact || "请查看原帖"}</dd></div>
                <div><dt>来源平台</dt><dd><span className="inline-platform"><PlatformIcon platform={job.platform} size={16} />{platformLabel}</span></dd></div>
                <div><dt>发布时间</dt><dd><time dateTime={job.publishedAt}>{job.relativeTime}</time></dd></div>
              </dl>
              <a className="detail-primary-action" href={applicationHref} rel="noreferrer" target="_blank">{job.applicationUrl ? "前往投递" : "查看原帖"} ↗</a>
              {job.applicationUrl && <a className="detail-secondary-action" href={job.sourceUrl} rel="noreferrer" target="_blank">查看来源原帖</a>}
            </div>
            <div className="detail-engagement"><span><strong>{job.likes}</strong> 点赞</span><span><strong>{job.comments}</strong> 评论</span></div>
            <Link className="back-link" href="/jobs">← 返回全部机会</Link>
          </aside>
        </section>
      </div>
      <footer className="site-footer"><div className="page-shell"><strong>jobhub</strong><span>公开信息聚合 · 请以原帖信息为准</span></div></footer>
    </main>
  );
}
