import { QueryCache, QueryClient, MutationCache } from "@tanstack/react-query";
import { mostraErrore } from "@/lib/errors";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
  },
  queryCache: new QueryCache({
    // Errore di caricamento: un toast solo se c'erano già dati (altrimenti la pagina mostra lo stato di errore).
    onError: (error, query) => {
      if (query.state.data !== undefined) mostraErrore(error, "Aggiornamento dei dati non riuscito");
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _v, _c, mutation) => {
      if (!mutation.options.onError) mostraErrore(error);
    },
  }),
});
