import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, Mail, PauseCircle, PlayCircle, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/shared/Avatar";
import { BackLink } from "@/components/shared/BackLink";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { FormError } from "@/features/auth/AuthLayout";
import { useQuery } from "@/hooks/useQuery";
import { friendlyError } from "@/lib/errors";
import { formatRelative, formatShortDate } from "@/lib/format";
import {
  getAgency,
  inviteUserAdmin,
  listAgencyUsers,
  resendInviteAdmin,
  setUserAdmin,
  updateAgencyAdmin,
  type AdminAgency,
  type AdminUser,
} from "@/services/admin";
import type { Plan, Role } from "@/types/domain";
import { planLabel } from "./AdminAgenciesPage";

const errore = (err: unknown) => (err instanceof Error && !("code" in err) ? err.message : friendlyError(err));

/** Scheda di un'agenzia: dati, piano, sospensione e utenti. */
export function AdminAgencyPage() {
  const { id = "" } = useParams();
  const agency = useQuery(() => getAgency(id), [id]);

  if (agency.error) return <ErrorState message={agency.error} onRetry={agency.reload} />;
  if (agency.loading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  if (!agency.data)
    return (
      <EmptyState
        art="casa"
        title="Agenzia non trovata"
        action={
          <Button asChild>
            <Link to="/admin">Torna alle agenzie</Link>
          </Button>
        }
      />
    );

  const a = agency.data;
  return (
    <div>
      <BackLink to="/admin" label="Agenzie" />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight">{a.name}</h1>
        <Badge tone="navy" dot={false}>
          {planLabel[a.plan]}
        </Badge>
        {a.active ? <Badge tone="green">Attiva</Badge> : <Badge tone="gray">Sospesa</Badge>}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <UsersCard agencyId={a.id} />
        <aside className="space-y-4">
          <AgencyDataCard agency={a} />
          <StatusCard agency={a} />
        </aside>
      </div>
    </div>
  );
}

/* ---------- Utenti ---------- */

function UsersCard({ agencyId }: { agencyId: string }) {
  const { data, loading, error, reload } = useQuery(() => listAgencyUsers(agencyId), [agencyId]);
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Utenti</CardTitle>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus aria-hidden />
          Invita utente
        </Button>
      </CardHeader>
      <CardContent>
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading || !data ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <p className="text-muted-foreground">Nessun utente ancora: invita il titolare.</p>
        ) : (
          <ul className="divide-y">
            {data.map((u) => (
              <UserRow key={u.id} user={u} />
            ))}
          </ul>
        )}
      </CardContent>
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent title="Invita un utente" description="Riceverà un'email per scegliere la password ed entrerà in questa agenzia.">
          {inviteOpen && <InviteForm agencyId={agencyId} onDone={() => setInviteOpen(false)} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function UserRow({ user: u }: { user: AdminUser }) {
  const [busy, setBusy] = useState(false);
  const name = `${u.firstName} ${u.lastName}`.trim() || u.email;

  async function change(role: Role, active: boolean, message: string) {
    setBusy(true);
    try {
      await setUserAdmin(u.id, role, active);
      toast.success(message);
    } catch (err) {
      toast.error("Modifica non salvata", { description: errore(err) });
    }
    setBusy(false);
  }

  async function resend() {
    setBusy(true);
    try {
      await resendInviteAdmin(u.email);
      toast.success("Email inviata", { description: `${u.email} riceverà il link per scegliere la password` });
    } catch (err) {
      toast.error("Email non inviata", { description: errore(err) });
    }
    setBusy(false);
  }

  return (
    <li className="py-4">
      <div className="flex items-start gap-3">
        <Avatar person={{ firstName: u.firstName || u.email, lastName: u.lastName }} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{name}</p>
            {!u.active && <Badge tone="gray">Disattivato</Badge>}
            {u.pending && <Badge tone="orange">In attesa del primo accesso</Badge>}
          </div>
          <p className="truncate text-[15px] text-muted-foreground">{u.email}</p>
          <p className="text-sm text-muted-foreground">
            {u.lastSignIn ? `Ultimo accesso ${formatRelative(u.lastSignIn)}` : `Invitato il ${formatShortDate(u.createdAt)}`}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 sm:pl-12">
        <div className="w-40">
          <Select
            aria-label={`Ruolo di ${name}`}
            value={u.role}
            disabled={busy}
            onChange={(e) => change(e.target.value as Role, u.active, `${name} ora è ${e.target.value === "titolare" ? "titolare" : "agente"}`)}
            className="h-11"
          >
            <option value="titolare">Titolare</option>
            <option value="agente">Agente</option>
          </Select>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-11"
          disabled={busy}
          onClick={() => change(u.role, !u.active, u.active ? `${name} non può più accedere` : `${name} può di nuovo accedere`)}
        >
          {u.active ? "Disattiva" : "Riattiva"}
        </Button>
        {(u.pending || !u.lastSignIn) && (
          <Button variant="ghost" size="sm" className="h-11" disabled={busy} onClick={resend}>
            <Mail aria-hidden />
            Reinvia invito
          </Button>
        )}
      </div>
    </li>
  );
}

function InviteForm({ agencyId, onDone }: { agencyId: string; onDone: () => void }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", role: "agente" as Role });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.firstName.trim()) return setError("Scrivi il nome.");
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError("Controlla l'indirizzo email.");
    setBusy(true);
    try {
      await inviteUserAdmin(agencyId, { ...form, email: form.email.trim().toLowerCase(), firstName: form.firstName.trim(), lastName: form.lastName.trim() });
      toast.success("Invito inviato", { description: form.email.trim() });
      onDone();
    } catch (err) {
      setError(errore(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome" htmlFor="iu-fn">
          <Input id="iu-fn" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
        </Field>
        <Field label="Cognome" htmlFor="iu-ln">
          <Input id="iu-ln" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
        </Field>
      </div>
      <Field label="Email" htmlFor="iu-email">
        <Input id="iu-email" type="email" inputMode="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
      </Field>
      <Field label="Ruolo" htmlFor="iu-role" hint="Il titolare vede tutto e gestisce gli utenti; l'agente vede i suoi clienti e le sue trattative.">
        <Select id="iu-role" value={form.role} onChange={(e) => set("role", e.target.value)}>
          <option value="agente">Agente</option>
          <option value="titolare">Titolare</option>
        </Select>
      </Field>
      <FormError message={error} />
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        <Mail aria-hidden />
        {busy ? "Invio in corso…" : "Invia l'invito"}
      </Button>
    </form>
  );
}

/* ---------- Dati e stato dell'agenzia ---------- */

function AgencyDataCard({ agency: a }: { agency: AdminAgency }) {
  const [form, setForm] = useState({ name: a.name, plan: a.plan, email: a.email ?? "", phone: a.phone ?? "", address: a.address ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) return setError("Il nome dell'agenzia è obbligatorio.");
    setBusy(true);
    try {
      await updateAgencyAdmin(a.id, { ...form, active: a.active });
      toast.success("Dati dell'agenzia salvati");
    } catch (err) {
      setError(errore(err));
    }
    setBusy(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dati e piano</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-4" noValidate>
          <Field label="Nome" htmlFor="ad-name">
            <Input id="ad-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Piano" htmlFor="ad-plan">
            <Select id="ad-plan" value={form.plan} onChange={(e) => set("plan", e.target.value as Plan)}>
              {(Object.keys(planLabel) as Plan[]).map((p) => (
                <option key={p} value={p}>
                  {planLabel[p]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Email" htmlFor="ad-email">
            <Input id="ad-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Telefono" htmlFor="ad-phone">
            <Input id="ad-phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="Indirizzo" htmlFor="ad-address">
            <Input id="ad-address" value={form.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
          <FormError message={error} />
          <Button type="submit" className="w-full" disabled={busy}>
            <Check aria-hidden />
            {busy ? "Salvataggio…" : "Salva"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function StatusCard({ agency: a }: { agency: AdminAgency }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      await updateAgencyAdmin(a.id, {
        name: a.name,
        plan: a.plan,
        email: a.email ?? "",
        phone: a.phone ?? "",
        address: a.address ?? "",
        active: !a.active,
      });
      toast.success(a.active ? "Agenzia sospesa" : "Agenzia riattivata");
      setConfirm(false);
    } catch (err) {
      toast.error("Modifica non salvata", { description: errore(err) });
    }
    setBusy(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accesso</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          {a.active
            ? "L'agenzia è attiva: i suoi utenti possono entrare e lavorare."
            : "L'agenzia è sospesa: nessun utente può vedere o modificare i dati. I dati restano salvati."}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {a.activeUsers} {a.activeUsers === 1 ? "utente attivo" : "utenti attivi"} · {a.properties} immobili · {a.contacts} contatti
        </p>
        <Button variant={a.active ? "outline" : "default"} className="mt-4 w-full" onClick={() => setConfirm(true)}>
          {a.active ? <PauseCircle aria-hidden /> : <PlayCircle aria-hidden />}
          {a.active ? "Sospendi l'agenzia" : "Riattiva l'agenzia"}
        </Button>
      </CardContent>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent title={a.active ? `Sospendere ${a.name}?` : `Riattivare ${a.name}?`}>
          <p className="text-[17px] text-muted-foreground">
            {a.active
              ? "Tutti gli utenti dell'agenzia verranno bloccati finché non la riattivi. Nessun dato viene cancellato."
              : "Gli utenti attivi dell'agenzia potranno di nuovo entrare e ritroveranno tutti i loro dati."}
          </p>
          <div className="mt-6 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setConfirm(false)}>
              Annulla
            </Button>
            <Button variant={a.active ? "destructive" : "default"} className="flex-1" disabled={busy} onClick={toggle}>
              {busy ? "Attendere…" : a.active ? "Sospendi" : "Riattiva"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
