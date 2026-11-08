import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/data/platform";
import { Logo } from "@/components/ui/logo";

export const metadata: Metadata = {
  title: { default: "Piattaforma", template: "%s · Piattaforma Christian Prete Academy" },
  robots: { index: false, follow: false },
};

/** Pannello del super-admin Christian Prete Academy: tutte le academy dei clienti. */
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePlatformAdmin();
  return (
    <div className="min-h-dvh bg-surface-alt">
      <header className="bg-graphite-deep text-white">
        <div className="mx-auto flex h-16 max-w-310 items-center gap-4 px-4 sm:px-6">
          <Logo tone="dark" layout="inline" href="/piattaforma" label="PIATTAFORMA" />
          <nav aria-label="Piattaforma" className="ml-auto flex items-center gap-1 text-sm">
            <Link
              href="/piattaforma"
              className="flex h-11 items-center rounded-md px-3 font-semibold hover:bg-white/10"
            >
              Academy
            </Link>
            <Link
              href="/admin"
              className="flex h-11 items-center rounded-md px-3 text-ink-inverse-muted hover:bg-white/10 hover:text-white"
            >
              Admin CP Academy
            </Link>
          </nav>
          <span className="hidden text-xs text-ink-inverse-muted md:inline">{user.email}</span>
        </div>
      </header>
      <main id="contenuto" className="mx-auto max-w-310 px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
