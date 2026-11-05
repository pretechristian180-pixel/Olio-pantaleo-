import type { BillingEvent, BillingInterval, BillingProvider, SubscriptionSnapshot } from "../providers/billing.js";
import { brandedEmail, getEmailProvider } from "../email/index.js";
import type { Json } from "../database.types.js";
import type { AdminDb } from "./scripts-service.js";

type PlanRow = { id: string; name: string; stripe_price_monthly_id: string | null; stripe_price_yearly_id: string | null };

/** Piano e periodicità corrispondenti a un prezzo Stripe. */
export async function planForPrice(db: AdminDb, priceId: string | null) {
  if (!priceId) return null;
  const { data } = await db
    .from("plans")
    .select("id, name, stripe_price_monthly_id, stripe_price_yearly_id")
    .or(`stripe_price_monthly_id.eq.${priceId},stripe_price_yearly_id.eq.${priceId}`)
    .limit(1);
  const plan = (data?.[0] as PlanRow | undefined) ?? null;
  if (!plan) return null;
  const interval: BillingInterval = plan.stripe_price_yearly_id === priceId ? "year" : "month";
  return { plan, interval };
}

/** Azienda che paga per un abbonamento (dai metadati, dall'id abbonamento o dal cliente). */
async function findBillingWorkspace(db: AdminDb, opts: { workspaceId?: string | null; subscriptionId?: string | null; customerId?: string | null }) {
  const cols = "id, name, billing_workspace_id, stripe_customer_id, stripe_subscription_id, subscription_status, plan_id, period_start, period_end, billing_interval";
  const tries: [string, string | null | undefined][] = [
    ["id", opts.workspaceId],
    ["stripe_subscription_id", opts.subscriptionId],
    ["stripe_customer_id", opts.customerId],
  ];
  for (const [col, value] of tries) {
    if (!value) continue;
    const { data } = await db.from("workspaces").select(cols).eq(col, value).maybeSingle();
    if (data) {
      if (data.billing_workspace_id) {
        const { data: payer } = await db.from("workspaces").select(cols).eq("id", data.billing_workspace_id).maybeSingle();
        if (payer) return payer;
      }
      return data;
    }
  }
  return null;
}

/** Applica lo stato dell'abbonamento all'azienda che paga (i brand collegati lo ricevono dal trigger). */
export async function applySubscription(db: AdminDb, snap: SubscriptionSnapshot) {
  const ws = await findBillingWorkspace(db, { workspaceId: snap.workspaceId, subscriptionId: snap.id, customerId: snap.customerId || null });
  if (!ws) throw new Error(`Nessuna azienda per l'abbonamento ${snap.id}`);

  // Un vecchio abbonamento che si chiude dopo che ne è partito uno nuovo non tocca nulla.
  if (ws.stripe_subscription_id && ws.stripe_subscription_id !== snap.id && snap.status !== "active") {
    return { workspaceId: ws.id, skipped: true };
  }

  const match = await planForPrice(db, snap.priceId);
  const { error } = await db
    .from("workspaces")
    .update({
      ...(match ? { plan_id: match.plan.id } : {}),
      ...(snap.customerId ? { stripe_customer_id: snap.customerId } : {}),
      stripe_subscription_id: snap.id,
      subscription_status: snap.status,
      period_start: snap.periodStart?.toISOString() ?? ws.period_start,
      period_end: snap.periodEnd?.toISOString() ?? ws.period_end,
      billing_interval: snap.interval ?? match?.interval ?? (ws.billing_interval as BillingInterval | null),
      cancel_at_period_end: snap.cancelAtPeriodEnd,
      ...(snap.status === "active" ? { payment_failed_at: null } : {}),
    })
    .eq("id", ws.id);
  if (error) throw new Error(`Aggiornamento abbonamento non riuscito: ${error.message}`);
  // Cambio piano: i social inclusi restano entro il nuovo limite (azienda e brand collegati).
  const { data: brands } = await db.from("workspaces").select("id").eq("billing_workspace_id", ws.id);
  for (const id of [ws.id, ...(brands ?? []).map((b) => b.id)]) await enforceSocialLimit(db, id);
  if (!match && snap.status === "active") {
    throw new Error(`Prezzo ${snap.priceId} non collegato a nessun piano: controlla plans.stripe_price_*`);
  }
  return { workspaceId: ws.id, skipped: false };
}

async function ownerEmails(db: AdminDb, workspaceId: string) {
  const { data: owners } = await db.from("workspace_members").select("user_id").eq("workspace_id", workspaceId).eq("role", "owner");
  const emails: string[] = [];
  for (const o of owners ?? []) {
    const { data } = await db.auth.admin.getUserById(o.user_id);
    if (data.user?.email) emails.push(data.user.email);
  }
  return emails;
}

/**
 * Elabora un evento di pagamento una sola volta (stripe_events). Se fallisce, l'errore
 * resta registrato e l'evento può essere rielaborato al prossimo invio del fornitore.
 */
export async function processBillingEvent(
  db: AdminDb,
  provider: BillingProvider,
  event: BillingEvent,
  opts: { appUrl: string },
): Promise<"processed" | "duplicate" | "ignored"> {
  if (event.type === "ignored") return "ignored";

  const { data: seen } = await db.from("stripe_events").select("processed_at").eq("id", event.id).maybeSingle();
  if (seen?.processed_at) return "duplicate";
  if (!seen) {
    const { error } = await db.from("stripe_events").insert({ id: event.id, type: event.type, payload: event as unknown as Json });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
  }

  try {
    await handle(db, provider, event, opts);
    await db.from("stripe_events").update({ processed_at: new Date().toISOString(), error: null }).eq("id", event.id);
    return "processed";
  } catch (e) {
    await db.from("stripe_events").update({ error: String(e).slice(0, 1000) }).eq("id", event.id);
    throw e;
  }
}

async function handle(db: AdminDb, provider: BillingProvider, event: BillingEvent, opts: { appUrl: string }) {
  switch (event.type) {
    case "checkout.completed": {
      const ws = await findBillingWorkspace(db, { workspaceId: event.workspaceId, customerId: event.customerId });
      if (!ws) throw new Error(`Checkout senza azienda (${event.workspaceId})`);
      await db
        .from("workspaces")
        .update({ stripe_customer_id: event.customerId, stripe_subscription_id: event.subscriptionId })
        .eq("id", ws.id);
      const snap = await provider.getSubscription(event.subscriptionId);
      if (snap) await applySubscription(db, { ...snap, workspaceId: snap.workspaceId ?? ws.id });
      return;
    }
    case "subscription.changed": {
      // Lo stato più recente dal fornitore: gli eventi possono arrivare in disordine.
      const snap = (await provider.getSubscription(event.subscriptionId)) ?? event.subscription;
      if (snap) await applySubscription(db, snap);
      return;
    }
    case "payment.succeeded": {
      const ws = await findBillingWorkspace(db, { subscriptionId: event.subscriptionId, customerId: event.customerId });
      if (!ws) return;
      await db.from("workspaces").update({ payment_failed_at: null }).eq("id", ws.id);
      if (event.subscriptionId) {
        const snap = await provider.getSubscription(event.subscriptionId);
        if (snap) await applySubscription(db, snap);
      }
      return;
    }
    case "payment.failed": {
      const ws = await findBillingWorkspace(db, { subscriptionId: event.subscriptionId, customerId: event.customerId });
      if (!ws) return;
      await db.from("workspaces").update({ payment_failed_at: new Date().toISOString() }).eq("id", ws.id);
      if (event.subscriptionId) {
        const snap = await provider.getSubscription(event.subscriptionId);
        if (snap) await applySubscription(db, snap);
      }
      const mail = brandedEmail({
        title: "Il pagamento non è andato a buon fine",
        intro: `Non siamo riusciti a rinnovare l'abbonamento di ${ws.name}. Aggiorna il pagamento entro 2 giorni: dopo, i nuovi montaggi si mettono in pausa. Video, calendario e post restano tutti al loro posto.`,
        ctaLabel: "Aggiorna il pagamento",
        ctaUrl: `${opts.appUrl}/piano`,
        outro: "Stripe riproverà da solo nei prossimi giorni. Se hai dubbi rispondi a questa email.",
      });
      const email = getEmailProvider();
      for (const to of await ownerEmails(db, ws.id)) {
        await email.send({ to, subject: "Pagamento non riuscito — Nexora Studio", ...mail }).catch(() => undefined);
      }
      return;
    }
  }
}

/**
 * Cambio piano su un abbonamento attivo. Il fornitore conguaglia; l'app aggiorna subito
 * il piano senza aspettare il webhook (che poi conferma lo stesso stato).
 */
export async function changeSubscriptionPlan(db: AdminDb, provider: BillingProvider, workspaceId: string, priceId: string) {
  const { data: ws } = await db
    .from("workspaces")
    .select("id, stripe_customer_id, stripe_subscription_id, period_start, period_end, billing_interval")
    .eq("id", workspaceId)
    .single();
  if (!ws?.stripe_subscription_id) throw new Error("Nessun abbonamento attivo");
  const snap = await provider.changePrice(ws.stripe_subscription_id, priceId);
  if (!snap) return;
  const match = await planForPrice(db, priceId);
  await applySubscription(db, {
    ...snap,
    customerId: snap.customerId || ws.stripe_customer_id || "",
    workspaceId: ws.id,
    interval: snap.interval ?? match?.interval ?? null,
    periodStart: snap.periodStart ?? (ws.period_start ? new Date(ws.period_start) : null),
    periodEnd: snap.periodEnd ?? (ws.period_end ? new Date(ws.period_end) : null),
  });
}

/** Social inclusi nel piano per ciascun brand (null: prova gratuita, nessun limite). */
export async function socialLimit(db: AdminDb, workspaceId: string) {
  const { data: ws } = await db.from("workspaces").select("plan_id").eq("id", workspaceId).single();
  if (!ws?.plan_id) return null;
  const { data: plan } = await db.from("plans").select("social_accounts_max").eq("id", ws.plan_id).single();
  return plan?.social_accounts_max ?? null;
}

/**
 * Mantiene i social inclusi entro il limite del piano: oltre il limite i più recenti
 * vengono esclusi (restano collegati, il cliente sceglie quali includere).
 */
export async function enforceSocialLimit(db: AdminDb, workspaceId: string) {
  const limit = await socialLimit(db, workspaceId);
  if (limit === null) return 0;
  const { data: enabled } = await db
    .from("social_accounts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("status", "connected")
    .eq("enabled", true)
    .order("created_at");
  const extra = (enabled ?? []).slice(limit).map((a) => a.id);
  if (extra.length) await db.from("social_accounts").update({ enabled: false }).in("id", extra);
  return extra.length;
}
