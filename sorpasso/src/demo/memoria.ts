/** Archivio in memoria per la sessione della demo (niente localStorage: in un'anteprima può non esserci). */
import { DEMO_UTENTE } from "./config";

const dati = new Map<string, string>();

export function archivioDemo(chiaveSessione: string) {
  dati.set(
    chiaveSessione,
    JSON.stringify({
      access_token: "demo", token_type: "bearer", expires_in: 3600 * 24 * 365, expires_at: 4102444800, refresh_token: "demo",
      user: { id: DEMO_UTENTE.id, aud: "authenticated", role: "authenticated", email: DEMO_UTENTE.email, user_metadata: {}, app_metadata: {} },
    }),
  );
  return {
    getItem: (k: string) => dati.get(k) ?? null,
    setItem: (k: string, v: string) => void dati.set(k, v),
    removeItem: (k: string) => void dati.delete(k),
  };
}
