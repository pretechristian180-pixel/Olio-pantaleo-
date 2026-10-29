import type { ReactNode } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Check } from "lucide-react";
import { InfoRow, Section } from "@/components/shared/Section";
import { ListSkeleton } from "@/components/shared/States";
import { Badge } from "@/components/ui/badge";
import { useSessione } from "@/lib/auth";
import { dataBreve, euro, km, numero } from "@/lib/format";
import { ALIMENTAZIONI, CAMBI, TIPI_VEICOLO } from "@/lib/labels";
import { CATALOGO_OPTIONAL, TRAZIONI, kwInCv } from "@/lib/optional";
import { useColleghi } from "@/lib/queries";
import { cn } from "@/lib/utils";
import type { VehicleView } from "@/types/db";
import { useStoricoPrezzi } from "./api";
import { DocumentiVeicolo } from "./DocumentiVeicolo";
import { Galleria } from "./Galleria";

const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

/** Tab "Scheda tecnica": foto, dati, optional, difetti, documenti privati, storico prezzi. */
export function SchedaTecnica({ v }: { v: VehicleView }) {
  const { isAmministrazione, isManager } = useSessione();
  const elettrica = v.alimentazione === "elettrica";
  const immatricolazione = v.anno ? `${v.mese_immatricolazione ? `${MESI[v.mese_immatricolazione - 1]} ` : ""}${v.anno}` : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-5">
        <Galleria v={v} modificabile={!isAmministrazione} />
        {v.difetti && (
          <section className="rounded-lg border border-warning/30 bg-warning-soft p-4">
            <h2 className="flex items-center gap-2 font-semibold text-warning">
              <AlertTriangle className="size-5" aria-hidden /> Difetti o danni
              <span className="text-sm font-normal">· nota interna, non pubblicata</span>
            </h2>
            <p className="mt-1.5 whitespace-pre-line text-[15px]">{v.difetti}</p>
          </section>
        )}
        <Optional v={v} />
        <DocumentiVeicolo vehicleId={v.id} />
      </div>

      <div className="space-y-5">
        <Section title="Identità">
          <dl>
            <InfoRow label="Versione">{v.versione}</InfoRow>
            <InfoRow label="Allestimento">{v.allestimento}</InfoRow>
            <InfoRow label="Carrozzeria">{v.carrozzeria}</InfoRow>
            <InfoRow label="Porte / posti">{v.porte || v.posti ? `${v.porte ?? "—"} / ${v.posti ?? "—"}` : null}</InfoRow>
            <InfoRow label="Targa">{v.targa}</InfoRow>
            <InfoRow label="Telaio">{v.telaio && <span className="font-mono text-sm">{v.telaio}</span>}</InfoRow>
          </dl>
        </Section>

        <Section title="Immatricolazione e stato">
          <dl>
            <InfoRow label="Immatricolazione">{immatricolazione}</InfoRow>
            <InfoRow label="Chilometri">{km(v.km)}</InfoRow>
            <InfoRow label="Condizione">{TIPI_VEICOLO[v.tipo]}</InfoRow>
            <InfoRow label="Proprietari precedenti">{v.numero_proprietari}</InfoRow>
            <InfoRow label="Tagliandi certificati">{siNo(v.tagliandi_certificati)}</InfoRow>
            <InfoRow label="Neopatentati">{siNo(v.neopatentati)}</InfoRow>
            <InfoRow label="Garanzia">{v.garanzia_mesi ? `${v.garanzia_mesi} mesi${v.garanzia_tipo ? ` · ${v.garanzia_tipo}` : ""}` : v.garanzia_tipo}</InfoRow>
            <InfoRow label="In stock dal">{dataBreve(v.data_ingresso)}</InfoRow>
            <InfoRow label="Giorni di giacenza">
              <span className={cn(v.oltre_soglia && "text-destructive")}>
                {v.giorni_giacenza} {v.oltre_soglia && `(soglia ${v.soglia_giacenza_giorni})`}
              </span>
            </InfoRow>
          </dl>
        </Section>

        <Section title="Motore e consumi">
          <dl>
            <InfoRow label="Alimentazione">{v.alimentazione && ALIMENTAZIONI[v.alimentazione]}</InfoRow>
            <InfoRow label="Cilindrata">{v.cilindrata ? `${numero(v.cilindrata)} cm³` : null}</InfoRow>
            <InfoRow label="Potenza">{v.potenza_kw ? `${v.potenza_kw} kW (${kwInCv(v.potenza_kw)} CV)` : null}</InfoRow>
            <InfoRow label="Cambio">{v.cambio && CAMBI[v.cambio]}</InfoRow>
            <InfoRow label="Trazione">{v.trazione && TRAZIONI[v.trazione]}</InfoRow>
            <InfoRow label="Classe">{v.classe_euro}</InfoRow>
            <InfoRow label="Consumo misto">
              {v.consumo_misto != null ? `${String(v.consumo_misto).replace(".", ",")} ${elettrica ? "kWh" : "l"}/100 km` : null}
            </InfoRow>
            <InfoRow label="Emissioni CO2">{v.emissioni_co2 != null ? `${v.emissioni_co2} g/km` : null}</InfoRow>
          </dl>
        </Section>

        <Section title="Colori">
          <dl>
            <InfoRow label="Esterno">{v.colore}</InfoRow>
            <InfoRow label="Interni">{v.colore_interni}</InfoRow>
          </dl>
        </Section>

        {v.note_interne && (
          <Section title="Note interne">
            <p className="whitespace-pre-line text-[15px]">{v.note_interne}</p>
          </Section>
        )}
        <StoricoPrezzi vehicleId={v.id} />
        {!isManager && !isAmministrazione && (
          <p className="text-sm text-muted-foreground">Per modificare i dati o il prezzo dell'auto chiedi al responsabile vendite.</p>
        )}
      </div>
    </div>
  );
}

const siNo = (b: boolean) =>
  b ? (
    <span className="inline-flex items-center gap-1 text-success">
      <Check className="size-4" aria-hidden /> Sì
    </span>
  ) : (
    "No"
  );

function Optional({ v }: { v: VehicleView }) {
  const scelti = new Set(v.optional ?? []);
  const gruppi = CATALOGO_OPTIONAL.map((g) => ({ ...g, voci: g.voci.filter((x) => scelti.has(x)) })).filter((g) => g.voci.length);
  const noti = new Set(CATALOGO_OPTIONAL.flatMap((g) => g.voci));
  const altri = (v.optional ?? []).filter((x) => !noti.has(x));
  if (altri.length) gruppi.push({ categoria: "Altri", voci: altri });
  const vuoto = gruppi.length === 0 && !v.optional_extra;

  return (
    <Section title="Optional ed equipaggiamenti" count={v.optional?.length ?? 0}>
      {vuoto ? (
        <p className="text-muted-foreground">Nessun optional indicato. Aggiungili da «Modifica»: rendono l'annuncio molto più efficace.</p>
      ) : (
        <div className="space-y-4">
          {gruppi.map((g) => (
            <Gruppo key={g.categoria} titolo={g.categoria}>
              <ul className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                {g.voci.map((x) => (
                  <li key={x} className="flex items-start gap-2 text-[15px]">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                    {x}
                  </li>
                ))}
              </ul>
            </Gruppo>
          ))}
          {v.optional_extra && (
            <Gruppo titolo="Altri equipaggiamenti">
              <p className="whitespace-pre-line text-[15px]">{v.optional_extra}</p>
            </Gruppo>
          )}
        </div>
      )}
    </Section>
  );
}

function Gruppo({ titolo, children }: { titolo: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{titolo}</h3>
      {children}
    </div>
  );
}

function StoricoPrezzi({ vehicleId }: { vehicleId: string }) {
  const q = useStoricoPrezzi(vehicleId);
  const colleghi = useColleghi();
  const nome = (id: string | null) => (id ? (colleghi.data?.find((p) => p.user_id === id)?.nome ?? "Collega") : "Sistema");
  const lista = q.data ?? [];
  return (
    <Section title="Storico prezzo">
      {q.isLoading ? (
        <ListSkeleton rows={2} />
      ) : lista.length === 0 ? (
        <p className="text-muted-foreground">Nessuna variazione registrata.</p>
      ) : (
        <ul className="space-y-3">
          {lista.map((p) => {
            const diff = p.prezzo_precedente != null && p.prezzo_nuovo != null ? p.prezzo_nuovo - p.prezzo_precedente : null;
            return (
              <li key={p.id} className="flex items-center justify-between gap-3">
                <span>
                  <span className="block font-semibold tabular-nums">{euro(p.prezzo_nuovo)}</span>
                  <span className="block text-sm text-muted-foreground">
                    {p.prezzo_precedente == null ? "Prezzo iniziale" : `prima ${euro(p.prezzo_precedente)}`} · {dataBreve(p.created_at)} · {nome(p.autore_id)}
                  </span>
                </span>
                {diff != null && diff !== 0 && (
                  <Badge tone={diff < 0 ? "green" : "yellow"} size="sm" dot={false}>
                    {diff < 0 ? <ArrowDownRight className="size-3.5" aria-hidden /> : <ArrowUpRight className="size-3.5" aria-hidden />}
                    {diff > 0 ? "+" : "−"}
                    {euro(Math.abs(diff))}
                  </Badge>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
