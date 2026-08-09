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
      const payload = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "出了点问题，请稍后再试");
      setMessage(payload.message || (isConfirm ? "订阅成功，有新机会会通知你" : "已退订，不会再收到邮件"));
      setStatus("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "出了点问题，请稍后再试");
      setStatus("error");
    }
  };

  return (
    <div className="subscription-action-card">
      <span aria-hidden="true">{isConfirm ? "✉" : "✓"}</span>
      <p className="section-label">邮件提醒</p>
      <h1>{isConfirm ? "确认订阅" : "退订提醒"}</h1>
      <p>
        {isConfirm
          ? "确认后，有符合你方向的新岗位时，我们会发邮件告诉你。"
          : "退订后，你不会再收到 jobhub 的岗位更新邮件。"}
      </p>
      {status === "success" ? (
        <>
          <div className="subscription-result success">{message}</div>
          <Link className="button-primary" href="/jobs">
            去看看机会 →
          </Link>
        </>
      ) : (
        <>
          <button disabled={status === "loading" || !token} onClick={submit} type="button">
            {status === "loading" ? "处理中…" : isConfirm ? "确认订阅" : "确认退订"}
          </button>
          {status === "error" && (
            <div className="subscription-result error" role="alert">
              {message}
            </div>
          )}
        </>
      )}
    </div>
  );
}
