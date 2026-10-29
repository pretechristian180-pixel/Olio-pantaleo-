/**
 * Connettore "Feed XML/CSV" + distribuzione del feed + URL stabili delle foto.
 * Da pubblicare con --no-verify-jwt (i portali scaricano il feed senza login).
 *
 *   POST (coda, header x-sync-secret)        operazioni del connettore (vedi _shared/portali/servi.ts)
 *   GET  ?t=<feed_token>[&formato=xml|csv]   feed privato della concessionaria per quel portale
 *   GET  /foto/<token_pubblico>/<n>.jpg      reindirizza alla foto n (1 = copertina) con un URL firmato fresco
 */
import { clientServizio, corsHeaders } from "../_shared/http.ts";
import { caricaAnnuncio } from "../_shared/portali/annuncio.ts";
import { connettoreFeed } from "../_shared/portali/connettori/index.ts";
import { feedCsv, feedMetaCsv, feedXml } from "../_shared/portali/formatiFeed.ts";
import { serviConnettore } from "../_shared/portali/servi.ts";
import type { AnnuncioVeicolo } from "../_shared/portali/tipi.ts";

const operazioni = serviConnettore(connettoreFeed);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const testo = (corpo: string, status = 200, tipo = "text/plain; charset=utf-8", extra: Record<string, string> = {}) =>
  new Response(corpo, { status, headers: { ...corsHeaders, "Content-Type": tipo, ...extra } });

async function foto(token: string, n: number) {
  if (!UUID.test(token) || !Number.isInteger(n) || n < 1 || n > 50) return testo("Non trovata", 404);
  const sb = clientServizio();
  const { data: v } = await sb.from("vehicles").select("id, pubblica").eq("token_pubblico", token).maybeSingle();
  if (!v) return testo("Non trovata", 404);
  // Foto servite solo per auto pubblicate su almeno un portale o con la pagina pubblica attiva
  const { count } = await sb.from("vehicle_listings").select("id", { count: "exact", head: true })
    .eq("vehicle_id", v.id).neq("stato", "rimosso");
  if (!v.pubblica && !count) return testo("Non trovata", 404);
  const { data: f } = await sb.from("vehicle_photos").select("storage_path").eq("vehicle_id", v.id)
    .order("ordine").order("created_at").range(n - 1, n - 1).maybeSingle();
  if (!f) return testo("Non trovata", 404);
  const { data: firmato } = await sb.storage.from("vehicle-photos").createSignedUrl(f.storage_path, 3600);
  if (!firmato?.signedUrl) return testo("Non disponibile", 503);
  return new Response(null, { status: 302, headers: { ...corsHeaders, Location: firmato.signedUrl, "Cache-Control": "public, max-age=1800" } });
}

async function feed(token: string | null, formato: string | null) {
  if (!token || !UUID.test(token)) return testo("Feed non trovato", 404);
  const sb = clientServizio();
  const { data: op } = await sb.from("organization_portals")
    .select("organization_id, portal_id, attivo, modalita").eq("feed_token", token).maybeSingle();
  if (!op || !op.attivo || op.modalita !== "feed") return testo("Feed non attivo", 404);

  const { data: listings } = await sb.from("vehicle_listings").select("id")
    .eq("organization_id", op.organization_id).eq("portal_id", op.portal_id).eq("attivo", true).eq("stato", "pubblicato");
  const annunci: AnnuncioVeicolo[] = [];
  for (const l of listings ?? []) {
    try {
      annunci.push(await caricaAnnuncio(sb, l.id));
    } catch {
      // un'auto con dati incompleti non deve far fallire tutto il feed
    }
  }
  const { data: salone } = await sb.from("organizations").select("nome, telefono, whatsapp, email, indirizzo, comune").eq("id", op.organization_id).single();
  await sb.from("organization_portals").update({ ultimo_controllo_at: new Date().toISOString(), stato_connessione: "attivo" })
    .eq("feed_token", token);

  const cache = { "Cache-Control": "no-store" };
  if (op.portal_id === "meta" && formato !== "xml") return testo(feedMetaCsv(annunci), 200, "text/csv; charset=utf-8", cache);
  if (formato === "csv") return testo(feedCsv(annunci, op.portal_id), 200, "text/csv; charset=utf-8", cache);
  return testo(feedXml(annunci, op.portal_id, salone!), 200, "application/xml; charset=utf-8", cache);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const percorso = url.pathname.replace(/^\/(functions\/v1\/)?portale-feed/, "");
  try {
    const m = percorso.match(/^\/foto\/([^/]+)\/(\d+)(?:\.jpg)?$/);
    if (req.method === "GET" && m) return await foto(m[1]!, Number(m[2]));
    if (req.method === "GET") return await feed(url.searchParams.get("t"), url.searchParams.get("formato"));
    return await operazioni(req);
  } catch (e) {
    console.error("[portale-feed] errore", e instanceof Error ? e.name : typeof e);
    return testo("Errore temporaneo", 500);
  }
});
