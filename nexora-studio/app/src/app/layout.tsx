import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Font provvisorio: verrà sostituito dal font ufficiale del brand Nexora.
const sans = Geist({
  variable: "--font-sans-brand",
  subsets: ["latin"],
});

const mono = Geist_Mono({
  variable: "--font-mono-brand",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Nexora Studio",
    template: "%s · Nexora Studio",
  },
  description:
    "Ogni settimana gli script dei tuoi video, il montaggio con l'AI e la pubblicazione sui tuoi social.",
  applicationName: "Nexora Studio",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#14161c" },
    { media: "(prefers-color-scheme: light)", color: "#fbfbfc" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className={`dark ${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
