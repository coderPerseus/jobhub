"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";

const navItems = [
  { href: "/jobs", label: "找工作" },
  { href: "/#alerts", label: "订阅提醒" },
  { href: "/#sources", label: "机会来源" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("nav-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("nav-open");
    };
  }, [open]);

  return (
    <header className={`site-header page-shell${open ? " is-open" : ""}`}>
      <Link className="wordmark" href="/" aria-label="jobhub 首页">
        <img alt="" height="24" src="/brand/jobhub-logo.png" width="24" />
        <span>jobhub</span>
      </Link>

      <nav className="site-nav" aria-label="主导航" id={menuId}>
        {navItems.map((item) => (
          <Link href={item.href} key={item.href} onClick={() => setOpen(false)}>
            {item.label}
          </Link>
        ))}
        <Link className="nav-cta-mobile" href="/jobs" onClick={() => setOpen(false)}>
          找工作 <span aria-hidden="true">↗</span>
        </Link>
      </nav>

      <div className="header-actions">
        <Link className="header-cta" href="/jobs">
          找工作 <span aria-hidden="true">↗</span>
        </Link>
        <button
          aria-controls={menuId}
          aria-expanded={open}
          aria-label={open ? "关闭菜单" : "打开菜单"}
          className="nav-toggle"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          <span className="nav-toggle-bar" />
          <span className="nav-toggle-bar" />
          <span className="nav-toggle-bar" />
        </button>
      </div>

      {open && (
        <button
          aria-label="关闭菜单"
          className="nav-backdrop"
          onClick={() => setOpen(false)}
          type="button"
        />
      )}
    </header>
  );
}
