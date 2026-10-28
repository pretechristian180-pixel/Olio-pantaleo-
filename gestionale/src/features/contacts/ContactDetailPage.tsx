import { Link, useParams } from "react-router-dom";
import { CalendarCheck, FileSignature, Mail, MessageCircle, NotebookPen, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/shared/Avatar";
import { BackLink } from "@/components/shared/BackLink";
import { StatusBadge, TemperatureBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/EmptyState";
import { PropertyPhoto } from "@/components/shared/PropertyPhoto";
import { useQuery } from "@/hooks/useQuery";
import { contractLabel, temperatureLabel } from "@/lib/labels";
import { formatPrice, formatRelative, formatTime, fullName } from "@/lib/format";
import { getContact } from "@/services/api";
import type { ActivityKind, Property } from "@/types/domain";
import { ContactActions } from "./ContactActions";

const activityIcon: Record<ActivityKind, { icon: typeof Phone; label: string }> = {
  chiamata: { icon: Phone, label: "Chiamata" },
  whatsapp: { icon: MessageCircle, label: "WhatsApp" },
  visita: { icon: CalendarCheck, label: "Visita" },
  email: { icon: Mail, label: "Email" },
  proposta: { icon: FileSignature, label: "Proposta" },
  nota: { icon: NotebookPen, label: "Nota" },
};

export function ContactDetailPage() {
  const { id = "" } = useParams();
  const { data, loading } = useQuery(() => getContact(id), [id]);

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

  const { contact: c, proposed, owned } = data;
  const buyer = c.role === "acquirente";

  return (
    <div>
      <BackLink to={buyer ? "/contatti" : "/contatti?tipo=proprietario"} label="Contatti" />

      <div className="flex items-start gap-4">
        <Avatar person={c} size="lg" />
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">{fullName(c)}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-muted-foreground">
            <TemperatureBadge value={c.temperature} />
            <span>{buyer ? "Acquirente" : "Proprietario"}</span>
          </div>
          <p className="mt-1.5 text-[17px]">{c.phone}</p>
          {c.email && <p className="text-muted-foreground">{c.email}</p>}
        </div>
      </div>

      <ContactActions contact={c} className="mt-6 sm:max-w-xl" />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          {buyer && c.search && (
            <Card>
              <CardHeader>
                <CardTitle>Cosa cerca</CardTitle>
                <span className="text-muted-foreground">{temperatureLabel[c.temperature].hint}</span>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Fact label="Zona" value={c.search.zones.join(" · ") || "Qualsiasi"} className="col-span-2 sm:col-span-1" />
                  <Fact
                    label={c.search.contract === "affitto" ? "Affitto massimo" : "Budget massimo"}
                    value={formatPrice(c.search.budgetMax, c.search.contract === "affitto")}
                  />
                  <Fact label="Almeno" value={`${c.search.sqmMin} mq`} />
                </dl>
                {c.search.notes && <p className="mt-4 text-[17px]">“{c.search.notes}”</p>}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Cronologia</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-6 before:absolute before:bottom-2 before:left-5 before:top-2 before:w-px before:bg-border">
                {c.activities.map((a) => {
                  const { icon: Icon, label } = activityIcon[a.kind];
                  return (
                    <li key={a.id} className="relative flex gap-4">
                      <span className="z-10 flex size-10 shrink-0 items-center justify-center rounded-full border bg-background text-primary">
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

        <aside>
          <Card>
            <CardHeader>
              <CardTitle>{buyer ? "Immobili proposti" : "I suoi immobili"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(buyer ? proposed : owned).length === 0 ? (
                <p className="text-muted-foreground">{buyer ? "Non gli hai ancora proposto nulla." : "Nessun immobile collegato."}</p>
              ) : (
                (buyer ? proposed : owned).map((p) => <MiniProperty key={p.id} property={p} />)
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Fact({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={`rounded-lg bg-muted px-4 py-3 ${className ?? ""}`}>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-[17px] font-semibold">{value}</dd>
    </div>
  );
}

function MiniProperty({ property: p }: { property: Property }) {
  return (
    <Link to={`/immobili/${p.id}`} className="flex gap-3 rounded-lg border p-2 transition-colors hover:bg-muted/60">
      <span className="h-20 w-24 shrink-0 overflow-hidden rounded-md">
        <PropertyPhoto photo={p.photos[0]} kind={p.kind} tint={p.tint} alt="" />
      </span>
      <span className="min-w-0 py-0.5">
        <span className="block font-semibold">{formatPrice(p.price, p.contract === "affitto")}</span>
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
