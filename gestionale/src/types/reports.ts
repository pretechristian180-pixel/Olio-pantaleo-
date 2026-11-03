export interface OwnerReport {
  id: string;
  createdAt: string;
  from: string;
  to: string;
  state: "pronto" | "inviato";
  sentVia: "email" | "whatsapp" | "automatico" | null;
  sentAt: string | null;
  openedAt: string | null;
  opens: number;
  origin: "manuale" | "automatico";
  visits: number;
  matches: number;
}

export interface PortalNumbers {
  visualizzazioni?: string;
  contatti?: string;
  preferiti?: string;
}

export interface PreparedReport {
  id: string;
  /** Link da mandare al proprietario (registra l'apertura) */
  link: string;
  /** PDF da aprire subito (link firmato, 10 minuti) */
  pdf: string | null;
}
