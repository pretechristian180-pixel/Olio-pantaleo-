import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search, X } from "lucide-react";
import { Avatar } from "@/components/shared/Avatar";
import { EmptyState } from "@/components/shared/EmptyState";
import { PropertyPhoto } from "@/components/shared/PropertyPhoto";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatPrice, fullName } from "@/lib/format";
import { friendlyError } from "@/lib/errors";
import { contactRoleLabel } from "@/lib/labels";
import { searchAll, type SearchResults } from "@/services/api";

/** Campo che apre la ricerca globale (immobili e contatti). */
export function SearchTrigger({ onOpen, className }: { onOpen: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex h-12 w-full items-center gap-3 rounded-lg border border-input bg-muted/60 px-4 text-left text-muted-foreground transition-colors hover:bg-muted",
        className,
      )}
    >
      <Search className="size-5 shrink-0" aria-hidden />
      <span className="truncate">Cerca immobili o contatti</span>
    </button>
  );
}

export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setResults(null);
      return;
    }
    setLoading(true);
    let alive = true;
    const t = setTimeout(() => {
      searchAll(q)
        .then((r) => {
          if (!alive) return;
          setResults(r);
          setSearchError(null);
          setLoading(false);
        })
        .catch((e) => {
          if (!alive) return;
          setSearchError(friendlyError(e));
          setLoading(false);
        });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query, open]);

  function go(path: string) {
    onOpenChange(false);
    setQuery("");
    navigate(path);
  }

  const empty = results && results.properties.length === 0 && results.contacts.length === 0;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/30" />
        <DialogPrimitive.Content className="fixed inset-0 z-50 flex flex-col bg-background sm:inset-x-auto sm:left-1/2 sm:top-[10vh] sm:bottom-auto sm:max-h-[75vh] sm:w-full sm:max-w-xl sm:-translate-x-1/2 sm:rounded-xl sm:shadow-raised">
          <DialogPrimitive.Title className="sr-only">Cerca</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Cerca immobili e contatti per nome, indirizzo o telefono</DialogPrimitive.Description>
          <div className="flex items-center gap-2 border-b p-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nome, via, città o telefono"
                aria-label="Cerca"
                className="h-12 w-full rounded-lg bg-muted pl-11 pr-4 text-base outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <DialogPrimitive.Close className="flex h-12 items-center gap-1 rounded-lg px-3 font-medium text-muted-foreground hover:bg-muted">
              <X className="size-5" aria-hidden />
              Chiudi
            </DialogPrimitive.Close>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {!query.trim() && (
              <p className="px-2 py-8 text-center text-muted-foreground">
                Scrivi per esempio <strong className="text-foreground">Rossi</strong> o{" "}
                <strong className="text-foreground">Polignano</strong>
              </p>
            )}
            {loading && !results && (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            )}
            {searchError && <p role="alert" className="px-2 py-6 text-center font-medium text-destructive">{searchError}</p>}
            {empty && !searchError && <EmptyState art="ricerca" title="Nessun risultato" text={`Non abbiamo trovato nulla per “${query}”.`} />}
            {results && results.properties.length > 0 && (
              <section className="mb-4">
                <h3 className="px-2 pb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Immobili</h3>
                {results.properties.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => go(`/immobili/${p.id}`)}
                    className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-muted"
                  >
                    <span className="h-12 w-16 shrink-0 overflow-hidden rounded-md">
                      <PropertyPhoto photo={p.photos[0]} kind={p.kind} tint={p.tint} alt="" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.address}, {p.city}</span>
                      <span className="block text-[15px] text-muted-foreground">{formatPrice(p.price, p.contract === "affitto")}</span>
                    </span>
                  </button>
                ))}
              </section>
            )}
            {results && results.contacts.length > 0 && (
              <section>
                <h3 className="px-2 pb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Contatti</h3>
                {results.contacts.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => go(`/contatti/${c.id}`)}
                    className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-muted"
                  >
                    <Avatar person={c} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{fullName(c)}</span>
                      <span className="block text-[15px] text-muted-foreground">
                        {contactRoleLabel[c.role]}
                        {c.phone && ` · ${c.phone}`}
                      </span>
                    </span>
                  </button>
                ))}
              </section>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
