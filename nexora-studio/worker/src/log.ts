/** Log strutturati in JSON su stdout (Railway li raccoglie). Mai segreti o contenuti delle email. */
export function log(level: "info" | "warn" | "error", msg: string, extra: Record<string, unknown> = {}) {
  const line = JSON.stringify({ level, msg, time: new Date().toISOString(), ...extra });
  if (level === "error") console.error(line);
  else console.log(line);
}
