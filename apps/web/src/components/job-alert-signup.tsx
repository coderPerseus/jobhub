"use client";

import { useState } from "react";

import { categoryLabels, type JobCategory } from "../lib/jobs";

const categoryOptions = Object.entries(categoryLabels) as [JobCategory, string][];

export function JobAlertSignup({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [categories, setCategories] = useState<JobCategory[]>([]);
  const [status, setStatus] = useState<{ type: "idle" | "loading" | "success" | "error"; message?: string }>({ type: "idle" });

  const toggleCategory = (category: JobCategory) => {
    setCategories((current) => current.includes(category)
      ? current.filter((item) => item !== category)
      : [...current, category]);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (categories.length === 0) {
      setStatus({ type: "error", message: "请至少选择一个关注岗位" });
      return;
    }
    setStatus({ type: "loading" });
    try {
      const response = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, categories }),
      });
      const payload = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "订阅失败，请稍后重试");
      setStatus({ type: "success", message: payload.message || "确认邮件已发送" });
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "订阅失败，请稍后重试" });
    }
  };

  return (
    <form className={`alert-signup${compact ? " alert-signup-compact" : ""}`} onSubmit={submit}>
      <div className="alert-signup-heading">
        <p className="section-label">邮件岗位提醒</p>
        <h2>新机会出现时，直接发到你的邮箱。</h2>
        <p>选择关注岗位。每次发现新机会，我们会告诉你新增数量，并附上最近 5 条岗位。</p>
      </div>
      <fieldset className="alert-categories">
        <legend>关注哪些岗位？</legend>
        <div>
          {categoryOptions.map(([category, label]) => (
            <label className={categories.includes(category) ? "is-selected" : ""} key={category}>
              <input checked={categories.includes(category)} onChange={() => toggleCategory(category)} type="checkbox" />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="alert-email-row">
        <label className="sr-only" htmlFor={compact ? "alert-email-compact" : "alert-email"}>邮箱地址</label>
        <input
          autoComplete="email"
          id={compact ? "alert-email-compact" : "alert-email"}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="你的邮箱地址"
          required
          type="email"
          value={email}
        />
        <button disabled={status.type === "loading"} type="submit">
          {status.type === "loading" ? "正在提交…" : "订阅岗位提醒"}
        </button>
      </div>
      {status.type !== "idle" && status.type !== "loading" && (
        <p aria-live="polite" className={`alert-form-status alert-form-status-${status.type}`}>{status.message}</p>
      )}
      <small>提交后需要前往邮箱确认。你可以随时通过邮件底部链接退订。</small>
    </form>
  );
}
