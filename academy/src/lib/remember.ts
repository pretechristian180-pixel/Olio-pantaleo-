/**
 * "Ricordami": con la casella spenta la sessione deve finire alla chiusura del browser.
 * Alla login scriviamo un cookie-marcatore:
 *  - "1" persistente (1 anno) se l'utente vuole essere ricordato;
 *  - "0" di sessione (senza scadenza) altrimenti.
 * Se al ritorno ci sono i cookie Supabase ma il marcatore non c'è più, il browser è stato
 * chiuso con "Ricordami" spento: il middleware chiude la sessione.
 */
export const REMEMBER_COOKIE = "nx_ricordami";

export function rememberCookie(remember: boolean) {
  const base = `${REMEMBER_COOKIE}=${remember ? "1" : "0"}; Path=/; SameSite=Lax`;
  const secure =
    typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  return remember ? `${base}; Max-Age=31536000${secure}` : `${base}${secure}`;
}

export function hasSupabaseAuthCookie(names: string[]) {
  return names.some((n) => n.startsWith("sb-") && n.includes("-auth-token"));
}
