import { Car } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Foto dell'auto (URL firmato) o, se manca, un segnaposto con marca e modello.
 * Il rapporto è sempre 4:3 come sui portali.
 */
export function VehiclePhoto({
  url,
  marca,
  modello,
  className,
}: {
  url?: string | null;
  marca: string;
  modello?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-primary-soft to-accent-soft", className)}>
      {url ? (
        <img src={url} alt={`${marca} ${modello ?? ""}`} loading="lazy" className="size-full object-cover" />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-1 text-primary/70">
          <Car className="size-10" strokeWidth={1.5} aria-hidden />
          <span className="px-2 text-center text-sm font-semibold uppercase tracking-wide">{marca}</span>
        </div>
      )}
    </div>
  );
}
