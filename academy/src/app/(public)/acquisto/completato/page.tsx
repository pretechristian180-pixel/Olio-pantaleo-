import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isStripeConfigured, stripe } from "@/lib/stripe";
import { fulfillCourseCheckout } from "@/lib/stripe-sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenant, isNexoraTenant } from "@/lib/tenant";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Acquisto completato", robots: { index: false } };

/** Ritorno dal pagamento: attiviamo subito l'accesso, senza aspettare il webhook. */
export default async function PurchaseDonePage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  const user = await requireUser("/app");
  if (!session_id || !/^cs_[A-Za-z0-9_]+$/.test(session_id) || !isStripeConfigured())
    redirect("/app");

  const tenant = await getCurrentTenant();
  let stripeAccount: string | undefined;
  if (tenant && !(await isNexoraTenant())) {
    const { data } = await createAdminClient()
      .from("tenants")
      .select("stripe_account_id")
      .eq("id", tenant.id)
      .single();
    stripeAccount = data?.stripe_account_id ?? undefined;
  }
  const session = await stripe()
    .checkout.sessions.retrieve(session_id, undefined, { stripeAccount })
    .catch(() => null);
  if (!session || session.metadata?.user_id !== user.id) redirect("/app");

  const slug = await fulfillCourseCheckout(session);
  if (slug) redirect(`/app/corsi/${slug}`);

  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-5 px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">Stiamo confermando il pagamento</h1>
      <p className="text-ink-muted">
        Alcuni metodi di pagamento richiedono qualche minuto. Appena è confermato trovi il corso
        nella tua area e ricevi una email con la ricevuta.
      </p>
      <Button asChild>
        <Link href="/app/corsi">Vai ai miei corsi</Link>
      </Button>
    </section>
  );
}
