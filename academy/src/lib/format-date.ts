/** Data breve in italiano: "5 nov 2026". */
export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Rome",
  }).format(new Date(iso));
}
