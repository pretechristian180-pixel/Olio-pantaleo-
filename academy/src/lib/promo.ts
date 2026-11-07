/** Riquadro promozionale dell'area studenti (es. "Prenota la consulenza"). Logica pura, testata. */
import { z } from "zod";

const testo = (max: number) =>
  z
    .string()
    .catch("")
    .transform((v) => v.trim().slice(0, max));

/** Link accettati: pagina web sicura, email, telefono. */
export function safePromoLink(v: string) {
  const s = v.trim();
  if (/^https:\/\/[^\s]+$/i.test(s)) return s.slice(0, 500);
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(s)) return s.slice(0, 200);
  if (/^tel:\+?[0-9 ]{6,20}$/i.test(s)) return s.replace(/\s/g, "");
  return "";
}

export const promoSchema = z.object({
  attivo: z.boolean().catch(false),
  sopratitolo: testo(40),
  testo: testo(200),
  pulsante: testo(30),
  link: z
    .string()
    .catch("")
    .transform((v) => safePromoLink(v)),
});

export type Promo = z.infer<typeof promoSchema>;

export function parsePromo(raw: unknown): Promo {
  return promoSchema.parse(raw && typeof raw === "object" ? raw : {});
}

/** Si mostra solo se acceso e con un testo; il pulsante solo se c'è un link valido. */
export function isPromoVisible(p: Promo) {
  return p.attivo && Boolean(p.testo);
}
