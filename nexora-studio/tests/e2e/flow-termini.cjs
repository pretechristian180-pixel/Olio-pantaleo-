// Regole dei Termini nel prodotto: modifica oltre le 2 incluse (art. 4.4), "Scarica il video"
// (art. 6.4), girato cancellato dopo 90 giorni e contenuti cancellati 30 giorni dopo la cessazione
// (con avviso). Usa un'azienda creata da flow-fase3.cjs (video montato), che alla fine viene
// cancellata. Richiede app e worker attivi, EMAIL_PROVIDER=mailpit e SUPABASE_SECRET_KEY.
const { chromium, devices } = require("playwright");
const { createClient } = require("@supabase/supabase-js");

const DIR = process.env.E2E_ASSETS ?? `${__dirname}/.assets`;
const APP = "http://localhost:3000";
const MAIL = "http://127.0.0.1:54324/api/v1";
const db = createClient("http://127.0.0.1:54321", process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const run = Date.now().toString(36);
const DAY = 86400e3;
const log = (...a) => console.log("•", ...a);
const t0 = Date.now();
const secs = () => `${Math.round((Date.now() - t0) / 1000)}s`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (cond, msg) => {
  if (!cond) throw new Error(`controllo fallito: ${msg}`);
  log(secs(), msg);
};

/** Attiva un pulsante da tastiera (focus + Invio): non risente degli spostamenti della pagina. */
async function tap(locator) {
  await locator.waitFor();
  await locator.focus();
  await locator.press("Enter");
}

async function runRetention() {
  const { data: id } = await db.rpc("enqueue_job", { p_type: "retention", p_workspace_id: null, p_payload: {}, p_dedupe_key: `retention:e2e:${run}:${Date.now()}` });
  for (let i = 0; i < 60; i++) {
    const { data } = await db.from("jobs").select("status, last_error").eq("id", id).single();
    if (data.status === "done") return;
    if (data.status === "failed") throw new Error(`job di conservazione fallito: ${data.last_error}`);
    await sleep(1000);
  }
  throw new Error("job di conservazione non eseguito");
}

async function mailTo(email, predicate) {
  for (let i = 0; i < 30; i++) {
    const data = await (await fetch(`${MAIL}/search?query=${encodeURIComponent(`to:"${email}"`)}`)).json();
    for (const m of data.messages ?? []) if (predicate(m)) return m;
    await sleep(1000);
  }
  throw new Error("email non arrivata");
}

(async () => {
  // Un video montato di un'azienda in prova (da flow-fase3), con il suo titolare
  const { data: videos } = await db
    .from("videos")
    .select("id, workspace_id, raw_upload_id, current_version, workspace:workspaces(name, plan_id, trial_videos_left)")
    .gt("current_version", 0)
    .order("created_at", { ascending: false })
    .limit(20);
  const video = videos.find((v) => v.workspace && !v.workspace.plan_id && v.workspace.trial_videos_left > 0);
  if (!video) throw new Error("serve un video montato di un'azienda in prova: lancia prima flow-fase3.cjs");
  const { data: owner } = await db.from("workspace_members").select("user_id").eq("workspace_id", video.workspace_id).eq("role", "owner").limit(1).single();
  const { data: u } = await db.auth.admin.getUserById(owner.user_id);
  const email = u.user.email;
  await db.auth.admin.updateUserById(owner.user_id, { password: "Termini2026!" });
  await db.from("videos").update({ status: "review", change_rounds_used: 2, error: null }).eq("id", video.id);
  const trialBefore = video.workspace.trial_videos_left;

  const browser = await chromium.launch();
  const page = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
  await page.goto(`${APP}/accedi?next=/video/${video.id}`);
  await page.fill("#email", email);
  await page.fill("#password", "Termini2026!");
  await page.click('button[type="submit"]');
  await page.waitForURL((x) => x.pathname === `/video/${video.id}`);

  // "Scarica il video": link firmato che il browser salva come file
  const dl = page.getByRole("link", { name: "Scarica il video" });
  await dl.waitFor();
  check(/download=/.test(await dl.getAttribute("href")), "«Scarica il video» presente, con download del file");

  // Modifica oltre le 2 incluse: consuma un video della prova
  await page.getByText(/Questa modifica usa 1 dei tuoi video della prova/).first().waitFor();
  await tap(page.getByRole("button", { name: "Chiedi un'altra modifica" }));
  await page.fill("#message", `Togli la musica ${run}`);
  await page.screenshot({ path: `${DIR}/t-01-modifica-extra.png`, fullPage: true });
  await tap(page.getByRole("button", { name: "Usa 1 video e invia" }));
  let fb;
  for (let i = 0; i < 30; i++) {
    ({ data: fb } = await db.from("video_feedback").select("id, quota_kind, message").eq("video_id", video.id).order("created_at", { ascending: false }).limit(1).single());
    if (fb?.message === `Togli la musica ${run}`) break;
    await sleep(500);
  }
  const { data: wsAfter } = await db.from("workspaces").select("trial_videos_left").eq("id", video.workspace_id).single();
  check(wsAfter.trial_videos_left === trialBefore - 1 && fb.quota_kind === "trial", "3ª modifica: scalato 1 video della prova");
  await db.rpc("release_feedback_quota", { p_feedback_id: fb.id });
  await db.rpc("release_feedback_quota", { p_feedback_id: fb.id });
  const { data: wsBack } = await db.from("workspaces").select("trial_videos_left").eq("id", video.workspace_id).single();
  check(wsBack.trial_videos_left === trialBefore, "modifica non riuscita: il video torna disponibile, una volta sola");

  // Aspetto la nuova versione (worker), poi girato "vecchio" di 91 giorni → cancellato
  for (let i = 0; i < 120; i++) {
    const { data } = await db.from("videos").select("status").eq("id", video.id).single();
    if (["review", "internal_review"].includes(data.status)) break;
    await sleep(1000);
  }
  const { data: raw } = await db.from("raw_uploads").select("storage_path").eq("id", video.raw_upload_id).single();
  await db.from("raw_uploads").update({ created_at: new Date(Date.now() - 91 * DAY).toISOString() }).eq("id", video.raw_upload_id);
  await db.from("videos").update({ status: "review" }).eq("id", video.id);
  await runRetention();
  const { data: rawAfter } = await db.from("raw_uploads").select("purged_at, transcript").eq("id", video.raw_upload_id).single();
  const { data: stillThere } = await db.storage.from("raw").list(raw.storage_path.split("/").slice(0, -1).join("/"));
  check(rawAfter.purged_at && rawAfter.transcript === null && !(stillThere ?? []).length, "girato oltre 90 giorni: file e trascrizione cancellati");
  await page.goto(`${APP}/video/${video.id}`);
  await page.getByText(/non si può più rimontare/).first().waitFor();
  check(await page.getByRole("link", { name: "Scarica il video" }).isVisible(), "video finito ancora visibile e scaricabile, modifiche chiuse");

  // Cessazione: abbonamento chiuso da 25 giorni → avviso; dopo i 30 giorni (e 7 di preavviso) → cancellazione
  const wsId = video.workspace_id;
  await db.from("workspaces").update({ plan_id: "start", subscription_status: "canceled", period_end: new Date(Date.now() - 25 * DAY).toISOString() }).eq("id", wsId);
  await runRetention();
  const { data: warned } = await db.from("workspaces").select("content_purge_warned_at, content_purged_at").eq("id", wsId).single();
  check(warned.content_purge_warned_at && !warned.content_purged_at, "cessazione: avviso registrato, niente cancellato ancora");
  await mailTo(email, (m) => /restano disponibili fino al/.test(m.Subject));
  check(true, "email «Scarica i tuoi video» ricevuta dal titolare");

  await db.from("workspaces").update({ period_end: new Date(Date.now() - 31 * DAY).toISOString(), content_purge_warned_at: new Date(Date.now() - 8 * DAY).toISOString() }).eq("id", wsId);
  await runRetention();
  const [{ data: purged }, { count: vids }, { count: members }, outFiles] = await Promise.all([
    db.from("workspaces").select("content_purged_at, logo_url").eq("id", wsId).single(),
    db.from("videos").select("id", { count: "exact", head: true }).eq("workspace_id", wsId),
    db.from("workspace_members").select("user_id", { count: "exact", head: true }).eq("workspace_id", wsId),
    db.storage.from("output").list(wsId),
  ]);
  check(purged.content_purged_at && !purged.logo_url && vids === 0 && !(outFiles.data ?? []).length, "30 giorni dopo la cessazione: video, file e logo cancellati");
  check(members > 0, "account e membri conservati");
  const { count: audit } = await db.from("audit_log").select("id", { count: "exact", head: true }).eq("workspace_id", wsId).like("action", "retention.%");
  check(audit >= 3, "ogni passaggio nel registro attività");

  await browser.close();
  log("FLUSSO TERMINI OK");
})().catch((e) => {
  console.error("✗ ERRORE:", e.message);
  process.exit(1);
});
