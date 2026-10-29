import { lazy, Suspense, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Coins, Pencil, Plus } from "lucide-react";
import { BackLink } from "@/components/shared/BackLink";
import { ErrorState, PageLoader } from "@/components/shared/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSessione } from "@/lib/auth";
import { mostraErrore } from "@/lib/errors";
import { euro } from "@/lib/format";
import { STATI_VEICOLO, TIPI_VEICOLO, opzioni } from "@/lib/labels";
import type { StatoVeicolo } from "@/types/db";
import { useAggiornaVeicolo, useVeicolo } from "./api";
import { Interessati } from "./Interessati";
import { SchedaTecnica } from "./SchedaTecnica";
import { BadgeGiacenza } from "./VeicoloCard";

const NuovoLeadDialog = lazy(() => import("@/features/leads/NuovoLeadDialog"));
const ContoEconomicoTab = lazy(() => import("@/features/economia/ContoEconomicoTab"));
const PubblicazioneTab = lazy(() => import("@/features/pubblicazione/PubblicazioneTab"));

type Tab = "scheda" | "economia" | "pubblicazione" | "interessati";
const TABS: Tab[] = ["scheda", "economia", "pubblicazione", "interessati"];

/** Centro di controllo dell'auto: scheda tecnica, conto economico, pubblicazione, interessati. */
export default function VeicoloDetailPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const appenaArrivata = params.get("nuovo") === "1";
  const { isManager, isAmministrazione } = useSessione();
  const vedeEconomia = isManager || isAmministrazione;
  const veicolo = useVeicolo(id);
  const aggiorna = useAggiornaVeicolo();
  const [nuovoLead, setNuovoLead] = useState(false);

  const richiesta = params.get("tab") as Tab | null;
  const tab: Tab = richiesta && TABS.includes(richiesta) && (richiesta !== "economia" || vedeEconomia) ? richiesta : "scheda";
  const cambiaTab = (t: string) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (t === "scheda") n.delete("tab");
        else n.set("tab", t);
        return n;
      },
      { replace: true },
    );

  if (veicolo.isLoading) return <PageLoader />;
  if (veicolo.isError || !veicolo.data)
    return (
      <div>
        <BackLink to="/stock" label="Torna allo stock" />
        <ErrorState error={veicolo.error} onRetry={() => void veicolo.refetch()} title="Auto non trovata" />
      </div>
    );
  const v = veicolo.data;
  const apriNuovoLead = isAmministrazione ? undefined : () => setNuovoLead(true);

  async function cambiaStato(stato: StatoVeicolo) {
    try {
      await aggiorna.mutateAsync({ id: v.id, stato });
      toast.success(`Stato aggiornato: ${STATI_VEICOLO[stato].label}`);
    } catch (e) {
      mostraErrore(e);
    }
  }

  return (
    <div>
      <BackLink to="/stock" label="Torna allo stock" />

      <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone={STATI_VEICOLO[v.stato].tone}>{STATI_VEICOLO[v.stato].label}</Badge>
            <Badge tone="gray" dot={false}>
              {TIPI_VEICOLO[v.tipo]}
            </Badge>
            <BadgeGiacenza v={v} />
          </div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight sm:text-3xl">
            {v.marca} {v.modello}
          </h1>
          {(v.versione || v.allestimento) && (
            <p className="text-[17px] text-muted-foreground">{[v.versione, v.allestimento].filter(Boolean).join(" · ")}</p>
          )}
          <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="text-3xl font-bold tabular-nums text-primary">{euro(v.prezzo_vendita)}</p>
            {v.sconto_max != null && v.sconto_max > 0 && (
              <p className="text-[15px] text-muted-foreground">
                Sconto massimo concesso: <strong className="text-foreground">{euro(v.sconto_max)}</strong>
                {v.prezzo_vendita != null && <> · fino a {euro(v.prezzo_vendita - v.sconto_max)}</>}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
          {apriNuovoLead && (
            <Button variant="accent" onClick={apriNuovoLead}>
              <Plus aria-hidden /> Nuovo lead per quest'auto
            </Button>
          )}
          {isManager && (
            <Button asChild variant="outline">
              <Link to={`/stock/${v.id}/modifica`}>
                <Pencil aria-hidden /> Modifica scheda
              </Link>
            </Button>
          )}
          {isManager && (
            <div className="sm:w-48">
              <Select value={v.stato} onChange={(e) => void cambiaStato(e.target.value as StatoVeicolo)} disabled={aggiorna.isPending} aria-label="Cambia stato">
                {opzioni(STATI_VEICOLO).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
      </header>

      <Tabs value={tab} onValueChange={cambiaTab}>
        <TabsList className="sticky top-16 z-20 -mx-4 mb-1 bg-muted/95 px-4 backdrop-blur sm:mx-0 sm:px-0">
          <TabsTrigger value="scheda">Scheda tecnica</TabsTrigger>
          {vedeEconomia && (
            <TabsTrigger value="economia">
              <span className="flex items-center gap-1.5">
                <Coins className="size-4" aria-hidden /> Conto economico
              </span>
            </TabsTrigger>
          )}
          <TabsTrigger value="pubblicazione">Pubblicazione</TabsTrigger>
          <TabsTrigger value="interessati">
            Interessati
            {v.lead_aperti > 0 && <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-xs font-semibold text-white tabular-nums">{v.lead_aperti}</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scheda">
          <SchedaTecnica v={v} />
        </TabsContent>
        {vedeEconomia && (
          <TabsContent value="economia">
            <Suspense fallback={<PageLoader />}>
              <ContoEconomicoTab veicolo={v} />
            </Suspense>
          </TabsContent>
        )}
        <TabsContent value="pubblicazione">
          <Suspense fallback={<PageLoader />}>
            <PubblicazioneTab veicolo={v} />
          </Suspense>
        </TabsContent>
        <TabsContent value="interessati">
          <Interessati v={v} evidenza={appenaArrivata} onNuovoLead={apriNuovoLead} />
        </TabsContent>
      </Tabs>

      {nuovoLead && (
        <Suspense fallback={null}>
          <NuovoLeadDialog open={nuovoLead} onOpenChange={setNuovoLead} vehicleId={v.id} />
        </Suspense>
      )}
    </div>
  );
}
