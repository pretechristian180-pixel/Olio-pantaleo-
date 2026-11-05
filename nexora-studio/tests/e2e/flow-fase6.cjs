// Fase 6: area admin. Dashboard, monitor dei job (riprova / annulla), costi per video, piani,
// accesso negato a chi non è del team. Richiede app e worker attivi, l'utente admin
// team@nexora.test (crea-admin.mjs) e SUPABASE_SECRET_KEY. Conviene lanciarlo dopo
// flow-fase3/4, così ci sono video montati e costi da mostrare.
const { chromium, devices } = require("playwright");
const { createClient } = require("@supabase/supabase-js");

const DIR = process.env.E2E_ASSETS ?? `${__dirname}/.assets`;
const APP = "http://localhost:3000";
const db = createClient("http://127.0.0.1:54321", process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const run = Date.now().toString(36);
const log = (...a) => console.log("•", ...a);
const t0 = Date.now();
const secs = () => `${Math.round((Date.now() - t0) / 1000)}s`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (cond, msg) => {
  if (!cond) throw new Error(`controllo fallito: ${msg}`);
  log(secs(), msg);
};

async function login(page, email, pw, next) {
  await page.goto(`${APP}/accedi?next=${next}`);
  await page.fill("#email", email);
  await page.fill("#password", pw);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => u.pathname === next);
}

(async () => {
  const browser = await chromium.launch();
  const admin = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await login(admin, "team@nexora.test", "Team2026!", "/admin");

  // Dashboard
  await admin.getByText("Ricavi ricorrenti (mese)").waitFor();
  await admin.getByText("Video caricati al giorno").waitFor();
  const bars = await admin.locator("figure [tabindex='0']").count();
  check(bars === 14, "dashboard: grafico dei 14 giorni");
  const lastBar = admin.locator("figure [tabindex='0']").last();
  await lastBar.hover();
  check(await lastBar.getByText(/: \d+ video/).isVisible(), "dashboard: dettaglio al passaggio del mouse");
  await admin.screenshot({ path: `${DIR}/f6-01-dashboard.png`, fullPage: true });

  // Job: un job fallito da riprovare e uno in coda da annullare
  const { data: ws } = await db.from("workspaces").select("id").not("metricool_blog_id", "is", null).limit(1).single();
  const failedKey = `e2e:${run}:failed`;
  const { data: failedId } = await db.rpc("enqueue_job", {
    p_type: "sync_social",
    p_workspace_id: ws.id,
    p_payload: { workspace_id: ws.id },
    p_dedupe_key: failedKey,
    p_run_after: new Date(Date.now() + 3600e3).toISOString(),
  });
  await db.from("jobs").update({ status: "failed", attempts: 3, last_error: "Errore di prova (e2e)", finished_at: new Date().toISOString() }).eq("id", failedId);
  const { data: queuedId } = await db.rpc("enqueue_job", {
    p_type: "generate_scripts",
    p_workspace_id: ws.id,
    p_payload: { workspace_id: ws.id, week_start: "2030-01-07" },
    p_dedupe_key: `e2e:${run}:queued`,
    p_run_after: new Date(Date.now() + 3600e3).toISOString(),
  });

  await admin.goto(`${APP}/admin/job?stato=failed`);
  const failedRow = admin.locator("li", { hasText: "Errore di prova (e2e)" }).first();
  await failedRow.waitFor();
  await admin.screenshot({ path: `${DIR}/f6-02-job-falliti.png`, fullPage: true });
  await failedRow.getByRole("button", { name: "Riprova" }).click();
  await admin.getByText("Job rimesso in coda.").waitFor();
  let job;
  for (let i = 0; i < 30; i++) {
    ({ data: job } = await db.from("jobs").select("status, attempts").eq("id", failedId).single());
    if (job.status === "done") break;
    await sleep(1000);
  }
  check(job.status === "done", "job fallito riprovato ed eseguito dal worker");

  await admin.goto(`${APP}/admin/job?stato=queued&tipo=generate_scripts`);
  admin.once("dialog", (d) => d.accept());
  const queuedRow = admin.locator("li", { hasText: "Script della settimana" }).first();
  await queuedRow.getByRole("button", { name: "Annulla" }).click();
  await admin.getByText("Job annullato.").waitFor();
  const { data: canceled } = await db.from("jobs").select("status, last_error").eq("id", queuedId).single();
  check(canceled.status === "failed" && /Annullato/.test(canceled.last_error), "job in coda annullato");
  const { count: audits } = await db.from("audit_log").select("id", { count: "exact", head: true }).in("action", ["admin.job.retry", "admin.job.cancel"]).contains("details", { job_id: queuedId });
  check(audits === 1, "azione registrata nel registro attività");

  // Costi per video
  await admin.goto(`${APP}/admin/costi`);
  await admin.getByText("Per video", { exact: true }).waitFor();
  const rows = await admin.locator("tbody tr").count();
  check(rows > 0, `costi: ${rows} video con il costo scomposto`);
  check(!(await admin.getByText("Costo medio per video montato").locator("..").getByText("—").count()), "costi: costo medio calcolato");
  await admin.screenshot({ path: `${DIR}/f6-03-costi.png`, fullPage: true });

  // Piani: modifica e ripristino di un limite
  const { data: start } = await db.from("plans").select("videos_per_month").eq("id", "start").single();
  await admin.goto(`${APP}/admin/piani`);
  const form = admin.locator("form", { hasText: "Salva Start" });
  await form.locator('input[name="videos_per_month"]').fill(String(start.videos_per_month + 1));
  await form.getByRole("button", { name: "Salva Start" }).click();
  await admin.getByText("Piano Start salvato.").waitFor();
  const { data: after } = await db.from("plans").select("videos_per_month").eq("id", "start").single();
  check(after.videos_per_month === start.videos_per_month + 1, "piani: limite modificato dall'admin");
  await db.from("plans").update({ videos_per_month: start.videos_per_month }).eq("id", "start");

  // Un cliente non entra nell'area admin
  const { data: u } = await db.auth.admin.createUser({ email: `cliente.${run}@test.it`, password: "Cliente2026!", email_confirm: true });
  const client = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
  await client.goto(`${APP}/accedi`);
  await client.fill("#email", `cliente.${run}@test.it`);
  await client.fill("#password", "Cliente2026!");
  await client.click('button[type="submit"]');
  await client.waitForURL((x) => x.pathname !== "/accedi");
  for (const path of ["/admin", "/admin/job", "/admin/costi", "/admin/piani"]) {
    const res = await client.goto(`${APP}${path}`);
    if (res.status() !== 404) throw new Error(`${path} accessibile a un cliente (${res.status()})`);
  }
  check(true, "area admin: 404 per chi non è del team");
  await db.auth.admin.deleteUser(u.user.id);

  // Dashboard da telefono
  const phone = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
  await login(phone, "team@nexora.test", "Team2026!", "/admin");
  await phone.getByText("Ricavi ricorrenti (mese)").waitFor();
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(!overflow, "dashboard da telefono senza scorrimento orizzontale");
  await phone.screenshot({ path: `${DIR}/f6-04-dashboard-telefono.png`, fullPage: true });

  await browser.close();
  log("FLUSSO FASE 6 OK");
})().catch((e) => {
  console.error("✗ ERRORE:", e.message);
  process.exit(1);
});
