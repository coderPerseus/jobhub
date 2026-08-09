import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header page-shell">
      <Link className="wordmark" href="/" aria-label="jobhub 首页">
        <img alt="" height="32" src="/brand/jobhub-logo.png" width="32" />
        <span>jobhub</span>
      </Link>
      <nav aria-label="主导航">
        <Link href="/jobs">找工作</Link>
        <Link href="/#alerts">订阅提醒</Link>
        <Link href="/#sources">机会来源</Link>
      </nav>
      <Link className="header-cta" href="/jobs">
        开始找工作 <span aria-hidden="true">↗</span>
      </Link>
    </header>
  );
}
