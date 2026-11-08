import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Instrument_Sans, Michroma } from "next/font/google";
import { publicEnv, isSupabaseConfigured } from "@/lib/env";
import { brandCss } from "@/lib/brand";
import { getCurrentTenant, isTenantOpen } from "@/lib/tenant";
import {
  DEFAULT_TENANT_UI,
  TenantProvider,
  type TenantUi,
} from "@/components/tenant/tenant-context";
import { TenantUnavailable } from "@/components/tenant/tenant-unavailable";
import "./globals.css";

const michroma = Michroma({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-michroma",
  display: "swap",
});
const instrument = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-instrument",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getCurrentTenant().catch(() => null);
  const nome = tenant?.nome ?? "Christian Prete Academy";
  return {
    metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
    title: { default: nome, template: `%s · ${nome}` },
    description:
      tenant?.brand.tagline ??
      "Videocorsi pratici per imprenditori e PMI. Meno improvvisazione, più sistema.",
    openGraph: { type: "website", locale: "it_IT", siteName: nome },
  };
}

export const viewport: Viewport = { themeColor: "#05070f" };

// Pagine che restano raggiungibili anche se l'academy è sospesa (per riattivarla).
const SEMPRE_APERTE = [
  "/admin",
  "/accedi",
  "/auth",
  "/esci",
  "/password-dimenticata",
  "/reimposta-password",
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenant();
  const path = (await headers()).get("x-nx-path") ?? "/";

  let body: React.ReactNode = children;
  if (isSupabaseConfigured() && !tenant) body = <TenantUnavailable motivo="non-trovata" />;
  else if (tenant && !isTenantOpen(tenant) && !SEMPRE_APERTE.some((p) => path.startsWith(p))) {
    body = <TenantUnavailable motivo="sospesa" />;
  }

  const ui: TenantUi = tenant
    ? {
        nome: tenant.nome,
        slug: tenant.slug,
        logoText: tenant.brand.logoText,
        logoUrl: tenant.brand.logoUrl,
        tagline: tenant.brand.tagline,
        poweredBy: !tenant.funzioni.senza_marchio_nexora,
        isNexora: tenant.slug === publicEnv.NEXT_PUBLIC_TENANT_SLUG,
      }
    : DEFAULT_TENANT_UI;

  return (
    <html lang="it" className={`${michroma.variable} ${instrument.variable}`}>
      <head>{tenant && <style id="marchio-academy">{brandCss(tenant.brand)}</style>}</head>
      <body>
        <a
          href="#contenuto"
          className="sr-only z-50 rounded-md bg-nexora-blue px-4 py-3 font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Vai al contenuto
        </a>
        <TenantProvider value={ui}>{body}</TenantProvider>
      </body>
    </html>
  );
}
