/** Traduce gli errori di Supabase Auth in messaggi chiari in italiano. */
export function authErrorMessage(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return "Qualcosa è andato storto. Riprova tra poco.";
  switch (error.code) {
    case "invalid_credentials":
      return "Email o password non corrette.";
    case "email_not_confirmed":
      return "Prima conferma la tua email: ti abbiamo mandato un link.";
    case "user_already_exists":
    case "email_exists":
      return "Esiste già un account con questa email. Prova ad accedere.";
    case "weak_password":
      return "La password è troppo debole: usa almeno 8 caratteri con lettere e numeri.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Troppi tentativi. Aspetta qualche minuto e riprova.";
    case "same_password":
      return "La nuova password deve essere diversa da quella attuale.";
    case "otp_expired":
      return "Il link è scaduto. Richiedine uno nuovo.";
    case "signup_disabled":
      return "Le registrazioni sono chiuse al momento.";
    default:
      return "Qualcosa è andato storto. Riprova tra poco.";
  }
}
