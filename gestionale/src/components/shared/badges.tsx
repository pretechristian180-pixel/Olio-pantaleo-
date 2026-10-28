import { Badge } from "@/components/ui/badge";
import { appointmentKind, statusLabel, temperatureLabel } from "@/lib/labels";
import type { AppointmentKind, PropertyStatus, Temperature } from "@/types/domain";

export function StatusBadge({ status, className }: { status: PropertyStatus; className?: string }) {
  const s = statusLabel[status];
  return (
    <Badge tone={s.tone} className={className}>
      {s.label}
    </Badge>
  );
}

export function TemperatureBadge({ value }: { value: Temperature }) {
  const t = temperatureLabel[value];
  return (
    <Badge tone={t.tone} title={t.hint}>
      {t.label}
    </Badge>
  );
}

export function AppointmentBadge({ kind }: { kind: AppointmentKind }) {
  const k = appointmentKind[kind];
  return <Badge tone={k.tone}>{k.label}</Badge>;
}
