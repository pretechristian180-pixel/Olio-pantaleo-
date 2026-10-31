/**
 * Livello dati delle Automazioni. Solo il titolare modifica (policy RLS); gli agenti vedono
 * la cronologia dei propri contatti. Gli invii li fa la Edge Function "automazioni".
 */
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { NotAllowedError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import type { ID } from "@/types/domain";
import type { Automation, AutomationRun, MessageTemplate, MessagingSettings, NewAutomation, OptOut, RunState } from "@/types/automations";
import { emitChange } from "./events";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as SupabaseClient<any>;
/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

function ok<T>(res: { data: T; error: PostgrestError | null }): NonNullable<T> {
  if (res.error) throw res.error;
  return res.data as NonNullable<T>;
}

const toTemplate = (r: Row): MessageTemplate => ({
  id: r.id,
  code: r.codice,
  name: r.nome,
  channel: r.canale,
  subject: r.oggetto,
  text: r.testo,
  waName: r.whatsapp_template_name,
  waState: r.whatsapp_template_stato,
});

export async function listAutomations(): Promise<Automation[]> {
  const [autos, tpls, stats] = await Promise.all([
    db.from("automations").select("*").order("created_at"),
    db.from("message_templates").select("*"),
    db.rpc("automation_stats"),
  ]);
  const byCode = new Map((ok(tpls) as Row[]).map((t) => [t.codice, toTemplate(t)]));
  const counts = new Map(((stats.data ?? []) as Row[]).map((s) => [s.automation_id, Number(s.eseguite)]));
  return (ok(autos) as Row[]).map((r) => ({
    id: r.id,
    name: r.nome,
    description: r.descrizione ?? "",
    active: r.attiva,
    recipe: r.ricetta_codice,
    trigger: r.trigger_tipo,
    entity: r.trigger_entita,
    conditions: r.trigger_condizioni ?? {},
    waitValue: r.attesa_valore,
    waitUnit: r.attesa_unita,
    waitDirection: r.attesa_direzione,
    action: r.azione_tipo,
    recipient: r.azione_destinatario,
    content: r.azione_contenuto ?? {},
    needsConsent: r.richiede_consenso,
    runsThisMonth: counts.get(r.id) ?? 0,
    template: r.azione_contenuto?.template ? byCode.get(r.azione_contenuto.template) : undefined,
  }));
}

export async function setAutomationActive(id: ID, active: boolean) {
  const rows = ok(await db.from("automations").update({ attiva: active }).eq("id", id).select("id")) as Row[];
  if (!rows.length) throw new NotAllowedError();
  emitChange();
}

/** Modifica di tempi e testi (la struttura delle ricette resta la stessa) */
export async function updateAutomation(
  a: Automation,
  patch: { waitValue: number; waitUnit: Automation["waitUnit"]; text?: string; subject?: string; title?: string },
) {
  const content = { ...a.content };
  if (patch.title !== undefined) content.titolo = patch.title;
  const rows = ok(
    await db
      .from("automations")
      .update({
        attesa_valore: patch.waitValue,
        attesa_unita: patch.waitUnit,
        azione_contenuto: content,
        // Per "ogni N giorni" e "senza attività da N giorni" il numero di giorni è anche nella condizione
        trigger_condizioni: a.trigger === "periodico" || a.trigger === "inattivita" ? { ...a.conditions, giorni: patch.waitValue } : a.conditions,
      })
      .eq("id", a.id)
      .select("id"),
  ) as Row[];
  if (!rows.length) throw new NotAllowedError();
  if (a.template && (patch.text !== undefined || patch.subject !== undefined)) {
    ok(
      await db
        .from("message_templates")
        .update({ ...(patch.text !== undefined ? { testo: patch.text } : {}), ...(patch.subject !== undefined ? { oggetto: patch.subject } : {}) })
        .eq("id", a.template.id),
    );
  }
  emitChange();
}

export async function createAutomation(n: NewAutomation) {
  const message = n.action === "whatsapp" || n.action === "email";
  let content: Row = {};
  if (message) {
    const code = `personale_${crypto.randomUUID().slice(0, 8)}`;
    ok(
      await db.from("message_templates").insert({
        codice: code,
        nome: n.name,
        canale: n.action,
        oggetto: n.action === "email" ? n.subject || n.name : null,
        testo: n.text,
        whatsapp_template_name: n.action === "whatsapp" ? `mattonio_${code}` : null,
      }),
    );
    content = { template: code };
  } else content = { titolo: n.text };
  ok(
    await db.from("automations").insert({
      nome: n.name,
      descrizione: null,
      attiva: true,
      trigger_tipo: n.trigger,
      trigger_entita: n.entity,
      trigger_condizioni: n.conditions,
      attesa_valore: n.waitValue,
      attesa_unita: n.waitUnit,
      attesa_direzione: n.waitDirection,
      azione_tipo: n.action,
      azione_destinatario: n.recipient,
      azione_contenuto: content,
    }),
  );
  emitChange();
}

export async function deleteAutomation(id: ID) {
  ok(await db.from("automations").delete().eq("id", id));
  emitChange();
}

export async function listRuns(state?: RunState): Promise<AutomationRun[]> {
  let q = db
    .from("automation_runs")
    .select("id, esegui_alle, stato, motivo, canale, testo, eseguita_at, contact_id, automazione:automations(nome), contatto:contacts(nome, cognome)")
    .order("esegui_alle", { ascending: false })
    .limit(100);
  if (state) q = q.eq("stato", state);
  return (ok(await q) as Row[]).map((r) => ({
    id: r.id,
    automationName: r.automazione?.nome ?? "",
    contactId: r.contact_id,
    contactName: r.contatto ? `${r.contatto.nome} ${r.contatto.cognome}`.trim() : null,
    runAt: r.esegui_alle,
    state: r.stato,
    reason: r.motivo,
    channel: r.canale,
    text: r.testo,
    doneAt: r.eseguita_at,
  }));
}

export async function listOptOuts(): Promise<OptOut[]> {
  const rows = ok(await db.from("opt_outs").select("*, contatto:contacts(nome, cognome)").order("created_at", { ascending: false })) as Row[];
  return rows.map((r) => ({
    id: r.id,
    contactId: r.contact_id,
    contactName: r.contatto ? `${r.contatto.nome} ${r.contatto.cognome}`.trim() : "Contatto",
    channel: r.canale,
    reason: r.motivo,
    createdAt: r.created_at,
  }));
}

export async function removeOptOut(id: ID) {
  ok(await db.from("opt_outs").delete().eq("id", id));
  emitChange();
}

/** Esclusione dai messaggi automatici di un contatto (tutti i canali) */
export async function isExcluded(contactId: ID) {
  const r = ok(await db.from("opt_outs").select("id").eq("contact_id", contactId).eq("canale", "tutti").maybeSingle()) as Row | null;
  return !!r;
}

export async function setExcluded(contactId: ID, excluded: boolean) {
  if (excluded) ok(await db.from("opt_outs").upsert({ contact_id: contactId, canale: "tutti", motivo: "Escluso dall'agente" }, { onConflict: "contact_id,canale" }));
  else ok(await db.from("opt_outs").delete().eq("contact_id", contactId).eq("canale", "tutti"));
  emitChange();
}

export async function getMessagingSettings(): Promise<MessagingSettings> {
  const r = ok(await db.from("messaging_settings").select("*").maybeSingle()) as Row | null;
  return { whatsappPhoneNumberId: r?.whatsapp_phone_number_id ?? "", replyEmail: r?.email_risposta ?? "", reviewsLink: r?.link_recensioni ?? "" };
}

export async function saveMessagingSettings(s: MessagingSettings) {
  const { data } = await supabase.auth.getSession();
  const prof = ok(await db.from("profiles").select("agency_id").eq("id", data.session?.user.id ?? "").single()) as Row;
  ok(
    await db.from("messaging_settings").upsert({
      agency_id: prof.agency_id,
      whatsapp_phone_number_id: s.whatsappPhoneNumberId.trim() || null,
      email_risposta: s.replyEmail.trim() || null,
      link_recensioni: s.reviewsLink.trim() || null,
    }),
  );
  emitChange();
}

/** Aggiorna lo stato dei modelli WhatsApp leggendolo da Meta (serve WhatsApp collegato sul server) */
export async function syncTemplates(): Promise<number> {
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; aggiornati?: number; error?: string }>("automazioni", { body: { azione: "sincronizza_modelli" } });
  if (data?.error) throw new Error(data.error);
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const msg = ctx && typeof ctx.json === "function" ? await ctx.json().then((j: { error?: string }) => j.error).catch(() => null) : null;
    throw new Error(msg ?? "Non riesco a contattare il server. Riprova tra poco.");
  }
  emitChange();
  return data?.aggiornati ?? 0;
}

/* ---------- Pagine pubbliche (link nei messaggi) ---------- */

async function pubblico<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T & { error?: string }>("automazioni-pubblico", { body });
  if (data && (data as { error?: string }).error) throw new Error((data as { error?: string }).error);
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const msg = ctx && typeof ctx.json === "function" ? await ctx.json().then((j: { error?: string }) => j.error).catch(() => null) : null;
    throw new Error(msg ?? "Il link non è valido oppure c'è un problema di connessione.");
  }
  return data as T;
}

export type QuestionnaireInfo = { agenzia: string; indirizzo: string | null; citta: string | null; nome: string | null; gia_compilato: boolean; scaduto: boolean };

export const getQuestionnaire = (token: string) => pubblico<QuestionnaireInfo>({ questionario: token });
export const sendQuestionnaire = (token: string, risposte: Record<string, unknown>) => pubblico<{ ok: boolean }>({ questionario: token, risposte });
export const unsubscribe = (token: string) => pubblico<{ ok: boolean; agenzia: string }>({ disiscrizione: token });
