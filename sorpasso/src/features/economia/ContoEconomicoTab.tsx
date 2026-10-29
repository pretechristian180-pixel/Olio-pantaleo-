import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Calculator, FileText, Info, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { Section } from "@/components/shared/Section";
import { ErrorState, ListSkeleton, Spinner } from "@/components/shared/States";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessione } from "@/lib/auth";
import { mostraErrore } from "@/lib/errors";
import { dataBreve, euro, euroCent } from "@/lib/format";
import { REGIMI_IVA } from "@/lib/labels";
import { numeroOpzionale, aNumero } from "@/lib/schemas";
import { apriDocumento } from "@/lib/storage";
import { cn } from "@/lib/utils";
import type { RegimeIva, VehicleCost, VehicleEconomics, VehicleRevenue, VehicleView } from "@/types/db";
import {
  CATEGORIA_VENDITA,
  useAggiornaVeicoloEconomia,
  useCategorie,
  useCosti,
  useEconomiaVeicolo,
  useEliminaCosto,
  useEliminaRicavo,
  useRicavi,
} from "./api";
import { Semaforo } from "./Semaforo";
import { VoceDialog } from "./VoceDialog";

export const NOTA_COMMERCIALISTA = "Verifica i criteri fiscali con il tuo commercialista.";

const pct = (n: number | null | undefined) => (n == null ? "—" : `${n.toLocaleString("it-IT", { maximumFractionDigits: 1 })}%`);

/**
 * Tab "Conto economico" della scheda veicolo.
 * I numeri (margine, prezzo minimo, obiettivo, semaforo) li calcola il database (vista vehicle_economics):
 * qui si inseriscono le voci e si rileggono i totali.
 */
export default function ContoEconomicoTab({ veicolo }: { veicolo: VehicleView }) {
  const { puo, isManager } = useSessione();
  const accesso = puo("titolare", "responsabile_vendite", "amministrazione");
  const eco = useEconomiaVeicolo(accesso ? veicolo.id : undefined);
  const costi = useCosti(accesso ? veicolo.id : undefined);
  const ricavi = useRicavi(accesso ? veicolo.id : undefined);
  const categorie = useCategorie();

  const [dialogo, setDialogo] = useState<{ tipo: "costo" | "ricavo"; voce?: VehicleCost | VehicleRevenue } | null>(null);

  if (!accesso) {
    return (
      <EmptyState
        art="grafico"
        title="Dati economici riservati"
        text="Costi e margini sono visibili a titolare, responsabile vendite e amministrazione."
      />
    );
  }

  if (eco.isError) return <ErrorState error={eco.error} onRetry={() => void eco.refetch()} />;
  const e = eco.data;

  return (
    <div className="space-y-5">
      <Riepilogo e={e} caricamento={eco.isLoading} />

      <div className="grid gap-5 lg:grid-cols-2">
        <RegimeIvaBox veicolo={veicolo} modificabile={isManager} />
        {isManager && e && <PrezziBox veicolo={veicolo} e={e} />}
      </div>

      <TabellaCosti
        costi={costi.data}
        loading={costi.isLoading}
        error={costi.error}
        e={e}
        regime={veicolo.regime_iva}
        onNuovo={() => setDialogo({ tipo: "costo" })}
        onModifica={(v) => setDialogo({ tipo: "costo", voce: v })}
      />
      <TabellaRicavi
        ricavi={ricavi.data}
        loading={ricavi.isLoading}
        error={ricavi.error}
        e={e}
        regime={veicolo.regime_iva}
        onNuovo={() => setDialogo({ tipo: "ricavo" })}
        onModifica={(v) => setDialogo({ tipo: "ricavo", voce: v })}
      />

      <p className="flex items-start gap-2 rounded-lg border bg-card px-4 py-3 text-[15px] text-muted-foreground">
        <Info className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
        <span>
          I margini sono calcolati al netto dell'IVA secondo il regime indicato. {NOTA_COMMERCIALISTA}
        </span>
      </p>

      {dialogo && (
        <VoceDialog
          open
          onOpenChange={(v) => !v && setDialogo(null)}
          tipo={dialogo.tipo}
          voce={dialogo.voce}
          vehicleId={veicolo.id}
          categorie={categorie.data ?? []}
          venditaGiaPresente={!!ricavi.data?.some((r) => r.categoria === CATEGORIA_VENDITA)}
        />
      )}
    </div>
  );
}

/* ---------- Riepilogo ---------- */

function Numero({ label, valore, nota, forte, tono }: { label: string; valore: string; nota?: string; forte?: boolean; tono?: "red" | "green" }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-card">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 font-bold tabular-nums leading-tight",
          forte ? "text-[26px]" : "text-[22px]",
          tono === "red" && "text-destructive",
          tono === "green" && "text-success",
        )}
      >
        {valore}
      </p>
      {nota && <p className="mt-0.5 text-sm text-muted-foreground">{nota}</p>}
    </div>
  );
}

function Riepilogo({ e, caricamento }: { e: VehicleEconomics | null | undefined; caricamento: boolean }) {
  if (caricamento) return <Skeleton className="h-56 w-full" />;
  if (!e) return null;
  const tono = e.margine == null ? undefined : e.margine < 0 ? "red" : undefined;
  const bordo = e.semaforo ? { verde: "bg-success", giallo: "bg-warning", rosso: "bg-destructive" }[e.semaforo] : "bg-border";
  return (
    <section className="overflow-hidden rounded-lg border bg-card shadow-card">
      <div className={cn("h-1.5", bordo)} aria-hidden />
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-semibold">Conto economico</h2>
            <p className="text-[15px] text-muted-foreground">
              Obiettivo di margine: {pct(e.margine_obiettivo_pct)} · {REGIMI_IVA[e.regime_iva].label}
            </p>
          </div>
          <Semaforo valore={e.semaforo} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Numero
            label="Costo totale"
            valore={euro(e.costi_effettivi)}
            nota={e.regime_iva === "ordinario" ? "netto IVA (detraibile)" : "IVA compresa (non detraibile)"}
          />
          <Numero
            label={e.venduta ? "Prezzo di vendita" : "Prezzo di listino (non ancora venduta)"}
            valore={euro(e.prezzo_riferimento)}
            nota={e.ricavo_vendita_netto != null ? `netto IVA ${euro(e.ricavo_vendita_netto)}` : undefined}
          />
          <Numero
            label={e.venduta ? "Margine lordo" : "Margine lordo previsto"}
            valore={e.margine == null ? "—" : euro(e.margine)}
            nota={e.margine_pct != null ? `${pct(e.margine_pct)} sul ricavo netto` : "Inserisci prezzo e costi"}
            forte
            tono={tono}
          />
          <Numero
            label="Costo di giacenza"
            valore={euro(e.costo_giacenza)}
            nota={`${e.giorni_stock} giorni × ${euroCent(e.costo_giacenza_giorno)}/giorno`}
          />
          <Numero
            label="Margine dopo la giacenza"
            valore={e.margine_dopo_giacenza == null ? "—" : euro(e.margine_dopo_giacenza)}
            tono={e.margine_dopo_giacenza != null && e.margine_dopo_giacenza < 0 ? "red" : undefined}
          />
          <Numero label={e.venduta ? "Giorni in stock" : "Giorni in stock (finora)"} valore={String(e.giorni_stock)} />
        </div>
      </div>
    </section>
  );
}

/* ---------- Regime IVA ---------- */

function RegimeIvaBox({ veicolo, modificabile }: { veicolo: VehicleView; modificabile: boolean }) {
  const aggiorna = useAggiornaVeicoloEconomia();
  async function cambia(r: RegimeIva) {
    if (r === veicolo.regime_iva) return;
    try {
      await aggiorna.mutateAsync({ id: veicolo.id, regime_iva: r });
      toast.success(`Regime aggiornato: ${REGIMI_IVA[r].label}`);
    } catch (e) {
      mostraErrore(e);
    }
  }
  return (
    <Section title="Regime IVA">
      {modificabile ? (
        <Segmented
          label="Regime IVA"
          value={veicolo.regime_iva}
          onChange={(v) => void cambia(v)}
          options={(Object.keys(REGIMI_IVA) as RegimeIva[]).map((k) => ({ value: k, label: REGIMI_IVA[k].label }))}
        />
      ) : (
        <p className="text-[17px] font-semibold">{REGIMI_IVA[veicolo.regime_iva].label}</p>
      )}
      <p className="mt-3 text-[15px] text-muted-foreground">{REGIMI_IVA[veicolo.regime_iva].spiegazione}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-muted-foreground">
        {veicolo.regime_iva === "ordinario" ? (
          <>
            <li>I costi entrano nel calcolo al netto dell'IVA.</li>
            <li>Il ricavo di vendita è scorporato dell'IVA al 22%.</li>
          </>
        ) : (
          <>
            <li>I costi entrano nel calcolo IVA compresa.</li>
            <li>L'IVA della vendita si calcola solo sulla differenza tra prezzo e costi.</li>
          </>
        )}
      </ul>
      <p className="mt-3 text-sm text-muted-foreground">{NOTA_COMMERCIALISTA}</p>
    </Section>
  );
}

/* ---------- Prezzo minimo, obiettivo e sconto massimo (solo titolare/responsabile) ---------- */

const schemaPrezzi = z.object({
  prezzo_vendita: numeroOpzionale("Prezzo non valido"),
  sconto_max: numeroOpzionale("Sconto non valido"),
});

function PrezziBox({ veicolo, e }: { veicolo: VehicleView; e: VehicleEconomics }) {
  const aggiorna = useAggiornaVeicoloEconomia();
  const form = useForm<z.infer<typeof schemaPrezzi>>({
    resolver: zodResolver(schemaPrezzi),
    values: {
      prezzo_vendita: veicolo.prezzo_vendita != null ? String(veicolo.prezzo_vendita) : "",
      sconto_max: veicolo.sconto_max != null ? String(veicolo.sconto_max) : "",
    },
  });
  const err = form.formState.errors;
  const listino = veicolo.prezzo_vendita;
  // Sconto che mantiene il margine obiettivo e sconto massimo prima di andare in perdita
  const scontoObiettivo = listino != null && e.prezzo_obiettivo != null ? Math.max(0, Math.floor((listino - e.prezzo_obiettivo) / 50) * 50) : null;
  const scontoPareggio = listino != null && e.prezzo_minimo != null ? Math.max(0, Math.floor((listino - e.prezzo_minimo) / 50) * 50) : null;

  const onSubmit = form.handleSubmit(async (v) => {
    const prezzo = aNumero(v.prezzo_vendita);
    const sconto = aNumero(v.sconto_max);
    if (prezzo != null && sconto != null && sconto > prezzo) {
      form.setError("sconto_max", { message: "Lo sconto non può superare il prezzo" });
      return;
    }
    try {
      await aggiorna.mutateAsync({ id: veicolo.id, prezzo_vendita: prezzo, sconto_max: sconto });
      toast.success("Prezzi aggiornati", { description: "Il cambio di prezzo è registrato nello storico." });
    } catch (err) {
      mostraErrore(err);
    }
  });

  return (
    <Section
      title={
        <span className="flex items-center gap-2">
          <Calculator className="size-5 text-accent" aria-hidden /> Prezzi e sconto
        </span>
      }
      action={
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <Lock className="size-4" aria-hidden /> Solo titolare e responsabile
        </span>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-destructive-soft/60 p-3">
          <p className="text-sm text-muted-foreground">Prezzo minimo</p>
          <p className="text-[22px] font-bold tabular-nums">{euro(e.prezzo_minimo)}</p>
          <p className="text-sm text-muted-foreground">sotto questo prezzo l'auto va in perdita (giacenza inclusa)</p>
        </div>
        <div className="rounded-lg bg-success-soft/70 p-3">
          <p className="text-sm text-muted-foreground">Prezzo per l'obiettivo</p>
          <p className="text-[22px] font-bold tabular-nums">{euro(e.prezzo_obiettivo)}</p>
          <p className="text-sm text-muted-foreground">per un margine del {pct(e.margine_obiettivo_pct)}</p>
        </div>
      </div>
      {listino != null && (
        <p className="mt-3 text-[15px]">
          Sul listino di {euro(listino)} puoi scontare fino a{" "}
          <strong>{scontoObiettivo != null ? euro(scontoObiettivo) : "—"}</strong> restando nell'obiettivo, al massimo{" "}
          <strong>{scontoPareggio != null ? euro(scontoPareggio) : "—"}</strong> prima della perdita.
        </p>
      )}
      <form onSubmit={onSubmit} className="mt-4 grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Prezzo di listino (€)" htmlFor="ce-listino" error={err.prezzo_vendita?.message}>
          <Input id="ce-listino" inputMode="decimal" aria-invalid={!!err.prezzo_vendita} {...form.register("prezzo_vendita")} />
        </Field>
        <Field
          label="Sconto massimo concesso (€)"
          htmlFor="ce-sconto"
          error={err.sconto_max?.message}
          hint="È l'unico dato che vedono i venditori, insieme al listino."
        >
          <div className="flex gap-2">
            <Input id="ce-sconto" inputMode="decimal" aria-invalid={!!err.sconto_max} {...form.register("sconto_max")} />
            {scontoObiettivo != null && (
              <Button
                type="button"
                variant="outline"
                onClick={() => form.setValue("sconto_max", String(scontoObiettivo), { shouldDirty: true })}
                title="Usa lo sconto che mantiene il margine obiettivo"
              >
                Usa {euro(scontoObiettivo)}
              </Button>
            )}
          </div>
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" variant="accent" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
            {form.formState.isSubmitting && <Spinner />}
            Salva prezzi
          </Button>
        </div>
      </form>
    </Section>
  );
}

/* ---------- Costi ---------- */

function AzioniVoce({ onModifica, onElimina, eliminando }: { onModifica: () => void; onElimina?: () => void; eliminando?: boolean }) {
  return (
    <span className="flex justify-end gap-1">
      <Button size="icon-sm" variant="ghost" onClick={onModifica} aria-label="Modifica voce">
        <Pencil className="size-4" aria-hidden />
      </Button>
      {onElimina && (
        <Button size="icon-sm" variant="ghost" className="text-destructive" onClick={onElimina} disabled={eliminando} aria-label="Elimina voce">
          <Trash2 className="size-4" aria-hidden />
        </Button>
      )}
    </span>
  );
}

function TabellaCosti({
  costi,
  loading,
  error,
  e,
  regime,
  onNuovo,
  onModifica,
}: {
  costi: VehicleCost[] | undefined;
  loading: boolean;
  error: unknown;
  e: VehicleEconomics | null | undefined;
  regime: RegimeIva;
  onNuovo: () => void;
  onModifica: (c: VehicleCost) => void;
}) {
  const elimina = useEliminaCosto();
  const usaLordo = regime === "margine";
  const tot = (costi ?? []).reduce(
    (a, c) => ({ netto: a.netto + c.importo, iva: a.iva + c.importo_iva, lordo: a.lordo + c.importo_lordo }),
    { netto: 0, iva: 0, lordo: 0 },
  );

  async function onElimina(c: VehicleCost) {
    if (!window.confirm(`Eliminare il costo «${c.categoria}» di ${euroCent(c.importo)}?${c.allegato_path ? " Verrà eliminata anche la fattura." : ""}`)) return;
    try {
      await elimina.mutateAsync(c);
      toast.success("Costo eliminato");
    } catch (err) {
      mostraErrore(err);
    }
  }

  const evidenzia = (lordo: boolean) => (usaLordo === lordo ? "font-semibold text-foreground" : "text-muted-foreground");

  return (
    <Section
      title="Costi"
      count={costi?.length}
      action={
        <Button size="sm" variant="accent-soft" onClick={onNuovo}>
          <Plus aria-hidden /> Aggiungi costo
        </Button>
      }
      bodyClassName="p-0 sm:p-0"
    >
      {error ? (
        <div className="p-4"><ErrorState error={error} /></div>
      ) : loading ? (
        <ListSkeleton rows={3} className="space-y-2 p-4" />
      ) : !costi?.length ? (
        <EmptyState
          compact
          art="grafico"
          title="Nessun costo registrato"
          text="Parti dal prezzo di acquisto o dal valore di permuta, poi aggiungi trasporto, preparazione e lavori."
          action={<Button onClick={onNuovo}>Aggiungi il primo costo</Button>}
        />
      ) : (
        <>
          <p className="border-b px-4 py-2.5 text-sm text-muted-foreground sm:px-5">
            Nel calcolo entra il valore in grassetto: {usaLordo ? "il totale IVA compresa (regime del margine)" : "l'imponibile (IVA detraibile)"}.
          </p>
          {/* Telefono: schede */}
          <ul className="divide-y md:hidden">
            {costi.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-semibold">{c.categoria}</p>
                  <p className="text-sm text-muted-foreground">
                    {dataBreve(c.data)}
                    {c.fornitore && ` · ${c.fornitore}`}
                  </p>
                  {c.descrizione && <p className="text-[15px]">{c.descrizione}</p>}
                  <p className="mt-1 text-sm tabular-nums">
                    <span className={evidenzia(false)}>{euroCent(c.importo)}</span>
                    <span className="text-muted-foreground"> + IVA {c.iva_aliquota}% = </span>
                    <span className={evidenzia(true)}>{euroCent(c.importo_lordo)}</span>
                  </p>
                  {c.allegato_path && (
                    <button type="button" className="mt-1 flex items-center gap-1 text-sm font-medium text-accent" onClick={() => void apriDocumento(c.allegato_path!).catch(mostraErrore)}>
                      <FileText className="size-4" aria-hidden /> Fattura
                    </button>
                  )}
                </div>
                <AzioniVoce onModifica={() => onModifica(c)} onElimina={() => void onElimina(c)} eliminando={elimina.isPending} />
              </li>
            ))}
          </ul>
          {/* Desktop: tabella */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-[15px]">
              <thead className="border-b bg-muted/50 text-left text-sm text-muted-foreground">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Data</th>
                  <th className="px-3 py-2.5 font-medium">Categoria</th>
                  <th className="px-3 py-2.5 font-medium">Descrizione e fornitore</th>
                  <th className="px-3 py-2.5 text-right font-medium">Imponibile</th>
                  <th className="px-3 py-2.5 text-right font-medium">IVA</th>
                  <th className="px-3 py-2.5 text-right font-medium">Totale</th>
                  <th className="px-3 py-2.5 font-medium">Fattura</th>
                  <th className="px-5 py-2.5"><span className="sr-only">Azioni</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {costi.map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap px-5 py-2.5">{dataBreve(c.data)}</td>
                    <td className="px-3 py-2.5 font-medium">{c.categoria}</td>
                    <td className="px-3 py-2.5">
                      {c.descrizione ?? "—"}
                      {c.fornitore && <span className="block text-sm text-muted-foreground">{c.fornitore}</span>}
                    </td>
                    <td className={cn("px-3 py-2.5 text-right tabular-nums", evidenzia(false))}>{euroCent(c.importo)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {euroCent(c.importo_iva)} <span className="text-xs">({c.iva_aliquota}%)</span>
                    </td>
                    <td className={cn("px-3 py-2.5 text-right tabular-nums", evidenzia(true))}>{euroCent(c.importo_lordo)}</td>
                    <td className="px-3 py-2.5">
                      {c.allegato_path ? (
                        <button type="button" className="flex items-center gap-1 font-medium text-accent hover:underline" onClick={() => void apriDocumento(c.allegato_path!).catch(mostraErrore)}>
                          <FileText className="size-4" aria-hidden /> Apri
                        </button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-1.5">
                      <AzioniVoce onModifica={() => onModifica(c)} onElimina={() => void onElimina(c)} eliminando={elimina.isPending} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 bg-muted/40 font-semibold">
                <tr>
                  <td className="px-5 py-3" colSpan={3}>Totale costi</td>
                  <td className={cn("px-3 py-3 text-right tabular-nums", evidenzia(false))}>{euroCent(tot.netto)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{euroCent(tot.iva)}</td>
                  <td className={cn("px-3 py-3 text-right tabular-nums", evidenzia(true))}>{euroCent(tot.lordo)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="flex flex-wrap justify-between gap-2 border-t px-4 py-3 text-[15px] md:hidden">
            <span>Totale: {euroCent(tot.netto)} + IVA {euroCent(tot.iva)}</span>
            <strong>{euroCent(tot.lordo)}</strong>
          </p>
          {e && (
            <p className="border-t px-4 py-3 text-[15px] sm:px-5">
              Costo che entra nel margine: <strong className="tabular-nums">{euroCent(e.costi_effettivi)}</strong>
            </p>
          )}
        </>
      )}
    </Section>
  );
}

/* ---------- Ricavi ---------- */

function TabellaRicavi({
  ricavi,
  loading,
  error,
  e,
  regime,
  onNuovo,
  onModifica,
}: {
  ricavi: VehicleRevenue[] | undefined;
  loading: boolean;
  error: unknown;
  e: VehicleEconomics | null | undefined;
  regime: RegimeIva;
  onNuovo: () => void;
  onModifica: (r: VehicleRevenue) => void;
}) {
  const elimina = useEliminaRicavo();

  /** Netto IVA: per la vendita in regime del margine l'IVA è quella calcolata sul margine. */
  const netto = (r: VehicleRevenue) =>
    r.categoria === CATEGORIA_VENDITA && regime === "margine" && e?.iva_vendita != null
      ? r.importo - e.iva_vendita
      : (r.importo * 100) / (100 + r.iva_aliquota);
  const iva = (r: VehicleRevenue) => r.importo - netto(r);
  const daPratica = (r: VehicleRevenue) => r.categoria === CATEGORIA_VENDITA && !!r.deal_id;

  const tot = (ricavi ?? []).reduce((a, r) => ({ lordo: a.lordo + r.importo, netto: a.netto + netto(r) }), { lordo: 0, netto: 0 });

  async function onElimina(r: VehicleRevenue) {
    if (!window.confirm(`Eliminare il ricavo «${r.categoria}» di ${euroCent(r.importo)}?`)) return;
    try {
      await elimina.mutateAsync(r.id);
      toast.success("Ricavo eliminato");
    } catch (err) {
      mostraErrore(err);
    }
  }

  const etichettaIva = (r: VehicleRevenue) =>
    r.categoria === CATEGORIA_VENDITA && regime === "margine" ? "IVA sul margine" : r.iva_aliquota === 0 ? "esente" : `${r.iva_aliquota}%`;

  return (
    <Section
      title="Ricavi"
      count={ricavi?.length}
      action={
        <Button size="sm" variant="accent-soft" onClick={onNuovo}>
          <Plus aria-hidden /> Aggiungi ricavo
        </Button>
      }
      bodyClassName="p-0 sm:p-0"
    >
      {error ? (
        <div className="p-4"><ErrorState error={error} /></div>
      ) : loading ? (
        <ListSkeleton rows={2} className="space-y-2 p-4" />
      ) : !ricavi?.length ? (
        <EmptyState
          compact
          art="grafico"
          title="Nessun ricavo ancora"
          text="Il prezzo di vendita compare da solo quando chiudi la pratica. Qui puoi aggiungere provvigioni, garanzie e accessori venduti."
          action={<Button variant="outline" onClick={onNuovo}>Aggiungi un ricavo</Button>}
        />
      ) : (
        <>
          <ul className="divide-y">
            {ricavi.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {r.categoria}
                    {daPratica(r) && <Badge tone="blue" size="sm">da pratica</Badge>}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {dataBreve(r.data)}
                    {r.descrizione && ` · ${r.descrizione}`}
                  </p>
                </div>
                <div className="text-right tabular-nums">
                  <p className="font-semibold">{euroCent(r.importo)}</p>
                  <p className="text-sm text-muted-foreground">
                    netto {euroCent(netto(r))} · {etichettaIva(r)} {iva(r) > 0.004 ? euroCent(iva(r)) : ""}
                  </p>
                </div>
                <AzioniVoce
                  onModifica={() => onModifica(r)}
                  // La vendita registrata dalla pratica si modifica dalla pratica: niente eliminazione qui
                  onElimina={daPratica(r) ? undefined : () => void onElimina(r)}
                  eliminando={elimina.isPending}
                />
              </li>
            ))}
          </ul>
          <p className="flex flex-wrap justify-between gap-2 border-t bg-muted/40 px-4 py-3 text-[15px] font-semibold sm:px-5">
            <span>Totale ricavi</span>
            <span className="tabular-nums">
              {euroCent(tot.lordo)} <span className="font-normal text-muted-foreground">· netto IVA {euroCent(tot.netto)}</span>
            </span>
          </p>
        </>
      )}
    </Section>
  );
}
