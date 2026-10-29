import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import { useAuth, type MotivoBlocco } from "@/lib/auth";

const TESTI: Record<MotivoBlocco, { titolo: string; testo: string }> = {
  sospesa: {
    titolo: "Accesso sospeso",
    testo: "L'account della concessionaria è sospeso. I dati sono conservati: per riattivarlo contatta il titolare o l'assistenza Sorpasso.",
  },
  disdetta: {
    titolo: "Abbonamento terminato",
    testo: "L'abbonamento della concessionaria è terminato. Per riattivarlo contatta l'assistenza Sorpasso.",
  },
  prova_scaduta: {
    titolo: "La prova gratuita è finita",
    testo: "Speriamo che Sorpasso AI ti sia piaciuto! Per continuare a usarlo con tutti i tuoi dati, contatta l'assistenza e attiviamo l'abbonamento.",
  },
  utente_disattivato: {
    titolo: "Il tuo accesso è disattivato",
    testo: "Il titolare della concessionaria ha disattivato il tuo utente. Se pensi sia un errore, contattalo.",
  },
};

/** Mostrata a chi ha un account ma non può entrare (concessionaria sospesa, prova scaduta, utente disattivato). */
export function AccessoBloccato({ motivo, organizzazione }: { motivo: MotivoBlocco; organizzazione: string | null }) {
  const { esci } = useAuth();
  const t = TESTI[motivo];
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-card">
        <Logo />
        {organizzazione && <p className="mt-6 text-sm font-medium text-muted-foreground">{organizzazione}</p>}
        <h1 className="mt-1 text-2xl font-bold">{t.titolo}</h1>
        <p className="mt-2 text-muted-foreground">{t.testo}</p>
        <Button variant="outline" className="mt-6 w-full" onClick={() => void esci()}>
          Esci
        </Button>
      </div>
    </div>
  );
}
