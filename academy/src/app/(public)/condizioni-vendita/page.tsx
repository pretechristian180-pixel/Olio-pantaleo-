import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, V } from "@/components/legal/legal-page";
import { getCurrentTenant } from "@/lib/tenant";
import { TERMINI_VERSIONE } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Condizioni di vendita",
  alternates: { canonical: "/condizioni-vendita" },
};

/** Condizioni di vendita dei corsi agli studenti (consumatori): venditore = l'academy. */
export default async function SalesTermsPage() {
  const tenant = await getCurrentTenant();
  const l = tenant?.legal;
  if (!tenant || !l) return null;
  return (
    <LegalPage title="Condizioni di vendita dei corsi" updated={TERMINI_VERSIONE}>
      <p>
        Queste condizioni regolano l&apos;acquisto dei videocorsi su questo sito. Il venditore è{" "}
        <V v={l.ragione_sociale} label="ragione sociale" />, P.IVA <V v={l.piva} label="P.IVA" />,
        sede <V v={l.sede} label="sede" />, email <V v={l.email} label="email" />
        {l.pec ? `, PEC ${l.pec}` : ""}.
      </p>

      <h2>1. Cosa acquisti</h2>
      <p>
        Un videocorso online: lezioni video, materiali scaricabili e, al completamento di tutte le
        lezioni, un attestato. Contenuti, durata e programma sono descritti nella pagina di ogni
        corso.
      </p>

      <h2>2. Prezzo e pagamento</h2>
      <p>
        Il prezzo indicato è quello finale da pagare. Il pagamento avviene con carta o con gli altri
        metodi proposti da Stripe, al momento dell&apos;ordine. Ricevi la ricevuta via email.
      </p>

      <h2>3. Accesso al corso</h2>
      <p>
        L&apos;accesso è immediato dopo il pagamento, dalla tua area personale, senza scadenza salvo
        diversa indicazione nella pagina del corso. L&apos;account è personale: non è consentito
        condividerlo o diffondere i contenuti.
      </p>

      <h2>4. Diritto di recesso</h2>
      <p>
        Se sei un consumatore hai normalmente 14 giorni per recedere da un acquisto online. Per i
        contenuti digitali forniti subito, come i videocorsi, il recesso non si applica se prima
        dell&apos;acquisto hai chiesto l&apos;accesso immediato e hai dichiarato di sapere che così
        perdi il diritto di recesso (art. 59, comma 1, lett. o, Codice del Consumo). Questa
        richiesta ti viene fatta, con una casella da spuntare, prima di ogni pagamento.
      </p>

      <h2>5. Problemi e assistenza</h2>
      <p>
        Se il corso non è accessibile o non corrisponde alla descrizione scrivi a{" "}
        <V v={l.email} label="email" />: valuteremo una soluzione o il rimborso. Restano salvi i
        diritti di garanzia previsti dal Codice del Consumo.
      </p>

      <h2>6. Dati personali</h2>
      <p>
        I tuoi dati sono trattati secondo l&apos;
        <Link href="/privacy" className="text-nexora-blue-bright underline">
          informativa privacy
        </Link>
        .
      </p>

      <h2>7. Legge applicabile e controversie</h2>
      <p>
        Si applica la legge italiana. Se sei un consumatore è competente il foro del tuo luogo di
        residenza. Puoi anche usare la piattaforma europea di risoluzione delle controversie online:
        ec.europa.eu/consumers/odr.
      </p>
    </LegalPage>
  );
}
