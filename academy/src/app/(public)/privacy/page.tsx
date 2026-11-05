import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, V } from "@/components/legal/legal-page";
import { getCurrentTenant, isNexoraTenant } from "@/lib/tenant";
import { SUBPROCESSORS, TERMINI_VERSIONE } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Informativa privacy",
  alternates: { canonical: "/privacy" },
};

/** Informativa privacy (art. 13 GDPR). Su un'academy cliente il titolare è il cliente. */
export default async function PrivacyPage() {
  const [tenant, nexora] = await Promise.all([getCurrentTenant(), isNexoraTenant()]);
  const l = tenant?.legal;
  if (!tenant || !l) return null;
  const titolare = <V v={l.ragione_sociale} label="ragione sociale" />;
  return (
    <LegalPage title="Informativa privacy" updated={TERMINI_VERSIONE}>
      <p>
        Questa informativa spiega come vengono trattati i tuoi dati quando usi{" "}
        {nexora ? "Nexora Academy" : `l'academy di ${tenant.nome}`}, ai sensi dell&apos;art. 13 del
        Regolamento UE 2016/679 (GDPR).
      </p>

      <h2>Titolare del trattamento</h2>
      <p>
        {titolare}, P.IVA <V v={l.piva} label="P.IVA" />, sede <V v={l.sede} label="sede" />.
        Contatti: <V v={l.email} label="email" />
        {l.pec ? `, PEC ${l.pec}` : ""}.
      </p>
      {!nexora && (
        <p>
          La piattaforma è fornita da Nexora Academy, che tratta i dati per conto del titolare come
          responsabile del trattamento (art. 28 GDPR).
        </p>
      )}

      <h2>Quali dati, perché e su quale base</h2>
      <table>
        <thead>
          <tr>
            <th>Dati</th>
            <th>Finalità</th>
            <th>Base giuridica</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Nome, cognome, email, password (cifrata)</td>
            <td>Creare l&apos;account e darti accesso</td>
            <td>Contratto</td>
          </tr>
          <tr>
            <td>Avanzamento, note, domande, attestati</td>
            <td>Farti seguire i corsi, rispondere alle domande, rilasciare gli attestati</td>
            <td>Contratto</td>
          </tr>
          <tr>
            <td>Ordini (corso, importo, esito)</td>
            <td>Gestire gli acquisti e gli obblighi fiscali</td>
            <td>Contratto e obbligo di legge</td>
          </tr>
          <tr>
            <td>Email per comunicazioni promozionali</td>
            <td>Inviarti novità sui corsi</td>
            <td>Consenso, revocabile dal profilo</td>
          </tr>
          <tr>
            <td>Dati tecnici (cookie tecnici, log di sicurezza)</td>
            <td>Far funzionare il servizio e proteggerlo</td>
            <td>Legittimo interesse</td>
          </tr>
        </tbody>
      </table>
      <p>
        I dati della carta li inserisci direttamente su Stripe: il titolare non li vede e non li
        conserva.
      </p>

      <h2>Per quanto tempo</h2>
      <ul>
        <li>
          Account, avanzamento e attestati: finché hai un account; dopo la cancellazione, entro 90
          giorni.
        </li>
        <li>Ordini e fatture: 10 anni, come richiesto dalla normativa fiscale.</li>
        <li>Consenso promozionale: fino a quando lo revochi.</li>
      </ul>

      <h2>A chi li comunichiamo</h2>
      <p>
        Solo ai fornitori che rendono possibile il servizio, vincolati da contratto al rispetto del
        GDPR. Alcuni hanno sede fuori dall&apos;UE: il trasferimento avviene con le clausole
        contrattuali standard della Commissione europea o il Data Privacy Framework.
      </p>
      <ul>
        {SUBPROCESSORS.map((s) => (
          <li key={s.nome}>
            {s.nome}: {s.servizio.toLowerCase()} ({s.luogo})
          </li>
        ))}
      </ul>
      <p>I dati non vengono venduti né usati per profilazione pubblicitaria.</p>

      <h2>I tuoi diritti</h2>
      <p>
        Puoi chiedere accesso, rettifica, cancellazione, limitazione, portabilità dei dati e opporti
        al trattamento scrivendo a <V v={l.email} label="email" />. Puoi revocare il consenso
        promozionale in ogni momento dal tuo profilo. Hai diritto di presentare reclamo al Garante
        per la protezione dei dati personali (garanteprivacy.it).
      </p>

      <h2>Cookie</h2>
      <p>
        Usiamo solo cookie tecnici: trovi i dettagli nella pagina{" "}
        <Link href="/cookie" className="text-nexora-blue underline">
          Cookie
        </Link>
        .
      </p>
    </LegalPage>
  );
}
