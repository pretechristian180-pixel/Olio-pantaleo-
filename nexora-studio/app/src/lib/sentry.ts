import type { ErrorEvent } from "@sentry/nextjs";

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/** Toglie le email da messaggi ed eccezioni prima dell'invio. */
export function scrub(event: ErrorEvent): ErrorEvent {
  if (event.message) event.message = event.message.replace(EMAIL_RE, "[email]");
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = ex.value.replace(EMAIL_RE, "[email]");
  }
  if (event.user) event.user = { id: event.user.id };
  delete event.request?.cookies;
  delete event.request?.data;
  return event;
}

/** Opzioni comuni a server, edge e browser. */
export function sentryOptions(dsn: string) {
  return {
    dsn,
    environment:
      process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    tracesSampleRate: 0.05,
    beforeSend: scrub,
  };
}
