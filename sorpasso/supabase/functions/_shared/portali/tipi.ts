/**
 * Interfaccia comune dei connettori ai portali.
 * Ogni connettore vive nella sua Edge Function (portale-feed, portale-manuale, portale-autoscout24, portale-subito…)
 * e implementa le stesse operazioni. La coda (sync-portali) li chiama e applica l'esito al database.
 */

export type Operazione = "publish" | "update" | "suspend" | "remove" | "stats";
export type StatoAnnuncio = "bozza" | "in_pubblicazione" | "pubblicato" | "errore" | "sospeso" | "rimosso";

/** Dati dell'auto pronti per un portale (nessun dato interno: costi, difetti, note, telaio solo se richiesto). */
export interface AnnuncioVeicolo {
  listing_id: string;
  vehicle_id: string;
  portal_id: string;
  riferimento: string;
  /** Annuncio già presente sul portale (id assegnato dal portale) */
  id_esterno: string | null;
  url_esterno: string | null;
  titolo: string;
  /** Descrizione completa con in fondo "Rif. SA-XXXXXX" (serve a collegare i lead all'auto) */
  descrizione: string;
  descrizione_breve: string | null;
  /** Prezzo per questo portale (prezzo specifico o listino), IVA inclusa */
  prezzo: number;
  prenotata: boolean;
  /** URL stabili delle foto (la prima è la copertina), già limitate al massimo del portale */
  foto: string[];
  url_scheda: string | null;
  veicolo: {
    marca: string;
    modello: string;
    versione: string | null;
    allestimento: string | null;
    carrozzeria: string | null;
    porte: number | null;
    posti: number | null;
    anno: number | null;
    mese_immatricolazione: number | null;
    km: number;
    alimentazione: string | null;
    cilindrata: number | null;
    potenza_kw: number | null;
    cambio: string | null;
    trazione: string | null;
    classe_euro: string | null;
    consumo_misto: number | null;
    emissioni_co2: number | null;
    colore: string | null;
    colore_interni: string | null;
    numero_proprietari: number | null;
    tagliandi_certificati: boolean;
    tipo: string;
    garanzia_mesi: number | null;
    garanzia_tipo: string | null;
    neopatentati: boolean;
    optional: string[];
    regime_iva: string;
    targa: string | null;
    telaio: string | null;
  };
  salone: {
    nome: string;
    telefono: string | null;
    whatsapp: string | null;
    email: string | null;
    indirizzo: string | null;
    comune: string | null;
  };
}

/** Esito di un'operazione riuscita: i campi presenti aggiornano vehicle_listings. */
export interface EsitoOperazione {
  stato?: StatoAnnuncio;
  id_esterno?: string;
  url?: string;
  /** Modalità manuale: cosa deve fare l'utente (null = niente) */
  azione_manuale?: "pubblica" | "aggiorna" | "sospendi" | "rimuovi" | null;
  visualizzazioni?: number;
  contatti?: number;
}

export interface ContestoConnettore {
  organization_id: string;
  /** Credenziali decifrate da Vault (formato deciso dal connettore, di solito JSON) */
  credenziali: string | null;
  /** Opzioni non segrete di organization_portals.config */
  config: Record<string, unknown>;
}

export interface Connettore {
  id: string;
  nome: string;
  /** Per i connettori API: true se le chiamate reali sono attive (flag nei secrets) */
  apiAttiva?: () => boolean;
  publish(ctx: ContestoConnettore, a: AnnuncioVeicolo): Promise<EsitoOperazione>;
  update(ctx: ContestoConnettore, a: AnnuncioVeicolo): Promise<EsitoOperazione>;
  /** Auto prenotata: sospende l'annuncio o mostra il badge, se il portale lo permette */
  suspend(ctx: ContestoConnettore, a: AnnuncioVeicolo): Promise<EsitoOperazione>;
  remove(ctx: ContestoConnettore, a: AnnuncioVeicolo): Promise<EsitoOperazione>;
  getStats(ctx: ContestoConnettore, a: AnnuncioVeicolo): Promise<EsitoOperazione>;
}

/**
 * Errore con messaggio in italiano per l'utente.
 * definitivo = inutile riprovare (es. credenziali errate, integrazione non attiva, dati rifiutati).
 */
export class ErrorePortale extends Error {
  constructor(messaggio: string, public definitivo = false) {
    super(messaggio);
  }
}

/** Traduce una risposta HTTP di un portale in un ErrorePortale comprensibile. */
export async function erroreDaRisposta(portale: string, res: Response): Promise<ErrorePortale> {
  const dettaglio = await res.text().catch(() => "");
  const breve = dettaglio.replace(/\s+/g, " ").slice(0, 160);
  switch (true) {
    case res.status === 400 || res.status === 422:
      return new ErrorePortale(`${portale} ha rifiutato i dati dell'annuncio${breve ? `: ${breve}` : ""}. Controlla la scheda dell'auto.`, true);
    case res.status === 401 || res.status === 403:
      return new ErrorePortale(`Credenziali di ${portale} non valide o scadute. Aggiornale in Impostazioni → Portali.`, true);
    case res.status === 404:
      return new ErrorePortale(`L'annuncio non esiste più su ${portale}.`, true);
    case res.status === 409:
      return new ErrorePortale(`${portale} segnala un annuncio duplicato per questa auto.`, true);
    case res.status === 429:
      return new ErrorePortale(`${portale} ha limitato le richieste: riproviamo tra qualche minuto.`);
    case res.status >= 500:
      return new ErrorePortale(`${portale} al momento non risponde (errore ${res.status}): riproviamo in automatico.`);
    default:
      return new ErrorePortale(`Risposta inattesa da ${portale} (codice ${res.status}).`);
  }
}
