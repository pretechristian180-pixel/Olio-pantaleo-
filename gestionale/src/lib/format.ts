const euro = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function formatPrice(value: number, perMonth = false) {
  return perMonth ? `${euro.format(value)}/mese` : euro.format(value);
}

/** "€ 250 mila" — più leggibile nelle card piccole */
export function formatShortPrice(value: number) {
  if (value >= 1_000_000) return `€ ${(value / 1_000_000).toLocaleString("it-IT", { maximumFractionDigits: 1 })} mln`;
  if (value >= 1_000) return `€ ${Math.round(value / 1000)} mila`;
  return euro.format(value);
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

export function formatLongDate(date: Date) {
  const s = date.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Lunedì della settimana che contiene `d` */
export function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7;
  return addDays(x, -day);
}

/** "oggi", "ieri", "3 giorni fa", "12 mar" */
export function formatRelative(iso: string, now = new Date()) {
  const days = Math.round((startOfDay(now).getTime() - startOfDay(new Date(iso)).getTime()) / 86_400_000);
  if (days === 0) return "oggi";
  if (days === 1) return "ieri";
  if (days > 1 && days < 7) return `${days} giorni fa`;
  if (days === -1) return "domani";
  return formatShortDate(iso);
}

export function daysSince(iso: string, now = new Date()) {
  return Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 86_400_000));
}

export function fullName(p: { firstName: string; lastName: string }) {
  return `${p.firstName} ${p.lastName}`;
}

export function initials(p: { firstName: string; lastName: string }) {
  return `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase();
}

/** Numero per link tel: e wa.me */
export function phoneDigits(phone: string) {
  return phone.replace(/[^\d+]/g, "");
}

export function whatsappLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits.startsWith("39") ? digits : `39${digits}`}`;
}
