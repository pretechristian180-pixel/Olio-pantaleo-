/**
 * Consenso cookie (GDPR): necessari sempre attivi; statistiche (GA4) e marketing (Meta Pixel)
 * solo su scelta esplicita. La scelta si salva in localStorage con data e versione:
 * cambiando VERSIONE il banner ricompare a tutti.
 */
import { useSyncExternalStore } from "react";

export const VERSIONE_CONSENSO = "2026-10";
const CHIAVE = "sorpasso_consenso";

export interface Consenso {
  necessari: true;
  statistiche: boolean;
  marketing: boolean;
  data: string;
  versione: string;
}

const ascoltatori = new Set<() => void>();
let apertoManuale = false;
let cache: Consenso | null | undefined;

function leggi(): Consenso | null {
  if (cache !== undefined) return cache;
  try {
    const c = JSON.parse(localStorage.getItem(CHIAVE) ?? "null") as Consenso | null;
    cache = c && c.versione === VERSIONE_CONSENSO ? c : null;
  } catch {
    cache = null;
  }
  return cache;
}

const notifica = () => ascoltatori.forEach((f) => f());

export function salvaConsenso(scelta: { statistiche: boolean; marketing: boolean }) {
  const c: Consenso = { necessari: true, ...scelta, data: new Date().toISOString(), versione: VERSIONE_CONSENSO };
  cache = c;
  apertoManuale = false;
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(c));
  } catch {
    /* navigazione privata: la scelta vale per la sessione */
  }
  notifica();
}

export function apriPreferenze() {
  apertoManuale = true;
  notifica();
}

export const consensoCorrente = () => leggi();

const sottoscrivi = (f: () => void) => {
  ascoltatori.add(f);
  return () => ascoltatori.delete(f);
};

export function useConsenso() {
  const consenso = useSyncExternalStore(sottoscrivi, leggi, () => null);
  const aperto = useSyncExternalStore(sottoscrivi, () => apertoManuale, () => false);
  return { consenso, mostraBanner: !consenso || aperto };
}
