/**
 * Dati demo di Sorpasso AI: una concessionaria completa per le presentazioni ai clienti.
 *
 *   npm run seed
 *
 * Richiede in .env.local (o nell'ambiente):
 *   VITE_SUPABASE_URL           URL del progetto
 *   SUPABASE_SERVICE_ROLE_KEY   chiave di servizio (solo qui, mai nel client)
 *
 * Lo script è ripetibile: elimina la concessionaria demo e i suoi utenti e li ricrea.
 * Crea: 1 titolare, 1 responsabile vendite, 3 venditori, 1 amministrazione,
 * 25 auto, 40 lead in tutte le fasi con storico, preventivi, 4 vendite con pratica,
 * appuntamenti della settimana corrente.
 */
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { CATALOGO_OPTIONAL } from "../src/lib/optional.ts";

// ---------- Configurazione ----------
for (const f of [".env.local", ".env"]) {
  if (!existsSync(f)) continue;
  for (const riga of readFileSync(f, "utf8").split("\n")) {
    const m = riga.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
}
const URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_KEY) {
  console.error("Mancano VITE_SUPABASE_URL e/o SUPABASE_SERVICE_ROLE_KEY (vedi .env.example).");
  process.exit(1);
}
const sb = createClient(URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const DOMINIO = "demo.sorpasso.it";
const PASSWORD = process.env.SEED_PASSWORD ?? "Sorpasso2026!";
const NOME_ORG = "Autosalone Levante (demo)";

// ---------- Utility ----------
let semeRng = 20261029;
/** Generatore pseudo-casuale con seme fisso: i dati demo sono sempre uguali. */
function rnd() {
  semeRng = (semeRng * 1664525 + 1013904223) % 4294967296;
  return semeRng / 4294967296;
}
const tra = (min: number, max: number) => Math.floor(min + rnd() * (max - min + 1));
const scegli = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)]!;
const ora = Date.now();
const MIN = 60_000;
const GIORNO = 24 * 60 * MIN;
const iso = (ms: number) => new Date(ms).toISOString();
const dataSql = (ms: number) => iso(ms).slice(0, 10);
/** Giorno lavorativo alle ore h:m, a partire da oggi + offset giorni. */
function alle(offsetGiorni: number, h: number, m = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetGiorni);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}
function lunediCorrente() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

async function q<T>(p: PromiseLike<{ data: T; error: unknown }>, cosa: string): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error) {
    console.error(`Errore durante: ${cosa}`, error);
    process.exit(1);
  }
  return data as NonNullable<T>;
}

// ---------- Pulizia ----------
async function pulisci() {
  const { data: orgs } = await sb.from("organizations").select("id").eq("nome", NOME_ORG);
  for (const o of orgs ?? []) {
    // Cancella anche i file nello Storage della concessionaria demo
    for (const bucket of ["vehicle-photos", "documents"]) {
      const { data: cartelle } = await sb.storage.from(bucket).list(o.id, { limit: 1000 });
      for (const c of cartelle ?? []) {
        const { data: file } = await sb.storage.from(bucket).list(`${o.id}/${c.name}`, { limit: 1000 });
        const percorsi = (file ?? []).map((f) => `${o.id}/${c.name}/${f.name}`);
        if (percorsi.length) await sb.storage.from(bucket).remove(percorsi);
      }
    }
    await q(sb.from("organizations").delete().eq("id", o.id), "eliminazione concessionaria demo");
  }
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await sb.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) throw error;
    const demo = data.users.filter((u) => u.email?.endsWith(`@${DOMINIO}`));
    for (const u of demo) await sb.auth.admin.deleteUser(u.id);
    if (data.users.length < 200) break;
  }
}

// ---------- Dati di base ----------
const PERSONE = [
  { chiave: "titolare", nome: "Giuseppe Lorusso", ruolo: "titolare", tel: "+39 335 100 2001" },
  { chiave: "responsabile", nome: "Francesca De Santis", ruolo: "responsabile_vendite", tel: "+39 335 100 2002" },
  { chiave: "venditore1", nome: "Marco Russo", ruolo: "venditore", tel: "+39 335 100 2003" },
  { chiave: "venditore2", nome: "Giulia Ferraro", ruolo: "venditore", tel: "+39 335 100 2004" },
  { chiave: "venditore3", nome: "Antonio Caputo", ruolo: "venditore", tel: "+39 335 100 2005" },
  { chiave: "amministrazione", nome: "Laura Mastrangelo", ruolo: "amministrazione", tel: "+39 335 100 2006" },
] as const;

// [marca, modello, versione, anno, km, alimentazione, cambio, colore, tipo, prezzo, giorni in stock]
type RigaAuto = [string, string, string, number, number, string, string, string, string, number, number];
const AUTO: RigaAuto[] = [
  ["Fiat", "Panda", "1.0 Hybrid City Life", 2023, 18500, "ibrida", "manuale", "Bianco Gelato", "usato", 12900, 12],
  ["Fiat", "500", "1.0 Hybrid Dolcevita", 2022, 24300, "ibrida", "manuale", "Rosso Passione", "usato", 13900, 71],
  ["Volkswagen", "Golf", "2.0 TDI Life DSG", 2021, 58200, "diesel", "automatico", "Grigio Moonstone", "usato", 21900, 3],
  ["Volkswagen", "T-Roc", "1.5 TSI Style", 2022, 31000, "benzina", "manuale", "Blu Ravenna", "usato", 24500, 44],
  ["Peugeot", "208", "PureTech 100 Allure", 2023, 9800, "benzina", "manuale", "Giallo Faro", "km0", 18900, 22],
  ["Peugeot", "3008", "BlueHDi 130 EAT8 GT", 2021, 67400, "diesel", "automatico", "Nero Perla", "usato", 23900, 96],
  ["Toyota", "Yaris", "1.5 Hybrid Trend", 2022, 29800, "ibrida", "automatico", "Bianco Puro", "usato", 17900, 18],
  ["Toyota", "C-HR", "1.8 Hybrid Lounge", 2020, 61000, "ibrida", "automatico", "Rosso Metal Stream", "usato", 20900, 63],
  ["Jeep", "Renegade", "1.6 Mjt Limited", 2020, 72500, "diesel", "manuale", "Grigio Sting", "usato", 17500, 128],
  ["Jeep", "Compass", "1.3 T4 PHEV 4xe S", 2022, 35400, "ibrida_plugin", "automatico", "Blu Shade", "usato", 29900, 37],
  ["Renault", "Clio", "TCe 90 Evolution", 2024, 50, "benzina", "manuale", "Arancio Valencia", "nuovo", 19400, 9],
  ["Renault", "Captur", "E-Tech Full Hybrid Techno", 2023, 12000, "ibrida", "automatico", "Grigio Scisto", "km0", 25900, 27],
  ["Dacia", "Sandero", "Stepway 1.0 TCe ECO-G", 2023, 15600, "gpl", "manuale", "Arancio Atacama", "usato", 14500, 6],
  ["Dacia", "Duster", "1.5 Blue dCi Prestige 4x4", 2021, 54800, "diesel", "manuale", "Verde Kaki", "usato", 18200, 81],
  ["Audi", "A3", "Sportback 35 TDI S tronic", 2021, 49900, "diesel", "automatico", "Nero Mythos", "usato", 26500, 52],
  ["Audi", "Q3", "35 TFSI S line", 2022, 28700, "benzina", "automatico", "Bianco Ghiaccio", "usato", 34900, 15],
  ["BMW", "Serie 1", "118d Sport", 2020, 82000, "diesel", "automatico", "Blu Estoril", "usato", 21500, 102],
  ["BMW", "X1", "sDrive18d xLine", 2021, 59300, "diesel", "automatico", "Grigio Mineral", "usato", 28900, 33],
  ["Ford", "Puma", "1.0 EcoBoost Hybrid ST-Line", 2022, 26100, "ibrida", "manuale", "Blu Desert Island", "usato", 20900, 41],
  ["Kia", "Sportage", "1.6 T-GDi HEV Style", 2023, 14900, "ibrida", "automatico", "Grigio Lunar", "km0", 33900, 20],
  ["Hyundai", "Tucson", "1.6 CRDi 48V Xline", 2021, 44200, "diesel", "manuale", "Bianco Polar", "usato", 25400, 58],
  ["Lancia", "Ypsilon", "1.0 Hybrid Gold", 2022, 21300, "ibrida", "manuale", "Blu Elegante", "usato", 12500, 75],
  ["Alfa Romeo", "Tonale", "1.5 Hybrid Ti", 2023, 11800, "ibrida", "automatico", "Rosso Alfa", "usato", 33500, 29],
  ["Citroën", "C3", "PureTech 83 Shine", 2022, 30800, "benzina", "manuale", "Bianco Banchisa", "usato", 13400, 47],
  ["MG", "ZS", "EV Luxury", 2023, 8900, "elettrica", "automatico", "Argento Dover", "usato", 24900, 88],
];

const NOMI = ["Luca", "Alessandro", "Davide", "Matteo", "Andrea", "Simone", "Francesco", "Lorenzo", "Paolo", "Vito", "Nicola", "Roberto", "Stefano", "Michele", "Domenico", "Sara", "Chiara", "Valentina", "Martina", "Federica", "Anna", "Elena", "Rosa", "Angela", "Ilaria", "Silvia", "Teresa", "Marta", "Giorgia", "Alessia"];
const COGNOMI = ["Rossi", "Esposito", "Romano", "Colombo", "Ricci", "Marino", "Greco", "Bruno", "Gallo", "Conti", "De Luca", "Mancini", "Costa", "Giordano", "Rizzo", "Lombardi", "Moretti", "Barbieri", "Fontana", "Santoro", "Mariani", "Rinaldi", "Caruso", "Ferrara", "Galli", "Martini", "Leone", "Longo", "Gentile", "Martinelli", "Vitale", "Lombardo", "Serra", "Coppola", "De Santis", "D'Angelo", "Marchetti", "Parisi", "Villa", "Conte"];
const COMUNI = ["Bari", "Monopoli", "Polignano a Mare", "Conversano", "Mola di Bari", "Putignano", "Castellana Grotte", "Fasano", "Gioia del Colle", "Altamura", "Molfetta", "Bitonto"];
const FONTI_PESATE = ["autoscout24", "autoscout24", "autoscout24", "subito", "subito", "sito", "sito", "facebook", "instagram", "telefono", "salone", "salone", "passaparola"] as const;

// Distribuzione dei 40 lead per fase.
const FASI: [string, number][] = [
  ["nuovo", 6],
  ["contattato", 7],
  ["qualificato", 6],
  ["test_drive", 5],
  ["preventivo", 5],
  ["trattativa", 4],
  ["vinto", 4],
  ["perso", 3],
];
const PERMUTE = [
  { marca: "Fiat", modello: "Punto" },
  { marca: "Opel", modello: "Corsa" },
  { marca: "Ford", modello: "Fiesta" },
  { marca: "Renault", modello: "Clio" },
];
/** Quanti giorni fa sono state chiuse le 4 vendite demo. */
const GIORNI_VENDITA = [12, 9, 4, 6];
const MOTIVI_PERSO = ["Prezzo troppo alto", "Ha comprato altrove", "Valutazione permuta bassa"];
const RICHIESTE = [
  "Vorrei sapere se l'auto è ancora disponibile e se accettate permuta.",
  "Buongiorno, è possibile fare un giro di prova sabato mattina?",
  "Quanto viene la rata con 3.000 € di anticipo?",
  "Ha il tagliando certificato? Quanti proprietari?",
  "Cerco un SUV per la famiglia, max 25.000 €.",
  "Mi interessa, ma avrei una Punto del 2012 da dare dentro.",
  "Prezzo trattabile? Pago in contanti.",
  "Cerco un'auto per mia figlia neopatentata.",
];

/** Dati tecnici plausibili per l'auto i-esima (deterministici). */
function schedaTecnica(i: number, alimentazione: string, tipo: string, prezzo: number) {
  const tutti = CATALOGO_OPTIONAL.flatMap((c) => c.voci);
  const base = ["ABS", "ESP", "Bluetooth", "Climatizzatore automatico", "Cruise control", "Sensori di parcheggio posteriori", "Volante multifunzione", "Start & Stop"];
  const extra = tutti.filter((_, k) => (k * 7 + i * 3) % 5 === 0).slice(0, 4 + (i % 6));
  const suv = /Renegade|Compass|Duster|Q3|X1|Sportage|Tucson|Tonale|T-Roc|Captur|3008|C-HR|Puma|ZS/.test(AUTO[i]![1]);
  const kw = alimentazione === "elettrica" ? 115 : tra(5, 11) * 10;
  return {
    allestimento: scegli(["Business", "Style", "Plus", "Premium", null]),
    carrozzeria: suv ? "SUV" : prezzo < 15000 ? "City car" : "Hatchback",
    porte: 5,
    posti: 5,
    mese_immatricolazione: (i % 12) + 1,
    cilindrata: alimentazione === "elettrica" ? null : scegli([999, 1199, 1332, 1461, 1499, 1598, 1968]),
    potenza_kw: kw,
    trazione: /4x4|4xe/.test(String(AUTO[i]![2])) ? "integrale" : "anteriore",
    classe_euro: alimentazione === "elettrica" ? null : AUTO[i]![3] >= 2021 ? "Euro 6d" : "Euro 6d-TEMP",
    consumo_misto: alimentazione === "elettrica" ? 16.5 : Math.round((4 + rnd() * 2.5) * 10) / 10,
    emissioni_co2: alimentazione === "elettrica" ? 0 : tra(95, 145),
    colore_interni: scegli(["Tessuto nero", "Tessuto grigio", "Pelle nera", "Tessuto/similpelle"]),
    numero_proprietari: tipo === "nuovo" ? 0 : tipo === "km0" ? 1 : tra(1, 2),
    tagliandi_certificati: tipo !== "nuovo" && rnd() < 0.75,
    garanzia_mesi: tipo === "nuovo" ? 24 : 12,
    garanzia_tipo: tipo === "nuovo" ? "Garanzia del costruttore" : "Garanzia concessionaria",
    neopatentati: kw <= 70,
    optional: [...new Set([...base, ...extra])],
    difetti: tipo === "usato" && i % 4 === 0 ? "Piccolo graffio sul paraurti posteriore lato destro." : null,
    // Nuove e km0 da casa madre in regime ordinario, usato da privati in regime del margine
    regime_iva: tipo === "usato" && i % 5 !== 0 ? "margine" : "ordinario",
    sconto_max: Math.round((prezzo * 0.03) / 100) * 100,
  };
}

async function main() {
  console.log("1/7 Pulizia dati demo precedenti…");
  await pulisci();

  console.log("2/7 Concessionaria e utenti…");
  const org = await q(
    sb
      .from("organizations")
      .insert({
        nome: NOME_ORG,
        piva: "07512340727",
        indirizzo: "Via Napoli 128",
        comune: "Bari",
        telefono: "+39 080 555 0101",
        email: `info@${DOMINIO}`,
        marchi: ["Volkswagen", "Peugeot", "Renault", "Dacia", "Usato multimarca"],
        soglia_giacenza_giorni: 60,
        tempo_max_risposta_min: 15,
        round_robin_attivo: true,
        whatsapp: "+39 335 100 2000",
        costo_giacenza_giorno: 15,
        margine_obiettivo_pct: 10,
      })
      .select("id")
      .single(),
    "creazione concessionaria",
  );
  const ORG = org.id as string;

  await q(sb.rpc("crea_categorie_predefinite", { p_org: ORG }), "categorie economiche");

  const utenti: Record<string, string> = {};
  for (const p of PERSONE) {
    const email = `${p.chiave}@${DOMINIO}`;
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { nome: p.nome },
    });
    if (error || !data.user) {
      console.error(`Creazione utente ${email} non riuscita`, error);
      process.exit(1);
    }
    utenti[p.chiave] = data.user.id;
    await q(
      sb.from("profiles").insert({ user_id: data.user.id, organization_id: ORG, nome: p.nome, email, ruolo: p.ruolo, telefono: p.tel }),
      `profilo ${email}`,
    );
  }
  const VENDITORI = [utenti.venditore1!, utenti.venditore2!, utenti.venditore3!];

  await q(
    sb.from("message_templates").insert([
      { organization_id: ORG, nome: "Primo contatto", canale: "whatsapp", testo: "Buongiorno {nome}, sono {venditore} di {azienda}. Ho visto la sua richiesta per {auto}: è ancora disponibile. Quando le farebbe comodo vederla o fare un giro di prova?" },
      { organization_id: ORG, nome: "Invito test drive", canale: "whatsapp", testo: "Ciao {nome}, la {auto} è pronta per un test drive. Ti va bene passare in salone domani? Dimmi tu l'orario che preferisci." },
      { organization_id: ORG, nome: "Follow-up preventivo", canale: "whatsapp", testo: "Buongiorno {nome}, ha avuto modo di guardare il preventivo per la {auto}? Se vuole possiamo rivedere insieme permuta e finanziamento." },
      { organization_id: ORG, nome: "Auto pronta per la consegna", canale: "whatsapp", testo: "Buongiorno {nome}, la sua {auto} è pronta! Le confermo l'appuntamento per la consegna. A presto, {venditore}." },
      { organization_id: ORG, nome: "Primo contatto", canale: "email", oggetto: "La sua richiesta per {auto}", testo: "Gentile {nome},\n\ngrazie per l'interesse verso la {auto}. L'auto è disponibile e saremo felici di fargliela vedere dal vivo o di organizzare un test drive.\n\nPuò rispondere a questa email o chiamarmi direttamente.\n\nCordiali saluti,\n{venditore}\n{azienda}" },
    ]),
    "template messaggi",
  );

  console.log("3/7 Stock (25 auto)…");
  const veicoli = await q(
    sb
      .from("vehicles")
      .insert(
        AUTO.map(([marca, modello, versione, anno, kmPercorsi, alimentazione, cambio, colore, tipo, prezzo, giorni], i) => ({
          organization_id: ORG,
          marca,
          modello,
          versione,
          anno,
          km: kmPercorsi,
          alimentazione,
          cambio,
          colore,
          tipo,
          // Le auto ferme da più tempo hanno avuto un ribasso: lo storico prezzi lo mostra.
          prezzo_vendita: giorni > 60 ? prezzo + 1000 : prezzo,
          targa: tipo === "nuovo" ? null : `G${String.fromCharCode(65 + (i % 26))}${String(100 + i * 7).slice(-3)}${String.fromCharCode(65 + ((i * 3) % 26))}${String.fromCharCode(66 + ((i * 5) % 24))}`,
          stato: i === 3 ? "prenotato" : i === 12 || i === 10 ? "in_preparazione" : "disponibile",
          data_ingresso: dataSql(ora - giorni * GIORNO),
          note_interne: giorni > 90 ? "Valutare ulteriore ribasso o pubblicazione su più portali." : null,
          ...schedaTecnica(i, alimentazione, tipo, prezzo),
        })),
      )
      .select("id, marca, modello, prezzo_vendita, data_ingresso, regime_iva"),
    "inserimento auto",
  );
  // Ribasso sulle auto ferme da oltre 60 giorni (genera lo storico prezzo)
  for (const [i, riga] of AUTO.entries()) {
    if (riga[10] > 60) await q(sb.from("vehicles").update({ prezzo_vendita: riga[9] }).eq("id", veicoli[i]!.id), "ribasso prezzo");
  }

  // Conto economico: acquisto + costi di ripristino tipici
  const costi: Record<string, unknown>[] = [];
  for (const [i, riga] of AUTO.entries()) {
    const v = veicoli[i]!;
    const ingresso = ora - riga[10] * GIORNO;
    const giorno = (dopo: number) => dataSql(Math.min(ingresso + dopo * GIORNO, ora));
    const ordinario = v.regime_iva === "ordinario";
    const acquisto = Math.round((riga[9] * (ordinario ? 0.72 : 0.8) * (0.97 + rnd() * 0.06)) / 100) * 100;
    costi.push({
      organization_id: ORG, vehicle_id: v.id, data: giorno(0), categoria: "Acquisto",
      descrizione: riga[8] === "usato" && rnd() < 0.4 ? "Valore di permuta riconosciuto" : "Prezzo pagato",
      fornitore: riga[8] === "usato" ? scegli(["Privato", "Autoplus Srl", "Noleggio Sud SpA"]) : `${riga[0]} Italia`,
      importo: acquisto, iva_aliquota: ordinario ? 22 : 0,
    });
    if (riga[8] !== "nuovo") {
      costi.push({ organization_id: ORG, vehicle_id: v.id, data: giorno(1), categoria: "Trasporto", descrizione: "Bisarca", fornitore: "Trasporti Adriatica", importo: tra(12, 25) * 10, iva_aliquota: 22 });
      costi.push({ organization_id: ORG, vehicle_id: v.id, data: giorno(3), categoria: "Preparazione e lavaggio", descrizione: "Lucidatura e igienizzazione", fornitore: "Lavaggio Express", importo: tra(8, 18) * 10, iva_aliquota: 22 });
      if (rnd() < 0.6) costi.push({ organization_id: ORG, vehicle_id: v.id, data: giorno(4), categoria: "Meccanica", descrizione: scegli(["Tagliando completo", "Sostituzione pastiglie e dischi", "Kit distribuzione"]), fornitore: "Officina Lorusso", importo: tra(18, 75) * 10, iva_aliquota: 22 });
      if (rnd() < 0.35) costi.push({ organization_id: ORG, vehicle_id: v.id, data: giorno(5), categoria: "Carrozzeria", descrizione: scegli(["Riparazione paraurti", "Smart repair portiera", "Ritocco graffi"]), fornitore: "Carrozzeria Moderna", importo: tra(15, 60) * 10, iva_aliquota: 22 });
      if (rnd() < 0.3) costi.push({ organization_id: ORG, vehicle_id: v.id, data: giorno(5), categoria: "Pneumatici", descrizione: "4 pneumatici nuovi", fornitore: "Gomme Puglia", importo: tra(28, 55) * 10, iva_aliquota: 22 });
      costi.push({ organization_id: ORG, vehicle_id: v.id, data: giorno(2), categoria: "Passaggio di proprietà e pratiche", descrizione: "Passaggio a nome concessionaria", fornitore: "Agenzia pratiche auto", importo: tra(18, 32) * 10, iva_aliquota: 0 });
    }
    costi.push({ organization_id: ORG, vehicle_id: v.id, data: giorno(6), categoria: "Pubblicità e portali", descrizione: "Annuncio in evidenza AutoScout24", fornitore: "AutoScout24", importo: 39, iva_aliquota: 22 });
  }
  await q(sb.from("vehicle_costs").insert(costi), "costi auto");

  console.log("4/7 Contatti e lead (40)…");
  // Auto che verranno vendute (indici in AUTO) e auto "nuovo arrivo" con clienti compatibili.
  const VENDUTE = [1, 6, 18, 23];
  const DISPONIBILI = AUTO.map((_, i) => i).filter((i) => !VENDUTE.includes(i));
  const leadCreati: { id: string; stato: string; contatto: string; vehicle?: string; venditore: string; creato: number; fonte: string }[] = [];
  let progressivo = 0;
  let indiceVenduta = 0;

  for (const [stato, quanti] of FASI) {
    for (let k = 0; k < quanti; k++, progressivo++) {
      const nome = NOMI[progressivo % NOMI.length]!;
      const cognome = COGNOMI[(progressivo * 7) % COGNOMI.length]!;
      const venditore = VENDITORI[progressivo % 3]!;
      const fonte = scegli(FONTI_PESATE);

      // Quando è arrivato il lead: i nuovi oggi, gli altri nelle ultime settimane.
      let creato: number;
      if (stato === "nuovo") creato = ora - [4, 9, 27, 55, 140, 210][k]! * MIN;
      else if (stato === "vinto") creato = ora - (GIORNI_VENDITA[k]! + tra(8, 14)) * GIORNO;
      else if (stato === "perso") creato = ora - tra(20, 70) * GIORNO;
      else creato = ora - tra(1, 30) * GIORNO - tra(0, 8) * 60 * MIN;

      // Auto di interesse
      let vehicleIdx: number | null;
      if (stato === "vinto") vehicleIdx = VENDUTE[indiceVenduta++]!;
      else if (stato === "perso" && k === 0) vehicleIdx = null; // interessato a una Golf: compatibile con la Golf appena arrivata
      else vehicleIdx = rnd() < 0.8 ? scegli(DISPONIBILI) : null;
      const auto = vehicleIdx != null ? AUTO[vehicleIdx]! : null;

      const contatto = await q(
        sb
          .from("contacts")
          .insert({
            organization_id: ORG,
            nome,
            cognome,
            telefono: `+39 3${tra(20, 49)} ${tra(100, 999)} ${tra(1000, 9999)}`,
            email: rnd() < 0.6 ? `${nome}.${cognome}`.toLowerCase().replace(/[^a-z.]/g, "") + "@esempio.it" : null,
            comune: scegli(COMUNI),
            consenso_privacy: true,
            consenso_privacy_at: iso(creato),
            consenso_marketing: rnd() < 0.55,
            fonte,
            venditore_assegnato: venditore,
            tag: rnd() < 0.2 ? ["famiglia"] : rnd() < 0.15 ? ["aziendale"] : [],
            created_at: iso(creato),
          })
          .select("id")
          .single(),
        "inserimento contatto",
      );

      const budgetBase = auto ? auto[9] : tra(12, 30) * 1000;
      const permuta = rnd() < 0.4;
      const aperto = !["vinto", "perso"].includes(stato);
      // Prossima azione: alcuni follow-up oggi, alcuni scaduti, 3 lead "da gestire" senza prossima azione.
      let prossima: number | null = null;
      if (stato === "nuovo") prossima = creato + 15 * MIN;
      else if (aperto) {
        const r = progressivo % 9;
        prossima = r === 0 ? null : r === 1 ? alle(-1, 11) : r < 4 ? alle(0, tra(9, 18), 30) : alle(tra(1, 6), tra(9, 18));
      }
      const tempistiche = ["subito", "entro_1_mese", "entro_3_mesi", "non_definita"] as const;

      const lead = await q(
        sb
          .from("leads")
          .insert({
            organization_id: ORG,
            contact_id: contatto.id,
            vehicle_id: auto && vehicleIdx != null ? veicoli[vehicleIdx]!.id : null,
            fonte,
            stato,
            motivo_perso: stato === "perso" ? MOTIVI_PERSO[k % MOTIVI_PERSO.length] : null,
            richiesta: scegli(RICHIESTE),
            marca_interesse: auto ? null : stato === "perso" && k === 0 ? "Volkswagen" : scegli(["Volkswagen", "Toyota", "Jeep", "Audi", null]),
            modello_interesse: stato === "perso" && k === 0 ? "Golf" : null,
            budget: rnd() < 0.75 ? Math.round((budgetBase * (0.9 + rnd() * 0.15)) / 500) * 500 : null,
            permuta,
            permuta_dati: permuta ? { ...scegli(PERMUTE), anno: tra(2008, 2016), km: tra(90, 210) * 1000 } : null,
            finanziamento: rnd() < 0.45,
            tempistica: scegli(tempistiche),
            assegnato_a: venditore,
            creato_da: venditore,
            prossima_azione_at: prossima ? iso(prossima) : null,
            prossima_azione_nota: prossima ? (stato === "nuovo" ? "Primo contatto" : scegli(["Richiamare per conferma", "Inviare foto aggiuntive", "Sentire per permuta", "Follow-up preventivo", "Proporre test drive"])) : null,
            chiuso_at: stato === "vinto" ? iso(ora - GIORNI_VENDITA[k]! * GIORNO) : stato === "perso" ? iso(creato + tra(5, 15) * GIORNO) : null,
            created_at: iso(creato),
          })
          .select("id")
          .single(),
        "inserimento lead",
      );
      leadCreati.push({ id: lead.id, stato, contatto: contatto.id, vehicle: auto && vehicleIdx != null ? veicoli[vehicleIdx]!.id : undefined, venditore, creato, fonte });
    }
  }

  console.log("5/7 Storico attività…");
  const ORDINE = ["nuovo", "contattato", "qualificato", "test_drive", "preventivo", "trattativa", "vinto"];
  for (const l of leadCreati) {
    if (l.stato === "nuovo") continue;
    const attivita: Record<string, unknown>[] = [];
    // Prima risposta: dai 3 minuti a qualche ora (alimenta il KPI "tempo medio di prima risposta").
    let t = l.creato + scegli([3, 6, 9, 12, 18, 25, 40, 75, 190]) * MIN;
    const add = (tipo: string, contenuto: string, passoMin: number) => {
      attivita.push({ organization_id: ORG, lead_id: l.id, tipo, contenuto, autore_id: tipo === "cambio_stato" ? l.venditore : l.venditore, created_at: iso(Math.min(t, ora - MIN)) });
      t += passoMin * MIN;
    };
    add(rnd() < 0.6 ? "chiamata" : "whatsapp", scegli(["Risposto subito, interessato. Vuole vedere l'auto.", "Primo contatto, chiede info su km e tagliandi.", "Inviate foto e dettagli, molto interessato."]), 2);
    add("cambio_stato", "nuovo → contattato", tra(60, 60 * 30));
    const fine = l.stato === "perso" ? tra(1, 4) : ORDINE.indexOf(l.stato);
    for (let s = 2; s <= fine; s++) {
      const fase = ORDINE[s]!;
      if (fase === "qualificato") add("nota", scegli(["Budget confermato, valuta finanziamento.", "Ha già un'auto da dare in permuta, fissata valutazione.", "Cerca auto entro fine mese."]), 5);
      if (fase === "test_drive") add("test_drive", "Test drive effettuato, impressione positiva.", 10);
      if (fase === "trattativa") add("chiamata", "Trattativa sul prezzo: chiede sconto e valutazione permuta più alta.", 10);
      add("cambio_stato", `${ORDINE[s - 1]} → ${fase}`, tra(60 * 12, 60 * 24 * 4));
    }
    if (l.stato === "perso") {
      add("chiamata", "Il cliente comunica che non procede.", 5);
      add("cambio_stato", "→ perso", 0);
    } else if (rnd() < 0.5) {
      add("whatsapp", "Inviato messaggio di follow-up.", 0);
    }
    await q(sb.from("activities").insert(attivita), "attività");
  }

  // Preventivi (il trigger aggiunge l'attività "preventivo": la riallineiamo alla data del preventivo)
  for (const l of leadCreati.filter((x) => ["preventivo", "trattativa", "vinto"].includes(x.stato) && x.vehicle)) {
    const v = veicoli.find((x) => x.id === l.vehicle)!;
    const prezzo = Number(v.prezzo_vendita);
    const finanziamento = rnd() < 0.5;
    const anticipo = finanziamento ? 3000 : 0;
    const sconto = Math.round((prezzo * 0.03) / 100) * 100;
    const saldo = prezzo - sconto - anticipo;
    const quando = l.creato + tra(3, 7) * GIORNO;
    const rata = finanziamento ? Math.round(((saldo * (0.0699 / 12)) / (1 - Math.pow(1 + 0.0699 / 12, -60))) * 100) / 100 : null;
    const quote = await q(
      sb
        .from("quotes")
        .insert({
          organization_id: ORG,
          lead_id: l.id,
          vehicle_id: l.vehicle,
          prezzo,
          sconto,
          anticipo,
          finanziamento,
          durata_mesi: finanziamento ? 60 : null,
          tan: finanziamento ? 6.99 : null,
          rata,
          stato: l.stato === "vinto" ? "accettato" : "inviato",
          creato_da: l.venditore,
          created_at: iso(Math.min(quando, ora - GIORNO)),
        })
        .select("id, created_at")
        .single(),
      "preventivo",
    );
    await sb.from("activities").update({ created_at: quote.created_at, autore_id: l.venditore }).eq("lead_id", l.id).eq("tipo", "preventivo").is("autore_id", null);
  }

  console.log("6/7 Vendite e pratiche…");
  const checklistTipo = [
    { contratto: "fatto", documenti_cliente: "fatto", finanziamento_approvato: "fatto", passaggio_proprieta: "fatto", assicurazione: "fatto", preparazione_auto: "fatto", consegna: "fatto" },
    { contratto: "fatto", documenti_cliente: "fatto", finanziamento_approvato: "fatto", passaggio_proprieta: "in_corso", assicurazione: "fatto", preparazione_auto: "in_corso", consegna: "da_fare" },
    { contratto: "fatto", documenti_cliente: "in_corso", finanziamento_approvato: "in_corso", passaggio_proprieta: "da_fare", assicurazione: "da_fare", preparazione_auto: "da_fare", consegna: "da_fare" },
    { contratto: "fatto", documenti_cliente: "fatto", finanziamento_approvato: "fatto", passaggio_proprieta: "fatto", assicurazione: "in_corso", preparazione_auto: "fatto", consegna: "da_fare" },
  ];
  const vinti = leadCreati.filter((l) => l.stato === "vinto");
  const pratiche: { id: string; lead: (typeof vinti)[number]; consegna: number | null }[] = [];
  for (const [i, l] of vinti.entries()) {
    const v = veicoli.find((x) => x.id === l.vehicle)!;
    const venduta = ora - GIORNI_VENDITA[i]! * GIORNO;
    // Una già consegnata, due da consegnare a breve, una ancora senza data.
    const consegna = i === 0 ? venduta + 7 * GIORNO : i === 1 ? alle(1, 11) : i === 3 ? alle(3, 11) : null;
    const d = await q(
      sb
        .from("deals")
        .insert({
          organization_id: ORG,
          lead_id: l.id,
          vehicle_id: l.vehicle,
          contact_id: l.contatto,
          venditore_id: l.venditore,
          prezzo_finale: Number(v.prezzo_vendita) - 500,
          data_vendita: dataSql(venduta),
          data_consegna: consegna ? dataSql(consegna) : null,
          checklist: checklistTipo[i],
        })
        .select("id")
        .single(),
      "pratica",
    );
    pratiche.push({ id: d.id, lead: l, consegna });
    // Il prezzo di vendita entra nei ricavi in automatico (trigger); qui gli extra venduti al cliente.
    const extra: Record<string, unknown>[] = [];
    if (i % 2 === 0) extra.push({ organization_id: ORG, vehicle_id: l.vehicle, data: dataSql(venduta), categoria: "Provvigione finanziamento", descrizione: "Finanziamento 60 rate", importo: tra(35, 70) * 10, iva_aliquota: 0 });
    if (i !== 2) extra.push({ organization_id: ORG, vehicle_id: l.vehicle, data: dataSql(venduta), categoria: "Garanzie e assicurazioni", descrizione: "Garanzia estesa 24 mesi", importo: tra(25, 45) * 10, iva_aliquota: 0 });
    if (extra.length) await q(sb.from("vehicle_revenues").insert(extra), "ricavi extra");
  }

  console.log("7/7 Appuntamenti della settimana…");
  const lun = lunediCorrente().getTime();
  const slot = (giorno: number, h: number, m = 0) => lun + giorno * GIORNO + (h * 60 + m) * MIN;
  const oggiIdx = (new Date().getDay() + 6) % 7;
  // I test drive vanno a lead già in fase test drive o oltre (fissarne uno fa avanzare il lead),
  // valutazioni permuta e officina ai lead nelle prime fasi.
  const caldi = leadCreati.filter((l) => ["test_drive", "preventivo", "trattativa"].includes(l.stato));
  const tiepidi = leadCreati.filter((l) => ["contattato", "qualificato"].includes(l.stato));
  const appuntamenti: Record<string, unknown>[] = [];
  const pianifica = (tipo: string, l: (typeof leadCreati)[number] | undefined, inizio: number, durataMin: number, note?: string) =>
    appuntamenti.push({
      organization_id: ORG,
      tipo,
      lead_id: l?.id ?? null,
      contact_id: l?.contatto ?? null,
      vehicle_id: l?.vehicle ?? null,
      assegnato_a: l?.venditore ?? VENDITORI[0],
      inizio: iso(inizio),
      fine: iso(inizio + durataMin * MIN),
      stato: inizio + durataMin * MIN < ora ? "completato" : "programmato",
      note: note ?? null,
    });
  // Oggi: due test drive e una valutazione permuta
  pianifica("test_drive", caldi[0], slot(oggiIdx, 10, 30), 45, "Portare patente");
  pianifica("valutazione_permuta", tiepidi[0], slot(oggiIdx, 15), 30, "Cliente porta libretto della Punto");
  pianifica("test_drive", caldi[1], slot(oggiIdx, 17, 30), 45);
  // Resto della settimana
  const giorni = [0, 1, 2, 3, 4, 5].filter((g) => g !== oggiIdx);
  for (let i = 2; i < 10; i++) {
    const tipo = i % 3 === 0 ? "valutazione_permuta" : i % 4 === 0 ? "officina" : "test_drive";
    const lead = tipo === "test_drive" ? caldi[i % caldi.length] : tiepidi[i % tiepidi.length];
    pianifica(tipo, lead, slot(giorni[i % giorni.length]!, scegli([9, 10, 11, 15, 16, 17]), scegli([0, 30])), tipo === "officina" ? 60 : 45, tipo === "officina" ? "Tagliando pre-consegna" : undefined);
  }
  for (const p of pratiche.filter((x) => x.consegna && x.consegna > lun && x.consegna < lun + 7 * GIORNO)) {
    pianifica("consegna", p.lead, new Date(p.consegna!).setHours(11, 0, 0, 0), 60, "Consegna con firma documenti");
  }
  await q(sb.from("appointments").insert(appuntamenti), "appuntamenti");

  // Notifiche per i lead nuovi in ritardo (lo farebbe pg_cron ogni 5 minuti)
  const { error: errCron } = await sb.rpc("controlla_lead_in_ritardo");
  if (errCron) console.warn("  (notifiche lead in ritardo non generate ora: verranno create da pg_cron)");

  console.log("\nFatto! Accedi con uno di questi utenti (password: " + PASSWORD + "):");
  for (const p of PERSONE) console.log(`  ${p.ruolo.padEnd(22)} ${p.chiave}@${DOMINIO}  (${p.nome})`);
}

main().catch((e) => {
  console.error("Seed interrotto:", e instanceof Error ? e.message : e);
  process.exit(1);
});
