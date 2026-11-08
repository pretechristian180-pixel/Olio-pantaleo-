"use server";

import { changeSubscriptionPlan, createBillingProvider } from "@nexora/shared/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { FormState } from "@/components/forms/form-message";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_WORKSPACE_COOKIE, assertMember, getSessionContext } from "@/lib/workspace";

function str(fd: FormData, key: string, max = 200) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Esito con eventuale pagina esterna da aprire (pagamento o portale): il browser ci va con una navigazione completa. */
export type BillingFormState = (NonNullable<FormState> & { redirect?: string }) | null;

const NOT_CONFIGURED = "I pagamenti non sono ancora attivi. Scrivici e attiviamo il piano per te.";

/** L'azienda che paga per il brand indicato; serve esserne titolari. */
async function payerOf(workspaceId: string) {
  const { membership } = await assertMember(workspaceId);
  const payerId = membership.workspace.billing_workspace_id ?? workspaceId;
  const { ctx, membership: payer } = await assertMember(payerId, "owner");
  return { ctx, payer: payer.workspace };
}

/** "Scegli il piano": pagina di pagamento, oppure cambio piano se l'abbonamento è attivo. */
export async function choosePlanAction(
  _prev: BillingFormState,
  fd: FormData,
): Promise<BillingFormState> {
  const interval = str(fd, "interval") === "year" ? "year" : "month";
  let changed = false;
  try {
    const { ctx, payer } = await payerOf(str(fd, "workspace_id"));
    const provider = createBillingProvider();
    if (!provider) return { error: NOT_CONFIGURED };

    const admin = createAdminClient();
    const { data: plan } = await admin
      .from("plans")
      .select("id, name, active, stripe_price_monthly_id, stripe_price_yearly_id")
      .eq("id", str(fd, "plan_id"))
      .maybeSingle();
    const priceId =
      interval === "year" ? plan?.stripe_price_yearly_id : plan?.stripe_price_monthly_id;
    if (!plan?.active) return { error: "Piano non disponibile." };
    if (!priceId) return { error: NOT_CONFIGURED };

    // Brand già collegati: un piano con meno brand non li coprirebbe.
    const { count } = await admin
      .from("workspaces")
      .select("id", { count: "exact", head: true })
      .eq("billing_workspace_id", payer.id);
    const { data: limits } = await admin
      .from("plans")
      .select("brands_max")
      .eq("id", plan.id)
      .single();
    if ((count ?? 0) + 1 > (limits?.brands_max ?? 1)) {
      return {
        error: `Il piano ${plan.name} copre ${limits?.brands_max ?? 1} brand: ne hai ${(count ?? 0) + 1}.`,
      };
    }

    if (
      payer.stripe_subscription_id &&
      ["active", "past_due"].includes(payer.subscription_status)
    ) {
      if (payer.plan_id === plan.id && payer.billing_interval === interval) {
        return { error: "È già il tuo piano." };
      }
      await changeSubscriptionPlan(admin, provider, payer.id, priceId);
      revalidatePath("/", "layout");
      changed = true;
    }

    if (!changed) {
      const coupon = payer.founding_member ? (process.env.STRIPE_FOUNDING_COUPON_ID ?? null) : null;
      const { url } = await provider.createCheckout({
        workspaceId: payer.id,
        customerId: payer.stripe_customer_id,
        email: ctx.user.email,
        priceId,
        planId: plan.id,
        interval,
        couponId: coupon,
        successUrl: `${publicEnv.appUrl}/piano?attivato=1`,
        cancelUrl: `${publicEnv.appUrl}/piano`,
      });
      return { success: "Ti portiamo alla pagina di pagamento…", redirect: url };
    }
  } catch (e) {
    console.error("scelta piano", e);
    return {
      error:
        e instanceof Error && e.message.length < 120
          ? e.message
          : "Non siamo riusciti ad aprire il pagamento. Riprova.",
    };
  }
  redirect("/piano?cambiato=1");
}

/** Portale Stripe: carta, fatture, disdetta. */
export async function openBillingPortalAction(
  _prev: BillingFormState,
  fd: FormData,
): Promise<BillingFormState> {
  try {
    const { payer } = await payerOf(str(fd, "workspace_id"));
    const provider = createBillingProvider();
    if (!provider) return { error: NOT_CONFIGURED };
    if (!payer.stripe_customer_id) return { error: "Non hai ancora un abbonamento." };
    const { url } = await provider.createPortal(
      payer.stripe_customer_id,
      `${publicEnv.appUrl}/piano`,
    );
    return { success: "Apertura del portale…", redirect: url };
  } catch (e) {
    console.error("portale pagamenti", e);
    return { error: "Non siamo riusciti ad aprire il portale. Riprova." };
  }
}

/** Nuovo brand coperto dall'abbonamento (piano Business). */
export async function createBrandAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const name = str(fd, "name", 120);
  if (name.length < 2) return { fieldErrors: { name: "Scrivi il nome del brand." } };
  let id: string;
  try {
    const { payer } = await payerOf(str(fd, "workspace_id"));
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_brand", {
      p_billing_workspace_id: payer.id,
      p_name: name,
    });
    if (error || !data) return { error: error?.message ?? "Non siamo riusciti a creare il brand." };
    id = data.id;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Non siamo riusciti a creare il brand." };
  }
  const store = await cookies();
  store.set(ACTIVE_WORKSPACE_COOKIE, id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/onboarding");
}

/** Team CP Studio: segna o toglie il prezzo bloccato da founding member. */
export async function adminToggleFoundingAction(fd: FormData) {
  const ctx = await getSessionContext();
  if (!ctx?.profile?.is_admin) throw new Error("Solo il team CP Studio.");
  const id = String(fd.get("workspace_id"));
  const admin = createAdminClient();
  const { data } = await admin.from("workspaces").select("founding_member").eq("id", id).single();
  await admin.from("workspaces").update({ founding_member: !data?.founding_member }).eq("id", id);
  revalidatePath("/admin/abbonamenti");
}
