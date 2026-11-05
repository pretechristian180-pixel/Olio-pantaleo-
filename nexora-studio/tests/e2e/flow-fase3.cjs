// Fase 3: script → caricamento del girato (TUS) → trascrizione → montaggio → render →
// revisione del team → approvazione del cliente con una richiesta di modifica in mezzo.
// Richiede: app su :3000 e worker attivi (provider demo, MUSIC_DIR, PYTHON_BIN con opencv),
// utente admin creato con crea-admin.mjs (team@nexora.test / Team2026!), file in E2E_ASSETS.
const { chromium, devices } = require("playwright");
const fs = require("fs");
const DIR = process.env.E2E_ASSETS ?? `${__dirname}/.assets`;
const APP = "http://localhost:3000";
const MAIL = "http://127.0.0.1:54324/api/v1";
const run = Date.now().toString(36);
const U = { name: "Marco Bianchi", email: `marco.${run}@test.it`, pw: "Marco2026!" };
const log = (...a) => console.log("•", ...a);
const t0 = Date.now();
const secs = () => `${Math.round((Date.now() - t0) / 1000)}s`;

async function mailTo(email, predicate, tries = 60) {
  for (let i = 0; i < tries; i++) {
    const data = await (await fetch(`${MAIL}/search?query=${encodeURIComponent(`to:"${email}"`)}`)).json();
    for (const m of data.messages ?? []) {
      const full = await (await fetch(`${MAIL}/message/${m.ID}`)).json();
      if (predicate(full)) return full;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("email non arrivata: " + email);
}
/** Clic come un utente: porta l'elemento al centro dello schermo (sopra la barra in basso). */
async function tap(page, selector) {
  const el = page.locator(selector).first();
  await el.waitFor();
  await el.evaluate((n) => n.scrollIntoView({ block: "center" }));
  await el.click();
}
const shot = (p, n, full = false) => p.screenshot({ path: `${DIR}/${n}.png`, fullPage: full });

async function waitForText(page, re, timeoutS = 240) {
  for (let i = 0; i < timeoutS; i++) {
    if (await page.getByText(re).first().isVisible().catch(() => false)) return;
    await page.waitForTimeout(1000);
    if (i % 10 === 9) await page.reload();
  }
  throw new Error(`testo non comparso: ${re}`);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();

  // Registrazione, conferma, onboarding con logo
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
  await page.fill("#name", "Officina Bianchi");
  await page.selectOption("#sector", "automotive");
  await page.fill("#city", "Brescia");
  await page.click('button:has-text("Continua")');
  await page.getByText("Il tuo brand").waitFor();
  await page.setInputFiles('input[type="file"][accept^="image"]', `${DIR}/logo.png`);
  await page.getByText("Li abbiamo presi dal logo").waitFor({ timeout: 15000 });
  await page.fill("#tone_of_voice", "Diretto e competente");
  await page.fill("#target_audience", "Automobilisti di Brescia");
  await page.fill("#services", "Tagliandi, gomme, diagnosi");
  await page.click('button:has-text("Continua")');
  await page.getByText("Video che ti piacciono").waitFor();
  await page.click('button:has-text("Salta per ora")');
  await page.getByText("Quando pubblichiamo?").waitFor();
  await page.click('button:has-text("Finito")');
  await page.waitForURL("**/onboarding/fatto");
  log(secs(), "onboarding completato");

  // Script → "Carica il girato"
  await page.goto(`${APP}/script`);
  await page.locator('a[href^="/script/"]').first().waitFor({ timeout: 60000 });
  await page.locator('a[href^="/script/"]').first().click();
  await page.click('a:has-text("Carica il girato")');
  await page.waitForURL("**/video/carica?script=*");
  await page.setInputFiles('input[type="file"][accept="video/*"]', `${DIR}/girato-verticale.mov`);
  await page.getByRole("button", { name: "Carica e monta" }).waitFor();
  await shot(page, "f3-01-carica");
  await page.getByRole("button", { name: "Carica e monta" }).click();
  await page.waitForURL(/\/video\/[0-9a-f-]{36}$/, { timeout: 120000 });
  const videoUrl = page.url();
  log(secs(), "girato caricato, montaggio avviato");
  await page.waitForTimeout(1500);
  await shot(page, "f3-02-in-montaggio", true);

  // Revisione del team (manual_review attivo di default)
  const admin = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await admin.goto(`${APP}/accedi?next=/admin/revisione`);
  await admin.fill("#email", "team@nexora.test");
  await admin.fill("#password", "Team2026!");
  await admin.click('button[type="submit"]');
  await admin.waitForURL("**/admin/revisione");
  await waitForText(admin, /Officina Bianchi/);
  log(secs(), "video arrivato in revisione interna");
  await shot(admin, "f3-03-admin-revisione");
  await admin.click('button:has-text("Invia al cliente")');
  await admin.getByText("Niente da controllare").waitFor({ timeout: 30000 });

  // Cliente: email + revisione
  const ready = await mailTo(U.email, (m) => /pronto da approvare/i.test(m.Subject));
  log(secs(), "email al cliente:", ready.Subject);
  await page.goto(videoUrl);
  await page.getByRole("button", { name: /Approva il video/ }).waitFor({ timeout: 30000 });
  const src = await page.locator("video").getAttribute("src");
  const head = await fetch(src);
  log("video firmato raggiungibile:", head.status, head.headers.get("content-type"), `${Math.round(Number(head.headers.get("content-length")) / 1024)} KB`);
  await shot(page, "f3-04-da-approvare", true);

  // Didascalia
  await page.fill("#caption", "Tagliando prima delle vacanze? Ecco cosa controlliamo. Prenota in officina!");
  await tap(page, 'button:has-text("Salva la didascalia")');
  await page.getByText("Didascalia salvata.").waitFor();

  // Richiesta di modifica → v2
  await tap(page, 'button:has-text("Chiedi una modifica")');
  await tap(page, 'button:has-text("+ Sottotitoli più grandi")');
  await tap(page, 'button:has-text("Invia la richiesta")');
  await page.getByText(/nuova versione/).first().waitFor({ timeout: 30000 });
  log(secs(), "modifica richiesta");

  await admin.reload();
  await waitForText(admin, /Versione 2/);
  await admin.click('button:has-text("Invia al cliente")');
  await page.goto(videoUrl);
  await waitForText(page, /Versione 2/, 60);
  await page.getByRole("button", { name: /Approva il video/ }).waitFor({ timeout: 30000 });
  const remaining = await page.getByRole("button", { name: /Chiedi una modifica/ }).count();
  log(secs(), "versione 2 pronta; pulsante modifica ancora presente:", remaining === 1);
  await tap(page, 'button:has-text("Approva il video")');
  await page.getByText("Video approvato").waitFor();
  await shot(page, "f3-05-approvato", true);
  log(secs(), "video approvato");

  fs.writeFileSync(`${DIR}/f3-video-url.txt`, src);
  await browser.close();
  log("FLUSSO FASE 3 OK");
})().catch((e) => {
  console.error("✗ ERRORE:", e.message);
  process.exit(1);
});
