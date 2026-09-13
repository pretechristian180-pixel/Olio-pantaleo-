import { Suspense } from "react";
import { SearchResults } from "@/components/SearchResults";

export const metadata = { title: "Cerca" };

export default function CercaPage() {
  return (
    <section className="container-editorial max-w-2xl py-16">
      <Suspense fallback={null}>
        <SearchResults />
      </Suspense>
    </section>
  );
}
