import { Bell, Search } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Logo } from "@/components/ui/logo";

export function StudentTopbar({ initials = "N" }: { initials?: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-10">
        <div className="md:hidden">
          <Logo size="sm" href="/app" />
        </div>
        <form role="search" action="/corsi" className="relative hidden max-w-md flex-1 sm:block">
          <label htmlFor="cerca" className="sr-only">
            Cerca nei corsi
          </label>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
          />
          <input
            id="cerca"
            name="q"
            type="search"
            placeholder="Cerca un corso o una lezione"
            className="h-11 w-full rounded-md border border-line bg-surface-alt pr-3 pl-9 text-sm placeholder:text-ink-muted focus:border-nexora-blue focus:bg-surface focus:outline-none"
          />
        </form>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            aria-label="Notifiche"
            className="flex size-11 items-center justify-center rounded-md text-ink-muted hover:bg-surface-alt hover:text-ink"
          >
            <Bell aria-hidden className="size-5" />
          </button>
          <Avatar name={initials} />
        </div>
      </div>
    </header>
  );
}
