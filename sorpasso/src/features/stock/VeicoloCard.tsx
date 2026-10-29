import { Link } from "react-router-dom";
import { AlertTriangle, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { VehiclePhoto } from "@/components/shared/VehiclePhoto";
import { euro, km } from "@/lib/format";
import { ALIMENTAZIONI, SIGLE_PORTALI, STATI_VEICOLO, TIPI_VEICOLO, toneGiacenza } from "@/lib/labels";
import type { VehicleView } from "@/types/db";

/** Badge giorni di giacenza: verde, giallo o rosso rispetto alla soglia aziendale. */
export function BadgeGiacenza({ v, size = "md" }: { v: Pick<VehicleView, "giorni_giacenza" | "soglia_giacenza_giorni" | "stato">; size?: "sm" | "md" }) {
  if (v.stato === "venduto") return null;
  return (
    <Badge tone={toneGiacenza(v.giorni_giacenza, v.soglia_giacenza_giorni)} size={size}>
      {v.giorni_giacenza} {v.giorni_giacenza === 1 ? "giorno" : "giorni"}
    </Badge>
  );
}

export function VeicoloCard({ v, fotoUrl }: { v: VehicleView; fotoUrl?: string | null }) {
  const stato = STATI_VEICOLO[v.stato];
  return (
    <Link
      to={`/stock/${v.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border bg-card shadow-card transition-colors hover:border-accent/50"
    >
      <div className="relative">
        <VehiclePhoto url={fotoUrl} marca={v.marca} modello={v.modello} />
        <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
          {v.stato !== "disponibile" && (
            <Badge tone={stato.tone} size="sm" className="bg-white/95 shadow-card">
              {stato.label}
            </Badge>
          )}
          {v.tipo !== "usato" && (
            <Badge tone="accent" size="sm" dot={false} className="bg-white/95 shadow-card">
              {TIPI_VEICOLO[v.tipo]}
            </Badge>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-[17px] font-semibold leading-snug">
          {v.marca} {v.modello}
        </h3>
        {v.versione && <p className="truncate text-[15px] text-muted-foreground">{v.versione}</p>}
        <p className="mt-2 text-2xl font-bold tabular-nums text-primary">{euro(v.prezzo_vendita)}</p>
        <p className="mt-1 text-[15px] text-muted-foreground">
          {[v.anno, km(v.km), v.alimentazione && ALIMENTAZIONI[v.alimentazione]].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
          <BadgeGiacenza v={v} size="sm" />
          {v.portali_online.length > 0 && (
            <span className="flex flex-wrap gap-1" aria-label={`Online su ${v.portali_online.map((p) => SIGLE_PORTALI[p] ?? p).join(", ")}`}>
              {v.portali_online.map((p) => (
                <span key={p} title={`Online su ${SIGLE_PORTALI[p] ?? p}`} className="rounded bg-success-soft px-1.5 py-0.5 text-[11px] font-semibold leading-none text-success">
                  {SIGLE_PORTALI[p] ?? p}
                </span>
              ))}
            </span>
          )}
          {v.pubblicazione_errore && (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-destructive" title="Una pubblicazione è in errore: apri la scheda, tab Pubblicazione">
              <AlertTriangle className="size-4" aria-hidden /> Errore portale
            </span>
          )}
          {v.lead_aperti > 0 && (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-accent">
              <Users className="size-4" aria-hidden />
              {v.lead_aperti} {v.lead_aperti === 1 ? "lead aperto" : "lead aperti"}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
