/**
 * Interfaccia VehicleDecoder: dato targa o telaio restituisce i dati tecnici dell'auto.
 * Per aggiungere un provider (es. un servizio a pagamento di dati veicolo):
 *   1. crea un file in questa cartella che esporta un oggetto VehicleDecoder;
 *   2. registralo in ./index.ts;
 *   3. mettine le credenziali nei secrets di Supabase (mai nel database o nel client);
 *   4. il titolare lo sceglie in Impostazioni → Soglie e automazioni.
 */
export interface RichiestaDecodifica {
  targa?: string;
  telaio?: string;
}

/** Tutti i campi sono facoltativi: il form compila solo quelli restituiti. */
export interface DatiDecodificati {
  marca?: string;
  modello?: string;
  versione?: string;
  allestimento?: string;
  carrozzeria?: string;
  porte?: number;
  posti?: number;
  anno?: number;
  mese_immatricolazione?: number;
  alimentazione?: "benzina" | "diesel" | "gpl" | "metano" | "ibrida" | "ibrida_plugin" | "elettrica";
  cilindrata?: number;
  potenza_kw?: number;
  cambio?: "manuale" | "automatico";
  trazione?: "anteriore" | "posteriore" | "integrale";
  classe_euro?: string;
  consumo_misto?: number;
  emissioni_co2?: number;
  colore?: string;
  telaio?: string;
  targa?: string;
}

export interface VehicleDecoder {
  /** Identificativo salvato in organizations.decoder_provider */
  id: string;
  /** Nome mostrato nelle impostazioni */
  nome: string;
  descrizione: string;
  supportaTarga: boolean;
  supportaTelaio: boolean;
  /** true se il provider ha le credenziali necessarie nei secrets */
  configurato: () => boolean;
  decodifica: (r: RichiestaDecodifica) => Promise<DatiDecodificati | null>;
}
