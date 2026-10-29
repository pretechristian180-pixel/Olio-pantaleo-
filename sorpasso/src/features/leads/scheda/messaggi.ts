import { useSessione } from "@/lib/auth";
import { compilaTemplate, linkEmail, linkWhatsApp } from "@/lib/messaggi";
import type { LeadView } from "@/types/db";
import { useAggiungiAttivita } from "../api";
import { autoLead } from "../LeadCard";

/** Variabili per i template ({nome}, {auto}, …) a partire dal lead. */
export function useVariabili(lead: LeadView) {
  const { profilo, organizzazione } = useSessione();
  return {
    nome: lead.contatto_nome,
    cognome: lead.contatto_cognome,
    auto: autoLead(lead) ?? "",
    venditore: profilo.nome,
    azienda: organizzazione.nome,
  };
}

/**
 * Apre WhatsApp o il programma di posta con il testo pronto e registra l'attività nello storico.
 * Il messaggio lo invia il venditore: noi prepariamo e tracciamo.
 */
export function useInviaMessaggio(lead: LeadView) {
  const aggiungi = useAggiungiAttivita();
  return async (canale: "whatsapp" | "email", testo: string, oggetto?: string) => {
    if (canale === "whatsapp" && lead.contatto_telefono) {
      window.open(linkWhatsApp(lead.contatto_telefono, testo), "_blank", "noopener");
    } else if (canale === "email" && lead.contatto_email) {
      window.location.href = linkEmail(lead.contatto_email, oggetto, testo);
    } else return;
    await aggiungi.mutateAsync({
      lead_id: lead.id,
      tipo: canale,
      contenuto: canale === "email" && oggetto ? `Oggetto: ${oggetto}\n\n${testo}` : testo,
    });
  };
}

export { compilaTemplate };
