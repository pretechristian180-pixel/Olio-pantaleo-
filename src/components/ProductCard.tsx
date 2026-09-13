import Link from "next/link";
import { BottleGlyph } from "@/components/illustrations/BottleGlyph";
import { accentBg } from "@/lib/accent";
import { formatEUR, minPrice, type Product } from "@/lib/data/products";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/prodotti/${product.slug}`} className="group flex flex-col">
      <div
        className={`relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-3xl shadow-soft transition-all duration-300 ease-out group-hover:-translate-y-1.5 group-hover:shadow-soft-lg ${accentBg[product.accent]}`}
      >
        {product.badge && (
          <span className="absolute left-3 top-3 rounded-full bg-paper/90 px-3 py-1 text-[11px] tracking-wide text-ink shadow-sm">
            {product.badge}
          </span>
        )}
        <BottleGlyph
          accent={product.accent}
          className="h-4/5 w-auto transition-transform duration-500 ease-out group-hover:-translate-y-1.5"
        />
      </div>
      <div className="mt-5">
        <p className="text-xs uppercase tracking-wide text-bark">{product.referenza}</p>
        <h3 className="mt-1 font-serif text-xl text-ink">{product.nome}</h3>
        <p className="mt-1 text-sm text-bark">{product.tagline}</p>
        <p className="mt-2 text-sm text-ink">Da {formatEUR(minPrice(product))}</p>
      </div>
    </Link>
  );
}
