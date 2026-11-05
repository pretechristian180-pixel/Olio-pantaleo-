import type { ProviderCost, SocialPlatform } from "../domain.js";

export interface ConnectedAccount {
  providerAccountId: string;
  platform: SocialPlatform;
  handle: string;
  status: "connected" | "expired" | "error";
}

export interface PublishRequest {
  providerAccountId: string;
  platform: SocialPlatform;
  /** URL firmato del video finale. */
  videoUrl: string;
  thumbnailUrl?: string;
  caption: string;
  hashtags: string[];
  /** ISO 8601. Se assente il provider pubblica subito. */
  scheduledAt?: string;
}

export interface PublishResult {
  providerPostId: string;
  status: "scheduled" | "published";
  cost?: ProviderCost;
}

export interface PublishingProvider {
  readonly name: string;
  /** Link o flusso con cui l'azienda collega un account social. */
  getConnectUrl(workspaceId: string, platform: SocialPlatform): Promise<string>;
  listAccounts(workspaceId: string): Promise<ConnectedAccount[]>;
  publish(request: PublishRequest): Promise<PublishResult>;
  cancel(providerPostId: string): Promise<void>;
}
