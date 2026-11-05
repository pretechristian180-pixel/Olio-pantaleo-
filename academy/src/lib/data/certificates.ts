import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { CertificateData } from "@/lib/certificate-pdf";

const CODICE = /^NX-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/;

/** Dati pubblici di un attestato dal suo codice (null se il codice non esiste). */
export const getCertificate = cache(async (codice: string): Promise<CertificateData | null> => {
  const c = codice.trim().toUpperCase();
  if (!CODICE.test(c)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("certificate_details", { p_codice: c });
  return ((data as CertificateData[] | null) ?? [])[0] ?? null;
});
