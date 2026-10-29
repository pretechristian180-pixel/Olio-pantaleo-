import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSessione } from "@/lib/auth";
import { ProfiloTab } from "./ProfiloTab";
import { AziendaTab } from "./AziendaTab";
import { UtentiTab } from "./UtentiTab";
import { SoglieTab } from "./SoglieTab";
import { TemplateTab } from "./TemplateTab";

export default function ImpostazioniPage() {
  const { isManager } = useSessione();
  return (
    <div className="max-w-3xl">
      <PageHeader title="Impostazioni" subtitle="Il tuo profilo, l'azienda, il team e le regole automatiche." />
      <Tabs defaultValue="profilo">
        <TabsList>
          <TabsTrigger value="profilo">Il mio profilo</TabsTrigger>
          <TabsTrigger value="azienda">Azienda</TabsTrigger>
          <TabsTrigger value="utenti">Utenti e ruoli</TabsTrigger>
          {isManager && <TabsTrigger value="soglie">Soglie e automazioni</TabsTrigger>}
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
        <TabsContent value="template">
          <TemplateTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
