import { useState } from "react";
import { toast } from "sonner";
import { ArrowRightLeft, CalendarCheck, FileText, Mail, MessageCircle, Phone, StickyNote, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Section } from "@/components/shared/Section";
import { ErrorState, ListSkeleton, Spinner } from "@/components/shared/States";
import { useColleghi } from "@/lib/queries";
import { mostraErrore } from "@/lib/errors";
import { dataOra, relativo } from "@/lib/format";
import { STATI_LEAD, TIPI_ATTIVITA } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { StatoLead, TipoAttivita } from "@/types/db";
import { useAggiungiAttivita, useAttivita } from "../api";

const ICONE: Record<TipoAttivita, { icon: LucideIcon; cls: string }> = {
  chiamata: { icon: Phone, cls: "bg-accent-soft text-accent" },
  whatsapp: { icon: MessageCircle, cls: "bg-emerald-50 text-emerald-700" },
  email: { icon: Mail, cls: "bg-primary-soft text-primary" },
  nota: { icon: StickyNote, cls: "bg-muted text-muted-foreground" },
  test_drive: { icon: CalendarCheck, cls: "bg-violet-50 text-violet-700" },
  preventivo: { icon: FileText, cls: "bg-warning-soft text-warning" },
  cambio_stato: { icon: ArrowRightLeft, cls: "bg-muted text-muted-foreground" },
};

/** "nuovo → contattato" diventa "Nuovo → Contattato". */
function testoAttivita(tipo: TipoAttivita, contenuto: string) {
  if (tipo !== "cambio_stato") return contenuto;
  return contenuto.replace(/\b(nuovo|contattato|qualificato|test_drive|preventivo|trattativa|vinto|perso)\b/g, (s) => STATI_LEAD[s as StatoLead].label);
}

/** Storico completo del lead: resta all'azienda anche se il venditore cambia. */
export function Timeline({ leadId, sola_lettura }: { leadId: string; sola_lettura: boolean }) {
  const { data, isLoading, error, refetch } = useAttivita(leadId);
  const colleghi = useColleghi();
  const aggiungi = useAggiungiAttivita();
  const [nota, setNota] = useState("");
  const nomi = new Map(colleghi.data?.map((p) => [p.user_id, p.nome]));

  async function salvaNota() {
    if (!nota.trim()) return;
    try {
      await aggiungi.mutateAsync({ lead_id: leadId, tipo: "nota", contenuto: nota.trim() });
      setNota("");
      toast.success("Nota aggiunta");
    } catch (e) {
      mostraErrore(e);
    }
  }

  return (
    <Section title="Storico" count={data?.length}>
      {!sola_lettura && (
        <div className="mb-5 space-y-2">
          <Textarea
            aria-label="Nuova nota"
            className="min-h-20"
            placeholder="Aggiungi una nota (es. vuole il colore bianco, richiamare dopo le 18)"
            value={nota}
            maxLength={2000}
            onChange={(e) => setNota(e.target.value)}
          />
          <Button variant="secondary" size="sm" onClick={salvaNota} disabled={!nota.trim() || aggiungi.isPending}>
            {aggiungi.isPending && <Spinner className="size-4 animate-spin" />}
            Aggiungi nota
          </Button>
        </div>
      )}
      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : !data?.length ? (
        <p className="text-muted-foreground">Nessuna attività ancora. Inizia con una chiamata o un WhatsApp.</p>
      ) : (
        <ol className="relative space-y-4 before:absolute before:inset-y-2 before:left-[19px] before:w-px before:bg-border">
          {data.map((a) => {
            const { icon: Icon, cls } = ICONE[a.tipo];
            return (
              <li key={a.id} className="relative flex gap-3">
                <span className={cn("relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full ring-4 ring-card", cls)}>
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{TIPI_ATTIVITA[a.tipo]}</span>
                    {" · "}
                    {a.autore_id ? (nomi.get(a.autore_id) ?? "Collega") : "Sistema"}
                    {" · "}
                    <time dateTime={a.created_at} title={dataOra(a.created_at)}>
                      {relativo(a.created_at)}
                    </time>
                  </p>
                  {a.contenuto && <p className="mt-0.5 whitespace-pre-line break-words text-[15px]">{testoAttivita(a.tipo, a.contenuto)}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Section>
  );
}
