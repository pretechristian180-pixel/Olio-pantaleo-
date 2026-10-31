import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, ChevronRight, ImagePlus, LogOut, Mail, Plus, ShieldCheck, UserPlus, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/shared/Avatar";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageHeader } from "@/components/shared/PageHeader";
import { useAuth } from "@/features/auth/AuthProvider";
import { FormError } from "@/features/auth/AuthLayout";
import { useQuery } from "@/hooks/useQuery";
import { friendlyError } from "@/lib/errors";
import { formatShortDate, fullName } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import {
  addZone,
  cancelInvitation,
  deleteZone,
  listZoneItems,
  inviteAgent,
  listTeam,
  logoUrl,
  setAgentActive,
  updateAgency,
  updateMyProfile,
  uploadAgencyLogo,
} from "@/services/api";

type Tab = "profilo" | "agenzia" | "utenti";

const planLabel = { start: "Start", pro: "Pro", elite: "Elite" } as const;

export function SettingsPage() {
  const { isOwner } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("sezione") as Tab) || "profilo";
  const setTab = (t: Tab) => setParams(t === "profilo" ? {} : { sezione: t }, { replace: true });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Impostazioni" />
      <Segmented
        label="Sezione"
        value={tab}
        onChange={setTab}
        className="mb-6"
        options={[
          { value: "profilo", label: "Il mio profilo" },
          { value: "agenzia", label: "Agenzia" },
          ...(isOwner ? [{ value: "utenti" as const, label: "Utenti" }] : []),
        ]}
      />
      {tab === "profilo" && <ProfileSection />}
      {tab === "agenzia" && <AgencySection />}
      {tab === "utenti" && isOwner && <UsersSection />}
    </div>
  );
}

/* ---------- Il mio profilo ---------- */

function ProfileSection() {
  const { agent, session, refresh, signOut, isPlatformAdmin } = useAuth();
  const [firstName, setFirstName] = useState(agent?.firstName ?? "");
  const [lastName, setLastName] = useState(agent?.lastName ?? "");
  const [phone, setPhone] = useState(agent?.phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!firstName.trim() || !lastName.trim()) return setError("Nome e cognome sono obbligatori.");
    setBusy(true);
    try {
      await updateMyProfile({ firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim() });
      await refresh();
      toast.success("Profilo aggiornato");
    } catch (err) {
      setError(friendlyError(err));
    }
    setBusy(false);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    if (pw.length < 8) return setPwError("La password deve avere almeno 8 caratteri.");
    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPwBusy(false);
    if (error) return setPwError(friendlyError(error));
    setPw("");
    toast.success("Password cambiata");
  }

  if (!agent) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Dati personali</CardTitle>
          <Badge tone={agent.role === "titolare" ? "brand" : "gray"}>{agent.role === "titolare" ? "Titolare" : "Agente"}</Badge>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-5" noValidate>
            <div className="flex items-center gap-4">
              <Avatar person={agent} size="lg" />
              <div className="min-w-0">
                <p className="text-[17px] font-semibold">{fullName(agent)}</p>
                <p className="truncate text-muted-foreground">{session?.user.email}</p>
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Nome" htmlFor="pr-fn">
                <Input id="pr-fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
              </Field>
              <Field label="Cognome" htmlFor="pr-ln">
                <Input id="pr-ln" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
              </Field>
            </div>
            <Field label="Telefono" htmlFor="pr-ph">
              <Input id="pr-ph" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <FormError message={error} />
            <Button type="submit" className="w-full sm:w-auto" disabled={busy}>
              <Check aria-hidden />
              {busy ? "Salvataggio…" : "Salva"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="space-y-5" noValidate>
            <Field label="Nuova password" htmlFor="pr-pw" hint="Almeno 8 caratteri">
              <Input id="pr-pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </Field>
            <FormError message={pwError} />
            <Button type="submit" variant="outline" className="w-full sm:w-auto" disabled={pwBusy}>
              {pwBusy ? "Salvataggio…" : "Cambia password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Link
        to="/impostazioni/automazioni"
        className="flex items-center gap-4 rounded-lg border bg-card p-4 shadow-card hover:border-primary/40"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-strong">
          <Zap className="size-6" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-semibold">Automazioni</span>
          <span className="block text-muted-foreground">Messaggi e promemoria che partono da soli: già accesi</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
      {isPlatformAdmin && (
        <Button variant="secondary" size="lg" className="w-full" asChild>
          <Link to="/admin">
            <ShieldCheck aria-hidden />
            Apri il pannello admin
          </Link>
        </Button>
      )}
      <Button variant="outline" size="lg" className="w-full" onClick={signOut}>
        <LogOut aria-hidden />
        Esci dall'account
      </Button>
    </div>
  );
}

/* ---------- Agenzia ---------- */

function AgencySection() {
  const { agency, isOwner, refresh } = useAuth();
  const [name, setName] = useState(agency?.name ?? "");
  const [phone, setPhone] = useState(agency?.phone ?? "");
  const [email, setEmail] = useState(agency?.email ?? "");
  const [address, setAddress] = useState(agency?.address ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    logoUrl(agency?.logoPath ?? null).then((u) => alive && setLogo(u));
    return () => {
      alive = false;
    };
  }, [agency?.logoPath]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Il nome dell'agenzia è obbligatorio.");
    setBusy(true);
    try {
      await updateAgency({ name: name.trim(), phone: phone.trim() || null, email: email.trim() || null, address: address.trim() || null });
      await refresh();
      toast.success("Dati dell'agenzia aggiornati");
    } catch (err) {
      setError(friendlyError(err));
    }
    setBusy(false);
  }

  async function onLogo(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setLogoBusy(true);
    try {
      await uploadAgencyLogo(file);
      await refresh();
      toast.success("Logo aggiornato");
    } catch (err) {
      toast.error("Logo non caricato", { description: friendlyError(err) });
    }
    setLogoBusy(false);
  }

  if (!agency) return null;
  const disabled = !isOwner;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Dati dell'agenzia</CardTitle>
          <Badge tone="navy" dot={false}>
            Piano {planLabel[agency.plan]}
          </Badge>
        </CardHeader>
        <CardContent>
          {!isOwner && (
            <p className="mb-5 rounded-lg bg-muted px-4 py-3 text-[15px] text-muted-foreground">
              Solo il titolare può modificare questi dati.
            </p>
          )}
          <div className="mb-6 flex items-center gap-4">
            <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
              {logo ? (
                <img src={logo} alt="Logo dell'agenzia" className="h-full w-full object-contain" />
              ) : (
                <span className="px-2 text-center text-sm text-muted-foreground">Nessun logo</span>
              )}
            </span>
            {isOwner && (
              <label className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-lg border border-input px-4 font-semibold hover:bg-muted">
                <ImagePlus className="size-5" aria-hidden />
                {logoBusy ? "Caricamento…" : logo ? "Cambia logo" : "Carica il logo"}
                <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={(e) => onLogo(e.target.files)} disabled={logoBusy} />
              </label>
            )}
          </div>
          <form onSubmit={save} className="space-y-5" noValidate>
            <Field label="Nome dell'agenzia" htmlFor="ag-name">
              <Input id="ag-name" value={name} onChange={(e) => setName(e.target.value)} disabled={disabled} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Telefono" htmlFor="ag-phone">
                <Input id="ag-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={disabled} />
              </Field>
              <Field label="Email" htmlFor="ag-email">
                <Input id="ag-email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={disabled} />
              </Field>
            </div>
            <Field label="Indirizzo" htmlFor="ag-address">
              <Input id="ag-address" value={address} onChange={(e) => setAddress(e.target.value)} disabled={disabled} placeholder="Es. Via Sparano 10, Bari" />
            </Field>
            <FormError message={error} />
            {isOwner && (
              <Button type="submit" className="w-full sm:w-auto" disabled={busy}>
                <Check aria-hidden />
                {busy ? "Salvataggio…" : "Salva"}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
      <ZonesCard />
    </div>
  );
}

/* ---------- Zone dell'agenzia ---------- */

/** Lista delle zone usata da immobili e ricerche: il matching confronta questi nomi. */
function ZonesCard() {
  const { isOwner } = useAuth();
  const { data, loading, error, reload } = useQuery(listZoneItems);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return;
    setBusy(true);
    try {
      await addZone(name);
      setName("");
      toast.success("Zona aggiunta");
    } catch (err) {
      toast.error("Zona non aggiunta", { description: friendlyError(err) });
    }
    setBusy(false);
  }

  async function remove(id: string, zone: string) {
    try {
      await deleteZone(id);
      toast.success(`Zona “${zone}” tolta dalla lista`);
    } catch (err) {
      toast.error("Zona non tolta", { description: friendlyError(err) });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zone</CardTitle>
        {data && <span className="text-muted-foreground">{data.length}</span>}
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Le zone in cui lavorate. Si scelgono da questa lista sia sugli immobili sia sulle ricerche dei clienti, così il matching non
          perde nessuno per una parola scritta diversa.
        </p>
        {error ? (
          <ErrorState message={error} onRetry={reload} className="mt-4" />
        ) : loading || !data ? (
          <Skeleton className="mt-4 h-11" />
        ) : (
          <ul className="mt-4 flex flex-wrap gap-2">
            {data.length === 0 && <li className="text-muted-foreground">Nessuna zona ancora.</li>}
            {data.map((z) => (
              <li key={z.id} className="inline-flex h-11 items-center gap-1 rounded-full border bg-card pl-4 pr-1 text-[15px] font-medium">
                {z.name}
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => remove(z.id, z.name)}
                    className="flex h-9 items-center rounded-full px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={`Togli la zona ${z.name}`}
                  >
                    Togli
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={add} className="mt-4 flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Polignano a Mare" aria-label="Nuova zona" />
          <Button type="submit" disabled={busy || name.trim().length < 2}>
            <Plus aria-hidden />
            Aggiungi
          </Button>
        </form>
        {isOwner && (
          <p className="mt-3 text-sm text-muted-foreground">
            Togliere una zona dalla lista non cambia gli immobili e le ricerche che la usano già.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Utenti (solo titolare) ---------- */

function UsersSection() {
  const { agent: me } = useAuth();
  const { data, loading, error, reload } = useQuery(listTeam);
  const [inviteOpen, setInviteOpen] = useState(false);

  async function toggle(id: string, active: boolean, name: string) {
    try {
      await setAgentActive(id, active);
      toast.success(active ? `${name} è di nuovo attivo` : `${name} non può più accedere`);
    } catch (err) {
      toast.error("Modifica non riuscita", { description: friendlyError(err) });
    }
  }

  async function cancel(id: string, email: string) {
    try {
      await cancelInvitation(id);
      toast.success("Invito annullato", { description: email });
    } catch (err) {
      toast.error("Non riesco ad annullare l'invito", { description: friendlyError(err) });
    }
  }

  return (
    <div className="space-y-4">
      <Button size="lg" className="w-full sm:w-auto" onClick={() => setInviteOpen(true)}>
        <UserPlus aria-hidden />
        Invita un agente
      </Button>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading || !data ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Persone dell'agenzia</CardTitle>
              <span className="text-muted-foreground">{data.members.length}</span>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {data.members.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
                    <Avatar person={m} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{fullName(m) || "Senza nome"}</p>
                      <p className="text-[15px] text-muted-foreground">{m.role === "titolare" ? "Titolare" : "Agente"}</p>
                    </div>
                    {m.active ? <Badge tone="green">Attivo</Badge> : <Badge tone="gray">Disattivato</Badge>}
                    {m.id !== me?.id && (
                      <Button variant="outline" size="sm" onClick={() => toggle(m.id, !m.active, fullName(m))}>
                        {m.active ? "Disattiva" : "Riattiva"}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {data.invitations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Inviti in attesa</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {data.invitations.map((i) => (
                    <li key={i.id} className="flex flex-wrap items-center gap-3 py-3">
                      <span className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
                        <Mail className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{[i.firstName, i.lastName].filter(Boolean).join(" ") || i.email}</p>
                        <p className="truncate text-[15px] text-muted-foreground">
                          {i.email} · inviato il {formatShortDate(i.createdAt)}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => cancel(i.id, i.email)}>
                        Annulla invito
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent title="Invita un agente" description="Riceverà un'email per scegliere la password ed entrerà già nella tua agenzia.">
          {inviteOpen && <InviteForm onDone={() => setInviteOpen(false)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InviteForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!firstName.trim()) return setError("Scrivi il nome dell'agente.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Controlla l'indirizzo email.");
    setBusy(true);
    try {
      await inviteAgent({ email: email.trim().toLowerCase(), firstName: firstName.trim(), lastName: lastName.trim() });
      toast.success("Invito inviato", { description: email.trim() });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : friendlyError(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome" htmlFor="in-fn">
          <Input id="in-fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </Field>
        <Field label="Cognome" htmlFor="in-ln">
          <Input id="in-ln" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </Field>
      </div>
      <Field label="Email" htmlFor="in-em">
        <Input id="in-em" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <FormError message={error} />
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        <Mail aria-hidden />
        {busy ? "Invio in corso…" : "Invia l'invito"}
      </Button>
    </form>
  );
}
