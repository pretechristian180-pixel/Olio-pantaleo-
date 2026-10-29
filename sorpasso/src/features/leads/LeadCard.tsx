import { Link } from "react-router-dom";
import { AlertTriangle, Car, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FONTI, tonePunteggio } from "@/lib/labels";
import { durata, relativo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LeadView } from "@/types/db";

export const autoLead = (l: LeadView) =>
  l.veicolo_marca ? `${l.veicolo_marca} ${l.veicolo_modello}` : [l.marca_interesse, l.modello_interesse].filter(Boolean).join(" ") || null;

export const nomeLead = (l: LeadView) => `${l.contatto_nome} ${l.contatto_cognome ?? ""}`.trim();

export const minutiAttesa = (l: LeadView) => Math.max(0, Math.round((Date.now() - new Date(l.created_at).getTime()) / 60000));

/** Card compatta del lead (kanban e liste). */
export function LeadCard({ lead, className, mostraVenditore = true }: { lead: LeadView; className?: string; mostraVenditore?: boolean }) {
  const auto = autoLead(lead);
  return (
    <Link
      to={`/lead/${lead.id}`}
      className={cn(
        "block rounded-lg border bg-card p-3 shadow-card transition-colors hover:border-accent/50",
        lead.in_ritardo && "border-destructive/50 bg-destructive-soft/40",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold leading-snug">{nomeLead(lead)}</p>
        <Badge tone={tonePunteggio(lead.punteggio)} dot={false} size="sm" title="Punteggio">
          {lead.punteggio}
        </Badge>
      </div>
      {auto && (
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Car className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{auto}</span>
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span className="rounded bg-muted px-1.5 py-0.5 font-medium">{FONTI[lead.fonte]}</span>
        {mostraVenditore && <span>{lead.assegnato_nome ?? "Non assegnato"}</span>}
        <span>· {relativo(lead.created_at)}</span>
      </div>
      {lead.in_ritardo && (
        <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-destructive">
          <Clock className="size-4" aria-hidden /> Attende da {durata(minutiAttesa(lead))}
        </p>
      )}
      {!lead.in_ritardo && lead.senza_prossima_azione && (
        <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-warning">
          <AlertTriangle className="size-4" aria-hidden /> Senza prossima azione
        </p>
      )}
    </Link>
  );
}
