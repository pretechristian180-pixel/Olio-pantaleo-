// Teleprompter: registrazione dal browser con la fotocamera frontale e il testo dello script.
// Chrome usa una fotocamera e un microfono finti. Registra qualche secondo, rivede, "Rifai",
// registra di nuovo, "Usa questo": il video viene caricato e parte il montaggio.
// Richiede app, Mailpit e SUPABASE_SECRET_KEY (per preparare uno script di prova).
const { chromium, devices } = require("playwright");
const { createClient } = require("@supabase/supabase-js");

const DIR = process.env.E2E_ASSETS ?? `${__dirname}/.assets`;
const APP = "http://localhost:3000";
const MAIL = "http://127.0.0.1:54324/api/v1";
const db = createClient("http://127.0.0.1:54321", process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const run = Date.now().toString(36);
const U = { name: "Paola Neri", email: `paola.${run}@test.it`, pw: "Paola2026!" };
const log = (...a) => console.log("•", ...a);
const t0 = Date.now();
const secs = () => `${Math.round((Date.now() - t0) / 1000)}s`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (cond, msg) => {
  if (!cond) throw new Error(`controllo fallito: ${msg}`);
  log(secs(), msg);
};

async function mailLink(email) {
  for (let i = 0; i < 40; i++) {
    const data = await (await fetch(`${MAIL}/search?query=${encodeURIComponent(`to:"${email}"`)}`)).json();
    for (const m of data.messages ?? []) {
      const full = await (await fetch(`${MAIL}/message/${m.ID}`)).json();
      const found = full.HTML?.match(/href="([^"]*token_hash[^"]*)"/);
      if (found) return found[1].replace(/&amp;/g, "&");
    }
    await sleep(1000);
  }
  throw new Error("email non arrivata");
}

async function record(page, ms) {
  await page.getByRole("button", { name: "Inizia a registrare" }).click();
  await page.getByRole("timer").waitFor({ timeout: 8000 });
  await sleep(ms);
  await page.getByRole("button", { name: "Ferma la registrazione" }).click();
  await page.getByRole("button", { name: "Usa questo" }).waitFor({ timeout: 10000 });
}

(async () => {
  const browser = await chromium.launch({
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  });
  const context = await browser.newContext({ ...devices["Pixel 7"], permissions: ["camera", "microphone"] });
  const page = await context.newPage();

  // Registrazione e onboarding veloce
  await page.goto(`${APP}/registrati`);
  await page.fill("#full_name", U.name);
  await page.fill("#email", U.email);
  await page.fill("#password", U.pw);
  await page.check('input[name="terms"]');
  await page.check('input[name="clauses"]');
  await page.click('button[type="submit"]');
  await page.goto(await mailLink(U.email));
  await page.waitForURL("**/onboarding");
  await page.fill("#name", `Fioreria Neri ${run}`);
  await page.selectOption("#sector", "retail");
  await page.fill("#city", "Taranto");
  await page.click('button:has-text("Continua")');
  await page.getByText("Il tuo brand").waitFor();
  await page.fill("#tone_of_voice", "Gentile");
  await page.fill("#target_audience", "Chi regala fiori a Taranto");
  await page.fill("#services", "Bouquet, matrimoni");
  await page.click('button:has-text("Continua")');
  await page.click('button:has-text("Salta per ora")');
  await page.click('button:has-text("Finito")');
  await page.waitForURL("**/onboarding/fatto");

  // Uno script di prova
  const { data: ws } = await db.from("workspaces").select("id").eq("name", `Fioreria Neri ${run}`).single();
  const monday = (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  })();
  const { data: batch } = await db.from("script_batches").upsert({ workspace_id: ws.id, week_start: monday }, { onConflict: "workspace_id,week_start" }).select("id").single();
  const { data: script } = await db
    .from("scripts")
    .insert({
      batch_id: batch.id,
      workspace_id: ws.id,
      title: "Il bouquet che dura una settimana",
      hook: "Tre trucchi per far durare i fiori il doppio",
      body: "Primo: taglia i gambi in diagonale.\nSecondo: cambia l'acqua ogni due giorni.\nTerzo: tienili lontano dalla frutta.",
      format: "tutorial",
    })
    .select("id")
    .single();
  log(secs(), "azienda e script pronti");

  // Dalla pagina dello script al teleprompter
  await page.goto(`${APP}/script/${script.id}`);
  await page.getByRole("link", { name: "Registra con il teleprompter" }).click();
  await page.waitForURL("**/video/registra?script=**");
  await page.getByRole("button", { name: "Apri la fotocamera" }).click();
  await page.getByRole("button", { name: "Inizia a registrare" }).waitFor({ timeout: 15000 });
  check(await page.getByText("Tre trucchi per far durare i fiori il doppio").isVisible(), "fotocamera aperta, testo dello script a schermo");
  const live = await page.evaluate(() => {
    const v = document.querySelector('video[aria-label="Anteprima della fotocamera"]');
    return Boolean(v && v.srcObject && v.videoWidth > 0);
  });
  check(live, "anteprima della fotocamera attiva");
  await page.getByRole("button", { name: "Veloce" }).click();
  await page.getByRole("button", { name: "Testo più grande" }).click();
  await page.screenshot({ path: `${DIR}/tp-01-pronto.png` });

  // Prima ripresa, poi "Rifai"
  await record(page, 2500);
  await page.screenshot({ path: `${DIR}/tp-02-revisione.png` });
  await page.getByRole("button", { name: "Rifai" }).click();
  await page.getByRole("button", { name: "Inizia a registrare" }).waitFor();
  check(true, "«Rifai» torna alla fotocamera");

  // Seconda ripresa, con il testo che scorre
  await page.getByRole("button", { name: "Inizia a registrare" }).click();
  await page.getByRole("timer").waitFor({ timeout: 8000 });
  const before = await page.evaluate(() => getComputedStyle(document.querySelector("[data-testid=teleprompter] .whitespace-pre-line")).transform);
  await sleep(3500);
  const after = await page.evaluate(() => getComputedStyle(document.querySelector("[data-testid=teleprompter] .whitespace-pre-line")).transform);
  check(before !== after, "il testo scorre durante la registrazione");
  await page.screenshot({ path: `${DIR}/tp-03-registrazione.png` });
  await page.getByRole("button", { name: "Ferma la registrazione" }).click();
  await page.getByRole("button", { name: "Usa questo" }).waitFor({ timeout: 10000 });
  const dur = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const v = document.querySelector('video[aria-label="Il video appena registrato"]');
        const done = () => resolve(v.duration);
        if (v.readyState >= 1) done();
        else v.addEventListener("loadedmetadata", done, { once: true });
        setTimeout(() => resolve(v.duration), 4000);
      }),
  );
  log(secs(), "durata letta dal browser:", Number.isFinite(dur) ? `${dur.toFixed(1)} s` : "non disponibile (WebM in streaming, normale)");

  // "Usa questo": caricamento e avvio del montaggio
  await page.getByRole("button", { name: "Usa questo" }).click();
  await page.waitForURL(/\/video\/[0-9a-f-]{36}$/, { timeout: 60000 });
  const videoId = page.url().split("/").pop();
  const { data: v } = await db.from("videos").select("status, script_id, raw:raw_uploads(file_name, mime_type, size_bytes)").eq("id", videoId).single();
  check(v.script_id === script.id, "video collegato allo script");
  check(v.raw.size_bytes > 20000 && /^video\/(mp4|webm)$/.test(v.raw.mime_type), `girato caricato: ${v.raw.file_name} (${v.raw.mime_type}, ${Math.round(v.raw.size_bytes / 1024)} KB)`);
  const { data: sc } = await db.from("scripts").select("status").eq("id", script.id).single();
  check(sc.status === "uploaded", "script segnato come girato");
  const { count: jobs } = await db.from("jobs").select("id", { count: "exact", head: true }).eq("type", "transcribe").contains("payload", { video_id: videoId });
  check(jobs === 1, "montaggio avviato (job di trascrizione in coda)");
  await page.screenshot({ path: `${DIR}/tp-04-video.png` });

  await browser.close();
  log("FLUSSO TELEPROMPTER OK");
})().catch((e) => {
  console.error("✗ ERRORE:", e.message);
  process.exit(1);
});
