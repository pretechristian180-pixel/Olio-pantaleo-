// Testi del video (intro, chiusura, caption, hashtag) scritti dall'AI a partire SOLO dai dati
// della scheda immobile e dal tono del brand. Se l'AI non è configurata, o se il testo cita
// numeri che non sono nella scheda, si usa un modello di testo costruito con i soli dati certi.
import Anthropic from "npm:@anthropic-ai/sdk@0.134.0";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Script = { intro: string; chiusura: string; caption: string; hashtag: string[] };

const TIPO: Record<string, string> = {
  appartamento: "appartamento",
  villa: "villa",
  locale: "locale commerciale",
  terreno: "terreno",
  altro: "immobile",
};

const euro = (n: number) => new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 }).format(n) + " €";

/** Numeri che il testo può citare: solo quelli presenti nella scheda. */
function numeriAmmessi(p: Record<string, unknown>) {
  const out = new Set<string>();
  for (const k of ["mq", "locali", "bagni", "prezzo"]) {
    const v = p[k];
    if (v != null) out.add(String(Math.round(Number(v))));
  }
  for (const k of ["piano", "indirizzo", "descrizione", "titolo", "classe_energetica", "zona", "citta"]) {
    const v = String(p[k] ?? "");
    for (const m of v.replace(/\./g, "").match(/\d+/g) ?? []) out.add(m);
  }
  return out;
}

/** true se ogni numero nel testo compare nella scheda (es. "95 mq", "245.000 €") */
function soloDatiDellaScheda(testo: string, ammessi: Set<string>) {
  const numeri = testo.replace(/(\d)\.(\d{3})/g, "$1$2").match(/\d+/g) ?? [];
  return numeri.every((n) => ammessi.has(n) || ammessi.has(String(Number(n))));
}

/** Modello di testo senza AI: usa solo i dati certi della scheda */
function modello(p: Record<string, any>, brand: Record<string, any>, agenzia: string, agente: string): Script {
  const tipo = TIPO[p.tipo] ?? "immobile";
  const dove = [p.zona, p.citta].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(", ");
  const dati = [p.mq ? `${p.mq} metri quadri` : null, p.locali ? `${p.locali} locali` : null, p.bagni ? `${p.bagni} ${p.bagni == 1 ? "bagno" : "bagni"}` : null]
    .filter(Boolean)
    .join(", ");
  const prezzo = p.prezzo ? (p.contratto === "affitto" ? `${euro(Number(p.prezzo))} al mese` : euro(Number(p.prezzo))) : null;
  const saluto = brand.tono === "ironico" ? "Lo so, scorri veloce. Ma fermati un attimo:" : brand.tono === "amichevole" ? "Ciao! Oggi ti porto a vedere" : "Buongiorno, vi presento";
  const intro =
    brand.tono === "ironico"
      ? `${saluto} questo ${tipo} a ${dove} merita i prossimi trenta secondi.`
      : `${saluto} un ${tipo} ${p.contratto === "affitto" ? "in affitto" : "in vendita"} a ${dove}.`;
  const chiusura =
    (brand.frase_chiusura?.trim() ||
      `Se vuoi vederlo dal vivo, scrivimi: ti accompagno io. Sono ${agente}, ${agenzia}.`) as string;
  const caption = [
    `${tipo.charAt(0).toUpperCase() + tipo.slice(1)} ${p.contratto === "affitto" ? "in affitto" : "in vendita"} a ${dove}.`,
    dati ? `${dati.charAt(0).toUpperCase() + dati.slice(1)}.` : null,
    prezzo ? `Prezzo: ${prezzo}.` : null,
    "Scrivici per una visita.",
  ]
    .filter(Boolean)
    .join(" ");
  const tag = (s: string) => "#" + s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
  const hashtag = [...new Set([tag(p.citta ?? ""), tag(tipo), p.contratto === "affitto" ? "#affitto" : "#vendita", "#casa", "#immobiliare"])].filter((h) => h.length > 1);
  return { intro, chiusura, caption, hashtag };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Metodo non consentito." });

  // Legge i dati con i permessi dell'utente: vale la stessa separazione tra agenzie dell'app
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const { data: auth } = await db.auth.getUser();
  if (!auth?.user) return reply(401, { error: "Sessione scaduta: accedi di nuovo." });

  let body: { property_id?: string; durata?: number };
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: "Richiesta non valida." });
  }
  const durata = [30, 45, 60].includes(Number(body.durata)) ? Number(body.durata) : 45;

  const { data: p } = await db
    .from("properties")
    .select("titolo, descrizione, tipo, contratto, prezzo, mq, locali, bagni, piano, indirizzo, citta, zona, classe_energetica")
    .eq("id", body.property_id ?? "")
    .maybeSingle();
  if (!p) return reply(404, { error: "Immobile non trovato." });

  const { data: me } = await db.from("profiles").select("nome, cognome, agency_id").eq("id", auth.user.id).maybeSingle();
  const { data: agency } = await db.from("agencies").select("nome").eq("id", me?.agency_id ?? "").maybeSingle();
  const { data: brand } = await db.from("brand_settings").select("tono, frase_chiusura, hashtag_fissi").eq("agency_id", me?.agency_id ?? "").maybeSingle();
  const agente = `${me?.nome ?? ""} ${me?.cognome ?? ""}`.trim() || "il tuo agente";
  const agenzia = agency?.nome ?? "la nostra agenzia";
  const b = brand ?? { tono: "professionale", frase_chiusura: null, hashtag_fissi: [] };
  const base = modello(p, b, agenzia, agente);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return reply(200, { ...base, fonte: "modello" });

  const parole = { 30: [18, 14], 45: [26, 18], 60: [34, 22] }[durata as 30 | 45 | 60]!;
  const scheda = {
    tipo: TIPO[p.tipo] ?? "immobile",
    contratto: p.contratto,
    titolo: p.titolo,
    indirizzo: p.indirizzo,
    zona: p.zona,
    citta: p.citta,
    mq: p.mq,
    locali: p.locali,
    bagni: p.bagni,
    piano: p.piano,
    classe_energetica: p.classe_energetica,
    prezzo: p.prezzo ? (p.contratto === "affitto" ? `${euro(Number(p.prezzo))} al mese` : euro(Number(p.prezzo))) : null,
    descrizione: p.descrizione,
  };

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      // @ts-ignore: parametro beta del server (fallback automatico in caso di rifiuto)
      fallbacks: "default",
      output_config: {
        effort: "medium",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["intro", "chiusura", "caption", "hashtag"],
            properties: {
              intro: { type: "string" },
              chiusura: { type: "string" },
              caption: { type: "string" },
              hashtag: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
      system:
        "Scrivi i testi di un reel verticale per un'agenzia immobiliare italiana. Il video mostra le foto reali dell'immobile; " +
        "all'inizio e alla fine parla l'avatar dell'agente, in prima persona.\n" +
        "Regole: usa solo le informazioni della scheda che ricevi. Non citare caratteristiche, numeri, servizi, vista, " +
        "materiali o dintorni che non compaiono nella scheda: se un dato manca, non nominarlo. " +
        "Non promettere nulla (rendimenti, affari, urgenze inventate). Italiano naturale, frasi brevi da dire a voce.",
      messages: [
        {
          role: "user",
          content:
            `Scheda immobile (JSON):\n${JSON.stringify(scheda)}\n\n` +
            `Agente: ${agente}. Agenzia: ${agenzia}. Tono: ${b.tono}.` +
            (b.frase_chiusura ? ` La chiusura deve finire con questa frase: "${b.frase_chiusura}".` : "") +
            `\nDurata del video: ${durata} secondi. Intro di circa ${parole[0]} parole, chiusura di circa ${parole[1]} parole ` +
            `con un invito a contattare l'agenzia. Caption per Instagram di massimo 400 caratteri, senza hashtag. ` +
            `Da 4 a 7 hashtag in italiano, minuscoli, ognuno con il simbolo #.`,
        },
      ],
    } as Anthropic.Beta.MessageCreateParamsNonStreaming);

    if (response.stop_reason === "refusal") return reply(200, { ...base, fonte: "modello" });
    const text = response.content.find((c) => c.type === "text");
    const out = JSON.parse(text && text.type === "text" ? text.text : "{}") as Script;
    if (!out.intro || !out.chiusura || !out.caption) return reply(200, { ...base, fonte: "modello" });

    // Controllo: nessun numero che non sia nella scheda
    const ammessi = numeriAmmessi(p);
    const tutto = `${out.intro} ${out.chiusura} ${out.caption}`;
    if (!soloDatiDellaScheda(tutto, ammessi)) {
      return reply(200, { ...base, fonte: "modello", avviso: "Il testo dell'AI citava dati non presenti nella scheda: usiamo un testo base." });
    }
    const hashtag = [...new Set((out.hashtag ?? []).map((h) => "#" + h.replace(/^#+/, "").replace(/\s+/g, "").toLowerCase()))].slice(0, 7);
    return reply(200, { intro: out.intro.trim(), chiusura: out.chiusura.trim(), caption: out.caption.trim(), hashtag, fonte: "ai" });
  } catch (err) {
    console.error(err);
    return reply(200, { ...base, fonte: "modello", avviso: "L'AI non ha risposto: usiamo un testo base che puoi modificare." });
  }
});
