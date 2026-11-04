import Link from "next/link";
import { Bell, LogOut, Search } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Logo } from "@/components/ui/logo";

export function StudentTopbar({ initials = "N", name }: { initials?: string; name?: string }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="md:hidden">
        <Logo size="sm" href="/app" />
      </div>
      <form
        role="search"
        action="/corsi"
        className="relative hidden max-w-120 flex-1 basis-70 sm:block"
      >
        <label htmlFor="cerca" className="sr-only">
          Cerca
        </label>
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-ink-muted"
        />
        <input
          id="cerca"
          name="q"
          type="search"
          placeholder="Cerca una lezione o un argomento"
          className="h-12 w-full rounded-md border border-line bg-surface pr-4 pl-11 text-sm placeholder:text-ink-muted focus:border-nexora-blue focus:outline-none"
        />
      </form>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Notifiche"
          className="flex size-12 items-center justify-center rounded-md border border-line bg-surface text-ink hover:border-ink-muted"
        >
          <Bell aria-hidden className="size-5" />
        </button>
        <Link
          href="/app/profilo"
          className="flex items-center gap-3 rounded-full"
          aria-label="Il tuo profilo"
        >
          <Avatar name={initials} className="size-12" />
          {name && <span className="hidden text-sm font-semibold lg:inline">{name}</span>}
        </Link>
        <form action="/esci" method="post" className="hidden md:block">
          <button
            type="submit"
            aria-label="Esci"
            title="Esci"
            className="flex size-12 items-center justify-center rounded-md text-ink-muted hover:bg-surface hover:text-ink"
          >
            <LogOut aria-hidden className="size-5" />
          </button>
        </form>
      </div>
    </header>
  );
}
