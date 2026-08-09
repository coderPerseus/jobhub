# jobhub

> 从公开社交网络中发现、去重并结构化互联网工作机会。

[在线体验](https://jobhub.islumi.com) · [职位列表](https://jobhub.islumi.com/jobs) · [API 健康检查](https://folk-job-api.snailrun160.workers.dev/health)

jobhub 聚合小红书与 X 上公开发布的招聘帖子，将散落在信息流中的公司、岗位、地点、薪资、招聘对象和投递方式提取成可检索的职位数据。项目运行在 Cloudflare Workers 上，前后端由 pnpm monorepo 管理。

## 功能

- 抓取小红书与 X 的公开招聘信息
- 保存搜索和详情接口的原始响应，便于审计与重新解析
- 按平台帖子 ID 去重，避免重复请求详情
- AI 提取公司、岗位、地点、薪资、经验、技能和投递方式
- 内容哈希与断点续跑，未变化的帖子不会重复调用 AI
- 过滤非互联网岗位、行业观点、个人求职和面试经验内容
- 支持关键词、岗位分类、来源平台、时间范围、热度排序和分页
- 支持按岗位订阅邮件提醒，新机会入库后发送去重摘要
- 独立职位详情页与来源原帖跳转
- Sitemap、robots.txt、Open Graph、canonical 和 JobPosting JSON-LD

## 技术栈

| 模块 | 技术 |
| --- | --- |
| Web | Next.js 16、React 19、OpenNext for Cloudflare |
| API | Hono、Cloudflare Workers |
| 契约 | oRPC contract-first |
| 数据库 | Cloudflare D1 / SQLite |
| 数据源 | TikHub API |
| 包管理 | pnpm workspace |
| 部署 | Wrangler、Cloudflare Custom Domains |

## 项目结构

```text
apps/
  api/                 Hono Worker、D1 migrations、抓取与结构化脚本
  web/                 Next.js 应用与 OpenNext Cloudflare 配置
packages/
  contracts/           前后端共享的 oRPC 契约
docs/
  research/            数据源调研记录
  design/              产品设计参考
```

## 本地开发

需要 Node.js 22+、Corepack 和已登录的 Wrangler。

```bash
corepack enable
pnpm install
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.dev.vars.example apps/api/.dev.vars
pnpm dev
```

- Web：<http://localhost:3000>
- API：<http://localhost:8787>
- Health：<http://localhost:8787/health>
- oRPC：<http://localhost:8787/rpc>

## 环境变量

| 名称 | 用途 | 存储方式 |
| --- | --- | --- |
| `TIKHUB_API_KEY` | TikHub 搜索与详情接口 | Worker Secret / `.dev.vars` |
| `INGEST_TOKEN` | 管理端数据写入鉴权 | Worker Secret / `.dev.vars` |
| `NEW_API_KEY` | OpenAI-compatible 结构化模型 | Worker Secret / `.ai.vars` |
| `NEW_API_BASE_URL` | Chat Completions endpoint | Wrangler vars / `.ai.vars` |
| `NEXT_PUBLIC_API_URL` | Web 调用的 API 地址 | Web 环境变量 |

本地密钥文件已经加入 `.gitignore`。不要把密钥、抓取响应或生产数据库导出提交到仓库。

## 数据库

应用远程 D1 migration：

```bash
pnpm --filter @folk-job/api exec wrangler d1 migrations apply folk-job --remote
```

主要数据表：

- `jobs`：归一化后的帖子与互动数据
- `crawl_batches`：每次搜索请求及原始响应
- `job_detail_fetches`：帖子详情原始响应
- `crawl_runs` / `crawl_run_states`：分页、游标和断点状态
- `job_structured_details`：AI 提取的结构化职位字段
- `email_subscriptions`：邮箱、订阅状态与关注岗位
- `email_notification_deliveries` / `email_notification_jobs`：邮件发送记录与岗位级去重

## 数据任务

```bash
# 抓取最近一周的互联网岗位并同步详情
pnpm --filter @folk-job/api run crawl:internet-week

# 为未处理或正文发生变化的职位提取结构化字段
pnpm --filter @folk-job/api run structure:jobs

# 抓取、结构化并通知订阅者
pnpm --filter @folk-job/api run update:jobs

# 预览非互联网岗位清理结果；确认后再执行删除
pnpm --filter @folk-job/api run prune:non-internet
APPLY=1 pnpm --filter @folk-job/api run prune:non-internet
```

结构化任务支持 `LIMIT`、`AI_BATCH_SIZE`、`CONCURRENCY` 和 `FORCE=1`。默认只处理未完成、字段版本过旧或正文哈希变化的数据。

## 校验

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @folk-job/web run build:cloudflare
pnpm --filter @folk-job/api exec wrangler deploy --dry-run
```

## 部署

```bash
pnpm exec wrangler whoami
pnpm cf:typegen
pnpm deploy
```

生产环境：

- Web：<https://jobhub.islumi.com>
- API：<https://folk-job-api.snailrun160.workers.dev>

自定义域名、D1、service binding 和普通变量定义在各应用的 `wrangler.jsonc`。敏感变量通过 `wrangler secret put <NAME>` 写入 Cloudflare。

## 数据说明

jobhub 只聚合公开发布的信息，并保留来源链接。结构化字段由模型从原帖提取，可能存在遗漏或误差；联系或投递前请回到来源平台核实岗位、薪资和发布者身份。平台名称与商标归各自权利人所有。
