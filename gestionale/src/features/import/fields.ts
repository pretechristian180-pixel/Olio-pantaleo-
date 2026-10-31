/** Campi di Mattonio per ogni tipo di importazione, con le parole che li fanno riconoscere nelle intestazioni */
export type ImportType = "contatti" | "richieste" | "immobili" | "acquisizioni" | "appuntamenti";

type Field = { key: string; label: string; words: string[]; required?: boolean };

export const importTypes: { id: ImportType; label: string; hint: string; order: number }[] = [
  { id: "contatti", label: "Contatti", hint: "Clienti, proprietari, collaboratori", order: 1 },
  { id: "richieste", label: "Richieste dei clienti", hint: "Cosa cercano: zona, budget, metri quadri", order: 2 },
  { id: "immobili", label: "Immobili", hint: "Il portafoglio, con prezzo e proprietario", order: 3 },
  { id: "acquisizioni", label: "Acquisizioni", hint: "Segnalazioni e valutazioni in corso", order: 4 },
  { id: "appuntamenti", label: "Appuntamenti", hint: "Visite, valutazioni e firme", order: 5 },
];

export const fields: Record<ImportType, Field[]> = {
  contatti: [
    { key: "nome_completo", label: "Nome e cognome insieme", words: ["nominativo", "nome e cognome", "nome cognome", "nome completo", "cliente", "contatto", "denominazione", "ragione sociale", "full name"] },
    { key: "cognome_nome", label: "Cognome e nome insieme", words: ["cognome e nome", "cognome nome"] },
    { key: "nome", label: "Nome", words: ["nome", "first name", "firstname", "name"], required: true },
    { key: "cognome", label: "Cognome", words: ["cognome", "surname", "last name", "lastname"] },
    { key: "telefono", label: "Telefono", words: ["telefono", "cellulare", "cell", "tel", "mobile", "recapito", "phone", "numero"] },
    { key: "email", label: "Email", words: ["email", "e mail", "mail", "posta"] },
    { key: "tipo", label: "Tipo (acquirente, proprietario…)", words: ["tipo cliente", "tipologia cliente", "categoria", "ruolo", "tipo"] },
    { key: "fonte", label: "Provenienza", words: ["provenienza", "fonte", "origine", "canale", "source"] },
    { key: "temperatura", label: "Interesse (caldo, tiepido, freddo)", words: ["temperatura", "interesse", "priorita"] },
    { key: "data_nascita", label: "Data di nascita", words: ["data di nascita", "nascita", "compleanno", "birthday"] },
    { key: "etichette", label: "Etichette", words: ["etichette", "tag", "gruppo", "gruppi"] },
    { key: "note", label: "Note", words: ["note", "commenti", "osservazioni", "annotazioni"] },
  ],
  richieste: [
    { key: "contatto_telefono", label: "Telefono del cliente", words: ["telefono", "cellulare", "cell", "tel", "recapito"] },
    { key: "contatto_email", label: "Email del cliente", words: ["email", "e mail", "mail"] },
    { key: "contatto_nome", label: "Nome del cliente", words: ["nominativo", "cliente", "nome", "contatto"] },
    { key: "contratto", label: "Compra o affitta", words: ["contratto", "vendita affitto", "tipo richiesta", "trattativa"] },
    { key: "zone", label: "Zone", words: ["zone", "zona", "quartiere", "quartieri", "localita", "comune", "citta"] },
    { key: "budget_max", label: "Budget massimo", words: ["budget massimo", "budget max", "prezzo massimo", "budget", "spesa massima", "prezzo"] },
    { key: "budget_min", label: "Budget minimo", words: ["budget minimo", "budget min", "prezzo minimo"] },
    { key: "mq_min", label: "Metri quadri minimi", words: ["mq minimi", "mq min", "superficie", "metri quadri", "mq"] },
    { key: "locali_min", label: "Locali minimi", words: ["locali", "vani", "camere", "stanze"] },
    { key: "tipo_immobile", label: "Tipologia", words: ["tipologia", "tipo immobile", "tipo"] },
    { key: "note", label: "Note", words: ["note", "esigenze", "commenti"] },
  ],
  immobili: [
    { key: "indirizzo", label: "Indirizzo", words: ["indirizzo", "via", "ubicazione", "address"], required: true },
    { key: "citta", label: "Città", words: ["citta", "comune", "localita", "city"], required: true },
    { key: "prezzo", label: "Prezzo", words: ["prezzo", "prezzo richiesto", "importo", "canone", "price"], required: true },
    { key: "zona", label: "Zona", words: ["zona", "quartiere", "frazione"] },
    { key: "titolo", label: "Titolo", words: ["titolo", "titolo annuncio"] },
    { key: "mq", label: "Metri quadri", words: ["mq", "metri quadri", "superficie", "metratura"] },
    { key: "locali", label: "Locali", words: ["locali", "vani", "n locali"] },
    { key: "bagni", label: "Bagni", words: ["bagni", "servizi"] },
    { key: "tipo_immobile", label: "Tipologia", words: ["tipologia", "tipo immobile", "categoria", "tipo"] },
    { key: "contratto", label: "Vendita o affitto", words: ["contratto", "vendita affitto", "causale"] },
    { key: "stato", label: "Stato", words: ["stato", "disponibilita"] },
    { key: "descrizione", label: "Descrizione", words: ["descrizione", "testo annuncio", "testo"] },
    { key: "piano", label: "Piano", words: ["piano"] },
    { key: "classe_energetica", label: "Classe energetica", words: ["classe energetica", "ape", "classe"] },
    { key: "data_incarico", label: "Inizio incarico", words: ["data incarico", "inizio incarico", "data mandato"] },
    { key: "scadenza_incarico", label: "Scadenza incarico", words: ["scadenza incarico", "scadenza mandato", "scadenza"] },
    { key: "proprietario_nome", label: "Nome del proprietario", words: ["proprietario", "venditore", "nominativo proprietario"] },
    { key: "proprietario_telefono", label: "Telefono del proprietario", words: ["telefono proprietario", "tel proprietario", "cell proprietario", "telefono"] },
    { key: "proprietario_email", label: "Email del proprietario", words: ["email proprietario", "mail proprietario", "email"] },
  ],
  acquisizioni: [
    { key: "indirizzo", label: "Indirizzo", words: ["indirizzo", "via", "ubicazione"], required: true },
    { key: "citta", label: "Città", words: ["citta", "comune", "localita"] },
    { key: "zona", label: "Zona", words: ["zona", "quartiere"] },
    { key: "tipo_immobile", label: "Tipologia", words: ["tipologia", "tipo"] },
    { key: "mq", label: "Metri quadri", words: ["mq", "metri quadri", "superficie"] },
    { key: "prezzo_richiesto", label: "Prezzo chiesto", words: ["prezzo richiesto", "richiesta", "prezzo"] },
    { key: "prezzo_valutato", label: "Nostra valutazione", words: ["valutazione", "prezzo valutato", "stima"] },
    { key: "fonte", label: "Come è arrivata", words: ["fonte", "provenienza", "origine"] },
    { key: "fase", label: "Fase", words: ["fase", "stato"] },
    { key: "proprietario_nome", label: "Nome del proprietario", words: ["proprietario", "nominativo", "nome"] },
    { key: "proprietario_telefono", label: "Telefono del proprietario", words: ["telefono", "cellulare", "tel"] },
    { key: "note", label: "Note", words: ["note", "commenti"] },
  ],
  appuntamenti: [
    { key: "data_ora", label: "Data e ora insieme", words: ["data e ora", "data ora", "quando"] },
    { key: "data", label: "Data", words: ["data", "giorno"], required: true },
    { key: "ora", label: "Ora", words: ["ora", "orario"] },
    { key: "durata_minuti", label: "Durata (minuti)", words: ["durata", "minuti"] },
    { key: "tipo", label: "Tipo", words: ["tipo", "tipologia", "motivo"] },
    { key: "contatto_nome", label: "Nome del cliente", words: ["cliente", "nominativo", "nome", "contatto"] },
    { key: "contatto_telefono", label: "Telefono del cliente", words: ["telefono", "cellulare", "tel"] },
    { key: "contatto_email", label: "Email del cliente", words: ["email", "mail"] },
    { key: "immobile_indirizzo", label: "Indirizzo dell'immobile", words: ["immobile", "indirizzo", "via"] },
    { key: "note", label: "Note", words: ["note", "commenti"] },
  ],
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Abbinamento automatico: prima le intestazioni identiche, poi quelle che contengono la parola */
export function autoMap(type: ImportType, headers: string[]): Record<string, string> {
  const out: Record<string, string> = Object.fromEntries(headers.map((h) => [h, ""]));
  const used = new Set<string>();
  const list = fields[type];
  for (const pass of ["esatto", "contiene"] as const) {
    for (const h of headers) {
      if (out[h]) continue;
      const nh = norm(h);
      if (!nh) continue;
      const hit = list.find(
        (f) => (f.key === "note" || !used.has(f.key)) && f.words.some((w) => (pass === "esatto" ? nh === w : nh.includes(w) && w.length >= 3)),
      );
      if (hit) {
        out[h] = hit.key;
        if (hit.key !== "note") used.add(hit.key);
      }
    }
  }
  return out;
}

export const fieldLabel = (type: ImportType, key: string) => fields[type].find((f) => f.key === key)?.label ?? key;
