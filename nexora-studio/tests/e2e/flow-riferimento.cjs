// Indicazioni del cliente e video di riferimento: due video dello stesso girato, uno con un
// riferimento serrato (un taglio al secondo) e uno con un riferimento calmo più l'indicazione
// "niente zoom". Il worker analizza lo stile (una volta per file) e il montaggio cambia di conseguenza.
// Richiede app, worker (LLM_PROVIDER=demo, TRANSCRIPTION_PROVIDER=demo), Mailpit e SUPABASE_SECRET_KEY.
const { execFileSync } = require("node:child_process");
const { mkdirSync } = require("node:fs");
const { chromium, devices } = require("playwright");
const { createClient } = require("@supabase/supabase-js");

const DIR = process.env.E2E_ASSETS ?? `${__dirname}/.assets`;
const APP = "http://localhost:3000";
const MAIL = "http://127.0.0.1:54324/api/v1";
const db = createClient("http://127.0.0.1:54321", process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const run = Date.now().toString(36);
const U = { name: "Marta Galli", email: `marta.${run}@test.it`, pw: "Marta2026!" };
const log = (...a) => console.log("•", ...a);
const t0 = Date.now();
const secs = () => `${Math.round((Date.now() - t0) / 1000)}s`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (cond, msg) => {
  if (!cond) throw new Error(`controllo fallito: ${msg}`);
  log(secs(), msg);
};

const LINES = [
  "Primo taglia i gambi in diagonale con un coltello pulito",
  "Secondo cambia l'acqua ogni due giorni senza eccezioni",
  "Terzo tienili lontano dalla frutta e dal sole diretto",
];

function makeClip(file, { seconds, text, size = "720x1280", audio = true, pattern = "testsrc2" }) {
  const args = ["-y", "-v", "error", "-f", "lavfi", "-i", `${pattern}=s=${size}:d=${seconds}:r=30`];
  if (audio) args.push("-f", "lavfi", "-i", `sine=f=330:d=${seconds}`, "-shortest", "-c:a", "aac");
  args.push("-c:v", "libx264", "-pix_fmt", "yuv420p");
  if (text) args.push("-metadata", `comment=demo-text: ${text}`);
  args.push(file);
  execFileSync("ffmpeg", args);
  return file;
}

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

(async () => {
  mkdirSync(DIR, { recursive: true });
  // Caricate nell'ordine 3, 1, 2 dello script; la copertura è orizzontale e senza audio.
  const girato = makeClip(`${DIR}/girato-stile.mp4`, { seconds: 12, text: LINES.join(". ") });
  // Riferimento serrato: 16 inquadrature diverse da 1 s (colori pieni alternati)
  const fast = `${DIR}/riferimento-serrato.mp4`;
  const colors = ["red", "blue", "green", "yellow", "purple", "orange", "white", "black"];
  const inputs = [];
  for (let i = 0; i < 16; i++) inputs.push("-f", "lavfi", "-i", `color=c=${colors[i % colors.length]}:s=720x1280:d=1:r=30`);
  execFileSync("ffmpeg", ["-y", "-v", "error", ...inputs, "-filter_complex", `${Array.from({ length: 16 }, (_, i) => `[${i}:v]`).join("")}concat=n=16:v=1:a=0[v]`, "-map", "[v]", "-c:v", "libx264", "-pix_fmt", "yuv420p", fast]);
  // Riferimento calmo: un'unica inquadratura di 20 s
  const calm = makeClip(`${DIR}/riferimento-calmo.mp4`, { seconds: 20, audio: false, pattern: "testsrc2" });

  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices["Pixel 7"] });
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
  await page.fill("#name", `Fiori Galli ${run}`);
  await page.selectOption("#sector", "retail");
  await page.fill("#city", "Lecce");
  await page.click('button:has-text("Continua")');
  await page.getByText("Il tuo brand").waitFor();
  await page.fill("#tone_of_voice", "Gentile");
  await page.fill("#target_audience", "Chi regala fiori a Lecce");
  await page.fill("#services", "Bouquet");
  await page.click('button:has-text("Continua")');
  await page.click('button:has-text("Salta per ora")');
  await page.click('button:has-text("Finito")');
  await page.waitForURL("**/onboarding/fatto");

  const { data: ws } = await db.from("workspaces").select("id").eq("name", `Fiori Galli ${run}`).single();
  const monday = (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  })();
  const { data: batch } = await db.from("script_batches").upsert({ workspace_id: ws.id, week_start: monday }, { onConflict: "workspace_id,week_start" }).select("id").single();
  const { data: script } = await db
    .from("scripts")
    .insert({ batch_id: batch.id, workspace_id: ws.id, title: "Fiori che durano", hook: "Tre trucchi per i fiori", body: LINES.join("\n"), format: "tutorial" })
    .select("id")
    .single();
  log(secs(), "azienda e script pronti");

  async function upload({ reference, notes }) {
    await page.goto(`${APP}/video/carica?script=${script.id}`);
    await page.getByLabel("Scegli i video").setInputFiles([girato]);
    await page.getByRole("list", { name: "Clip del video" }).getByRole("listitem").first().waitFor();
    await page.getByLabel("Scegli il video di riferimento").setInputFiles([reference]);
    await page.getByRole("button", { name: "Togli il video di riferimento" }).waitFor();
    if (notes) await page.fill("#edit_notes", notes);
    await page.getByRole("button", { name: "Carica e monta" }).click();
    await page.waitForURL(/\/video\/[0-9a-f-]{36}$/, { timeout: 120000 });
    return page.url().split("/").pop();
  }
  async function spec(videoId) {
    for (let i = 0; i < 120; i++) {
      const { data: v } = await db.from("videos").select("status, error").eq("id", videoId).single();
      if (v.status === "error") throw new Error(`montaggio fallito: ${v.error}`);
      if (["internal_review", "review"].includes(v.status)) break;
      await sleep(2000);
    }
    const { data } = await db.from("video_versions").select("edit_spec, status").eq("video_id", videoId).eq("version", 1).single();
    return data.edit_spec;
  }

  // 1. Riferimento serrato, nessuna indicazione
  const idFast = await upload({ reference: fast });
  const { data: refClip } = await db.from("video_clips").select("kind, raw:raw_uploads(storage_path)").eq("video_id", idFast).eq("kind", "reference").single();
  check(Boolean(refClip), "video di riferimento registrato come clip «reference»");
  const a = await spec(idFast);
  const { data: profFast } = await db.from("style_profiles").select("profile").eq("bucket", "raw").eq("storage_path", refClip.raw.storage_path).single();
  check(profFast.profile.cutsPerMinute >= 40, `riferimento serrato analizzato: ${profFast.profile.cutsPerMinute} tagli al minuto`);
  check(a.subtitles.uppercase && a.subtitles.size === "grandi" && a.subtitles.position === "centro", "montaggio serrato: sottotitoli grandi, maiuscoli, al centro");
  check(a.subtitles.style === "karaoke" && a.punchIn === true, "montaggio serrato: karaoke e zoom sui tagli");
  check(a.subtitles.keywordEmphasis === true, "montaggio serrato: parola chiave in grande con effetto neon");
  check(a.logoWatermark === "nessuno", "logo fisso non applicato: l'azienda di prova non ha un logo");

  // 2. Riferimento calmo + indicazione scritta "niente zoom, sottotitoli in alto"
  const idCalm = await upload({ reference: calm, notes: "Niente zoom, sottotitoli in alto, ritmo tranquillo" });
  const { data: notesRow } = await db.from("videos").select("edit_notes").eq("id", idCalm).single();
  check(notesRow.edit_notes === "Niente zoom, sottotitoli in alto, ritmo tranquillo", "indicazioni del cliente salvate");
  const b = await spec(idCalm);
  check(!b.subtitles.uppercase && b.subtitles.size === "medi", "montaggio calmo: sottotitoli normali");
  check(b.punchIn === false, "«niente zoom»: nessuno zoom");
  check(b.subtitles.keywordEmphasis === false, "montaggio calmo: niente parola chiave in grande");
  check(b.subtitles.position === "alto", "l'indicazione scritta vince sul riferimento: sottotitoli in alto");
  const { data: costs } = await db.from("provider_costs").select("operation").eq("video_id", idFast).eq("operation", "style_analysis");
  check(costs.length === 1, "analisi dello stile registrata tra i costi del video");

  await browser.close();
  log("FLUSSO RIFERIMENTO DI STILE OK");
})().catch((e) => {
  console.error("✗ ERRORE:", e.message);
  process.exit(1);
});
