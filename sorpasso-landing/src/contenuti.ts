/**
 * CONTENUTI DELLA LANDING — modifica qui testi, prezzi e dati aziendali.
 *
 * Tutto ciò che è marcato [SEGNAPOSTO] va sostituito con dati reali prima della
 * pubblicazione. Non pubblicare numeri di risultati non verificati: i valori del
 * caso pilota e la testimonianza sono esempi da rimpiazzare.
 */

export const azienda = {
  // Dati del titolare del sito e del trattamento dati (footer, Privacy, Cookie policy)
  ragioneSociale: "Nexora Gruppo Digitale S.r.l. [SEGNAPOSTO]",
  piva: "IT 00000000000 [SEGNAPOSTO]",
  indirizzo: "Via Esempio 1, 00000 Città (XX) [SEGNAPOSTO]",
  email: "info@esempio.it [SEGNAPOSTO]",
  emailPrivacy: "privacy@esempio.it [SEGNAPOSTO]",
  telefono: "+39 000 000 0000 [SEGNAPOSTO]",
  pec: "esempio@pec.it [SEGNAPOSTO]",
  rea: "REA XX-000000 [SEGNAPOSTO]",
  capitaleSociale: "Capitale sociale € 10.000 i.v. [SEGNAPOSTO]",
};

export const hero = {
  occhiello: "Il gestionale con AI per concessionarie auto",
  titolo: "Quante auto hai perso questo mese perché nessuno ha risposto in tempo?",
  sottotitolo:
    "Sorpasso AI risponde ai tuoi lead in 60 secondi, li segue fino al test drive e ti dice ogni mattina cosa fare per vendere.",
  cta: "Prenota la demo gratuita",
  rassicurazioni: ["Demo di 20 minuti", "Sulla tua concessionaria", "Nessun impegno"],
};

export const problemi = {
  titolo: "Ti suona familiare?",
  sottotitolo: "Sono le situazioni che i titolari ci raccontano ogni settimana. Ognuna costa auto vendute.",
  card: [
    {
      titolo: "Lead sparsi ovunque",
      testo: "Richieste da AutoScout24, Subito, Facebook, telefono e salone. Metà finisce su un post-it o nel telefono di un venditore.",
    },
    {
      titolo: "Clienti richiamati dopo ore. O mai",
      testo: "Chi chiede un'auto la sera ha già scritto ad altri tre saloni. Il primo che risponde porta il cliente in test drive.",
    },
    {
      titolo: "Auto ferme in piazzale da mesi",
      testo: "Ogni giorno di giacenza erode il margine. Ma nessuno ti avvisa quale auto va spinta o riprezzata, e a chi proporla.",
    },
    {
      titolo: "Nessun numero chiaro",
      testo: "Quale venditore chiude? Quale portale porta clienti veri? Quanto ti costa ogni auto venduta? Oggi lo sai a sensazione.",
    },
  ],
};

export const calcolatore = {
  titolo: "Quanto ti costa non rispondere subito?",
  sottotitolo: "Inserisci i tuoi numeri. Il calcolo resta sul tuo telefono, non lo salviamo.",
  valoriIniziali: { leadMese: 120, conversione: 6, margineMedio: 1800 },
  // Ipotesi del calcolo: conversione attuale aumentata del 20% (es. dal 6% al 7,2%)
  aumentoConversione: 0.2,
  nota:
    "Ipotesi: +20% sul tuo tasso di conversione grazie a risposta immediata e follow-up costanti (es. dal 6% al 7,2%). È una stima, non una promessa: in demo la rifacciamo con i tuoi dati reali.",
};

export const passaggi = {
  titolo: "Come funziona",
  sottotitolo: "Tre passaggi, dal primo messaggio del cliente al test drive in agenda.",
  elenco: [
    {
      titolo: "Tutti i lead in un unico posto",
      testo: "Portali, sito, social, telefono e salone arrivano nello stesso elenco, già assegnati al venditore giusto.",
    },
    {
      titolo: "L'AI risponde e fissa il test drive",
      testo: "In 60 secondi il cliente riceve una risposta su WhatsApp, con i dati veri dell'auto. Se serve, passa la parola al venditore.",
    },
    {
      titolo: "Tu vedi tutto in una dashboard",
      testo: "Ogni mattina: chi richiamare, quali test drive ci sono, quali auto sono ferme da troppo. E come stanno andando i numeri.",
    },
  ],
};

export const funzionalita = {
  titolo: "Cosa cambia in concessionaria",
  sottotitolo: "Niente funzioni per il gusto di averle: ognuna serve a vendere un'auto in più o a guadagnarci di più.",
  elenco: [
    { titolo: "Lead centralizzati", beneficio: "Nessuna richiesta persa: ogni cliente ha un venditore e una prossima azione con data." },
    { titolo: "Agente WhatsApp AI h24", beneficio: "Rispondi anche alle 22 di domenica, quando i clienti cercano l'auto. E fissi il test drive mentre dormi." },
    { titolo: "Follow-up automatici", beneficio: "I clienti tiepidi vengono ricontattati al momento giusto, senza che il venditore se lo debba ricordare." },
    { titolo: "Stock con alert giacenza", beneficio: "Sai quali auto stanno perdendo margine e a quali clienti proporle prima di ribassare." },
    { titolo: "Pratiche e documenti", beneficio: "Contratto, finanziamento, passaggio, consegna: vedi a che punto è ogni vendita senza telefonate interne." },
    { titolo: "Post-vendita e recensioni", beneficio: "Clienti soddisfatti che lasciano recensioni e tornano per la prossima auto. O mandano un amico." },
    { titolo: "Report settimanale per il titolare", beneficio: "Ogni lunedì: lead, vendite, margini, venditori e portali. Decidi su numeri, non su impressioni." },
  ],
};

export const perChi = {
  titolo: "Per chi è",
  elenco: [
    { titolo: "Concessionarie monomarca", testo: "Gestisci lead della casa madre e del tuo marketing nello stesso posto, accanto al DMS che già usi." },
    { titolo: "Concessionarie multimarca", testo: "Più brand, più fonti, più venditori: una sola regia su lead, stock e risultati per marchio." },
    { titolo: "Rivenditori di usato", testo: "Stock che gira più veloce, margine sotto controllo auto per auto e risposte immediate dai portali." },
  ],
};

export const provaSociale = {
  titolo: "Il primo caso pilota",
  // [SEGNAPOSTO] Sostituire con testimonianza e numeri reali e verificati
  testimonianza: {
    citazione:
      "«[SEGNAPOSTO] Qui va la frase del titolare del caso pilota, con le sue parole: cosa è cambiato in concessionaria dopo i primi mesi.»",
    nome: "Nome Cognome [SEGNAPOSTO]",
    ruolo: "Titolare, Concessionaria Esempio — Città [SEGNAPOSTO]",
    // URL di un video (YouTube/Vimeo embed o file mp4). Se vuoto mostra il riquadro segnaposto.
    videoUrl: "",
  },
  numeri: [
    { valore: "[XX]%", etichetta: "lead contattati entro 5 minuti [SEGNAPOSTO]" },
    { valore: "+[XX]", etichetta: "test drive in più al mese [SEGNAPOSTO]" },
    { valore: "-[XX] gg", etichetta: "giacenza media dello stock [SEGNAPOSTO]" },
  ],
};

export const pacchetti = {
  titolo: "Pacchetti",
  sottotitolo: "Prezzi chiari, senza sorprese. Scegli in base a quanti lead e venditori hai.",
  // [SEGNAPOSTO] Prezzi da definire
  elenco: [
    {
      nome: "Start",
      prezzo: "€ [XXX]",
      periodo: "/mese + IVA",
      perChi: "Per rivenditori e piccoli saloni",
      voci: ["Lead centralizzati da tutte le fonti", "Dashboard \"Oggi\"", "Stock con alert giacenza", "Fino a 3 utenti"],
      evidenziato: false,
    },
    {
      nome: "Pro",
      prezzo: "€ [XXX]",
      periodo: "/mese + IVA",
      perChi: "Per concessionarie con più venditori",
      voci: [
        "Tutto di Start",
        "Follow-up automatici",
        "Pratiche e documenti",
        "Report settimanale per il titolare",
        "Fino a 10 utenti",
      ],
      evidenziato: true,
    },
    {
      nome: "Dealer AI",
      prezzo: "€ [XXX]",
      periodo: "/mese + IVA",
      perChi: "Per gruppi e concessionarie ad alto volume",
      voci: ["Tutto di Pro", "Agente WhatsApp AI h24", "Post-vendita e recensioni", "Più sedi", "Utenti illimitati"],
      evidenziato: false,
    },
  ],
  nota: "Configurazione e formazione incluse",
  notaDettaglio: "Importiamo stock e contatti, configuriamo le fonti dei lead e formiamo il tuo team in salone o a distanza.",
};

export const faq = {
  titolo: "Le domande che ci fanno tutti",
  elenco: [
    {
      domanda: "I miei venditori non lo useranno",
      risposta:
        "È la preoccupazione più comune, ed è giusta. Per questo Sorpasso AI si usa dal telefono, in piazzale, con pochi tocchi: il venditore apre l'app e trova solo cosa deve fare adesso. La formazione è inclusa e nelle prime settimane affianchiamo il team. E tu vedi subito chi lo usa e chi no.",
    },
    {
      domanda: "Ho già il DMS della casa madre",
      risposta:
        "Il DMS gestisce ordini, magazzino e contabilità; Sorpasso AI lavora prima, sul cliente: lead, risposte, test drive e follow-up. Non sostituisce il DMS, lo affianca. Dove possibile importiamo ed esportiamo i dati, così non devi inserire due volte la stessa cosa.",
    },
    {
      domanda: "L'AI risponde male ai clienti?",
      risposta:
        "L'AI usa solo i dati veri dell'auto e della tua concessionaria: niente prezzi o promesse inventate. Puoi decidere tu tono e regole, e quando la domanda è delicata (trattativa sul prezzo, permuta, reclamo) passa la conversazione al venditore. Ogni messaggio resta nello storico del cliente.",
    },
    {
      domanda: "Quanto tempo serve per partire?",
      risposta:
        "In genere pochi giorni: importiamo stock e contatti, colleghiamo le fonti dei lead e facciamo la formazione. Il tempo esatto dipende da quante fonti e sedi hai: te lo diciamo in demo, con un piano preciso.",
    },
    {
      domanda: "I dati sono miei?",
      risposta:
        "Sì. Clienti, lead, storico e numeri appartengono alla tua concessionaria: puoi esportarli quando vuoi e restano all'azienda anche se un venditore se ne va. Ogni concessionaria vede solo i propri dati e ogni venditore solo i suoi clienti.",
    },
  ],
};

export const ctaFinale = {
  titolo: "Vediamo insieme quante auto in più puoi vendere",
  sottotitolo:
    "Una demo di 20 minuti, sui numeri della tua concessionaria. Ti mostriamo come rispondere a ogni lead in 60 secondi e cosa cambierebbe nel tuo mese.",
  pulsante: "Prenota la demo gratuita",
  successoTitolo: "Richiesta ricevuta, grazie!",
  successoTesto: "Ti chiamiamo entro un giorno lavorativo per fissare la demo nell'orario che preferisci.",
};

export const FASCE_LEAD = ["Meno di 50", "50–150", "150–400", "Più di 400"] as const;
