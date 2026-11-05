// Fase 5: prova finita → scelta del piano (pagamento simulato) → limite del mese → upgrade →
// brand aggiuntivi (Business) → pagamento fallito (webhook) → rinnovo → disdetta.
// Richiede l'app con BILLING_PROVIDER=demo, STRIPE_WEBHOOK_SECRET, EMAIL_PROVIDER=mailpit e
// SUPABASE_SECRET_KEY (per preparare i dati di prova). Non serve il worker.
const { createHmac } = require("node:crypto");
const { chromium, devices } = require("playwright");
const { createClient } = require("@supabase/supabase-js");

const DIR = process.env.E2E_ASSETS ?? `${__dirname}/.assets`;
const APP = "http://localhost:3000";
const MAIL = "http://127.0.0.1:54324/api/v1";
const SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const db = createClient("http://127.0.0.1:54321", process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const run = Date.now().toString(36);
const BIZ = `Officina Rossi ${run}`;
const U = { name: "Marco Rossi", email: `marco.${run}@test.it`, pw: "Marco2026!" };
const log = (...a) => console.log("•", ...a);
const t0 = Date.now();
const secs = () => `${Math.round((Date.now() - t0) / 1000)}s`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (p, n) => p.screenshot({ path: `${DIR}/${n}.png`, fullPage: true });
const check = (cond, msg) => {
  if (!cond) throw new Error(`controllo fallito: ${msg}`);
  log(secs(), msg);
};

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

async function webhook(event, signature) {
  const body = JSON.stringify(event);
  const res = await fetch(`${APP}/api/billing/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-demo-signature": signature ?? createHmac("sha256", SECRET).update(body).digest("hex") },
    body,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function onboarding(page, name) {
  await page.waitForURL("**/onboarding");
  await page.fill("#name", name);
  await page.selectOption("#sector", "automotive");
  await page.fill("#city", "Lecce");
  await page.click('button:has-text("Continua")');
  await page.getByText("Il tuo brand").waitFor();
  await page.fill("#tone_of_voice", "Diretto e competente");
  await page.fill("#target_audience", "Automobilisti di Lecce");
  await page.fill("#services", "Tagliandi, gomme, revisioni");
  await page.click('button:has-text("Continua")');
  await page.click('button:has-text("Salta per ora")');
  await page.click('button:has-text("Finito")');
  await page.waitForURL("**/onboarding/fatto");
}

(async () => {
  if (!SECRET) throw new Error("STRIPE_WEBHOOK_SECRET mancante");
  // Prezzi demo per i piani (in produzione li scrive npm run stripe:setup)
  for (const id of ["start", "pro", "business"]) {
    await db.from("plans").update({ stripe_price_monthly_id: `price_demo_${id}_month`, stripe_price_yearly_id: `price_demo_${id}_year` }).eq("id", id).is("stripe_price_monthly_id", null);
  }
  const { data: plans } = await db.from("plans").select("id, stripe_price_monthly_id");
  const price = Object.fromEntries(plans.map((p) => [p.id, p.stripe_price_monthly_id]));

  const browser = await chromium.launch();
  const page = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();

  // Registrazione e onboarding
  await page.goto(`${APP}/registrati`);
  await page.fill("#full_name", U.name);
  await page.fill("#email", U.email);
  await page.fill("#password", U.pw);
  await page.check('input[name="terms"]');
  await page.click('button[type="submit"]');
  const conf = await mailTo(U.email, (m) => /token_hash/.test(m.HTML));
  await page.goto(conf.HTML.match(/href="([^"]*token_hash[^"]*)"/)[1].replace(/&amp;/g, "&"));
  await onboarding(page, BIZ);
  const { data: ws } = await db.from("workspaces").select("id").eq("name", BIZ).single();
  log(secs(), "onboarding completato");

  // Prova finita: caricamento bloccato con invito al piano
  await db.from("workspaces").update({ trial_videos_left: 0 }).eq("id", ws.id);
  await page.goto(`${APP}/video/carica`);
  await page.getByText("Hai usato i 3 video della prova").waitFor();
  check(await page.getByRole("link", { name: "Scegli il piano" }).isVisible(), "prova finita: caricamento bloccato con «Scegli il piano»");

  // Scelta del piano Pro (checkout simulato)
  await page.goto(`${APP}/piano`);
  await shot(page, "f5-01-piani");
  await page.getByRole("button", { name: "Scegli Pro" }).click();
  await page.waitForURL("**/piano?attivato=1");
  await page.getByText("Abbonamento attivo").first().waitFor();
  let { data: w } = await db.from("workspaces").select("*").eq("id", ws.id).single();
  check(w.plan_id === "pro" && w.subscription_status === "active" && w.stripe_subscription_id, "piano Pro attivo dopo il pagamento");
  await shot(page, "f5-02-pro-attivo");

  // Limite del mese raggiunto
  await db.from("usage_counters").upsert({ workspace_id: ws.id, period_start: w.period_start, period_end: w.period_end, videos_used: 12 });
  await page.goto(`${APP}/video/carica`);
  await page.getByText("Hai montato tutti i video del mese").waitFor();
  check(true, "12/12 video: caricamento bloccato");

  // Upgrade a Business
  await page.goto(`${APP}/piano`);
  await page.getByRole("button", { name: "Passa a Business" }).click();
  await page.getByText("Fatto: ora sei sul piano Business.").waitFor();
  await shot(page, "f5-03-cambio-piano");
  ({ data: w } = await db.from("workspaces").select("*").eq("id", ws.id).single());
  check(w.plan_id === "business", "upgrade a Business");
  await page.goto(`${APP}/video/carica`);
  await page.getByRole("heading", { name: "Carica il video" }).waitFor();
  check((await page.getByText("Hai montato tutti").count()) === 0, "dopo l'upgrade si carica di nuovo (12/25)");

  // Brand aggiuntivi
  await page.goto(`${APP}/piano`);
  await page.fill("#brand_name", `Gommista Rossi ${run}`);
  await page.getByRole("button", { name: "Aggiungi brand" }).click();
  await onboarding(page, `Gommista Rossi ${run}`);
  const { data: b2 } = await db.from("workspaces").select("*").eq("billing_workspace_id", ws.id).single();
  check(b2.plan_id === "business" && b2.subscription_status === "active", "secondo brand coperto dall'abbonamento");
  await page.goto(`${APP}/piano`);
  await page.getByText("Ne restano 25.").first().waitFor();
  check(true, "brand 2: 25 video propri (contatore separato dal brand principale)");
  await shot(page, "f5-04-brand-due");

  // Pagamento fallito: tutti i brand in pausa, nulla cancellato, email al titolare
  const failed = await webhook({ id: `evt_test_${run}_1`, type: "payment.failed", customerId: w.stripe_customer_id, subscriptionId: w.stripe_subscription_id });
  check(failed.status === 200, "webhook pagamento fallito accettato");
  const snap = (status, start, end) => ({
    id: w.stripe_subscription_id,
    customerId: w.stripe_customer_id,
    status,
    priceId: price.business,
    interval: "month",
    periodStart: start,
    periodEnd: end,
    cancelAtPeriodEnd: false,
    workspaceId: ws.id,
  });
  await webhook({ id: `evt_test_${run}_2`, type: "subscription.changed", subscriptionId: w.stripe_subscription_id, subscription: snap("past_due", w.period_start, w.period_end) });
  const dup = await webhook({ id: `evt_test_${run}_2`, type: "subscription.changed", subscriptionId: w.stripe_subscription_id, subscription: snap("past_due", w.period_start, w.period_end) });
  check(dup.json?.result === "duplicate", "evento ripetuto ignorato");
  const bad = await webhook({ id: `evt_test_${run}_3`, type: "payment.failed", customerId: "x", subscriptionId: null }, "firma-sbagliata");
  check(bad.status === 400, "firma non valida rifiutata");
  const { data: all } = await db.from("workspaces").select("subscription_status").or(`id.eq.${ws.id},billing_workspace_id.eq.${ws.id}`);
  check(all.length === 2 && all.every((x) => x.subscription_status === "past_due"), "pagamento fallito propagato ai brand");
  await page.goto(`${APP}/video/carica`);
  await page.getByText("L'ultimo pagamento non è andato a buon fine").waitFor();
  check(true, "pagamento fallito: caricamento bloccato con messaggio");
  await mailTo(U.email, (m) => /Pagamento non riuscito/.test(m.Subject));
  check(true, "email «Pagamento non riuscito» ricevuta");
  await shot(page, "f5-05-pagamento-fallito");

  // Rinnovo: nuovo periodo, contatori da zero
  const start = new Date(w.period_end);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  await webhook({ id: `evt_test_${run}_4`, type: "payment.succeeded", customerId: w.stripe_customer_id, subscriptionId: w.stripe_subscription_id });
  await webhook({ id: `evt_test_${run}_5`, type: "subscription.changed", subscriptionId: w.stripe_subscription_id, subscription: snap("active", start.toISOString(), end.toISOString()) });
  await page.context().clearCookies();
  await page.goto(`${APP}/accedi?next=/piano`);
  await page.fill("#email", U.email);
  await page.fill("#password", U.pw);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => u.pathname === "/piano");
  ({ data: w } = await db.from("workspaces").select("*").eq("id", ws.id).single());
  check(w.subscription_status === "active" && !w.payment_failed_at, "rinnovo: abbonamento di nuovo attivo");
  await page.goto(`${APP}/inizio`);
  await page.getByText("Ne restano 25.").first().waitFor();
  check(true, "rinnovo: contatori azzerati (25 disponibili)");

  // Disdetta a fine periodo, poi chiusura
  await webhook({ id: `evt_test_${run}_6`, type: "subscription.changed", subscriptionId: w.stripe_subscription_id, subscription: { ...snap("active", start.toISOString(), end.toISOString()), cancelAtPeriodEnd: true } });
  await page.goto(`${APP}/piano`);
  await page.getByText("Abbonamento disdetto").waitFor();
  check(true, "disdetta: avviso con la data di fine");
  await webhook({ id: `evt_test_${run}_7`, type: "subscription.changed", subscriptionId: w.stripe_subscription_id, subscription: snap("canceled", start.toISOString(), end.toISOString()) });
  await page.goto(`${APP}/video/carica`);
  await page.getByText("L'abbonamento non è attivo").waitFor();
  const { count: videos } = await db.from("brand_profiles").select("workspace_id", { count: "exact", head: true }).eq("workspace_id", ws.id);
  check(videos === 1, "abbonamento chiuso: caricamento bloccato, dati conservati");
  await shot(page, "f5-06-disdetto");

  await browser.close();
  log("FLUSSO FASE 5 OK");
})().catch((e) => {
  console.error("✗ ERRORE:", e.message);
  process.exit(1);
});
