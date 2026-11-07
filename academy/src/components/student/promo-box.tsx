import { Eyebrow } from "@/components/ui/eyebrow";
import { isPromoVisible, type Promo } from "@/lib/promo";
import { cn } from "@/lib/utils";

/** Riquadro promozionale dell'academy (es. "Prenota la consulenza"), deciso dal cliente. */
export function PromoBox({ promo, className }: { promo: Promo; className?: string }) {
  if (!isPromoVisible(promo)) return null;
  const esterno = promo.link.startsWith("https://");
  return (
    <div className={cn("flex flex-col gap-2.5 rounded-lg bg-graphite p-4", className)}>
      {promo.sopratitolo && (
        <Eyebrow tone="bright" className="text-[11px]">
          {promo.sopratitolo}
        </Eyebrow>
      )}
      <p className="text-sm leading-5 text-white">{promo.testo}</p>
      {promo.link && (
        <a
          href={promo.link}
          {...(esterno ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-4 text-center text-[13px] font-bold text-ink hover:bg-blue-tint"
        >
          {promo.pulsante || "Scopri di più"}
        </a>
      )}
    </div>
  );
}
