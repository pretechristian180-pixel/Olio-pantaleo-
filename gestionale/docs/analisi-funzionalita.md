# Analisi: richieste dall'esperienza in agenzia e cosa ha Mattonio

Legenda: ✅ già presente · 🟡 in parte · 🆕 aggiunto ora (tranche "Schede complete") · 📅 previsto in una fase successiva · ⚠️ con limiti legali o tecnici

## 1. Contatti e CRM
- ✅ Acquirenti, proprietari, storico chiamate/WhatsApp/appuntamenti, temperatura, provenienza
- 🆕 Nuovi ruoli: locatore, inquilino, collaboratore, altro
- 🆕 Etichette libere con filtro (es. investitore, prima casa, cliente passato), compleanno, consenso alle comunicazioni (con data)
- 🆕 Modifica del contatto (prima si poteva solo creare)
- 🆕 Documenti per ogni contatto
- 🆕 Più richieste per lo stesso cliente
- 📅 Email registrate in automatico nello storico (con la Fase Automazioni)

## 2. Richieste e incrocio con gli immobili
- ✅ Matching automatico con percentuale e motivi, promemoria quando entra un immobile compatibile, proposta su WhatsApp con un tocco
- 🆕 Caratteristiche desiderate (balcone, box, ascensore…) nel punteggio; più richieste per cliente; richieste in pausa
- 📅 Invio automatico al cliente degli immobili compatibili (Automazioni, con consenso)

## 3. Immobili e portali
- ✅ Scheda, foto, prezzo, stato, incarico con scadenza
- 🆕 Stato "Sospeso", caratteristiche, modifica della scheda, "Vedi sulla mappa" e "Portami lì" (Google Maps)
- 🆕 Archivio documenti e planimetrie per immobile
- ✅ Immobili in acquisizione (pipeline Acquisizioni)
- 📅 Esportazione verso Immobiliare.it, Idealista, Casa.it ⚠️ serve l'accordo/abilitazione del gestionale presso ogni portale (feed XML ufficiali)

## 4. Automazioni WhatsApp ed email
- 📅 Già pianificate (Fase Automazioni): conferme e promemoria appuntamenti, follow-up dopo visita, clienti non sentiti da X giorni, compleanni, ricette pronte e attive
- 📅 Da aggiungere alle ricette: auguri per le festività (solo con consenso), "clienti non sentiti da 30 giorni", questionario dopo visita che compila la scheda visita
- ⚠️ WhatsApp solo con l'API ufficiale (Cloud API) e modelli approvati da Meta

## 5. Lead
- 📅 Nuova fase "Lead": casella unica dei lead, ingresso automatico da modulo del sito, Facebook/Instagram Lead Ads (webhook ufficiale Meta) e email dei portali, assegnazione automatica agli agenti, punteggio di qualità, risposta automatica e allarme se nessuno risponde

## 6. Report ai proprietari
- 🟡 Dati già raccolti: visite, trattative, giorni online, e ora le impressioni dei visitatori con offerte e criticità
- 📅 Report PDF professionale ogni 15 giorni, con invio automatico ⚠️ le visualizzazioni sui portali solo dove il portale le fornisce

## 7. Report acquirenti dopo le visite
- 🆕 Scheda "Com'è andata la visita?": come vuole procedere, piaciuto, non piaciuto, giudizio sul prezzo, offerta, criticità, altri immobili, voto. Finisce nella cronologia del cliente, nella scheda immobile ("Cosa dicono i visitatori") e, se vuole fare una proposta, crea la cosa da fare
- 📅 Questionario WhatsApp automatico che compila la stessa scheda

## 8. Documenti e adempimenti
- 🆕 Archivio documenti per contatto, immobile e trattativa, con scadenze
- 🆕 Checklist documentale dell'immobile già pronta (11 voci, adattata a vendita/affitto e tipo), personalizzabile, con "Carica il file" che spunta la voce
- 🆕 Checklist antiriciclaggio per trattativa (adeguata verifica), con chi l'ha fatta e quando, e note
- 🆕 In OGGI: "Documenti da sistemare" (obbligatori mancanti e documenti in scadenza)
- ✅ Scadenza incarichi; 📅 promemoria automatici su proposte, preliminari e rogiti (Automazioni)

## 9. AI per l'acquisizione di nuovi immobili
- ✅ Pipeline Acquisizioni; ✅ video di presentazione con avatar (Studio)
- 📅 "Opportunità": incolli il link o il testo di un annuncio di un privato → l'AI estrae i dati, crea l'acquisizione e prepara il messaggio di presentazione; brochure PDF dell'agenzia
- ⚠️ Non faremo la lettura automatica dei portali (scraping): è vietata dalle condizioni d'uso dei portali e i dati dei privati sono tutelati dal GDPR. Alternative lecite: avvisi email dei portali inoltrati a Mattonio, aste giudiziarie pubbliche (Portale Vendite Pubbliche), segnalazioni
- ⚠️ Successioni: niente individuazione massiva di eredi; solo fonti pubbliche e lecite, da valutare con un legale

## 10. Assistente AI
- 📅 Nuova fase "Assistente": domande in linguaggio naturale sui propri dati (chi richiamare oggi, incarichi fermi, immobili con poche richieste, report da inviare, documenti mancanti, lead migliori) e scrittura di messaggi, descrizioni, annunci e report. Vede solo i dati che l'utente può vedere

## 11. Attività e collaboratori
- ✅ Cose da fare con promemoria, agenda, appuntamenti
- 📅 Stati delle attività (da iniziare, in corso, fatte, in ritardo), assegnazione ai colleghi, calendario condiviso, cruscotto di produttività per il titolare

## 12. Marketing
- ✅ Video social con avatar (Studio), 📅 pubblicazione automatica sui social (Studio fase 3)
- 📅 Testi AI per post e annunci, segmenti di contatti (etichette ✅), campagne verso gruppi di acquirenti (solo con consenso ✅), richiesta recensioni dopo il rogito (ricetta Automazioni), banca dati clienti passati (etichette ✅)

## Ordine proposto delle prossime fasi
1. Automazioni (già pianificata) + questionario visita + festività + immobili compatibili in automatico
2. Importazione guidata (già pianificata)
3. Lead: casella unica, ingresso automatico, assegnazione, punteggio
4. Report proprietari PDF ogni 15 giorni
5. Assistente AI e testi AI
6. Attività e squadra (stati, assegnazioni, cruscotto)
7. Opportunità di acquisizione con AI (fonti lecite) e brochure
8. Portali immobiliari (dopo gli accordi con i portali)
