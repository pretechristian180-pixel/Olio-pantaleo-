import Link from "next/link";
import { publicEnv } from "@/lib/env";
import { getCurrentTenant, isPlatformHost } from "@/lib/tenant";
import { Logo } from "@/components/ui/logo";

const link = "inline-flex min-h-11 items-center text-ink-muted hover:text-ink";

export async function PublicFooter() {
  const [tenant, platform] = await Promise.all([getCurrentTenant(), isPlatformHost()]);
  const poweredBy = tenant && !platform && !(tenant.piano?.senzaMarchioNexora ?? false);
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-310 flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:px-6">
        <Logo size="sm" />
        <p className="text-sm text-ink-muted">
          © {new Date().getFullYear()} {tenant?.nome ?? "Nexora Gruppo Digitale"}
        </p>
        <nav aria-label="Note legali" className="flex flex-wrap gap-x-4 text-sm sm:ml-auto">
          {platform && (
            <Link href="/prezzi" className={link}>
              Crea la tua academy
            </Link>
          )}
          <Link href="/privacy" className={link}>
            Privacy
          </Link>
          <Link href="/cookie" className={link}>
            Cookie
          </Link>
          {poweredBy && (
            <a href={`https://${publicEnv.NEXT_PUBLIC_ROOT_DOMAIN}/prezzi`} className={link}>
              Creato con Nexora Academy
            </a>
          )}
        </nav>
      </div>
    </footer>
  );
}
