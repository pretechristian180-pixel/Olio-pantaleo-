/**
 * Agente di fatturazione. Lo chiama pg_cron (header x-cron-secret) con { azione }:
 *   "coda"                   ogni 2 minuti: elabora i job pronti
 *   "controllo_esiti"        ogni giorno: inviate da più di 5 giorni senza esito
 *   "riepilogo_settimanale"  il lunedì
 * Pubblicare con --no-verify-jwt (autenticazione col segreto condiviso; il pannello usa billing-admin).
 */
import { controlloEsiti, elaboraCoda, riepilogoSettimanale } from "../_shared/agente.ts";
import { cors, dipendenze, json, segretoUguale } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Metodo non consentito" }, 405);
  const d = dipendenze();
  if (!segretoUguale(req.headers.get("x-cron-secret"), d.config.cronSecret)) return json({ error: "Non autorizzato" }, 401);
  const { azione = "coda" } = await req.json().catch(() => ({}));
  try {
    if (azione === "coda") return json(await elaboraCoda(d));
    if (azione === "controllo_esiti") return json({ segnalate: await controlloEsiti(d) });
    if (azione === "riepilogo_settimanale") return json({ inviato: await riepilogoSettimanale(d) });
    return json({ error: "Azione sconosciuta" }, 400);
  } catch (e) {
    await d.archivio.log("errore", `agente:${azione}`, null, e instanceof Error ? e.message : "errore");
    return json({ error: "Errore dell'agente" }, 500);
  }
});
