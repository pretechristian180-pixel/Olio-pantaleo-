/**
 * Registra su Fatture in Cloud la subscription per gli esiti SDI e ne chiede la verifica.
 * Da chiamare una volta (dal pannello, pulsante "Collega esiti SDI", o con il segreto del cron).
 */
import { EVENTO_ESITO_SDI } from "../_shared/fic.ts";
import { cors, dipendenze, json, segretoUguale, utenteAdmin } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const d = dipendenze();
  const autorizzato = segretoUguale(req.headers.get("x-cron-secret"), d.config.cronSecret) || !!(await utenteAdmin(req));
  if (!autorizzato) return json({ error: "Non autorizzato" }, 401);
  if (!d.config.ficWebhookToken) return json({ error: "Manca il secret FIC_WEBHOOK_TOKEN" }, 400);
  try {
    const sink = `${d.config.functionsUrl}/fic-webhook?t=${encodeURIComponent(d.config.ficWebhookToken)}`;
    const sub = await d.fic.creaSubscription(sink);
    await d.archivio.db.from("fic_subscriptions").upsert({
      id: sub.id, sink: sink.replace(/t=[^&]+/, "t=***"), tipi: [EVENTO_ESITO_SDI], verificata: !!sub.verified,
    });
    if (!sub.verified) await d.fic.verificaSubscription(sub.id).catch(() => null);
    await d.archivio.log("info", "fic:subscription", sub.id, "Subscription esiti SDI registrata");
    return json({ ok: true, id: sub.id, verificata: !!sub.verified });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Registrazione non riuscita" }, 502);
  }
});
