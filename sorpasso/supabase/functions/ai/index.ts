/**
 * Funzioni AI di Sorpasso:
 *   { azione: "descrizione_annuncio", vehicle_id }
 *   { azione: "suggerisci_risposta", lead_id, canale: "whatsapp" | "email" }
 *   { azione: "riassunto_lead", lead_id }
 *
 * I dati vengono letti con il client dell'utente: se l'utente non può vedere il lead
 * o l'auto (RLS), la richiesta fallisce. La chiave ANTHROPIC_API_KEY vive solo nei secrets.
 * I prompt sono in ../_shared/prompts.ts.
 */
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import {
  ErroreUtente,
  clientServizio,
  clientUtente,
  corsHeaders,
  gestisciErrore,
  json,
  profiloCorrente,
} from "../_shared/http.ts";
import {
  type DatiLead,
  promptDescrizioneAnnuncio,
  promptRiassuntoLead,
  promptSuggerisciRisposta,
} from "../_shared/prompts.ts";

const MODELLO = Deno.env.get("AI_MODEL") ?? "claude-opus-5-5";
const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

const ETICHETTE: Record<string, string> = {
  nuovo: "nuovo, mai contattato",
  contattato: "contattato",
  qualificato: "qualificato",
  test_drive: "test drive",
  preventivo: "preventivo inviato",
  trattativa: "trattativa in corso",
  vinto: "venduto",
  perso: "perso",
  subito: "subito",
  entro_1_mese: "entro un mese",
  entro_3_mesi: "entro tre mesi",
  oltre: "oltre tre mesi",
  non_definita: "non definita",
  cambio_stato: "cambio fase",
};

const dataIt = (iso: string) =>
  new Date(iso).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Rome" });

async function genera(prompt: { system: string; user: string }, maxTokens: number) {
  const risposta = await anthropic.beta.messages.create({
    model: MODELLO,
    max_tokens: maxTokens,
    // Testi brevi: poco ragionamento basta e risponde più in fretta.
    output_config: { effort: "low" },
    // Se il modello declina la richiesta, l'API riprova in automatico su un modello di riserva.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: prompt.system,
    messages: [{ role: "user", content: prompt.user }],
  });
  if (risposta.stop_reason === "refusal") {
    throw new ErroreUtente("L'AI non è riuscita a generare il testo per questa richiesta. Scrivilo a mano.", 422);
  }
  const testo = risposta.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  if (!testo) throw new ErroreUtente("L'AI non ha restituito testo. Riprova.", 502);
  return testo;
}

async function leggiLead(sb: ReturnType<typeof clientUtente>, leadId: string): Promise<DatiLead> {
  const { data: l, error } = await sb
    .from("leads_view")
    .select("*")
    .eq("id", leadId)
    .maybeSingle();
  if (error || !l) throw new ErroreUtente("Lead non trovato o non accessibile", 404);

  const [{ data: att }, { data: veicolo }] = await Promise.all([
    sb.from("activities").select("tipo, contenuto, created_at").eq("lead_id", leadId)
      .order("created_at", { ascending: false }).limit(15),
    l.vehicle_id
      ? sb.from("vehicles").select("marca, modello, versione, anno, km, alimentazione, cambio, prezzo_vendita, stato")
        .eq("id", l.vehicle_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    cliente: `${l.contatto_nome} ${l.contatto_cognome ?? ""}`.trim(),
    fonte: l.fonte,
    stato: ETICHETTE[l.stato] ?? l.stato,
    richiesta: l.richiesta,
    budget: l.budget,
    permuta: l.permuta,
    permuta_dati: l.permuta_dati,
    finanziamento: l.finanziamento,
    tempistica: ETICHETTE[l.tempistica] ?? l.tempistica,
    prossima_azione: l.prossima_azione_at
      ? `${dataIt(l.prossima_azione_at)}${l.prossima_azione_nota ? ` – ${l.prossima_azione_nota}` : ""}`
      : null,
    veicolo,
    veicolo_venduto: veicolo?.stato === "venduto" && l.stato !== "vinto",
    interesse: [l.marca_interesse, l.modello_interesse].filter(Boolean).join(" ") || null,
    storico: (att ?? []).reverse().map((a) => ({
      data: dataIt(a.created_at),
      tipo: ETICHETTE[a.tipo] ?? a.tipo,
      testo: a.contenuto,
    })),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Metodo non consentito" }, 405);

  const inizio = Date.now();
  let azione = "sconosciuta";
  let orgId: string | null = null;
  try {
    if (!Deno.env.get("ANTHROPIC_API_KEY")) {
      throw new ErroreUtente("Le funzioni AI non sono ancora configurate. Contatta l'amministratore.", 503);
    }
    const body = await req.json().catch(() => ({}));
    azione = String(body.azione ?? "");
    const sb = clientUtente(req);
    const profilo = await profiloCorrente(sb);
    orgId = profilo.organization_id;
    const azienda = profilo.organizations.nome;

    let testo: string;
    switch (azione) {
      case "descrizione_annuncio": {
        if (!body.vehicle_id) throw new ErroreUtente("Auto non indicata");
        const { data: v } = await sb.from("vehicles").select("*").eq("id", body.vehicle_id).maybeSingle();
        if (!v) throw new ErroreUtente("Auto non trovata o non accessibile", 404);
        testo = await genera(promptDescrizioneAnnuncio(v, azienda), 1500);
        break;
      }
      case "suggerisci_risposta": {
        if (!body.lead_id) throw new ErroreUtente("Lead non indicato");
        const canale = body.canale === "email" ? "email" : "whatsapp";
        const lead = await leggiLead(sb, body.lead_id);
        testo = await genera(promptSuggerisciRisposta(lead, canale, profilo.nome, azienda), 1200);
        break;
      }
      case "riassunto_lead": {
        if (!body.lead_id) throw new ErroreUtente("Lead non indicato");
        const lead = await leggiLead(sb, body.lead_id);
        testo = await genera(promptRiassuntoLead(lead), 800);
        break;
      }
      default:
        throw new ErroreUtente("Azione AI non riconosciuta");
    }

    // Log senza contenuti: solo azione, esito e durata.
    await clientServizio().from("automations_log").insert({
      organization_id: orgId,
      tipo: `ai_${azione}`,
      entita: body.vehicle_id ? "vehicle" : "lead",
      entita_id: body.vehicle_id ?? body.lead_id,
      esito: "ok",
      dettagli: { durata_ms: Date.now() - inizio, modello: MODELLO },
    });
    return json({ testo });
  } catch (e) {
    if (orgId) {
      await clientServizio().from("automations_log").insert({
        organization_id: orgId,
        tipo: `ai_${azione}`,
        entita: "ai",
        esito: "errore",
        dettagli: { durata_ms: Date.now() - inizio, errore: e instanceof Error ? e.name : "sconosciuto" },
      }).then(() => {}, () => {});
    }
    if (e instanceof Anthropic.RateLimitError) {
      return json({ error: "L'AI è molto richiesta in questo momento. Riprova tra un minuto." }, 429);
    }
    if (e instanceof Anthropic.APIError) {
      console.error("[ai] errore API", e.status);
      return json({ error: "Il servizio AI non risponde. Riprova tra poco." }, 502);
    }
    return gestisciErrore(e, "ai");
  }
});
