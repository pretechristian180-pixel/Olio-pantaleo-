/**
 * Tipi delle righe del database (specchio di supabase/migrations).
 * Se si rigenera lo schema con `supabase gen types`, questi tipi restano compatibili.
 */

export type ID = string;
export type ISODate = string;

export type Ruolo = "titolare" | "responsabile_vendite" | "venditore" | "amministrazione";
export type TipoVeicolo = "nuovo" | "usato" | "km0";
export type StatoVeicolo = "disponibile" | "prenotato" | "venduto" | "in_preparazione";
export type Alimentazione = "benzina" | "diesel" | "gpl" | "metano" | "ibrida" | "ibrida_plugin" | "elettrica";
export type Cambio = "manuale" | "automatico";
export type FonteLead =
  | "autoscout24"
  | "subito"
  | "sito"
  | "facebook"
  | "instagram"
  | "telefono"
  | "salone"
  | "passaparola"
  | "altro";
export type StatoLead = "nuovo" | "contattato" | "qualificato" | "test_drive" | "preventivo" | "trattativa" | "vinto" | "perso";
export type Tempistica = "subito" | "entro_1_mese" | "entro_3_mesi" | "oltre" | "non_definita";
export type TipoAttivita = "chiamata" | "whatsapp" | "email" | "nota" | "test_drive" | "preventivo" | "cambio_stato";
export type TipoAppuntamento = "test_drive" | "consegna" | "valutazione_permuta" | "officina";
export type StatoAppuntamento = "programmato" | "completato" | "annullato" | "non_presentato";
export type StatoPreventivo = "bozza" | "inviato" | "accettato" | "rifiutato";
export type TipoDocumento = "carta_identita" | "patente" | "codice_fiscale" | "libretto" | "contratto" | "altro";
export type CanaleMessaggio = "whatsapp" | "email";
export type StatoVoce = "da_fare" | "in_corso" | "fatto";

export interface Organization {
  id: ID;
  nome: string;
  piva: string | null;
  indirizzo: string | null;
  comune: string | null;
  telefono: string | null;
  email: string | null;
  logo_url: string | null;
  marchi: string[];
  soglia_giacenza_giorni: number;
  tempo_max_risposta_min: number;
  round_robin_attivo: boolean;
  created_at: ISODate;
}

export interface Profile {
  user_id: ID;
  organization_id: ID;
  nome: string;
  email: string | null;
  ruolo: Ruolo;
  telefono: string | null;
  attivo: boolean;
  created_at: ISODate;
}

export interface Vehicle {
  id: ID;
  organization_id: ID;
  marca: string;
  modello: string;
  versione: string | null;
  anno: number | null;
  km: number;
  alimentazione: Alimentazione | null;
  cambio: Cambio | null;
  colore: string | null;
  targa: string | null;
  telaio: string | null;
  tipo: TipoVeicolo;
  prezzo_vendita: number | null;
  stato: StatoVeicolo;
  data_ingresso: string;
  data_uscita: string | null;
  descrizione: string | null;
  note_interne: string | null;
  created_at: ISODate;
  updated_at: ISODate;
}

/** Riga di vehicles_view: veicolo + dati calcolati. */
export interface VehicleView extends Vehicle {
  giorni_giacenza: number;
  oltre_soglia: boolean;
  soglia_giacenza_giorni: number;
  foto_copertina: string | null;
  lead_aperti: number;
}

export interface VehicleCost {
  vehicle_id: ID;
  organization_id: ID;
  prezzo_acquisto: number | null;
  updated_at: ISODate;
}

export interface VehiclePhoto {
  id: ID;
  organization_id: ID;
  vehicle_id: ID;
  storage_path: string;
  ordine: number;
  created_at: ISODate;
}

export interface VehiclePriceHistory {
  id: ID;
  vehicle_id: ID;
  prezzo_precedente: number | null;
  prezzo_nuovo: number | null;
  autore_id: ID | null;
  created_at: ISODate;
}

export interface Contact {
  id: ID;
  organization_id: ID;
  nome: string;
  cognome: string;
  telefono: string | null;
  email: string | null;
  comune: string | null;
  consenso_privacy: boolean;
  consenso_privacy_at: ISODate | null;
  consenso_marketing: boolean;
  consenso_marketing_at: ISODate | null;
  fonte: FonteLead | null;
  venditore_assegnato: ID | null;
  tag: string[];
  note: string | null;
  created_at: ISODate;
  updated_at: ISODate;
}

export interface PermutaDati {
  marca?: string;
  modello?: string;
  anno?: number | null;
  km?: number | null;
  note?: string;
}

export interface Lead {
  id: ID;
  organization_id: ID;
  contact_id: ID;
  vehicle_id: ID | null;
  fonte: FonteLead;
  stato: StatoLead;
  motivo_perso: string | null;
  richiesta: string | null;
  marca_interesse: string | null;
  modello_interesse: string | null;
  budget: number | null;
  permuta: boolean;
  permuta_dati: PermutaDati | null;
  finanziamento: boolean;
  tempistica: Tempistica;
  punteggio: number;
  assegnato_a: ID | null;
  creato_da: ID | null;
  primo_contatto_at: ISODate | null;
  ultimo_contatto_at: ISODate | null;
  prossima_azione_at: ISODate | null;
  prossima_azione_nota: string | null;
  chiuso_at: ISODate | null;
  created_at: ISODate;
  updated_at: ISODate;
}

/** Riga di leads_view: lead + contatto, auto, venditore e indicatori. */
export interface LeadView extends Lead {
  contatto_nome: string;
  contatto_cognome: string;
  contatto_telefono: string | null;
  contatto_email: string | null;
  veicolo_marca: string | null;
  veicolo_modello: string | null;
  veicolo_versione: string | null;
  veicolo_prezzo: number | null;
  assegnato_nome: string | null;
  in_ritardo: boolean;
  senza_prossima_azione: boolean;
  tempo_max_risposta_min: number;
}

export interface Activity {
  id: ID;
  organization_id: ID;
  lead_id: ID;
  tipo: TipoAttivita;
  contenuto: string;
  autore_id: ID | null;
  created_at: ISODate;
}

export interface Appointment {
  id: ID;
  organization_id: ID;
  tipo: TipoAppuntamento;
  lead_id: ID | null;
  contact_id: ID | null;
  vehicle_id: ID | null;
  assegnato_a: ID | null;
  inizio: ISODate;
  fine: ISODate;
  stato: StatoAppuntamento;
  note: string | null;
  created_at: ISODate;
}

export interface Quote {
  id: ID;
  organization_id: ID;
  lead_id: ID;
  vehicle_id: ID | null;
  prezzo: number;
  sconto: number;
  permuta_valutata: number;
  anticipo: number;
  finanziamento: boolean;
  durata_mesi: number | null;
  tan: number | null;
  rata: number | null;
  totale: number;
  saldo: number;
  stato: StatoPreventivo;
  pdf_path: string | null;
  note: string | null;
  creato_da: ID | null;
  created_at: ISODate;
}

export type ChecklistVoce =
  | "contratto"
  | "documenti_cliente"
  | "finanziamento_approvato"
  | "passaggio_proprieta"
  | "assicurazione"
  | "preparazione_auto"
  | "consegna";

export interface Deal {
  id: ID;
  organization_id: ID;
  lead_id: ID;
  vehicle_id: ID;
  contact_id: ID;
  venditore_id: ID | null;
  prezzo_finale: number;
  data_vendita: string;
  data_consegna: string | null;
  checklist: Record<ChecklistVoce, StatoVoce>;
  avanzamento: number;
  note: string | null;
  created_at: ISODate;
  updated_at: ISODate;
}

export interface Document {
  id: ID;
  organization_id: ID;
  contact_id: ID | null;
  deal_id: ID | null;
  tipo: TipoDocumento;
  nome_file: string;
  storage_path: string;
  dimensione_byte: number | null;
  caricato_da: ID | null;
  created_at: ISODate;
}

export interface Notification {
  id: ID;
  user_id: ID;
  tipo: string;
  titolo: string;
  testo: string | null;
  link: string | null;
  lead_id: ID | null;
  letta_at: ISODate | null;
  created_at: ISODate;
}

export interface Invitation {
  id: ID;
  email: string;
  nome: string;
  ruolo: Ruolo;
  accettato_at: ISODate | null;
  scade_at: ISODate;
  created_at: ISODate;
}

export interface MessageTemplate {
  id: ID;
  organization_id: ID;
  nome: string;
  canale: CanaleMessaggio;
  oggetto: string | null;
  testo: string;
  created_at: ISODate;
}

export interface AutomationLog {
  id: ID;
  tipo: string;
  entita: string;
  entita_id: ID | null;
  esito: "ok" | "saltato" | "errore";
  dettagli: Record<string, unknown> | null;
  created_at: ISODate;
}

export interface ClienteCompatibile {
  lead_id: ID;
  contatto: string;
  telefono: string | null;
  stato: StatoLead;
  budget: number | null;
  interesse: string | null;
  motivo_perso: string | null;
  motivo_match: string;
}

/** Risultato di report_periodo(). */
export interface ReportPeriodo {
  lead_ricevuti: number;
  lead_vinti: number;
  lead_persi: number;
  tasso_conversione: number;
  auto_vendute: number;
  fatturato: number;
  tempo_medio_risposta_min: number | null;
  giacenza_media_giorni: number | null;
  per_fonte: { fonte: FonteLead; lead: number; vinti: number; conversione: number }[];
  per_venditore: { venditore: string; lead: number; vinti: number; aperti: number; risposta_min: number | null }[];
  motivi_perso: { motivo: string; lead: number }[];
  per_mese: { mese: string; lead: number; vinti: number }[];
  vinti_nel_periodo: number;
}
