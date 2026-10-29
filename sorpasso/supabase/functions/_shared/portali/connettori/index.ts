/** Registro dei connettori. Le Edge Function portale-* espongono ciascuna il proprio. */
export { connettoreFeed } from "./feed.ts";
export { connettoreManuale } from "./manuale.ts";
export { connettoreAutoScout24 } from "./autoscout24.ts";
export { connettoreSubito } from "./subito.ts";

/** Portali con connettore API (Edge Function portale-<id>). Gli altri usano feed o manuale. */
export const PORTALI_CON_API = new Set(["autoscout24", "subito"]);
