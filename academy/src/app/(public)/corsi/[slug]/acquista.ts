"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { originFromHost } from "@/lib/billing";
import { isStripeConfigured, stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant, isNexoraTenant, isTenantOpen, requestHost } from "@/lib/tenant";

/**
 * Acquisto di un corso: crea l'ordine e apre il pagamento Stripe.
 * I corsi Nexora si pagano sul conto della piattaforma, quelli dei clienti sul loro conto
 * collegato, senza commissioni per Nexora.
 */
export async function buyCourse(slug: string, formData: FormData) {
  const back = `/corsi/${encodeURIComponent(slug)}`;
  const user = await requireUser(back);
  const tenant = await getCurrentTenant();
  const origin = originFromHost(await requestHost());
  if (!tenant || !isTenantOpen(tenant) || !origin || !isStripeConfigured())
    redirect(`${back}?acquisto=non-disponibile`);

  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("id, slug, titolo, sottotitolo, prezzo_cents, valuta")
    .eq("tenant_id", tenant.id)
    .eq("slug", slug)
    .eq("stato", "published")
    .maybeSingle();
  if (!course) redirect("/corsi");

  const { data: enrolled } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("course_id", course.id)
    .maybeSingle();
  if (enrolled) redirect(`/app/corsi/${course.slug}`);

  const db = createAdminClient();
  let stripeAccount: string | undefined;
  if (!(await isNexoraTenant())) {
    const { data } = await db
      .from("tenants")
      .select("stripe_account_id, stripe_pagamenti_attivi")
      .eq("id", tenant.id)
      .single();
    if (!data?.stripe_account_id || !data.stripe_pagamenti_attivi)
      redirect(`${back}?acquisto=non-disponibile`);
    stripeAccount = data.stripe_account_id;
  }

  // Contenuto digitale con accesso immediato: serve la rinuncia espressa al recesso.
  if (course.prezzo_cents > 0 && formData.get("recesso") !== "on")
    redirect(`${back}?acquisto=recesso`);

  // Corso gratuito: accesso immediato, niente pagamento.
  if (course.prezzo_cents <= 0) {
    await db
      .from("enrollments")
      .upsert(
        { user_id: user.id, course_id: course.id, fonte: "manuale" },
        { onConflict: "user_id,course_id", ignoreDuplicates: true },
      );
    redirect(`/app/corsi/${course.slug}`);
  }

  const { data: order, error } = await db
    .from("orders")
    .insert({
      tenant_id: tenant.id,
      user_id: user.id,
      course_id: course.id,
      email: user.email,
      importo_cents: course.prezzo_cents,
      valuta: course.valuta,
      recesso_rinuncia_il: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !order) throw new Error(`Ordine non creato: ${error?.message}`);

  const session = await stripe().checkout.sessions.create(
    {
      mode: "payment",
      locale: "it",
      customer_email: user.email,
      client_reference_id: user.id,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: course.valuta.toLowerCase(),
            unit_amount: course.prezzo_cents,
            // I prezzi dei corsi sono mostrati IVA inclusa.
            tax_behavior: "inclusive",
            product_data: {
              name: course.titolo,
              description: course.sottotitolo?.slice(0, 300) || undefined,
              metadata: { course_id: course.id },
            },
          },
        },
      ],
      invoice_creation: { enabled: true },
      metadata: {
        order_id: order.id,
        course_id: course.id,
        user_id: user.id,
        tenant_id: tenant.id,
      },
      payment_intent_data: { metadata: { order_id: order.id, course_id: course.id } },
      success_url: `${origin}/acquisto/completato?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${back}`,
    },
    { stripeAccount, idempotencyKey: `nx-order-${order.id}` },
  );
  await db.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);
  redirect(session.url!);
}
