import { azienda } from "@/contenuti";
import { apriPreferenze } from "@/lib/consenso";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="border-t border-line bg-bg pb-28 pt-14 sm:pb-12">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 sm:px-8 md:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-[15px] text-muted">
            Il gestionale con automazioni AI per concessionarie auto italiane: nessun lead perso, più auto vendute.
          </p>
        </div>
        <div className="text-[15px] text-muted">
          <p className="font-semibold text-text">{azienda.ragioneSociale}</p>
          <p className="mt-2">{azienda.indirizzo}</p>
          <p>P.IVA {azienda.piva}</p>
          <p>{azienda.rea}</p>
          <p>{azienda.capitaleSociale}</p>
        </div>
        <div className="text-[15px] text-muted">
          <p>
            Email: <a className="hover:text-text" href={`mailto:${azienda.email.split(" ")[0]}`}>{azienda.email}</a>
          </p>
          <p>Telefono: {azienda.telefono}</p>
          <p>PEC: {azienda.pec}</p>
          <ul className="mt-4 space-y-1.5">
            <li><a className="text-text hover:text-accent-2" href="/privacy">Privacy policy</a></li>
            <li><a className="text-text hover:text-accent-2" href="/cookie-policy">Cookie policy</a></li>
            <li>
              <button type="button" onClick={apriPreferenze} className="text-text hover:text-accent-2">
                Preferenze cookie
              </button>
            </li>
          </ul>
        </div>
      </div>
      <p className="mx-auto mt-10 max-w-6xl px-5 text-sm text-muted/70 sm:px-8">
        © {new Date().getFullYear()} {azienda.ragioneSociale}. Tutti i diritti riservati.
      </p>
    </footer>
  );
}
