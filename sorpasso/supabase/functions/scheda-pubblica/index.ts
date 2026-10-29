/**
 * Pagina pubblica della scheda auto (nessun login). Da pubblicare con --no-verify-jwt.
 *   GET  ?t=<token_pubblico>  → dati dell'auto senza informazioni interne, foto (URL firmati 1 ora), contatti del salone
 *   POST { t, azione: "whatsapp" | "test_drive", nome, telefono, data_preferita?, messaggio?, consenso_privacy, sito? }
 *        → crea contatto + lead collegato all'auto (assegnato con il round robin) e restituisce il link WhatsApp del salone
 * Usa la chiave di servizio, quindi seleziona esplicitamente SOLO i campi pubblicabili.
 */
import { ErroreUtente, clientServizio, corsHeaders, gestisciErrore, json } from "../_shared/http.ts";

const CAMPI_PUBBLICI = [
  "id", "organization_id", "marca", "modello", "versione", "allestimento", "carrozzeria", "porte", "posti", "anno",
  "mese_immatricolazione", "km", "alimentazione", "cilindrata", "potenza_kw", "cambio", "trazione", "classe_euro",
  "consumo_misto", "emissioni_co2", "colore", "colore_interni", "numero_proprietari", "tagliandi_certificati", "tipo",
  "garanzia_mesi", "garanzia_tipo", "neopatentati", "optional", "optional_extra", "descrizione", "prezzo_vendita",
  "stato", "pubblica",
].join(", ");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TELEFONO = /^\+?[\d\s./-]{6,20}$/;

async function leggiAuto(token: unknown) {
  if (typeof token !== "string" || !UUID.test(token)) throw new ErroreUtente("Scheda non trovata", 404);
  const sb = clientServizio();
  const { data } = await sb.from("vehicles").select(CAMPI_PUBBLICI).eq("token_pubblico", token).maybeSingle();
  // deno-lint-ignore no-explicit-any
  const v = data as unknown as Record<string, any> | null;
  if (!v || !v.pubblica) throw new ErroreUtente("Scheda non trovata o non più pubblicata", 404);
  const { data: org } = await sb
    .from("organizations")
    .select("nome, logo_url, telefono, whatsapp, indirizzo, comune, tempo_max_risposta_min")
    .eq("id", v.organization_id)
    .single();
  return { sb, v, org: org! };
}

const normalizza = (tel: string) => {
  let n = tel.replace(/[^\d+]/g, "");
  if (n.startsWith("+")) n = n.slice(1);
  else if (n.startsWith("00")) n = n.slice(2);
  else if (!n.startsWith("39") || n.length <= 10) n = `39${n}`;
  return n;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (req.method === "GET") {
      const { sb, v, org } = await leggiAuto(new URL(req.url).searchParams.get("t"));
      const { data: foto } = await sb.from("vehicle_photos").select("storage_path").eq("vehicle_id", v.id).order("ordine").limit(50);
      const paths = (foto ?? []).map((f) => f.storage_path);
      const firmati = paths.length ? (await sb.storage.from("vehicle-photos").createSignedUrls(paths, 3600)).data ?? [] : [];
      const { organization_id: _o, pubblica: _p, ...auto } = v;
      const { tempo_max_risposta_min: _t, ...salone } = org;
      return json({ auto, salone, foto: firmati.map((f) => f.signedUrl).filter(Boolean) });
    }

    if (req.method !== "POST") return json({ error: "Metodo non consentito" }, 405);
    const b = await req.json().catch(() => ({}));
    const { sb, v, org } = await leggiAuto(b.t);
    const auto = `${v.marca} ${v.modello}${v.versione ? ` ${v.versione}` : ""}`;
    const linkWhatsApp = (nome: string) =>
      org.whatsapp || org.telefono
        ? `https://wa.me/${normalizza(org.whatsapp || org.telefono)}?text=${encodeURIComponent(`Buongiorno, sono ${nome}. Vi scrivo per la ${auto} che ho visto online.`)}`
        : null;

    // Campo trappola per i bot: se compilato fingiamo che sia andato tutto bene.
    if (typeof b.sito === "string" && b.sito.trim()) return json({ ok: true, whatsapp: null });

    const nome = typeof b.nome === "string" ? b.nome.trim().slice(0, 80) : "";
    const telefono = typeof b.telefono === "string" ? b.telefono.trim() : "";
    if (!nome) throw new ErroreUtente("Inserisci il tuo nome");
    if (!TELEFONO.test(telefono)) throw new ErroreUtente("Numero di telefono non valido");
    if (b.consenso_privacy !== true) throw new ErroreUtente("Serve il consenso al trattamento dei dati per essere ricontattato");
    if (b.azione !== "whatsapp" && b.azione !== "test_drive") throw new ErroreUtente("Richiesta non valida");
    if (v.stato === "venduto") throw new ErroreUtente("Questa auto è già stata venduta. Contatta il salone per alternative simili.");

    // Contatto: riusa quello con lo stesso numero, se esiste
    const cifre = telefono.replace(/\D/g, "").slice(-9);
    const { data: simili } = await sb
      .from("contacts").select("id, telefono").eq("organization_id", v.organization_id).ilike("telefono", `%${cifre.slice(-6)}%`).limit(10);
    let contactId = (simili ?? []).find((c) => (c.telefono ?? "").replace(/\D/g, "").endsWith(cifre))?.id as string | undefined;

    if (contactId) {
      // Limite anti-abuso: massimo 3 richieste in 10 minuti dallo stesso numero
      const { count } = await sb.from("leads").select("id", { count: "exact", head: true })
        .eq("contact_id", contactId).gte("created_at", new Date(Date.now() - 10 * 60_000).toISOString());
      if ((count ?? 0) >= 3) throw new ErroreUtente("Abbiamo già ricevuto la tua richiesta: ti ricontatteremo a breve.", 429);
    } else {
      const [primo, ...resto] = nome.split(/\s+/);
      const { data: c, error } = await sb.from("contacts").insert({
        organization_id: v.organization_id, nome: primo, cognome: resto.join(" "), telefono,
        consenso_privacy: true, fonte: "sito",
      }).select("id").single();
      if (error) throw error;
      contactId = c.id;
    }

    const data = typeof b.data_preferita === "string" && !Number.isNaN(Date.parse(b.data_preferita)) ? new Date(b.data_preferita) : null;
    const messaggio = typeof b.messaggio === "string" ? b.messaggio.trim().slice(0, 1000) : "";
    const richiesta = [
      b.azione === "test_drive" ? "Prenotazione test drive dalla scheda online" : "Contatto WhatsApp dalla scheda online",
      data && `Data preferita: ${data.toLocaleString("it-IT", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Rome" })}`,
      messaggio && `Messaggio: ${messaggio}`,
    ].filter(Boolean).join("\n");

    const { data: lead, error: errLead } = await sb.from("leads").insert({
      organization_id: v.organization_id, contact_id: contactId, vehicle_id: v.id, fonte: "sito", richiesta,
      tempistica: b.azione === "test_drive" ? "subito" : "non_definita",
      prossima_azione_at: new Date(Date.now() + org.tempo_max_risposta_min * 60_000).toISOString(),
      prossima_azione_nota: b.azione === "test_drive" ? "Confermare il test drive richiesto online" : "Rispondere al cliente (scheda online)",
    }).select("id").single();
    if (errLead) throw errLead;

    await sb.from("automations_log").insert({
      organization_id: v.organization_id, tipo: "lead_da_scheda_pubblica", entita: "lead", entita_id: lead.id,
      dettagli: { azione: b.azione, vehicle_id: v.id },
    });
    return json({ ok: true, whatsapp: b.azione === "whatsapp" ? linkWhatsApp(nome) : null });
  } catch (e) {
    return gestisciErrore(e, "scheda-pubblica");
  }
});
