import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { NavLink } from "./nav-link";
import { adminNav } from "./nav";

type Counts = { domande?: number };

export function AdminSidebar({
  counts = {},
  platform = false,
}: {
  counts?: Counts;
  /** Mostra il collegamento al pannello piattaforma (solo super-admin). */
  platform?: boolean;
}) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-62 shrink-0 flex-col gap-8 border-r border-line bg-surface px-5 py-8 lg:flex">
      <div className="px-3">
        <Logo href="/admin" label="ACADEMY · ADMIN" />
      </div>
      <nav aria-label="Amministrazione" className="flex flex-col gap-1">
        {adminNav.map((item) => (
          <NavLink
            key={item.href}
            item={{ href: item.href, label: item.label, exact: item.exact }}
            icon={<item.icon />}
            variant="light"
            badge={item.href === "/admin/domande" ? counts.domande : undefined}
          />
        ))}
      </nav>
      {platform && (
        <Link
          href="/piattaforma"
          className="mt-auto flex h-11 items-center gap-2 rounded-md bg-graphite-deep px-3 text-sm font-semibold text-white hover:bg-graphite"
        >
          <Building2 aria-hidden className="size-4" />
          Tutte le academy
        </Link>
      )}
      <Link
        href="/app"
        className={`${platform ? "" : "mt-auto"}flex h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-ink-muted hover:bg-surface-alt hover:text-ink`}
      >
        <ArrowLeft aria-hidden className="size-4" />
        Area studente
      </Link>
    </aside>
  );
}

/** Sotto i 1024px: barra in alto con le voci scorrevoli in orizzontale. */
export function AdminMobileNav({
  counts = {},
  platform = false,
}: {
  counts?: Counts;
  platform?: boolean;
}) {
  return (
    <div className="border-b border-line bg-surface lg:hidden">
      <div className="flex h-14 items-center px-4">
        <Logo size="sm" href="/admin" label="ACADEMY · ADMIN" />
        {platform && (
          <Link
            href="/piattaforma"
            className="ml-auto flex h-11 items-center gap-2 text-sm font-semibold text-nexora-blue"
          >
            <Building2 aria-hidden className="size-4" /> Tutte le academy
          </Link>
        )}
      </div>
      <nav aria-label="Amministrazione" className="flex gap-1 overflow-x-auto px-2 pb-2">
        {adminNav.map((item) => (
          <div key={item.href} className="shrink-0">
            <NavLink
              item={{ href: item.href, label: item.label, exact: item.exact }}
              icon={<item.icon />}
              variant="light"
              badge={item.href === "/admin/domande" ? counts.domande : undefined}
            />
          </div>
        ))}
      </nav>
    </div>
  );
}
