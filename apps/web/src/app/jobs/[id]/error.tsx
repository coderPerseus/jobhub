"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function JobDetailError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="not-found-page">
      <span>!</span>
      <h1>详情加载失败</h1>
      <p>数据仍然保留在系统中，请重试加载。</p>
      <div className="error-actions">
        <button className="button-primary" onClick={() => retry()} type="button">重新加载</button>
        <Link href="/jobs">返回工作机会</Link>
      </div>
    </main>
  );
}
