import { publicEnv } from "@/lib/env";
import { cookieDomainFor } from "@/lib/tenant-host";

/** Opzioni dei cookie Supabase: sul dominio della piattaforma valgono per tutte le academy. */
export function cookieOptionsFor(host: string | null | undefined) {
  const domain = cookieDomainFor(
    host,
    publicEnv.NEXT_PUBLIC_ROOT_DOMAIN,
    publicEnv.NEXT_PUBLIC_LEGACY_ROOT_DOMAINS,
  );
  return domain ? { domain } : {};
}
