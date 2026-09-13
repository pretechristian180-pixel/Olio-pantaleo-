import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MagazineFilter } from "@/components/MagazineFilter";

export const metadata: Metadata = {
  title: "Magazine",
  description:
    "Storia, Puglia, olio, cucina, benessere, territorio e innovazione: il magazine editoriale di Pantaleo.",
};

export default function MagazinePage() {
  return (
    <>
      <section className="border-b border-sand bg-ivory py-16">
        <div className="container-editorial">
          <p className="text-xs uppercase tracking-[0.3em] text-clay-600">Magazine</p>
          <h1 className="mt-4 max-w-2xl text-balance font-serif text-4xl leading-tight text-ink sm:text-5xl">
            Storia, Puglia, cultura dell&apos;olio.
          </h1>
          <p className="mt-4 max-w-xl text-bark">
            Articoli editoriali sul nostro mestiere: dalla terra alla tavola, passando per la
            famiglia che da oltre 130 anni lo custodisce.
          </p>
          <Link
            href="/aziende"
            className="mt-6 inline-flex text-sm tracking-wide text-ink underline underline-offset-4 hover:text-olive-700"
          >
            Sei un&apos;azienda? Scopri Pantaleo per le aziende →
          </Link>
        </div>
      </section>

      <section className="container-editorial py-16">
        <Suspense fallback={null}>
          <MagazineFilter />
        </Suspense>
      </section>
    </>
  );
}
