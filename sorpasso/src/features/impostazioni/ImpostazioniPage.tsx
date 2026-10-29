import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSessione } from "@/lib/auth";
import { ProfiloTab } from "./ProfiloTab";
import { AziendaTab } from "./AziendaTab";
import { UtentiTab } from "./UtentiTab";
import { SoglieTab } from "./SoglieTab";
import { TemplateTab } from "./TemplateTab";
import { PortaliTab } from "./PortaliTab";
import ImpostazioniEconomiaTab from "@/features/economia/ImpostazioniEconomiaTab";

export default function ImpostazioniPage() {
  const { isManager, puo } = useSessione();
  const economia = puo("titolare", "responsabile_vendite", "amministrazione");
  // ?tab=portali (link dalla scheda auto) apre direttamente la scheda giusta
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "profilo";
  return (
    <div className="max-w-3xl">
      <PageHeader title="Impostazioni" subtitle="Il tuo profilo, l'azienda, il team e le regole automatiche." />
      <Tabs value={tab} onValueChange={(t) => setParams({ tab: t }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="profilo">Il mio profilo</TabsTrigger>
          <TabsTrigger value="azienda">Azienda</TabsTrigger>
          <TabsTrigger value="utenti">Utenti e ruoli</TabsTrigger>
          {isManager && <TabsTrigger value="soglie">Soglie e automazioni</TabsTrigger>}
          {isManager && <TabsTrigger value="portali">Portali</TabsTrigger>}
          {economia && <TabsTrigger value="economia">Conto economico</TabsTrigger>}
          <TabsTrigger value="template">Template messaggi</TabsTrigger>
        </TabsList>
        <TabsContent value="profilo">
          <ProfiloTab />
        </TabsContent>
        <TabsContent value="azienda">
          <AziendaTab />
        </TabsContent>
        <TabsContent value="utenti">
          <UtentiTab />
        </TabsContent>
        {isManager && (
          <TabsContent value="soglie">
            <SoglieTab />
          </TabsContent>
        )}
        {isManager && (
          <TabsContent value="portali">
            <PortaliTab />
          </TabsContent>
        )}
        {economia && (
          <TabsContent value="economia">
            <ImpostazioniEconomiaTab />
          </TabsContent>
        )}
        <TabsContent value="template">
          <TemplateTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
