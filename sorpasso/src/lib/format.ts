/** Formattazione in italiano: euro, km, date, tempi relativi. */

const euroFmt = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const euroCentFmt = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
const numFmt = new Intl.NumberFormat("it-IT");

export const euro = (n: number | null | undefined) => (n == null ? "—" : euroFmt.format(n));
export const euroCent = (n: number | null | undefined) => (n == null ? "—" : euroCentFmt.format(n));
export const numero = (n: number | null | undefined) => (n == null ? "—" : numFmt.format(n));
export const km = (n: number | null | undefined) => (n == null ? "—" : `${numFmt.format(n)} km`);

export const dataBreve = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" }) : "—";
export const dataLunga = (d: string | Date) =>
  new Date(d).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
export const ora = (d: string | Date) => new Date(d).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
export const dataOra = (d: string | Date | null | undefined) => (d ? `${dataBreve(d)}, ${ora(d)}` : "—");

export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
/** Lunedì della settimana di d. */
export function startOfWeek(d = new Date()) {
  const x = startOfDay(d);
  const giorno = (x.getDay() + 6) % 7;
  return addDays(x, -giorno);
}
export function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
export const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** "5 min fa", "3 ore fa", "ieri", "tra 2 giorni". */
export function relativo(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const diffMin = Math.round((new Date(d).getTime() - Date.now()) / 60000);
  const abs = Math.abs(diffMin);
  const futuro = diffMin > 0;
  const fmt = (n: number, u: string) => (futuro ? `tra ${n} ${u}` : `${n} ${u} fa`);
  if (abs < 1) return "adesso";
  if (abs < 60) return fmt(abs, "min");
  const ore = Math.round(abs / 60);
  if (ore < 24) return fmt(ore, ore === 1 ? "ora" : "ore");
  const giorni = Math.round(ore / 24);
  if (giorni === 1) return futuro ? "domani" : "ieri";
  if (giorni < 30) return fmt(giorni, "giorni");
  return dataBreve(d);
}

/** Minuti in formato leggibile: 45 min, 2 h 10 min, 3 gg. */
export function durata(min: number | null | undefined): string {
  if (min == null) return "—";
  if (min < 60) return `${Math.round(min)} min`;
  if (min < 60 * 24) {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  return `${Math.round(min / 60 / 24)} gg`;
}

/** Valore per <input type="datetime-local"> in ora locale. */
export function toDateTimeLocal(d: string | Date) {
  const x = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}
export const toDateInput = (d: string | Date) => toDateTimeLocal(d).slice(0, 10);

export const nomeCompleto = (p: { nome: string; cognome?: string | null }) => `${p.nome} ${p.cognome ?? ""}`.trim();

export const iniziali = (nome: string) =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
