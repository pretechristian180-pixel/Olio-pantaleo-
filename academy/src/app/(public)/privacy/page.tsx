import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = {
  title: "Informativa privacy",
  alternates: { canonical: "/privacy" },
};

// BOZZA da far verificare: i campi tra [ ] vanno completati con i dati societari reali.
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <PageHeader eyebrow="Note legali" title="Informativa privacy" />
      <div className="mt-8 space-y-6 text-[15px] leading-7 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold">
        <p>
          Questa pagina spiega quali dati raccogliamo quando usi Nexora Academy, perché e per quanto
          tempo li teniamo.
        </p>
        <h2>Chi tratta i tuoi dati</h2>
        <p>Nexora Gruppo Digitale, [ragione sociale, sede, P.IVA], email [privacy@dominio].</p>
        <h2>Quali dati e perché</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Nome, cognome ed email: per creare il tuo account e darti accesso ai corsi.</li>
          <li>
            Avanzamento, note e domande: per farti riprendere le lezioni e rispondere ai tuoi dubbi.
          </li>
          <li>Dati di pagamento: li gestisce Stripe, noi non vediamo il numero della carta.</li>
          <li>
            Email di marketing: solo se le hai chieste, e puoi smettere quando vuoi dal profilo.
          </li>
        </ul>
        <h2>Per quanto tempo</h2>
        <p>
          Finché hai un account. Gli ordini restano per gli anni previsti dagli obblighi fiscali.
        </p>
        <h2>I tuoi diritti</h2>
        <p>
          Puoi chiedere di vedere, correggere, esportare o cancellare i tuoi dati scrivendo a
          [privacy@dominio]. Puoi anche rivolgerti al Garante per la protezione dei dati personali.
        </p>
        <h2>Fornitori</h2>
        <p>
          Supabase (database, server in UE), Bunny (video), Stripe (pagamenti), Resend (email),
          Vercel (hosting).
        </p>
      </div>
    </div>
  );
}
