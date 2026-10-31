/** Versione "anteprima" di src/services/automations.ts: le stesse ricette, in memoria. */
import { emitChange } from "@/services/events";
import type { ID } from "@/types/domain";
import type { Automation, AutomationRun, MessageTemplate, MessagingSettings, NewAutomation, OptOut, RunState } from "@/types/automations";
import { demoDb } from "./api";

const wait = <T,>(value: T, ms = 250) => new Promise<T>((r) => setTimeout(() => r(value), ms));
const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

const tpl = (code: string, name: string, text: string, channel: "whatsapp" | "email" = "whatsapp", subject: string | null = null, state: MessageTemplate["waState"] = "bozza"): MessageTemplate => ({
  id: `t_${code}`, code, name, channel, subject, text, waName: channel === "whatsapp" ? `mattonio_${code}` : null, waState: state,
});

const templates: MessageTemplate[] = [
  tpl("benvenuto", "Benvenuto al nuovo contatto", "Ciao {{nome}}, sono {{nome_agente}} di {{nome_agenzia}}. Ho ricevuto la tua richiesta e ti chiamo a breve. Se preferisci, rispondi qui con l'orario migliore per sentirci.", "whatsapp", null, "approvato"),
  tpl("promemoria_visita", "Promemoria della visita", "Ciao {{nome}}, ti ricordo la visita di domani, {{data_appuntamento}} alle {{ora_appuntamento}}, in {{indirizzo_immobile}}. A presto! {{nome_agente}}, {{nome_agenzia}}", "whatsapp", null, "approvato"),
  tpl("feedback_visita", "Com'è andata la visita", "Ciao {{nome}}, grazie per aver visto l'immobile in {{indirizzo_immobile}}. Com'è andata? Bastano 30 secondi: {{link_questionario}}", "whatsapp", null, "in_revisione"),
  tpl("report_proprietario", "Aggiornamento al proprietario", "Gentile {{nome}},\necco come sta andando il suo immobile in {{indirizzo_immobile}} negli ultimi 15 giorni:\n\n• visite fatte: {{visite}}\n• nuovi acquirenti interessati: {{richieste}}\n• giorni sul mercato: {{giorni_online}}\n\nPer qualsiasi domanda sono a sua disposizione.\n{{nome_agente}}, {{nome_agenzia}}", "email", "Come sta andando il suo immobile in {{indirizzo_immobile}}"),
  tpl("recensione", "Richiesta di recensione", "Ciao {{nome}}, grazie per averci scelto! Se ti sei trovato bene, ci aiuteresti con una breve recensione? {{link_recensioni}}"),
  tpl("compleanno", "Auguri di compleanno", "Tanti auguri di buon compleanno, {{nome}}! Un caro saluto da {{nome_agente}} e da tutta {{nome_agenzia}}."),
  tpl("festivita", "Auguri per le feste", "Ciao {{nome}}, {{nome_agenzia}} ti augura {{festivita}}!"),
  tpl("immobile_compatibile", "Immobile adatto al cliente", "Ciao {{nome}}, è appena entrato un immobile che potrebbe interessarti: {{indirizzo_immobile}}, {{prezzo_immobile}}. Vuoi vederlo? Rispondi qui e organizziamo la visita. {{nome_agente}}"),
];

type Base = Omit<Automation, "template" | "runsThisMonth" | "id"> & { id?: string };
const r = (x: Base, runs = 0): Automation => ({ ...x, id: x.id ?? `a_${x.recipe}`, runsThisMonth: runs });
const automations: Automation[] = [
  r({ recipe: "lead_benvenuto", name: "Rispondiamo subito ai nuovi contatti", description: "Quando arriva un contatto dal portale o dal sito, gli scriviamo subito su WhatsApp (il promemoria per richiamarlo lo trovi già tra le cose da fare).", active: true, trigger: "creazione", entity: "contact", conditions: { fonte: ["portale", "sito"] }, waitValue: 0, waitUnit: "minuti", waitDirection: "dopo", action: "whatsapp", recipient: "contatto", content: { template: "benvenuto" }, needsConsent: false }, 12),
  r({ recipe: "lead_non_richiamato", name: "Avvisiamo il titolare se un nuovo contatto non viene richiamato", description: "Se dopo 2 ore lavorative nessuno ha chiamato o scritto al nuovo contatto, il titolare riceve un avviso.", active: true, trigger: "nessuna_risposta", entity: "contact", conditions: { fonte: ["portale", "sito"] }, waitValue: 2, waitUnit: "ore_lavorative", waitDirection: "dopo", action: "notifica_interna", recipient: "titolare", content: { titolo: "Nuovo contatto non ancora richiamato: {{nome}} {{cognome}} (arrivato alle {{ora_creazione}})" }, needsConsent: false }, 2),
  r({ recipe: "promemoria_visita", name: "Ricordiamo la visita al cliente il giorno prima", description: "Il giorno prima di ogni visita mandiamo al cliente un promemoria su WhatsApp con data, ora e indirizzo.", active: true, trigger: "data_evento", entity: "appointment", conditions: { tipo: "visita" }, waitValue: 24, waitUnit: "ore", waitDirection: "prima", action: "whatsapp", recipient: "contatto", content: { template: "promemoria_visita" }, needsConsent: false }, 18),
  r({ recipe: "feedback_visita", name: "Il giorno dopo la visita chiediamo com'è andata", description: "Un giorno lavorativo dopo la visita mandiamo al cliente un breve questionario: le risposte finiscono nella scheda del cliente e dell'immobile.", active: true, trigger: "data_evento", entity: "appointment", conditions: { tipo: "visita" }, waitValue: 1, waitUnit: "giorni_lavorativi", waitDirection: "dopo", action: "whatsapp", recipient: "contatto", content: { template: "feedback_visita", questionario: true, task_aggiuntivo: "Chiedi a {{nome}} {{cognome}} com'è andata la visita in {{indirizzo_immobile}}" }, needsConsent: false }, 15),
  r({ recipe: "report_proprietario", name: "Ogni 15 giorni aggiorniamo il proprietario", description: "Per ogni immobile disponibile mandiamo al proprietario un'email con visite, acquirenti interessati e giorni sul mercato.", active: true, trigger: "periodico", entity: "property", conditions: { giorni: 15 }, waitValue: 15, waitUnit: "giorni", waitDirection: "dopo", action: "email", recipient: "proprietario", content: { template: "report_proprietario" }, needsConsent: false }, 7),
  r({ recipe: "immobile_fermo", name: "Ti avvisiamo se un immobile non riceve visite da 21 giorni", description: "Quando un immobile disponibile resta 21 giorni senza visite, l'agente riceve un promemoria per rivedere prezzo o foto.", active: true, trigger: "inattivita", entity: "property", conditions: { giorni: 21 }, waitValue: 21, waitUnit: "giorni", waitDirection: "dopo", action: "notifica_interna", recipient: "agente_assegnato", content: { titolo: "{{indirizzo_immobile}}: nessuna visita da 21 giorni. Valuta di rivedere prezzo o foto" }, needsConsent: false }, 1),
  r({ recipe: "incarico_scadenza", name: "Ti ricordiamo di rinnovare gli incarichi", description: "30 giorni prima della scadenza dell'incarico, l'agente trova tra le cose da fare \"Proponi il rinnovo\".", active: true, trigger: "data_campo", entity: "property", conditions: { campo: "scadenza_incarico" }, waitValue: 30, waitUnit: "giorni", waitDirection: "prima", action: "task", recipient: "agente_assegnato", content: { titolo: "Proponi il rinnovo dell'incarico di {{indirizzo_immobile}} (scade il {{data_scadenza}})" }, needsConsent: false }, 2),
  r({ recipe: "acquisizione_ferma", name: "Ti ricordiamo di seguire le valutazioni fatte", description: "Se un'acquisizione resta in \"Valutazione fatta\" per 3 giorni, l'agente trova un promemoria per proporre l'incarico.", active: true, trigger: "cambio_fase", entity: "acquisition", conditions: { fase: "valutazione_fatta" }, waitValue: 3, waitUnit: "giorni", waitDirection: "dopo", action: "task", recipient: "agente_assegnato", content: { titolo: "Segui {{indirizzo_immobile}}: valutazione fatta da 3 giorni, proponi l'incarico" }, needsConsent: false }, 1),
  r({ recipe: "documenti_rogito", name: "Ti ricordiamo i documenti prima della firma", description: "20 giorni prima di un appuntamento di firma, l'agente trova \"Controlla i documenti\".", active: true, trigger: "data_evento", entity: "appointment", conditions: { tipo: "firma" }, waitValue: 20, waitUnit: "giorni", waitDirection: "prima", action: "task", recipient: "agente_assegnato", content: { titolo: "Controlla i documenti per la firma del {{data_appuntamento}} ({{indirizzo_immobile}})" }, needsConsent: false }),
  r({ recipe: "dopo_rogito", name: "Dopo il rogito chiediamo una recensione", description: "Il giorno dopo il rogito ringraziamo il cliente e gli chiediamo una recensione su Google. Si attiva quando inserisci il link delle recensioni.", active: false, trigger: "cambio_fase", entity: "deal", conditions: { fase: "rogito" }, waitValue: 1, waitUnit: "giorni", waitDirection: "dopo", action: "whatsapp", recipient: "contatto", content: { template: "recensione" }, needsConsent: false }),
  r({ recipe: "compleanno", name: "Facciamo gli auguri di compleanno", description: "Il giorno del compleanno mandiamo gli auguri, solo ai contatti che hanno dato il consenso.", active: false, trigger: "data_campo", entity: "contact", conditions: { campo: "data_nascita" }, waitValue: 0, waitUnit: "giorni", waitDirection: "dopo", action: "whatsapp", recipient: "contatto", content: { template: "compleanno" }, needsConsent: true }),
  r({ recipe: "festivita_natale", name: "Facciamo gli auguri di Natale", description: "Il 23 dicembre mandiamo gli auguri, solo ai contatti che hanno dato il consenso.", active: false, trigger: "data_fissa", entity: "contact", conditions: { festa: "natale" }, waitValue: 0, waitUnit: "giorni", waitDirection: "dopo", action: "whatsapp", recipient: "contatto", content: { template: "festivita" }, needsConsent: true }),
  r({ recipe: "festivita_pasqua", name: "Facciamo gli auguri di Pasqua", description: "Il sabato prima di Pasqua mandiamo gli auguri, solo ai contatti che hanno dato il consenso.", active: false, trigger: "data_fissa", entity: "contact", conditions: { festa: "pasqua" }, waitValue: 0, waitUnit: "giorni", waitDirection: "dopo", action: "whatsapp", recipient: "contatto", content: { template: "festivita" }, needsConsent: true }),
  r({ recipe: "cliente_non_sentito", name: "Ti ricordiamo i clienti che non senti da 30 giorni", description: "Se un cliente che cerca casa non viene sentito da 30 giorni, l'agente trova \"Risentilo\" tra le cose da fare.", active: true, trigger: "inattivita", entity: "contact", conditions: { giorni: 30 }, waitValue: 30, waitUnit: "giorni", waitDirection: "dopo", action: "task", recipient: "agente_assegnato", content: { titolo: "Risenti {{nome}} {{cognome}}: nessun contatto da 30 giorni" }, needsConsent: false }, 4),
  r({ recipe: "immobili_compatibili", name: "Mandiamo al cliente gli immobili giusti per lui", description: "Quando entra un immobile compatibile con la sua richiesta, lo segnaliamo al cliente su WhatsApp. Spento all'inizio: l'agente riceve comunque il promemoria.", active: false, trigger: "creazione", entity: "match", conditions: {}, waitValue: 30, waitUnit: "minuti", waitDirection: "dopo", action: "whatsapp", recipient: "contatto", content: { template: "immobile_compatibile" }, needsConsent: false }),
];

const runs: AutomationRun[] = [
  { id: "r1", automationName: "Ricordiamo la visita al cliente il giorno prima", contactId: "c1", contactName: "Maria Rossi", runAt: ago(20), state: "eseguita", reason: null, channel: "whatsapp", text: "Ciao Maria, ti ricordo la visita di domani…", doneAt: ago(20) },
  { id: "r2", automationName: "Rispondiamo subito ai nuovi contatti", contactId: "c4", contactName: "Vito Carofiglio", runAt: ago(5), state: "eseguita", reason: null, channel: "whatsapp", text: "Ciao Vito, sono Giuseppe di Immobiliare Levante…", doneAt: ago(5) },
  { id: "r3", automationName: "Il giorno dopo la visita chiediamo com'è andata", contactId: "c2", contactName: "Luca Bianchi", runAt: ago(3), state: "eseguita", reason: "Modello WhatsApp non ancora approvato da Meta", channel: "task", text: "Scrivi a Luca Bianchi (347 …): Ciao Luca, grazie per aver visto…", doneAt: ago(3) },
  { id: "r4", automationName: "Ogni 15 giorni aggiorniamo il proprietario", contactId: "c7", contactName: "Nicola Ricci", runAt: ago(26), state: "eseguita", reason: null, channel: "email", text: "Gentile Nicola, ecco come sta andando…", doneAt: ago(26) },
  { id: "r5", automationName: "Ricordiamo la visita al cliente il giorno prima", contactId: "c3", contactName: "Anna Greco", runAt: new Date(Date.now() + 18 * 3600_000).toISOString(), state: "in_attesa", reason: null, channel: null, text: null, doneAt: null },
  { id: "r6", automationName: "Rispondiamo subito ai nuovi contatti", contactId: "c5", contactName: "Paolo Russo", runAt: ago(30), state: "saltata", reason: "Contatto escluso dai messaggi automatici", channel: null, text: null, doneAt: ago(30) },
];
const optOuts: OptOut[] = [{ id: "o1", contactId: "c5", contactName: "Paolo Russo", channel: "tutti", reason: "Escluso dall'agente", createdAt: ago(48) }];
let settings: MessagingSettings = { whatsappPhoneNumberId: "", replyEmail: "info@immobiliarelevante.it", reviewsLink: "" };

export async function listAutomations() {
  return wait(automations.map((a) => ({ ...a, template: a.content.template ? templates.find((t) => t.code === a.content.template) : undefined })));
}
export async function setAutomationActive(id: ID, active: boolean) {
  const a = automations.find((x) => x.id === id);
  if (a) a.active = active;
  emitChange();
}
export async function updateAutomation(a: Automation, patch: { waitValue: number; waitUnit: Automation["waitUnit"]; text?: string; subject?: string; title?: string }) {
  const x = automations.find((y) => y.id === a.id);
  if (x)
    Object.assign(x, {
      waitValue: patch.waitValue,
      waitUnit: patch.waitUnit,
      conditions: x.trigger === "periodico" || x.trigger === "inattivita" ? { ...x.conditions, giorni: patch.waitValue } : x.conditions,
      content: { ...x.content, ...(patch.title !== undefined ? { titolo: patch.title } : {}) },
    });
  const t = templates.find((y) => y.code === a.content.template);
  if (t) {
    if (patch.text !== undefined && patch.text !== t.text) Object.assign(t, { text: patch.text, waState: t.waState === "approvato" ? "bozza" : t.waState });
    if (patch.subject !== undefined) t.subject = patch.subject;
  }
  emitChange();
  return wait(undefined);
}
export async function createAutomation(n: NewAutomation) {
  const id = demoDb.newId("a");
  let content: Automation["content"] = { titolo: n.text };
  if (n.action === "whatsapp" || n.action === "email") {
    const code = `personale_${id}`;
    templates.push(tpl(code, n.name, n.text, n.action, n.subject ?? n.name));
    content = { template: code };
  }
  automations.push(r({ id, recipe: null, name: n.name, description: "", active: true, trigger: n.trigger, entity: n.entity, conditions: n.conditions, waitValue: n.waitValue, waitUnit: n.waitUnit, waitDirection: n.waitDirection, action: n.action, recipient: n.recipient, content, needsConsent: false }));
  emitChange();
  return wait(undefined);
}
export async function deleteAutomation(id: ID) {
  const i = automations.findIndex((a) => a.id === id);
  if (i >= 0) automations.splice(i, 1);
  emitChange();
}
export async function listRuns(state?: RunState) {
  return wait(runs.filter((x) => !state || x.state === state));
}
export async function listOptOuts() {
  return wait([...optOuts]);
}
export async function removeOptOut(id: ID) {
  const i = optOuts.findIndex((o) => o.id === id);
  if (i >= 0) optOuts.splice(i, 1);
  emitChange();
}
export async function isExcluded(contactId: ID) {
  return wait(optOuts.some((o) => o.contactId === contactId && o.channel === "tutti"), 80);
}
export async function setExcluded(contactId: ID, excluded: boolean) {
  const i = optOuts.findIndex((o) => o.contactId === contactId && o.channel === "tutti");
  if (excluded && i < 0) optOuts.unshift({ id: demoDb.newId("o"), contactId, contactName: demoDb.contacts().find((c) => c.id === contactId)?.firstName ?? "Contatto", channel: "tutti", reason: "Escluso dall'agente", createdAt: new Date().toISOString() });
  if (!excluded && i >= 0) optOuts.splice(i, 1);
  emitChange();
}
export async function getMessagingSettings() {
  return wait({ ...settings });
}
export async function saveMessagingSettings(s: MessagingSettings) {
  settings = { ...s };
  emitChange();
  return wait(undefined);
}
export async function syncTemplates(): Promise<number> {
  await wait(null, 500);
  throw new Error("Nell'anteprima WhatsApp non è collegato.");
}

export type QuestionnaireInfo = { agenzia: string; indirizzo: string | null; citta: string | null; nome: string | null; gia_compilato: boolean; scaduto: boolean };
export const getQuestionnaire = (_t: string) => wait<QuestionnaireInfo>({ agenzia: "Immobiliare Levante", indirizzo: "Via Roma 48", citta: "Bari", nome: "Maria", gia_compilato: false, scaduto: false });
export const sendQuestionnaire = (_t: string, _r: Record<string, unknown>) => wait({ ok: true }, 500);
export const unsubscribe = (_t: string) => wait({ ok: true, agenzia: "Immobiliare Levante" }, 400);
