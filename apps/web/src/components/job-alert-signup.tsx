"use client";

import { useState } from "react";

import { categoryLabels, type JobCategory } from "../lib/jobs";

const categoryOptions = Object.entries(categoryLabels) as [JobCategory, string][];

export function JobAlertSignup({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [categories, setCategories] = useState<JobCategory[]>([]);
  const [status, setStatus] = useState<{ type: "idle" | "loading" | "success" | "error"; message?: string }>({
    type: "idle",
  });

  const toggleCategory = (category: JobCategory) => {
    setCategories((current) =>
      current.includes(category) ? current.filter((item) => item !== category) : [...current, category],
    );
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (categories.length === 0) {
      setStatus({ type: "error", message: "请先选择你想关注的岗位方向" });
      return;
    }
    setStatus({ type: "loading" });
    try {
      const response = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, categories }),
      });
      const payload = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "订阅失败，请稍后再试");
      setStatus({ type: "success", message: payload.message || "确认邮件已发送，请查收邮箱" });
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "订阅失败，请稍后再试" });
    }
  };

  return (
    <form className={`alert-signup${compact ? " alert-signup-compact" : ""}`} onSubmit={submit}>
      <div className="alert-signup-heading">
        <p className="section-label">免费订阅</p>
        <h2>有适合你的新机会，发到邮箱。</h2>
        <p>选好想关注的方向，有新岗位时我们会第一时间通知你。</p>
      </div>
      <fieldset className="alert-categories">
        <legend>你在找什么方向？</legend>
        <div>
          {categoryOptions.map(([category, label]) => (
            <label className={categories.includes(category) ? "is-selected" : ""} key={category}>
              <input
                checked={categories.includes(category)}
                onChange={() => toggleCategory(category)}
                type="checkbox"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="alert-email-row">
        <label className="sr-only" htmlFor={compact ? "alert-email-compact" : "alert-email"}>
          邮箱地址
        </label>
        <input
          autoComplete="email"
          id={compact ? "alert-email-compact" : "alert-email"}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="你的邮箱"
          required
          type="email"
          value={email}
        />
        <button disabled={status.type === "loading"} type="submit">
          {status.type === "loading" ? "提交中…" : "订阅提醒"}
        </button>
      </div>
      {status.type !== "idle" && status.type !== "loading" && (
        <p aria-live="polite" className={`alert-form-status alert-form-status-${status.type}`}>
          {status.message}
        </p>
      )}
      <small>需要点开邮件确认一下。随时可以退订。</small>
    </form>
  );
}
