import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { BackLink } from "@/components/shared/BackLink";
import { PageHeader } from "@/components/shared/PageHeader";
import { Section } from "@/components/shared/Section";
import { ErrorState, PageLoader, Spinner } from "@/components/shared/States";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useSessione } from "@/lib/auth";
import { mostraErrore } from "@/lib/errors";
import { euro, toDateInput } from "@/lib/format";
import { ALIMENTAZIONI, CAMBI, STATI_VEICOLO, TIPI_VEICOLO, opzioni } from "@/lib/labels";
import { TARGA, aNumero, numeroOpzionale, testoObbligatorio, vuotoANull } from "@/lib/schemas";
import type { Alimentazione, Cambio, StatoVeicolo, TipoVeicolo } from "@/types/db";
import { useCostoVeicolo, useSalvaVeicolo, useVeicolo } from "./api";

const annoMax = new Date().getFullYear() + 1;

const schema = z.object({
  marca: testoObbligatorio("la marca"),
  modello: testoObbligatorio("il modello"),
  versione: z.string().trim(),
  tipo: z.enum(Object.keys(TIPI_VEICOLO) as [TipoVeicolo, ...TipoVeicolo[]]),
  stato: z.enum(Object.keys(STATI_VEICOLO) as [StatoVeicolo, ...StatoVeicolo[]]),
  anno: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d{4}$/.test(v) && Number(v) >= 1950 && Number(v) <= annoMax), `Anno tra 1950 e ${annoMax}`),
  km: z
    .string()
    .trim()
    .refine((v) => /^\d+$/.test(v.replace(/\./g, "")), "Inserisci i km (0 per un'auto nuova)"),
  alimentazione: z.union([z.enum(Object.keys(ALIMENTAZIONI) as [Alimentazione, ...Alimentazione[]]), z.literal("")]),
  cambio: z.union([z.enum(Object.keys(CAMBI) as [Cambio, ...Cambio[]]), z.literal("")]),
  colore: z.string().trim(),
  targa: z
    .string()
    .trim()
    .refine((v) => v === "" || TARGA.test(v), "Targa non valida (es. AB 123 CD)"),
  telaio: z
    .string()
    .trim()
    .refine((v) => v === "" || /^[A-HJ-NPR-Z0-9]{17}$/i.test(v), "Il telaio (VIN) ha 17 caratteri, senza I, O e Q"),
  data_ingresso: z.string().min(1, "Indica la data di ingresso"),
  prezzo_vendita: z
    .string()
    .trim()
    .min(1, "Inserisci il prezzo di vendita")
    .refine((v) => !Number.isNaN(Number(v.replace(/\./g, "").replace(",", "."))) && Number(v.replace(/\./g, "").replace(",", ".")) > 0, "Prezzo non valido"),
  prezzo_acquisto: numeroOpzionale("Prezzo non valido"),
  descrizione: z.string().trim().max(5000, "Massimo 5000 caratteri"),
  note_interne: z.string().trim().max(2000, "Massimo 2000 caratteri"),
});
type Valori = z.infer<typeof schema>;

const prezzo = (v: string) => aNumero(v.replace(/\./g, ""));

const VUOTO: Valori = {
  marca: "",
  modello: "",
  versione: "",
  tipo: "usato",
  stato: "disponibile",
  anno: "",
  km: "",
  alimentazione: "",
  cambio: "",
  colore: "",
  targa: "",
  telaio: "",
  data_ingresso: toDateInput(new Date()),
  prezzo_vendita: "",
  prezzo_acquisto: "",
  descrizione: "",
  note_interne: "",
};

export default function VeicoloFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isManager } = useSessione();
  const veicolo = useVeicolo(id);
  const costo = useCostoVeicolo(id, isManager);
  const salva = useSalvaVeicolo();

  const form = useForm<Valori>({ resolver: zodResolver(schema), defaultValues: VUOTO });
  const { register, formState } = form;
  const err = formState.errors;

  useEffect(() => {
    const v = veicolo.data;
    if (!v) return;
    form.reset({
      marca: v.marca,
      modello: v.modello,
      versione: v.versione ?? "",
      tipo: v.tipo,
      stato: v.stato,
      anno: v.anno ? String(v.anno) : "",
      km: String(v.km),
      alimentazione: v.alimentazione ?? "",
      cambio: v.cambio ?? "",
      colore: v.colore ?? "",
      targa: v.targa ?? "",
      telaio: v.telaio ?? "",
      data_ingresso: v.data_ingresso,
      prezzo_vendita: v.prezzo_vendita != null ? String(v.prezzo_vendita) : "",
      prezzo_acquisto: costo.data?.prezzo_acquisto != null ? String(costo.data.prezzo_acquisto) : "",
      descrizione: v.descrizione ?? "",
      note_interne: v.note_interne ?? "",
    });
  }, [veicolo.data, costo.data, form]);

  const [pv, pa] = useWatch({ control: form.control, name: ["prezzo_vendita", "prezzo_acquisto"] });
  const margine = pv && pa && prezzo(pv) != null && prezzo(pa) != null ? prezzo(pv)! - prezzo(pa)! : null;

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      const { id: salvatoId } = await salva.mutateAsync({
        id,
        veicolo: {
          marca: v.marca,
          modello: v.modello,
          versione: vuotoANull(v.versione),
          tipo: v.tipo,
          stato: v.stato,
          anno: v.anno ? Number(v.anno) : null,
          km: Number(v.km.replace(/\./g, "")),
          alimentazione: v.alimentazione || null,
          cambio: v.cambio || null,
          colore: vuotoANull(v.colore),
          targa: v.targa ? v.targa.replace(/\s/g, "").toUpperCase() : null,
          telaio: v.telaio ? v.telaio.toUpperCase() : null,
          data_ingresso: v.data_ingresso,
          prezzo_vendita: prezzo(v.prezzo_vendita),
          descrizione: vuotoANull(v.descrizione),
          note_interne: vuotoANull(v.note_interne),
        },
        prezzoAcquisto: isManager ? prezzo(v.prezzo_acquisto) : undefined,
      });
      if (id) {
        toast.success("Modifiche salvate");
        navigate(`/stock/${id}`);
      } else {
        toast.success("Auto aggiunta allo stock", { description: "Ora aggiungi le foto e guarda chi potrebbe essere interessato." });
        navigate(`/stock/${salvatoId}?nuovo=1`);
      }
    } catch (e) {
      mostraErrore(e, "Non sono riuscito a salvare l'auto.");
    }
  });

  if (id && veicolo.isLoading) return <PageLoader />;
  if (id && veicolo.isError) return <ErrorState error={veicolo.error} onRetry={() => void veicolo.refetch()} />;

  const opts = <K extends string>(m: Record<K, string | { label: string }>) =>
    opzioni(m).map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ));

  return (
    <div className="mx-auto max-w-3xl">
      <BackLink to={id ? `/stock/${id}` : "/stock"} label={id ? "Torna alla scheda" : "Torna allo stock"} />
      <PageHeader title={id ? "Modifica auto" : "Nuova auto"} subtitle={id ? `${veicolo.data?.marca} ${veicolo.data?.modello}` : "I campi con * sono obbligatori."} />

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <Section title="Dati principali">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Marca" htmlFor="v-marca" required error={err.marca?.message}>
              <Input id="v-marca" autoComplete="off" aria-invalid={!!err.marca} {...register("marca")} />
            </Field>
            <Field label="Modello" htmlFor="v-modello" required error={err.modello?.message}>
              <Input id="v-modello" autoComplete="off" aria-invalid={!!err.modello} {...register("modello")} />
            </Field>
            <Field label="Versione" htmlFor="v-versione" className="sm:col-span-2">
              <Input id="v-versione" placeholder="Es. 1.5 TSI 150 CV Style" {...register("versione")} />
            </Field>
            <Field label="Tipo" htmlFor="v-tipo">
              <Select id="v-tipo" {...register("tipo")}>
                {opts(TIPI_VEICOLO)}
              </Select>
            </Field>
            <Field label="Stato" htmlFor="v-stato">
              <Select id="v-stato" {...register("stato")}>
                {opts(STATI_VEICOLO)}
              </Select>
            </Field>
            <Field label="Targa" htmlFor="v-targa" error={err.targa?.message}>
              <Input id="v-targa" className="uppercase" placeholder="AB 123 CD" aria-invalid={!!err.targa} {...register("targa")} />
            </Field>
            <Field label="Telaio (VIN)" htmlFor="v-telaio" error={err.telaio?.message}>
              <Input id="v-telaio" className="uppercase" maxLength={17} aria-invalid={!!err.telaio} {...register("telaio")} />
            </Field>
            <Field label="In stock dal" htmlFor="v-ingresso" required error={err.data_ingresso?.message}>
              <Input id="v-ingresso" type="date" aria-invalid={!!err.data_ingresso} {...register("data_ingresso")} />
            </Field>
          </div>
        </Section>

        <Section title="Caratteristiche">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Anno" htmlFor="v-anno" error={err.anno?.message}>
              <Input id="v-anno" inputMode="numeric" maxLength={4} aria-invalid={!!err.anno} {...register("anno")} />
            </Field>
            <Field label="Chilometri" htmlFor="v-km" required error={err.km?.message}>
              <Input id="v-km" inputMode="numeric" aria-invalid={!!err.km} {...register("km")} />
            </Field>
            <Field label="Alimentazione" htmlFor="v-alim">
              <Select id="v-alim" {...register("alimentazione")}>
                <option value="">Non indicata</option>
                {opts(ALIMENTAZIONI)}
              </Select>
            </Field>
            <Field label="Cambio" htmlFor="v-cambio">
              <Select id="v-cambio" {...register("cambio")}>
                <option value="">Non indicato</option>
                {opts(CAMBI)}
              </Select>
            </Field>
            <Field label="Colore" htmlFor="v-colore">
              <Input id="v-colore" {...register("colore")} />
            </Field>
          </div>
        </Section>

        <Section title="Prezzo">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prezzo di vendita (€)" htmlFor="v-pv" required error={err.prezzo_vendita?.message}>
              <Input id="v-pv" inputMode="decimal" aria-invalid={!!err.prezzo_vendita} {...register("prezzo_vendita")} />
            </Field>
            {isManager && (
              <Field
                label="Prezzo di acquisto (€)"
                htmlFor="v-pa"
                error={err.prezzo_acquisto?.message}
                hint="Visibile solo a titolare e responsabile vendite."
              >
                <Input id="v-pa" inputMode="decimal" aria-invalid={!!err.prezzo_acquisto} {...register("prezzo_acquisto")} />
              </Field>
            )}
          </div>
          {isManager && margine != null && (
            <p className="mt-4 rounded-lg bg-muted px-4 py-3 text-[15px]">
              Margine lordo:{" "}
              <strong className={margine < 0 ? "text-destructive" : "text-success"}>{euro(margine)}</strong>
              {prezzo(pv) ? <span className="text-muted-foreground"> ({Math.round((margine / prezzo(pv)!) * 100)}%)</span> : null}
            </p>
          )}
        </Section>

        <Section title="Descrizione e note">
          <div className="space-y-4">
            <Field label="Descrizione annuncio" htmlFor="v-desc" error={err.descrizione?.message} hint="Puoi generarla con l'AI dalla scheda dell'auto.">
              <Textarea id="v-desc" {...register("descrizione")} />
            </Field>
            <Field label="Note interne" htmlFor="v-note" error={err.note_interne?.message} hint="Non compaiono negli annunci.">
              <Textarea id="v-note" className="min-h-24" placeholder="Es. tagliando da fare, graffio paraurti posteriore" {...register("note_interne")} />
            </Field>
          </div>
        </Section>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Annulla
          </Button>
          <Button type="submit" variant="accent" size="lg" disabled={formState.isSubmitting}>
            {formState.isSubmitting && <Spinner />}
            {id ? "Salva modifiche" : "Aggiungi allo stock"}
          </Button>
        </div>
      </form>
    </div>
  );
}
