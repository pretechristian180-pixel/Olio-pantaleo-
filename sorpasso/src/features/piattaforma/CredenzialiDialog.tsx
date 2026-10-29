import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, TriangleAlert } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface Credenziali {
  titolo: string;
  email: string;
  /** Password temporanea oppure link di accesso: si vedono solo adesso */
  password?: string | null;
  link?: string | null;
}

async function copia(testo: string) {
  try {
    await navigator.clipboard.writeText(testo);
    toast.success("Copiato");
  } catch {
    toast.error("Copia non riuscita: seleziona il testo e copialo a mano.");
  }
}

/** Mostra password temporanea o link di accesso una sola volta, con il testo pronto da inviare. */
export function CredenzialiDialog({ dati, onClose }: { dati: Credenziali | null; onClose: () => void }) {
  const [copiato, setCopiato] = useState(false);
  if (!dati) return null;
  const sito = window.location.origin;
  const messaggio = dati.password
    ? `Ecco il tuo accesso a Sorpasso AI.\nIndirizzo: ${sito}/accedi\nEmail: ${dati.email}\nPassword temporanea: ${dati.password}\nTi consigliamo di cambiarla al primo accesso (Impostazioni → Il mio profilo).`
    : `Ecco il tuo link per accedere a Sorpasso AI e scegliere la password:\n${dati.link}`;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={dati.titolo} description={dati.email}>
        <div className="space-y-4">
          <p className="flex gap-2 rounded-lg bg-warning-soft p-3 text-[15px] text-warning">
            <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
            {dati.password
              ? "La password si vede solo adesso: copiala e inviala all'utente in modo sicuro."
              : "Il link vale per un solo accesso e scade dopo poco tempo: invialo subito."}
          </p>
          {dati.password && (
            <div className="rounded-lg border bg-muted p-4 text-center">
              <p className="text-sm text-muted-foreground">Password temporanea</p>
              <p className="mt-1 select-all font-mono text-2xl font-bold tracking-wider">{dati.password}</p>
            </div>
          )}
          {dati.link && <p className="select-all break-all rounded-lg border bg-muted p-3 font-mono text-sm">{dati.link}</p>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="accent"
              className="flex-1"
              onClick={() => {
                void copia(messaggio);
                setCopiato(true);
              }}
            >
              {copiato ? <Check aria-hidden /> : <Copy aria-hidden />} Copia messaggio da inviare
            </Button>
            <Button variant="outline" onClick={onClose}>
              Fatto
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
