import { Link, useParams } from "react-router-dom";
import { CalendarCheck, FileSignature, Mail, MessageCircle, NotebookPen, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/shared/Avatar";
import { BackLink } from "@/components/shared/BackLink";
import { StatusBadge, TemperatureBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PropertyPhoto } from "@/components/shared/PropertyPhoto";
import { useQuery } from "@/hooks/useQuery";
import { contactRoleLabel, contractLabel, seekerRoles, sourceLabel, temperatureLabel } from "@/lib/labels";
import { DocumentsCard } from "@/features/records/DocumentsCard";
import { FeedbackSummaryCard } from "@/features/records/VisitFeedback";
import { EditContactButton, RequestsCard } from "./ContactEditing";
import { formatPrice, formatRelative, formatTime, fullName } from "@/lib/format";
import { getContact } from "@/services/api";
import type { ActivityKind, Property } from "@/types/domain";
import { MatchItem, ScoreBadge } from "@/features/matching/MatchItem";
import { ContactActions } from "./ContactActions";

const activityIcon: Record<ActivityKind, { icon: typeof Phone; label: string }> = {
  chiamata: { icon: Phone, label: "Chiamata" },
  whatsapp: { icon: MessageCircle, label: "WhatsApp" },
  visita: { icon: CalendarCheck, label: "Visita" },
  email: { icon: Mail, label: "Email" },
  cambio_fase: { icon: FileSignature, label: "Trattativa" },
  nota: { icon: NotebookPen, label: "Nota" },
};

export function ContactDetailPage() {
  const { id = "" } = useParams();
  const { data, loading, error, reload } = useQuery(() => getContact(id), [id]);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  if (!data)
    return (
      <EmptyState
        art="persone"
        title="Contatto non trovato"
        action={
          <Button asChild>
            <Link to="/contatti">Vai ai contatti</Link>
          </Button>
        }
      />
    );

  const { contact: c, proposed, owned, matches } = data;
  const buyer = seekerRoles.includes(c.role);

  return (
    <div>
      <BackLink to={buyer ? "/contatti" : "/contatti?tipo=proprietario"} label="Contatti" />

      <div className="flex items-start gap-4">
        <Avatar person={c} size="lg" />
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">{fullName(c)}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-muted-foreground">
            <TemperatureBadge value={c.temperature} />
            <span>{contactRoleLabel[c.role]}</span>
          </div>
          <p className="mt-1.5 text-[17px]">{c.phone}</p>
          {c.email && <p className="text-muted-foreground">{c.email}</p>}
          {c.source && <p className="text-muted-foreground">Arrivato da: {sourceLabel[c.source]}</p>}
          {c.birthday && (
            <p className="text-muted-foreground">
              Compleanno: {new Date(c.birthday + "T12:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "long" })}
            </p>
          )}
          {!!c.tags?.length && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {c.tags.map((t) => (
                <li key={t} className="rounded-full bg-primary-soft px-2.5 py-0.5 text-sm font-medium text-primary-strong">
                  {t}
                </li>
              ))}
            </ul>
          )}
        </div>
        {data.canEdit && (
          <div className="ml-auto hidden sm:block">
            <EditContactButton contact={c} />
          </div>
        )}
      </div>
      {data.canEdit && (
        <div className="mt-4 sm:hidden [&>button]:w-full">
          <EditContactButton contact={c} />
        </div>
      )}

      <ContactActions contact={c} className="mt-6 sm:max-w-xl" />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          {buyer && <RequestsCard contact={c} canEdit={data.canEdit} hint={temperatureLabel[c.temperature].hint} />}
          <FeedbackSummaryCard contactId={c.id} />

          <Card>
            <CardHeader>
              <CardTitle>Cronologia</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-6 before:absolute before:bottom-2 before:left-5 before:top-2 before:w-px before:bg-border">
                {c.activities.length === 0 && <p className="text-muted-foreground">Ancora nessuna attività.</p>}
                {c.activities.map((a) => {
                  const { icon: Icon, label } = activityIcon[a.kind];
                  return (
                    <li key={a.id} className="relative flex gap-4">
                      <span className="z-10 flex size-10 shrink-0 items-center justify-center rounded-full border bg-background text-primary-strong">
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <div className="pt-1.5">
                        <p className="text-[15px] text-muted-foreground">
                          <span className="font-semibold text-foreground">{label}</span> · {formatRelative(a.date)} alle {formatTime(a.date)}
                        </p>
                        <p className="mt-0.5 text-[17px]">{a.text}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          {buyer && (
            <Card>
              <CardHeader>
                <CardTitle>Immobili compatibili</CardTitle>
                {matches.length > 0 && <span className="text-muted-foreground">{matches.length} da proporre</span>}
              </CardHeader>
              <CardContent className="pt-2">
                {matches.length === 0 ? (
                  <p className="text-muted-foreground">
                    {c.search
                      ? "Nessun immobile nuovo per lui. Appena ne entra uno giusto, compare qui e ricevi un promemoria."
                      : "Indica cosa cerca (zona, budget, metri quadri) e Mattonio troverà gli immobili giusti."}
                  </p>
                ) : (
                  <ul className="divide-y">
                    {matches.map((m) => (
                      <MatchItem
                        key={m.id}
                        match={m}
                        contact={c}
                        property={m.property}
                        header={<MiniProperty property={m.property} score={m.score} />}
                      />
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>{buyer ? "Immobili proposti" : "I suoi immobili"}</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              {(buyer ? proposed : owned).length === 0 ? (
                <p className="text-muted-foreground">{buyer ? "Non gli hai ancora proposto nulla." : "Nessun immobile collegato."}</p>
              ) : buyer ? (
                <ul className="divide-y">
                  {proposed.map((p) =>
                    p.match ? (
                      <MatchItem key={p.id} match={p.match} contact={c} property={p} header={<MiniProperty property={p} />} />
                    ) : (
                      <li key={p.id} className="py-3">
                        <MiniProperty property={p} />
                      </li>
                    ),
                  )}
                </ul>
              ) : (
                <div className="space-y-3">
                  {owned.map((p) => (
                    <MiniProperty key={p.id} property={p} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <DocumentsCard recordRef={{ contactId: c.id }} canEdit={data.canEdit} />
        </aside>
      </div>
    </div>
  );
}


function MiniProperty({ property: p, score }: { property: Property; score?: number }) {
  return (
    <Link to={`/immobili/${p.id}`} className="flex gap-3 rounded-lg border p-2 transition-colors hover:bg-muted/60">
      <span className="h-20 w-24 shrink-0 overflow-hidden rounded-md">
        <PropertyPhoto photo={p.photos[0]} kind={p.kind} tint={p.tint} alt="" />
      </span>
      <span className="min-w-0 py-0.5">
        <span className="flex items-center gap-2">
          <span className="font-semibold">{formatPrice(p.price, p.contract === "affitto")}</span>
          {score != null && <ScoreBadge score={score} />}
        </span>
        <span className="block truncate text-[15px] text-muted-foreground">
          {p.address}, {p.city}
        </span>
        <span className="mt-1 flex items-center gap-2">
          <StatusBadge status={p.status} />
          <span className="text-sm text-muted-foreground">{contractLabel[p.contract]}</span>
        </span>
      </span>
    </Link>
  );
}
