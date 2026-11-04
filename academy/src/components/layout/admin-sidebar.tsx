import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { NavLink } from "./nav-link";
import { adminNav } from "./nav";

type Counts = { domande?: number };

export function AdminSidebar({ counts = {} }: { counts?: Counts }) {
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
      <Link
        href="/app"
        className="mt-auto flex h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-ink-muted hover:bg-surface-alt hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Area studente
      </Link>
    </aside>
  );
}

/** Sotto i 1024px: barra in alto con le voci scorrevoli in orizzontale. */
export function AdminMobileNav({ counts = {} }: { counts?: Counts }) {
  return (
    <div className="border-b border-line bg-surface lg:hidden">
      <div className="flex h-14 items-center px-4">
        <Logo size="sm" href="/admin" label="ACADEMY · ADMIN" />
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
