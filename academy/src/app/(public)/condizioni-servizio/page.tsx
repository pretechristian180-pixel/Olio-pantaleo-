import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LegalPage, V } from "@/components/legal/legal-page";
import { getCurrentTenant, isPlatformHost } from "@/lib/tenant";
import { TERMINI_VERSIONE } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Condizioni del servizio",
  alternates: { canonical: "/condizioni-servizio" },
};

/** Contratto tra Nexora e le aziende che usano la piattaforma (B2B). */
export default async function TermsPage() {
  if (!(await isPlatformHost())) notFound();
  const t = await getCurrentTenant();
  const l = t?.legal;
  if (!l) notFound();
  return (
    <LegalPage title="Condizioni del servizio Nexora Academy" updated={TERMINI_VERSIONE}>
      <p>
        Queste condizioni regolano l&apos;uso di Nexora Academy da parte delle aziende e dei
        professionisti che creano la propria academy («Cliente»). Il servizio è fornito da{" "}
        <V v={l.ragione_sociale} label="ragione sociale" />, P.IVA <V v={l.piva} label="P.IVA" />,
        sede <V v={l.sede} label="sede" />, PEC <V v={l.pec} label="PEC" /> («Nexora»). Il servizio
        è riservato a chi agisce per scopi professionali: non si applica la disciplina a tutela dei
        consumatori.
      </p>

      <h2>1. Il servizio</h2>
      <p>
        Nexora mette a disposizione una piattaforma per pubblicare e vendere videocorsi: academy con
        indirizzo dedicato e marchio del Cliente, caricamento e protezione dei video, area studenti,
        avanzamento, domande, attestati, landing di vendita con l&apos;intelligenza artificiale e
        collegamento al conto Stripe del Cliente. Le funzioni e i limiti dipendono dal piano scelto,
        descritti nella pagina{" "}
        <Link href="/prezzi" className="text-nexora-blue underline">
          Prezzi
        </Link>
        .
      </p>

      <h2>2. Prova gratuita, abbonamento e rinnovo</h2>
      <ul>
        <li>La prova gratuita dura 14 giorni, salvo diverso accordo, e non richiede pagamento.</li>
        <li>
          Dopo la prova l&apos;abbonamento è mensile o annuale, si paga in anticipo con carta
          tramite Stripe e si rinnova automaticamente alla scadenza. I prezzi sono IVA esclusa.
        </li>
        <li>
          Il Cliente può disdire in qualsiasi momento dal pannello: l&apos;abbonamento resta attivo
          fino alla fine del periodo già pagato e non è previsto rimborso dei periodi parziali.
        </li>
        <li>
          Nexora può modificare i prezzi con almeno 30 giorni di preavviso via email; la modifica
          vale dal rinnovo successivo e il Cliente può disdire prima che si applichi.
        </li>
      </ul>

      <h2>3. Mancato pagamento e sospensione</h2>
      <p>
        Se un pagamento non va a buon fine Stripe ritenta l&apos;addebito e l&apos;academy resta
        visibile. Se il pagamento non viene regolarizzato entro 14 giorni Nexora può sospendere
        l&apos;academy, che non sarà più visibile agli studenti. I dati restano conservati per 90
        giorni dalla sospensione o dalla disdetta, poi vengono cancellati, salvo gli obblighi di
        legge.
      </p>

      <h2>4. Vendite del Cliente ai propri studenti</h2>
      <p>
        Il Cliente vende i propri corsi tramite il proprio conto Stripe: gli incassi arrivano
        direttamente al Cliente e <strong>Nexora non trattiene commissioni</strong>; restano a
        carico del Cliente le commissioni di Stripe. Il Cliente è il venditore verso i propri
        studenti ed è l&apos;unico responsabile di prezzi, fatture, IVA, diritto di recesso,
        assistenza e rapporti con gli studenti. Il rapporto tra il Cliente e Stripe è regolato dalle
        condizioni di Stripe.
      </p>

      <h2>5. Contenuti</h2>
      <ul>
        <li>
          Video, materiali e testi caricati restano di proprietà del Cliente, che concede a Nexora
          solo i diritti necessari a ospitarli e mostrarli agli studenti.
        </li>
        <li>
          Il Cliente garantisce di avere i diritti sui contenuti e che non sono illeciti, offensivi
          o lesivi di diritti di terzi, e tiene indenne Nexora da contestazioni al riguardo.
        </li>
        <li>
          I testi generati con l&apos;intelligenza artificiale sono proposte: il Cliente li verifica
          prima di pubblicarli e ne è responsabile.
        </li>
        <li>
          Nexora può rimuovere o sospendere contenuti manifestamente illeciti o segnalati dalle
          autorità.
        </li>
      </ul>

      <h2>6. Dati personali</h2>
      <p>
        Per i dati dei propri studenti il Cliente è titolare del trattamento e Nexora è responsabile
        del trattamento ai sensi dell&apos;art. 28 GDPR, secondo l&apos;
        <Link href="/dpa" className="text-nexora-blue underline">
          Accordo sul trattamento dei dati
        </Link>{" "}
        che è parte integrante di queste condizioni. Per i dati del Cliente come utente della
        piattaforma vale l&apos;
        <Link href="/privacy" className="text-nexora-blue underline">
          informativa privacy
        </Link>
        .
      </p>

      <h2>7. Disponibilità del servizio e assistenza</h2>
      <p>
        Nexora si impegna a mantenere il servizio disponibile con la diligenza professionale, usando
        fornitori di primo livello (hosting, database, video). Possono verificarsi interruzioni per
        manutenzione o cause esterne: Nexora le limita e, quando possibile, le comunica in anticipo.
        L&apos;assistenza si richiede a <V v={l.email} label="email" />.
      </p>

      <h2>8. Responsabilità</h2>
      <p>
        Salvo dolo o colpa grave, la responsabilità di Nexora verso il Cliente è limitata
        all&apos;importo pagato dal Cliente nei 12 mesi precedenti l&apos;evento. Nexora non
        risponde di mancati guadagni, perdita di vendite o danni indiretti, né del funzionamento dei
        servizi di terzi scelti dal Cliente (ad esempio il proprio conto Stripe).
      </p>

      <h2>9. Durata e recesso</h2>
      <p>
        Il contratto dura quanto l&apos;abbonamento e si rinnova con esso. Ciascuna parte può
        recedere con la disdetta prevista al punto 2. Nexora può risolvere il contratto in caso di
        violazione grave di queste condizioni, in particolare dei punti 4 e 5.
      </p>

      <h2>10. Modifiche alle condizioni</h2>
      <p>
        Nexora può aggiornare queste condizioni comunicandolo via email almeno 30 giorni prima. Se
        il Cliente non è d&apos;accordo può disdire prima dell&apos;entrata in vigore.
      </p>

      <h2>11. Legge e foro</h2>
      <p>
        Si applica la legge italiana. Per ogni controversia è competente in via esclusiva il foro di{" "}
        <V v={l.foro} label="foro competente" />.
      </p>
    </LegalPage>
  );
}
