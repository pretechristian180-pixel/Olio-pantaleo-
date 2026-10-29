/**
 * Decodifica targa/telaio con il provider scelto dalla concessionaria.
 *   POST { targa?: string, telaio?: string }  → { dati: DatiDecodificati | null, provider }
 *   POST { elenco: true }                     → { provider: [{ id, nome, descrizione, configurato, ... }] }
 * Se il provider è "nessuno" o non trova nulla, il form si compila a mano.
 */
import { ErroreUtente, clientServizio, clientUtente, corsHeaders, gestisciErrore, json, profiloCorrente } from "../_shared/http.ts";
import { PROVIDER, trovaProvider } from "../_shared/decoder/index.ts";

const TARGA = /^[A-Z]{2}\d{3}[A-Z]{2}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Metodo non consentito" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const sb = clientUtente(req);
    const profilo = await profiloCorrente(sb);

    if (body.elenco) {
      return json({
        provider: PROVIDER.map((p) => ({
          id: p.id, nome: p.nome, descrizione: p.descrizione,
          supportaTarga: p.supportaTarga, supportaTelaio: p.supportaTelaio, configurato: p.configurato(),
        })),
      });
    }

    const targa = typeof body.targa === "string" ? body.targa.toUpperCase().replace(/[\s-]/g, "") : undefined;
    const telaio = typeof body.telaio === "string" ? body.telaio.toUpperCase().replace(/\s/g, "") : undefined;
    if (!targa && !telaio) throw new ErroreUtente("Inserisci la targa o il numero di telaio");
    if (targa && !TARGA.test(targa)) throw new ErroreUtente("Targa non valida (formato AB123CD)");

    const { data: org } = await sb.from("organizations").select("decoder_provider").eq("id", profilo.organization_id).single();
    const provider = trovaProvider(org?.decoder_provider);
    if (!provider) return json({ dati: null, provider: null, messaggio: "Nessun servizio di decodifica attivo: compila i campi a mano." });
    if (!provider.configurato()) return json({ dati: null, provider: provider.id, messaggio: "Il servizio di decodifica non è configurato. Compila i campi a mano." });
    if ((targa && !provider.supportaTarga && !telaio) || (telaio && !provider.supportaTelaio && !targa)) {
      return json({ dati: null, provider: provider.id, messaggio: targa ? "Il servizio attivo riconosce solo il numero di telaio." : "Il servizio attivo riconosce solo la targa." });
    }

    let dati = null;
    let esito: "ok" | "saltato" | "errore" = "ok";
    try {
      dati = await provider.decodifica({ targa: provider.supportaTarga ? targa : undefined, telaio: provider.supportaTelaio ? telaio : undefined });
      if (!dati || Object.keys(dati).length === 0) esito = "saltato";
    } catch (e) {
      esito = "errore";
      console.error("[decodifica-veicolo] provider", provider.id, e instanceof Error ? e.message : "errore");
    }
    // Log senza targa/telaio
    await clientServizio().from("automations_log").insert({
      organization_id: profilo.organization_id, tipo: "decodifica_veicolo", entita: "vehicle", esito,
      dettagli: { provider: provider.id, campi: dati ? Object.keys(dati).length : 0 },
    });
    if (esito === "errore") throw new ErroreUtente("Il servizio di decodifica non risponde. Compila i campi a mano.", 502);
    return json({
      dati,
      provider: provider.id,
      messaggio: dati && Object.keys(dati).length > 1 ? undefined : "Dati non trovati: completa i campi a mano.",
    });
  } catch (e) {
    return gestisciErrore(e, "decodifica-veicolo");
  }
});
