import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Section } from "@/components/shared/Section";
import { Spinner } from "@/components/shared/States";
import { useSessione } from "@/lib/auth";
import { mostraErrore, ok } from "@/lib/errors";
import { PIVA, emailOpzionale, telefonoOpzionale, testoObbligatorio, vuotoANull } from "@/lib/schemas";
import { supabase } from "@/lib/supabase";
import { LogoAzienda } from "./LogoAzienda";

const schema = z.object({
  nome: testoObbligatorio("il nome della concessionaria"),
  piva: z.string().trim().refine((v) => v === "" || PIVA.test(v), "La partita IVA ha 11 cifre"),
  indirizzo: z.string().trim(),
  comune: z.string().trim(),
  telefono: telefonoOpzionale,
  whatsapp: telefonoOpzionale,
  email: emailOpzionale,
  marchi: z.array(z.string()),
});
type Valori = z.infer<typeof schema>;

export function AziendaTab() {
  const { organizzazione: org, isTitolare, ricarica } = useSessione();
  const [nuovoMarchio, setNuovoMarchio] = useState("");
  const form = useForm<Valori>({
    resolver: zodResolver(schema),
    values: {
      nome: org.nome,
      piva: org.piva ?? "",
      indirizzo: org.indirizzo ?? "",
      comune: org.comune ?? "",
      telefono: org.telefono ?? "",
      whatsapp: org.whatsapp ?? "",
      email: org.email ?? "",
      marchi: org.marchi ?? [],
    },
  });
  const err = form.formState.errors;
  const marchi = form.watch("marchi");

  function aggiungiMarchio() {
    const m = nuovoMarchio.trim();
    if (!m) return;
    if (!marchi.some((x) => x.toLowerCase() === m.toLowerCase())) form.setValue("marchi", [...marchi, m], { shouldDirty: true });
    setNuovoMarchio("");
  }

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      ok(
        await supabase
          .from("organizations")
          .update({
            nome: v.nome,
            piva: vuotoANull(v.piva),
            indirizzo: vuotoANull(v.indirizzo),
            comune: vuotoANull(v.comune),
            telefono: vuotoANull(v.telefono),
            whatsapp: vuotoANull(v.whatsapp),
            email: vuotoANull(v.email),
            marchi: v.marchi,
          })
          .eq("id", org.id),
      );
      await ricarica();
      toast.success("Dati aziendali aggiornati");
    } catch (e) {
      mostraErrore(e, "Non sono riuscito a salvare i dati aziendali.");
    }
  });

  const ro = !isTitolare;
  return (
    <div className="space-y-6">
      <LogoAzienda />
      <Section title="Dati della concessionaria">
        {ro && <p className="mb-4 rounded-lg bg-muted px-4 py-3 text-[15px] text-muted-foreground">Solo il titolare può modificare questi dati.</p>}
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <fieldset disabled={ro} className="space-y-4">
            <Field label="Ragione sociale / nome" htmlFor="az-nome" required error={err.nome?.message}>
              <Input id="az-nome" aria-invalid={!!err.nome} {...form.register("nome")} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Partita IVA" htmlFor="az-piva" error={err.piva?.message}>
                <Input id="az-piva" inputMode="numeric" maxLength={11} aria-invalid={!!err.piva} {...form.register("piva")} />
              </Field>
              <Field label="Telefono" htmlFor="az-tel" error={err.telefono?.message}>
                <Input id="az-tel" type="tel" aria-invalid={!!err.telefono} {...form.register("telefono")} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
              <Field label="Indirizzo" htmlFor="az-ind">
                <Input id="az-ind" {...form.register("indirizzo")} />
              </Field>
              <Field label="Comune" htmlFor="az-com">
                <Input id="az-com" {...form.register("comune")} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email" htmlFor="az-email" error={err.email?.message}>
                <Input id="az-email" type="email" aria-invalid={!!err.email} {...form.register("email")} />
              </Field>
              <Field
                label="WhatsApp del salone"
                htmlFor="az-wa"
                error={err.whatsapp?.message}
                hint="Il numero a cui scrivono i clienti dalla scheda pubblica delle auto."
              >
                <Input id="az-wa" type="tel" inputMode="tel" aria-invalid={!!err.whatsapp} {...form.register("whatsapp")} />
              </Field>
            </div>
            <Field label="Marchi trattati" htmlFor="az-marchio" hint="Es. Fiat, Jeep, Peugeot. Premi Invio per aggiungere.">
              <div className="flex gap-2">
                <Input
                  id="az-marchio"
                  value={nuovoMarchio}
                  onChange={(e) => setNuovoMarchio(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      aggiungiMarchio();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={aggiungiMarchio}>
                  Aggiungi
                </Button>
              </div>
            </Field>
            {marchi.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {marchi.map((m) => (
                  <li key={m} className="inline-flex h-9 items-center gap-1 rounded-full bg-primary-soft pl-3 pr-1 text-[15px] font-medium text-primary">
                    {m}
                    {!ro && (
                      <button
                        type="button"
                        className="flex size-7 items-center justify-center rounded-full hover:bg-primary/10"
                        aria-label={`Rimuovi ${m}`}
                        onClick={() => form.setValue("marchi", marchi.filter((x) => x !== m), { shouldDirty: true })}
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
          {!ro && (
            <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
              {form.formState.isSubmitting && <Spinner />}
              Salva
            </Button>
          )}
        </form>
      </Section>
    </div>
  );
}
