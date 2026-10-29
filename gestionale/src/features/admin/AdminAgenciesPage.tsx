import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, ChevronRight, Plus, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageHeader } from "@/components/shared/PageHeader";
import { FormError } from "@/features/auth/AuthLayout";
import { useQuery } from "@/hooks/useQuery";
import { formatRelative, formatShortDate } from "@/lib/format";
import { createAgencyAdmin, listAgencies, type AdminAgency } from "@/services/admin";
import type { Plan } from "@/types/domain";

export const planLabel: Record<Plan, string> = { start: "Start", pro: "Pro", elite: "Elite" };

type Filtro = "tutte" | "attive" | "sospese";

/** Elenco di tutte le agenzie che usano Mattonio. */
export function AdminAgenciesPage() {
  const { data, loading, error, reload } = useQuery(listAgencies);
  const [query, setQuery] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("tutte");
  const [newOpen, setNewOpen] = useState(false);

  const all = data ?? [];
  const q = query.trim().toLowerCase();
  const items = all.filter(
    (a) =>
      (filtro === "tutte" || (filtro === "attive" ? a.active : !a.active)) &&
      (!q || `${a.name} ${a.ownerName ?? ""} ${a.ownerEmail ?? ""}`.toLowerCase().includes(q)),
  );

  const addButton = (
    <Button size="lg" onClick={() => setNewOpen(true)}>
      <Plus aria-hidden />
      Nuova agenzia
    </Button>
  );

  return (
    <div>
      <PageHeader title="Agenzie" subtitle="Tutte le agenzie che usano Mattonio" action={addButton} />

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {loading || !data ? (
              [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)
            ) : (
              <>
                <Numero value={all.filter((a) => a.active).length} label="agenzie attive" />
                <Numero value={all.filter((a) => !a.active).length} label="agenzie sospese" />
                <Numero value={all.reduce((n, a) => n + (a.active ? a.activeUsers : 0), 0)} label="utenti attivi" />
                <div className="rounded-lg border bg-card p-4 shadow-card">
                  <p className="text-[15px] text-muted-foreground">Piani delle agenzie attive</p>
                  <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[15px]">
                    {(Object.keys(planLabel) as Plan[]).map((p) => (
                      <span key={p}>
                        <strong className="tabular-nums">{all.filter((a) => a.active && a.plan === p).length}</strong> {planLabel[p]}
                      </span>
                    ))}
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="mb-6 space-y-3 sm:flex sm:items-center sm:gap-3 sm:space-y-0">
            <div className="relative sm:flex-1">
              <Search className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cerca per agenzia o titolare"
                aria-label="Cerca agenzie"
                className="pl-11"
              />
            </div>
            <Segmented
              label="Stato"
              value={filtro}
              onChange={setFiltro}
              className="sm:w-80"
              options={[
                { value: "tutte", label: "Tutte" },
                { value: "attive", label: "Attive" },
                { value: "sospese", label: "Sospese" },
              ]}
            />
          </div>

          {loading || !data ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-44" />
              ))}
            </div>
          ) : items.length === 0 ? (
            all.length === 0 ? (
              <EmptyState art="casa" title="Nessuna agenzia ancora" text="Crea la prima: il titolare riceverà l'invito via email." action={addButton} />
            ) : (
              <EmptyState art="ricerca" title="Nessuna agenzia trovata" text="Prova a cambiare la ricerca o il filtro." />
            )
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {items.map((a) => (
                <AgencyCard key={a.id} agency={a} />
              ))}
            </div>
          )}
        </>
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent title="Nuova agenzia" description="Il titolare riceve un'email per scegliere la password ed entra già nella sua agenzia.">
          {newOpen && <NewAgencyForm onDone={() => setNewOpen(false)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Numero({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-card">
      <p className="text-3xl font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-2 text-[15px] text-muted-foreground">{label}</p>
    </div>
  );
}

function AgencyCard({ agency: a }: { agency: AdminAgency }) {
  return (
    <Link
      to={`/admin/agenzie/${a.id}`}
      className="group block min-w-0 rounded-lg border bg-card p-5 shadow-card transition-colors hover:border-primary/40"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-strong">
          <Building2 className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[17px] font-semibold group-hover:text-primary-strong">{a.name}</p>
            <Badge tone="navy" dot={false}>
              {planLabel[a.plan]}
            </Badge>
            {a.active ? <Badge tone="green">Attiva</Badge> : <Badge tone="gray">Sospesa</Badge>}
          </div>
          <p className="mt-0.5 truncate text-muted-foreground">
            {a.ownerName ? `${a.ownerName} · ` : ""}
            {a.ownerEmail ?? "Titolare non ancora collegato"}
          </p>
        </div>
        <ChevronRight className="mt-3 size-5 shrink-0 text-muted-foreground" aria-hidden />
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2 border-t pt-4 text-center">
        <div>
          <dt className="text-sm text-muted-foreground">Utenti</dt>
          <dd className="flex items-center justify-center gap-1 text-lg font-semibold tabular-nums">
            <Users className="size-4 text-muted-foreground" aria-hidden />
            {a.activeUsers}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Immobili</dt>
          <dd className="text-lg font-semibold tabular-nums">{a.properties}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Contatti</dt>
          <dd className="text-lg font-semibold tabular-nums">{a.contacts}</dd>
        </div>
      </dl>
      <p className="mt-3 text-sm text-muted-foreground">
        Creata il {formatShortDate(a.createdAt)} · {a.lastActivity ? `ultima attività ${formatRelative(a.lastActivity)}` : "nessuna attività ancora"}
      </p>
    </Link>
  );
}

function NewAgencyForm({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", plan: "pro" as Plan, phone: "", firstName: "", lastName: "", email: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) return setError("Scrivi il nome dell'agenzia.");
    if (!form.firstName.trim()) return setError("Scrivi il nome del titolare.");
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError("Controlla l'email del titolare.");
    setBusy(true);
    try {
      const id = await createAgencyAdmin({
        name: form.name.trim(),
        plan: form.plan,
        phone: form.phone.trim(),
        owner: { firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim().toLowerCase() },
      });
      toast.success("Agenzia creata", { description: `Invito inviato a ${form.email.trim()}` });
      onDone();
      if (id) navigate(`/admin/agenzie/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Operazione non riuscita. Riprova tra poco.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <Field label="Nome dell'agenzia" htmlFor="na-name">
        <Input id="na-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Es. Immobiliare Levante" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Piano" htmlFor="na-plan">
          <Select id="na-plan" value={form.plan} onChange={(e) => set("plan", e.target.value)}>
            {(Object.keys(planLabel) as Plan[]).map((p) => (
              <option key={p} value={p}>
                {planLabel[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Telefono (facoltativo)" htmlFor="na-phone">
          <Input id="na-phone" type="tel" inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
      </div>
      <fieldset className="space-y-4 rounded-xl border p-4">
        <legend className="px-1 text-[17px] font-semibold">Titolare</legend>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome" htmlFor="na-fn">
            <Input id="na-fn" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
          </Field>
          <Field label="Cognome" htmlFor="na-ln">
            <Input id="na-ln" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
          </Field>
        </div>
        <Field label="Email" htmlFor="na-email" hint="Riceverà il link per scegliere la password">
          <Input id="na-email" type="email" inputMode="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
      </fieldset>
      <FormError message={error} />
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        <Plus aria-hidden />
        {busy ? "Creazione in corso…" : "Crea l'agenzia e invia l'invito"}
      </Button>
    </form>
  );
}
