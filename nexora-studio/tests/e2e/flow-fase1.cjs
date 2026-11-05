// Test end-to-end Fase 1 contro Supabase locale + app su :3000.
const { chromium, devices } = require("playwright");
const DIR = process.env.E2E_ASSETS ?? `${__dirname}/.assets`;
const APP = "http://localhost:3000";
const MAIL = "http://127.0.0.1:54324/api/v1";
const run = Date.now().toString(36);
const A = { name: "Mario Rossi", email: `mario.${run}@test.it`, pw: "Pizza2026!" };
const B = { name: "Giulia Bianchi", email: `giulia.${run}@test.it`, pw: "Giulia2026!" };
const log = (...a) => console.log("•", ...a);

async function confirmLink(email) {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${MAIL}/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const data = await res.json();
    const msg = data.messages?.[0];
    if (msg) {
      const full = await (await fetch(`${MAIL}/message/${msg.ID}`)).json();
      const m = full.HTML.match(/href="([^"]*token_hash[^"]*)"/);
      if (m) return { subject: full.Subject, url: m[1].replace(/&amp;/g, "&") };
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("email non arrivata per " + email);
}

async function shot(page, name, full = false) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: full });
}

(async () => {
  const browser = await chromium.launch();
  const ctxA = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctxA.newPage();
  page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

  // 1. Registrazione
  await page.goto(`${APP}/registrati`);
  await page.fill("#full_name", A.name);
  await page.fill("#email", A.email);
  await page.fill("#password", A.pw);
  await page.check('input[name="terms"]');
  await page.click('button[type="submit"]');
  await page.getByText("Ti abbiamo mandato un'email").waitFor();
  await shot(page, "01-registrato");
  log("registrazione ok, attendo email");

  // 2. Conferma email
  const conf = await confirmLink(A.email);
  log("email ricevuta:", conf.subject);
  await page.goto(conf.url);
  await page.waitForURL("**/onboarding");
  await shot(page, "02-onboarding-azienda");

  // 3. Azienda
  await page.fill("#name", "Pizzeria Dà Mario");
  await page.selectOption("#sector", "ristorazione");
  await page.fill("#city", "Bari");
  await page.fill("#instagram", "@pizzeriadamario");
  await page.click('button[type="submit"]:has-text("Continua")');
  await page.getByText("Il tuo brand").waitFor();
  log("passo azienda ok");

  // 4. Brand: logo + colori + testi
  await page.setInputFiles('input[type="file"][accept^="image"]', `${DIR}/logo.png`);
  await page.getByText("Li abbiamo presi dal logo").waitFor({ timeout: 15000 });
  const colors = await page.$$eval('input[aria-label^="Codice del colore"]', (els) => els.map((e) => e.value));
  log("colori estratti dal logo:", colors.join(", "));
  await page.click('button:has-text("+ Simpatico")');
  await page.fill("#target_audience", "Famiglie e giovani di Bari");
  await page.fill("#services", "Pizza napoletana, consegna a domicilio");
  await shot(page, "03-onboarding-brand", true);
  await page.click('button[type="submit"]:has-text("Continua")');
  await page.getByText("Video che ti piacciono").waitFor();
  log("passo brand ok");

  // 5. Video di esempio (upload riprendibile TUS)
  await page.setInputFiles('input[type="file"][accept="video/*"]', [
    `${DIR}/esempio-piccolo.mp4`,
    `${DIR}/esempio-grande.mp4`,
  ]);
  await page.waitForFunction(() => document.querySelectorAll("li:has(.text-success)").length === 2, null, {
    timeout: 60000,
  });
  await shot(page, "04-onboarding-esempi");
  await page.click('button[type="submit"]:has-text("Continua")');
  await page.getByText("Quando pubblichiamo?").waitFor();
  log("passo esempi ok (2 video caricati)");

  // 6. Pubblicazione: 4 a settimana, togli un giorno e rimettine un altro
  await page.click('label:has-text("4 a settimana")');
  await shot(page, "05-onboarding-pubblicazione", true);
  await page.click('button[type="submit"]:has-text("Finito")');
  await page.waitForURL("**/onboarding/fatto");
  await shot(page, "06-fatto");
  await page.click('a:has-text("Vai alla Home")');
  await page.waitForURL("**/inizio");
  await shot(page, "07-home");
  log("onboarding completato");

  // 7. Brand page
  await page.goto(`${APP}/brand`);
  await page.locator('img[alt="Logo attuale"]').waitFor();
  await shot(page, "08-brand", true);
  await page.click('label:has-text("Veloce")');
  await page.click('button:has-text("Salva lo stile")');
  await page.getByText("Stile di montaggio salvato.").waitFor();
  log("pagina brand ok (logo firmato visibile, stile salvato)");

  // 8. Team: invito
  await page.goto(`${APP}/team`);
  await page.fill("#invite-email", B.email);
  await page.click('button:has-text("Invita")');
  const inviteLink = await page.locator("code").innerText();
  await shot(page, "09-team-invito", true);
  log("invito creato:", inviteLink.replace(/[0-9a-f-]{36}/, "<token>"));

  // 9. B accetta l'invito registrandosi
  const ctxB = await browser.newContext({ ...devices["Pixel 7"] });
  const pb = await ctxB.newPage();
  await pb.goto(inviteLink);
  await shot(pb, "10-invito-anonimo");
  await pb.click('a:has-text("Crea l\'account")');
  await pb.fill("#full_name", B.name);
  await pb.fill("#email", B.email);
  await pb.fill("#password", B.pw);
  await pb.check('input[name="terms"]');
  await pb.click('button[type="submit"]');
  await pb.getByText("Ti abbiamo mandato un'email").waitFor();
  const confB = await confirmLink(B.email);
  await pb.goto(confB.url);
  await pb.waitForURL("**/invito/**");
  await pb.click('button:has-text("Accetta l\'invito")');
  await pb.waitForURL("**/inizio");
  const header = await pb.locator("header").innerText();
  log("B entra nel team, intestazione:", header.split("\n")[0]);
  await pb.goto(`${APP}/team`);
  const hasInvite = await pb.locator("#invite-email").count();
  await shot(pb, "11-team-collaboratore", true);
  log("B vede il form inviti?", hasInvite ? "SÌ (errore)" : "no (corretto)");
  await pb.goto(`${APP}/brand`);
  const companyDisabled = await pb.locator("#name").isDisabled();
  log("B può modificare i dati azienda?", companyDisabled ? "no (corretto)" : "SÌ (errore)");

  // 10. Uscita e accesso
  await page.goto(`${APP}/inizio`);
  await page.click('header button[aria-label^="Menu account"]');
  await shot(page, "12-menu-account");
  await page.click('button:has-text("Esci")');
  await page.waitForURL("**/accedi");
  await page.fill("#email", A.email);
  await page.fill("#password", "sbagliata1");
  await page.click('button[type="submit"]');
  await page.getByText("Email o password non corrette.").waitFor();
  await page.fill("#password", A.pw);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/inizio");
  log("uscita, errore password e nuovo accesso ok");

  require("fs").writeFileSync(`${DIR}/users.json`, JSON.stringify({ A, B }));
  log(`Per il test di isolamento: node tests/e2e/isolamento.mjs ${A.email} ${B.email}`);
  await browser.close();
  log("FLUSSO COMPLETO OK");
})().catch((e) => {
  console.error("✗ ERRORE:", e.message);
  process.exit(1);
});
