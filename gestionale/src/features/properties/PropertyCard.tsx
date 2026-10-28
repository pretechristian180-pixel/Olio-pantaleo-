import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import { StatusBadge } from "@/components/shared/badges";
import { PropertyPhoto } from "@/components/shared/PropertyPhoto";
import { Skeleton } from "@/components/ui/skeleton";
import { contractLabel } from "@/lib/labels";
import { formatPrice } from "@/lib/format";
import type { Property } from "@/types/domain";

export function PropertyCard({ property: p }: { property: Property }) {
  return (
    <Link
      to={`/immobili/${p.id}`}
      className="group block overflow-hidden rounded-lg border bg-card shadow-card transition-shadow hover:shadow-raised"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <PropertyPhoto
          photo={p.photos[0]}
          kind={p.kind}
          tint={p.tint}
          alt={p.title}
          className="transition-transform duration-300 group-hover:scale-[1.02]"
        />
        <StatusBadge status={p.status} className="absolute left-3 top-3 bg-white/95 shadow-card" />
        <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-sm font-medium text-white">
          {contractLabel[p.contract]}
        </span>
      </div>
      <div className="p-4">
        <p className="text-2xl font-bold tracking-tight">{formatPrice(p.price, p.contract === "affitto")}</p>
        <p className="mt-1 flex items-start gap-1.5 text-[16px] text-foreground/80">
          <MapPin className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            {p.address}, {p.city}
          </span>
        </p>
        <p className="mt-3 flex gap-4 border-t pt-3 text-[15px] text-muted-foreground">
          <span>
            <strong className="font-semibold text-foreground">{p.sqm}</strong> mq
          </span>
          <span>
            <strong className="font-semibold text-foreground">{p.rooms}</strong> {p.rooms === 1 ? "locale" : "locali"}
          </span>
          <span>
            <strong className="font-semibold text-foreground">{p.bathrooms}</strong> {p.bathrooms === 1 ? "bagno" : "bagni"}
          </span>
        </p>
      </div>
    </Link>
  );
}

export function PropertyCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-5 w-40" />
      </div>
    </div>
  );
}
