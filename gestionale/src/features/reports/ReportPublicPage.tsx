import { useParams } from "react-router-dom";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@/hooks/useQuery";
import { formatShortDate } from "@/lib/format";
import { openPublicReport } from "@/services/reports";

/** Link mandato al proprietario: niente login, un pulsante per aprire il PDF */
export function ReportPublicPage() {
  const { token = "" } = useParams();
  const { data, loading, error } = useQuery(() => openPublicReport(token), [token]);
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-card">
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : error || !data ? (
          <>
            <h1 className="text-2xl font-bold">Report non disponibile</h1>
            <p className="mt-2 text-[17px] text-muted-foreground">Il link non è valido. Chieda all'agenzia di inviarglielo di nuovo.</p>
          </>
        ) : (
          <>
            <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
              <FileText className="size-8" aria-hidden />
            </span>
            <p className="mt-4 text-[17px] font-semibold text-muted-foreground">{data.agenzia}</p>
            <h1 className="mt-1 text-2xl font-bold">Come sta andando il suo immobile</h1>
            <p className="mt-2 text-[17px]">{data.indirizzo}</p>
            <p className="text-[15px] text-muted-foreground">
              Dal {formatShortDate(data.dal)} al {formatShortDate(data.al)}
            </p>
            <Button size="lg" className="mt-6 w-full" asChild>
              <a href={data.url} target="_blank" rel="noreferrer">
                Apri il report (PDF)
              </a>
            </Button>
            <p className="mt-4 text-sm text-muted-foreground">Visite, impressioni dei visitatori e acquirenti interessati.</p>
          </>
        )}
      </div>
    </div>
  );
}
