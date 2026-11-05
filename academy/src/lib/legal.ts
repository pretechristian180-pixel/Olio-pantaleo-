/** Dati legali di un'academy e testi comuni dei documenti. Logica pura, testata. */
import { z } from "zod";

/** Versione delle condizioni del servizio: cambiarla quando cambia il testo. */
export const TERMINI_VERSIONE = "2026-11-05";

const campo = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .catch("")
    .transform((v) => v.trim());

export const legalSchema = z.object({
  ragione_sociale: campo(160),
  piva: campo(20),
  codice_fiscale: campo(20),
  sede: campo(240),
  pec: campo(120),
  email: campo(120),
  foro: campo(80),
});

export type LegalData = z.infer<typeof legalSchema>;

export function parseLegal(raw: unknown): LegalData {
  const r = legalSchema.safeParse(raw && typeof raw === "object" ? raw : {});
  return r.success ? r.data : legalSchema.parse({});
}

/** Dati minimi per vendere: chi sei, partita IVA, sede, un contatto. */
export function isLegalComplete(d: LegalData) {
  return Boolean(d.ragione_sociale && d.piva && d.sede && d.email);
}

/** Riga per footer e documenti: "Ragione sociale · P.IVA … · sede". */
export function legalLine(d: LegalData) {
  return [d.ragione_sociale, d.piva ? `P.IVA ${d.piva}` : "", d.sede].filter(Boolean).join(" · ");
}

/** Fornitori (sub-responsabili) che trattano dati per conto della piattaforma. */
export const SUBPROCESSORS = [
  {
    nome: "Supabase Inc.",
    servizio: "Database, autenticazione e archiviazione file",
    luogo: "UE (Francoforte, Germania)",
  },
  {
    nome: "Vercel Inc.",
    servizio: "Hosting dell'applicazione",
    luogo: "UE (Francoforte) e USA, con clausole contrattuali standard",
  },
  {
    nome: "BunnyWay d.o.o. (Bunny.net)",
    servizio: "Archiviazione e distribuzione dei video",
    luogo: "UE (Slovenia; archiviazione in Germania)",
  },
  {
    nome: "Stripe Payments Europe Ltd.",
    servizio: "Pagamenti, abbonamenti e fatture",
    luogo: "UE (Irlanda) e USA, con clausole contrattuali standard",
  },
  {
    nome: "Resend (Plus Five Five Inc.)",
    servizio: "Invio delle email della piattaforma",
    luogo: "USA, con clausole contrattuali standard",
  },
  {
    nome: "Anthropic PBC",
    servizio:
      "Generazione dei testi delle landing con l'IA (solo dati dei corsi, non degli studenti)",
    luogo: "USA, con clausole contrattuali standard",
  },
] as const;
