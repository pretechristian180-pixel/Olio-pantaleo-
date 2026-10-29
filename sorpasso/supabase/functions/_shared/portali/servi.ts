/**
 * Handler HTTP comune a tutti i connettori (stessa interfaccia per ogni Edge Function portale-*).
 *   POST { operazione: "publish"|"update"|"suspend"|"remove"|"stats", listing_id }   header x-sync-secret
 *     → { ok: true, esito } | { ok: false, messaggio, definitivo }
 *   POST { operazione: "anteprima", listing_id }  → { ok: true, payload } (nessuna chiamata al portale)
 *   GET                                           → { id, nome, api_attiva } (pubblico: serve alle Impostazioni)
 * Lo chiama solo la coda sync-portali (segreto condiviso SYNC_SECRET).
 */
import { clientServizio, corsHeaders, json } from "../http.ts";
import { caricaAnnuncio } from "./annuncio.ts";
import { ErrorePortale, type Connettore, type ContestoConnettore } from "./tipi.ts";

const OPERAZIONI = { publish: "publish", update: "update", suspend: "suspend", remove: "remove", stats: "getStats" } as const;

export function verificaSegreto(req: Request) {
  const atteso = Deno.env.get("SYNC_SECRET");
  return !!atteso && req.headers.get("x-sync-secret") === atteso;
}

export async function eseguiOperazione(
  connettore: Connettore,
  operazione: string,
  listingId: string,
  anteprima?: (a: Awaited<ReturnType<typeof caricaAnnuncio>>, ctx: ContestoConnettore) => unknown,
) {
  const sb = clientServizio();
  const annuncio = await caricaAnnuncio(sb, listingId);
  const { data: op } = await sb
    .from("organization_portals")
    .select("organization_id, config")
    .eq("portal_id", annuncio.portal_id)
    .eq("organization_id", (await sb.from("vehicle_listings").select("organization_id").eq("id", listingId).single()).data!.organization_id)
    .single();
  const { data: credenziali } = await sb.rpc("credenziali_portale", { p_org: op!.organization_id, p_portale: annuncio.portal_id });
  const ctx: ContestoConnettore = { organization_id: op!.organization_id, credenziali: credenziali ?? null, config: op!.config ?? {} };

  if (operazione === "anteprima") return { payload: anteprima ? anteprima(annuncio, ctx) : annuncio };
  const metodo = OPERAZIONI[operazione as keyof typeof OPERAZIONI];
  if (!metodo) throw new ErrorePortale("Operazione non valida", true);
  return { esito: await connettore[metodo](ctx, annuncio) };
}

export function serviConnettore(connettore: Connettore, anteprima?: Parameters<typeof eseguiOperazione>[3]) {
  return async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method === "GET") return json({ id: connettore.id, nome: connettore.nome, api_attiva: connettore.apiAttiva?.() ?? false });
    if (req.method !== "POST") return json({ error: "Metodo non consentito" }, 405);
    if (!verificaSegreto(req)) return json({ error: "Non autorizzato" }, 401);
    try {
      const { operazione, listing_id } = await req.json();
      return json({ ok: true, ...(await eseguiOperazione(connettore, operazione, listing_id, anteprima)) });
    } catch (e) {
      if (e instanceof ErrorePortale) return json({ ok: false, messaggio: e.message, definitivo: e.definitivo });
      const motivo = e instanceof DOMException && e.name === "TimeoutError" ? `${connettore.nome} non ha risposto in tempo.` : `Errore imprevisto nel connettore ${connettore.nome}.`;
      console.error(`[connettore ${connettore.id}]`, e instanceof Error ? e.name : typeof e);
      return json({ ok: false, messaggio: motivo, definitivo: false });
    }
  };
}
