// Il team crea l'azienda di un cliente, compila il profilo al suo posto e invita il titolare.
// Il cliente si registra dal link, accetta, diventa titolare e il team resta come collaboratore.
// Richiede l'app, Mailpit e l'admin team@nexora.test (crea-admin.mjs); SUPABASE_SECRET_KEY.
const { chromium, devices } = require("playwright");
const { createClient } = require("@supabase/supabase-js");

const DIR = process.env.E2E_ASSETS ?? `${__dirname}/.assets`;
const APP = "http://localhost:3000";
const MAIL = "http://127.0.0.1:54324/api/v1";
const db = createClient("http://127.0.0.1:54321", process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const run = Date.now().toString(36);
const BIZ = `Trattoria Cliente ${run}`;
const C = { name: "Luca Verdi", email: `luca.${run}@test.it`, pw: "Luca2026!" };
const log = (...a) => console.log("•", ...a);
const t0 = Date.now();
const secs = () => `${Math.round((Date.now() - t0) / 1000)}s`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (cond, msg) => {
  if (!cond) throw new Error(`controllo fallito: ${msg}`);
  log(secs(), msg);
};

async function linkFromMail(email, re) {
  for (let i = 0; i < 40; i++) {
    const data = await (await fetch(`${MAIL}/search?query=${encodeURIComponent(`to:"${email}"`)}`)).json();
    for (const m of data.messages ?? []) {
      const full = await (await fetch(`${MAIL}/message/${m.ID}`)).json();
      const found = full.HTML?.match(re);
      if (found) return found[1].replace(/&amp;/g, "&");
    }
    await sleep(1000);
  }
  throw new Error(`email non arrivata a ${email}`);
}

(async () => {
  const browser = await chromium.launch();
  const admin = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await admin.goto(`${APP}/accedi?next=/admin/aziende`);
  await admin.fill("#email", "team@nexora.test");
  await admin.fill("#password", "Team2026!");
  await admin.click('button[type="submit"]');
  await admin.waitForURL((u) => u.pathname === "/admin/aziende");

  // 1. Il team crea l'azienda e compila il profilo
  await admin.fill('input[name="name"]', BIZ);
  await admin.getByRole("button", { name: "Crea e compila il profilo" }).click();
  await admin.waitForURL((u) => u.pathname === "/onboarding");
  check((await admin.inputValue("#name")) === BIZ, "azienda creata, onboarding aperto con il nome");
  await admin.selectOption("#sector", "ristorazione");
  await admin.fill("#city", "Lecce");
  await admin.click('button[type="submit"]:has-text("Continua")');
  await admin.getByText("Il tuo brand").waitFor();
  await admin.fill("#tone_of_voice", "Familiare e genuino");
  await admin.fill("#target_audience", "Famiglie e turisti a Lecce");
  await admin.fill("#services", "Cucina salentina, pranzi di lavoro");
  await admin.click('button:has-text("Continua")');
  await admin.click('button:has-text("Salta per ora")');
  await admin.click('button:has-text("Finito")');
  await admin.waitForURL("**/onboarding/fatto");
  check(true, "profilo compilato dal team");

  // 2. Invito del titolare
  await admin.goto(`${APP}/admin/aziende`);
  const row = admin.locator("li", { hasText: BIZ });
  await row.getByText("Profilo completo").waitFor();
  await admin.screenshot({ path: `${DIR}/a-01-aziende.png`, fullPage: true });
  await row.locator('input[name="email"]').fill(C.email);
  await row.getByRole("button", { name: "Invita" }).click();
  await admin.getByText(/Invito (inviato|creato)/).first().waitFor();
  check(true, "invito al titolare inviato");
  const invite = await linkFromMail(C.email, /href="([^"]*\/invito\/[0-9a-f-]{36})"/);

  // 3. Il cliente si registra dal link e accetta
  const client = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
  await client.goto(invite);
  await client.click('a:has-text("Crea l\'account")');
  await client.fill("#full_name", C.name);
  await client.fill("#email", C.email);
  await client.fill("#password", C.pw);
  await client.check('input[name="terms"]');
  await client.check('input[name="clauses"]');
  await client.click('button[type="submit"]');
  await client.getByText("Ti abbiamo mandato un'email").waitFor();
  await client.goto(await linkFromMail(C.email, /href="([^"]*token_hash[^"]*)"/));
  await client.waitForURL("**/invito/**");
  await client.click('button:has-text("Accetta l\'invito")');
  await client.waitForURL("**/inizio");
  check((await client.locator("header").innerText()).includes(BIZ), "il cliente entra e trova la sua azienda pronta");

  // 4. Ruoli: cliente titolare, team collaboratore; il cliente gestisce il piano
  const { data: ws } = await db.from("workspaces").select("id").eq("name", BIZ).single();
  const { data: members } = await db.from("workspace_members").select("user_id, role").eq("workspace_id", ws.id);
  const { data: team } = await db.from("profiles").select("user_id").eq("is_admin", true);
  const teamIds = new Set(team.map((t) => t.user_id));
  check(members.some((m) => !teamIds.has(m.user_id) && m.role === "owner"), "il cliente è titolare");
  check(members.filter((m) => teamIds.has(m.user_id)).every((m) => m.role === "member"), "il team è passato a collaboratore");
  await client.goto(`${APP}/piano`);
  await client.getByRole("heading", { name: "Scegli il piano" }).waitFor();
  check(true, "il cliente vede «Scegli il piano» e può abbonarsi in app");
  await client.screenshot({ path: `${DIR}/a-02-cliente-piano.png`, fullPage: true });

  await admin.goto(`${APP}/admin/aziende`);
  await admin.locator("li", { hasText: BIZ }).getByText("Il cliente è titolare").waitFor();
  check(true, "in /admin/aziende l'azienda risulta del cliente");

  await browser.close();
  log("FLUSSO AZIENDE OK");
})().catch((e) => {
  console.error("✗ ERRORE:", e.message);
  process.exit(1);
});
