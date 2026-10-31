// Importazione guidata:
//  - { azione: "mappa", tipo, intestazioni, esempi } (titolare collegato): l'AI propone quale colonna del file
//    va in quale campo di Mattonio. Riceve solo le intestazioni e al massimo 3 righe di esempio.
//    Senza ANTHROPIC_API_KEY risponde 501 e l'app usa i suoi abbinamenti automatici.
//  - { azione: "pulizia" } (pg_cron, con il segreto nel Vault): cancella i file caricati da più di 30 giorni.
import Anthropic from "npm:@anthropic-ai/sdk@0.134.0";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const CAMPI: Record<string, Record<string, string>> = {
  contatti: {
    nome: "nome", cognome: "cognome", nome_completo: "nome e cognome insieme (prima il nome)", cognome_nome: "cognome e nome insieme (prima il cognome)",
    telefono: "telefono o cellulare", email: "email", tipo: "tipo di cliente (acquirente, venditore…)", fonte: "provenienza del contatto",
    temperatura: "interesse/priorità", data_nascita: "data di nascita", etichette: "etichette o categorie", note: "note",
  },
  richieste: {
    contatto_telefono: "telefono del cliente", contatto_email: "email del cliente", contatto_nome: "nome del cliente", contratto: "vendita o affitto",
    zone: "zone o quartieri cercati", budget_min: "budget minimo", budget_max: "budget massimo", mq_min: "metri quadri minimi",
    locali_min: "locali minimi", tipo_immobile: "tipologia cercata", note: "note",
  },
  immobili: {
    titolo: "titolo dell'annuncio", indirizzo: "indirizzo", citta: "città o comune", zona: "zona o quartiere", prezzo: "prezzo", mq: "metri quadri",
    locali: "numero di locali", bagni: "numero di bagni", tipo_immobile: "tipologia", contratto: "vendita o affitto", stato: "stato (disponibile, venduto…)",
    descrizione: "descrizione", piano: "piano", classe_energetica: "classe energetica", data_incarico: "data inizio incarico",
    scadenza_incarico: "scadenza incarico", proprietario_nome: "nome del proprietario", proprietario_telefono: "telefono del proprietario",
    proprietario_email: "email del proprietario",
  },
  acquisizioni: {
    indirizzo: "indirizzo", citta: "città", zona: "zona", tipo_immobile: "tipologia", mq: "metri quadri", prezzo_richiesto: "prezzo chiesto dal proprietario",
    prezzo_valutato: "nostra valutazione", fonte: "come è arrivata la segnalazione", fase: "fase", proprietario_nome: "nome del proprietario",
    proprietario_telefono: "telefono del proprietario", note: "note",
  },
  appuntamenti: {
    data: "data", ora: "ora", data_ora: "data e ora insieme", durata_minuti: "durata in minuti", tipo: "tipo di appuntamento",
    contatto_telefono: "telefono del cliente", contatto_email: "email del cliente", contatto_nome: "nome del cliente",
    immobile_indirizzo: "indirizzo dell'immobile", note: "note",
  },
};

const uguali = (a: string, b: string) => a.length === b.length && [...a].reduce((d, ch, i) => d | (ch.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Metodo non consentito" });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  let body: any;
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: "Richiesta non valida" });
  }

  // ----- Pulizia (pg_cron) -----
  if (body.azione === "pulizia") {
    const { data: segreto } = await db.rpc("app_secret", { p_name: "automazioni_cron_secret" });
    if (!segreto || !uguali(req.headers.get("x-automazioni-cron") ?? "", String(segreto))) return reply(401, { error: "Non autorizzato" });
    const { data: nomi } = await db.rpc("import_cleanup");
    const lista = ((nomi ?? []) as string[]).filter(Boolean);
    for (let i = 0; i < lista.length; i += 100) await db.storage.from("imports").remove(lista.slice(i, i + 100));
    return reply(200, { ok: true, file_eliminati: lista.length });
  }

  // ----- Abbinamento colonne con l'AI (solo titolare) -----
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await db.auth.getUser(token);
  if (!auth?.user) return reply(401, { error: "Sessione scaduta: accedi di nuovo." });
  const { data: prof } = await db.from("profiles").select("ruolo, attivo").eq("id", auth.user.id).maybeSingle();
  if (!prof?.attivo || prof.ruolo !== "titolare") return reply(403, { error: "Solo il titolare può importare." });

  const campi = CAMPI[String(body.tipo)];
  if (!campi) return reply(400, { error: "Tipo non valido" });
  const intestazioni = (Array.isArray(body.intestazioni) ? body.intestazioni : []).map((h: unknown) => String(h).slice(0, 80)).slice(0, 60);
  const esempi = (Array.isArray(body.esempi) ? body.esempi : []).slice(0, 3).map((r: unknown[]) => (Array.isArray(r) ? r : []).map((v) => String(v ?? "").slice(0, 60)));
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return reply(501, { error: "AI non configurata" });

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      // @ts-ignore: parametro beta del server (fallback automatico in caso di rifiuto)
      fallbacks: "default",
      output_config: {
        effort: "low",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["abbinamenti"],
            properties: {
              abbinamenti: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["colonna", "campo"],
                  properties: { colonna: { type: "string" }, campo: { type: "string", enum: [...Object.keys(campi), ""] } },
                },
              },
            },
          },
        },
      },
      system:
        "Abbini le colonne di un file Excel/CSV di un'agenzia immobiliare italiana ai campi di un gestionale. " +
        "Guarda intestazioni ed esempi. Ogni campo si usa al massimo una volta, tranne 'note'. " +
        "Se una colonna contiene nome e cognome insieme, scegli nome_completo o cognome_nome guardando gli esempi. " +
        "Se una colonna non corrisponde a nessun campo, usa la stringa vuota.",
      messages: [
        {
          role: "user",
          content:
            `Campi disponibili (codice: significato):\n${Object.entries(campi).map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n` +
            `Intestazioni del file: ${JSON.stringify(intestazioni)}\nPrime righe: ${JSON.stringify(esempi)}`,
        },
      ],
    });
    if (response.stop_reason === "refusal") return reply(502, { error: "L'AI non ha risposto" });
    const testo = response.content.find((c: { type: string }) => c.type === "text") as { text?: string } | undefined;
    const out = JSON.parse(testo?.text ?? "{}");
    const mappa: Record<string, string> = {};
    for (const a of out.abbinamenti ?? []) if (intestazioni.includes(a.colonna)) mappa[a.colonna] = a.campo in campi ? a.campo : "";
    return reply(200, { mappatura: mappa });
  } catch (e) {
    console.error("importazione mappa:", String(e));
    return reply(502, { error: "L'AI non ha risposto" });
  }
});
