import { azienda } from "@/contenuti";
import { PaginaLegale } from "./PaginaLegale";

export function Privacy() {
  return (
    <PaginaLegale titolo="Informativa privacy" aggiornata="[GG/MM/AAAA]">
      <p>
        Questa informativa descrive come trattiamo i dati personali raccolti tramite questo sito, ai sensi degli artt. 13 e 14
        del Regolamento (UE) 2016/679 (GDPR) e del D.Lgs. 196/2003 come modificato dal D.Lgs. 101/2018.
      </p>

      <h2>1. Titolare del trattamento</h2>
      <p>
        <strong>{azienda.ragioneSociale}</strong>, {azienda.indirizzo}, P.IVA {azienda.piva}. Email per richieste privacy:{" "}
        {azienda.emailPrivacy}. PEC: {azienda.pec}.
      </p>

      <h2>2. Dati trattati</h2>
      <ul>
        <li>
          <strong>Dati del modulo "Prenota la demo"</strong>: nome e cognome, concessionaria, città, telefono, numero di
          venditori, fascia di lead mensili, data del consenso.
        </li>
        <li>
          <strong>Dati tecnici</strong>: parametri della campagna di provenienza (utm), tipo di browser; log tecnici del server
          per la sicurezza.
        </li>
        <li>
          <strong>Dati di navigazione tramite cookie</strong>: solo con il tuo consenso, vedi la{" "}
          <a href="/cookie-policy">Cookie policy</a>.
        </li>
      </ul>

      <h2>3. Finalità e basi giuridiche</h2>
      <ul>
        <li>
          Ricontattarti per organizzare e svolgere la demo richiesta e fornirti informazioni commerciali sul servizio:
          esecuzione di misure precontrattuali su tua richiesta (art. 6.1.b GDPR) e consenso (art. 6.1.a).
        </li>
        <li>Sicurezza del sito e prevenzione di abusi: legittimo interesse del titolare (art. 6.1.f).</li>
        <li>Statistiche e misurazione delle campagne: solo con il tuo consenso (art. 6.1.a), revocabile in ogni momento.</li>
        <li>Adempimenti di legge: obbligo legale (art. 6.1.c).</li>
      </ul>

      <h2>4. Conservazione</h2>
      <p>
        I dati della richiesta di demo sono conservati per [24 mesi] dall'ultimo contatto, salvo che diventi cliente (in tal caso
        si applicano i termini del contratto) o che tu chieda prima la cancellazione. [SEGNAPOSTO: verificare i tempi]
      </p>

      <h2>5. Destinatari e trasferimenti</h2>
      <p>
        I dati sono trattati da personale autorizzato e da fornitori nominati responsabili del trattamento (art. 28 GDPR), tra
        cui il fornitore del database e dell'hosting (Supabase) e del servizio di invio email (Resend). [SEGNAPOSTO: indicare
        regione dei server e garanzie per eventuali trasferimenti extra UE, es. clausole contrattuali standard o Data Privacy
        Framework.] I dati non vengono venduti né diffusi.
      </p>

      <h2>6. I tuoi diritti</h2>
      <p>
        Puoi chiedere accesso, rettifica, cancellazione, limitazione, portabilità dei dati e opporti al trattamento (artt. 15-22
        GDPR), e revocare il consenso in qualsiasi momento senza pregiudicare la liceità del trattamento precedente, scrivendo a{" "}
        {azienda.emailPrivacy}. Puoi anche proporre reclamo al Garante per la protezione dei dati personali
        (www.garanteprivacy.it).
      </p>

      <h2>7. Natura del conferimento</h2>
      <p>
        I campi del modulo sono necessari per ricontattarti: senza di essi non possiamo organizzare la demo. Non effettuiamo
        processi decisionali automatizzati che producano effetti giuridici nei tuoi confronti.
      </p>
    </PaginaLegale>
  );
}
