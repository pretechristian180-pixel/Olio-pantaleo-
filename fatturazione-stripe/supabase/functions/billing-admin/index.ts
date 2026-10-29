/**
 * Azioni del pannello (solo amministratori, JWT Supabase verificato):
 *   riprova_job, reinvia, correggi_e_reinvia, pdf, link_fic, sincronizza_stripe, importa_da_stripe,
 *   opzioni_fic (tipi IVA e conti di incasso), esegui_coda.
 */
import { elaboraCoda, inviaAvvisiPendenti } from "../_shared/agente.ts";
import { cors, dipendenze, json, utenteAdmin } from "../_shared/http.ts";
import { entityDaProfilo } from "../_shared/mappatura.ts";
import { controllaProfilo, metadataDaProfilo, normalizzaProfilo, profiloDaMetadata } from "../_shared/validazione.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Metodo non consentito" }, 405);
  const admin = await utenteAdmin(req);
  if (!admin) return json({ error: "Accesso riservato agli amministratori" }, 403);
  const d = dipendenze();
  const db = d.archivio.db;
  const b = await req.json().catch(() => ({}));
  const azione: string = b.azione;
  const documento = async () => {
    const { data } = await db.from("invoices").select("*").eq("id", b.invoice_id).single();
    if (!data) throw new Error("Documento non trovato");
    return data;
  };

  try {
    switch (azione) {
      case "riprova_job": {
        const { error } = await db.from("invoice_jobs")
          .update({ stato: "in_coda", tentativi: 0, prossimo_tentativo_at: new Date().toISOString(), ultimo_errore: null })
          .eq("id", b.job_id).in("stato", ["dati_mancanti", "da_controllare", "errore"]);
        if (error) throw error;
        await d.archivio.log("info", "admin:riprova", b.job_id, "Job rimesso in coda dall'amministratore");
        await elaboraCoda(d, 5);
        return json({ ok: true });
      }
      case "reinvia": {
        const doc = await documento();
        const dryRun = !d.config.einvoiceLive;
        const verifica = await d.fic.verificaXml(doc.fic_document_id);
        if (!verifica.ok) return json({ ok: false, errori: verifica.errori });
        await d.fic.inviaSdi(doc.fic_document_id, dryRun);
        await db.from("invoices").update(dryRun ? { stato_sdi: "not_sent", dry_run: true } : { stato_sdi: "sent", inviata_at: new Date().toISOString(), dry_run: false, sdi_motivo: null, sdi_soluzione: null, sdi_codice: null }).eq("id", doc.id);
        await db.from("invoice_jobs").update({ stato: dryRun ? "emessa" : "inviata" }).eq("fic_document_id", doc.fic_document_id);
        await d.archivio.log("info", "admin:reinvia", doc.stripe_invoice_id, dryRun ? "Reinvio di prova (dry run)" : "Reinviata allo SDI");
        return json({ ok: true, prova: dryRun });
      }
      case "correggi_e_reinvia": {
        // Dopo lo scarto: dati del cliente corretti nel pannello → aggiorna anagrafica e documento, verifica, reinvia
        const doc = await documento();
        const { data: profilo } = await db.from("billing_profiles").select("*").eq("stripe_customer_id", doc.stripe_customer_id).single();
        const p = normalizzaProfilo(profilo);
        const esito = controllaProfilo(p);
        if (!esito.ok) return json({ ok: false, errori: [...esito.mancanti.map((m) => `Manca: ${m}`), ...esito.errori] });
        const entity = entityDaProfilo(p, profilo.fic_client_id);
        if (profilo.fic_client_id) await d.fic.aggiornaCliente(profilo.fic_client_id, entity);
        await d.fic.modificaDocumento(doc.fic_document_id, { entity });
        const verifica = await d.fic.verificaXml(doc.fic_document_id);
        if (!verifica.ok) return json({ ok: false, errori: verifica.errori });
        const dryRun = !d.config.einvoiceLive;
        await d.fic.inviaSdi(doc.fic_document_id, dryRun);
        await db.from("invoices").update({ stato_sdi: dryRun ? "not_sent" : "sent", inviata_at: dryRun ? doc.inviata_at : new Date().toISOString(), sdi_motivo: null, sdi_soluzione: null, sdi_codice: null, esito_at: null }).eq("id", doc.id);
        await db.from("invoice_jobs").update({ stato: dryRun ? "emessa" : "inviata" }).eq("fic_document_id", doc.fic_document_id);
        await db.from("avvisi").update({ risolto_at: new Date().toISOString() }).eq("invoice_id", doc.id).eq("tipo", "scarto_sdi");
        await d.archivio.log("info", "admin:correggi_reinvia", doc.stripe_invoice_id, dryRun ? "Corretto, reinvio di prova" : "Corretto e reinviato allo SDI");
        return json({ ok: true, prova: dryRun });
      }
      case "pdf": {
        // L'URL del PDF di Fatture in Cloud può scadere: si rilegge ogni volta
        const doc = await documento();
        const fic = await d.fic.leggiDocumento(doc.fic_document_id);
        if (fic.url) await db.from("invoices").update({ pdf_url: fic.url }).eq("id", doc.id);
        return json({ url: fic.url ?? null });
      }
      case "link_fic": {
        // DA VERIFICARE: formato dell'indirizzo del documento nell'app web di Fatture in Cloud.
        // Si configura con il secret FIC_URL_DOCUMENTO (es. "https://secure.fattureincloud.it/…{id}…").
        const doc = await documento();
        const modello = Deno.env.get("FIC_URL_DOCUMENTO");
        return json({ url: modello ? modello.replace("{id}", String(doc.fic_document_id)) : "https://secure.fattureincloud.it/" });
      }
      case "sincronizza_stripe": {
        const { data: profilo } = await db.from("billing_profiles").select("*").eq("stripe_customer_id", b.stripe_customer_id).single();
        await d.stripe.aggiornaMetadataCustomer(b.stripe_customer_id, metadataDaProfilo(normalizzaProfilo(profilo)));
        await db.from("billing_profiles").update({ sincronizzato_stripe_at: new Date().toISOString() }).eq("stripe_customer_id", b.stripe_customer_id);
        await d.archivio.log("info", "admin:sincronizza_stripe", b.stripe_customer_id, "Dati di fatturazione copiati nei metadata del Customer Stripe");
        return json({ ok: true });
      }
      case "importa_da_stripe": {
        const customer = await d.stripe.customer(b.stripe_customer_id);
        const p = profiloDaMetadata(b.stripe_customer_id, customer.metadata ?? {});
        await d.archivio.salvaProfilo(p);
        return json({ ok: true, controllo: controllaProfilo(p) });
      }
      case "opzioni_fic":
        return json({ tipi_iva: await d.fic.tipiIva(), conti: await d.fic.contiIncasso() });
      case "esegui_coda":
        return json(await elaboraCoda(d));
      case "invia_avvisi":
        return json({ inviati: await inviaAvvisiPendenti(d) });
      default:
        return json({ error: "Azione sconosciuta" }, 400);
    }
  } catch (e) {
    await d.archivio.log("errore", `admin:${azione}`, null, e instanceof Error ? e.message : "errore");
    return json({ error: e instanceof Error ? e.message : "Operazione non riuscita" }, 500);
  }
});
