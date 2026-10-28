import { useEffect, useState } from "react";
import { subscribe } from "@/services/store";

/**
 * Carica dati asincroni e si aggiorna da solo quando l'archivio cambia.
 * `loading` è vero solo al primo caricamento, così mostriamo gli skeleton
 * una volta sola e non a ogni piccolo aggiornamento.
 * (Con Supabase si potrà sostituire con TanStack Query o con le subscription realtime.)
 */
export function useQuery<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => subscribe(() => setVersion((v) => v + 1)), []);

  useEffect(() => {
    let alive = true;
    fetcher().then((d) => {
      if (!alive) return;
      setData(d);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  return { data, loading };
}
