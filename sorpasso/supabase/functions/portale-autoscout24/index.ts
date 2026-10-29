/**
 * Connettore API AutoScout24 (chiamate reali dietro il flag PORTALE_AUTOSCOUT24_API_ATTIVA).
 * L'operazione "anteprima" restituisce il payload che verrebbe inviato, anche con il flag spento.
 * Pubblicare con --no-verify-jwt (autenticazione con x-sync-secret).
 */
import { connettoreAutoScout24 } from "../_shared/portali/connettori/index.ts";
import { costruisciPayload } from "../_shared/portali/connettori/autoscout24.ts";
import { serviConnettore } from "../_shared/portali/servi.ts";

Deno.serve(serviConnettore(connettoreAutoScout24, (a, ctx) => costruisciPayload(a, ctx)));
