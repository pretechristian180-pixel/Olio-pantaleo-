import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "./lib/sentry";

// Errori nel browser: attivo solo con NEXT_PUBLIC_SENTRY_DSN.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) Sentry.init(sentryOptions(dsn));

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
