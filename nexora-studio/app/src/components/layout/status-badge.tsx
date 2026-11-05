import type { VideoStatus } from "@nexora/shared";

import { Badge } from "@/components/ui/badge";

const labels: Record<
  VideoStatus,
  { label: string; variant: "info" | "success" | "warning" | "destructive" | "secondary" }
> = {
  queued: { label: "In coda", variant: "secondary" },
  editing: { label: "In montaggio", variant: "info" },
  internal_review: { label: "In montaggio", variant: "info" },
  review: { label: "Da approvare", variant: "warning" },
  changes_requested: { label: "Modifiche in corso", variant: "info" },
  approved: { label: "Approvato", variant: "success" },
  scheduled: { label: "Programmato", variant: "success" },
  published: { label: "Pubblicato", variant: "success" },
  error: { label: "Problema", variant: "destructive" },
};

/** Stato del video in parole semplici. `admin` mostra anche il controllo interno del team. */
export function VideoStatusBadge({
  status,
  admin = false,
}: {
  status: VideoStatus;
  admin?: boolean;
}) {
  const { label, variant } =
    admin && status === "internal_review"
      ? { label: "Da controllare", variant: "warning" as const }
      : labels[status];
  return (
    <Badge variant={variant}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </Badge>
  );
}
