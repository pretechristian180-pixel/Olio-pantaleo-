/**
 * Worker della coda di pubblicazione (tabella sync_jobs). Pubblicare con --no-verify-jwt.
 * Lo chiamano:
 *   - pg_cron ogni minuto (header x-sync-secret = SYNC_SECRET);
 *   - l'app subito dopo "Pubblica ovunque" (utente titolare/responsabile), per non aspettare il minuto.
 * Prende i job pronti, li raggruppa per portale ed esegue i portali IN PARALLELO (un portale lento o in errore
 * non blocca gli altri), ognuno chiamando la Edge Function del proprio connettore con un timeout.
 * Errori: retry con backoff esponenziale gestito da fallisci_job_sync; all'ultimo tentativo notifica ai manager.
 */
import { clientServizio, clientUtente, corsHeaders, gestisciErrore, json, profiloCorrente, ErroreUtente } from "../_shared/http.ts";
import { PORTALI_CON_API } from "../_shared/portali/connettori/index.ts";
import { verificaSegreto } from "../_shared/portali/servi.ts";

interface Job {
  job_id: string;
  listing_id: string;
  operazione: "publish" | "update" | "suspend" | "remove" | "stats";
  tentativi: number;
  organization_id: string;
  portal_id: string;
  modalita: "api" | "feed" | "manuale";
  vehicle_id: string;
}

const TIMEOUT_CONNETTORE_MS = 30_000;
const DURATA_MAX_MS = 45_000;

function funzioneConnettore(j: Job): string | null {
  if (j.modalita === "feed") return "portale-feed";
  if (j.modalita === "manuale") return "portale-manuale";
  return PORTALI_CON_API.has(j.portal_id) ? `portale-${j.portal_id}` : null;
}

async function esegui(sb: ReturnType<typeof clientServizio>, j: Job) {
  const funzione = funzioneConnettore(j);
  if (!funzione) {
    await sb.rpc("fallisci_job_sync", { p_job: j.job_id, p_messaggio: "Per questo portale non c'è un collegamento via API: usa il feed o la modalità manuale.", p_definitivo: true });
    return;
  }
  try {
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/${funzione}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sync-secret": Deno.env.get("SYNC_SECRET") ?? "",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ operazione: j.operazione, listing_id: j.listing_id }),
      signal: AbortSignal.timeout(TIMEOUT_CONNETTORE_MS),
    });
    const r = await res.json().catch(() => null);
    if (!res.ok || !r) {
      await sb.rpc("fallisci_job_sync", { p_job: j.job_id, p_messaggio: `Connettore non raggiungibile (errore ${res.status}). Riproviamo in automatico.`, p_definitivo: false });
      return;
    }
    if (!r.ok) {
      await sb.rpc("fallisci_job_sync", { p_job: j.job_id, p_messaggio: r.messaggio, p_definitivo: !!r.definitivo });
      return;
    }
    await sb.rpc("completa_job_sync", { p_job: j.job_id, p_esito: r.esito ?? {} });

    // Azioni manuali urgenti (auto venduta o prenotata): avvisa i manager
    const azione = r.esito?.azione_manuale;
    if (azione === "rimuovi" || azione === "sospendi") {
      const [{ data: p }, { data: v }, { data: dest }] = await Promise.all([
        sb.from("portals").select("nome").eq("id", j.portal_id).single(),
        sb.from("vehicles").select("marca, modello").eq("id", j.vehicle_id).single(),
        sb.from("profiles").select("user_id").eq("organization_id", j.organization_id).eq("attivo", true).in("ruolo", ["titolare", "responsabile_vendite"]),
      ]);
      await sb.from("notifications").insert((dest ?? []).map((d) => ({
        organization_id: j.organization_id,
        user_id: d.user_id,
        tipo: "pubblicazione_manuale",
        titolo: azione === "rimuovi" ? `Togli a mano l'annuncio da ${p?.nome}` : `Segna come prenotata su ${p?.nome}`,
        testo: `${v?.marca} ${v?.modello}: ${azione === "rimuovi" ? "l'auto è venduta" : "l'auto è prenotata"}. Poi conferma in Sorpasso.`,
        link: `/stock/${j.vehicle_id}?tab=pubblicazione`,
      })));
    }
  } catch (e) {
    const timeout = e instanceof DOMException && e.name === "TimeoutError";
    await sb.rpc("fallisci_job_sync", {
      p_job: j.job_id,
      p_messaggio: timeout ? "Il portale non ha risposto in tempo. Riproviamo in automatico." : "Errore di rete verso il portale. Riproviamo in automatico.",
      p_definitivo: false,
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Metodo non consentito" }, 405);
  try {
    if (!verificaSegreto(req)) {
      const profilo = await profiloCorrente(clientUtente(req));
      if (profilo.ruolo !== "titolare" && profilo.ruolo !== "responsabile_vendite") throw new ErroreUtente("Non autorizzato", 403);
    }
    const sb = clientServizio();
    const inizio = Date.now();
    let eseguiti = 0;
    while (Date.now() - inizio < DURATA_MAX_MS) {
      const { data, error } = await sb.rpc("prendi_job_sync", { p_limite: 30, p_per_portale: 10 });
      if (error) throw error;
      const jobs = (data ?? []) as Job[];
      if (!jobs.length) break;
      const perPortale = new Map<string, Job[]>();
      for (const j of jobs) perPortale.set(j.portal_id, [...(perPortale.get(j.portal_id) ?? []), j]);
      // Portali in parallelo, job dello stesso portale in sequenza (rispetta i limiti del portale)
      await Promise.allSettled([...perPortale.values()].map(async (lista) => {
        for (const j of lista) await esegui(sb, j);
      }));
      eseguiti += jobs.length;
    }
    return json({ eseguiti });
  } catch (e) {
    return gestisciErrore(e, "sync-portali");
  }
});
