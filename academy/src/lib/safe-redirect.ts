/**
 * Accetta solo percorsi interni ("/app/...") per i parametri ?next=.
 * Blocca URL assoluti, "//dominio" e "/\dominio" che porterebbero fuori dal sito.
 */
export function safeNext(next: string | null | undefined, fallback = "/app") {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\r\n]/.test(next)) return fallback;
  return next;
}
