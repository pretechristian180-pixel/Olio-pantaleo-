import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Messaggio di errore chiaro, con un solo pulsante per riprovare. */
export function ErrorState({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn("rounded-lg border border-destructive/30 bg-destructive-soft px-5 py-6 text-center", className)}>
      <p className="text-[17px] font-semibold text-destructive">Non riesco a caricare i dati</p>
      <p className="mt-1 text-foreground/80">{message}</p>
      {onRetry && (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          <RotateCw aria-hidden />
          Riprova
        </Button>
      )}
    </div>
  );
}
