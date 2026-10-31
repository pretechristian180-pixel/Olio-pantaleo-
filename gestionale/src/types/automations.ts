/** Automazioni: "quando succede X, aspetta Y, fai Z" (vedi supabase/migrations/*_automazioni_*.sql) */
import type { ID } from "./domain";

export type TriggerKind = "creazione" | "cambio_fase" | "data_evento" | "data_campo" | "nessuna_risposta" | "inattivita" | "periodico" | "data_fissa";
export type TriggerEntity = "contact" | "property" | "deal" | "acquisition" | "appointment" | "match";
export type WaitUnit = "minuti" | "ore" | "ore_lavorative" | "giorni" | "giorni_lavorativi";
export type ActionKind = "whatsapp" | "email" | "task" | "evento_agenda" | "notifica_interna" | "cambio_temperatura";
export type Recipient = "contatto" | "proprietario" | "agente_assegnato" | "titolare";
export type TemplateState = "bozza" | "in_revisione" | "approvato" | "rifiutato";
export type RunState = "in_attesa" | "eseguita" | "annullata" | "fallita" | "saltata";

export interface MessageTemplate {
  id: ID;
  code: string;
  name: string;
  channel: "whatsapp" | "email";
  subject: string | null;
  text: string;
  waName: string | null;
  waState: TemplateState;
}

export interface Automation {
  id: ID;
  name: string;
  description: string;
  active: boolean;
  recipe: string | null;
  trigger: TriggerKind;
  entity: TriggerEntity;
  conditions: Record<string, unknown>;
  waitValue: number;
  waitUnit: WaitUnit;
  waitDirection: "dopo" | "prima";
  action: ActionKind;
  recipient: Recipient;
  content: { template?: string; titolo?: string; task_aggiuntivo?: string; questionario?: boolean; temperatura?: string };
  needsConsent: boolean;
  runsThisMonth: number;
  template?: MessageTemplate;
}

export interface AutomationRun {
  id: ID;
  automationName: string;
  contactId: ID | null;
  contactName: string | null;
  runAt: string;
  state: RunState;
  reason: string | null;
  channel: string | null;
  text: string | null;
  doneAt: string | null;
}

export interface OptOut {
  id: ID;
  contactId: ID;
  contactName: string;
  channel: "whatsapp" | "email" | "tutti";
  reason: string | null;
  createdAt: string;
}

export interface MessagingSettings {
  whatsappPhoneNumberId: string;
  replyEmail: string;
  reviewsLink: string;
}

/** Nuova automazione dal percorso Quando → Aspetta → Fai */
export interface NewAutomation {
  name: string;
  trigger: TriggerKind;
  entity: TriggerEntity;
  conditions: Record<string, unknown>;
  waitValue: number;
  waitUnit: WaitUnit;
  waitDirection: "dopo" | "prima";
  action: ActionKind;
  recipient: Recipient;
  text: string;
  subject?: string;
}
