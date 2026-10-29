/**
 * Trasforma gli errori di Supabase in frasi chiare in italiano:
 * cosa è successo e cosa fare.
 */
export function friendlyError(err: unknown): string {
  const e = err as { message?: string; code?: string; status?: number; name?: string } | null;
  const msg = (e?.message ?? String(err ?? "")).toLowerCase();
  const code = e?.code ?? "";

  if (msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("load failed"))
    return "Connessione assente. Controlla internet e riprova.";
  if (msg.includes("invalid login credentials")) return "Email o password non corretti.";
  if (msg.includes("email not confirmed"))
    return "Devi prima confermare l'email: apri il messaggio che ti abbiamo inviato.";
  if (msg.includes("already registered") || msg.includes("already been registered") || code === "email_exists")
    return "Esiste già un account con questa email.";
  if (msg.includes("password should be") || code === "weak_password")
    return "La password deve avere almeno 8 caratteri.";
  if (msg.includes("same_password") || msg.includes("should be different"))
    return "La nuova password deve essere diversa da quella attuale.";
  if (code === "email_address_not_authorized" || msg.includes("not authorized"))
    return "L'invio delle email non è ancora attivo per questo indirizzo: il titolare deve configurare il server email (SMTP) su Supabase.";
  if (msg.includes("rate limit") || e?.status === 429 || code === "over_email_send_rate_limit")
    return "Troppi tentativi in poco tempo. Riprova tra qualche minuto.";
  if (msg.includes("invalid email") || code === "email_address_invalid") return "Controlla l'indirizzo email.";
  if (msg.includes("jwt expired") || msg.includes("session") && msg.includes("missing"))
    return "La sessione è scaduta. Accedi di nuovo.";
  if (code === "42501" || msg.includes("row-level security") || msg.includes("permission denied") || code === "NOT_ALLOWED")
    return "Non hai il permesso per questa modifica: puoi cambiare solo ciò che è assegnato a te.";
  if (code === "23505") return "Esiste già un elemento uguale.";
  if (code === "23514" || code === "22P02") return "Alcuni dati non sono validi. Controlla i campi e riprova.";
  if (msg.includes("payload too large") || msg.includes("exceeded the maximum allowed size"))
    return "La foto è troppo grande. Prova con un'altra immagine.";
  if (msg.includes("mime type")) return "Formato non supportato. Usa una foto JPG, PNG o WebP.";
  if (e?.message && /[àèéìòù]|\b(il|la|non|solo)\b/i.test(e.message)) return e.message; // messaggi già in italiano dal database
  return "Qualcosa non ha funzionato. Riprova tra poco.";
}

/** Errore lanciato quando un aggiornamento non tocca nessuna riga (bloccato dalle policy). */
export class NotAllowedError extends Error {
  code = "NOT_ALLOWED";
  constructor() {
    super("permission denied");
  }
}
