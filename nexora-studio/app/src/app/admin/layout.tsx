import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { NexoraLogo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { getSessionContext } from "@/lib/workspace";

const ADMIN_LINKS = [
  ["/admin", "Dashboard"],
  ["/admin/aziende", "Aziende"],
  ["/admin/revisione", "Revisione"],
  ["/admin/job", "Job"],
  ["/admin/costi", "Costi"],
  ["/admin/abbonamenti", "Abbonamenti"],
  ["/admin/piani", "Piani"],
  ["/admin/social", "Social"],
] as const;

/** Area del team CP Studio: solo profili con is_admin. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/accedi?next=/admin");
  if (!ctx.profile?.is_admin) notFound();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b bg-glass backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <NexoraLogo showProduct={false} />
            <Badge variant="info">Team</Badge>
          </div>
          <nav
            aria-label="Area admin"
            className="flex min-w-0 gap-4 overflow-x-auto text-sm font-medium whitespace-nowrap"
          >
            {ADMIN_LINKS.map(([href, label]) => (
              <Link key={href} href={href} className="text-foreground hover:text-primary-text">
                {label}
              </Link>
            ))}
            <Link href="/inizio" className="text-muted-foreground hover:text-foreground">
              Area cliente
            </Link>
          </nav>
        </div>
      </header>
      <main id="contenuto" className="flex-1">
        {children}
      </main>
    </div>
  );
}
