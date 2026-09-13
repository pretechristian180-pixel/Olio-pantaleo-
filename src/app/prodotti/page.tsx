import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ProductCatalog } from "@/components/ProductCatalog";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "Prodotti",
  description:
    "Oli Premium, Aromatizzati, Squeezable e Kit Assaggio: scopri la gamma Pantaleo per gusto, utilizzo e origine.",
};

const faq = [
  {
    domanda: "Come si conserva correttamente l'olio extravergine d'oliva?",
    risposta:
      "In un luogo fresco, al riparo dalla luce diretta e da fonti di calore, con il tappo ben chiuso. La luce e il calore accelerano l'ossidazione e ne alterano gusto e proprietà nel tempo.",
  },
  {
    domanda: "Qual è la differenza tra un fruttato leggero e uno intenso?",
    risposta:
      "Il fruttato dipende dalla cultivar e dal momento della raccolta: le olive raccolte più verdi danno un fruttato più intenso, amaro e piccante; una raccolta più matura restituisce un profilo più morbido.",
  },
  {
    domanda: "Come scelgo il formato più adatto a me?",
    risposta:
      "Per un consumo quotidiano i formati da 500 ml o 1 L sono più pratici; i formati da 250 ml sono ideali per regalare o per provare una referenza nuova; le latte da 3 o 5 L convengono a chi consuma l'olio con continuità.",
  },
];

export default function ProdottiPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://www.pantaleo.it/" },
            { "@type": "ListItem", position: 2, name: "Prodotti", item: "https://www.pantaleo.it/prodotti" },
          ],
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map((item) => ({
            "@type": "Question",
            name: item.domanda,
            acceptedAnswer: { "@type": "Answer", text: item.risposta },
          })),
        }}
      />

      <section className="border-b border-sand bg-ivory py-16">
        <div className="container-editorial">
          <p className="text-xs uppercase tracking-[0.3em] text-clay-600">Prodotti</p>
          <h1 className="mt-4 max-w-2xl text-balance font-serif text-4xl leading-tight text-ink sm:text-5xl">
            Che olio stai cercando?
          </h1>
          <p className="mt-4 max-w-xl text-bark">
            Non un catalogo infinito, ma un percorso: scegli per utilizzo, per gusto o per
            categoria, oppure lasciati guidare dal nostro configuratore.
          </p>
          <Link
            href="/trova-il-tuo-olio"
            className="mt-6 inline-flex bg-ink px-6 py-3 text-sm tracking-wide text-paper hover:bg-olive-800"
          >
            Trova il tuo olio Pantaleo
          </Link>
        </div>
      </section>

      <section className="container-editorial py-16">
        <Suspense fallback={<p className="text-sm text-bark">Caricamento prodotti…</p>}>
          <ProductCatalog />
        </Suspense>
      </section>

      <section className="bg-ivory py-20">
        <div className="container-editorial max-w-2xl">
          <h2 className="font-serif text-2xl text-ink">Domande frequenti</h2>
          <div className="mt-8 space-y-8">
            {faq.map((item) => (
              <div key={item.domanda}>
                <h3 className="font-serif text-lg text-ink">{item.domanda}</h3>
                <p className="mt-2 text-sm text-bark">{item.risposta}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
