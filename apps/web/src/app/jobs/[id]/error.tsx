"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function JobDetailError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="not-found-page">
      <span>!</span>
      <h1>加载失败了</h1>
      <p>网络或服务暂时出了点问题，再试一次吧。</p>
      <div className="error-actions">
        <button className="button-primary" onClick={() => retry()} type="button">
          重新加载
        </button>
        <Link href="/jobs">返回列表</Link>
      </div>
    </main>
  );
}
