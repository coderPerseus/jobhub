import Link from "next/link";

import { PlatformIcon } from "../../components/platform-icon";
import { categoryLabels, type Job } from "../../lib/jobs";

function useful(value: string | null | undefined) {
  return value && !/待确认|未说明|查看原帖|在线投递/.test(value) ? value : null;
}

export function JobTable({ jobs }: { jobs: Job[] }) {
  return (
    <div className="job-table-wrap">
      <table className="job-table">
        <thead>
          <tr>
            <th>岗位</th>
            <th>公司 / 来源</th>
            <th>工作地点</th>
            <th>职位类型</th>
            <th>发布时间</th>
            <th><span className="sr-only">操作</span></th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => {
            const company = job.companyName || job.author;
            const location = useful(job.location) || "地点待确认";
            const type = useful(job.type);
            const mode = useful(job.mode);
            const href = `/jobs/${encodeURIComponent(job.id)}`;

            return (
              <tr key={job.id}>
                <td className="job-table-position">
                  <Link href={href}>{job.title}</Link>
                  <div className="job-table-position-meta">
                    <span>{categoryLabels[job.category]}</span>
                    {job.salary && useful(job.salary) && <span>{job.salary}</span>}
                  </div>
                </td>
                <td className="job-table-company" data-label="公司 / 来源">
                  <span className="job-table-avatar" aria-hidden="true">
                    {company.slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    <strong>{company}</strong>
                    <small>
                      <PlatformIcon platform={job.platform} size={13} />
                      {job.platform === "XHS" ? "小红书" : "X"}
                    </small>
                  </span>
                </td>
                <td className="job-table-location" data-label="地点" title={location}>{location}</td>
                <td className="job-table-type" data-label="类型">
                  {type && <span>{type}</span>}
                  {mode && mode !== type && <small>{mode}</small>}
                  {!type && !mode && <span className="job-table-muted">待确认</span>}
                </td>
                <td className="job-table-time" data-label="发布">
                  <time dateTime={job.publishedAt}>{job.relativeTime}</time>
                </td>
                <td className="job-table-action">
                  <Link href={href} aria-label={`查看 ${job.title} 的详情`}>
                    查看详情 <span aria-hidden="true">→</span>
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
