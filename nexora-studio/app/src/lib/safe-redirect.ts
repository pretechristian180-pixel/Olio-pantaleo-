/** Accetta solo percorsi interni ("/qualcosa"), mai URL esterni o "//host". */
export function safeNext(
  value: FormDataEntryValue | string | null | undefined,
  fallback = "/inizio",
) {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
