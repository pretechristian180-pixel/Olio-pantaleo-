import type { ReactNode } from "react";
import { CalendarPlus, Check, MessageCircle, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppointmentDialog } from "@/features/agenda/AppointmentDialog";
import { useAuth } from "@/features/auth/AuthProvider";
import { friendlyError } from "@/lib/errors";
import { formatShortDate } from "@/lib/format";
import { proposalLink } from "@/lib/matching";
import { setMatchStatus } from "@/services/api";
import type { Contact, Match, MatchStatus, Property } from "@/types/domain";

/** Punteggio di compatibilità: più è alto, più l'immobile corrisponde a quello che il cliente cerca. */
export function ScoreBadge({ score }: { score: number }) {
  return (
    <Badge tone={score >= 80 ? "green" : score >= 60 ? "brand" : "gray"} dot={false} title="Compatibilità con la ricerca">
      {score}%
    </Badge>
  );
}

/**
 * Una riga di match con le azioni giuste per il suo stato:
 * da proporre → "Proponi su WhatsApp" (messaggio già scritto) o "Non adatto";
 * proposto → "Interessato" / "Non interessato"; interessato → "Fissa una visita".
 */
export function MatchItem({
  match,
  contact,
  property,
  header,
}: {
  match: Match;
  contact: Contact;
  property: Property;
  /** Cosa mostrare in alto: il cliente (scheda immobile) o l'immobile (scheda cliente) */
  header: ReactNode;
}) {
  const { agent, agency } = useAuth();
  const { openAppointment } = useAppointmentDialog();

  async function set(status: MatchStatus, message: string) {
    try {
      await setMatchStatus(match.id, status);
      toast.success(message);
    } catch (err) {
      toast.error("Modifica non salvata", { description: friendlyError(err) });
    }
  }

  return (
    <li className="py-3">
      {header}
      {match.reasons.length > 0 && <p className="mt-1.5 text-[15px] text-muted-foreground">{match.reasons.join(" · ")}</p>}

      {match.status === "da_proporre" && (
        <div className="mt-3 flex gap-2">
          {contact.phone ? (
            <Button variant="secondary" size="sm" className="h-11 flex-1" asChild>
              <a
                href={proposalLink(contact, property, agent?.firstName ?? "", agency?.name ?? "")}
                target="_blank"
                rel="noreferrer"
                onClick={() => set("proposto", `Proposto a ${contact.firstName}`)}
              >
                <MessageCircle aria-hidden />
                Proponi su WhatsApp
              </a>
            </Button>
          ) : (
            <p className="flex-1 self-center text-[15px] text-muted-foreground">Manca il numero di telefono</p>
          )}
          <Button variant="ghost" size="sm" className="h-11" onClick={() => set("scartato", "Segnato come non adatto")}>
            Non adatto
          </Button>
        </div>
      )}

      {match.status === "proposto" && (
        <div className="mt-3">
          <p className="text-[15px] text-muted-foreground">
            Proposto{match.proposedAt ? ` il ${formatShortDate(match.proposedAt)}` : ""}. Com'è andata?
          </p>
          <div className="mt-2 flex gap-2">
            <Button variant="outline" size="sm" className="h-11 flex-1" onClick={() => set("interessato", "Segnato come interessato")}>
              <Check aria-hidden className="text-success" />
              Interessato
            </Button>
            <Button variant="outline" size="sm" className="h-11 flex-1" onClick={() => set("scartato", "Segnato come non interessato")}>
              <X aria-hidden />
              Non interessato
            </Button>
          </div>
        </div>
      )}

      {match.status === "interessato" && (
        <div className="mt-3 flex items-center gap-2">
          <Badge tone="green">Interessato</Badge>
          <Button
            variant="secondary"
            size="sm"
            className="ml-auto h-11"
            onClick={() => openAppointment({ contactId: contact.id, propertyId: property.id, kind: "visita" })}
          >
            <CalendarPlus aria-hidden />
            Fissa una visita
          </Button>
        </div>
      )}
    </li>
  );
}
