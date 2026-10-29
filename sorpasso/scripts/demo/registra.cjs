// Registra le risposte di Supabase navigando tutto il gestionale come titolare (dati demo).
// Uso: APP=http://localhost:5174 API=http://localhost:54322 PGDATABASE=demo node scripts/demo/registra.cjs
// L'app deve girare con VITE_SUPABASE_URL=$API; il database deve contenere i dati di npm run seed.
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const fs = require("fs");
const OUT = process.env.OUT ?? __dirname;
const sql = (q) => execSync(`psql -Atc "${q}"`, { env: process.env }).toString().trim().split("\n").filter(Boolean);
const BASE = process.env.APP ?? "http://localhost:5174";
const API = process.env.API ?? "http://localhost:54322";
const ISO = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?/g;
const GIORNO = /\d{4}-\d{2}-\d{2}/g;
const chiave = (metodo, url, body, oggetto) => {
  const u = new URL(url); const norm = (s) => decodeURIComponent(s).replace(ISO, "T").replace(GIORNO, "D");
  return `${metodo} ${u.pathname}${norm(u.search)} ${norm(body ?? "")} ${oggetto ? "1" : "0"}`;
};
(async () => {
  const ora = Date.now();
  const reg = process.env.AGGIUNGI ? JSON.parse(fs.readFileSync(OUT + "/registrazioni.json", "utf8")) : {};
  const errori = [];
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  p.on("pageerror", (e) => errori.push(p.url() + " " + e.message.slice(0, 160)));
  p.on("response", async (r) => {
    const req = r.request(); const url = req.url();
    if (!url.startsWith(`${API}/rest/`) || req.method() === "OPTIONS") return;
    const metodo = req.method(); if (!["GET", "HEAD"].includes(metodo) && !url.includes("/rpc/")) return;
    try {
      const k = chiave(metodo, url.replace(API, "https://demo.sorpasso.invalid"), req.postData(), (req.headers()["accept"] ?? "").includes("vnd.pgrst.object"));
      if (reg[k]) return;
      reg[k] = { status: r.status(), contentRange: r.headers()["content-range"], body: metodo === "HEAD" ? "" : await r.text() };
    } catch {}
  });
  const vai = async (percorso, attesa = 350) => {
    await p.evaluate((x) => { window.__vai?.(x); }, percorso);
    await p.waitForLoadState("networkidle").catch(() => {});
    await p.waitForTimeout(attesa);
  };
  await p.goto(BASE + "/accedi");
  await p.getByLabel(/email/i).fill("titolare@demo.sorpasso.it");
  await p.getByLabel(/password/i).first().fill("Sorpasso2026!");
  await p.getByRole("button", { name: /accedi/i }).click();
  await p.waitForURL(BASE + "/");
  // Navigazione client-side (come farà la demo): pushState + evento popstate
  await p.evaluate(() => { window.__vai = (x) => { history.pushState({}, "", x); dispatchEvent(new PopStateEvent("popstate")); }; });
  const clicca = async (testo) => { const el = p.getByRole("tab", { name: testo }).or(p.getByRole("button", { name: testo })).first(); if (await el.count()) { await el.click().catch(() => {}); await p.waitForLoadState("networkidle").catch(() => {}); await p.waitForTimeout(300); } };

  if (!process.env.AGGIUNGI) for (const x of ["/", "/lead", "/stock", "/agenda", "/clienti", "/pratiche", "/margini", "/report", "/impostazioni", "/stock/nuovo"]) await vai(x, 600);
  await vai("/lead"); await clicca("Tabella");
  await vai("/margini"); await clicca("In stock"); await clicca("Tutte");
  await vai("/agenda"); for (const t of ["Per venditore"]) await clicca(t);
  await vai("/impostazioni"); for (const t of ["Azienda", "Utenti e ruoli", "Soglie e automazioni", "Template messaggi", "Conto economico", "Portali"]) await clicca(t);
  await vai("/report"); for (const t of ["Mese scorso", "Ultimi 3 mesi", "Quest'anno"]) await clicca(t);

  const lead = sql("select id from leads"), auto = sql("select id from vehicles"), clienti = sql("select id from contacts"), pratiche = sql("select id from deals");
  if (!process.env.AGGIUNGI) for (const id of lead) { await vai(`/lead/${id}`); await vai(`/lead/${id}/preventivo`, 200); }
  for (const id of auto) for (const t of ["scheda", "economia", "pubblicazione", "interessati"]) await vai(`/stock/${id}?tab=${t}`, 250);
  for (const id of auto.slice(0, 3)) await vai(`/stock/${id}/modifica`, 250);
  for (const id of clienti) await vai(`/clienti/${id}`, 200);
  for (const id of pratiche) await vai(`/pratiche/${id}`, 300);
  await vai("/");

  fs.writeFileSync(OUT + "/registrazioni.json", JSON.stringify(reg));
  console.log(errori.slice(0, 8).join("\n"));
  if (!process.env.AGGIUNGI) fs.writeFileSync(OUT + "/meta.json", JSON.stringify({ ora, utente: sql("select user_id from profiles where email='titolare@demo.sorpasso.it'")[0] }));
  console.log(Object.keys(reg).length, "risposte,", Math.round(fs.statSync(OUT + "/registrazioni.json").size / 1024), "KB");
  await b.close();
})();
