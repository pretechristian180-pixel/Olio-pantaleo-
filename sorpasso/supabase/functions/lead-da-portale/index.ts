/**
 * Ricezione dei lead da un portale (webhook o inoltro email→webhook). Pubblicare con --no-verify-jwt.
 *   POST ?t=<webhook_token di organization_portals>
 *   { id_annuncio?, url_annuncio?, riferimento? ("SA-XXXXXX"), nome, cognome?, telefono?, email?, messaggio? }
 * Il lead viene collegato in automatico all'annuncio (per id/URL del portale o per riferimento) e quindi all'auto;
 * la fonte è quella del portale. Assegnazione con il round robin come gli altri lead.
 */
import { ErroreUtente, clientServizio, corsHeaders, gestisciErrore, json } from "../_shared/http.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TELEFONO = /^\+?[\d\s./-]{6,20}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const txt = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Metodo non consentito" }, 405);
  try {
    const token = new URL(req.url).searchParams.get("t");
    if (!token || !UUID.test(token)) throw new ErroreUtente("Non autorizzato", 401);
    const sb = clientServizio();
    const { data: op } = await sb.from("organization_portals")
      .select("organization_id, portal_id, attivo, portals(fonte_lead, nome)").eq("webhook_token", token).maybeSingle();
    if (!op) throw new ErroreUtente("Non autorizzato", 401);
    const portale = op.portals as unknown as { fonte_lead: string; nome: string };

    const b = await req.json().catch(() => ({}));
    const nome = txt(b.nome, 80);
    const telefono = txt(b.telefono, 30);
    const email = txt(b.email, 120).toLowerCase();
    if (!nome) throw new ErroreUtente("Manca il nome del cliente");
    if (telefono && !TELEFONO.test(telefono)) throw new ErroreUtente("Telefono non valido");
    if (email && !EMAIL.test(email)) throw new ErroreUtente("Email non valida");
    if (!telefono && !email) throw new ErroreUtente("Serve almeno telefono o email");

    // Annuncio di provenienza: id del portale, URL, oppure riferimento Sorpasso nel testo
    let listingId: string | null = null;
    const idAnnuncio = txt(b.id_annuncio, 100);
    const urlAnnuncio = txt(b.url_annuncio, 500);
    if (idAnnuncio || urlAnnuncio) {
      let q = sb.from("vehicle_listings").select("id").eq("organization_id", op.organization_id).eq("portal_id", op.portal_id);
      q = idAnnuncio ? q.eq("id_esterno", idAnnuncio) : q.eq("url", urlAnnuncio);
      listingId = (await q.maybeSingle()).data?.id ?? null;
    }
    const messaggio = txt(b.messaggio, 2000);
    const riferimento = txt(b.riferimento, 20);
    const richiesta = [`Richiesta da ${portale.nome}`, riferimento && `Rif. ${riferimento}`, messaggio].filter(Boolean).join("\n");

    // Contatto: riusa quello con stesso telefono o email
    let contactId: string | undefined;
    if (telefono) {
      const cifre = telefono.replace(/\D/g, "").slice(-9);
      const { data } = await sb.from("contacts").select("id, telefono").eq("organization_id", op.organization_id).ilike("telefono", `%${cifre.slice(-6)}%`).limit(10);
      contactId = (data ?? []).find((c) => (c.telefono ?? "").replace(/\D/g, "").endsWith(cifre))?.id;
    }
    if (!contactId && email) {
      contactId = (await sb.from("contacts").select("id").eq("organization_id", op.organization_id).ilike("email", email).limit(1).maybeSingle()).data?.id;
    }
    if (!contactId) {
      const { data, error } = await sb.from("contacts").insert({
        organization_id: op.organization_id, nome, cognome: txt(b.cognome, 80), telefono: telefono || null, email: email || null,
        fonte: portale.fonte_lead,
      }).select("id").single();
      if (error) throw error;
      contactId = data.id;
    }

    const { data: org } = await sb.from("organizations").select("tempo_max_risposta_min").eq("id", op.organization_id).single();
    const { data: lead, error } = await sb.from("leads").insert({
      organization_id: op.organization_id,
      contact_id: contactId,
      listing_id: listingId,
      fonte: portale.fonte_lead,
      richiesta,
      prossima_azione_at: new Date(Date.now() + (org?.tempo_max_risposta_min ?? 15) * 60_000).toISOString(),
      prossima_azione_nota: "Primo contatto",
    }).select("id, vehicle_id, listing_id").single();
    if (error) throw error;

    await sb.from("automations_log").insert({
      organization_id: op.organization_id, tipo: "lead_da_portale", entita: "lead", entita_id: lead.id,
      dettagli: { portale: op.portal_id, collegato_auto: !!lead.vehicle_id, collegato_annuncio: !!lead.listing_id },
    });
    return json({ ok: true, lead_id: lead.id, collegato_auto: !!lead.vehicle_id });
  } catch (e) {
    return gestisciErrore(e, "lead-da-portale");
  }
});
