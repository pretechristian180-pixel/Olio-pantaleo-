/** Telefono, WhatsApp, email e template messaggi. */

/** Normalizza un numero italiano per wa.me / tel: (senza spazi, con prefisso 39). */
export function normalizzaTelefono(tel: string): string {
  let n = tel.replace(/[^\d+]/g, "");
  if (n.startsWith("+")) n = n.slice(1);
  else if (n.startsWith("00")) n = n.slice(2);
  else if (!n.startsWith("39") || n.length <= 10) n = `39${n}`;
  return n;
}

export const linkTelefono = (tel: string) => `tel:+${normalizzaTelefono(tel)}`;

export const linkWhatsApp = (tel: string, testo?: string) =>
  `https://wa.me/${normalizzaTelefono(tel)}${testo ? `?text=${encodeURIComponent(testo)}` : ""}`;

export const linkEmail = (email: string, oggetto?: string, corpo?: string) => {
  const p = new URLSearchParams();
  if (oggetto) p.set("subject", oggetto);
  if (corpo) p.set("body", corpo);
  const q = p.toString().replace(/\+/g, "%20");
  return `mailto:${email}${q ? `?${q}` : ""}`;
};

export interface VariabiliTemplate {
  nome: string;
  cognome?: string;
  auto?: string;
  venditore?: string;
  azienda?: string;
}

/** Sostituisce {nome}, {cognome}, {auto}, {venditore}, {azienda}. */
export function compilaTemplate(testo: string, v: VariabiliTemplate): string {
  return testo.replace(/\{(nome|cognome|auto|venditore|azienda)\}/g, (_, k: keyof VariabiliTemplate) => v[k] || (k === "auto" ? "l'auto" : ""));
}

/** Se l'AI produce "Oggetto: ..." in prima riga, lo separa dal corpo. */
export function separaOggetto(testo: string): { oggetto?: string; corpo: string } {
  const m = testo.match(/^\s*Oggetto:\s*(.+)\n+([\s\S]*)$/i);
  return m ? { oggetto: m[1]!.trim(), corpo: m[2]!.trim() } : { corpo: testo };
}
