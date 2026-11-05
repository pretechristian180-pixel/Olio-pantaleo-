"use client";

/** Ultima rete di sicurezza: errore nel layout principale (es. database non raggiungibile). */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="it">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          margin: 0,
          background: "#f4f6f9",
          color: "#1d2124",
        }}
      >
        <main
          style={{
            minHeight: "100dvh",
            display: "grid",
            placeItems: "center",
            padding: 24,
            textAlign: "center",
          }}
        >
          <div>
            <p style={{ letterSpacing: "0.2em", fontWeight: 600 }}>ACADEMY</p>
            <h1 style={{ fontSize: 22 }}>Il servizio non risponde in questo momento</h1>
            <p style={{ color: "#5f646a", maxWidth: 420 }}>
              Riprova tra qualche secondo. Se il problema resta, scrivici.
            </p>
            <button
              onClick={reset}
              style={{
                marginTop: 16,
                height: 44,
                padding: "0 20px",
                border: 0,
                borderRadius: 8,
                background: "#0042ed",
                color: "#fff",
                fontWeight: 600,
              }}
            >
              Riprova
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
