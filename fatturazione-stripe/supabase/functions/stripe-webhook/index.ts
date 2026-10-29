/**
 * Webhook Stripe. Pubblicare con --no-verify-jwt (Stripe non ha un JWT Supabase: l'autenticità
 * è garantita dalla firma Stripe-Signature verificata con STRIPE_WEBHOOK_SECRET).
 *
 *   invoice.paid     → job "fattura" (si emette solo a pagamento incassato)
 *   charge.refunded  → job "nota_credito" per ogni rimborso riuscito della charge (anche parziale)
 *   refund.updated   → job "nota_credito" quando un rimborso in attesa (es. SEPA) diventa riuscito
 * Ogni evento è registrato in stripe_events con l'id come chiave: un evento ripetuto viene ignorato,
 * e gli indici unici della coda impediscono comunque una seconda fattura per lo stesso pagamento.
 */
import Stripe from "npm:stripe@17.7.0";
import { cors, dipendenze, json } from "../_shared/http.ts";

const cryptoProvider = Stripe.createSubtleCryptoProvider();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Metodo non consentito" }, 405);
  const d = dipendenze();
  const firma = req.headers.get("Stripe-Signature");
  const corpo = await req.text();

  let evento: Stripe.Event;
  try {
    evento = await Stripe.webhooks.constructEventAsync(corpo, firma ?? "", d.config.stripeWebhookSecret, undefined, cryptoProvider);
  } catch {
    await d.archivio.log("avviso", "stripe:firma_non_valida", null, "Evento rifiutato: firma Stripe non valida");
    return json({ error: "Firma non valida" }, 400);
  }

  // deno-lint-ignore no-explicit-any
  const oggetto = evento.data.object as any;
  const nuovo = await d.archivio.db.rpc("registra_evento_stripe", {
    p_id: evento.id, p_tipo: evento.type, p_livemode: evento.livemode, p_oggetto: oggetto?.id ?? null,
  });
  if (nuovo.error) return json({ error: "Database non disponibile" }, 500); // Stripe riproverà
  if (nuovo.data === false) {
    await d.archivio.log("info", "stripe:duplicato", evento.id, `Evento ${evento.type} già ricevuto: ignorato`);
    return json({ ricevuto: true, duplicato: true });
  }

  const esito = async (testo: string) => {
    await d.archivio.db.from("stripe_events").update({ elaborato_at: new Date().toISOString(), esito: testo }).eq("id", evento.id);
  };

  try {
    if (evento.type === "invoice.paid") {
      const { error } = await d.archivio.db.from("invoice_jobs").insert({
        tipo: "fattura",
        stripe_invoice_id: oggetto.id,
        stripe_customer_id: typeof oggetto.customer === "string" ? oggetto.customer : oggetto.customer?.id,
        stripe_charge_id: typeof oggetto.charge === "string" ? oggetto.charge : null,
        stripe_event_id: evento.id,
      });
      // 23505 = esiste già il job per questa fattura (idempotenza): va bene così
      if (error && error.code !== "23505") throw error;
      await esito(error ? "fattura già in coda" : "fattura in coda");
      await d.archivio.log("info", "stripe:invoice.paid", oggetto.id, error ? "Fattura già in coda: nessun duplicato" : "Fattura messa in coda");
    } else if (evento.type === "charge.refunded" || evento.type === "refund.updated") {
      const chargeId = evento.type === "charge.refunded" ? oggetto.id : typeof oggetto.charge === "string" ? oggetto.charge : oggetto.charge?.id;
      if (!chargeId) {
        await esito("rimborso senza charge: ignorato");
        return json({ ricevuto: true });
      }
      // La charge con tutti i suoi rimborsi: una nota di credito per ciascun rimborso RIUSCITO
      const charge = await d.stripe.charge(chargeId);
      const invoiceId = typeof charge.invoice === "string" ? charge.invoice : charge.invoice?.id;
      if (!invoiceId) {
        await esito("rimborso senza fattura Stripe: ignorato");
        await d.archivio.log("info", `stripe:${evento.type}`, chargeId, "Rimborso non legato a una fattura: nessuna nota di credito");
        return json({ ricevuto: true });
      }
      // deno-lint-ignore no-explicit-any
      const riusciti = (charge.refunds?.data ?? []).filter((r: any) => r.status === "succeeded");
      let nuovi = 0;
      for (const r of riusciti) {
        const { error } = await d.archivio.db.from("invoice_jobs").insert({
          tipo: "nota_credito",
          stripe_invoice_id: invoiceId,
          stripe_customer_id: typeof charge.customer === "string" ? charge.customer : null,
          stripe_charge_id: chargeId,
          stripe_refund_id: r.id,
          importo_rimborso_cents: r.amount,
          stripe_event_id: evento.id,
        });
        // 23505 = nota di credito già in coda per questo rimborso
        if (error && error.code !== "23505") throw error;
        if (!error) nuovi++;
      }
      await esito(`${nuovi} note di credito in coda`);
      await d.archivio.log("info", `stripe:${evento.type}`, chargeId, `${nuovi} nuove note di credito in coda (${riusciti.length} rimborsi riusciti sulla charge)`);
    } else {
      await esito("evento non gestito");
    }
    return json({ ricevuto: true });
  } catch (e) {
    // Si annulla la registrazione così Stripe, riprovando, rielabora l'evento
    await d.archivio.db.from("stripe_events").delete().eq("id", evento.id).is("elaborato_at", null);
    await d.archivio.log("errore", "stripe:webhook", evento.id, `Elaborazione non riuscita: ${e instanceof Error ? e.message : "errore"}`);
    return json({ error: "Elaborazione non riuscita" }, 500);
  }
});
