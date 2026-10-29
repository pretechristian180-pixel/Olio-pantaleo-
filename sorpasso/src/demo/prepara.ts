/**
 * Avvio della demo (importato per primo da main.tsx).
 *  1. Orologio spostato al momento della registrazione: tempi relativi coerenti con i dati.
 *  2. fetch intercettato per l'indirizzo finto di Supabase: risponde con le registrazioni incorporate;
 *     le scritture rispondono "ok" ma non salvano nulla.
 */
import { DEMO, DEMO_ORA, DEMO_URL, DEMO_UTENTE } from "./config";

interface Registrazione {
  status: number;
  contentRange?: string;
  body: string;
}

const ISO = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?/g;
const GIORNO = /\d{4}-\d{2}-\d{2}/g;

/** Chiave di ricerca: date e orari diventano segnaposto, così le query "di oggi" combaciano. */
export function chiave(metodo: string, url: string, body: string | null, oggetto: boolean) {
  const u = new URL(url);
  const norm = (s: string) => decodeURIComponent(s).replace(ISO, "T").replace(GIORNO, "D");
  return `${metodo} ${u.pathname}${norm(u.search)} ${norm(body ?? "")} ${oggetto ? "1" : "0"}`;
}

function spostaOrologio() {
  if (!DEMO_ORA) return;
  const scarto = DEMO_ORA - Date.now();
  const DataVera = Date;
  class DataDemo extends DataVera {
    constructor(...a: ConstructorParameters<typeof Date> | []) {
      if (a.length === 0) super(DataVera.now() + scarto);
      else super(...a);
    }
    static now() {
      return DataVera.now() + scarto;
    }
  }
  globalThis.Date = DataDemo as DateConstructor;
}

/** Identificativo finto: crypto.randomUUID esiste solo nelle pagine https, la demo deve girare ovunque. */
const idFinto = () =>
  "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));

const json = (corpo: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(corpo === undefined ? null : JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });

function sessione() {
  const utente = {
    id: DEMO_UTENTE.id, aud: "authenticated", role: "authenticated", email: DEMO_UTENTE.email,
    user_metadata: { nome: "Giuseppe Lorusso" }, app_metadata: {}, created_at: new Date().toISOString(),
  };
  return {
    access_token: "demo", token_type: "bearer", expires_in: 3600 * 24 * 365,
    expires_at: 4102444800, refresh_token: "demo", user: utente,
  };
}

async function rispondi(dati: Record<string, Registrazione>, req: Request): Promise<Response> {
  const url = new URL(req.url);
  const metodo = req.method.toUpperCase();
  const corpo = metodo === "GET" || metodo === "HEAD" ? null : await req.clone().text();
  const oggetto = (req.headers.get("accept") ?? "").includes("vnd.pgrst.object");

  if (url.pathname.startsWith("/auth/v1/")) {
    if (url.pathname.endsWith("/user")) return json(sessione().user);
    if (url.pathname.endsWith("/token")) return json(sessione());
    return new Response(null, { status: 204 });
  }
  if (url.pathname.startsWith("/functions/v1/ai")) {
    const b = JSON.parse(corpo || "{}");
    if (b.azione === "riassunto_lead")
      return json({ testo: "Cosa vuole: un'auto pronta da usare nel budget indicato.\nA che punto siamo: interessato, aspetta una proposta concreta.\nProssima mossa: chiamarlo oggi e fissare il test drive in settimana." });
    if (b.azione === "descrizione_annuncio")
      return json({
        testo: "Nella demo il testo viene generato dall'AI partendo dalla scheda tecnica dell'auto: dati, optional, garanzia e proprietari, in italiano e pronto per i portali.",
        breve: "🚗 Testo breve per social e WhatsApp\n📅 Anno e km\n💶 Prezzo e garanzia\nScrivici per vederla!",
      });
    return json({ testo: "Buongiorno, grazie per l'interesse! Nella versione reale qui trova una bozza scritta dall'AI sulla base dello storico del cliente." });
  }
  if (url.pathname.startsWith("/functions/v1/piattaforma")) {
    // Pannello della piattaforma: credenziali d'esempio (nella demo non si crea nessun account)
    const b = JSON.parse(corpo || "{}");
    const password = "Demo-7kQp-x4Rt";
    if (b.azione === "crea_concessionaria" || b.azione === "aggiungi_utente")
      return json({ organization_id: null, user_id: idFinto(), password: b.accesso === "password" ? password : null });
    if (b.azione === "link_accesso") return json({ link: "https://app.sorpasso.ai/imposta-password#esempio-di-link-monouso" });
    if (b.azione === "nuova_password") return json({ password });
    return json({ ok: true });
  }
  if (url.pathname.startsWith("/functions/v1/")) return json({ ok: true, eseguiti: 0, provider: [], dati: null });
  if (url.pathname.startsWith("/storage/v1/")) return json(url.pathname.includes("/sign/") && corpo?.includes("paths") ? [] : {});

  const reg = dati[chiave(metodo, req.url, corpo, oggetto)];
  if (reg) {
    return new Response(reg.status === 204 ? null : reg.body, {
      status: reg.status,
      headers: { "Content-Type": "application/json", ...(reg.contentRange ? { "Content-Range": reg.contentRange } : {}) },
    });
  }

  // Non registrato: letture vuote, scritture "riuscite" senza salvare nulla
  if (metodo === "GET" || metodo === "HEAD") {
    if (oggetto) return json({ code: "PGRST116", message: "Nessun dato nella demo" }, 406);
    return json([], 200, { "Content-Range": "*/0" });
  }
  if (url.pathname.startsWith("/rest/v1/rpc/")) return json(null);
  const b = corpo ? JSON.parse(corpo) : {};
  const conId = (x: Record<string, unknown>) => ({ id: url.searchParams.get("id")?.replace(/^eq\./, "") ?? idFinto(), ...x });
  const righe = (Array.isArray(b) ? b : [b]).map(conId);
  if (metodo === "DELETE") return json(oggetto ? righe[0] : [], 200);
  return json(oggetto ? righe[0] : righe, metodo === "POST" ? 201 : 200);
}

if (DEMO) {
  spostaOrologio();
  const caricamento = import.meta.glob<{ default: Record<string, Registrazione> }>("./registrazioni.json");
  const dati = (caricamento["./registrazioni.json"]?.() ?? Promise.resolve({ default: {} })).then((m) => m.default);
  const fetchVero = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    if (!req.url.startsWith(DEMO_URL)) return fetchVero(input, init);
    return rispondi(await dati, req);
  };
}
