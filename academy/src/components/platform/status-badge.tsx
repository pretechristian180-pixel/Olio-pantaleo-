import { Badge } from "@/components/ui/badge";
import type { TenantStatus } from "@/lib/data/platform";

const STATI: Record<
  TenantStatus,
  { label: string; tone: "blue" | "positive" | "negative" | "neutral" }
> = {
  prova: { label: "In prova", tone: "blue" },
  attivo: { label: "Attiva", tone: "positive" },
  insoluto: { label: "Insoluta", tone: "negative" },
  sospeso: { label: "Sospesa", tone: "neutral" },
  chiuso: { label: "Chiusa", tone: "neutral" },
};

export function TenantStatusBadge({ stato }: { stato: TenantStatus }) {
  return <Badge tone={STATI[stato].tone}>{STATI[stato].label}</Badge>;
}

export const STATUS_LABELS = Object.fromEntries(
  Object.entries(STATI).map(([k, v]) => [k, v.label]),
) as Record<TenantStatus, string>;
