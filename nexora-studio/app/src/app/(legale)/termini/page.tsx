import type { Metadata } from "next";
import Link from "next/link";

import {
  COMPANY,
  CONTACT_EMAIL,
  LegalHeader,
  Section,
  VEXATIOUS_CLAUSES,
} from "@/components/legal/legal";

export const metadata: Metadata = { title: "Termini e condizioni di servizio" };

export default function TerminiPage() {
  return (
    <article className="grid gap-8">
      <LegalHeader title="Termini e condizioni di servizio" />

      <Section id="art-1" title="Art. 1 – Chi siamo e oggetto">
        <p>
          1.1 Questi Termini regolano l&apos;uso di Nexora Studio (la «Piattaforma»), servizio
          offerto da {COMPANY}, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>{" "}
          («Nexora»).
        </p>
        <p>
          1.2 La Piattaforma permette al Cliente di ricevere proposte di script per video, caricare
          riprese video, ottenere video montati con sistemi di intelligenza artificiale e
          programmarne la pubblicazione sui propri account social (il «Servizio»).
        </p>
      </Section>

      <Section id="art-2" title="Art. 2 – Clienti ammessi">
        <p>
          2.1 Il Servizio è riservato a imprese, professionisti ed enti che agiscono per scopi
          legati alla propria attività e sono titolari di partita IVA. Non è destinato ai
          consumatori.
        </p>
        <p>
          2.2 Chi si registra per conto di un&apos;organizzazione dichiara di avere il potere di
          vincolarla a questi Termini.
        </p>
      </Section>

      <Section id="art-3" title="Art. 3 – Conclusione del contratto e account">
        <p>
          3.1 Il contratto si conclude quando il Cliente completa la registrazione e accetta questi
          Termini e, per i piani a pagamento, quando completa il primo pagamento.
        </p>
        <p>
          3.2 Il Cliente custodisce le credenziali di accesso ed è responsabile delle attività
          svolte dagli utenti che invita nel proprio spazio di lavoro.
        </p>
        <p>
          3.3 I dati forniti in fase di registrazione e fatturazione devono essere veritieri e
          aggiornati.
        </p>
      </Section>

      <Section id="art-4" title="Art. 4 – Piani, prova gratuita e limiti">
        <p>
          4.1 I piani disponibili, i prezzi e i limiti (numero di video al mese, account social
          collegabili, crediti per contenuti generati con AI, brand gestibili) sono indicati nella
          pagina <Link href="/#prezzi">Prezzi</Link> al momento della sottoscrizione.
        </p>
        <p>
          4.2 La prova gratuita comprende 3 video montati, senza obbligo di acquisto. Al termine,
          l&apos;uso del Servizio richiede la sottoscrizione di un piano.
        </p>
        <p>
          4.3 I limiti mensili si azzerano a ogni rinnovo. I video e i crediti non utilizzati non si
          accumulano e non sono rimborsabili.
        </p>
        <p>
          4.4 Per ogni video sono incluse fino a 2 richieste di modifica. Ulteriori modifiche
          consumano un video del piano.
        </p>
      </Section>

      <Section id="art-5" title="Art. 5 – Prezzi, pagamenti e rinnovo">
        <p>
          5.1 I prezzi sono in euro, IVA esclusa. Il pagamento avviene in anticipo, con addebito
          mensile o annuale tramite il fornitore di pagamenti indicato al checkout.
        </p>
        <p>
          5.2 L&apos;abbonamento si rinnova automaticamente per un periodo uguale a quello scelto,
          salvo disdetta.
        </p>
        <p>
          5.3 Nexora può modificare i prezzi con un preavviso di almeno 30 giorni via email. La
          modifica vale dal primo rinnovo successivo; il Cliente che non la accetta può disdire
          prima di quella data. Per i clienti con condizione «founding member» il prezzo resta
          bloccato finché l&apos;abbonamento resta attivo senza interruzioni.
        </p>
        <p>
          5.4 Se un pagamento non va a buon fine, Nexora può sospendere la creazione di nuovi video
          dopo 2 giorni, senza cancellare i dati del Cliente.
        </p>
        <p>
          5.5 Le fatture sono emesse elettronicamente sulla base dei dati fiscali forniti dal
          Cliente.
        </p>
      </Section>

      <Section id="art-6" title="Art. 6 – Disdetta e durata">
        <p>
          6.1 Il Cliente può disdire in ogni momento dall&apos;area Piano e fatturazione. La
          disdetta ha effetto alla fine del periodo già pagato; non sono previsti rimborsi per
          periodi parziali.
        </p>
        <p>
          6.2 Nexora può recedere con un preavviso di 30 giorni, rimborsando la quota pagata e non
          goduta.
        </p>
        <p>
          6.3 Nexora può sospendere o chiudere l&apos;account senza preavviso in caso di grave
          violazione dell&apos;Art. 8 o di mancato pagamento protratto oltre 30 giorni.
        </p>
        <p>
          6.4 Alla cessazione, il Cliente ha 30 giorni per scaricare i propri video. Trascorso
          questo periodo i contenuti vengono cancellati, salvo obblighi di legge.
        </p>
      </Section>

      <Section id="art-7" title="Art. 7 – Obblighi del Cliente sui contenuti">
        <p>
          7.1 Il Cliente è l&apos;unico responsabile dei contenuti che carica e che sceglie di
          pubblicare, compresi testi, riprese, loghi, marchi e musica propria.
        </p>
        <p>
          7.2 Il Cliente garantisce di avere tutti i diritti necessari sui contenuti caricati e, in
          particolare, il consenso scritto delle persone riconoscibili nei video (dipendenti,
          clienti, collaboratori) all&apos;uso della loro immagine e voce per finalità promozionali.
          Per i minori serve il consenso di chi esercita la responsabilità genitoriale.
        </p>
        <p>
          7.3 Il Cliente rispetta le condizioni d&apos;uso delle piattaforme social su cui pubblica
          e le norme su pubblicità, concorrenza e tutela del consumatore che si applicano alla
          propria comunicazione.
        </p>
        <p>
          7.4 Il Cliente verifica ogni video prima di approvarlo. Nessun contenuto viene pubblicato
          senza l&apos;approvazione del Cliente; con l&apos;approvazione il Cliente ne assume la
          responsabilità.
        </p>
      </Section>

      <Section id="art-8" title="Art. 8 – Usi vietati">
        <p>
          È vietato usare la Piattaforma per creare o pubblicare contenuti illeciti, diffamatori,
          discriminatori, ingannevoli o che violino diritti di terzi; per creare contenuti che
          imitano persone reali senza il loro consenso; per pubblicità ingannevole; per contenuti
          sessualmente espliciti; per aggirare i limiti tecnici o i sistemi di sicurezza della
          Piattaforma; per rivendere il Servizio senza un accordo scritto con Nexora.
        </p>
      </Section>

      <Section id="art-9" title="Art. 9 – Intelligenza artificiale e contenuti generati">
        <p>
          9.1 Il montaggio, i testi, le didascalie e alcune immagini e clip («b-roll AI») sono
          prodotti con sistemi di intelligenza artificiale. Possono contenere errori o imprecisioni
          e vanno verificati dal Cliente prima dell&apos;approvazione.
        </p>
        <p>
          9.2 Nexora marca i contenuti audio e video generati con l&apos;AI in modo leggibile dalle
          macchine, come previsto dall&apos;art. 50 del Regolamento (UE) 2024/1689 («AI Act»).
        </p>
        <p>
          9.3 Se il Cliente pubblica contenuti generati o manipolati con l&apos;AI che rappresentano
          in modo realistico persone, luoghi o eventi («deepfake»), è tenuto a dichiararlo nel
          contenuto pubblicato, secondo lo stesso art. 50.
        </p>
        <p>
          9.4 Nexora non usa i contenuti del Cliente per addestrare modelli di intelligenza
          artificiale, e sceglie fornitori di AI che non li usano per questo scopo.
        </p>
      </Section>

      <Section id="art-10" title="Art. 10 – Proprietà intellettuale">
        <p>
          10.1 Il Cliente resta titolare dei contenuti che carica. Concede a Nexora una licenza non
          esclusiva, limitata alla durata del contratto, per elaborarli al solo fine di erogare il
          Servizio.
        </p>
        <p>
          10.2 I video finiti appartengono al Cliente, che può usarli liberamente anche dopo la fine
          del contratto. Le musiche e gli elementi di repertorio forniti dalla Piattaforma sono
          concessi in uso per la pubblicazione sui social del Cliente, secondo le licenze dei
          rispettivi fornitori; non possono essere estratti e usati separatamente.
        </p>
        <p>
          10.3 La Piattaforma, il software, il marchio Nexora Studio e i modelli di montaggio
          restano di proprietà di Nexora.
        </p>
        <p>
          10.4 Salvo diniego scritto del Cliente, Nexora può citare il nome e il logo del Cliente
          tra le aziende che usano la Piattaforma. L&apos;uso dei video del Cliente come esempi
          richiede il suo consenso specifico.
        </p>
      </Section>

      <Section id="art-11" title="Art. 11 – Servizi di terzi e social network">
        <p>
          11.1 La pubblicazione dipende dalle piattaforme social e dai fornitori tecnici collegati.
          Nexora non risponde di modifiche, limitazioni, sospensioni o blocchi decisi da questi
          soggetti, compresa la sospensione degli account del Cliente.
        </p>
        <p>
          11.2 Nexora non garantisce risultati in termini di visualizzazioni, follower, contatti o
          vendite.
        </p>
      </Section>

      <Section id="art-12" title="Art. 12 – Disponibilità del Servizio">
        <p>
          Nexora si impegna a mantenere la Piattaforma disponibile con continuità, ma possono
          verificarsi interruzioni per manutenzione, aggiornamenti o cause non dipendenti da Nexora.
          Le manutenzioni programmate sono comunicate quando possibile con almeno 48 ore di
          anticipo. Se un post programmato non viene pubblicato per un errore, la Piattaforma avvisa
          il Cliente.
        </p>
      </Section>

      <Section id="art-13" title="Art. 13 – Limitazione di responsabilità">
        <p>
          13.1 Nei limiti consentiti dalla legge, la responsabilità complessiva di Nexora verso il
          Cliente non supera gli importi pagati dal Cliente nei 12 mesi precedenti l&apos;evento.
        </p>
        <p>
          13.2 Nexora non risponde di danni indiretti, mancati guadagni, perdita di opportunità
          commerciali o di dati non scaricati dal Cliente.
        </p>
        <p>13.3 Queste limitazioni non valgono in caso di dolo o colpa grave (art. 1229 c.c.).</p>
      </Section>

      <Section id="art-14" title="Art. 14 – Manleva">
        <p>
          Il Cliente tiene indenne Nexora da richieste di terzi derivanti dai contenuti caricati o
          pubblicati dal Cliente, dalla violazione dell&apos;Art. 7 o dell&apos;Art. 8, compresa la
          mancanza del consenso delle persone riprese.
        </p>
      </Section>

      <Section id="art-15" title="Art. 15 – Dati personali">
        <p>
          Il trattamento dei dati personali è descritto nell&apos;
          <Link href="/privacy">Informativa privacy</Link>. Per i dati personali contenuti nei video
          del Cliente, Nexora agisce come responsabile del trattamento secondo l&apos;
          <Link href="/trattamento-dati">Accordo sul trattamento dei dati</Link>, che fa parte di
          questi Termini.
        </p>
      </Section>

      <Section id="art-16" title="Art. 16 – Modifiche ai Termini">
        <p>
          Nexora può modificare questi Termini con un preavviso di almeno 30 giorni via email. Se il
          Cliente non accetta le modifiche, può disdire prima che entrino in vigore. Le modifiche
          imposte dalla legge si applicano dalla data prevista dalla legge.
        </p>
      </Section>

      <Section id="art-17" title="Art. 17 – Legge applicabile e foro">
        <p>
          Questi Termini sono regolati dalla legge italiana. Per ogni controversia è competente in
          via esclusiva il Foro di Taranto.
        </p>
      </Section>

      <Section id="approvazione-specifica" title="Approvazione specifica (artt. 1341 e 1342 c.c.)">
        <p>Il Cliente dichiara di aver letto e di approvare specificamente: {VEXATIOUS_CLAUSES}.</p>
      </Section>
    </article>
  );
}
