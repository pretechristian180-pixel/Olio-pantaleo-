import Link from "next/link";
import { TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const untilFmt = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Rome",
});

/** Pagamento fallito, ancora nei 2 giorni di tolleranza: si lavora, ma c'è una scadenza. */
export function GraceAlert({ until }: { until: string | null }) {
  if (!until) return null;
  return (
    <Alert variant="warning">
      <TriangleAlert aria-hidden />
      <AlertTitle>L&apos;ultimo pagamento non è andato a buon fine</AlertTitle>
      <AlertDescription>
        Aggiorna il pagamento entro {untilFmt.format(new Date(until))}: dopo, i nuovi montaggi si
        mettono in pausa. Video e calendario restano al loro posto.{" "}
        <Link href="/piano" className="font-medium underline underline-offset-4">
          Vai al piano
        </Link>
      </AlertDescription>
    </Alert>
  );
}
