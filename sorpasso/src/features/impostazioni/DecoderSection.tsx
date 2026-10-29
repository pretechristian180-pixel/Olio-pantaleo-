import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Select } from "@/components/ui/input";
import { Section } from "@/components/shared/Section";
import { Spinner } from "@/components/shared/States";
import { useSessione } from "@/lib/auth";
import { ErroreLeggibile, mostraErrore, ok } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

interface ProviderDecoder {
  id: string;
  nome: string;
  descrizione: string;
  supportaTarga: boolean;
  supportaTelaio: boolean;
  configurato: boolean;
}

/** Scelta del servizio che precompila la scheda tecnica da targa o telaio. */
export function DecoderSection() {
  const { organizzazione: org, isTitolare, ricarica } = useSessione();
  const [scelta, setScelta] = useState(org.decoder_provider || "nessuno");
  const [salvataggio, setSalvataggio] = useState(false);
  useEffect(() => setScelta(org.decoder_provider || "nessuno"), [org.decoder_provider]);

  const provider = useQuery({
    queryKey: ["decoder-provider"],
    staleTime: 10 * 60_000,
    retry: 0,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<{ provider: ProviderDecoder[] }>("decodifica-veicolo", {
        body: { elenco: true },
      });
      if (error) {
        const msg = error instanceof FunctionsHttpError ? (await error.context.json().catch(() => null))?.error : null;
        throw new ErroreLeggibile(msg ?? "Il servizio di decodifica non è raggiungibile.");
      }
      return data?.provider ?? [];
    },
  });

  const selezionato = provider.data?.find((p) => p.id === scelta);

  async function salva() {
    setSalvataggio(true);
    try {
      ok(await supabase.from("organizations").update({ decoder_provider: scelta }).eq("id", org.id));
      await ricarica();
      toast.success("Servizio di decodifica aggiornato");
    } catch (e) {
      mostraErrore(e, "Non sono riuscito a salvare la scelta.");
    } finally {
      setSalvataggio(false);
    }
  }

  return (
    <Section title="Decodifica targa e telaio">
      <p className="mb-4 text-[15px] text-muted-foreground">
        Quando inserisci un'auto puoi digitare targa o numero di telaio: il servizio scelto precompila i campi della scheda tecnica.
        Senza servizio attivo, i campi si compilano a mano.
      </p>
      <div className="space-y-4">
        <Field label="Servizio" htmlFor="dec-provider">
          <Select id="dec-provider" value={scelta} onChange={(e) => setScelta(e.target.value)} disabled={!isTitolare || provider.isLoading}>
            <option value="nessuno">Nessuno (compilazione a mano)</option>
            {provider.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
                {p.configurato ? "" : " — da configurare"}
              </option>
            ))}
            {/* provider salvato ma non più disponibile */}
            {scelta !== "nessuno" && provider.data && !selezionato && <option value={scelta}>{scelta} (non disponibile)</option>}
          </Select>
        </Field>
        {provider.isError && <p className="text-sm text-warning">{(provider.error as Error).message} Puoi comunque scegliere «Nessuno».</p>}
        {selezionato && (
          <div className="rounded-lg border bg-muted/50 p-4 text-[15px]">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="font-semibold">{selezionato.nome}</span>
              <Badge tone={selezionato.configurato ? "green" : "yellow"} size="sm">
                {selezionato.configurato ? "Pronto" : "Da configurare"}
              </Badge>
            </div>
            <p className="text-muted-foreground">{selezionato.descrizione}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Riconosce: {[selezionato.supportaTarga && "targa", selezionato.supportaTelaio && "telaio"].filter(Boolean).join(" e ")}.
            </p>
            {!selezionato.configurato && (
              <p className="mt-2 text-sm text-warning">
                Mancano le credenziali del servizio. Chi gestisce il progetto deve inserirle nei «secrets» di Supabase (es.
                DECODER_HTTP_URL e DECODER_HTTP_API_KEY): non vanno mai salvate qui.
              </p>
            )}
          </div>
        )}
        {isTitolare ? (
          <Button type="button" onClick={salva} disabled={salvataggio || scelta === (org.decoder_provider || "nessuno")}>
            {salvataggio && <Spinner />}
            Salva servizio
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">Solo il titolare può cambiare il servizio.</p>
        )}
      </div>
    </Section>
  );
}
