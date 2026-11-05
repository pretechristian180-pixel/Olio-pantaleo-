import type { Metadata } from "next";

import { SubmitButton } from "@/components/forms/submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { adminToggleFoundingAction } from "@/lib/actions/billing";
import { dateFmt } from "@/lib/billing";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Abbonamenti" };

const STATUS: Record<
  string,
  { label: string; variant: "success" | "warning" | "destructive" | "secondary" | "info" }
> = {
  trial: { label: "Prova", variant: "info" },
  active: { label: "Attivo", variant: "success" },
  past_due: { label: "Pagamento fallito", variant: "destructive" },
  unpaid: { label: "Non pagato", variant: "destructive" },
  canceled: { label: "Disdetto", variant: "secondary" },
  incomplete: { label: "Incompleto", variant: "warning" },
};

/** Elenco delle aziende con piano, stato del pagamento e founding member. */
export default async function AbbonamentiPage() {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("workspaces")
    .select(
      "id, name, plan_id, subscription_status, period_end, founding_member, trial_videos_left, billing_workspace_id, cancel_at_period_end",
    )
    .is("billing_workspace_id", null)
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Abbonamenti</h1>
        <p className="text-sm text-muted-foreground">
          Il founding member si attiva prima del pagamento: il coupon permanente viene applicato al
          checkout.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Aziende</CardTitle>
          <CardDescription>
            {rows?.length ?? 0} aziende (i brand collegati seguono l&apos;azienda che paga).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {(rows ?? []).map((w) => {
              const s = STATUS[w.subscription_status] ?? STATUS.trial!;
              return (
                <li key={w.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="min-w-40 flex-1 font-medium">{w.name}</span>
                  <Badge variant={s.variant}>{s.label}</Badge>
                  <span className="w-28 text-sm text-muted-foreground capitalize">
                    {w.plan_id ?? `prova · ${w.trial_videos_left} video`}
                  </span>
                  <span className="w-44 text-xs text-muted-foreground">
                    {w.period_end
                      ? `${w.cancel_at_period_end ? "termina" : "rinnovo"} ${dateFmt.format(new Date(w.period_end))}`
                      : ""}
                  </span>
                  <form action={adminToggleFoundingAction}>
                    <input type="hidden" name="workspace_id" value={w.id} />
                    <SubmitButton size="sm" variant={w.founding_member ? "secondary" : "outline"}>
                      {w.founding_member ? "Founding ✓" : "Segna founding"}
                    </SubmitButton>
                  </form>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
