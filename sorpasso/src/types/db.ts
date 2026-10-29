/**
 * Tipi delle righe del database (specchio di supabase/migrations).
 * Se si rigenera lo schema con `supabase gen types`, questi tipi restano compatibili.
 */

export type ID = string;
export type ISODate = string;

export type Ruolo = "titolare" | "responsabile_vendite" | "venditore" | "amministrazione";
export type TipoVeicolo = "nuovo" | "usato" | "km0" | "aziendale";
export type RegimeIva = "ordinario" | "margine";
export type Trazione = "anteriore" | "posteriore" | "integrale";
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
export type TipoDocumento =
  | "carta_identita"
  | "patente"
  | "codice_fiscale"
  | "libretto"
  | "contratto"
  | "certificato_proprieta"
  | "perizia"
  | "altro";
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
  whatsapp: string | null;
  /** Costo di giacenza al giorno (denaro immobilizzato, piazzale…) */
  costo_giacenza_giorno: number;
  margine_obiettivo_pct: number;
  /** Provider VehicleDecoder: "nessuno" | "vin_base" | "http" */
  decoder_provider: string;
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
  allestimento: string | null;
  carrozzeria: string | null;
  porte: number | null;
  posti: number | null;
  mese_immatricolazione: number | null;
  cilindrata: number | null;
  potenza_kw: number | null;
  trazione: Trazione | null;
  classe_euro: string | null;
  consumo_misto: number | null;
  emissioni_co2: number | null;
  colore_interni: string | null;
  numero_proprietari: number | null;
  tagliandi_certificati: boolean;
  garanzia_mesi: number | null;
  garanzia_tipo: string | null;
  neopatentati: boolean;
  optional: string[];
  optional_extra: string | null;
  /** Difetti o danni noti: interno, non va in annunci né pagina pubblica */
  difetti: string | null;
  /** Versione breve per social e WhatsApp */
  descrizione_breve: string | null;
  regime_iva: RegimeIva;
  /** Sconto massimo che il venditore può concedere (visibile a tutti) */
  sconto_max: number | null;
  /** Pagina pubblica attiva */
  pubblica: boolean;
  token_pubblico: string;
  created_at: ISODate;
  updated_at: ISODate;
}

/** Riga di vehicles_view: veicolo + dati calcolati. */
export interface VehicleView extends Vehicle {
  giorni_giacenza: number;
  oltre_soglia: boolean;
  soglia_giacenza_giorni: number;
  foto_copertina: string | null;
  numero_foto: number;
  lead_aperti: number;
}

export type TipoVoceEconomica = "costo" | "ricavo";

export interface CategoriaEconomica {
  id: ID;
  organization_id: ID;
  tipo: TipoVoceEconomica;
  nome: string;
  ordine: number;
  /** "Acquisto" e "Prezzo di vendita": usate nei calcoli, non modificabili */
  di_sistema: boolean;
  attiva: boolean;
}

/** Voce di costo di un'auto. `importo` è l'imponibile (netto IVA). */
export interface VehicleCost {
  id: ID;
  organization_id: ID;
  vehicle_id: ID;
  data: string;
  categoria: string;
  descrizione: string | null;
  fornitore: string | null;
  importo: number;
  iva_aliquota: number;
  importo_iva: number;
  importo_lordo: number;
  allegato_path: string | null;
  creato_da: ID | null;
  created_at: ISODate;
}

/** Voce di ricavo. `importo` è quanto paga il cliente (IVA compresa se dovuta). */
export interface VehicleRevenue {
  id: ID;
  organization_id: ID;
  vehicle_id: ID;
  data: string;
  categoria: string;
  descrizione: string | null;
  importo: number;
  iva_aliquota: number;
  deal_id: ID | null;
  creato_da: ID | null;
  created_at: ISODate;
}

/** Riga di vehicle_economics: conto economico calcolato nel database (vedi migrazione 20261030100000). */
export interface VehicleEconomics {
  vehicle_id: ID;
  organization_id: ID;
  marca: string;
  modello: string;
  versione: string | null;
  targa: string | null;
  tipo: TipoVeicolo;
  stato: StatoVeicolo;
  regime_iva: RegimeIva;
  prezzo_listino: number | null;
  sconto_max: number | null;
  data_ingresso: string;
  data_uscita: string | null;
  giorni_stock: number;
  costo_giacenza_giorno: number;
  margine_obiettivo_pct: number;
  deal_id: ID | null;
  data_vendita: string | null;
  venditore_id: ID | null;
  venditore_nome: string | null;
  costi_netti: number;
  costi_iva: number;
  costi_lordi: number;
  /** Netti in regime ordinario, lordi nel regime del margine */
  costi_effettivi: number;
  costo_acquisto: number;
  vendita_registrata: number | null;
  aliquota_vendita: number;
  altri_ricavi_lordi: number;
  altri_ricavi_netti: number;
  venduta: boolean;
  /** Prezzo di vendita registrato o, se non venduta, prezzo di listino */
  prezzo_riferimento: number | null;
  costo_giacenza: number;
  iva_vendita: number | null;
  ricavo_vendita_netto: number | null;
  margine: number | null;
  margine_pct: number | null;
  margine_dopo_giacenza: number | null;
  /** Prezzo al cliente sotto il quale l'auto va in perdita (giacenza inclusa) */
  prezzo_minimo: number | null;
  /** Prezzo al cliente per raggiungere il margine obiettivo */
  prezzo_obiettivo: number | null;
  semaforo: "verde" | "giallo" | "rosso" | null;
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
  vehicle_id: ID | null;
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
