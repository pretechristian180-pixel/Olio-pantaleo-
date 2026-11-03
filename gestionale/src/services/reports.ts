/**
 * Report PDF ai proprietari. Lettura con RLS (titolare o chi segue l'immobile); il PDF lo crea e lo invia
 * la Edge Function "report-proprietari", che restituisce solo link firmati a tempo.
 */
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { OwnerReport, PortalNumbers, PreparedReport } from "@/types/reports";
import { emitChange } from "./events";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as SupabaseClient<any>;
/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

function ok<T>(res: { data: T; error: PostgrestError | null }): NonNullable<T> {
  if (res.error) throw res.error;
  return res.data as NonNullable<T>;
}

async function chiama<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T & { error?: string }>("report-proprietari", { body });
  if (data && (data as { error?: string }).error) throw new Error((data as { error?: string }).error);
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const msg = ctx && typeof ctx.json === "function" ? await ctx.json().then((j: { error?: string }) => j.error).catch(() => null) : null;
    throw new Error(msg ?? "Il report non è stato creato. Riprova tra poco.");
  }
  return data as T;
}

export async function listReports(propertyId: string): Promise<OwnerReport[]> {
  const rows = ok(
    await db
      .from("owner_reports")
      .select("id, created_at, periodo_dal, periodo_al, stato, canale_invio, inviato_at, aperto_at, aperture, origine, dati->visite_periodo, dati->richieste_compatibili")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(20),
  ) as Row[];
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    from: r.periodo_dal,
    to: r.periodo_al,
    state: r.stato,
    sentVia: r.canale_invio,
    sentAt: r.inviato_at,
    openedAt: r.aperto_at,
    opens: r.aperture,
    origin: r.origine,
    visits: Number(r.visite_periodo ?? 0),
    matches: Number(r.richieste_compatibili ?? 0),
  }));
}

export async function prepareReport(propertyId: string, comment: string, portals: PortalNumbers): Promise<PreparedReport> {
  const out = await chiama<PreparedReport>({ azione: "prepara", property_id: propertyId, commento: comment, portali: portals });
  emitChange();
  return out;
}

export const reportLinks = (id: string) => chiama<{ pdf: string | null; link: string }>({ azione: "link", id });

export async function emailReport(id: string): Promise<string> {
  const out = await chiama<{ a: string }>({ azione: "invia_email", id });
  emitChange();
  return out.a;
}

/** Inviato dall'agente su WhatsApp (dal suo telefono): lo segniamo nello storico */
export async function markReportSent(id: string, channel: "whatsapp" | "email") {
  ok(await db.rpc("report_segna_inviato", { p_report: id, p_canale: channel }));
  emitChange();
}

/** Pagina pubblica del proprietario */
export const openPublicReport = (token: string) =>
  chiama<{ url: string; agenzia: string; indirizzo: string; dal: string; al: string }>({ azione: "apri", t: token });
