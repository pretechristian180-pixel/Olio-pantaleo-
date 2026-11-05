import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage, V } from "@/components/legal/legal-page";
import { getCurrentTenant, isPlatformHost } from "@/lib/tenant";
import { SUBPROCESSORS, TERMINI_VERSIONE } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Accordo sul trattamento dei dati",
  alternates: { canonical: "/dpa" },
};

/** Nomina a responsabile del trattamento (art. 28 GDPR) tra Cliente e Nexora. */
export default async function DpaPage() {
  if (!(await isPlatformHost())) notFound();
  const l = (await getCurrentTenant())?.legal;
  if (!l) notFound();
  return (
    <LegalPage title="Accordo sul trattamento dei dati (art. 28 GDPR)" updated={TERMINI_VERSIONE}>
      <p>
        Questo accordo fa parte delle Condizioni del servizio. Il Cliente, titolare del trattamento
        dei dati dei propri studenti, nomina <V v={l.ragione_sociale} label="ragione sociale" />{" "}
        (P.IVA <V v={l.piva} label="P.IVA" />, «Nexora») responsabile del trattamento per i soli
        fini del servizio Nexora Academy.
      </p>

      <h2>1. Oggetto e durata</h2>
      <p>
        Nexora tratta i dati per fornire la piattaforma: account degli studenti, accesso ai corsi,
        avanzamento, note, domande, attestati, pagamenti e invio delle email di servizio. Il
        trattamento dura quanto il contratto.
      </p>

      <h2>2. Dati e interessati</h2>
      <ul>
        <li>Interessati: studenti, docenti e collaboratori del Cliente.</li>
        <li>
          Dati: nome, cognome, email, dati di accesso, avanzamento e attività sui corsi, domande e
          note, ordini (importo, corso, esito; i dati della carta li tratta solo Stripe), attestati.
        </li>
        <li>Non sono previste categorie particolari di dati (art. 9 GDPR).</li>
      </ul>

      <h2>3. Obblighi di Nexora</h2>
      <ul>
        <li>
          Tratta i dati solo su istruzione documentata del Cliente, cioè secondo queste condizioni e
          l&apos;uso della piattaforma.
        </li>
        <li>Garantisce che chi accede ai dati sia vincolato alla riservatezza.</li>
        <li>
          Adotta misure di sicurezza adeguate (art. 32): connessioni cifrate (HTTPS), dati cifrati a
          riposo presso i fornitori, accesso ai dati separato per academy con regole a livello di
          database, video protetti da link firmati a scadenza, chiavi e segreti solo lato server,
          backup del database.
        </li>
        <li>
          Assiste il Cliente nel rispondere alle richieste degli interessati (accesso, rettifica,
          cancellazione, portabilità).
        </li>
        <li>
          Informa il Cliente senza ingiustificato ritardo, e comunque entro 48 ore dalla scoperta,
          di una violazione dei dati personali che lo riguarda.
        </li>
        <li>
          Alla fine del contratto, su richiesta, restituisce i dati in formato leggibile e poi li
          cancella entro 90 giorni, salvo obblighi di legge.
        </li>
        <li>
          Mette a disposizione le informazioni necessarie a dimostrare il rispetto di questo
          accordo.
        </li>
      </ul>

      <h2>4. Sub-responsabili</h2>
      <p>
        Il Cliente autorizza Nexora ad avvalersi dei fornitori qui sotto. Nexora comunica via email
        eventuali nuovi fornitori con 30 giorni di anticipo; il Cliente può opporsi disdicendo il
        servizio. Per i trasferimenti fuori dall&apos;UE si applicano le clausole contrattuali
        standard della Commissione europea o il Data Privacy Framework.
      </p>
      <table>
        <thead>
          <tr>
            <th>Fornitore</th>
            <th>Servizio</th>
            <th>Luogo</th>
          </tr>
        </thead>
        <tbody>
          {SUBPROCESSORS.map((s) => (
            <tr key={s.nome}>
              <td>{s.nome}</td>
              <td>{s.servizio}</td>
              <td>{s.luogo}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>5. Obblighi del Cliente</h2>
      <p>
        Il Cliente fornisce ai propri studenti l&apos;informativa privacy (la piattaforma ne propone
        un modello nella pagina «Privacy» della sua academy), raccoglie i consensi quando necessari
        e tratta i dati nel rispetto della legge.
      </p>

      <h2>6. Contatti</h2>
      <p>
        Per questioni sul trattamento dei dati: <V v={l.email} label="email" /> · PEC{" "}
        <V v={l.pec} label="PEC" />.
      </p>
    </LegalPage>
  );
}
