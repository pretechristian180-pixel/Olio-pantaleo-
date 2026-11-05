import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { TERMINI_VERSIONE } from "@/lib/legal";

export const metadata: Metadata = { title: "Cookie", alternates: { canonical: "/cookie" } };

export default function CookiePage() {
  return (
    <LegalPage title="Cookie" updated={TERMINI_VERSIONE}>
      <p>
        Usiamo solo cookie tecnici, necessari a far funzionare la piattaforma. Per questi la legge
        non richiede il consenso, per questo non vedi il banner dei cookie.
      </p>
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>A cosa serve</th>
            <th>Durata</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>sb-…-auth-token</td>
            <td>Tiene aperta la tua sessione dopo l&apos;accesso</td>
            <td>Sessione o fino a 1 anno con «Ricordami»</td>
          </tr>
          <tr>
            <td>nx_ricordami</td>
            <td>Ricorda se hai scelto «Ricordami» al login</td>
            <td>Sessione o 1 anno</td>
          </tr>
        </tbody>
      </table>
      <p>
        Il pagamento avviene sulla pagina di Stripe e il video è riprodotto dal lettore di
        Bunny.net: questi servizi possono usare propri cookie tecnici e di sicurezza, regolati dalle
        loro informative. Non usiamo cookie di profilazione né statistiche di terze parti: se in
        futuro li aggiungeremo ti chiederemo prima il consenso.
      </p>
    </LegalPage>
  );
}
