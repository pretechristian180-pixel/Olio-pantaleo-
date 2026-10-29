import { toast } from "sonner";

/**
 * Traduce gli errori di Supabase/Postgres/rete in messaggi comprensibili.
 * Nei log finisce solo il codice dell'errore, mai dati personali.
 */
const PER_CODICE: Record<string, string> = {
  "23505": "Esiste già un elemento con questi dati (es. stessa targa o stesso telaio).",
  "23503": "Collegamento non valido: l'elemento collegato non esiste più.",
  "23514": "Alcuni dati non sono validi. Controlla i campi e riprova.",
  "23502": "Manca un dato obbligatorio.",
  "42501": "Non hai i permessi per questa operazione.",
  PGRST116: "Elemento non trovato o non accessibile.",
  "28000": "Accesso richiesto. Entra di nuovo.",
  P0001: "",
};

const PER_MESSAGGIO: [RegExp, string][] = [
  [/invalid login credentials/i, "Email o password non corretti."],
  [/email not confirmed/i, "Devi prima confermare l'email: controlla la tua casella di posta."],
  [/user already registered/i, "Esiste già un account con questa email. Prova ad accedere."],
  [/password should be at least/i, "La password deve avere almeno 8 caratteri."],
  [/jwt expired|invalid jwt/i, "La sessione è scaduta. Accedi di nuovo."],
  [/failed to fetch|networkerror|load failed/i, "Connessione assente. Controlla la rete e riprova."],
  [/row-level security/i, "Non hai i permessi per questa operazione."],
  [/rate limit/i, "Troppi tentativi. Attendi qualche minuto e riprova."],
  [/payload too large|exceeded the maximum allowed size/i, "Il file è troppo grande."],
  [/mime type .* is not supported/i, "Formato del file non supportato."],
];

/** Errore con un messaggio già pronto per l'utente. */
export class ErroreLeggibile extends Error {}

interface ErroreGenerico {
  code?: string;
  message?: string;
}

export function messaggioErrore(error: unknown, fallback = "Qualcosa è andato storto. Riprova."): string {
  if (!error) return fallback;
  if (error instanceof ErroreLeggibile) return error.message;
  const e = error as ErroreGenerico;
  if (e.code && PER_CODICE[e.code]) return PER_CODICE[e.code];
  // Eccezioni sollevate dalle nostre funzioni SQL hanno già il messaggio in italiano.
  if (e.code === "P0001" && e.message) return e.message;
  const msg = e.message ?? (typeof error === "string" ? error : "");
  for (const [re, testo] of PER_MESSAGGIO) if (re.test(msg)) return testo;
  return fallback;
}

export function mostraErrore(error: unknown, fallback?: string) {
  const e = error as ErroreGenerico;
  console.warn("[errore]", e?.code ?? (error instanceof Error ? error.name : "sconosciuto"));
  toast.error(messaggioErrore(error, fallback));
}

/**
 * Lancia l'errore di una risposta Supabase, altrimenti restituisce i dati.
 * (Per insert/update senza select i dati sono null: in quel caso il valore non va usato.)
 */
export function ok<T>(res: { data: T; error: unknown }): NonNullable<T> {
  if (res.error) throw res.error;
  return res.data as NonNullable<T>;
}
