# folk-job

Cloudflare 上运行的全栈 monorepo：

- `apps/web`：Next.js 16，通过 `@opennextjs/cloudflare` 构建并部署到 Cloudflare Workers。
- `apps/api`：Hono API，部署到独立的 Cloudflare Worker。
- `packages/contracts`：前后端共享的 oRPC contract-first 契约。

## 本地开发

要求 Node.js 22+ 和 Corepack。

```bash
corepack enable
pnpm install
pnpm dev
```

- Web：http://localhost:3000
- API：http://localhost:8787
- API health：http://localhost:8787/health
- oRPC endpoint：http://localhost:8787/rpc

前端默认调用 `http://localhost:8787`。需要修改时，复制环境变量示例：

```bash
cp apps/web/.env.example apps/web/.env.local
```

## 校验

```bash
pnpm typecheck
pnpm test
pnpm build
```

`pnpm build` 会先构建共享契约、API，再执行 Next.js build。若要验证 OpenNext 产物：

```bash
pnpm --filter @folk-job/web run build:cloudflare
pnpm --filter @folk-job/api exec wrangler deploy --dry-run
```

## Cloudflare 部署

先登录并生成绑定类型：

```bash
pnpm --filter @folk-job/api exec wrangler login
pnpm cf:typegen
```

API 和 Web 分开部署：

```bash
pnpm deploy:api
pnpm deploy:web
```

也可以一次部署两个服务：

```bash
pnpm deploy
```

当前线上地址：

- Web：https://folk-job-web.snailrun160.workers.dev
- API：https://folk-job-api.snailrun160.workers.dev

Web 部署脚本已经设置生产 API 地址。当前 API 骨架允许跨域访问；加入登录态后，应在 `apps/api/src/index.ts` 中收紧 CORS origin。

Worker 名称、自定义域名和环境绑定在对应应用的 `wrangler.jsonc` 中维护。密钥使用 `wrangler secret put`，不要写入仓库。
