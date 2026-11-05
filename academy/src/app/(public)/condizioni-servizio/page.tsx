import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = {
  title: "Condizioni del servizio",
  alternates: { canonical: "/condizioni-servizio" },
};

// BOZZA da far verificare a un legale: i campi tra [ ] vanno completati.
export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <PageHeader eyebrow="Note legali" title="Condizioni del servizio per le aziende" />
      <div className="mt-8 space-y-6 text-[15px] leading-7 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold">
        <p>
          Queste condizioni valgono per le aziende che creano la propria academy su Nexora Academy.
          Il servizio è fornito da Nexora Gruppo Digitale, [ragione sociale, sede, P.IVA].
        </p>
        <h2>Prova e abbonamento</h2>
        <p>
          La prova dura 14 giorni ed è gratuita. Poi l&apos;abbonamento è mensile o annuale, si
          rinnova da solo e si può disdire in qualsiasi momento: resta attivo fino alla fine del
          periodo pagato.
        </p>
        <h2>Vendite ai tuoi studenti</h2>
        <p>
          Vendi con il tuo account Stripe: gli incassi arrivano a te, Nexora non trattiene
          commissioni. Sei tu il venditore verso i tuoi studenti e ne curi fatture, IVA e recesso.
        </p>
        <h2>Contenuti</h2>
        <p>
          I video e i materiali restano tuoi. Garantisci di averne i diritti. Possiamo sospendere
          contenuti illeciti o che violano diritti di terzi.
        </p>
        <h2>Dati personali</h2>
        <p>
          Per i dati dei tuoi studenti tu sei titolare del trattamento e Nexora è responsabile del
          trattamento, secondo l&apos;accordo [DPA] che accetti con queste condizioni.
        </p>
        <h2>Limiti del piano</h2>
        <p>
          Ogni piano ha limiti di ore di video, studenti attivi al mese e persone del team. Se li
          superi ti avvisiamo e ti proponiamo il piano adatto, senza bloccare i tuoi studenti
          all&apos;improvviso.
        </p>
      </div>
    </div>
  );
}
