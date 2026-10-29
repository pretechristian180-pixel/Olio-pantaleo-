import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { messaggioErrore } from "@/lib/errors";

/** Errore di caricamento di una pagina o sezione, con "Riprova". */
export function ErrorState({ error, onRetry, title = "Impossibile caricare i dati" }: { error?: unknown; onRetry?: () => void; title?: string }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-lg border border-destructive/20 bg-destructive-soft/50 px-6 py-10 text-center">
      <AlertTriangle className="size-8 text-destructive" aria-hidden />
      <h3 className="mt-3 text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-muted-foreground">{messaggioErrore(error, "Controlla la connessione e riprova.")}</p>
      {onRetry && (
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          Riprova
        </Button>
      )}
    </div>
  );
}

/** Scheletro di lista: righe grigie al posto dei contenuti durante il caricamento. */
export function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={className ?? "space-y-3"} aria-busy="true" aria-label="Caricamento">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" aria-busy="true" aria-label="Caricamento">
      <Loader2 className="size-8 animate-spin text-accent" aria-hidden />
    </div>
  );
}

/** Spinner per i pulsanti in attesa. */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={className ?? "size-5 animate-spin"} aria-hidden />;
}
