import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail, MessageCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Section } from "@/components/shared/Section";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState, ListSkeleton, Spinner } from "@/components/shared/States";
import { useSessione } from "@/lib/auth";
import { mostraErrore, ok } from "@/lib/errors";
import { compilaTemplate } from "@/lib/messaggi";
import { qk, useTemplates } from "@/lib/queries";
import { testoObbligatorio } from "@/lib/schemas";
import { supabase } from "@/lib/supabase";
import type { CanaleMessaggio, MessageTemplate } from "@/types/db";

const SEGNAPOSTO = [
  { k: "{nome}", d: "nome del cliente" },
  { k: "{cognome}", d: "cognome del cliente" },
  { k: "{auto}", d: "auto di interesse" },
  { k: "{venditore}", d: "il tuo nome" },
  { k: "{azienda}", d: "nome della concessionaria" },
];

const CANALI: Record<CanaleMessaggio, { label: string; icon: typeof Mail }> = {
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  email: { label: "Email", icon: Mail },
};

export function TemplateTab() {
  const { isManager } = useSessione();
  const templates = useTemplates();
  const qc = useQueryClient();
  const [modifica, setModifica] = useState<MessageTemplate | CanaleMessaggio | null>(null);

  const elimina = useMutation({
    mutationFn: async (id: string) => ok(await supabase.from("message_templates").delete().eq("id", id)),
    onSuccess: () => {
      toast.success("Template eliminato");
      return qc.invalidateQueries({ queryKey: qk.templates });
    },
    onError: (e) => mostraErrore(e),
  });

  return (
    <div className="space-y-6">
      <Section title="Segnaposto disponibili">
        <p className="text-[15px] text-muted-foreground">Scrivili nel testo: quando il venditore usa il template vengono sostituiti con i dati veri.</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {SEGNAPOSTO.map((s) => (
            <li key={s.k} className="text-[15px]">
              <code className="rounded bg-accent-soft px-1.5 py-0.5 font-semibold text-accent">{s.k}</code> {s.d}
            </li>
          ))}
        </ul>
      </Section>

      {(["whatsapp", "email"] as CanaleMessaggio[]).map((canale) => {
        const { label, icon: Icon } = CANALI[canale];
        const elenco = templates.data?.filter((t) => t.canale === canale) ?? [];
        return (
          <Section
            key={canale}
            title={
              <span className="flex items-center gap-2">
                <Icon className="size-5 text-accent" aria-hidden /> {label}
              </span>
            }
            count={templates.data ? elenco.length : undefined}
            action={
              isManager && (
                <Button size="sm" variant="accent" onClick={() => setModifica(canale)}>
                  <Plus aria-hidden /> Nuovo template
                </Button>
              )
            }
            bodyClassName="p-0"
          >
            {templates.isError ? (
              <div className="p-4">
                <ErrorState error={templates.error} onRetry={() => void templates.refetch()} />
              </div>
            ) : templates.isLoading ? (
              <ListSkeleton rows={2} className="space-y-3 p-4" />
            ) : elenco.length === 0 ? (
              <EmptyState
                compact
                art="persone"
                title={`Nessun template ${label}`}
                action={isManager ? <Button variant="outline" onClick={() => setModifica(canale)}>Crea il primo template</Button> : undefined}
              />
            ) : (
              <ul className="divide-y">
                {elenco.map((t) => (
                  <li key={t.id} className="flex gap-3 px-4 py-4 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{t.nome}</p>
                      {t.oggetto && <p className="text-sm text-muted-foreground">Oggetto: {t.oggetto}</p>}
                      <p className="mt-1 line-clamp-3 whitespace-pre-line text-[15px] text-muted-foreground">{t.testo}</p>
                    </div>
                    {isManager && (
                      <div className="flex shrink-0 gap-1">
                        <Button variant="ghost" size="icon-sm" aria-label={`Modifica ${t.nome}`} onClick={() => setModifica(t)}>
                          <Pencil aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Elimina ${t.nome}`}
                          disabled={elimina.isPending}
                          onClick={() => window.confirm(`Eliminare il template «${t.nome}»?`) && elimina.mutate(t.id)}
                        >
                          <Trash2 className="text-destructive" aria-hidden />
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        );
      })}

      {isManager && (
        <TemplateDialog
          open={modifica !== null}
          onOpenChange={(v) => !v && setModifica(null)}
          template={typeof modifica === "object" && modifica ? modifica : undefined}
          canaleNuovo={typeof modifica === "string" ? modifica : "whatsapp"}
        />
      )}
    </div>
  );
}

const schema = z
  .object({
    nome: testoObbligatorio("un nome"),
    canale: z.enum(["whatsapp", "email"]),
    oggetto: z.string().trim(),
    testo: testoObbligatorio("il testo").pipe(z.string().max(2000, "Massimo 2000 caratteri")),
  })
  .refine((v) => v.canale !== "email" || v.oggetto.length > 0, { path: ["oggetto"], message: "Inserisci l'oggetto dell'email" });
type Valori = z.infer<typeof schema>;

function TemplateDialog({
  open,
  onOpenChange,
  template,
  canaleNuovo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  template?: MessageTemplate;
  canaleNuovo: CanaleMessaggio;
}) {
  const { profilo, organizzazione } = useSessione();
  const qc = useQueryClient();
  const form = useForm<Valori>({ resolver: zodResolver(schema) });
  const err = form.formState.errors;

  useEffect(() => {
    if (open) form.reset({ nome: template?.nome ?? "", canale: template?.canale ?? canaleNuovo, oggetto: template?.oggetto ?? "", testo: template?.testo ?? "" });
  }, [open, template, canaleNuovo, form]);

  const canale = form.watch("canale");
  const testo = form.watch("testo") ?? "";
  const esempio = { nome: "Giulia", cognome: "Rossi", auto: "Volkswagen Golf", venditore: profilo.nome, azienda: organizzazione.nome };

  const onSubmit = form.handleSubmit(async (v) => {
    const riga = { nome: v.nome, canale: v.canale, oggetto: v.canale === "email" ? v.oggetto : null, testo: v.testo };
    try {
      if (template) ok(await supabase.from("message_templates").update(riga).eq("id", template.id));
      else ok(await supabase.from("message_templates").insert(riga));
      await qc.invalidateQueries({ queryKey: qk.templates });
      toast.success(template ? "Template aggiornato" : "Template creato");
      onOpenChange(false);
    } catch (e) {
      mostraErrore(e, "Non sono riuscito a salvare il template.");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={template ? "Modifica template" : "Nuovo template"}>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <Field label="Nome" htmlFor="tp-nome" required error={err.nome?.message}>
              <Input id="tp-nome" placeholder="Es. Primo contatto" aria-invalid={!!err.nome} {...form.register("nome")} />
            </Field>
            <Field label="Canale" htmlFor="tp-canale">
              <Select id="tp-canale" {...form.register("canale")}>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
              </Select>
            </Field>
          </div>
          {canale === "email" && (
            <Field label="Oggetto" htmlFor="tp-ogg" required error={err.oggetto?.message}>
              <Input id="tp-ogg" aria-invalid={!!err.oggetto} {...form.register("oggetto")} />
            </Field>
          )}
          <Field label="Testo" htmlFor="tp-testo" required error={err.testo?.message}>
            <Textarea id="tp-testo" className="min-h-36" aria-invalid={!!err.testo} {...form.register("testo")} />
          </Field>
          {testo.trim() && (
            <div className="rounded-lg border bg-muted p-3">
              <p className="mb-1 text-sm font-medium text-muted-foreground">Anteprima con un cliente di esempio</p>
              <p className="whitespace-pre-line text-[15px]">{compilaTemplate(testo, esempio)}</p>
            </div>
          )}
          <Button type="submit" variant="accent" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Spinner />}
            {template ? "Salva modifiche" : "Crea template"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
