import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageHeader } from "@/components/shared/PageHeader";
import { useQuery } from "@/hooks/useQuery";
import { listContacts } from "@/services/api";
import type { ContactRole } from "@/types/domain";
import { ownerRoles, seekerRoles } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { ContactCard, ContactCardSkeleton } from "./ContactCard";

type Tab = "acquirente" | "proprietario" | "tutti";

/** Acquirenti = chi cerca casa (anche in affitto); Proprietari = chi vende o affitta. "Entrambi" compare in tutte e due. */
const inTab = (role: ContactRole, tab: Tab) =>
  tab === "tutti" || (tab === "acquirente" ? seekerRoles.includes(role) : ownerRoles.includes(role));

export function ContactsPage() {
  const [params, setParams] = useSearchParams();
  const [tab, setTabState] = useState<Tab>((params.get("tipo") as Tab) || "acquirente");
  const { data, loading, error, reload } = useQuery(() => listContacts(), []);

  function setTab(t: Tab) {
    setTabState(t);
    setParams(t === "acquirente" ? {} : { tipo: t }, { replace: true });
  }

  const [tag, setTag] = useState<string | null>(null);
  const tags = [...new Set((data ?? []).flatMap((c) => c.tags ?? []))].sort();
  const items = data?.filter((c) => inTab(c.role, tab) && (!tag || c.tags?.includes(tag))) ?? [];
  const count = (r: Tab) => data?.filter((c) => inTab(c.role, r)).length;

  const addButton = (
    <Button size="lg" asChild>
      <Link to={`/contatti/nuovo${tab === "proprietario" ? "?tipo=proprietario" : ""}`}>
        <UserPlus aria-hidden />
        Aggiungi contatto
      </Link>
    </Button>
  );

  return (
    <div>
      <PageHeader title="Contatti" subtitle="Le persone che segui, dalla più recente" action={addButton} />

      <Segmented
        label="Tipo di contatto"
        value={tab}
        onChange={setTab}
        className={cn(tags.length ? "mb-3" : "mb-6", "sm:max-w-md")}
        options={[
          { value: "acquirente", label: "Acquirenti", count: count("acquirente") },
          { value: "proprietario", label: "Proprietari", count: count("proprietario") },
          { value: "tutti", label: "Tutti", count: count("tutti") },
        ]}
      />

      {tags.length > 0 && (
        <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 scrollbar-none" role="group" aria-label="Filtra per etichetta">
          {tags.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tag === t}
              onClick={() => setTag(tag === t ? null : t)}
              className={cn(
                "h-10 shrink-0 rounded-full border px-4 text-[15px] font-medium",
                tag === t ? "border-primary bg-primary text-white" : "bg-card text-foreground/80",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3].map((i) => (
            <ContactCardSkeleton key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          art="persone"
          title={tab === "proprietario" ? "Nessun proprietario ancora" : tab === "acquirente" ? "Nessun acquirente ancora" : "Nessun contatto ancora"}
          text="Aggiungi la prima persona: ti basta nome e telefono."
          action={addButton}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((c) => (
            <ContactCard key={c.id} contact={c} />
          ))}
        </div>
      )}
    </div>
  );
}
