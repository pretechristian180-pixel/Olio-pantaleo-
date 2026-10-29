import { azienda } from "@/contenuti";
import { apriPreferenze } from "@/lib/consenso";
import { PaginaLegale } from "./PaginaLegale";

export function CookiePolicy() {
  return (
    <PaginaLegale titolo="Cookie policy" aggiornata="[GG/MM/AAAA]">
      <p>
        Questo sito usa cookie e strumenti simili. I cookie tecnici sono necessari al funzionamento; quelli statistici e di
        marketing vengono installati solo se dai il consenso dal banner, e puoi cambiare scelta in qualsiasi momento.
      </p>
      <p>
        <button type="button" onClick={apriPreferenze} className="rounded-full border border-line-2 bg-surface px-5 py-2.5 font-semibold text-text hover:bg-white/10">
          Modifica le preferenze cookie
        </button>
      </p>

      <h2>Cookie tecnici (sempre attivi)</h2>
      <ul>
        <li>
          <strong>sorpasso_consenso</strong> (archiviazione locale del browser): ricorda le tue scelte sui cookie, con data e
          versione. Durata: fino alla cancellazione o al cambio di versione dell'informativa.
        </li>
      </ul>

      <h2>Cookie statistici (solo con consenso)</h2>
      <ul>
        <li>
          <strong>Google Analytics 4</strong> (Google Ireland Ltd.): statistiche aggregate sull'uso del sito, con IP anonimizzato e
          Google Consent Mode v2. Cookie: _ga, _ga_*. Durata: fino a 2 anni. Informativa:
          policies.google.com/privacy
        </li>
      </ul>

      <h2>Cookie di marketing (solo con consenso)</h2>
      <ul>
        <li>
          <strong>Meta Pixel</strong> (Meta Platforms Ireland Ltd.): misura l'efficacia delle campagne su Facebook e Instagram.
          Cookie: _fbp e simili. Durata: fino a 3 mesi. Informativa: www.facebook.com/privacy/policy
        </li>
      </ul>

      <h2>Come gestire i cookie</h2>
      <p>
        Oltre al pulsante qui sopra, puoi cancellare o bloccare i cookie dalle impostazioni del tuo browser. Rifiutando i cookie
        statistici e di marketing il sito continua a funzionare normalmente.
      </p>

      <h2>Titolare</h2>
      <p>
        {azienda.ragioneSociale} — {azienda.emailPrivacy}. Per maggiori informazioni sul trattamento dei dati leggi
        l'<a href="/privacy">informativa privacy</a>.
      </p>
    </PaginaLegale>
  );
}
