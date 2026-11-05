/**
 * Spazi di pubblicazione: giorni (ISO 1 = lunedì) e orario preferiti dell'azienda,
 * nel suo fuso orario (gestisce ora legale e solare).
 */

/** Offset in minuti del fuso `timeZone` in un dato istante (es. +60 o +120 per Roma). */
export function tzOffsetMinutes(date: Date, timeZone: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  const asUtc = Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!, +p.second!);
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** Data e ora locali ("2026-11-09", "12:30") nel fuso indicato → istante UTC. */
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const offset = tzOffsetMinutes(guess, timeZone);
  const result = new Date(guess.getTime() - offset * 60000);
  // Ricontrollo vicino al cambio d'ora
  const offset2 = tzOffsetMinutes(result, timeZone);
  return offset2 === offset ? result : new Date(guess.getTime() - offset2 * 60000);
}

/** Data locale (YYYY-MM-DD) e giorno ISO della settimana di un istante, nel fuso indicato. */
export function localParts(date: Date, timeZone: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  const isoDow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.weekday!) + 1;
  return { date: `${p.year}-${p.month}-${p.day}`, isoDow, time: `${p.hour === "24" ? "00" : p.hour}:${p.minute}` };
}

function addDaysIso(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Primo spazio libero dopo `after` (più un anticipo minimo), nei giorni e all'orario scelti,
 * evitando gli istanti già occupati da altri video (stesso giorno = occupato).
 */
export function nextFreeSlot(args: {
  postingDays: number[];
  postingTime: string;
  timeZone: string;
  after: Date;
  takenDays: string[];
  minLeadMinutes?: number;
  horizonDays?: number;
}): Date | null {
  const days = new Set(args.postingDays.length ? args.postingDays : [1, 3, 5]);
  const earliest = new Date(args.after.getTime() + (args.minLeadMinutes ?? 60) * 60000);
  const taken = new Set(args.takenDays);
  const start = localParts(args.after, args.timeZone).date;
  for (let i = 0; i <= (args.horizonDays ?? 60); i++) {
    const date = addDaysIso(start, i);
    const dow = ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
    if (!days.has(dow) || taken.has(date)) continue;
    const at = zonedToUtc(date, args.postingTime.slice(0, 5), args.timeZone);
    if (at >= earliest) return at;
  }
  return null;
}

/** Quanto prima dell'orario il worker consegna il post al fornitore (poi non si sposta più). */
export const PUBLISH_HANDOFF_MINUTES = 15;
