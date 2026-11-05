import type { SocialPlatform } from "../domain.js";
import { LLMError } from "./llm.js";
import {
  type ConnectedAccount,
  type PostNetworkStatus,
  postText,
  type PublishingProvider,
  type PublishRequest,
  type PublishStatus,
} from "./publishing.js";

const BASE = "https://app.metricool.com/api";

/** Data locale "YYYY-MM-DDTHH:mm:ss" nel fuso indicato (formato richiesto da Metricool). */
export function localDateTime(date: Date, timeZone: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour === "24" ? "00" : p.hour}:${p.minute}:${p.second}`;
}

/** Dati specifici per rete: tutti i video escono come Reel/Short. */
export function networkData(platforms: SocialPlatform[], title: string) {
  const data: Record<string, unknown> = {};
  for (const p of platforms) {
    if (p === "instagram") data.instagramData = { type: "REEL", showReelOnFeed: true };
    if (p === "facebook") data.facebookData = { type: "REEL", title };
    if (p === "tiktok") data.tiktokData = { privacyOption: "PUBLIC_TO_EVERYONE", title };
    if (p === "youtube") data.youtubeData = { title: title.slice(0, 100), type: "short", privacy: "public", madeForKids: false };
    if (p === "linkedin") data.linkedinData = { type: "post", previewIncluded: true };
  }
  return data;
}

/** Il corpo del post per POST /v2/scheduler/posts (separato per i test). */
export function buildMetricoolPost(req: PublishRequest) {
  return {
    publicationDate: { dateTime: localDateTime(req.publishAt, req.timezone), timezone: req.timezone },
    text: postText(req.caption, req.hashtags),
    providers: req.platforms.map((network) => ({ network })),
    media: [req.videoUrl],
    autoPublish: true,
    draft: false,
    shortener: false,
    firstCommentText: "",
    descendants: [],
    ...networkData(req.platforms, req.title),
  };
}

const NETWORK_KEYS: Record<SocialPlatform, string[]> = {
  instagram: ["instagram", "instagramBusiness"],
  facebook: ["facebook", "facebookPageId"],
  tiktok: ["tiktok", "tiktokBusiness"],
  youtube: ["youtube", "youtubeChannelName"],
  linkedin: ["linkedinCompany", "linkedin"],
};

/**
 * PublishingProvider su Metricool (API REST: header X-Mc-Auth, parametri userId e blogId).
 * Un brand Metricool per azienda. La lettura delle risposte è difensiva: va verificata con il
 * primo token reale (vedi docs/METRICOOL.md).
 */
export class MetricoolProvider implements PublishingProvider {
  readonly name = "metricool";
  constructor(
    private readonly token: string,
    private readonly userId: string,
  ) {}

  private async call<T>(method: string, path: string, params: Record<string, string>, body?: unknown): Promise<T> {
    const url = new URL(`${BASE}${path}`);
    for (const [k, v] of Object.entries({ userId: this.userId, ...params })) url.searchParams.set(k, v);
    const res = await fetch(url, {
      method,
      headers: { "X-Mc-Auth": this.token, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const retryable = res.status === 429 || res.status >= 500;
      throw new LLMError(`Metricool ${method} ${path}: ${res.status} ${text.slice(0, 300)}`, "provider_error", retryable);
    }
    const ct = res.headers.get("content-type") ?? "";
    return (ct.includes("json") ? await res.json() : await res.text()) as T;
  }

  async listAccounts(brandRef: string): Promise<ConnectedAccount[]> {
    const data = await this.call<unknown>("GET", "/admin/simpleProfiles", {});
    const brands = (Array.isArray(data) ? data : ((data as { data?: unknown[] })?.data ?? [])) as Record<string, unknown>[];
    const brand = brands.find((b) => String(b.id ?? b.blogId) === brandRef);
    if (!brand) return [];
    const out: ConnectedAccount[] = [];
    for (const [platform, keys] of Object.entries(NETWORK_KEYS) as [SocialPlatform, string[]][]) {
      const value = keys.map((k) => brand[k]).find((v) => typeof v === "string" && v.trim());
      if (value) out.push({ platform, handle: String(value), providerAccountId: String(value) });
    }
    return out;
  }

  async schedule(req: PublishRequest) {
    const res = await this.call<Record<string, unknown>>("POST", "/v2/scheduler/posts", { blogId: req.brandRef }, buildMetricoolPost(req));
    const data = (res?.data ?? res) as Record<string, unknown>;
    const id = data?.id ?? data?.uuid;
    if (!id) throw new LLMError("Metricool: risposta senza id del post", "provider_error", false);
    return { providerPostId: String(id), cost: { provider: "metricool", costUsd: 0, units: { posts: 1 } } };
  }

  async status(brandRef: string, providerPostId: string, publishAt: Date, timezone: string): Promise<PublishStatus> {
    const from = new Date(publishAt.getTime() - 24 * 3600e3);
    const to = new Date(publishAt.getTime() + 24 * 3600e3);
    const res = await this.call<Record<string, unknown>>("GET", "/v2/scheduler/posts", {
      blogId: brandRef,
      start: localDateTime(from, timezone),
      end: localDateTime(to, timezone),
      timezone,
      extendedRange: "true",
    });
    const posts = ((res?.data ?? res) as Record<string, unknown>[]) ?? [];
    const post = Array.isArray(posts) ? posts.find((p) => String(p.id) === providerPostId || String(p.uuid) === providerPostId) : null;
    if (!post) return { networks: [] };
    const providers = (post.providers as Record<string, unknown>[] | undefined) ?? [];
    return {
      networks: providers.map((p) => {
        const raw = String(p.status ?? p.detailedStatus ?? "").toUpperCase();
        const status: PostNetworkStatus = /PUBLISHED|SUCCESS|DONE/.test(raw) ? "published" : /ERROR|FAIL/.test(raw) ? "failed" : "pending";
        return {
          platform: String(p.network) as SocialPlatform,
          status,
          url: (p.publicUrl as string) ?? null,
          error: status === "failed" ? String(p.detailedStatus ?? p.error ?? raw) : null,
        };
      }),
    };
  }

  async cancel(brandRef: string, providerPostId: string) {
    await this.call("DELETE", `/v2/scheduler/posts/${encodeURIComponent(providerPostId)}`, { blogId: brandRef });
  }
}

/**
 * Pubblicazione dimostrativa (sviluppo e test): accetta tutto e risulta "pubblicato"
 * dopo l'orario previsto. I social "collegati" sono Instagram, Facebook e TikTok.
 */
export class DemoPublishingProvider implements PublishingProvider {
  readonly name = "demo";
  async listAccounts(brandRef: string): Promise<ConnectedAccount[]> {
    return (["instagram", "facebook", "tiktok"] as SocialPlatform[]).map((platform) => ({
      platform,
      handle: `${brandRef}_${platform}`,
      providerAccountId: `${brandRef}:${platform}`,
    }));
  }
  async schedule(req: PublishRequest) {
    return { providerPostId: `demo-${req.publishAt.getTime()}-${req.platforms.join("-")}` };
  }
  async status(_brand: string, providerPostId: string, publishAt: Date): Promise<PublishStatus> {
    const platforms = providerPostId.split("-").slice(2) as SocialPlatform[];
    const done = Date.now() >= publishAt.getTime();
    return {
      networks: platforms.map((platform) => ({
        platform,
        status: done ? "published" : "pending",
        url: done ? `https://example.com/${platform}/${providerPostId}` : null,
      })),
    };
  }
  async cancel() {}
}

export function createPublishingProvider(env: Record<string, string | undefined> = process.env): PublishingProvider | null {
  const kind = env.PUBLISHING_PROVIDER ?? "metricool";
  if (kind === "demo") {
    if (env.NODE_ENV === "production" && env.ALLOW_DEMO_PROVIDERS !== "true") {
      throw new Error("PUBLISHING_PROVIDER=demo non è ammesso in produzione");
    }
    return new DemoPublishingProvider();
  }
  if (!env.METRICOOL_API_TOKEN || !env.METRICOOL_USER_ID) return null;
  return new MetricoolProvider(env.METRICOOL_API_TOKEN, env.METRICOOL_USER_ID);
}
