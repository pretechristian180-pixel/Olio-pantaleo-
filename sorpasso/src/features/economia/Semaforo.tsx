import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SEMAFORO } from "@/lib/labels";
import type { VehicleEconomics } from "@/types/db";

const ICONE = { verde: CheckCircle2, giallo: AlertTriangle, rosso: XCircle };

/** Semaforo del margine: colore + icona + testo (mai il solo colore). */
export function Semaforo({ valore, breve }: { valore: VehicleEconomics["semaforo"]; breve?: boolean }) {
  if (!valore) return <Badge tone="gray">Dati insufficienti</Badge>;
  const Icona = ICONE[valore];
  const s = SEMAFORO[valore];
  return (
    <Badge tone={s.tone} dot={false} size={breve ? "sm" : "md"}>
      <Icona className={breve ? "size-3.5" : "size-4"} aria-hidden />
      {breve ? { verde: "Ok", giallo: "Basso", rosso: "Perdita" }[valore] : s.label}
    </Badge>
  );
}
