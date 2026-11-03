import { useState } from "react";
import { Lock, LockOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useQuery } from "@/hooks/useQuery";
import { friendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import {
  applyAutomationPreset,
  getAgencyAutomations,
  setAgencyAutomationsEnabled,
  setAutomationAdmin,
  type AdminAutomation,
  type AutomationPreset,
} from "@/services/admin";

const errore = (err: unknown) => (err instanceof Error && !("code" in err) ? err.message : friendlyError(err));

export const presets: { id: AutomationPreset; label: string; hint: string }[] = [
  { id: "consigliate", label: "Consigliate", hint: "Accese le ricette pronte (risposte ai lead, promemoria visite, report ai proprietari…)" },
  { id: "solo_promemoria", label: "Solo promemoria interni", hint: "Nessun messaggio ai clienti: solo cose da fare e avvisi per l'agenzia" },
  { id: "spente", label: "Tutte spente", hint: "Non parte nulla finché non le accendi tu" },
];

/** Admin → scheda agenzia: decidi tu quali automazioni sono accese e quali il titolare non può cambiare */
export function AdminAutomationsCard({ agencyId }: { agencyId: string }) {
  const { data, loading, error, reload } = useQuery(() => getAgencyAutomations(agencyId), [agencyId]);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<void>, ok: string) {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error("Modifica non salvata", { description: errore(e) });
    }
    setBusy(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Automazioni</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <Button variant="outline" onClick={reload}>
            Riprova
          </Button>
        ) : loading || !data ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-lg bg-muted px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Automazioni dell'agenzia</p>
                <p className="text-[15px] text-muted-foreground">
                  {data.enabled ? "Partono quelle accese qui sotto." : "Spente tutte: non parte nessun messaggio né promemoria automatico."}
                </p>
              </div>
              <Switch
                on={data.enabled}
                disabled={!!busy}
                label="automazioni dell'agenzia"
                onChange={() => run("generale", () => setAgencyAutomationsEnabled(agencyId, !data.enabled), data.enabled ? "Automazioni spente" : "Automazioni accese")}
              />
            </div>

            <div>
              <p className="mb-2 text-[15px] font-medium">Scelta rapida</p>
              <div className="flex flex-wrap gap-2">
                {presets.map((p) => (
                  <Button
                    key={p.id}
                    variant="outline"
                    disabled={!!busy}
                    title={p.hint}
                    onClick={() => {
                      if (!window.confirm(`${p.label}: ${p.hint}. Continuare?`)) return;
                      run(`preset_${p.id}`, () => applyAutomationPreset(agencyId, p.id), `Applicato: ${p.label}`);
                    }}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            <ul className={cn("divide-y rounded-lg border", !data.enabled && "opacity-60")}>
              {data.automations.map((a) => (
                <Row key={a.id} automation={a} busy={!!busy} onChange={(active, locked, msg) => run(a.id, () => setAutomationAdmin(a.id, active, locked), msg)} />
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              "Bloccata": il titolare la vede ma non può accenderla o spegnerla. Quelle libere le può cambiare lui da Impostazioni → Automazioni.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ automation: a, busy, onChange }: { automation: AdminAutomation; busy: boolean; onChange: (active: boolean, locked: boolean, msg: string) => void }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{a.name}</p>
        {a.description && <p className="line-clamp-2 text-sm text-muted-foreground">{a.description}</p>}
        <button
          type="button"
          disabled={busy}
          onClick={() => onChange(a.active, !a.locked, a.locked ? "Il titolare può di nuovo cambiarla" : "Bloccata: il titolare non può cambiarla")}
          className={cn(
            "mt-1 inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold",
            a.locked ? "border-primary bg-primary-soft text-primary-strong" : "text-muted-foreground",
          )}
        >
          {a.locked ? <Lock className="size-4" aria-hidden /> : <LockOpen className="size-4" aria-hidden />}
          {a.locked ? "Bloccata" : "Il titolare può cambiarla"}
        </button>
      </div>
      <Switch on={a.active} disabled={busy} label={a.name} onChange={() => onChange(!a.active, a.locked, a.active ? "Automazione spenta" : "Automazione accesa")} />
    </li>
  );
}
