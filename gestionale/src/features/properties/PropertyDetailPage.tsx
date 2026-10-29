import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarPlus, ChevronRight, Eye, MapPin, MessageSquare, Timer, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/shared/Avatar";
import { BackLink } from "@/components/shared/BackLink";
import { StatusBadge, TemperatureBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PropertyPhoto } from "@/components/shared/PropertyPhoto";
import { ContactActions } from "@/features/contacts/ContactActions";
import { useAppointmentDialog } from "@/features/agenda/AppointmentDialog";
import { useQuery } from "@/hooks/useQuery";
import { contractLabel, kindLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { formatPrice, formatShortDate, fullName } from "@/lib/format";
import { getProperty } from "@/services/api";

export function PropertyDetailPage() {
  const { id = "" } = useParams();
  const { data, loading, error, reload } = useQuery(() => getProperty(id), [id]);
  const { openAppointment } = useAppointmentDialog();
  const [photoIndex, setPhotoIndex] = useState(0);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading) return <DetailSkeleton />;
  if (!data)
    return (
      <EmptyState
        art="casa"
        title="Immobile non trovato"
        text="Potrebbe essere stato eliminato."
        action={
          <Button asChild>
            <Link to="/immobili">Vai agli immobili</Link>
          </Button>
        }
      />
    );

  const { property: p, owner, matchingBuyers, stats } = data;
  const photo = p.photos[photoIndex] ?? p.photos[0];

  const facts = [
    p.sqm != null && { label: "Superficie", value: `${p.sqm} mq` },
    p.rooms != null && { label: "Locali", value: p.rooms },
    p.bathrooms != null && { label: "Bagni", value: p.bathrooms },
    { label: "Tipo", value: kindLabel[p.kind] },
    p.floor && { label: "Piano", value: p.floor },
    p.energyClass && { label: "Classe energetica", value: p.energyClass },
    p.mandateEnd && { label: "Incarico fino al", value: formatShortDate(p.mandateEnd) },
  ].filter(Boolean) as { label: string; value: string | number }[];

  return (
    <div>
      <BackLink to="/immobili" label="Immobili" />

      {/* Galleria */}
      <div className="-mx-4 sm:mx-0">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted sm:aspect-[16/7] sm:rounded-xl lg:max-h-[440px] lg:w-full">
          <PropertyPhoto photo={photo} kind={p.kind} tint={p.tint} alt={`${p.title}, foto ${photoIndex + 1}`} />
          <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-[15px] font-medium text-white">
            Foto {photoIndex + 1} di {p.photos.length}
          </span>
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto px-4 scrollbar-none sm:px-0">
          {p.photos.map((ph, i) => (
            <button
              key={ph.id}
              type="button"
              onClick={() => setPhotoIndex(i)}
              aria-label={`Mostra foto ${i + 1}`}
              aria-current={i === photoIndex}
              className={cn(
                "h-16 w-22 shrink-0 overflow-hidden rounded-md border-2 transition-opacity sm:h-20 sm:w-28",
                i === photoIndex ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              <PropertyPhoto photo={ph} kind={p.kind} tint={p.tint} alt="" />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={p.status} />
            <span className="text-muted-foreground">{contractLabel[p.contract]}</span>
          </div>
          <p className="mt-3 text-[32px] font-bold leading-tight tracking-tight">{formatPrice(p.price, p.contract === "affitto")}</p>
          <h1 className="mt-1 text-xl font-semibold">{p.title}</h1>
          <p className="mt-1 flex items-start gap-1.5 text-[17px] text-muted-foreground">
            <MapPin className="mt-1 size-4 shrink-0" aria-hidden />
            {p.address}, {p.city}
          </p>

          <Button size="lg" className="mt-6 w-full sm:w-auto" onClick={() => openAppointment({ propertyId: p.id, kind: "visita" })}>
            <CalendarPlus aria-hidden />
            Fissa una visita
          </Button>

          <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {facts.map((f) => (
              <div key={f.label} className="rounded-lg bg-muted px-4 py-3">
                <dt className="text-sm text-muted-foreground">{f.label}</dt>
                <dd className="mt-0.5 text-[17px] font-semibold">{f.value}</dd>
              </div>
            ))}
          </dl>

          <h2 className="mt-8 text-xl font-semibold">Descrizione</h2>
          <p className="mt-2 max-w-prose text-[17px] leading-relaxed text-foreground/85">
            {p.description || "Nessuna descrizione inserita."}
          </p>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Acquirenti compatibili</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <span className="flex size-12 items-center justify-center rounded-lg bg-primary-soft text-primary-strong">
                  <Users className="size-6" aria-hidden />
                </span>
                <p className="text-[17px]">
                  <strong className="text-3xl font-bold">{matchingBuyers.length}</strong>{" "}
                  {matchingBuyers.length === 1 ? "persona interessata" : "persone interessate"}
                </p>
              </div>
              {matchingBuyers.length > 0 ? (
                <ul className="mt-4 divide-y border-t">
                  {matchingBuyers.map((c) => (
                    <li key={c.id}>
                      <Link to={`/contatti/${c.id}`} className="flex items-center gap-3 py-3 hover:text-primary-strong">
                        <Avatar person={c} size="sm" />
                        <span className="flex-1 font-medium">{fullName(c)}</span>
                        <TemperatureBadge value={c.temperature} />
                        <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-muted-foreground">Per ora nessun acquirente cerca un immobile così.</p>
              )}
            </CardContent>
          </Card>

          {owner ? (
            <Card>
              <CardHeader>
                <CardTitle>Proprietario</CardTitle>
              </CardHeader>
              <CardContent>
                <Link to={`/contatti/${owner.id}`} className="flex items-center gap-3 hover:text-primary-strong">
                  <Avatar person={owner} />
                  <span>
                    <span className="block text-[17px] font-semibold">{fullName(owner)}</span>
                    <span className="block text-muted-foreground">{owner.phone}</span>
                  </span>
                </Link>
                <ContactActions contact={owner} compact className="mt-4" />
              </CardContent>
            </Card>
          ) : (
            p.ownerId && (
              // Il proprietario è un contatto seguito da un collega: gli agenti vedono solo i propri contatti
              <Card>
                <CardHeader>
                  <CardTitle>Proprietario</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Lo segue un tuo collega.</p>
                </CardContent>
              </Card>
            )
          )}

          <Card>
            <CardHeader>
              <CardTitle>Statistiche</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-2 text-center">
              <Stat icon={<Eye />} value={stats.visits} label="visite fissate" />
              <Stat icon={<MessageSquare />} value={stats.deals} label="trattative" />
              <Stat icon={<Timer />} value={stats.daysOnline} label="giorni online" />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="rounded-lg bg-muted px-2 py-3">
      <span className="mx-auto flex justify-center text-muted-foreground [&_svg]:size-5" aria-hidden>
        {icon}
      </span>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value.toLocaleString("it-IT")}</p>
      <p className="text-sm leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div>
      <Skeleton className="mb-4 h-8 w-32" />
      <Skeleton className="aspect-[4/3] sm:aspect-[16/8]" />
      <div className="mt-6 space-y-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-6 w-72" />
        <Skeleton className="h-6 w-56" />
      </div>
    </div>
  );
}
