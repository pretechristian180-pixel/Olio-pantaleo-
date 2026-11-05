import type { Metadata } from "next";

import { SubmitButton } from "@/components/forms/submit-button";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { adminSetMetricool } from "@/lib/actions/calendar";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Social e Metricool", robots: { index: false } };

const dateFmt = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Team Nexora: per ogni azienda il brand Metricool (blogId) e il link per collegare i social
 * (Metricool → brand → Connessioni → Condividi → Crea link, valido 71 ore).
 */
export default async function AdminSocialPage() {
  const supabase = await createClient();
  const [{ data: workspaces }, { data: accounts }] = await Promise.all([
    supabase
      .from("workspaces")
      .select(
        "id, name, city, metricool_blog_id, metricool_connect_url, metricool_connect_expires, onboarding_completed_at",
      )
      .order("created_at", { ascending: false }),
    supabase.from("social_accounts").select("workspace_id, platform, status"),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="Social e Metricool"
        description="Collega ogni azienda al suo brand Metricool e incolla il link per collegare i social: il cliente lo trova nella pagina Social."
      />
      <ul className="grid gap-3">
        {(workspaces ?? []).map((w) => {
          const socials = (accounts ?? []).filter(
            (a) => a.workspace_id === w.id && a.status === "connected",
          );
          const expired =
            w.metricool_connect_expires && new Date(w.metricool_connect_expires) < new Date();
          return (
            <li key={w.id}>
              <Card className="py-4">
                <CardContent className="grid gap-3 px-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-display font-semibold">
                      {w.name}
                      {w.city ? (
                        <span className="font-normal text-muted-foreground"> · {w.city}</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Social collegati:{" "}
                      {socials.length ? socials.map((s) => s.platform).join(", ") : "nessuno"}
                      {w.metricool_connect_expires
                        ? ` · link ${expired ? "scaduto" : "valido fino al " + dateFmt.format(new Date(w.metricool_connect_expires))}`
                        : ""}
                    </p>
                  </div>
                  <form
                    action={adminSetMetricool}
                    className="grid gap-2 sm:grid-cols-[12rem_1fr_auto] sm:items-end"
                  >
                    <input type="hidden" name="workspace_id" value={w.id} />
                    <label className="grid gap-1 text-xs font-medium">
                      Brand Metricool (blogId)
                      <Input
                        name="blog_id"
                        defaultValue={w.metricool_blog_id ?? ""}
                        inputMode="numeric"
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-medium">
                      Link per collegare i social
                      <Input
                        name="connect_url"
                        defaultValue={w.metricool_connect_url ?? ""}
                        placeholder="https://app.metricool.com/..."
                      />
                    </label>
                    <SubmitButton size="sm" pendingLabel="Salvo…">
                      Salva e sincronizza
                    </SubmitButton>
                  </form>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </PageContainer>
  );
}
