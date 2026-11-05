import "server-only";

import { createClient } from "@/lib/supabase/server";

/** URL firmato a scadenza per un file privato (mai URL pubblici). */
export async function signedUrl(
  bucket: "brand" | "raw" | "output",
  path: string | null | undefined,
  expiresIn = 60 * 60,
) {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}
