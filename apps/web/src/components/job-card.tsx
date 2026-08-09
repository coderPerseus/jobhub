import Link from "next/link";

import type { Job } from "../lib/jobs";
import { PlatformIcon } from "./platform-icon";

function Fact({ label, value }: { label: string; value: string | null }) {
  return <div><dt>{label}</dt><dd>{value || "未说明"}</dd></div>;
}

export function JobCard({ compact = false, job }: { compact?: boolean; job: Job }) {
  const platformLabel = job.platform === "XHS" ? "小红书" : "X";
  const company = job.companyName || job.author;
  return (
    <article className={`job-card${compact ? " job-card-compact" : ""}`}>
      <div className="job-card-topline">
        <div className="company-line">
          <span className="company-avatar">{company.slice(0, 1).toUpperCase()}</span>
          <div><strong>{company}</strong><span>{job.companyNature || "公司性质未说明"}</span></div>
        </div>
        <span className="source-line"><PlatformIcon platform={job.platform} /><span>{platformLabel}</span><time dateTime={job.updatedAt}>更新于 {job.updatedRelativeTime}</time></span>
      </div>

      <Link className="job-title-link" href={`/jobs/${encodeURIComponent(job.id)}`}><h3>{job.title}</h3></Link>
      <p className="job-summary">{job.excerpt}</p>

      {!compact && <dl className="job-facts">
        <Fact label="工作地址" value={job.location} />
        <Fact label="招聘对象" value={job.recruitmentTarget} />
        <Fact label="薪资" value={job.salary} />
        <Fact label="经验要求" value={job.experienceRequirement} />
        <Fact label="投递方式" value={job.contact || (job.applicationUrl ? "在线投递" : "查看原帖")} />
      </dl>}

      <div className="job-card-footer">
        <div className="job-tags">
          <span className="tag tag-accent">{job.tags[0]}</span>
          {job.mode && <span className="tag">{job.mode}</span>}
          {job.type && <span className="tag">{job.type}</span>}
          {job.skills.slice(0, compact ? 1 : 3).map((skill) => <span className="tag" key={skill}>{skill}</span>)}
        </div>
        <div className="job-actions">
          {(job.applicationUrl || job.contact) && <span className="application-ready">可直接投递</span>}
          <Link className="job-link" href={`/jobs/${encodeURIComponent(job.id)}`}>查看详情 <b>→</b></Link>
        </div>
      </div>
    </article>
  );
}
