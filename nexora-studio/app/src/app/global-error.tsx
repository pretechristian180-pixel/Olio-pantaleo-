"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/** Errore che blocca tutta l'app (anche il layout): pagina minima, errore inviato a Sentry. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="it">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#05070d",
          color: "#eef0f4",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <main style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 22 }}>Qualcosa non ha funzionato</h1>
          <p style={{ color: "#9aa1b2" }}>
            Il problema è stato segnalato al nostro team. Riprova tra un momento.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 16,
              padding: "12px 20px",
              borderRadius: 10,
              border: 0,
              background: "#0a5cff",
              color: "#fff",
              fontWeight: 600,
            }}
          >
            Riprova
          </button>
        </main>
      </body>
    </html>
  );
}
