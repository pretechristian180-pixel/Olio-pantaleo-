import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, ClipboardCopy, KeyRound, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/input";
import { Section } from "@/components/shared/Section";
import { ErrorState, ListSkeleton, Spinner } from "@/components/shared/States";
import { useSessione } from "@/lib/auth";
import { mostraErrore } from "@/lib/errors";
import { relativo } from "@/lib/format";
import { MODALITA_PORTALE, type Tone } from "@/lib/labels";
import { numeroIt } from "@/lib/schemas";
import type { ModalitaPortale, StatoConnessionePortale } from "@/types/db";
import { copia } from "@/features/pubblicazione/api";
import {
  urlFeed,
  urlWebhookLead,
  useAggiornaPortaleOrg,
  useApiAttiva,
  usePortaliOrg,
  useSalvaCredenziali,
  type PortaleOrg,
} from "@/features/pubblicazione/portaliApi";

const CONNESSIONE: Record<StatoConnessionePortale, { label: string; tone: Tone }> = {
  non_configurato: { label: "Da configurare", tone: "gray" },
  attivo: { label: "Collegato", tone: "green" },
  errore: { label: "Errore di collegamento", tone: "red" },
  disattivato: { label: "Disattivato", tone: "gray" },
};

/** Cosa serve in ogni connettore API (le credenziali vanno cifrate in Vault, non si rileggono). */
const FORMATO_CREDENZIALI: Record<string, string> = {
  autoscout24: '{"client_id": "…", "client_secret": "…", "customer_id": "…"}',
  subito: '{"api_key": "…", "account_id": "…"}',
};

const schemaCosto = z
  .string()
  .trim()
  .refine((v) => v === "" || (Number.isFinite(numeroIt(v)) && numeroIt(v) >= 0), "Costo non valido");

async function copiaConAvviso(testo: string, cosa: string) {
  if (await copia(testo)) toast.success(`${cosa} copiato`);
  else toast.error("Non riesco a copiare: seleziona il testo e copialo a mano.");
}

/**
 * Impostazioni → Portali: per ogni portale attivo/spento, modalità di collegamento,
 * costo mensile (per costo per lead e per vendita), credenziali, feed e webhook dei lead.
 * Il titolare modifica, il responsabile vendite legge.
 */
export function PortaliTab() {
  const { isTitolare } = useSessione();
  const portali = usePortaliOrg();

  if (portali.isLoading) return <ListSkeleton rows={4} />;
  if (portali.error) return <ErrorState error={portali.error} onRetry={() => void portali.refetch()} />;

  return (
    <div className="space-y-5">
      <Section title="Come si collega un portale">
        <ul className="space-y-3 text-[15px]">
          {(Object.keys(MODALITA_PORTALE) as ModalitaPortale[]).map((m) => (
            <li key={m}>
              <span className="font-semibold">{MODALITA_PORTALE[m].label}.</span>{" "}
              <span className="text-muted-foreground">{MODALITA_PORTALE[m].spiegazione}</span>
            </li>
          ))}
        </ul>
        {!isTitolare && (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="size-4" aria-hidden /> Solo il titolare può modificare i portali.
          </p>
        )}
      </Section>
      {(portali.data ?? []).map((p) => (
        <SchedaPortale key={p.id} portale={p} modificabile={isTitolare} />
      ))}
    </div>
  );
}

function SchedaPortale({ portale, modificabile }: { portale: PortaleOrg; modificabile: boolean }) {
  const aggiorna = useAggiornaPortaleOrg();
  const supportate = portale.portals.modalita_supportate;
  const conApi = supportate.includes("api");
  const apiAttiva = useApiAttiva(portale.portal_id, conApi);
  const [costo, setCosto] = useState(String(portale.costo_mensile ?? 0));
  useEffect(() => setCosto(String(portale.costo_mensile ?? 0)), [portale.costo_mensile]);
  const connessione = CONNESSIONE[portale.stato_connessione];

  async function salva(patch: Parameters<typeof aggiorna.mutateAsync>[0], messaggio: string) {
    try {
      await aggiorna.mutateAsync(patch);
      toast.success(messaggio);
    } catch (e) {
      mostraErrore(e);
    }
  }

  async function salvaCosto() {
    const v = schemaCosto.safeParse(costo);
    if (!v.success) return toast.error(v.error.issues[0]!.message);
    await salva({ id: portale.id, costo_mensile: costo.trim() === "" ? 0 : numeroIt(costo) }, "Costo mensile salvato");
  }

  return (
    <Section
      title={
        <span className="flex flex-wrap items-center gap-2">
          {portale.portals.nome}
          {portale.attivo && <Badge tone={connessione.tone} size="sm">{connessione.label}</Badge>}
        </span>
      }
      action={
        <Switch
          id={`attivo-${portale.portal_id}`}
          checked={portale.attivo}
          onChange={(v) => modificabile && salva({ id: portale.id, attivo: v }, v ? `${portale.portals.nome} attivato` : `${portale.portals.nome} disattivato`)}
          label={portale.attivo ? "Attivo" : "Spento"}
        />
      }
    >
      <div className="space-y-4">
        {portale.portals.sito && (
          <a href={portale.portals.sito} target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline">
            {portale.portals.sito.replace(/^https?:\/\/(www\.)?/, "")}
          </a>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Collegamento" htmlFor={`modalita-${portale.portal_id}`} hint={MODALITA_PORTALE[portale.modalita].spiegazione}>
            <Select
              id={`modalita-${portale.portal_id}`}
              value={portale.modalita}
              disabled={!modificabile || aggiorna.isPending}
              onChange={(e) => salva({ id: portale.id, modalita: e.target.value as ModalitaPortale }, "Collegamento aggiornato")}
            >
              {supportate.map((m) => (
                <option key={m} value={m} disabled={m === "api" && !apiAttiva.data}>
                  {MODALITA_PORTALE[m].label}
                  {m === "api" && !apiAttiva.data ? " — in attesa dell'accesso partner" : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Costo mensile del portale (€)" htmlFor={`costo-${portale.portal_id}`} hint="Serve a calcolare il costo per lead e per vendita nei report.">
            <div className="flex gap-2">
              <Input
                id={`costo-${portale.portal_id}`}
                inputMode="decimal"
                value={costo}
                disabled={!modificabile}
                onChange={(e) => setCosto(e.target.value)}
              />
              {modificabile && costo !== String(portale.costo_mensile ?? 0) && (
                <Button variant="outline" onClick={salvaCosto} disabled={aggiorna.isPending}>
                  Salva
                </Button>
              )}
            </div>
          </Field>
        </div>

        {conApi && portale.modalita === "api" && !apiAttiva.isLoading && !apiAttiva.data && (
          <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
            Il collegamento diretto con {portale.portals.nome} si attiva quando la concessionaria viene abilitata come partner dati
            del portale. Nel frattempo usa il file automatico (se disponibile) o la modalità manuale assistita.
          </p>
        )}

        {portale.modalita === "api" && <Credenziali portale={portale} modificabile={modificabile} />}

        {portale.modalita === "feed" && (
          <IndirizzoCopiabile
            titolo="Indirizzo del file per il portale"
            spiegazione={
              portale.portal_id === "meta"
                ? "In Meta Commerce Manager crea un catalogo «Veicoli», aggiungi un'origine dati «Feed pianificato» e incolla questo indirizzo (formato CSV)."
                : portale.portal_id === "sito"
                  ? "Dallo a chi gestisce il sito: contiene le auto online con dati, prezzi e foto sempre aggiornati."
                  : `Comunica questo indirizzo all'assistenza di ${portale.portals.nome}: lo importeranno a intervalli regolari.`
            }
            valori={[
              { etichetta: "XML", url: urlFeed(portale.feed_token, "xml") },
              { etichetta: "CSV", url: urlFeed(portale.feed_token, "csv") },
            ]}
          />
        )}

        <IndirizzoCopiabile
          titolo="Ricezione dei contatti"
          spiegazione={`Se ${portale.portals.nome} (o un servizio di inoltro email) può inviare i contatti a un indirizzo web, usa questo: il lead arriva in Sorpasso già collegato all'auto e all'annuncio.`}
          valori={[{ etichetta: "Webhook", url: urlWebhookLead(portale.webhook_token) }]}
        />

        {(portale.ultimo_controllo_at || portale.ultimo_errore) && (
          <p className="text-sm text-muted-foreground">
            {portale.ultimo_controllo_at && `Ultimo contatto con il portale ${relativo(portale.ultimo_controllo_at)}.`}
            {portale.ultimo_errore && <span className="block text-destructive">Ultimo errore: {portale.ultimo_errore}</span>}
          </p>
        )}
      </div>
    </Section>
  );
}

function Credenziali({ portale, modificabile }: { portale: PortaleOrg; modificabile: boolean }) {
  const salva = useSalvaCredenziali();
  const [testo, setTesto] = useState("");
  const salvate = !!portale.credenziali_secret_id;

  async function conferma() {
    try {
      JSON.parse(testo);
    } catch {
      return toast.error("Le credenziali devono essere nel formato indicato (JSON).");
    }
    try {
      await salva.mutateAsync({ portalId: portale.portal_id, credenziali: testo.trim() });
      setTesto("");
      toast.success("Credenziali salvate in modo cifrato");
    } catch (e) {
      mostraErrore(e);
    }
  }

  return (
    <div className="rounded-lg border p-4">
      <p className="flex items-center gap-2 font-semibold">
        <KeyRound className="size-5 text-muted-foreground" aria-hidden /> Credenziali del portale
        {salvate && (
          <span className="flex items-center gap-1 text-sm font-medium text-success">
            <CheckCircle2 className="size-4" aria-hidden /> Salvate
          </span>
        )}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Vengono cifrate e non si possono più rileggere: per cambiarle, incolla quelle nuove.
      </p>
      {modificabile && (
        <>
          <Textarea
            id={`credenziali-${portale.portal_id}`}
            className="mt-3 min-h-20 font-mono text-sm"
            placeholder={FORMATO_CREDENZIALI[portale.portal_id] ?? '{"…": "…"}'}
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <Button className="mt-2" size="sm" onClick={conferma} disabled={!testo.trim() || salva.isPending}>
            {salva.isPending && <Spinner className="size-4 animate-spin" />}
            {salvate ? "Sostituisci credenziali" : "Salva credenziali"}
          </Button>
        </>
      )}
    </div>
  );
}

function IndirizzoCopiabile({ titolo, spiegazione, valori }: { titolo: string; spiegazione: string; valori: { etichetta: string; url: string }[] }) {
  return (
    <div>
      <p className="font-semibold">{titolo}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{spiegazione}</p>
      <ul className="mt-2 space-y-2">
        {valori.map((v) => (
          <li key={v.etichetta} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-sm font-medium text-muted-foreground">{v.etichetta}</span>
            <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2.5 py-2 text-xs" title={v.url}>
              {v.url}
            </code>
            <Button size="xs" variant="outline" onClick={() => copiaConAvviso(v.url, "Indirizzo")} aria-label={`Copia indirizzo ${v.etichetta}`}>
              <ClipboardCopy aria-hidden /> Copia
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
