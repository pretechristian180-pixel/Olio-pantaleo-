import type { ProviderCost, SocialPlatform } from "../domain.js";

export interface ConnectedAccount {
  platform: SocialPlatform;
  handle: string | null;
  providerAccountId: string | null;
}

export interface PublishRequest {
  /** Riferimento del "brand" presso il fornitore (Metricool: blogId). */
  brandRef: string;
  platforms: SocialPlatform[];
  /** URL (firmato, valido almeno 24 h) del video finale e della copertina. */
  videoUrl: string;
  thumbnailUrl?: string | null;
  caption: string;
  hashtags: string[];
  /** Titolo breve (YouTube/Facebook). */
  title: string;
  publishAt: Date;
  timezone: string;
}

export type PostNetworkStatus = "pending" | "published" | "failed";

export interface PublishStatus {
  networks: { platform: SocialPlatform; status: PostNetworkStatus; url?: string | null; error?: string | null }[];
}

export interface PublishingProvider {
  readonly name: string;
  /** Social collegati al brand. */
  listAccounts(brandRef: string): Promise<ConnectedAccount[]>;
  /** Programma il post presso il fornitore (pubblicazione automatica all'orario). */
  schedule(request: PublishRequest): Promise<{ providerPostId: string; cost?: ProviderCost }>;
  status(brandRef: string, providerPostId: string, publishAt: Date, timezone: string): Promise<PublishStatus>;
  cancel(brandRef: string, providerPostId: string): Promise<void>;
}

/** Testo del post: didascalia + hashtag. */
export function postText(caption: string, hashtags: string[]) {
  const tags = hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ");
  return [caption.trim(), tags].filter(Boolean).join("\n\n");
}
