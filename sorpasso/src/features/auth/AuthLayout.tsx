import type { ReactNode } from "react";
import { BellRing, Car, TrendingUp } from "lucide-react";
import { Logo } from "@/components/layout/Logo";

const BENEFICI = [
  { icon: BellRing, titolo: "Nessun lead perso", testo: "Ogni contatto viene assegnato subito e ti avvisiamo se nessuno risponde in tempo." },
  { icon: Car, titolo: "Stock sotto controllo", testo: "Vedi a colpo d'occhio le auto ferme da troppo e i clienti interessati a ciascuna." },
  { icon: TrendingUp, titolo: "Numeri chiari", testo: "Lead, conversioni e venditori in una schermata, con l'AI che scrive per te." },
];

/** Layout delle pagine di accesso: pannello blu notte a sinistra (desktop), form a destra. */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <Logo invert />
        <div className="max-w-md">
          <h2 className="text-3xl font-bold leading-tight text-white">
            Più auto vendute, <span className="text-accent-light">meno lead persi.</span>
          </h2>
          <ul className="mt-8 space-y-6">
            {BENEFICI.map(({ icon: Icon, titolo, testo }) => (
              <li key={titolo} className="flex gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-sidebar-surface text-accent-light">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block font-semibold text-white">{titolo}</span>
                  <span className="block text-[15px]">{testo}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-sidebar-foreground/60">Il gestionale per concessionarie auto, nuovo e usato.</p>
      </aside>
      <main className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-[17px] text-muted-foreground">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
