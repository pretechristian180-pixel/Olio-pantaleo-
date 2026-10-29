/**
 * Notifiche di Fatture in Cloud: esito SDI dei documenti (evento
 * it.fattureincloud.webhooks.issued_documents.e_invoices.status_update). Pubblicare con --no-verify-jwt.
 *
 * Sicurezza: l'URL registrato contiene un token segreto (?t=FIC_WEBHOOK_TOKEN) e la notifica NON viene
 * creduta sulla parola: per ogni documento si rilegge lo stato dall'API di Fatture in Cloud.
 */
import { aggiornaEsitoSdi, inviaAvvisiPendenti } from "../_shared/agente.ts";
import { cors, dipendenze, json, segretoUguale } from "../_shared/http.ts";

// DA VERIFICARE sulla documentazione webhooks di Fatture in Cloud (non presente nello spec OpenAPI):
// nome dell'header della sfida di verifica, formato della risposta e corpo della notifica in modalità "binary".
const HEADER_SFIDA = "x-fic-verification-challenge";
const rispostaSfida = (sfida: string) => ({ verification: sfida });
// deno-lint-ignore no-explicit-any
const idDocumenti = (corpo: any): number[] =>
  (corpo?.data?.ids ?? corpo?.ids ?? (corpo?.data?.id != null ? [corpo.data.id] : [])).map(Number).filter(Number.isFinite);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const d = dipendenze();
  const url = new URL(req.url);
  if (!segretoUguale(url.searchParams.get("t"), d.config.ficWebhookToken)) return json({ error: "Non autorizzato" }, 401);

  // Prima notifica: verifica della subscription
  const sfida = req.headers.get(HEADER_SFIDA) ?? url.searchParams.get(HEADER_SFIDA);
  if (sfida) {
    await d.archivio.db.from("fic_subscriptions").update({ verificata: true, verificata_at: new Date().toISOString() }).eq("verificata", false);
    await d.archivio.log("info", "fic:verifica_subscription", null, "Subscription verificata da Fatture in Cloud");
    return json(rispostaSfida(sfida));
  }

  const corpo = await req.json().catch(() => null);
  const ids = idDocumenti(corpo);
  await d.archivio.log("info", "fic:notifica", req.headers.get("ce-type"), `Notifica esito SDI per ${ids.length} documenti`);
  for (const id of ids) {
    try {
      await aggiornaEsitoSdi(id, d);
    } catch (e) {
      await d.archivio.log("errore", "fic:esito", String(id), e instanceof Error ? e.message : "errore");
    }
  }
  await inviaAvvisiPendenti(d);
  return json({ ricevuto: true });
});
