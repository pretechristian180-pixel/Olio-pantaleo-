import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export function PublicFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-310 flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:px-6">
        <Logo size="sm" />
        <p className="text-sm text-ink-muted">
          © {new Date().getFullYear()} Nexora Gruppo Digitale
        </p>
        <nav aria-label="Note legali" className="flex gap-4 text-sm sm:ml-auto">
          <Link
            href="/privacy"
            className="inline-flex min-h-11 items-center text-ink-muted hover:text-ink"
          >
            Privacy
          </Link>
          <Link
            href="/cookie"
            className="inline-flex min-h-11 items-center text-ink-muted hover:text-ink"
          >
            Cookie
          </Link>
        </nav>
      </div>
    </footer>
  );
}
