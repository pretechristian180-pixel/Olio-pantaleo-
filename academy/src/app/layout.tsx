import type { Metadata, Viewport } from "next";
import { Michroma, Montserrat } from "next/font/google";
import { publicEnv } from "@/lib/env";
import "./globals.css";

const michroma = Michroma({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-michroma",
  display: "swap",
});
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
  title: { default: "Nexora Academy", template: "%s · Nexora Academy" },
  description:
    "Videocorsi pratici di Nexora Gruppo Digitale per imprenditori e PMI: CRM, automazioni, processi. Meno improvvisazione, più sistema.",
  openGraph: { type: "website", locale: "it_IT", siteName: "Nexora Academy" },
};

export const viewport: Viewport = { themeColor: "#1d2124" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${michroma.variable} ${montserrat.variable}`}>
      <body>
        <a
          href="#contenuto"
          className="sr-only z-50 rounded-md bg-nexora-blue px-4 py-3 font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Vai al contenuto
        </a>
        {children}
      </body>
    </html>
  );
}
