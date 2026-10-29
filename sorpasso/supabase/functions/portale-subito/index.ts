/**
 * Connettore API Subito (chiamate reali dietro il flag PORTALE_SUBITO_API_ATTIVA).
 * L'operazione "anteprima" restituisce il payload che verrebbe inviato, anche con il flag spento.
 * Pubblicare con --no-verify-jwt (autenticazione con x-sync-secret).
 */
import { connettoreSubito } from "../_shared/portali/connettori/index.ts";
import { costruisciPayload } from "../_shared/portali/connettori/subito.ts";
import { serviConnettore } from "../_shared/portali/servi.ts";

Deno.serve(serviConnettore(connettoreSubito, (a, ctx) => costruisciPayload(a, ctx)));
