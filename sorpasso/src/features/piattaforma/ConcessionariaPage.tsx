import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Car, KeyRound, Link2, Mail, MoreHorizontal, Pause, Play, Target, Trophy, UserPlus, Users } from "lucide-react";
import { BackLink } from "@/components/shared/BackLink";
import { Avatar } from "@/components/shared/Avatar";
import { EmptyState } from "@/components/shared/EmptyState";
import { Section } from "@/components/shared/Section";
import { StatCard } from "@/components/shared/StatCard";
import { ErrorState, ListSkeleton, PageLoader, Spinner } from "@/components/shared/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mostraErrore } from "@/lib/errors";
import { dataBreve, dataOra, relativo, toDateInput } from "@/lib/format";
import { RUOLI, opzioni } from "@/lib/labels";
import { emailOpzionale, telefonoOpzionale, testoObbligatorio } from "@/lib/schemas";
import type { Ruolo } from "@/types/db";
import { BadgeStato } from "./ConcessionariePage";
import { CredenzialiDialog, type Credenziali } from "./CredenzialiDialog";
import {
  AZIONI_REGISTRO,
  PIANI,
  useAggiornaOrganizzazione,
  useAggiornaUtente,
  useAggiungiUtente,
  useAzioneAccount,
  useOrganizzazione,
  useRegistro,
  useUtentiOrg,
  type ModoAccesso,
  type OrgScheda,
  type UtenteOrg,
} from "./api";

export default function ConcessionariaPage() {
  const { id } = useParams();
  const org = useOrganizzazione(id);
  const [sospendi, setSospendi] = useState(false);
  const aggiorna = useAggiornaOrganizzazione();

  if (org.isLoading) return <PageLoader />;
  if (org.error || !org.data) return <ErrorState error={org.error} title="Concessionaria non trovata" onRetry={() => void org.refetch()} />;
  const o = org.data;

  async function riattiva() {
    try {
      await aggiorna.mutateAsync({ id: o.id, dati: { stato: "attiva" } });
      toast.success("Concessionaria riattivata: gli utenti possono di nuovo accedere");
    } catch (e) {
      mostraErrore(e);
    }
  }

  return (
    <div>
      <BackLink to="/piattaforma" label="Concessionarie" />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">{o.nome}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[15px] text-muted-foreground">
            <BadgeStato org={o} />
            <span>Piano {PIANI[o.piano]}</span>
            <span>· cliente dal {dataBreve(o.created_at)}</span>
          </div>
          {o.stato === "sospesa" && o.motivo_sospensione && (
            <p className="mt-3 rounded-lg bg-destructive-soft px-3 py-2 text-[15px] text-destructive">
              Sospesa {o.sospesa_at ? `il ${dataBreve(o.sospesa_at)}` : ""}: {o.motivo_sospensione}
            </p>
          )}
        </div>
        {o.stato === "sospesa" || o.stato === "disdetta" ? (
          <Button variant="success" onClick={riattiva} disabled={aggiorna.isPending}>
            <Play aria-hidden /> Riattiva
          </Button>
        ) : (
          <Button variant="outline" className="text-destructive" onClick={() => setSospendi(true)}>
            <Pause aria-hidden /> Sospendi accesso
          </Button>
        )}
      </div>

      <Tabs defaultValue="panoramica">
        <TabsList>
          <TabsTrigger value="panoramica">Panoramica</TabsTrigger>
          <TabsTrigger value="utenti">Utenti e accessi</TabsTrigger>
          <TabsTrigger value="registro">Registro</TabsTrigger>
        </TabsList>
        <TabsContent value="panoramica" className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={<Users />} value={`${o.utenti_attivi}${o.max_utenti ? `/${o.max_utenti}` : ""}`} label="Utenti attivi" hint={o.ultimo_accesso ? `ultimo accesso ${relativo(o.ultimo_accesso)}` : "nessun accesso"} />
            <StatCard icon={<Car />} value={o.auto_in_stock} label="Auto in stock" tone="accent" />
            <StatCard icon={<Target />} value={o.lead_30gg} label="Lead ultimi 30 giorni" tone="purple" />
            <StatCard icon={<Trophy />} value={o.vendite_30gg} label="Vendite ultimi 30 giorni" tone="green" />
          </div>
          <PianoForm org={o} />
          <AnagraficaForm org={o} />
        </TabsContent>
        <TabsContent value="utenti">
          <UtentiTab org={o} />
        </TabsContent>
        <TabsContent value="registro">
          <RegistroTab orgId={o.id} />
        </TabsContent>
      </Tabs>

      <SospendiDialog org={o} open={sospendi} onOpenChange={setSospendi} />
    </div>
  );
}

/* ---------- Piano, prova, limiti ---------- */

const schemaPiano = z.object({
  piano: z.enum(["start", "pro", "dealer_ai"]),
  stato: z.enum(["prova", "attiva", "sospesa", "disdetta"]),
  prova_fino_al: z.string(),
  max_utenti: z.string().refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) > 0), "Numero non valido"),
});

function PianoForm({ org }: { org: OrgScheda }) {
  const aggiorna = useAggiornaOrganizzazione();
  const form = useForm<z.infer<typeof schemaPiano>>({ resolver: zodResolver(schemaPiano) });
  useEffect(() => {
    form.reset({ piano: org.piano, stato: org.stato, prova_fino_al: org.prova_fino_al ?? "", max_utenti: org.max_utenti ? String(org.max_utenti) : "" });
  }, [org, form]);
  const err = form.formState.errors;

  const onSubmit = form.handleSubmit(async (v) => {
    if (v.stato === "sospesa" && org.stato !== "sospesa") {
      toast.error("Per sospendere usa il pulsante «Sospendi accesso»: serve il motivo.");
      return;
    }
    try {
      await aggiorna.mutateAsync({ id: org.id, dati: { piano: v.piano, stato: v.stato, prova_fino_al: v.stato === "prova" ? v.prova_fino_al : "", max_utenti: v.max_utenti } });
      toast.success("Piano aggiornato");
    } catch (e) {
      mostraErrore(e);
    }
  });

  const prolunga = (giorni: number) => {
    const base = org.prova_fino_al && new Date(org.prova_fino_al) > new Date() ? new Date(`${org.prova_fino_al}T00:00:00`) : new Date();
    base.setDate(base.getDate() + giorni);
    form.setValue("stato", "prova");
    form.setValue("prova_fino_al", toDateInput(base), { shouldDirty: true });
  };

  return (
    <Section title="Piano e abbonamento">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Piano" htmlFor="p-piano">
            <Select id="p-piano" {...form.register("piano")}>
              {Object.entries(PIANI).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </Field>
          <Field label="Stato" htmlFor="p-stato">
            <Select id="p-stato" {...form.register("stato")}>
              <option value="prova">In prova</option>
              <option value="attiva">Attiva</option>
              <option value="disdetta">Disdetta</option>
              {org.stato === "sospesa" && <option value="sospesa">Sospesa</option>}
            </Select>
          </Field>
          <Field label="Prova fino al" htmlFor="p-prova" hint="Solo per lo stato «In prova»">
            <Input id="p-prova" type="date" {...form.register("prova_fino_al")} />
          </Field>
          <Field label="Utenti massimi" htmlFor="p-max" hint="Vuoto = senza limite" error={err.max_utenti?.message}>
            <Input id="p-max" inputMode="numeric" {...form.register("max_utenti")} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <span className="self-center text-sm text-muted-foreground">Prolunga la prova:</span>
            {[7, 14, 30].map((g) => (
              <Button key={g} type="button" variant="outline" size="xs" onClick={() => prolunga(g)}>
                +{g} giorni
              </Button>
            ))}
          </div>
          <Button type="submit" disabled={aggiorna.isPending || !form.formState.isDirty}>
            {aggiorna.isPending && <Spinner />} Salva
          </Button>
        </div>
      </form>
    </Section>
  );
}

/* ---------- Anagrafica e referente ---------- */

const schemaAnagrafica = z.object({
  nome: testoObbligatorio("il nome"),
  piva: z.string().trim().refine((v) => v === "" || /^\d{11}$/.test(v), "La P.IVA deve avere 11 cifre"),
  indirizzo: z.string().trim(),
  comune: z.string().trim(),
  telefono: telefonoOpzionale,
  email: emailOpzionale,
  referente_nome: z.string().trim(),
  referente_email: emailOpzionale,
  referente_telefono: telefonoOpzionale,
  note_piattaforma: z.string().trim().max(2000, "Massimo 2000 caratteri"),
});

function AnagraficaForm({ org }: { org: OrgScheda }) {
  const aggiorna = useAggiornaOrganizzazione();
  const form = useForm<z.infer<typeof schemaAnagrafica>>({ resolver: zodResolver(schemaAnagrafica) });
  useEffect(() => {
    form.reset({
      nome: org.nome, piva: org.piva ?? "", indirizzo: org.indirizzo ?? "", comune: org.comune ?? "",
      telefono: org.telefono ?? "", email: org.email ?? "", referente_nome: org.referente_nome ?? "",
      referente_email: org.referente_email ?? "", referente_telefono: org.referente_telefono ?? "", note_piattaforma: org.note_piattaforma ?? "",
    });
  }, [org, form]);
  const err = form.formState.errors;

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await aggiorna.mutateAsync({ id: org.id, dati: v });
      toast.success("Dati salvati");
    } catch (e) {
      mostraErrore(e);
    }
  });

  const campo = (nome: keyof z.infer<typeof schemaAnagrafica>, label: string, extra: Record<string, unknown> = {}) => (
    <Field label={label} htmlFor={`a-${nome}`} error={err[nome]?.message}>
      <Input id={`a-${nome}`} aria-invalid={!!err[nome]} {...extra} {...form.register(nome)} />
    </Field>
  );

  return (
    <Section title="Anagrafica e referente">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          {campo("nome", "Nome della concessionaria")}
          {campo("piva", "P.IVA", { inputMode: "numeric" })}
          {campo("indirizzo", "Indirizzo")}
          {campo("comune", "Comune")}
          {campo("telefono", "Telefono del salone", { type: "tel" })}
          {campo("email", "Email del salone", { type: "email" })}
          {campo("referente_nome", "Referente per Sorpasso")}
          {campo("referente_email", "Email del referente", { type: "email" })}
          {campo("referente_telefono", "Telefono del referente", { type: "tel" })}
        </div>
        <Field label="Note interne (le vede solo il team Sorpasso)" htmlFor="a-note" error={err.note_piattaforma?.message}>
          <Textarea id="a-note" className="min-h-24" {...form.register("note_piattaforma")} />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={aggiorna.isPending || !form.formState.isDirty}>
            {aggiorna.isPending && <Spinner />} Salva
          </Button>
        </div>
      </form>
    </Section>
  );
}

/* ---------- Utenti e accessi ---------- */

function UtentiTab({ org }: { org: OrgScheda }) {
  const utenti = useUtentiOrg(org.id);
  const aggiorna = useAggiornaUtente();
  const account = useAzioneAccount();
  const [nuovo, setNuovo] = useState(false);
  const [credenziali, setCredenziali] = useState<Credenziali | null>(null);

  async function cambia(u: UtenteOrg, v: { ruolo?: Ruolo; attivo?: boolean }, messaggio: string) {
    try {
      await aggiorna.mutateAsync({ userId: u.user_id, ...v });
      toast.success(messaggio);
    } catch (e) {
      mostraErrore(e);
    }
  }

  async function azione(u: UtenteOrg, tipo: "reinvia_invito" | "link_accesso" | "nuova_password") {
    try {
      const r = await account.mutateAsync({ azione: tipo, user_id: u.user_id });
      if (tipo === "reinvia_invito") toast.success(`Invito reinviato a ${u.email}`);
      if (tipo === "link_accesso") setCredenziali({ titolo: `Link di accesso per ${u.nome}`, email: u.email, link: r.link });
      if (tipo === "nuova_password") setCredenziali({ titolo: `Nuova password per ${u.nome}`, email: u.email, password: r.password });
    } catch (e) {
      mostraErrore(e);
    }
  }

  return (
    <Section
      title="Utenti"
      count={utenti.data?.length}
      action={
        <Button size="sm" variant="accent" onClick={() => setNuovo(true)}>
          <UserPlus aria-hidden /> Aggiungi utente
        </Button>
      }
      bodyClassName="p-0"
    >
      {utenti.isLoading ? (
        <ListSkeleton className="space-y-3 p-4" rows={3} />
      ) : utenti.error ? (
        <div className="p-4"><ErrorState error={utenti.error} onRetry={() => void utenti.refetch()} /></div>
      ) : !utenti.data?.length ? (
        <EmptyState art="persone" title="Nessun utente" text="Aggiungi il titolare per dare accesso alla concessionaria." compact />
      ) : (
        <ul className="divide-y">
          {utenti.data.map((u) => (
            <li key={u.user_id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar nome={u.nome} size="sm" className={u.attivo ? "" : "opacity-50"} />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {u.nome}
                    {!u.attivo && <Badge tone="gray" size="sm">Disattivato</Badge>}
                    {!u.email_confermata && <Badge tone="yellow" size="sm">Invito non accettato</Badge>}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {u.email} · {u.ultimo_accesso ? `ultimo accesso ${relativo(u.ultimo_accesso)}` : "mai entrato"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  aria-label={`Ruolo di ${u.nome}`}
                  className="h-10 w-52 text-[15px]"
                  value={u.ruolo}
                  disabled={aggiorna.isPending}
                  onChange={(e) => void cambia(u, { ruolo: e.target.value as Ruolo }, `${u.nome} ora è ${RUOLI[e.target.value as Ruolo].toLowerCase()}`)}
                >
                  {opzioni(RUOLI).map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </Select>
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex size-10 items-center justify-center rounded-lg border hover:bg-muted" aria-label={`Azioni per ${u.nome}`}>
                    <MoreHorizontal className="size-5" aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {!u.email_confermata && (
                      <DropdownMenuItem onSelect={() => void azione(u, "reinvia_invito")}>
                        <Mail aria-hidden /> Reinvia invito
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onSelect={() => void azione(u, "link_accesso")}>
                      <Link2 aria-hidden /> Link di accesso da inviare
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void azione(u, "nuova_password")}>
                      <KeyRound aria-hidden /> Imposta password temporanea
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className={u.attivo ? "text-destructive" : ""}
                      onSelect={() => void cambia(u, { attivo: !u.attivo }, u.attivo ? `${u.nome} non può più accedere` : `${u.nome} può di nuovo accedere`)}
                    >
                      {u.attivo ? "Disattiva accesso" : "Riattiva accesso"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          ))}
        </ul>
      )}
      <AggiungiUtenteDialog org={org} open={nuovo} onOpenChange={setNuovo} onCredenziali={setCredenziali} />
      <CredenzialiDialog dati={credenziali} onClose={() => setCredenziali(null)} />
    </Section>
  );
}

const schemaUtente = z.object({
  nome: testoObbligatorio("il nome"),
  email: z.string().trim().email("Email non valida"),
  telefono: telefonoOpzionale,
  ruolo: z.enum(["titolare", "responsabile_vendite", "venditore", "amministrazione"]),
});

function AggiungiUtenteDialog({
  org,
  open,
  onOpenChange,
  onCredenziali,
}: {
  org: OrgScheda;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCredenziali: (c: Credenziali) => void;
}) {
  const aggiungi = useAggiungiUtente();
  const [accesso, setAccesso] = useState<ModoAccesso>("invito");
  const form = useForm<z.infer<typeof schemaUtente>>({
    resolver: zodResolver(schemaUtente),
    defaultValues: { nome: "", email: "", telefono: "", ruolo: "venditore" },
  });
  const err = form.formState.errors;

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      const r = await aggiungi.mutateAsync({ organization_id: org.id, ...v, accesso });
      form.reset();
      onOpenChange(false);
      if (r.password) onCredenziali({ titolo: `Accesso creato per ${v.nome}`, email: v.email, password: r.password });
      else toast.success(`Invito inviato a ${v.email}`);
    } catch (e) {
      mostraErrore(e);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Aggiungi utente" description={org.nome}>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Nome e cognome" htmlFor="u-nome" required error={err.nome?.message}>
            <Input id="u-nome" autoFocus aria-invalid={!!err.nome} {...form.register("nome")} />
          </Field>
          <Field label="Email" htmlFor="u-email" required error={err.email?.message}>
            <Input id="u-email" type="email" aria-invalid={!!err.email} {...form.register("email")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Telefono" htmlFor="u-tel" error={err.telefono?.message}>
              <Input id="u-tel" type="tel" {...form.register("telefono")} />
            </Field>
            <Field label="Ruolo" htmlFor="u-ruolo">
              <Select id="u-ruolo" {...form.register("ruolo")}>
                {opzioni(RUOLI).map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Accesso" htmlFor="u-accesso">
            <Select id="u-accesso" value={accesso} onChange={(e) => setAccesso(e.target.value as ModoAccesso)}>
              <option value="invito">Invito via email</option>
              <option value="password">Password temporanea (te la mostriamo)</option>
            </Select>
          </Field>
          <Button type="submit" variant="accent" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Spinner />} Aggiungi utente
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Sospensione ---------- */

const MOTIVI_SOSPENSIONE = ["Pagamento non ricevuto", "Richiesta del cliente", "Fine della prova", "Violazione delle condizioni d'uso"];

function SospendiDialog({ org, open, onOpenChange }: { org: OrgScheda; open: boolean; onOpenChange: (v: boolean) => void }) {
  const aggiorna = useAggiornaOrganizzazione();
  const [motivo, setMotivo] = useState("");
  const [dettaglio, setDettaglio] = useState("");
  const [errore, setErrore] = useState("");

  async function conferma() {
    const testo = [motivo, dettaglio.trim()].filter(Boolean).join(": ");
    if (!motivo) {
      setErrore("Scegli il motivo della sospensione");
      return;
    }
    try {
      await aggiorna.mutateAsync({ id: org.id, dati: { stato: "sospesa", motivo_sospensione: testo } });
      toast.success("Accesso sospeso: gli utenti vedranno un messaggio al prossimo caricamento");
      onOpenChange(false);
    } catch (e) {
      mostraErrore(e);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Sospendi l'accesso" description={`${org.nome}: nessun utente potrà entrare finché non la riattivi. I dati restano conservati.`}>
        <div className="space-y-4">
          <Field label="Motivo" htmlFor="s-motivo" required error={errore || undefined}>
            <Select id="s-motivo" value={motivo} onChange={(e) => { setMotivo(e.target.value); setErrore(""); }}>
              <option value="">Scegli…</option>
              {MOTIVI_SOSPENSIONE.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>
          </Field>
          <Field label="Dettagli (facoltativo)" htmlFor="s-dett">
            <Textarea id="s-dett" className="min-h-20" value={dettaglio} onChange={(e) => setDettaglio(e.target.value)} />
          </Field>
          <Button variant="destructive" className="w-full" onClick={conferma} disabled={aggiorna.isPending}>
            {aggiorna.isPending && <Spinner />} Sospendi accesso
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Registro ---------- */

function RegistroTab({ orgId }: { orgId: string }) {
  const registro = useRegistro(orgId);
  if (registro.isLoading) return <ListSkeleton rows={3} />;
  if (registro.error) return <ErrorState error={registro.error} onRetry={() => void registro.refetch()} />;
  if (!registro.data?.length) return <EmptyState art="pratiche" title="Nessuna azione registrata" compact />;
  return (
    <Section title="Azioni del team Sorpasso" count={registro.data.length} bodyClassName="p-0">
      <ul className="divide-y">
        {registro.data.map((r) => (
          <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 sm:px-5">
            <span className="font-medium">
              {AZIONI_REGISTRO[r.azione] ?? r.azione}
              {typeof r.dettagli?.ruolo === "string" && <span className="text-muted-foreground"> · {RUOLI[r.dettagli.ruolo as Ruolo]}</span>}
            </span>
            <span className="text-sm text-muted-foreground">
              {r.admin_nome ?? "Sistema"} · {dataOra(r.created_at)}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
