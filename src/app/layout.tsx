import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartProvider } from "@/lib/cart-context";
import { JsonLd } from "@/components/JsonLd";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const siteUrl = "https://www.pantaleo.it";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Pantaleo — Dal 1890, la cultura dell'olio",
    template: "%s — Pantaleo",
  },
  description:
    "Pantaleo produce olio extravergine d'oliva a Fasano, in Puglia, da oltre 130 anni e quattro generazioni della stessa famiglia.",
  openGraph: {
    type: "website",
    locale: "it_IT",
    siteName: "Pantaleo",
    title: "Pantaleo — Dal 1890, la cultura dell'olio",
    description:
      "Quattro generazioni di famiglia, una cultura dell'olio che continua a evolversi dalla Puglia.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className={`${fraunces.variable} ${manrope.variable} font-sans`}>
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Pantaleo",
            url: siteUrl,
            foundingDate: "1890",
            slogan: "Dal 1890, la cultura dell'olio.",
            address: {
              "@type": "PostalAddress",
              addressLocality: "Fasano",
              addressRegion: "BR",
              addressCountry: "IT",
            },
          }}
        />
        <CartProvider>
          <Header />
          <main id="contenuto">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
