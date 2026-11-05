// Fase 2: onboarding → script generati dal worker → pagina Script → dettaglio → riscrittura → salta.
// Richiede app su :3000 e worker attivi, con LLM_PROVIDER=demo ed EMAIL_PROVIDER=mailpit.
const { chromium, devices } = require("playwright");
const fs = require("fs");
const DIR = process.env.E2E_ASSETS ?? `${__dirname}/.assets`;
const APP = "http://localhost:3000";
const MAIL = "http://127.0.0.1:54324/api/v1";
const run = Date.now().toString(36);
const U = { name: "Lucia Neri", email: `lucia.${run}@test.it`, pw: "Lucia2026!" };
const log = (...a) => console.log("•", ...a);

async function mailTo(email, predicate) {
  for (let i = 0; i < 60; i++) {
    const data = await (await fetch(`${MAIL}/search?query=${encodeURIComponent(`to:"${email}"`)}`)).json();
    for (const m of data.messages ?? []) {
      const full = await (await fetch(`${MAIL}/message/${m.ID}`)).json();
      if (predicate(full)) return full;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("email non arrivata: " + email);
}
const shot = (p, n, full = false) => p.screenshot({ path: `${DIR}/${n}.png`, fullPage: full });

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();

  // Registrazione e conferma
  await page.goto(`${APP}/registrati`);
  await page.fill("#full_name", U.name);
  await page.fill("#email", U.email);
  await page.fill("#password", U.pw);
  await page.check('input[name="terms"]');
  await page.click('button[type="submit"]');
  const conf = await mailTo(U.email, (m) => /token_hash/.test(m.HTML));
  await page.goto(conf.HTML.match(/href="([^"]*token_hash[^"]*)"/)[1].replace(/&amp;/g, "&"));
  await page.waitForURL("**/onboarding");

  // Onboarding veloce
  await page.fill("#name", "Agenzia Casa Neri");
  await page.selectOption("#sector", "immobiliare");
  await page.fill("#city", "Lecce");
  await page.click('button:has-text("Continua")');
  await page.getByText("Il tuo brand").waitFor();
  await page.fill("#tone_of_voice", "Rassicurante e professionale");
  await page.fill("#target_audience", "Giovani coppie che cercano la prima casa a Lecce");
  await page.fill("#services", "Compravendita, affitti, valutazioni gratuite");
  await page.click('button:has-text("Continua")');
  await page.getByText("Video che ti piacciono").waitFor();
  await page.click('button:has-text("Salta per ora")');
  await page.getByText("Quando pubblichiamo?").waitFor();
  await page.click('button:has-text("Finito")');
  await page.waitForURL("**/onboarding/fatto");
  log("onboarding completato");

  // Script generati dal worker
  await page.goto(`${APP}/script`);
  await shot(page, "f2-01-script-in-preparazione");
  await page.locator('a[href^="/script/"]').first().waitFor({ timeout: 60000 });
  const cards = await page.locator('a[href^="/script/"]').count();
  await shot(page, "f2-02-script-settimana", true);
  log(`script della settimana: ${cards}`);

  // Home
  await page.goto(`${APP}/inizio`);
  const homeItems = await page.locator('a[href^="/script/"]').count();
  await shot(page, "f2-03-home");
  log(`script in Home: ${homeItems}`);

  // Dettaglio
  await page.goto(`${APP}/script`);
  await page.locator('a[href^="/script/"]').first().click();
  await page.getByText("Le prime parole").waitFor();
  const before = await page.locator("h1").innerText();
  await shot(page, "f2-04-dettaglio", true);

  // Riscrittura
  await page.click('button:has-text("Riscrivi questo script")');
  await page.fill("#feedback", "Troppo generico");
  await page.click('button[type="submit"]:has-text("Riscrivi")');
  await page.getByText("Ecco il nuovo script.").waitFor({ timeout: 60000 });
  const after = await page.locator("h1").innerText();
  log(`riscritto: "${before}" → "${after}"`, before !== after ? "(cambiato)" : "(UGUALE: errore)");
  await page.click('button:has-text("Riscrivi questo script")');
  const remaining = await page.getByText(/Ti restano \d/).innerText();
  log("contatore:", remaining.match(/Ti restano \d+ \w+/)[0]);
  await page.click('button[aria-label="Chiudi"]');

  // Salta
  await page.click('button:has-text("Salta questo video")');
  await page.getByText("Rimetti tra i video da girare").waitFor();
  log("script segnato come saltato");

  // Email della settimana
  const weekly = await mailTo(U.email, (m) => /video della settimana/i.test(m.Subject));
  log("email ricevuta:", weekly.Subject);
  fs.writeFileSync(`${DIR}/f2-email.html`, weekly.HTML);

  await browser.close();
  log("FLUSSO FASE 2 OK");
})().catch((e) => {
  console.error("✗ ERRORE:", e.message);
  process.exit(1);
});
