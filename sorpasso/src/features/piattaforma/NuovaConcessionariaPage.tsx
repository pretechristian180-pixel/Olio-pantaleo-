import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { KeyRound, Mail } from "lucide-react";
import { BackLink } from "@/components/shared/BackLink";
import { PageHeader } from "@/components/shared/PageHeader";
import { Section } from "@/components/shared/Section";
import { Spinner } from "@/components/shared/States";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { mostraErrore } from "@/lib/errors";
import { emailOpzionale, telefonoOpzionale, testoObbligatorio } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { DEMO } from "@/demo/config";
import { CredenzialiDialog, type Credenziali } from "./CredenzialiDialog";
import { PIANI, useCreaConcessionaria, type ModoAccesso, type Piano } from "./api";

const schema = z
  .object({
    nome: testoObbligatorio("il nome della concessionaria"),
    piva: z.string().trim().refine((v) => v === "" || /^\d{11}$/.test(v), "La P.IVA deve avere 11 cifre"),
    indirizzo: z.string().trim(),
    comune: z.string().trim(),
    telefono: telefonoOpzionale,
    email: emailOpzionale,
    piano: z.enum(["start", "pro", "dealer_ai"]),
    stato: z.enum(["attiva", "prova"]),
    prova_giorni: z.string(),
    max_utenti: z.string().refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) > 0), "Numero non valido"),
    titolare_nome: testoObbligatorio("il nome del titolare"),
    titolare_email: z.string().trim().email("Email del titolare non valida"),
    titolare_telefono: telefonoOpzionale,
  })
  .refine((v) => v.stato !== "prova" || (Number(v.prova_giorni) >= 1 && Number(v.prova_giorni) <= 90), {
    path: ["prova_giorni"],
    message: "Da 1 a 90 giorni",
  });
type Valori = z.infer<typeof schema>;

export default function NuovaConcessionariaPage() {
  const navigate = useNavigate();
  const crea = useCreaConcessionaria();
  const [accesso, setAccesso] = useState<ModoAccesso>("invito");
  const [credenziali, setCredenziali] = useState<(Credenziali & { orgId: string }) | null>(null);

  const form = useForm<Valori>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: "", piva: "", indirizzo: "", comune: "", telefono: "", email: "",
      piano: "pro", stato: "prova", prova_giorni: "14", max_utenti: "",
      titolare_nome: "", titolare_email: "", titolare_telefono: "",
    },
  });
  const { register, formState } = form;
  const err = formState.errors;
  const stato = useWatch({ control: form.control, name: "stato" });

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      const r = await crea.mutateAsync({
        azienda: { nome: v.nome, piva: v.piva, indirizzo: v.indirizzo, comune: v.comune, telefono: v.telefono, email: v.email },
        piano: v.piano as Piano,
        stato: v.stato,
        prova_giorni: Number(v.prova_giorni),
        max_utenti: v.max_utenti ? Number(v.max_utenti) : null,
        titolare: { nome: v.titolare_nome, email: v.titolare_email, telefono: v.titolare_telefono },
        accesso,
      });
      // Nella demo non viene creato nulla: si torna all'elenco
      const dopo = DEMO || !r.organization_id ? "/piattaforma" : `/piattaforma/${r.organization_id}`;
      if (r.password) {
        setCredenziali({ titolo: "Concessionaria creata", email: v.titolare_email, password: r.password, orgId: dopo });
      } else {
        toast.success("Concessionaria creata", { description: `Invito inviato a ${v.titolare_email}` });
        navigate(dopo);
      }
    } catch (e) {
      mostraErrore(e, "Non sono riuscito a creare la concessionaria.");
    }
  });

  return (
    <div className="mx-auto max-w-3xl">
      <BackLink to="/piattaforma" label="Concessionarie" />
      <PageHeader title="Nuova concessionaria" subtitle="Crea l'account dell'azienda e del titolare. Il titolare potrà poi invitare i suoi collaboratori." />
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <Section title="Azienda">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome della concessionaria" htmlFor="nc-nome" required error={err.nome?.message} className="sm:col-span-2">
              <Input id="nc-nome" autoFocus aria-invalid={!!err.nome} {...register("nome")} />
            </Field>
            <Field label="P.IVA" htmlFor="nc-piva" error={err.piva?.message}>
              <Input id="nc-piva" inputMode="numeric" aria-invalid={!!err.piva} {...register("piva")} />
            </Field>
            <Field label="Comune" htmlFor="nc-comune">
              <Input id="nc-comune" {...register("comune")} />
            </Field>
            <Field label="Indirizzo" htmlFor="nc-ind" className="sm:col-span-2">
              <Input id="nc-ind" {...register("indirizzo")} />
            </Field>
            <Field label="Telefono del salone" htmlFor="nc-tel" error={err.telefono?.message}>
              <Input id="nc-tel" type="tel" aria-invalid={!!err.telefono} {...register("telefono")} />
            </Field>
            <Field label="Email del salone" htmlFor="nc-email" error={err.email?.message}>
              <Input id="nc-email" type="email" aria-invalid={!!err.email} {...register("email")} />
            </Field>
          </div>
        </Section>

        <Section title="Piano e attivazione">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Piano" htmlFor="nc-piano">
              <Select id="nc-piano" {...register("piano")}>
                {Object.entries(PIANI).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </Field>
            <Field label="Utenti massimi" htmlFor="nc-max" hint="Vuoto = senza limite" error={err.max_utenti?.message}>
              <Input id="nc-max" inputMode="numeric" aria-invalid={!!err.max_utenti} {...register("max_utenti")} />
            </Field>
            <div className="sm:col-span-2">
              <p className="mb-2 text-[15px] font-medium">Stato iniziale</p>
              <Segmented
                label="Stato iniziale"
                value={stato}
                onChange={(v) => form.setValue("stato", v)}
                options={[
                  { value: "prova", label: "Prova gratuita" },
                  { value: "attiva", label: "Attiva (cliente pagante)" },
                ]}
              />
            </div>
            {stato === "prova" && (
              <Field label="Durata della prova (giorni)" htmlFor="nc-giorni" error={err.prova_giorni?.message} hint="Alla scadenza l'accesso si blocca da solo; puoi prolungarla dalla scheda.">
                <Input id="nc-giorni" inputMode="numeric" aria-invalid={!!err.prova_giorni} {...register("prova_giorni")} />
              </Field>
            )}
          </div>
        </Section>

        <Section title="Titolare">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome e cognome" htmlFor="nc-tnome" required error={err.titolare_nome?.message}>
              <Input id="nc-tnome" aria-invalid={!!err.titolare_nome} {...register("titolare_nome")} />
            </Field>
            <Field label="Email (sarà il suo accesso)" htmlFor="nc-temail" required error={err.titolare_email?.message}>
              <Input id="nc-temail" type="email" aria-invalid={!!err.titolare_email} {...register("titolare_email")} />
            </Field>
            <Field label="Telefono" htmlFor="nc-ttel" error={err.titolare_telefono?.message}>
              <Input id="nc-ttel" type="tel" aria-invalid={!!err.titolare_telefono} {...register("titolare_telefono")} />
            </Field>
          </div>
          <fieldset className="mt-5">
            <legend className="mb-2 text-[15px] font-medium">Come riceve l'accesso</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  { v: "invito", icona: Mail, titolo: "Invito via email", testo: "Riceve un'email con il link per scegliere la password." },
                  { v: "password", icona: KeyRound, titolo: "Password temporanea", testo: "L'account è subito attivo: ti mostriamo la password da consegnare (utile in demo o di persona)." },
                ] as const
              ).map(({ v, icona: Icona, titolo, testo }) => (
                <label
                  key={v}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors",
                    accesso === v ? "border-accent bg-accent-soft" : "hover:bg-muted",
                  )}
                >
                  <input type="radio" name="accesso" className="sr-only" checked={accesso === v} onChange={() => setAccesso(v)} />
                  <Icona className={cn("mt-0.5 size-5 shrink-0", accesso === v ? "text-accent" : "text-muted-foreground")} aria-hidden />
                  <span>
                    <span className="block font-semibold">{titolo}</span>
                    <span className="block text-sm text-muted-foreground">{testo}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </Section>

        <div className="flex justify-end">
          <Button type="submit" variant="accent" size="lg" disabled={formState.isSubmitting}>
            {formState.isSubmitting && <Spinner />} Crea concessionaria
          </Button>
        </div>
      </form>

      <CredenzialiDialog
        dati={credenziali}
        onClose={() => {
          const dopo = credenziali?.orgId;
          setCredenziali(null);
          if (dopo) navigate(dopo);
        }}
      />
    </div>
  );
}
