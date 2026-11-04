import type { Metadata } from "next";

export const metadata: Metadata = { title: "La tua area", robots: { index: false, follow: false } };

// L'accesso è controllato dal middleware; ogni gruppo ha il suo layout.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return children;
}
