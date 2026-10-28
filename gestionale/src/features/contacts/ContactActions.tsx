import { CalendarPlus, MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppointmentDialog } from "@/features/agenda/AppointmentDialog";
import { cn } from "@/lib/utils";
import { fullName, phoneDigits, whatsappLink } from "@/lib/format";
import { logActivity } from "@/services/api";
import type { Contact } from "@/types/domain";

/** I tre pulsanti rapidi grandi: Chiama, WhatsApp, Appuntamento. */
export function ContactActions({
  contact,
  propertyId,
  className,
  compact,
}: {
  contact: Contact;
  propertyId?: string;
  className?: string;
  /** Senza "Appuntamento" (es. nel box proprietario) */
  compact?: boolean;
}) {
  const { openAppointment } = useAppointmentDialog();
  // Su telefono icona sopra e testo sotto, così le tre etichette stanno intere
  const btn = "h-16 flex-col gap-1 px-1 text-[14px] sm:h-12 sm:flex-row sm:gap-2 sm:px-3 sm:text-base";
  return (
    <div className={cn("grid gap-2", compact ? "grid-cols-2" : "grid-cols-3", className)}>
      <Button variant="secondary" className={btn} asChild>
        <a href={`tel:${phoneDigits(contact.phone)}`} onClick={() => logActivity(contact.id, "chiamata", "Chiamata in uscita")}>
          <Phone aria-hidden />
          Chiama
        </a>
      </Button>
      <Button variant="outline" className={btn} asChild>
        <a
          href={whatsappLink(contact.phone)}
          target="_blank"
          rel="noreferrer"
          onClick={() => logActivity(contact.id, "whatsapp", "Messaggio WhatsApp inviato")}
        >
          <MessageCircle aria-hidden className="text-success" />
          WhatsApp
        </a>
      </Button>
      {!compact && (
        <Button
          variant="outline"
          className={btn}
          onClick={() => openAppointment({ contactId: contact.id, propertyId })}
          aria-label={`Fissa un appuntamento con ${fullName(contact)}`}
        >
          <CalendarPlus aria-hidden />
          Appuntamento
        </Button>
      )}
    </div>
  );
}
