import { z } from "zod";

/** Schemi condivisi tra browser e server, messaggi in italiano. */
export const emailSchema = z
  .string()
  .trim()
  .min(1, "Scrivi la tua email.")
  .email("Questa email non sembra corretta.")
  .max(254);

export const passwordSchema = z
  .string()
  .min(10, "La password deve avere almeno 10 caratteri.")
  .max(72, "La password può avere al massimo 72 caratteri.");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Scrivi la password."),
  ricordami: z.boolean(),
});

export const registerSchema = z.object({
  nome: z.string().trim().min(1, "Scrivi il tuo nome.").max(80),
  cognome: z.string().trim().min(1, "Scrivi il tuo cognome.").max(80),
  email: emailSchema,
  password: passwordSchema,
  privacy: z.literal(true, {
    message: "Per creare l'account devi accettare l'informativa privacy.",
  }),
  marketing: z.boolean(),
});

export const resetSchema = z
  .object({ password: passwordSchema, conferma: z.string() })
  .refine((v) => v.password === v.conferma, {
    message: "Le due password non coincidono.",
    path: ["conferma"],
  });

export const profileSchema = z.object({
  nome: z.string().trim().min(1, "Scrivi il tuo nome.").max(80),
  cognome: z.string().trim().max(80),
  marketing: z.boolean(),
});

export const noteSchema = z.object({
  lessonId: z.string().uuid(),
  noteId: z.string().uuid().optional(),
  secondo: z.number().int().min(0).max(86400),
  testo: z.string().trim().min(1, "La nota è vuota.").max(5000, "La nota è troppo lunga."),
});

export const questionSchema = z.object({
  lessonId: z.string().uuid(),
  testo: z.string().trim().min(5, "Scrivi almeno qualche parola.").max(4000),
});

export const answerSchema = z.object({
  questionId: z.string().uuid(),
  testo: z.string().trim().min(2, "La risposta è vuota.").max(6000),
});

export const progressSchema = z.object({
  lessonId: z.string().uuid(),
  secondo: z.number().min(0).max(86400),
  delta: z.number().min(0).max(3600),
  durata: z.number().min(0).max(86400).optional(),
});

/** Primo messaggio d'errore per campo, per mostrarlo sotto ogni input. */
export function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

/** Traduce gli errori più comuni di Supabase Auth. Mai mostrare il messaggio grezzo. */
export function authErrorMessage(
  code: string | undefined,
  fallback = "Qualcosa non ha funzionato. Riprova tra poco.",
) {
  switch (code) {
    case "invalid_credentials":
      return "Email o password non corrette.";
    case "email_not_confirmed":
      return "Devi prima confermare l'email: controlla la posta, anche nello spam.";
    case "user_already_exists":
    case "email_exists":
      return "Esiste già un account con questa email. Accedi o recupera la password.";
    case "weak_password":
      return "La password è troppo debole: usa almeno 10 caratteri, meglio se con numeri e simboli.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Troppi tentativi in poco tempo. Aspetta qualche minuto e riprova.";
    case "same_password":
      return "La nuova password deve essere diversa da quella attuale.";
    default:
      return fallback;
  }
}
