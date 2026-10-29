/** Connettore "Manuale assistito" (stessa interfaccia degli altri). Pubblicare con --no-verify-jwt. */
import { connettoreManuale } from "../_shared/portali/connettori/index.ts";
import { serviConnettore } from "../_shared/portali/servi.ts";

Deno.serve(serviConnettore(connettoreManuale));
