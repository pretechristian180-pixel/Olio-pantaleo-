/**
 * Date italiane rilevanti per i contenuti social (festività, ricorrenze commerciali, stagioni).
 * Tutte le date sono "di calendario" (YYYY-MM-DD), senza fuso orario.
 */

export interface CalendarDate {
  date: string; // YYYY-MM-DD
  label: string;
  /** Settori per cui la data è particolarmente rilevante (vuoto = tutti). */
  sectors?: string[];
}

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Domenica di Pasqua (algoritmo di Meeus/Jones/Butcher). */
export function easterSunday(year: number): { m: number; d: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { m: month, d: day };
}

/** n-esimo giorno della settimana del mese (weekday: 0 = domenica). */
function nthWeekday(year: number, month: number, weekday: number, n: number) {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
}

function addDays(y: number, m: number, d: number, days: number) {
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function italianDates(year: number): CalendarDate[] {
  const easter = easterSunday(year);
  // Black Friday: venerdì dopo il quarto giovedì di novembre
  const thanksgiving = nthWeekday(year, 11, 4, 4);
  const carnevale = addDays(year, easter.m, easter.d, -47); // martedì grasso

  return [
    { date: iso(year, 1, 1), label: "Capodanno" },
    { date: iso(year, 1, 6), label: "Epifania" },
    { date: iso(year, 1, 5), label: "Inizio saldi invernali (indicativo)", sectors: ["retail"] },
    { date: carnevale, label: "Martedì grasso (Carnevale)" },
    { date: iso(year, 2, 14), label: "San Valentino" },
    { date: iso(year, 3, 8), label: "Festa della donna" },
    { date: iso(year, 3, 19), label: "Festa del papà" },
    { date: iso(year, easter.m, easter.d), label: "Pasqua" },
    { date: addDays(year, easter.m, easter.d, 1), label: "Pasquetta" },
    { date: iso(year, 4, 25), label: "Festa della Liberazione" },
    { date: iso(year, 5, 1), label: "Festa dei lavoratori" },
    { date: iso(year, 5, nthWeekday(year, 5, 0, 2)), label: "Festa della mamma" },
    { date: iso(year, 6, 2), label: "Festa della Repubblica" },
    { date: iso(year, 6, 21), label: "Inizio dell'estate" },
    { date: iso(year, 7, 4), label: "Inizio saldi estivi (indicativo)", sectors: ["retail"] },
    { date: iso(year, 8, 15), label: "Ferragosto" },
    { date: iso(year, 9, 15), label: "Rientro a scuola (indicativo)" },
    { date: iso(year, 10, 2), label: "Festa dei nonni" },
    { date: iso(year, 10, 31), label: "Halloween" },
    { date: iso(year, 11, 1), label: "Ognissanti" },
    { date: iso(year, 11, thanksgiving + 1), label: "Black Friday" },
    { date: iso(year, 12, 8), label: "Immacolata (inizio periodo natalizio)" },
    { date: iso(year, 12, 24), label: "Vigilia di Natale" },
    { date: iso(year, 12, 25), label: "Natale" },
    { date: iso(year, 12, 26), label: "Santo Stefano" },
    { date: iso(year, 12, 31), label: "San Silvestro" },
  ];
}

export function seasonOf(month: number): string {
  if (month === 12 || month <= 2) return "inverno";
  if (month <= 5) return "primavera";
  if (month <= 8) return "estate";
  return "autunno";
}

/**
 * Contesto stagionale per la settimana che inizia il lunedì `weekStart` (YYYY-MM-DD):
 * stagione e date nelle prossime `daysAhead` giorni (per preparare i contenuti in anticipo).
 */
export function weekContext(weekStart: string, daysAhead = 21, sector?: string | null) {
  const [y, m, d] = weekStart.split("-").map(Number) as [number, number, number];
  const start = Date.UTC(y, m - 1, d);
  const end = start + daysAhead * 86_400_000;
  const dates = [...italianDates(y), ...italianDates(y + 1)]
    .filter((c) => {
      const [cy, cm, cd] = c.date.split("-").map(Number) as [number, number, number];
      const t = Date.UTC(cy, cm - 1, cd);
      return t >= start && t <= end;
    })
    .filter((c) => !c.sectors || !sector || c.sectors.includes(sector))
    .sort((a, b) => a.date.localeCompare(b.date));
  return { season: seasonOf(m), upcoming: dates };
}

/** Lunedì della settimana che contiene `date` (in ora italiana), come YYYY-MM-DD. */
export function mondayOf(date: Date, timeZone = "Europe/Rome") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const [y, m, d] = parts.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() - (dow - 1));
  return dt.toISOString().slice(0, 10);
}
