import * as Sentry from "@sentry/nextjs";

/**
 * Monitoraggio errori (Sentry), attivo solo con SENTRY_DSN. Nessun dato personale:
 * niente IP, cookie o corpo delle richieste; le email nei messaggi vengono oscurate.
 */
export async function register() {
  if (!process.env.SENTRY_DSN) return;
  const { sentryOptions } = await import("./lib/sentry");
  Sentry.init(sentryOptions(process.env.SENTRY_DSN));
}

export const onRequestError = Sentry.captureRequestError;
