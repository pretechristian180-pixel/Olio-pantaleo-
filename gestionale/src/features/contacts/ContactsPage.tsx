import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { useQuery } from "@/hooks/useQuery";
import { listContacts } from "@/services/api";
import type { ContactRole } from "@/types/domain";
import { ContactCard, ContactCardSkeleton } from "./ContactCard";

type Tab = ContactRole | "tutti";

export function ContactsPage() {
  const [params, setParams] = useSearchParams();
  const [tab, setTabState] = useState<Tab>((params.get("tipo") as Tab) || "acquirente");
  const { data, loading } = useQuery(() => listContacts(), []);

  function setTab(t: Tab) {
    setTabState(t);
    setParams(t === "acquirente" ? {} : { tipo: t }, { replace: true });
  }

  const items = data?.filter((c) => tab === "tutti" || c.role === tab) ?? [];
  const count = (r: Tab) => data?.filter((c) => r === "tutti" || c.role === r).length;

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
        className="mb-6 sm:max-w-md"
        options={[
          { value: "acquirente", label: "Acquirenti", count: count("acquirente") },
          { value: "proprietario", label: "Proprietari", count: count("proprietario") },
          { value: "tutti", label: "Tutti", count: count("tutti") },
        ]}
      />

      {loading ? (
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
