import { Link } from "react-router-dom";
import { Globe, MessageCircle, Phone, Plus, Users } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { Section } from "@/components/shared/Section";
import { ErrorState, ListSkeleton } from "@/components/shared/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSessione } from "@/lib/auth";
import { euro, relativo } from "@/lib/format";
import { STATI_LEAD } from "@/lib/labels";
import { linkTelefono, linkWhatsApp } from "@/lib/messaggi";
import { cn } from "@/lib/utils";
import type { VehicleView } from "@/types/db";
import { daSchedaOnline, useClientiCompatibili, useLeadInteressati } from "./api";

/** Tab "Interessati": lead su quest'auto (anche dalla scheda online) e clienti compatibili. */
export function Interessati({ v, evidenza, onNuovoLead }: { v: VehicleView; evidenza: boolean; onNuovoLead?: () => void }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ClientiCompatibili v={v} evidenza={evidenza} />
      <LeadInteressati vehicleId={v.id} onNuovoLead={onNuovoLead} />
    </div>
  );
}

/* ---------- Clienti potenzialmente interessati ---------- */

function ClientiCompatibili({ v, evidenza }: { v: VehicleView; evidenza?: boolean }) {
  const { profilo, organizzazione } = useSessione();
  const q = useClientiCompatibili(v.id);
  const lista = q.data ?? [];
  if (v.stato === "venduto")
    return (
      <Section title="Clienti potenzialmente interessati">
        <p className="text-muted-foreground">Auto venduta: i clienti compatibili non vengono più cercati.</p>
      </Section>
    );

  const messaggio = (nome: string) =>
    `Buongiorno ${nome.split(" ")[0]}, sono ${profilo.nome} di ${organizzazione.nome}. Abbiamo appena ricevuto una ${v.marca} ${v.modello}${v.anno ? ` del ${v.anno}` : ""}${v.prezzo_vendita ? ` a ${euro(v.prezzo_vendita)}` : ""} che potrebbe interessarle. Vuole passare a vederla?`;

  return (
    <Section
      title={
        <span className="flex items-center gap-2">
          <Users className="size-5 text-accent" aria-hidden /> Clienti potenzialmente interessati
        </span>
      }
      count={q.isLoading ? undefined : lista.length}
      className={cn(evidenza && "border-accent/40 ring-4 ring-accent/10")}
    >
      {evidenza && lista.length > 0 && (
        <p className="mb-3 text-[15px] text-muted-foreground">
          Auto appena inserita: questi clienti cercavano qualcosa di simile. Contattali ora, prima che comprino altrove.
        </p>
      )}
      {q.isLoading ? (
        <ListSkeleton rows={2} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : lista.length === 0 ? (
        <p className="text-muted-foreground">Nessun lead aperto o perso di recente cerca un'auto simile.</p>
      ) : (
        <ul className="divide-y">
          {lista.map((c) => (
            <li key={c.lead_id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <Link to={`/lead/${c.lead_id}`} className="font-semibold hover:text-accent">
                  {c.contatto}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Badge tone={STATI_LEAD[c.stato].tone} size="sm">
                    {STATI_LEAD[c.stato].label}
                  </Badge>
                  {c.budget != null && <span>Budget {euro(c.budget)}</span>}
                  {c.interesse && <span>· Cercava {c.interesse}</span>}
                </div>
                {c.motivo_match && <p className="mt-1 text-sm font-medium text-accent">{c.motivo_match}</p>}
                {c.motivo_perso && <p className="text-sm text-muted-foreground">Perso: {c.motivo_perso}</p>}
              </div>
              {c.telefono && (
                <div className="flex gap-2">
                  <Button asChild size="sm" variant="outline" className="flex-1">
                    <a href={linkTelefono(c.telefono)}>
                      <Phone aria-hidden /> Chiama
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="success" className="flex-1">
                    <a href={linkWhatsApp(c.telefono, messaggio(c.contatto))} target="_blank" rel="noopener noreferrer">
                      <MessageCircle aria-hidden /> WhatsApp
                    </a>
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/* ---------- Lead interessati a quest'auto ---------- */

function LeadInteressati({ vehicleId, onNuovoLead }: { vehicleId: string; onNuovoLead?: () => void }) {
  const q = useLeadInteressati(vehicleId);
  const lista = q.data ?? [];
  const online = lista.filter(daSchedaOnline).length;
  return (
    <Section
      title="Lead su quest'auto"
      count={q.isLoading ? undefined : lista.length}
      action={
        onNuovoLead && (
          <Button size="sm" variant="accent-soft" onClick={onNuovoLead}>
            <Plus aria-hidden /> Nuovo lead
          </Button>
        )
      }
    >
      {online > 0 && (
        <p className="mb-3 flex items-center gap-2 rounded-lg bg-accent-soft px-3 py-2 text-[15px] text-accent">
          <Globe className="size-4 shrink-0" aria-hidden />
          {online === 1 ? "1 richiesta arrivata" : `${online} richieste arrivate`} dalla scheda online
        </p>
      )}
      {q.isLoading ? (
        <ListSkeleton rows={2} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : lista.length === 0 ? (
        <EmptyState
          compact
          art="lead"
          title="Ancora nessun lead"
          text="Quando un cliente chiede di quest'auto, anche dalla scheda online, lo vedrai qui."
          action={
            onNuovoLead && (
              <Button variant="accent" onClick={onNuovoLead}>
                <Plus aria-hidden /> Nuovo lead per quest'auto
              </Button>
            )
          }
        />
      ) : (
        <ul className="divide-y">
          {lista.map((l) => (
            <li key={l.id}>
              <Link to={`/lead/${l.id}`} className="flex items-center gap-3 py-3 hover:text-accent">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {l.contatto_nome} {l.contatto_cognome}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {l.assegnato_nome ?? "Non assegnato"} · {relativo(l.created_at)}
                  </span>
                  {daSchedaOnline(l) && (
                    <Badge tone="accent" size="sm" dot={false} className="mt-1">
                      <Globe className="size-3.5" aria-hidden /> Dalla scheda online
                    </Badge>
                  )}
                </span>
                <Badge tone={STATI_LEAD[l.stato].tone} size="sm">
                  {STATI_LEAD[l.stato].label}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
