/**
 * Archivio in memoria usato durante la fase di design.
 * Simula il database: quando collegheremo Supabase, i servizi in `api.ts`
 * leggeranno e scriveranno sulle tabelle vere e questo file sparirà.
 */
import * as mock from "@/data/mock";

/** Modalità demo "vuota": aggiungi ?vuoto all'indirizzo per vedere gli stati vuoti. */
function readEmptyMode() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has("vuoto")) sessionStorage.setItem("demo-vuoto", "1");
    if (params.has("pieno")) sessionStorage.removeItem("demo-vuoto");
    return sessionStorage.getItem("demo-vuoto") === "1";
  } catch {
    return false;
  }
}

export const emptyMode = readEmptyMode();

export const db = {
  properties: emptyMode ? [] : structuredClone(mock.properties),
  contacts: emptyMode ? [] : structuredClone(mock.contacts),
  deals: emptyMode ? [] : structuredClone(mock.deals),
  appointments: emptyMode ? [] : structuredClone(mock.appointments),
  tasks: emptyMode ? [] : structuredClone(mock.tasks),
  expiringMandates: emptyMode ? 0 : mock.expiringMandates,
};

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitChange() {
  listeners.forEach((l) => l());
}

export function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}
