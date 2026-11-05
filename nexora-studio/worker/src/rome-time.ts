/** Ora corrente a Roma: giorno ISO della settimana (1 = lunedì), ora, data. */
export function romeNow(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Rome",
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const isoDow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(parts.weekday!) + 1;
  return {
    isoDow,
    hour: Number(parts.hour) % 24,
    date: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

export function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Settimane da preparare adesso:
 * - da lunedì a venerdì quella in corso (aziende nuove o riattivate durante la settimana);
 * - da domenica sera la successiva. Sabato e domenica di giorno nessuna: la settimana sta finendo.
 */
export function targetWeeks(now: Date, generateHour: number) {
  const r = romeNow(now);
  const monday = addDays(r.date, -(r.isoDow - 1));
  const weeks: string[] = [];
  if (r.isoDow <= 5) weeks.push(monday);
  if (r.isoDow === 7 && r.hour >= generateHour) weeks.push(addDays(monday, 7));
  return weeks;
}

/** true se l'email del lunedì per la settimana `weekStart` può partire. */
export function weeklyEmailDue(now: Date, weekStart: string, emailHour: number) {
  const r = romeNow(now);
  if (r.date > weekStart) return true;
  return r.date === weekStart && r.hour >= emailHour;
}
