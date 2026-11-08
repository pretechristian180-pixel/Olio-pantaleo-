import type { Metadata } from "next";
import Link from "next/link";

import { LegalHeader, LegalTable, Section } from "@/components/legal/legal";

export const metadata: Metadata = { title: "Accordo sul trattamento dei dati" };

const OBLIGATIONS = [
  "trattare i dati solo secondo le istruzioni documentate del Titolare, che coincidono con l'uso della Piattaforma e con questi Termini;",
  "far trattare i dati solo a persone autorizzate e vincolate alla riservatezza;",
  "adottare le misure di sicurezza dell'art. 32 GDPR descritte nell'Allegato A;",
  "assistere il Titolare nel rispondere alle richieste degli interessati e negli adempimenti degli artt. 32-36 GDPR;",
  "comunicare al Titolare una violazione dei dati senza ingiustificato ritardo, e comunque entro 48 ore da quando ne viene a conoscenza;",
  "alla fine del contratto, cancellare i dati dopo i 30 giorni per il download, salvo obblighi di legge;",
  "mettere a disposizione le informazioni necessarie a dimostrare il rispetto di questo accordo e consentire verifiche, con preavviso di almeno 30 giorni e a spese del Titolare;",
  "informare il Titolare se ritiene che un'istruzione violi la normativa.",
];

const MEASURES = [
  "Cifratura dei dati in transito (TLS) e a riposo",
  "Separazione logica dei dati tra clienti con regole di accesso a livello di database",
  "Accesso ai file solo tramite link firmati con scadenza",
  "Autenticazione sicura e accessi del personale limitati per ruolo e registrati",
  "Backup periodici e procedura di ripristino",
  "Cancellazione automatica del girato alla scadenza del periodo di conservazione",
  "Valutazione dei fornitori e contratti con clausole di protezione dei dati",
  "Procedura interna per la gestione delle violazioni dei dati",
];

export default function TrattamentoDatiPage() {
  return (
    <article className="grid gap-8">
      <LegalHeader
        title="Accordo sul trattamento dei dati (DPA)"
        subtitle="Ai sensi dell'art. 28 del GDPR. Parte integrante dei Termini e condizioni di Christian Prete Studio."
      />

      <Section id="parti" title="1. Parti e ruoli">
        <p>
          L&apos;azienda cliente («Titolare») nomina CPECOMGROUP di Prete Christian, P.IVA
          IT03436340735 («Responsabile») responsabile del trattamento dei dati personali contenuti
          nei materiali che carica sulla Piattaforma. L&apos;accordo si accetta insieme ai{" "}
          <Link href="/termini">Termini</Link> e dura quanto il contratto.
        </p>
      </Section>

      <Section id="oggetto" title="2. Oggetto del trattamento">
        <LegalTable
          head={["Elemento", "Contenuto"]}
          rows={[
            [
              "Finalità",
              "Montaggio di video, trascrizione, generazione di didascalie, archiviazione e pubblicazione sui social del Titolare",
            ],
            [
              "Categorie di interessati",
              "Persone che compaiono nei video o la cui voce è registrata: titolari, dipendenti, collaboratori, clienti del Titolare",
            ],
            [
              "Tipi di dati",
              "Immagine, voce, nome se citato, altre informazioni dette o mostrate nei video",
            ],
            [
              "Dati particolari (art. 9)",
              "Non previsti. Il Titolare evita di caricare video da cui emergono dati sanitari, religiosi, politici o simili",
            ],
            [
              "Durata",
              "Girato originale: 90 giorni dal caricamento; video finiti: durata del contratto + 30 giorni",
            ],
          ]}
        />
      </Section>

      <Section id="obblighi-responsabile" title="3. Obblighi del Responsabile">
        <p>Il Responsabile si impegna a:</p>
        <ol className="grid list-decimal gap-1.5 pl-5">
          {OBLIGATIONS.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ol>
      </Section>

      <Section id="sub-responsabili" title="4. Sub-responsabili">
        <p>
          Il Titolare autorizza in via generale il Responsabile a ricorrere ai fornitori elencati
          nell&apos;
          <Link href="/privacy#destinatari">Informativa privacy</Link>. Il Responsabile vincola
          ciascun fornitore agli stessi obblighi di questo accordo e comunica via email con almeno
          15 giorni di anticipo l&apos;aggiunta o la sostituzione di un fornitore. Il Titolare può
          opporsi per motivi fondati; se non si trova una soluzione, può recedere senza penali.
        </p>
      </Section>

      <Section id="trasferimenti" title="5. Trasferimenti extra UE">
        <p>
          I trasferimenti fuori dallo Spazio economico europeo avvengono solo con le garanzie degli
          artt. 45-46 GDPR (decisione di adeguatezza, incluso il Data Privacy Framework UE-USA, o
          Clausole contrattuali tipo).
        </p>
      </Section>

      <Section id="obblighi-titolare" title="6. Obblighi del Titolare">
        <p>
          Il Titolare garantisce di avere una base giuridica valida per il trattamento, di aver
          informato gli interessati e di aver raccolto il loro consenso all&apos;uso
          dell&apos;immagine e della voce per finalità promozionali, conservandone la prova. Il
          Titolare valuta inoltre i contenuti da pubblicare e ne risponde.
        </p>
      </Section>

      <Section id="responsabilita" title="7. Responsabilità">
        <p>
          Ogni parte risponde dei danni causati dalla propria violazione di questo accordo o del
          GDPR, secondo l&apos;art. 82 GDPR e nei limiti previsti dai Termini, salvo dolo o colpa
          grave.
        </p>
      </Section>

      <Section id="allegato-a" title="Allegato A – Misure di sicurezza">
        <ul className="grid list-disc gap-1.5 pl-5">
          {MEASURES.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </Section>
    </article>
  );
}
