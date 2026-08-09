type JsonObject = Record<string, unknown>;

export type Platform = "XHS" | "X";

export type IngestInput = {
  platform: Platform;
  query: string;
  cursor?: string;
  page?: number;
  searchId?: string;
  searchSessionId?: string;
};

export type NormalizedJob = {
  id: string;
  platform: Platform;
  platformPostId: string;
  title: string;
  body: string;
  excerpt: string;
  authorName: string;
  authorHandle: string | null;
  sourceUrl: string;
  publishedAt: string;
  likes: number;
  comments: number;
  reposts: number;
  views: number;
  imageUrl: string | null;
  contentType: string | null;
};

export type DetailTarget = Pick<NormalizedJob, "platform" | "platformPostId" | "contentType">;

export type JobDetail = {
  title: string | null;
  body: string | null;
  authorName: string | null;
  authorHandle: string | null;
  sourceUrl: string | null;
  publishedAt: string | null;
  likes: number;
  comments: number;
  reposts: number;
  views: number;
  imageUrl: string | null;
};

const TIKHUB_BASE_URL = "https://api.tikhub.io";

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function string(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isoDate(value: unknown): string {
  if (typeof value === "number") {
    const milliseconds = value < 10_000_000_000 ? value * 1000 : value;
    return new Date(milliseconds).toISOString();
  }
  const parsed = new Date(string(value));
  return Number.isNaN(parsed.valueOf()) ? new Date(0).toISOString() : parsed.toISOString();
}

function excerpt(value: string, length = 220): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > length ? `${normalized.slice(0, length - 1)}…` : normalized;
}

function titleFromBody(body: string): string {
  const firstLine = body.split(/\n|[。！？.!?]\s/)[0]?.trim() ?? "";
  return excerpt(firstLine || body, 100) || "招聘机会";
}

function normalizeXhsItem(value: unknown): NormalizedJob | null {
  const item = object(value);
  const note = object(item.note ?? item);
  const postId = string(note.id ?? note.note_id);
  if (!postId) return null;

  const user = object(note.user);
  const body = string(note.desc ?? note.description ?? note.title).trim();
  const token = string(note.xsec_token);
  const images = array(note.images_list ?? note.images);
  const firstImage = object(images[0]);
  const sourceUrl = new URL(`https://www.xiaohongshu.com/explore/${postId}`);
  if (token) sourceUrl.searchParams.set("xsec_token", token);
  sourceUrl.searchParams.set("xsec_source", "pc_search");

  return {
    id: `xhs:${postId}`,
    platform: "XHS",
    platformPostId: postId,
    title: string(note.title).trim() || titleFromBody(body),
    body,
    excerpt: excerpt(body || string(note.title)),
    authorName: string(user.nickname ?? user.nick_name ?? user.name) || "小红书用户",
    authorHandle: string(user.user_id ?? user.id) || null,
    sourceUrl: sourceUrl.toString(),
    publishedAt: isoDate(note.timestamp ?? note.time ?? note.publish_time ?? note.create_time),
    likes: number(note.liked_count ?? note.likes_count ?? note.nice_count),
    comments: number(note.comments_count ?? note.comment_count),
    reposts: number(note.shared_count ?? note.share_count),
    views: number(note.view_count ?? note.views_count),
    imageUrl: string(firstImage.url_size_large ?? firstImage.url ?? firstImage.image_url) || null,
    contentType: string(note.type) || null,
  };
}

function normalizeTweet(value: unknown): NormalizedJob | null {
  const tweet = object(value);
  if (string(tweet.type) && string(tweet.type) !== "tweet") return null;
  const postId = string(tweet.tweet_id ?? tweet.id);
  if (!postId) return null;

  const user = object(tweet.user_info ?? tweet.author);
  const handle = string(tweet.screen_name ?? user.screen_name);
  const body = string(tweet.text ?? tweet.display_text).trim();
  const media = object(tweet.media);
  const photos = array(media.photo ?? media.photos);
  const firstPhoto = object(photos[0]);

  return {
    id: `x:${postId}`,
    platform: "X",
    platformPostId: postId,
    title: titleFromBody(body),
    body,
    excerpt: excerpt(body),
    authorName: string(user.name) || (handle ? `@${handle}` : "X 用户"),
    authorHandle: handle || null,
    sourceUrl: `https://x.com/${handle || "i"}/status/${postId}`,
    publishedAt: isoDate(tweet.created_at ?? tweet.create_time),
    likes: number(tweet.favorites ?? tweet.likes),
    comments: number(tweet.replies ?? tweet.comments),
    reposts: number(tweet.retweets ?? tweet.reposts),
    views: number(tweet.views),
    imageUrl: string(firstPhoto.media_url_https ?? firstPhoto.url) || null,
    contentType: "tweet",
  };
}

export function createDetailRequest(target: DetailTarget): URL {
  if (target.platform === "XHS") {
    const endpoint = target.contentType === "video" ? "get_video_note_detail" : "get_image_note_detail";
    const url = new URL(`/api/v1/xiaohongshu/app_v2/${endpoint}`, TIKHUB_BASE_URL);
    url.searchParams.set("note_id", target.platformPostId);
    return url;
  }

  const url = new URL("/api/v1/twitter/web/fetch_tweet_detail", TIKHUB_BASE_URL);
  url.searchParams.set("tweet_id", target.platformPostId);
  return url;
}

export function parseDetailResponse(platform: Platform, payload: unknown): { detail: JobDetail; providerRequestId: string | null } {
  const root = object(payload);
  if (number(root.code) !== 200) throw new Error(string(root.message_zh ?? root.message) || "TikHub detail request failed");

  if (platform === "XHS") {
    const outer = object(root.data);
    const detailData = object(array(outer.data)[0] ?? outer.data);
    const note = object(array(detailData.note_list)[0] ?? array(outer.note_list)[0] ?? detailData);
    const user = object(note.user);
    const images = array(note.images_list ?? note.images);
    const firstImage = object(images[0]);
    const shareInfo = object(note.share_info);
    return {
      providerRequestId: string(root.request_id) || null,
      detail: {
        title: string(note.title) || null,
        body: string(note.desc ?? note.description) || null,
        authorName: string(user.nickname ?? user.name) || null,
        authorHandle: string(user.user_id ?? user.id) || null,
        sourceUrl: string(shareInfo.link) || null,
        publishedAt: note.time || note.timestamp ? isoDate(note.time ?? note.timestamp) : null,
        likes: number(note.liked_count ?? note.likes_count),
        comments: number(note.comments_count ?? note.comment_count),
        reposts: number(note.shared_count ?? note.share_count),
        views: number(note.view_count ?? note.views_count),
        imageUrl: string(firstImage.url_size_large ?? firstImage.url ?? firstImage.image_url) || null,
      },
    };
  }

  const tweet = object(root.data);
  const author = object(tweet.author ?? tweet.user_info);
  const media = object(tweet.media);
  const photos = array(media.photo ?? media.photos);
  const firstPhoto = object(photos[0]);
  const handle = string(author.screen_name ?? tweet.screen_name);
  const postId = string(tweet.id ?? tweet.tweet_id);
  return {
    providerRequestId: string(root.request_id) || null,
    detail: {
      title: null,
      body: string(tweet.text ?? tweet.display_text) || null,
      authorName: string(author.name) || null,
      authorHandle: handle || null,
      sourceUrl: postId ? `https://x.com/${handle || "i"}/status/${postId}` : null,
      publishedAt: tweet.created_at ? isoDate(tweet.created_at) : null,
      likes: number(tweet.likes ?? tweet.favorites),
      comments: number(tweet.replies ?? tweet.comments),
      reposts: number(tweet.retweets ?? tweet.reposts),
      views: number(tweet.views),
      imageUrl: string(firstPhoto.media_url_https ?? firstPhoto.url) || null,
    },
  };
}

export function createRequest(input: IngestInput): URL {
  if (input.platform === "XHS") {
    const url = new URL("/api/v1/xiaohongshu/app_v2/search_notes", TIKHUB_BASE_URL);
    const params: Record<string, string> = {
      keyword: input.query,
      page: String(input.page ?? 1),
      sort_type: "time_descending",
      note_type: "不限",
      time_filter: "一周内",
      source: "explore_feed",
      ai_mode: "0",
    };
    if (input.searchId) params.search_id = input.searchId;
    if (input.searchSessionId) params.search_session_id = input.searchSessionId;
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return url;
  }

  const url = new URL("/api/v1/twitter/web/fetch_search_timeline", TIKHUB_BASE_URL);
  url.searchParams.set("keyword", input.query);
  url.searchParams.set("search_type", "Latest");
  if (input.cursor) url.searchParams.set("cursor", input.cursor);
  return url;
}

export function parseResponse(platform: Platform, payload: unknown) {
  const root = object(payload);
  const providerData = object(root.data);
  if (number(root.code) !== 200) {
    throw new Error(string(root.message_zh ?? root.message) || "TikHub request failed");
  }

  if (platform === "XHS") {
    const searchData = object(providerData.data);
    const items = array(searchData.items ?? searchData.data);
    return {
      jobs: items.map(normalizeXhsItem).filter((job): job is NormalizedJob => Boolean(job)),
      providerRequestId: string(root.request_id) || null,
      next: {
        page: number(providerData.next_page) || number(providerData.page) + 1,
        searchId: string(providerData.search_id) || null,
        searchSessionId: string(providerData.search_session_id) || null,
      },
    };
  }

  const timeline = array(providerData.timeline);
  return {
    jobs: timeline.map(normalizeTweet).filter((job): job is NormalizedJob => Boolean(job)),
    providerRequestId: string(root.request_id) || null,
    next: { cursor: string(providerData.next_cursor) || null },
  };
}
