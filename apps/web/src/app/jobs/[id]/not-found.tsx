import Link from "next/link";

export default function JobNotFound() {
  return <main className="not-found-page"><span>404</span><h1>这个工作机会不存在</h1><p>数据库中没有这条记录，或者链接有误。</p><Link className="button-primary" href="/jobs">返回工作机会</Link></main>;
}
