import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, Download, MessageCircle } from "lucide-react";
import { BackLink } from "@/components/shared/BackLink";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Section } from "@/components/shared/Section";
import { ErrorState, PageLoader, Spinner } from "@/components/shared/States";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/input";
import { useSessione } from "@/lib/auth";
import { mostraErrore } from "@/lib/errors";
import { euro, euroCent, km } from "@/lib/format";
import { ALIMENTAZIONI } from "@/lib/labels";
import { etichettaVeicolo, useVeicoliSelezionabili } from "@/lib/queries";
import { aNumero, numeroOpzionale } from "@/lib/schemas";
import { apriDocumento } from "@/lib/storage";
import { BUCKET_DOCUMENTI, supabase } from "@/lib/supabase";
import type { Quote } from "@/types/db";
import { useAggiornaLead, useCreaPreventivo, useInvalidaLead, useLead } from "./api";
import { nomeLead } from "./LeadCard";
import { calcolaRata, generaPdfPreventivo } from "./pdfPreventivo";
import { useInviaMessaggio } from "./scheda/messaggi";

const n = (v: string) => aNumero(v) ?? 0;

const schema = z
  .object({
    vehicle_id: z.string(),
    prezzo: numeroOpzionale("Prezzo non valido").refine((v) => v.trim() !== "" && n(v) > 0, "Inserisci il prezzo"),
    sconto: numeroOpzionale("Sconto non valido"),
    permuta_valutata: numeroOpzionale("Valore non valido"),
    anticipo: numeroOpzionale("Anticipo non valido"),
    finanziamento: z.boolean(),
    durata_mesi: z.string(),
    tan: numeroOpzionale("TAN non valido").refine((v) => v === "" || n(v) <= 30, "Il TAN deve essere tra 0 e 30%"),
    stato: z.enum(["bozza", "inviato"]),
    note: z.string().trim().max(800, "Massimo 800 caratteri"),
  })
  .refine((v) => n(v.sconto) <= n(v.prezzo), { path: ["sconto"], message: "Lo sconto non può superare il prezzo" })
  .refine((v) => n(v.prezzo) - n(v.sconto) - n(v.permuta_valutata) - n(v.anticipo) >= 0, {
    path: ["anticipo"],
    message: "Permuta e anticipo superano il prezzo",
  })
  .refine((v) => !v.finanziamento || v.tan.trim() !== "", { path: ["tan"], message: "Inserisci il TAN" });
type Valori = z.infer<typeof schema>;

const DURATE = [12, 24, 36, 48, 60, 72, 84];

export default function PreventivoPage() {
  const { id } = useParams();
  const { data: lead, isLoading, error, refetch } = useLead(id);
  if (isLoading) return <PageLoader />;
  if (error || !lead)
    return (
      <div>
        <BackLink to="/lead" label="Lead" />
        {error ? <ErrorState error={error} onRetry={() => void refetch()} /> : <EmptyState art="ricerca" title="Lead non trovato" />}
      </div>
    );
  return <FormPreventivo leadId={lead.id} />;
}

function FormPreventivo({ leadId }: { leadId: string }) {
  const { data: lead } = useLead(leadId);
  const { organizzazione, profilo, orgId } = useSessione();
  const veicoli = useVeicoliSelezionabili();
  const crea = useCreaPreventivo();
  const aggiornaLead = useAggiornaLead();
  const invalida = useInvalidaLead();
  const [salvato, setSalvato] = useState<Quote | null>(null);

  const form = useForm<Valori>({
    resolver: zodResolver(schema),
    defaultValues: {
      vehicle_id: lead?.vehicle_id ?? "",
      prezzo: lead?.veicolo_prezzo != null ? String(lead.veicolo_prezzo) : "",
      sconto: "",
      permuta_valutata: "",
      anticipo: "",
      finanziamento: lead?.finanziamento ?? false,
      durata_mesi: "48",
      tan: "6,99",
      stato: "inviato",
      note: "",
    },
  });
  const err = form.formState.errors;
  const v = form.watch();

  // Cambiando auto, il prezzo si allinea al prezzo di vendita in stock.
  const vehicleId = v.vehicle_id;
  useEffect(() => {
    if (!vehicleId || vehicleId === lead?.vehicle_id) return;
    const auto = veicoli.data?.find((x) => x.id === vehicleId);
    if (auto?.prezzo_vendita != null) form.setValue("prezzo", String(auto.prezzo_vendita));
  }, [vehicleId, lead?.vehicle_id, veicoli.data, form]);

  const conti = useMemo(() => {
    const totale = n(v.prezzo) - n(v.sconto);
    const saldo = totale - n(v.permuta_valutata) - n(v.anticipo);
    const rata = v.finanziamento ? calcolaRata(Math.max(saldo, 0), n(v.tan), Number(v.durata_mesi)) : null;
    return { totale, saldo, rata };
  }, [v.prezzo, v.sconto, v.permuta_valutata, v.anticipo, v.finanziamento, v.tan, v.durata_mesi]);

  if (!lead) return null;

  async function creaPdf(q: Quote) {
    const auto = veicoli.data?.find((x) => x.id === q.vehicle_id);
    const { data: dettagli } = q.vehicle_id
      ? await supabase.from("vehicles").select("anno, km, alimentazione, colore, targa").eq("id", q.vehicle_id).maybeSingle()
      : { data: null };
    const bytes = await generaPdfPreventivo({
      org: organizzazione,
      cliente: { nome: nomeLead(lead!), telefono: lead!.contatto_telefono, email: lead!.contatto_email },
      auto: auto
        ? {
            descrizione: `${auto.marca} ${auto.modello}${auto.versione ? ` ${auto.versione}` : ""}`,
            dettagli: [
              dettagli?.anno,
              dettagli?.km != null ? km(dettagli.km) : null,
              dettagli?.alimentazione ? ALIMENTAZIONI[dettagli.alimentazione as keyof typeof ALIMENTAZIONI] : null,
              dettagli?.colore,
              dettagli?.targa,
            ]
              .filter(Boolean)
              .join(" · "),
          }
        : null,
      quote: q,
      venditore: profilo.nome,
    });
    const path = `${orgId}/preventivi/${q.id}.pdf`;
    const up = await supabase.storage.from(BUCKET_DOCUMENTI).upload(path, new Blob([bytes as BlobPart], { type: "application/pdf" }), {
      contentType: "application/pdf",
      upsert: false,
    });
    if (up.error && !/exists/i.test(up.error.message)) throw up.error;
    const { data, error } = await supabase.from("quotes").update({ pdf_path: path }).eq("id", q.id).select("*").single();
    if (error) throw error;
    await invalida();
    return data as Quote;
  }

  const onSubmit = form.handleSubmit(async (val) => {
    let q: Quote;
    try {
      q = await crea.mutateAsync({
        lead_id: lead.id,
        vehicle_id: val.vehicle_id || null,
        prezzo: n(val.prezzo),
        sconto: n(val.sconto),
        permuta_valutata: n(val.permuta_valutata),
        anticipo: n(val.anticipo),
        finanziamento: val.finanziamento,
        durata_mesi: val.finanziamento ? Number(val.durata_mesi) : null,
        tan: val.finanziamento ? n(val.tan) : null,
        rata: conti.rata,
        stato: val.stato,
        note: val.note || null,
      });
      // Il preventivo si collega all'auto anche nel lead, se non c'era.
      if (!lead.vehicle_id && val.vehicle_id) await aggiornaLead.mutateAsync({ id: lead.id, vehicle_id: val.vehicle_id });
    } catch (e) {
      return mostraErrore(e, "Non sono riuscito a salvare il preventivo.");
    }
    try {
      setSalvato(await creaPdf(q));
      toast.success("Preventivo creato");
    } catch (e) {
      setSalvato(q);
      mostraErrore(e, "Preventivo salvato, ma il PDF non è stato generato. Riprova dalla pagina.");
    }
  });

  if (salvato) return <Esito lead={lead} quote={salvato} onRigeneraPdf={async () => setSalvato(await creaPdf(salvato))} />;

  return (
    <div>
      <BackLink to={`/lead/${lead.id}`} label={nomeLead(lead)} />
      <PageHeader title="Nuovo preventivo" subtitle={`per ${nomeLead(lead)}`} />
      <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Section title="Auto e prezzo">
            <div className="space-y-4">
              <Field label="Auto" htmlFor="pv-auto">
                <Select id="pv-auto" {...form.register("vehicle_id")}>
                  <option value="">Nessuna auto in stock</option>
                  {veicoli.data?.map((x) => (
                    <option key={x.id} value={x.id}>
                      {etichettaVeicolo(x)} – {euro(x.prezzo_vendita)}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Prezzo (€)" htmlFor="pv-prezzo" required error={err.prezzo?.message}>
                  <Input id="pv-prezzo" inputMode="decimal" aria-invalid={!!err.prezzo} {...form.register("prezzo")} />
                </Field>
                <Field label="Sconto (€)" htmlFor="pv-sconto" error={err.sconto?.message}>
                  <Input id="pv-sconto" inputMode="decimal" placeholder="0" aria-invalid={!!err.sconto} {...form.register("sconto")} />
                </Field>
                <Field label="Valutazione permuta (€)" htmlFor="pv-perm" error={err.permuta_valutata?.message}>
                  <Input id="pv-perm" inputMode="decimal" placeholder="0" {...form.register("permuta_valutata")} />
                </Field>
                <Field label="Anticipo (€)" htmlFor="pv-ant" error={err.anticipo?.message}>
                  <Input id="pv-ant" inputMode="decimal" placeholder="0" aria-invalid={!!err.anticipo} {...form.register("anticipo")} />
                </Field>
              </div>
            </div>
          </Section>
          <Section title="Finanziamento">
            <div className="space-y-4">
              <Switch id="pv-fin" label="Il cliente finanzia il saldo" checked={v.finanziamento} onChange={(x) => form.setValue("finanziamento", x)} />
              {v.finanziamento && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Durata" htmlFor="pv-durata">
                    <Select id="pv-durata" {...form.register("durata_mesi")}>
                      {DURATE.map((d) => (
                        <option key={d} value={d}>
                          {d} mesi
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="TAN (%)" htmlFor="pv-tan" error={err.tan?.message}>
                    <Input id="pv-tan" inputMode="decimal" aria-invalid={!!err.tan} {...form.register("tan")} />
                  </Field>
                </div>
              )}
            </div>
          </Section>
          <Section title="Note e stato">
            <div className="space-y-4">
              <Field label="Note per il cliente" htmlFor="pv-note" error={err.note?.message}>
                <Textarea id="pv-note" className="min-h-24" placeholder="Es. tagliando e passaggio di proprietà inclusi" {...form.register("note")} />
              </Field>
              <Field label="Stato" htmlFor="pv-stato">
                <Select id="pv-stato" {...form.register("stato")}>
                  <option value="inviato">Da inviare al cliente</option>
                  <option value="bozza">Bozza interna</option>
                </Select>
              </Field>
            </div>
          </Section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-lg border bg-card p-5 shadow-card">
            <h2 className="text-[17px] font-semibold">Riepilogo</h2>
            <dl className="mt-3 space-y-2 text-[15px]">
              <Riga label="Prezzo">{euroCent(n(v.prezzo))}</Riga>
              {n(v.sconto) > 0 && <Riga label="Sconto">– {euroCent(n(v.sconto))}</Riga>}
              <Riga label="Prezzo finale" forte>
                {euroCent(conti.totale)}
              </Riga>
              {n(v.permuta_valutata) > 0 && <Riga label="Permuta">– {euroCent(n(v.permuta_valutata))}</Riga>}
              {n(v.anticipo) > 0 && <Riga label="Anticipo">– {euroCent(n(v.anticipo))}</Riga>}
              <Riga label={v.finanziamento ? "Da finanziare" : "Saldo"} forte>
                {euroCent(conti.saldo)}
              </Riga>
            </dl>
            {conti.rata != null && (
              <div className="mt-4 rounded-lg bg-primary p-4 text-white">
                <p className="text-sm text-white/75">{v.durata_mesi} rate mensili da</p>
                <p className="text-[28px] font-bold leading-tight tabular-nums">{euroCent(conti.rata)}</p>
              </div>
            )}
            <Button type="submit" variant="accent" size="lg" className="mt-5 w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Spinner />}
              Crea preventivo e PDF
            </Button>
          </div>
        </aside>
      </form>
    </div>
  );
}

function Riga({ label, children, forte }: { label: string; children: ReactNode; forte?: boolean }) {
  return (
    <div className={forte ? "flex justify-between border-t pt-2 font-semibold" : "flex justify-between text-muted-foreground"}>
      <dt>{label}</dt>
      <dd className="tabular-nums text-foreground">{children}</dd>
    </div>
  );
}

function Esito({ lead, quote, onRigeneraPdf }: { lead: NonNullable<ReturnType<typeof useLead>["data"]>; quote: Quote; onRigeneraPdf: () => Promise<void> }) {
  const invia = useInviaMessaggio(lead);
  const [occupato, setOccupato] = useState(false);
  const testoWhatsApp = `Buongiorno ${lead.contatto_nome}, come d'accordo le invio il preventivo${
    lead.veicolo_marca ? ` per la ${lead.veicolo_marca} ${lead.veicolo_modello}` : ""
  }: prezzo finale ${euro(quote.totale)}${quote.finanziamento && quote.rata ? `, oppure ${quote.durata_mesi} rate da ${euroCent(quote.rata)}` : ""}. Le giro il PDF qui in chat. Resto a disposizione per qualsiasi domanda.`;

  async function esegui(f: () => Promise<void>) {
    setOccupato(true);
    try {
      await f();
    } catch (e) {
      mostraErrore(e);
    } finally {
      setOccupato(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <BackLink to={`/lead/${lead.id}`} label={nomeLead(lead)} />
      <div className="rounded-xl border bg-card p-6 text-center shadow-card">
        <CheckCircle2 className="mx-auto size-12 text-success" aria-hidden />
        <h1 className="mt-3 text-2xl font-bold">Preventivo pronto</h1>
        <p className="mt-1 text-muted-foreground">
          Prezzo finale {euro(quote.totale)}
          {quote.finanziamento && quote.rata ? ` · ${quote.durata_mesi} rate da ${euroCent(quote.rata)}` : ""}
        </p>
        <div className="mt-6 grid gap-3">
          {quote.pdf_path ? (
            <Button variant="outline" size="lg" disabled={occupato} onClick={() => esegui(() => apriDocumento(quote.pdf_path!))}>
              <Download aria-hidden /> Scarica PDF
            </Button>
          ) : (
            <Button variant="outline" size="lg" disabled={occupato} onClick={() => esegui(onRigeneraPdf)}>
              {occupato && <Spinner />} Genera di nuovo il PDF
            </Button>
          )}
          {lead.contatto_telefono && (
            <Button
              variant="accent"
              size="lg"
              disabled={occupato}
              onClick={() => esegui(async () => {
                await invia("whatsapp", testoWhatsApp);
                toast.success("WhatsApp aperto: allega il PDF scaricato");
              })}
            >
              <MessageCircle aria-hidden /> Invia su WhatsApp
            </Button>
          )}
          <Button asChild variant="ghost">
            <Link to={`/lead/${lead.id}`}>Torna al lead</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
