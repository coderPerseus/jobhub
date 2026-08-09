import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header page-shell">
      <Link className="wordmark" href="/" aria-label="jobhub 首页"><img alt="" height="36" src="/brand/jobhub-logo.png" width="36" /><span>jobhub</span></Link>
      <nav aria-label="主导航">
        <Link href="/jobs">最新机会</Link>
        <Link href="/#sources">平台来源</Link>
        <Link href="/#about">关于我们</Link>
      </nav>
      <Link className="header-cta" href="/jobs">查找机会 <span>↗</span></Link>
    </header>
  );
}
