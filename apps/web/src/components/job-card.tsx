import Link from "next/link";
import type { ReactNode } from "react";

import type { Job } from "../lib/jobs";
import { PlatformIcon } from "./platform-icon";

function isPlaceholder(value: string | null | undefined) {
  if (!value) return true;
  return /待确认|未说明|查看原帖|在线投递/.test(value);
}

function MetaItem({ children }: { children: ReactNode }) {
  return <span className="job-meta-item">{children}</span>;
}

function JobEngagement({ comments, likes }: { comments: number; likes: number }) {
  if (likes <= 0 && comments <= 0) return null;
  return (
    <span className="job-engagement">
      {likes > 0 && (
        <span>
          <span aria-hidden="true">♡ </span>
          <span className="sr-only">点赞 </span>
          {likes}
        </span>
      )}
      {comments > 0 && (
        <span>
          <span aria-hidden="true">💬 </span>
          <span className="sr-only">评论 </span>
          {comments}
        </span>
      )}
    </span>
  );
}

export function JobCard({ compact = false, job }: { compact?: boolean; job: Job }) {
  const platformLabel = job.platform === "XHS" ? "小红书" : "X";
  const company = job.companyName || job.author;
  const href = `/jobs/${encodeURIComponent(job.id)}`;
  const hasApplication = Boolean(job.applicationUrl || job.contact);

  const metaBits = [
    !isPlaceholder(job.location) ? job.location : null,
    !isPlaceholder(job.mode) ? job.mode : null,
    !isPlaceholder(job.type) ? job.type : null,
    job.salary && !isPlaceholder(job.salary) ? job.salary : null,
  ].filter(Boolean) as string[];

  return (
    <Link
      className={`job-card${compact ? " job-card-compact" : ""}`}
      href={href}
    >
      <div className="job-card-main">
        <div className="job-card-head">
          <span className={`platform-chip platform-chip-${job.platform.toLowerCase()}`}>
            <PlatformIcon platform={job.platform} size={compact ? 14 : 15} />
            <span>{platformLabel}</span>
          </span>
          <time className="job-card-time" dateTime={job.updatedAt}>
            {job.updatedRelativeTime}
          </time>
        </div>

        <h3>{job.title}</h3>
        <p className="job-summary">{job.excerpt}</p>

        <div className="job-company-row">
          <span className="company-avatar" aria-hidden="true">
            {company.slice(0, 1).toUpperCase()}
          </span>
          <div className="job-company-text">
            <strong>{company}</strong>
            {metaBits.length > 0 && (
              <span className="job-meta-line">
                {metaBits.map((bit, index) => (
                  <MetaItem key={`${bit}-${index}`}>{bit}</MetaItem>
                ))}
              </span>
            )}
          </div>
        </div>

        {!compact && (
          <div className="job-card-footer">
            <div className="job-tags">
              <span className="tag tag-accent">{job.tags[0]}</span>
              {job.skills.slice(0, 3).map((skill) => (
                <span className="tag" key={skill}>
                  {skill}
                </span>
              ))}
              {job.mode && !isPlaceholder(job.mode) && !job.skills.includes(job.mode) && (
                <span className="tag">{job.mode}</span>
              )}
            </div>
            <div className="job-actions">
              <JobEngagement comments={job.comments} likes={job.likes} />
              {hasApplication && <span className="application-ready">可投递</span>}
              <span className="job-link">
                详情 <b aria-hidden="true">→</b>
              </span>
            </div>
          </div>
        )}

        {compact && (
          <div className="job-card-footer job-card-footer-compact">
            <div className="job-tags">
              <span className="tag tag-accent">{job.tags[0]}</span>
              {job.skills.slice(0, 1).map((skill) => (
                <span className="tag" key={skill}>
                  {skill}
                </span>
              ))}
            </div>
            <JobEngagement comments={job.comments} likes={job.likes} />
          </div>
        )}
      </div>
    </Link>
  );
}
