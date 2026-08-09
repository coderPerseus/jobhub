"use client";

import Link from "next/link";
import { useState } from "react";

export function SubscriptionAction({ action, token }: { action: "confirm" | "unsubscribe"; token: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const isConfirm = action === "confirm";

  const submit = async () => {
    setStatus("loading");
    try {
      const response = await fetch(`/api/subscriptions/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const payload = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "操作失败，请稍后重试");
      setMessage(payload.message || (isConfirm ? "订阅已确认" : "邮件提醒已退订"));
      setStatus("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败，请稍后重试");
      setStatus("error");
    }
  };

  return (
    <div className="subscription-action-card">
      <span aria-hidden="true">{isConfirm ? "✉" : "✓"}</span>
      <p className="section-label">jobhub 邮件提醒</p>
      <h1>{isConfirm ? "确认订阅岗位提醒" : "退订岗位提醒"}</h1>
      <p>{isConfirm ? "确认后，当你关注的岗位出现新机会时，我们会发送邮件通知。" : "确认退订后，你将不再收到 jobhub 的岗位更新邮件。"}</p>
      {status === "success" ? (
        <><div className="subscription-result success">{message}</div><Link className="button-primary" href="/jobs">查看最新机会 →</Link></>
      ) : (
        <>
          <button disabled={status === "loading" || !token} onClick={submit} type="button">
            {status === "loading" ? "正在处理…" : isConfirm ? "确认订阅" : "确认退订"}
          </button>
          {status === "error" && <div className="subscription-result error" role="alert">{message}</div>}
        </>
      )}
    </div>
  );
}
