import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { MailPlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { Avatar } from "@/components/shared/Avatar";
import { Section } from "@/components/shared/Section";
import { ErrorState, ListSkeleton, Spinner } from "@/components/shared/States";
import { useSessione } from "@/lib/auth";
import { ErroreLeggibile, mostraErrore, ok } from "@/lib/errors";
import { dataBreve } from "@/lib/format";
import { RUOLI } from "@/lib/labels";
import { qk, useColleghi } from "@/lib/queries";
import { testoObbligatorio } from "@/lib/schemas";
import { supabase } from "@/lib/supabase";
import type { Invitation, Profile, Ruolo } from "@/types/db";

const RUOLI_INVITABILI = ["venditore", "responsabile_vendite", "amministrazione"] as const;
const DESCRIZIONE_RUOLO: Record<Ruolo, string> = {
  titolare: "Vede tutto, gestisce utenti e impostazioni",
  responsabile_vendite: "Vede tutti i lead e i venditori",
  venditore: "Vede i propri lead e lo stock",
  amministrazione: "Pratiche e documenti",
};
const qkInviti = ["inviti"] as const;

export function UtentiTab() {
  const { isTitolare, userId } = useSessione();
  const colleghi = useColleghi();
  const qc = useQueryClient();
  const [invita, setInvita] = useState(false);

  const inviti = useQuery({
    queryKey: qkInviti,
    enabled: isTitolare,
    queryFn: async () =>
      ok(await supabase.from("invitations").select("*").is("accettato_at", null).order("created_at", { ascending: false })) as Invitation[],
  });

  const aggiorna = useMutation({
    mutationFn: async ({ user_id, ...patch }: Partial<Profile> & { user_id: string }) =>
      ok(await supabase.from("profiles").update(patch).eq("user_id", user_id)),
    onSuccess: () => {
      toast.success("Utente aggiornato");
      return qc.invalidateQueries({ queryKey: qk.colleghi });
    },
    onError: (e) => mostraErrore(e, "Non sono riuscito ad aggiornare l'utente."),
  });

  const revoca = useMutation({
    mutationFn: async (id: string) => ok(await supabase.from("invitations").delete().eq("id", id)),
    onSuccess: () => {
      toast.success("Invito revocato");
      return qc.invalidateQueries({ queryKey: qkInviti });
    },
    onError: (e) => mostraErrore(e),
  });

  return (
    <div className="space-y-6">
      <Section
        title="Il team"
        count={colleghi.data?.filter((p) => p.attivo).length}
        action={
          isTitolare && (
            <Button size="sm" variant="accent" onClick={() => setInvita(true)}>
              <MailPlus aria-hidden /> Invita collega
            </Button>
          )
        }
        bodyClassName="p-0"
      >
        {colleghi.isError ? (
          <div className="p-4">
            <ErrorState error={colleghi.error} onRetry={() => void colleghi.refetch()} />
          </div>
        ) : colleghi.isLoading ? (
          <ListSkeleton rows={3} className="space-y-3 p-4" />
        ) : (
          <ul className="divide-y">
            {colleghi.data?.map((p) => {
              const modificabile = isTitolare && p.user_id !== userId;
              return (
                <li key={p.user_id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar nome={p.nome} size="sm" />
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate font-semibold">
                        {p.nome}
                        {p.user_id === userId && <span className="text-sm font-normal text-muted-foreground">(tu)</span>}
                        {!p.attivo && <Badge tone="gray" size="sm">Disattivato</Badge>}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">{p.email ?? p.telefono ?? DESCRIZIONE_RUOLO[p.ruolo]}</p>
                    </div>
                  </div>
                  {modificabile ? (
                    <div className="flex items-center gap-2">
                      <div className="w-56">
                        <Select
                          aria-label={`Ruolo di ${p.nome}`}
                          value={p.ruolo}
                          disabled={aggiorna.isPending}
                          onChange={(e) => aggiorna.mutate({ user_id: p.user_id, ruolo: e.target.value as Ruolo })}
                        >
                          {(Object.keys(RUOLI) as Ruolo[]).map((r) => (
                            <option key={r} value={r}>
                              {RUOLI[r]}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={aggiorna.isPending}
                        onClick={() => {
                          if (p.attivo && !window.confirm(`Disattivare ${p.nome}? Non potrà più accedere; i suoi lead e lo storico restano all'azienda.`)) return;
                          aggiorna.mutate({ user_id: p.user_id, attivo: !p.attivo });
                        }}
                      >
                        {p.attivo ? "Disattiva" : "Riattiva"}
                      </Button>
                    </div>
                  ) : (
                    <Badge tone={p.ruolo === "titolare" ? "blue" : "gray"} dot={false}>
                      {RUOLI[p.ruolo]}
                    </Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {isTitolare && (inviti.data?.length ?? 0) > 0 && (
        <Section title="Inviti in attesa" count={inviti.data!.length} bodyClassName="p-0">
          <ul className="divide-y">
            {inviti.data!.map((i) => {
              const scaduto = new Date(i.scade_at) < new Date();
              return (
                <li key={i.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {i.nome} · <span className="text-muted-foreground">{i.email}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {RUOLI[i.ruolo]} · {scaduto ? "scaduto" : `scade il ${dataBreve(i.scade_at)}`}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon-sm" aria-label={`Revoca invito a ${i.email}`} disabled={revoca.isPending} onClick={() => revoca.mutate(i.id)}>
                    <Trash2 className="text-destructive" aria-hidden />
                  </Button>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      <Section title="Cosa può fare ogni ruolo">
        <dl className="space-y-2">
          {(Object.keys(RUOLI) as Ruolo[]).map((r) => (
            <div key={r} className="flex flex-col sm:flex-row sm:gap-3">
              <dt className="font-medium sm:w-52">{RUOLI[r]}</dt>
              <dd className="text-muted-foreground">{DESCRIZIONE_RUOLO[r]}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {isTitolare && <InvitaDialog open={invita} onOpenChange={setInvita} />}
    </div>
  );
}

const schemaInvito = z.object({
  nome: testoObbligatorio("il nome"),
  email: z.string().trim().min(1, "Inserisci l'email").pipe(z.email("Email non valida")),
  ruolo: z.enum(RUOLI_INVITABILI),
});
type ValoriInvito = z.infer<typeof schemaInvito>;

function InvitaDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const form = useForm<ValoriInvito>({ resolver: zodResolver(schemaInvito), defaultValues: { nome: "", email: "", ruolo: "venditore" } });
  const err = form.formState.errors;
  const ruolo = form.watch("ruolo");

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      const { error } = await supabase.functions.invoke("invita-utente", { body: v });
      if (error) {
        if (error instanceof FunctionsHttpError) {
          const body = await error.context.json().catch(() => null);
          throw new ErroreLeggibile(body?.error ?? "Invio dell'invito non riuscito.");
        }
        throw new ErroreLeggibile("Servizio inviti non raggiungibile. Controlla la connessione.");
      }
      toast.success("Invito inviato", { description: `${v.nome} riceverà un'email per scegliere la password.` });
      await qc.invalidateQueries({ queryKey: qkInviti });
      form.reset();
      onOpenChange(false);
    } catch (e) {
      mostraErrore(e, "Invio dell'invito non riuscito.");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Invita un collega" description="Riceverà un'email con il link per entrare.">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Nome e cognome" htmlFor="in-nome" required error={err.nome?.message}>
            <Input id="in-nome" autoFocus aria-invalid={!!err.nome} {...form.register("nome")} />
          </Field>
          <Field label="Email" htmlFor="in-email" required error={err.email?.message}>
            <Input id="in-email" type="email" inputMode="email" aria-invalid={!!err.email} {...form.register("email")} />
          </Field>
          <Field label="Ruolo" htmlFor="in-ruolo" hint={DESCRIZIONE_RUOLO[ruolo]}>
            <Select id="in-ruolo" {...form.register("ruolo")}>
              {RUOLI_INVITABILI.map((r) => (
                <option key={r} value={r}>
                  {RUOLI[r]}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" variant="accent" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Spinner />}
            Invia invito
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
