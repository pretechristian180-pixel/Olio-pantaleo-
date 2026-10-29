import { useCallback, useEffect, useState } from "react";
import { friendlyError } from "@/lib/errors";
import { subscribe } from "@/services/events";

/**
 * Carica dati da Supabase e si aggiorna da solo quando qualcosa cambia.
 * `loading` è vero solo al primo caricamento (mostriamo gli skeleton una volta sola);
 * `error` contiene un messaggio già pronto in italiano; `reload` riprova.
 */
export function useQuery<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => subscribe(() => setVersion((v) => v + 1)), []);

  useEffect(() => {
    let alive = true;
    fetcher()
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(null);
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        console.error(e);
        setError(friendlyError(e));
        setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  const reload = useCallback(() => {
    setLoading(true);
    setVersion((v) => v + 1);
  }, []);

  return { data, loading, error, reload };
}
