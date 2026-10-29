import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, Wand2 } from "lucide-react";
import { BackLink } from "@/components/shared/BackLink";
import { PageHeader } from "@/components/shared/PageHeader";
import { Section } from "@/components/shared/Section";
import { ErrorState, PageLoader, Spinner } from "@/components/shared/States";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/input";
import { useSessione } from "@/lib/auth";
import { messaggioErrore, mostraErrore } from "@/lib/errors";
import { euro, toDateInput } from "@/lib/format";
import { ALIMENTAZIONI, CAMBI, REGIMI_IVA, STATI_VEICOLO, TIPI_VEICOLO, opzioni } from "@/lib/labels";
import { CARROZZERIE, CLASSI_EURO, GARANZIE, TRAZIONI, kwInCv } from "@/lib/optional";
import { TARGA, aNumero, numeroIt, numeroOpzionale, testoObbligatorio, vuotoANull } from "@/lib/schemas";
import type { Alimentazione, Cambio, RegimeIva, StatoVeicolo, TipoVeicolo, Trazione, VehicleView } from "@/types/db";
import { decodificaVeicolo, useSalvaVeicolo, useVeicolo, type DatiDecodificati } from "./api";
import { OptionalPicker } from "./OptionalPicker";

const annoMax = new Date().getFullYear() + 1;
const MESI = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
const TELAIO = /^[A-HJ-NPR-Z0-9]{17}$/i;

/** Intero facoltativo in un intervallo (accetta "1.598"). */
const interoOpz = (min: number, max: number, msg: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || (Number.isInteger(numeroIt(v)) && numeroIt(v) >= min && numeroIt(v) <= max), msg);

const enumOpz = <T extends string>(m: Record<T, unknown>) => z.union([z.enum(Object.keys(m) as [T, ...T[]]), z.literal("")]);

const schema = z.object({
  // Identità
  marca: testoObbligatorio("la marca"),
  modello: testoObbligatorio("il modello"),
  versione: z.string().trim(),
  allestimento: z.string().trim(),
  carrozzeria: z.string().trim(),
  porte: interoOpz(1, 6, "Da 1 a 6 porte"),
  posti: interoOpz(1, 9, "Da 1 a 9 posti"),
  targa: z.string().trim().refine((v) => v === "" || TARGA.test(v), "Targa non valida (es. AB 123 CD)"),
  telaio: z.string().trim().refine((v) => v === "" || TELAIO.test(v), "Il telaio (VIN) ha 17 caratteri, senza I, O e Q"),
  // Immatricolazione e stato
  anno: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d{4}$/.test(v) && Number(v) >= 1950 && Number(v) <= annoMax), `Anno tra 1950 e ${annoMax}`),
  mese_immatricolazione: z.string(),
  km: z
    .string()
    .trim()
    .min(1, "Inserisci i km (0 per un'auto nuova)")
    .refine((v) => Number.isInteger(numeroIt(v)) && numeroIt(v) >= 0, "Chilometri non validi"),
  tipo: z.enum(Object.keys(TIPI_VEICOLO) as [TipoVeicolo, ...TipoVeicolo[]]),
  stato: z.enum(Object.keys(STATI_VEICOLO) as [StatoVeicolo, ...StatoVeicolo[]]),
  numero_proprietari: interoOpz(0, 20, "Da 0 a 20"),
  tagliandi_certificati: z.boolean(),
  neopatentati: z.boolean(),
  data_ingresso: z.string().min(1, "Indica la data di ingresso"),
  // Motore
  alimentazione: enumOpz<Alimentazione>(ALIMENTAZIONI),
  cilindrata: interoOpz(0, 10000, "Cilindrata in cm³ non valida"),
  potenza_kw: interoOpz(1, 2000, "Potenza in kW non valida"),
  cambio: enumOpz<Cambio>(CAMBI),
  trazione: enumOpz<Trazione>(TRAZIONI),
  classe_euro: z.string(),
  consumo_misto: numeroOpzionale("Consumo non valido").refine((v) => v === "" || numeroIt(v) <= 100, "Consumo non valido"),
  emissioni_co2: interoOpz(0, 1000, "Emissioni in g/km non valide"),
  // Colori e garanzia
  colore: z.string().trim(),
  colore_interni: z.string().trim(),
  garanzia_mesi: interoOpz(0, 120, "Da 0 a 120 mesi"),
  garanzia_tipo: z.string(),
  // Optional e note
  optional: z.array(z.string()),
  optional_extra: z.string().trim().max(1000, "Massimo 1000 caratteri"),
  difetti: z.string().trim().max(2000, "Massimo 2000 caratteri"),
  note_interne: z.string().trim().max(2000, "Massimo 2000 caratteri"),
  // Prezzo
  prezzo_vendita: z
    .string()
    .trim()
    .min(1, "Inserisci il prezzo di vendita")
    .refine((v) => numeroIt(v) > 0, "Prezzo non valido"),
  regime_iva: z.enum(Object.keys(REGIMI_IVA) as [RegimeIva, ...RegimeIva[]]),
  sconto_max: numeroOpzionale("Sconto non valido"),
  prezzo_acquisto: numeroOpzionale("Prezzo non valido"),
});
type Valori = z.infer<typeof schema>;

const VUOTO: Valori = {
  marca: "", modello: "", versione: "", allestimento: "", carrozzeria: "", porte: "", posti: "", targa: "", telaio: "",
  anno: "", mese_immatricolazione: "", km: "", tipo: "usato", stato: "disponibile", numero_proprietari: "",
  tagliandi_certificati: false, neopatentati: false, data_ingresso: toDateInput(new Date()),
  alimentazione: "", cilindrata: "", potenza_kw: "", cambio: "", trazione: "", classe_euro: "", consumo_misto: "", emissioni_co2: "",
  colore: "", colore_interni: "", garanzia_mesi: "", garanzia_tipo: "",
  optional: [], optional_extra: "", difetti: "", note_interne: "",
  prezzo_vendita: "", regime_iva: "margine", sconto_max: "", prezzo_acquisto: "",
};

const s = (n: number | null | undefined) => (n == null ? "" : String(n));

function valoriDa(v: VehicleView): Valori {
  return {
    marca: v.marca, modello: v.modello, versione: v.versione ?? "", allestimento: v.allestimento ?? "", carrozzeria: v.carrozzeria ?? "",
    porte: s(v.porte), posti: s(v.posti), targa: v.targa ?? "", telaio: v.telaio ?? "",
    anno: s(v.anno), mese_immatricolazione: s(v.mese_immatricolazione), km: String(v.km), tipo: v.tipo, stato: v.stato,
    numero_proprietari: s(v.numero_proprietari), tagliandi_certificati: v.tagliandi_certificati, neopatentati: v.neopatentati,
    data_ingresso: v.data_ingresso,
    alimentazione: v.alimentazione ?? "", cilindrata: s(v.cilindrata), potenza_kw: s(v.potenza_kw), cambio: v.cambio ?? "",
    trazione: v.trazione ?? "", classe_euro: v.classe_euro ?? "", consumo_misto: v.consumo_misto != null ? String(v.consumo_misto).replace(".", ",") : "",
    emissioni_co2: s(v.emissioni_co2), colore: v.colore ?? "", colore_interni: v.colore_interni ?? "",
    garanzia_mesi: s(v.garanzia_mesi), garanzia_tipo: v.garanzia_tipo ?? "",
    optional: v.optional ?? [], optional_extra: v.optional_extra ?? "", difetti: v.difetti ?? "", note_interne: v.note_interne ?? "",
    prezzo_vendita: s(v.prezzo_vendita), regime_iva: v.regime_iva, sconto_max: s(v.sconto_max), prezzo_acquisto: "",
  };
}

/** Etichette dei campi compilabili dalla decodifica (per dire all'utente cosa è stato compilato). */
const ETICHETTE_DECODIFICA: Partial<Record<keyof DatiDecodificati & keyof Valori, string>> = {
  marca: "Marca", modello: "Modello", versione: "Versione", allestimento: "Allestimento", carrozzeria: "Carrozzeria",
  porte: "Porte", posti: "Posti", anno: "Anno", mese_immatricolazione: "Mese", alimentazione: "Alimentazione",
  cilindrata: "Cilindrata", potenza_kw: "Potenza", cambio: "Cambio", trazione: "Trazione", classe_euro: "Classe Euro",
  consumo_misto: "Consumo", emissioni_co2: "CO2", colore: "Colore", telaio: "Telaio", targa: "Targa",
};

const SEZIONI = [
  ["identita", "Identità"],
  ["immatricolazione", "Immatricolazione"],
  ["motore", "Motore"],
  ["colori", "Colori e garanzia"],
  ["optional", "Optional"],
  ["prezzo", "Prezzo"],
  ["note", "Note"],
] as const;

export default function VeicoloFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isManager, puo } = useSessione();
  const ruoloEconomico = puo("titolare", "responsabile_vendite", "amministrazione");
  const veicolo = useVeicolo(id);
  const salva = useSalvaVeicolo();

  const form = useForm<Valori>({ resolver: zodResolver(schema), defaultValues: VUOTO });
  const { register, formState, control } = form;
  const err = formState.errors;

  useEffect(() => {
    if (veicolo.data) form.reset(valoriDa(veicolo.data));
  }, [veicolo.data, form]);

  const [pv, pa, kw, alimentazione, neopatentati] = useWatch({
    control,
    name: ["prezzo_vendita", "prezzo_acquisto", "potenza_kw", "alimentazione", "neopatentati"],
  });
  const kwNum = kw ? numeroIt(kw) : NaN;
  const margineIndicativo = pv && pa && numeroIt(pv) > 0 && numeroIt(pa) > 0 ? numeroIt(pv) - numeroIt(pa) : null;

  /* ---------- Inserimento rapido da targa o telaio ---------- */
  const [rapido, setRapido] = useState("");
  const [decodificando, setDecodificando] = useState(false);
  const [esitoDecodifica, setEsitoDecodifica] = useState<{ compilati: string[]; messaggio?: string } | null>(null);

  async function compilaInAutomatico() {
    const codice = rapido.toUpperCase().replace(/[\s-]/g, "");
    const eTelaio = codice.length === 17;
    if (eTelaio ? !TELAIO.test(codice) : !TARGA.test(codice)) {
      setEsitoDecodifica({ compilati: [], messaggio: "Scrivi una targa (AB123CD) o un telaio di 17 caratteri." });
      return;
    }
    setDecodificando(true);
    setEsitoDecodifica(null);
    try {
      const { dati, messaggio } = await decodificaVeicolo(eTelaio ? { telaio: codice } : { targa: codice });
      const trovati: DatiDecodificati = { ...(dati ?? {}), ...(eTelaio ? { telaio: codice } : { targa: codice }) };
      const compilati: string[] = [];
      for (const [k, val] of Object.entries(trovati) as [keyof Valori, unknown][]) {
        if (val == null || val === "" || !(k in VUOTO)) continue;
        const attuale = form.getValues(k);
        // Mai sovrascrivere ciò che l'utente ha già scritto
        if (typeof attuale === "string" && attuale.trim() !== "") continue;
        form.setValue(k, String(val) as never, { shouldDirty: true, shouldValidate: true });
        const etichetta = ETICHETTE_DECODIFICA[k as keyof typeof ETICHETTE_DECODIFICA];
        if (etichetta) compilati.push(etichetta);
      }
      setEsitoDecodifica({ compilati, messaggio });
    } catch (e) {
      setEsitoDecodifica({ compilati: [], messaggio: messaggioErrore(e, "Decodifica non riuscita: compila i campi a mano.") });
    } finally {
      setDecodificando(false);
    }
  }

  // Errori di validazione: avvisa (il form è lungo, su telefono il campo sbagliato può non vedersi)
  const onInvalid = () => toast.error("Controlla i campi evidenziati in rosso.");

  const onSubmit = form.handleSubmit(async (v) => {
    const intero = (x: string) => (x.trim() === "" ? null : Math.round(numeroIt(x)));
    try {
      const salvato = await salva.mutateAsync({
        id,
        veicolo: {
          marca: v.marca,
          modello: v.modello,
          versione: vuotoANull(v.versione),
          allestimento: vuotoANull(v.allestimento),
          carrozzeria: vuotoANull(v.carrozzeria),
          porte: intero(v.porte),
          posti: intero(v.posti),
          targa: v.targa ? v.targa.replace(/\s/g, "").toUpperCase() : null,
          telaio: v.telaio ? v.telaio.toUpperCase() : null,
          anno: v.anno ? Number(v.anno) : null,
          mese_immatricolazione: v.mese_immatricolazione ? Number(v.mese_immatricolazione) : null,
          km: Math.round(numeroIt(v.km)),
          tipo: v.tipo,
          stato: v.stato,
          numero_proprietari: intero(v.numero_proprietari),
          tagliandi_certificati: v.tagliandi_certificati,
          neopatentati: v.neopatentati,
          data_ingresso: v.data_ingresso,
          alimentazione: v.alimentazione || null,
          cilindrata: intero(v.cilindrata),
          potenza_kw: intero(v.potenza_kw),
          cambio: v.cambio || null,
          trazione: v.trazione || null,
          classe_euro: vuotoANull(v.classe_euro),
          consumo_misto: aNumero(v.consumo_misto),
          emissioni_co2: intero(v.emissioni_co2),
          colore: vuotoANull(v.colore),
          colore_interni: vuotoANull(v.colore_interni),
          garanzia_mesi: intero(v.garanzia_mesi),
          garanzia_tipo: vuotoANull(v.garanzia_tipo),
          optional: v.optional,
          optional_extra: vuotoANull(v.optional_extra),
          difetti: vuotoANull(v.difetti),
          note_interne: vuotoANull(v.note_interne),
          prezzo_vendita: aNumero(v.prezzo_vendita),
          regime_iva: v.regime_iva,
          sconto_max: aNumero(v.sconto_max),
        },
        prezzoAcquisto: !id && ruoloEconomico ? aNumero(v.prezzo_acquisto) : undefined,
      });
      if (salvato.costoNonSalvato) toast.warning("Auto salvata, ma il prezzo di acquisto no: aggiungilo nel Conto economico.");
      if (id) {
        toast.success("Modifiche salvate");
        navigate(`/stock/${id}`);
      } else {
        toast.success("Auto aggiunta allo stock", { description: "Ora aggiungi le foto e guarda chi potrebbe essere interessato." });
        navigate(`/stock/${salvato.id}?nuovo=1&tab=interessati`);
      }
    } catch (e) {
      mostraErrore(e, "Non sono riuscito a salvare l'auto.");
    }
  }, onInvalid);

  if (id && veicolo.isLoading) return <PageLoader />;
  if (id && (veicolo.isError || !veicolo.data)) return <ErrorState error={veicolo.error} onRetry={() => void veicolo.refetch()} title="Auto non trovata" />;

  const opts = <K extends string>(m: Record<K, string | { label: string }>) =>
    opzioni(m).map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ));
  const lista = (voci: readonly string[]) => voci.map((x) => <option key={x} value={x}>{x}</option>);
  const elettrica = alimentazione === "elettrica";

  return (
    <div className="mx-auto max-w-3xl">
      <BackLink to={id ? `/stock/${id}` : "/stock"} label={id ? "Torna alla scheda" : "Torna allo stock"} />
      <PageHeader
        title={id ? "Modifica scheda tecnica" : "Nuova auto"}
        subtitle={id ? `${veicolo.data?.marca} ${veicolo.data?.modello}` : "I campi con * sono obbligatori. Il resto puoi completarlo dopo."}
      />

      {/* Indice delle sezioni: su telefono il form è lungo */}
      <nav aria-label="Sezioni del modulo" className="sticky top-16 z-20 -mx-4 mb-5 flex gap-2 overflow-x-auto border-b bg-muted/95 px-4 py-2 backdrop-blur scrollbar-none sm:mx-0 sm:rounded-lg sm:border">
        {SEZIONI.map(([idSez, label]) => (
          <a key={idSez} href={`#sez-${idSez}`} className="shrink-0 rounded-full bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground shadow-card hover:text-foreground">
            {label}
          </a>
        ))}
      </nav>

      <Section title={<span className="flex items-center gap-2"><Wand2 className="size-5 text-accent" aria-hidden /> Inserimento rapido</span>} className="mb-5 border-accent/30">
        <p className="mb-3 text-[15px] text-muted-foreground">Scrivi targa o numero di telaio: compiliamo in automatico i campi vuoti, poi controlli e completi.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={rapido}
            onChange={(e) => setRapido(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void compilaInAutomatico();
              }
            }}
            placeholder="AB 123 CD oppure ZFA31200000123456"
            className="uppercase sm:flex-1"
            aria-label="Targa o telaio"
            autoComplete="off"
          />
          <Button type="button" variant="accent" onClick={() => void compilaInAutomatico()} disabled={decodificando || !rapido.trim()}>
            {decodificando ? <Spinner /> : <Wand2 aria-hidden />}
            Compila in automatico
          </Button>
        </div>
        {esitoDecodifica && (
          <div role="status" className="mt-3 rounded-lg bg-muted px-4 py-3 text-[15px]">
            {esitoDecodifica.compilati.length > 0 && (
              <p className="flex items-start gap-2 text-success">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
                <span>
                  Compilati: <strong>{esitoDecodifica.compilati.join(", ")}</strong>. Controllali prima di salvare.
                </span>
              </p>
            )}
            {esitoDecodifica.messaggio && <p className={esitoDecodifica.compilati.length ? "mt-1 text-muted-foreground" : ""}>{esitoDecodifica.messaggio}</p>}
          </div>
        )}
      </Section>

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <div id="sez-identita" className="scroll-mt-32">
          <Section title="Identità" bodyClassName="grid gap-4 sm:grid-cols-2">
            <Field label="Marca" htmlFor="v-marca" required error={err.marca?.message}>
              <Input id="v-marca" autoComplete="off" aria-invalid={!!err.marca} {...register("marca")} />
            </Field>
            <Field label="Modello" htmlFor="v-modello" required error={err.modello?.message}>
              <Input id="v-modello" autoComplete="off" aria-invalid={!!err.modello} {...register("modello")} />
            </Field>
            <Field label="Versione" htmlFor="v-versione">
              <Input id="v-versione" placeholder="Es. 1.5 TSI 150 CV" {...register("versione")} />
            </Field>
            <Field label="Allestimento" htmlFor="v-allest">
              <Input id="v-allest" placeholder="Es. Style, Business" {...register("allestimento")} />
            </Field>
            <Field label="Carrozzeria" htmlFor="v-carr">
              <Select id="v-carr" {...register("carrozzeria")}>
                <option value="">Non indicata</option>
                {lista(CARROZZERIE)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Porte" htmlFor="v-porte" error={err.porte?.message}>
                <Input id="v-porte" inputMode="numeric" aria-invalid={!!err.porte} {...register("porte")} />
              </Field>
              <Field label="Posti" htmlFor="v-posti" error={err.posti?.message}>
                <Input id="v-posti" inputMode="numeric" aria-invalid={!!err.posti} {...register("posti")} />
              </Field>
            </div>
            <Field label="Targa" htmlFor="v-targa" error={err.targa?.message}>
              <Input id="v-targa" className="uppercase" placeholder="AB 123 CD" aria-invalid={!!err.targa} {...register("targa")} />
            </Field>
            <Field label="Telaio (VIN)" htmlFor="v-telaio" error={err.telaio?.message}>
              <Input id="v-telaio" className="uppercase" maxLength={17} aria-invalid={!!err.telaio} {...register("telaio")} />
            </Field>
          </Section>
        </div>

        <div id="sez-immatricolazione" className="scroll-mt-32">
          <Section title="Immatricolazione e stato" bodyClassName="grid gap-4 sm:grid-cols-2">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Anno" htmlFor="v-anno" error={err.anno?.message}>
                <Input id="v-anno" inputMode="numeric" maxLength={4} aria-invalid={!!err.anno} {...register("anno")} />
              </Field>
              <Field label="Mese" htmlFor="v-mese">
                <Select id="v-mese" {...register("mese_immatricolazione")}>
                  <option value="">—</option>
                  {MESI.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Chilometri" htmlFor="v-km" required error={err.km?.message}>
              <Input id="v-km" inputMode="numeric" aria-invalid={!!err.km} {...register("km")} />
            </Field>
            <Field label="Condizione" htmlFor="v-tipo">
              <Select id="v-tipo" {...register("tipo")}>
                {opts(TIPI_VEICOLO)}
              </Select>
            </Field>
            <Field label="Stato" htmlFor="v-stato">
              <Select id="v-stato" {...register("stato")}>
                {opts(STATI_VEICOLO)}
              </Select>
            </Field>
            <Field label="Proprietari precedenti" htmlFor="v-prop" error={err.numero_proprietari?.message}>
              <Input id="v-prop" inputMode="numeric" aria-invalid={!!err.numero_proprietari} {...register("numero_proprietari")} />
            </Field>
            <Field label="In stock dal" htmlFor="v-ingresso" required error={err.data_ingresso?.message}>
              <Input id="v-ingresso" type="date" aria-invalid={!!err.data_ingresso} {...register("data_ingresso")} />
            </Field>
            <Controller
              control={control}
              name="tagliandi_certificati"
              render={({ field }) => <Switch id="v-tagliandi" label="Tagliandi certificati" checked={field.value} onChange={field.onChange} />}
            />
            <div>
              <Controller
                control={control}
                name="neopatentati"
                render={({ field }) => <Switch id="v-neo" label="Adatta ai neopatentati" checked={field.value} onChange={field.onChange} />}
              />
              {!neopatentati && Number.isFinite(kwNum) && kwNum > 0 && kwNum <= 70 && (
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Con {kwNum} kW potrebbe esserlo (limiti: 70 kW e 55 kW/t).{" "}
                  <button type="button" className="font-medium text-accent" onClick={() => form.setValue("neopatentati", true, { shouldDirty: true })}>
                    Segna come adatta
                  </button>
                </p>
              )}
            </div>
          </Section>
        </div>

        <div id="sez-motore" className="scroll-mt-32">
          <Section title="Motore e consumi" bodyClassName="grid gap-4 sm:grid-cols-2">
            <Field label="Alimentazione" htmlFor="v-alim">
              <Select id="v-alim" {...register("alimentazione")}>
                <option value="">Non indicata</option>
                {opts(ALIMENTAZIONI)}
              </Select>
            </Field>
            <Field label="Cilindrata (cm³)" htmlFor="v-cil" error={err.cilindrata?.message}>
              <Input id="v-cil" inputMode="numeric" disabled={elettrica} aria-invalid={!!err.cilindrata} {...register("cilindrata")} />
            </Field>
            <Field
              label="Potenza (kW)"
              htmlFor="v-kw"
              error={err.potenza_kw?.message}
              hint={Number.isFinite(kwNum) && kwNum > 0 ? `Pari a ${kwInCv(kwNum)} CV` : "I CV si calcolano da soli"}
            >
              <Input id="v-kw" inputMode="numeric" aria-invalid={!!err.potenza_kw} {...register("potenza_kw")} />
            </Field>
            <Field label="Cambio" htmlFor="v-cambio">
              <Select id="v-cambio" {...register("cambio")}>
                <option value="">Non indicato</option>
                {opts(CAMBI)}
              </Select>
            </Field>
            <Field label="Trazione" htmlFor="v-traz">
              <Select id="v-traz" {...register("trazione")}>
                <option value="">Non indicata</option>
                {opts(TRAZIONI)}
              </Select>
            </Field>
            <Field label="Classe Euro" htmlFor="v-euro">
              <Select id="v-euro" {...register("classe_euro")} disabled={elettrica}>
                <option value="">Non indicata</option>
                {lista(CLASSI_EURO)}
              </Select>
            </Field>
            <Field label={elettrica ? "Consumo misto (kWh/100 km)" : "Consumo misto (l/100 km)"} htmlFor="v-cons" error={err.consumo_misto?.message}>
              <Input id="v-cons" inputMode="decimal" aria-invalid={!!err.consumo_misto} {...register("consumo_misto")} />
            </Field>
            <Field label="Emissioni CO2 (g/km)" htmlFor="v-co2" error={err.emissioni_co2?.message}>
              <Input id="v-co2" inputMode="numeric" aria-invalid={!!err.emissioni_co2} {...register("emissioni_co2")} />
            </Field>
          </Section>
        </div>

        <div id="sez-colori" className="scroll-mt-32">
          <Section title="Colori e garanzia" bodyClassName="grid gap-4 sm:grid-cols-2">
            <Field label="Colore esterno" htmlFor="v-colore">
              <Input id="v-colore" placeholder="Es. Grigio Moonstone metallizzato" {...register("colore")} />
            </Field>
            <Field label="Interni" htmlFor="v-interni">
              <Input id="v-interni" placeholder="Es. Tessuto nero" {...register("colore_interni")} />
            </Field>
            <Field label="Garanzia (mesi)" htmlFor="v-gar" error={err.garanzia_mesi?.message}>
              <Input id="v-gar" inputMode="numeric" aria-invalid={!!err.garanzia_mesi} {...register("garanzia_mesi")} />
            </Field>
            <Field label="Tipo di garanzia" htmlFor="v-gartipo">
              <Select id="v-gartipo" {...register("garanzia_tipo")}>
                <option value="">Non indicata</option>
                {lista(GARANZIE)}
              </Select>
            </Field>
          </Section>
        </div>

        <div id="sez-optional" className="scroll-mt-32">
          <Section title="Optional ed equipaggiamenti">
            <Controller control={control} name="optional" render={({ field }) => <OptionalPicker value={field.value} onChange={field.onChange} />} />
            <Field label="Altri equipaggiamenti" htmlFor="v-optx" className="mt-4" error={err.optional_extra?.message} hint="Quello che non trovi nell'elenco, separato da virgole.">
              <Textarea id="v-optx" className="min-h-20" {...register("optional_extra")} />
            </Field>
          </Section>
        </div>

        <div id="sez-prezzo" className="scroll-mt-32">
          <Section title="Prezzo" bodyClassName="grid gap-4 sm:grid-cols-2">
            <Field label="Prezzo di vendita (€)" htmlFor="v-pv" required error={err.prezzo_vendita?.message} hint="Il prezzo di listino mostrato a clienti e venditori.">
              <Input id="v-pv" inputMode="decimal" aria-invalid={!!err.prezzo_vendita} {...register("prezzo_vendita")} />
            </Field>
            <Field label="Sconto massimo concesso (€)" htmlFor="v-sconto" error={err.sconto_max?.message} hint="Il venditore può arrivare fin qui senza chiedere.">
              <Input id="v-sconto" inputMode="decimal" disabled={!isManager} aria-invalid={!!err.sconto_max} {...register("sconto_max")} />
            </Field>
            <Field label="Regime IVA" htmlFor="v-iva" hint={REGIMI_IVA[form.watch("regime_iva")].spiegazione}>
              <Select id="v-iva" {...register("regime_iva")} disabled={!isManager}>
                {opts(REGIMI_IVA)}
              </Select>
            </Field>
            {!id && ruoloEconomico && (
              <Field label="Prezzo di acquisto (€)" htmlFor="v-pa" error={err.prezzo_acquisto?.message} hint="Diventa la voce «Acquisto» del conto economico. Visibile solo ai ruoli autorizzati.">
                <Input id="v-pa" inputMode="decimal" aria-invalid={!!err.prezzo_acquisto} {...register("prezzo_acquisto")} />
              </Field>
            )}
            {!id && ruoloEconomico && margineIndicativo != null && (
              <p className="rounded-lg bg-muted px-4 py-3 text-[15px] sm:col-span-2">
                Differenza indicativa:{" "}
                <strong className={margineIndicativo < 0 ? "text-destructive" : "text-success"}>{euro(margineIndicativo)}</strong>
                <span className="text-muted-foreground"> — il margine reale, con IVA, costi e giacenza, è nel Conto economico.</span>
              </p>
            )}
          </Section>
        </div>

        <div id="sez-note" className="scroll-mt-32">
          <Section title="Difetti e note interne" bodyClassName="space-y-4">
            <Field label="Difetti o danni" htmlFor="v-difetti" error={err.difetti?.message} hint="Nota interna: non compare negli annunci, nella pagina pubblica né nei testi AI.">
              <Textarea id="v-difetti" className="min-h-20 border-warning/40 bg-warning-soft/40" placeholder="Es. graffio paraurti posteriore, sedile guida usurato" {...register("difetti")} />
            </Field>
            <Field label="Note interne" htmlFor="v-note" error={err.note_interne?.message}>
              <Textarea id="v-note" className="min-h-20" {...register("note_interne")} />
            </Field>
          </Section>
        </div>

        {/* Barra di salvataggio sempre raggiungibile (sopra la barra di navigazione su telefono) */}
        <div className="sticky bottom-[calc(68px+env(safe-area-inset-bottom))] z-20 -mx-4 flex gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:justify-end sm:rounded-lg sm:border lg:bottom-4">
          <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={() => navigate(-1)}>
            Annulla
          </Button>
          <Button type="submit" variant="accent" className="flex-[2] sm:flex-none" disabled={formState.isSubmitting}>
            {formState.isSubmitting && <Spinner />}
            {id ? "Salva modifiche" : "Aggiungi allo stock"}
          </Button>
        </div>
      </form>
    </div>
  );
}
