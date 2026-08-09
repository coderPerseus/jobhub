# TikHub 小红书与 Twitter 增量抓取评估

> 状态：初步结论。已完成官方文档、端点价格和无凭证行为验证；付费响应结构与重复请求扣费差额仍需 API Token 实测。

## 结论

TikHub 可以作为候选数据源，但不能单独满足“永远只返回从未抓过的数据，并且不为重复数据付费”。

它提供了我们需要的搜索能力：

- 小红书支持按时间倒序、筛选一天内发布的笔记，并通过 `search_id`、`search_session_id` 分页。
- Twitter 支持 `Latest` 搜索和 cursor 分页。

它按成功 API 请求计费，而不是按新增帖子计费。两种搜索接口都没有公开的 `exclude_ids`、持久化 `since_id` 或服务端订阅游标。相同的 24 小时窗口、重叠关键词和失败重试都可能再次返回旧帖子，并产生新的请求费用。

因此产品应拆开两个保证：

1. **帖子不重复入库**：我们可以保证。数据库使用 `(platform, platform_post_id)` 唯一约束，并在请求详情、AI 分类等后续付费步骤前检查该键。
2. **不为重复搜索结果付费**：当前接口无法保证。只能通过减少搜索次数、合并关键词、提前停止分页和持久化抓取批次来降低费用。

## 已确认的接口

| 平台 | 接口 | 增量相关参数 | 单次价格 | 折扣 |
| --- | --- | --- | ---: | --- |
| 小红书 | `/api/v1/xiaohongshu/app_v2/search_notes` | `sort_type=time_descending`、`time_filter=一天内`、`page`、`search_id`、`search_session_id` | $0.01 | 不参与折扣 |
| Twitter | `/api/v1/twitter/web/fetch_search_timeline` | `search_type=Latest`、`cursor` | $0.001 | 不参与折扣 |

TikHub 官方价格接口在 2026-08-09 返回以上价格，两个端点均为 TikHub 自营，限速 10 次/秒。

## 已执行的验证

1. 调用两个端点的 `get_endpoint_info`，均返回 200，并确认价格、折扣和限速。
2. 不携带 Token 调用两个搜索端点，均返回 401，证明接口需要 Bearer Token。
3. 官方说明响应代码不是 200 时不扣费，因此上述 401 探测不应产生费用。
4. 当前仓库和进程环境中没有 `TIKHUB_API_KEY`，因此没有执行会扣费的搜索请求。

## 建议的生产抓取模型

每天建立一个逻辑抓取任务，但每个平台、关键词和页码分别记录抓取切片：

```text
crawl_run
  id, window_start, window_end, status

crawl_slice
  run_id, platform, query, cursor, status, request_id, cost

raw_fetch_batch
  slice_id, provider_request_id, response_payload, fetched_at

job_post
  platform, platform_post_id, published_at, source_query, first_seen_at
  UNIQUE(platform, platform_post_id)
```

处理顺序：

1. 创建 `crawl_run` 和待执行的 `crawl_slice`。
2. 调用 TikHub 后，先原样保存整批响应和 provider `request_id`。
3. 从原始批次提取稳定帖子 ID 和发布时间。
4. 只对数据库中不存在的 `(platform, platform_post_id)` 执行正文详情、分类和入库。
5. 分页时遇到整页已知数据，或发布时间早于窗口起点，即停止继续请求。

为了覆盖平台索引延迟，可以搜索最近 26 小时，最终通过稳定 ID 去重。严格只查 24 小时虽然费用略低，但可能漏掉延迟进入搜索索引的帖子。

## 初始查询建议

小红书不应一开始铺太多近义词。先测试以下四个词的交集与召回率：

- 招聘
- 招人
- 工作机会
- 内推

Twitter 优先测试单个组合查询，减少请求次数：

```text
("we're hiring" OR "we are hiring" OR "job opening" OR "hiring")
```

TikHub 文档没有承诺支持 Twitter 高级搜索操作符，必须用真实 Token 验证组合查询和 `since:` 是否透传。

## 费用基线

如果每天运行一次，每个关键词只取一页：

- 4 个小红书关键词：`4 × $0.01 = $0.04/天`
- 1 个 Twitter 组合查询：`1 × $0.001 = $0.001/天`
- 合计：`$0.041/天`，约 `$1.23/30天`

每多抓一页，费用按相同请求数继续增加。若改为每小时执行，以上基线约为 `$29.52/30天`。

## 获得 Token 后的最小付费测试

将 Token 放到本地 `apps/api/.dev.vars`：

```dotenv
TIKHUB_API_KEY=...
```

不要把 Token 提交到仓库。测试只执行以下请求：

1. 记录测试前余额和当日用量。
2. 小红书用“招聘”执行一次第一页搜索，参数为最新排序、一天内。
3. 原参数立即再执行一次，比较帖子 ID、`request_id`、缓存字段和余额差额。
4. 用返回的搜索会话参数抓第二页，检查页间重复和发布时间字段。
5. Twitter 用 `Latest` 执行一次组合查询，再原参数重复一次。
6. Twitter 使用 cursor 抓第二页，检查页间重复。
7. 记录测试后余额，确认每种成功请求的实际扣费。

通过标准：

- 返回稳定帖子 ID、发布时间、作者、正文摘要和可访问 URL。
- 小红书一天内筛选与发布时间一致。
- Twitter `Latest` 结果能在客户端准确筛到 24 小时。
- 分页游标稳定，重复率可量化。
- 扣费与端点价格一致，没有未说明的详情接口依赖。

## 风险

- TikHub 自述为非官方 API，服务条款按现状提供，不保证不中断或数据完整。
- 平台抓取与内容展示需要另外核查小红书、Twitter 的平台条款、版权、个人信息和数据保留要求。
- 搜索召回率不能仅凭接口存在来判断，必须用一组人工标注帖子评估漏抓率与误报率。

## 官方资料

- [小红书搜索笔记](https://docs.tikhub.io/420136398e0)
- [Twitter 搜索](https://docs.tikhub.io/215701673e0)
- [获取端点价格信息](https://docs.tikhub.io/186826054e0)
- [TikHub 价格说明](https://docs.tikhub.io/4579905m0)
- [TikHub 用户使用条款](https://docs.tikhub.io/5508541m0)
