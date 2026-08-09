import Link from "next/link";

export default function JobNotFound() {
  return (
    <main className="not-found-page">
      <span>404</span>
      <h1>这个机会不存在了</h1>
      <p>链接可能失效，或者岗位已下线。</p>
      <Link className="button-primary" href="/jobs">
        看看其他机会
      </Link>
    </main>
  );
}
