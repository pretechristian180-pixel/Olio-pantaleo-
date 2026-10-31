import { Link } from "react-router-dom";
import { Avatar } from "@/components/shared/Avatar";
import { TemperatureBadge } from "@/components/shared/badges";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelative, fullName } from "@/lib/format";
import { contactRoleLabel } from "@/lib/labels";
import type { Activity, Contact } from "@/types/domain";
import { ContactActions } from "./ContactActions";

export function ContactCard({ contact: c }: { contact: Contact & { lastActivity?: Activity } }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-card">
      <Link to={`/contatti/${c.id}`} className="group flex items-start gap-3">
        <Avatar person={c} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-[17px] font-semibold group-hover:text-primary-strong">{fullName(c)}</p>
            <TemperatureBadge value={c.temperature} />
          </div>
          <p className="mt-0.5 text-muted-foreground">
            {contactRoleLabel[c.role]}
            {c.phone && ` · ${c.phone}`}
          </p>
        </div>
      </Link>
      {!!c.tags?.length && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {c.tags.map((t) => (
            <li key={t} className="rounded-full bg-primary-soft px-2.5 py-0.5 text-sm font-medium text-primary-strong">
              {t}
            </li>
          ))}
        </ul>
      )}
      {c.lastActivity && (
        <p className="mt-3 rounded-md bg-muted px-3 py-2 text-[15px] text-foreground/80">
          <span className="font-medium text-foreground">{capitalize(formatRelative(c.lastActivity.date))}:</span> {c.lastActivity.text}
        </p>
      )}
      <ContactActions contact={c} className="mt-3" />
    </div>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function ContactCardSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex gap-3">
        <Skeleton className="size-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-10" />
      <Skeleton className="h-16 sm:h-12" />
    </div>
  );
}
