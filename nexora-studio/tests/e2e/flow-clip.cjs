// Più clip per video: tre riprese parlate caricate in ordine sbagliato + una clip di copertura.
// Il worker le trascrive, l'AI le rimette nell'ordine dello script, le unisce e mette la copertura
// sopra la voce. Richiede app, worker (LLM_PROVIDER=demo, TRANSCRIPTION_PROVIDER=demo), Mailpit
// e SUPABASE_SECRET_KEY. La trascrizione demo legge il testo dal metadato "comment" dei file.
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
  const files = [
    makeClip(`${DIR}/clip-terza.mp4`, { seconds: 5, text: LINES[2] }),
    makeClip(`${DIR}/clip-prima.mp4`, { seconds: 5, text: LINES[0] }),
    makeClip(`${DIR}/clip-seconda.mov`, { seconds: 4.5, text: LINES[1], size: "1080x1920" }),
    makeClip(`${DIR}/copertura-vasi.mp4`, { seconds: 6, audio: false, size: "1280x720", pattern: "smptebars" }),
  ];

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

  // Pagina Carica: quattro file insieme
  await page.goto(`${APP}/video/carica?script=${script.id}`);
  await page.getByLabel("Scegli i video").setInputFiles(files);
  const items = page.getByRole("list", { name: "Clip del video" }).getByRole("listitem");
  await items.nth(3).waitFor();
  check((await items.count()) === 4, "quattro clip in lista, tutte «Parlo io» all'inizio");
  check(await page.getByText("C'è una ripresa orizzontale").isVisible(), "avviso: una clip orizzontale tra le riprese");

  // La quarta è copertura, con descrizione
  await items.nth(3).getByRole("button", { name: "Copertura", exact: true }).click();
  check((await items.nth(3).getByRole("button", { name: "Copertura", exact: true }).getAttribute("aria-pressed")) === "true", "quarta clip segnata come copertura");
  await items.nth(3).getByRole("textbox").fill("i vasi in vetrina");
  check(!(await page.getByText("C'è una ripresa orizzontale").isVisible()), "l'avviso sparisce: la clip orizzontale è copertura");

  // Senza riprese parlate non si può inviare
  for (const i of [0, 1, 2]) await items.nth(i).getByRole("button", { name: "Copertura", exact: true }).click();
  check(await page.getByRole("button", { name: "Carica e monta" }).isDisabled(), "senza riprese parlate il pulsante è disattivato");
  for (const i of [0, 1, 2]) await items.nth(i).getByRole("button", { name: "Parlo io", exact: true }).click();
  await page.screenshot({ path: `${DIR}/clip-01-lista.png`, fullPage: true });

  await page.getByRole("button", { name: "Carica e monta" }).click();
  await page.waitForURL(/\/video\/[0-9a-f-]{36}$/, { timeout: 120000 });
  const videoId = page.url().split("/").pop();
  const { data: clips } = await db.from("video_clips").select("kind, position, description, raw_upload_id").eq("video_id", videoId).order("position");
  check(clips.length === 4 && clips.map((c) => c.kind).join() === "speech,speech,speech,cover", "4 clip registrate: 3 parlate e 1 copertura");
  check(clips[3].description === "i vasi in vetrina", "descrizione della copertura salvata");
  const { count: quota } = await db.from("videos").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id);
  check(quota === 1, "un solo video per tutte le clip");

  // Montaggio
  let video;
  for (let i = 0; i < 120; i++) {
    ({ data: video } = await db.from("videos").select("status, error, raw_upload_id, current_version").eq("id", videoId).single());
    if (["internal_review", "review", "error"].includes(video.status)) break;
    await sleep(2000);
  }
  check(video.status !== "error", `montaggio completato (stato ${video.status}${video.error ? `: ${video.error}` : ""})`);

  const { data: ordered } = await db.from("video_clips").select("position, play_order").eq("video_id", videoId).eq("kind", "speech").order("play_order");
  check(ordered.map((c) => c.position).join() === "2,3,1", `riprese rimesse nell'ordine dello script (caricate 1,2,3 → montate ${ordered.map((c) => c.position).join(",")})`);

  const { data: combined } = await db.from("raw_uploads").select("source, duration_s, width, height, transcript").eq("id", video.raw_upload_id).single();
  check(combined.source === "combined", "il video punta al girato unito");
  check(Math.abs(Number(combined.duration_s) - 14.5) < 0.3, `girato unito lungo quanto le riprese (${combined.duration_s} s)`);
  check(combined.width === 1080 && combined.height === 1920, "girato unito verticale 1080×1920");
  const text = combined.transcript.text;
  check(text.indexOf("Primo") < text.indexOf("Secondo") && text.indexOf("Secondo") < text.indexOf("Terzo"), "trascrizione unita nell'ordine giusto");

  const { data: version } = await db.from("video_versions").select("edit_spec, duration_s, status").eq("video_id", videoId).eq("version", 1).single();
  const cover = version.edit_spec.broll.filter((b) => b.bucket === "raw");
  check(version.status === "ready", `versione 1 pronta (${version.duration_s} s)`);
  check(cover.length === 1 && cover[0].at >= 3, `copertura sopra la voce a ${cover[0]?.at} s per ${cover[0]?.duration} s`);
  const { data: credits } = await db.from("videos").select("broll_credits_used").eq("id", videoId).single();
  const stock = version.edit_spec.broll.filter((b) => b.bucket === "output").length;
  check(credits.broll_credits_used === stock, `crediti b-roll solo per lo stock (${credits.broll_credits_used} = ${stock} clip stock)`);

  await browser.close();
  log("FLUSSO CLIP MULTIPLE OK");
})().catch((e) => {
  console.error("✗ ERRORE:", e.message);
  process.exit(1);
});
