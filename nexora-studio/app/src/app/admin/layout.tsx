import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { NexoraLogo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { getSessionContext } from "@/lib/workspace";

/** Area del team Nexora: solo profili con is_admin. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/accedi?next=/admin/revisione");
  if (!ctx.profile?.is_admin) notFound();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b bg-glass backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <NexoraLogo showProduct={false} />
            <Badge variant="info">Team</Badge>
          </div>
          <nav aria-label="Area admin" className="flex gap-4 text-sm font-medium">
            <Link href="/admin/revisione" className="text-foreground">
              Revisione video
            </Link>
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
