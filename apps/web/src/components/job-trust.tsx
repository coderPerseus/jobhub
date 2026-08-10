import type { Job } from "../lib/jobs";

type TrustTone = "verified" | "partial" | "neutral" | "caution";

type TrustPresentation = {
  description: string;
  label: string;
  tone: TrustTone;
};

function getTrustPresentation(job: Job): TrustPresentation | null {
  if (!job.credibilitySignal && !job.factualVerificationStatus) return null;

  if (job.factualVerificationStatus === "verified") {
    return {
      label: "已核实",
      description: "公司或发布者已找到公开信息支持。",
      tone: "verified",
    };
  }

  if (job.factualVerificationStatus === "partially_verified") {
    return {
      label: "部分核实",
      description: "部分主体信息获得公开来源支持，岗位细节仍需确认。",
      tone: "partial",
    };
  }

  if (
    job.factualVerificationStatus === "conflicting" ||
    job.credibilitySignal === "negative" ||
    job.shouldPublish === false
  ) {
    return {
      label: "建议谨慎",
      description: "AI 审核发现缺少可核验证据或存在风险信号。",
      tone: "caution",
    };
  }

  if (job.factualVerificationStatus === "not_applicable" && job.credibilitySignal === "positive") {
    return {
      label: "初审通过",
      description: "内容初审未发现明显风险，但未进行外部事实核验。",
      tone: "partial",
    };
  }

  return {
    label: "待核实",
    description: "暂未获得足够的公开证据，请自行确认招聘主体和岗位细节。",
    tone: "neutral",
  };
}

export function JobTrustBadge({ job }: { job: Job }) {
  const trust = getTrustPresentation(job);
  if (!trust) return null;

  return (
    <span
      className={`trust-badge trust-${trust.tone}`}
      title={`AI 信息核验：${trust.label}。${trust.description}`}
    >
      {trust.label}
    </span>
  );
}

export function JobTrustPanel({ job }: { job: Job }) {
  const trust = getTrustPresentation(job);
  if (!trust) return null;

  return (
    <section className={`trust-panel trust-panel-${trust.tone}`} aria-label="AI 信息核验">
      <div className="trust-panel-heading">
        <div>
          <p>AI 信息核验</p>
          <strong>{trust.label}</strong>
        </div>
        <span className={`trust-badge trust-${trust.tone}`}>{trust.label}</span>
      </div>
      <p className="trust-panel-description">{trust.description}</p>
      {job.reviewReason && (
        <details>
          <summary>查看核验说明</summary>
          <p>{job.reviewReason}</p>
        </details>
      )}
      <small>AI 判断仅供参考，投递前请核实岗位、薪资和对方身份。</small>
    </section>
  );
}
