import { Link, useParams } from "react-router-dom";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BackLink } from "@/components/shared/BackLink";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { ContactActions } from "@/features/contacts/ContactActions";
import { ChecklistCard } from "@/features/records/ChecklistCard";
import { DocumentsCard } from "@/features/records/DocumentsCard";
import { useQuery } from "@/hooks/useQuery";
import { formatPrice, formatRelative, fullName } from "@/lib/format";
import { stages } from "@/lib/labels";
import { getDeal } from "@/services/api";

/** Scheda della trattativa: cliente, immobile, documenti (proposta, preliminare, rogito) e antiriciclaggio */
export function DealDetailPage() {
  const { id = "" } = useParams();
  const { data: d, loading, error, reload } = useQuery(() => getDeal(id), [id]);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading) return <Skeleton className="h-96" />;
  if (!d)
    return (
      <EmptyState
        art="trattative"
        title="Trattativa non trovata"
        action={
          <Button asChild>
            <Link to="/trattative">Torna alle vendite</Link>
          </Button>
        }
      />
    );

  const stage = stages.find((s) => s.id === d.stage)?.label ?? (d.stage === "persa" ? "Persa" : d.stage);
  return (
    <div className="mx-auto max-w-3xl">
      <BackLink to="/trattative" label="Vendite" />
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={d.stage === "rogito" ? "green" : d.stage === "persa" ? "red" : "brand"}>{stage}</Badge>
        <span className="text-[15px] text-muted-foreground">aggiornata {formatRelative(d.updatedAt)}</span>
      </div>
      <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-tight">{d.contact ? fullName(d.contact) : "Trattativa"}</h1>
      {d.property && (
        <Link to={`/immobili/${d.property.id}`} className="mt-1 flex items-start gap-1.5 text-[17px] text-muted-foreground hover:text-primary-strong">
          <MapPin className="mt-1 size-4 shrink-0" aria-hidden />
          {d.property.address}, {d.property.city}
        </Link>
      )}
      <p className="mt-2 text-2xl font-bold tracking-tight">{formatPrice(d.value)}</p>

      <div className="mt-8 space-y-6">
        {d.contact && (
          <Card>
            <CardHeader>
              <CardTitle>Cliente</CardTitle>
              <Link to={`/contatti/${d.contact.id}`} className="text-[15px] font-semibold text-primary-strong">
                Apri la scheda
              </Link>
            </CardHeader>
            <CardContent>
              <ContactActions contact={d.contact} propertyId={d.propertyId ?? undefined} />
            </CardContent>
          </Card>
        )}
        <DocumentsCard recordRef={{ dealId: d.id }} title="Documenti della trattativa" canEdit={d.canEdit} />
        <ChecklistCard recordRef={{ dealId: d.id }} kind="antiriciclaggio" canEdit={d.canEdit} />
      </div>
    </div>
  );
}
