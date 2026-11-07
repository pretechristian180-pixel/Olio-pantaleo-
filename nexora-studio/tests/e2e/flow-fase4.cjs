// Fase 4: video approvato → social collegati (team + sincronizzazione) → programmazione →
// spostamento (trascinamento e "Sposta") → consegna e verifica della pubblicazione (provider demo).
// Richiede app e worker attivi con PUBLISHING_PROVIDER=demo, utente admin team@nexora.test,
// file in E2E_ASSETS (logo.png, girato-verticale.mov). Usa SUPABASE_SECRET_KEY per l'accelerazione finale.
const { chromium, devices } = require("playwright");
const { createClient } = require("@supabase/supabase-js");
const DIR = process.env.E2E_ASSETS ?? `${__dirname}/.assets`;
const APP = "http://localhost:3000";
const MAIL = "http://127.0.0.1:54324/api/v1";
const db = createClient("http://127.0.0.1:54321", process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const run = Date.now().toString(36);
const BIZ = `Estetica Sara ${run}`;
const BLOG_ID = String(100000 + Math.floor(Math.random() * 899999));
const U = { name: "Sara Gialli", email: `sara.${run}@test.it`, pw: "Sara2026!" };
const log = (...a) => console.log("•", ...a);
const t0 = Date.now();
const secs = () => `${Math.round((Date.now() - t0) / 1000)}s`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function mailTo(email, predicate) {
  for (let i = 0; i < 60; i++) {
    const data = await (await fetch(`${MAIL}/search?query=${encodeURIComponent(`to:"${email}"`)}`)).json();
    for (const m of data.messages ?? []) {
      const full = await (await fetch(`${MAIL}/message/${m.ID}`)).json();
      if (predicate(full)) return full;
    }
    await sleep(1000);
  }
  throw new Error("email non arrivata");
}
async function tap(page, selector) {
  const el = page.locator(selector).first();
  await el.waitFor();
  await el.evaluate((n) => n.scrollIntoView({ block: "center" }));
  await el.click();
}
async function waitForText(page, re, timeoutS = 240) {
  for (let i = 0; i < timeoutS; i++) {
    if (await page.getByText(re).first().isVisible().catch(() => false)) return;
    await page.waitForTimeout(1000);
    if (i % 8 === 7) await page.reload();
  }
  throw new Error(`testo non comparso: ${re}`);
}
const shot = (p, n, full = false) => p.screenshot({ path: `${DIR}/${n}.png`, fullPage: full });

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();

  // Registrazione + onboarding veloce (3 video a settimana: lun, mer, ven alle 12:30)
  await page.goto(`${APP}/registrati`);
  await page.fill("#full_name", U.name);
  await page.fill("#email", U.email);
  await page.fill("#password", U.pw);
  await page.check('input[name="terms"]');
  await page.check('input[name="clauses"]');
  await page.click('button[type="submit"]');
  const conf = await mailTo(U.email, (m) => /token_hash/.test(m.HTML));
  await page.goto(conf.HTML.match(/href="([^"]*token_hash[^"]*)"/)[1].replace(/&amp;/g, "&"));
  await page.waitForURL("**/onboarding");
  await page.fill("#name", BIZ);
  await page.selectOption("#sector", "beauty_benessere");
  await page.fill("#city", "Bari");
  await page.click('button:has-text("Continua")');
  await page.getByText("Il tuo brand").waitFor();
  await page.fill("#tone_of_voice", "Accogliente");
  await page.fill("#target_audience", "Donne 25-55 di Bari");
  await page.fill("#services", "Trattamenti viso, manicure");
  await page.click('button:has-text("Continua")');
  await page.click('button:has-text("Salta per ora")');
  await page.click('button:has-text("Finito")');
  await page.waitForURL("**/onboarding/fatto");
  log(secs(), "onboarding completato");

  // Video: caricamento → revisione del team → approvazione
  await page.goto(`${APP}/video/carica`);
  await page.getByLabel("Scegli i video").setInputFiles(`${DIR}/girato-verticale.mov`);
  await page.getByRole("button", { name: "Carica e monta" }).click();
  await page.waitForURL(/\/video\/[0-9a-f-]{36}$/, { timeout: 120000 });
  const videoUrl = page.url();
  const videoId = videoUrl.split("/").pop();

  const admin = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await admin.goto(`${APP}/accedi?next=/admin/revisione`);
  await admin.fill("#email", "team@nexora.test");
  await admin.fill("#password", "Team2026!");
  await admin.click('button[type="submit"]');
  await admin.waitForURL("**/admin/revisione");
  await waitForText(admin, new RegExp(BIZ));
  await admin.locator("li", { hasText: BIZ }).locator('button:has-text("Invia al cliente")').click();
  await page.goto(videoUrl);
  await tap(page, 'button:has-text("Approva il video")');
  await page.getByText("Non è ancora in calendario").waitFor({ timeout: 30000 });
  log(secs(), "approvato senza social: resta da programmare (corretto)");

  // Social: il cliente chiede il link; il team collega il brand Metricool
  await page.goto(`${APP}/social`);
  await shot(page, "f4-01-social-vuoto", true);
  await admin.goto(`${APP}/admin/social`);
  const row = admin.locator("li", { hasText: BIZ });
  await row.locator('input[name="blog_id"]').fill(BLOG_ID);
  await row.locator('input[name="connect_url"]').fill("https://app.metricool.com/connect/demo-link");
  await row.locator('button:has-text("Salva e sincronizza")').click();
  await page.goto(`${APP}/social`);
  await waitForText(page, /Pubblichiamo qui/, 60);
  const connected = await page.getByText("Pubblichiamo qui").count();
  log(secs(), `social sincronizzati: ${connected} collegati, link "Collega i social" visibile:`, await page.getByRole("link", { name: /Collega i social/ }).count() === 1);
  await shot(page, "f4-02-social-collegati", true);

  // Programmazione nel primo spazio libero
  await page.goto(videoUrl);
  await tap(page, 'button:has-text("Programma nel primo spazio libero")');
  await page.getByText(/^Esce/).waitFor({ timeout: 30000 });
  log(secs(), "programmato:", (await page.getByText(/^Esce/).innerText()).replace(/\s+/g, " "));
  await shot(page, "f4-03-video-programmato", true);

  // Calendario (desktop): trascinamento su oggi (troppo vicino: rifiutato) e su domenica (ok)
  const desk = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await desk.goto(`${APP}/accedi?next=/calendario`);
  await desk.fill("#email", U.email);
  await desk.fill("#password", U.pw);
  await desk.click('button[type="submit"]');
  await desk.waitForURL((u) => u.pathname === "/calendario");
  const { data: posts } = await db.from("scheduled_posts").select("scheduled_at").eq("video_id", videoId);
  const firstSlot = posts[0].scheduled_at;
  const sunday = (() => {
    const d = new Date(firstSlot);
    const dow = (d.getUTCDay() + 6) % 7; // 0 = lunedì
    d.setUTCDate(d.getUTCDate() + (6 - dow));
    return d.toISOString().slice(0, 10);
  })();
  if (firstSlot.slice(0, 10) > sunday) throw new Error("slot fuori settimana");
  await desk.goto(`${APP}/calendario?vista=settimana&da=${firstSlot.slice(0, 10)}`);
  const handle = desk.getByRole("button", { name: /Trascina/ }).first();
  await handle.waitFor();
  const target = desk.locator("section", { has: desk.locator("h3") }).filter({ hasText: /^dom/i }).first();
  const hb = await handle.boundingBox();
  const tb = await target.boundingBox();
  await desk.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await desk.mouse.down();
  await desk.mouse.move(hb.x + 20, hb.y + 10, { steps: 5 });
  await desk.mouse.move(tb.x + tb.width / 2, tb.y + 60, { steps: 15 });
  await desk.mouse.up();
  await desk.getByText("Post spostato.").waitFor({ timeout: 15000 });
  const { data: moved } = await db.from("scheduled_posts").select("scheduled_at").eq("video_id", videoId);
  log(secs(), `trascinato da ${firstSlot.slice(0, 10)} a domenica: ${moved[0].scheduled_at}`);
  await shot(desk, "f4-04-calendario-settimana");

  // "Sposta" a meno di 20 minuti: rifiutato
  await desk.reload();
  await desk.getByRole("button", { name: "Sposta" }).first().click();
  const now = new Date(Date.now() + 5 * 60000);
  const rome = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const part = (t) => rome.find((x) => x.type === t).value;
  await desk.locator('input[type="date"]').first().fill(`${part("year")}-${part("month")}-${part("day")}`);
  await desk.locator('input[type="time"]').first().fill(`${part("hour")}:${part("minute")}`);
  await desk.getByRole("button", { name: "Sposta qui" }).click();
  await desk.getByText(/almeno 20 minuti/).waitFor({ timeout: 15000 });
  log(secs(), "spostamento troppo vicino all'uscita rifiutato (corretto)");
  await desk.goto(`${APP}/calendario?vista=mese&da=${moved[0].scheduled_at.slice(0, 10)}`);
  await shot(desk, "f4-05-calendario-mese");

  // Pubblicazione: accorciamo l'attesa portando l'orario a +1 minuto e accodando la consegna
  const at = new Date(Date.now() + 60000).toISOString();
  await db.from("scheduled_posts").update({ scheduled_at: at }).eq("video_id", videoId);
  await db.rpc("enqueue_job", {
    p_type: "publish",
    p_workspace_id: (await db.from("videos").select("workspace_id").eq("id", videoId).single()).data.workspace_id,
    p_payload: { video_id: videoId, phase: "handoff", scheduled_at: at },
    p_dedupe_key: `publish:${videoId}:${at}`,
  });
  for (let i = 0; i < 20; i++) {
    const { data } = await db.from("scheduled_posts").select("status").eq("video_id", videoId);
    if (data.every((p) => p.status === "publishing")) break;
    await sleep(1000);
  }
  log(secs(), "consegnato al provider (stato: in pubblicazione)");
  // La verifica parte 3 minuti dopo l'orario effettivo (almeno +5 min): attesa massima 12 minuti
  for (let i = 0; i < 72; i++) {
    const { data } = await db.from("scheduled_posts").select("status, permalink").eq("video_id", videoId);
    if (data.every((p) => p.status === "published")) {
      log(secs(), `pubblicato su ${data.length} social, link: ${data.every((p) => p.permalink) ? "sì" : "no"}`);
      break;
    }
    if (i === 71) throw new Error("pubblicazione non verificata");
    await sleep(10000);
  }
  await page.goto(videoUrl);
  await page.getByText("Vedi il post").first().waitFor({ timeout: 15000 });
  const { data: v } = await db.from("videos").select("status").eq("id", videoId).single();
  log(secs(), "stato del video:", v.status);
  await shot(page, "f4-06-pubblicato", true);
  await browser.close();
  log("FLUSSO FASE 4 OK");
})().catch((e) => {
  console.error("✗ ERRORE:", e.message);
  process.exit(1);
});
