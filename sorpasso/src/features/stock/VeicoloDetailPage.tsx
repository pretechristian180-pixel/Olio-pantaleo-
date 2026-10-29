import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowUpRight,
  Camera,
  Copy,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Sparkles,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { BackLink } from "@/components/shared/BackLink";
import { EmptyState } from "@/components/shared/EmptyState";
import { InfoRow, Section } from "@/components/shared/Section";
import { ErrorState, ListSkeleton, PageLoader, Spinner } from "@/components/shared/States";
import { VehiclePhoto } from "@/components/shared/VehiclePhoto";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { chiediAI } from "@/lib/ai";
import { useSessione } from "@/lib/auth";
import { mostraErrore } from "@/lib/errors";
import { dataBreve, euro, km, relativo } from "@/lib/format";
import { ALIMENTAZIONI, CAMBI, STATI_LEAD, STATI_VEICOLO, TIPI_VEICOLO, opzioni } from "@/lib/labels";
import { linkTelefono, linkWhatsApp } from "@/lib/messaggi";
import { useFotoUrls } from "@/lib/storage";
import { cn } from "@/lib/utils";
import type { StatoVeicolo, VehiclePhoto as Foto, VehicleView } from "@/types/db";
import {
  useAggiornaVeicolo,
  useCaricaFoto,
  useClientiCompatibili,
  useCostoVeicolo,
  useEliminaFoto,
  useFotoVeicolo,
  useImpostaCopertina,
  useLeadInteressati,
  useStoricoPrezzi,
  useVeicolo,
} from "./api";
import { BadgeGiacenza } from "./VeicoloCard";

const NuovoLeadDialog = lazy(() => import("@/features/leads/NuovoLeadDialog"));

export default function VeicoloDetailPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const appenaArrivata = params.get("nuovo") === "1";
  const { isManager, isAmministrazione, isVenditore } = useSessione();
  const veicolo = useVeicolo(id);
  const aggiorna = useAggiornaVeicolo();
  const [nuovoLead, setNuovoLead] = useState(false);

  if (veicolo.isLoading) return <PageLoader />;
  if (veicolo.isError || !veicolo.data) return <ErrorState error={veicolo.error} onRetry={() => void veicolo.refetch()} title="Auto non trovata" />;
  const v = veicolo.data;

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

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
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
          {v.versione && <p className="text-[17px] text-muted-foreground">{v.versione}</p>}
          <p className="mt-2 text-3xl font-bold tabular-nums text-primary">{euro(v.prezzo_vendita)}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {!isAmministrazione && (
            <Button variant="accent" onClick={() => setNuovoLead(true)}>
              <Plus aria-hidden /> Nuovo lead per quest'auto
            </Button>
          )}
          {isManager && (
            <Button asChild variant="outline">
              <Link to={`/stock/${v.id}/modifica`}>
                <Pencil aria-hidden /> Modifica
              </Link>
            </Button>
          )}
        </div>
      </div>

      {appenaArrivata && <ClientiCompatibili v={v} evidenza />}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Galleria v={v} modificabile={!isAmministrazione} />
          <DescrizioneAnnuncio v={v} modificabile={isManager} />
          {!appenaArrivata && <ClientiCompatibili v={v} />}
          <LeadInteressati vehicleId={v.id} />
        </div>

        <div className="space-y-5">
          <Section title="Dati">
            <dl>
              <InfoRow label="Anno">{v.anno}</InfoRow>
              <InfoRow label="Chilometri">{km(v.km)}</InfoRow>
              <InfoRow label="Alimentazione">{v.alimentazione && ALIMENTAZIONI[v.alimentazione]}</InfoRow>
              <InfoRow label="Cambio">{v.cambio && CAMBI[v.cambio]}</InfoRow>
              <InfoRow label="Colore">{v.colore}</InfoRow>
              <InfoRow label="Targa">{v.targa}</InfoRow>
              <InfoRow label="Telaio">{v.telaio && <span className="font-mono text-sm">{v.telaio}</span>}</InfoRow>
              <InfoRow label="In stock dal">{dataBreve(v.data_ingresso)}</InfoRow>
              <InfoRow label="Giorni di giacenza">
                <span className={cn(v.oltre_soglia && "text-destructive")}>
                  {v.giorni_giacenza} {v.oltre_soglia && `(soglia ${v.soglia_giacenza_giorni})`}
                </span>
              </InfoRow>
            </dl>
          </Section>

          {isManager && (
            <Section title="Stato">
              <Select value={v.stato} onChange={(e) => void cambiaStato(e.target.value as StatoVeicolo)} disabled={aggiorna.isPending} aria-label="Cambia stato">
                {opzioni(STATI_VEICOLO).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <p className="mt-2 text-sm text-muted-foreground">Le auto vendute con una pratica passano a «Venduto» in automatico.</p>
            </Section>
          )}

          {isManager && <Margine v={v} />}
          {v.note_interne && (
            <Section title="Note interne">
              <p className="whitespace-pre-line text-[15px]">{v.note_interne}</p>
            </Section>
          )}
          <StoricoPrezzi vehicleId={v.id} />
          {isVenditore && (
            <p className="text-sm text-muted-foreground">Per modificare i dati o il prezzo dell'auto chiedi al responsabile vendite.</p>
          )}
        </div>
      </div>

      {nuovoLead && (
        <Suspense fallback={null}>
          <NuovoLeadDialog open={nuovoLead} onOpenChange={setNuovoLead} vehicleId={v.id} />
        </Suspense>
      )}
    </div>
  );
}

/* ---------- Galleria foto ---------- */

function Galleria({ v, modificabile }: { v: VehicleView; modificabile: boolean }) {
  const { orgId } = useSessione();
  const foto = useFotoVeicolo(v.id);
  const lista = foto.data ?? [];
  const urls = useFotoUrls(lista.map((f) => f.storage_path));
  const carica = useCaricaFoto();
  const elimina = useEliminaFoto();
  const copertina = useImpostaCopertina();
  const [attiva, setAttiva] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (attiva >= lista.length) setAttiva(0);
  }, [lista.length, attiva]);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const valide = [...files].filter((f) => f.type.startsWith("image/"));
    if (valide.length < files.length) toast.error("Alcuni file non sono immagini e sono stati saltati.");
    try {
      await carica.mutateAsync({ orgId, vehicleId: v.id, files: valide, ordineIniziale: lista.length });
      toast.success(valide.length === 1 ? "Foto caricata" : `${valide.length} foto caricate`);
    } catch (e) {
      mostraErrore(e, "Caricamento delle foto non riuscito.");
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  async function onElimina(f: Foto) {
    if (!window.confirm("Eliminare questa foto?")) return;
    try {
      await elimina.mutateAsync(f);
      toast.success("Foto eliminata");
    } catch (e) {
      mostraErrore(e);
    }
  }

  async function onCopertina(f: Foto) {
    try {
      await copertina.mutateAsync({ foto: f, tutte: lista });
      setAttiva(0);
      toast.success("Copertina aggiornata");
    } catch (e) {
      mostraErrore(e);
    }
  }

  const corrente = lista[attiva];
  const caricaBtn = modificabile && (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        className="sr-only"
        id="carica-foto"
        onChange={(e) => void onFiles(e.target.files)}
      />
      <Button size="sm" variant="secondary" onClick={() => input.current?.click()} disabled={carica.isPending}>
        {carica.isPending ? <Spinner className="size-4 animate-spin" /> : <Camera aria-hidden />}
        {carica.isPending ? "Caricamento…" : "Aggiungi foto"}
      </Button>
    </>
  );

  return (
    <Section title="Foto" count={lista.length} action={caricaBtn} bodyClassName="p-0 sm:p-0">
      {foto.isLoading ? (
        <div className="aspect-[4/3] animate-pulse bg-muted" />
      ) : lista.length === 0 ? (
        <div>
          <VehiclePhoto marca={v.marca} modello={v.modello} />
          {modificabile && (
            <div className="p-4">
              <Button variant="accent" className="w-full" onClick={() => input.current?.click()} disabled={carica.isPending}>
                <Camera aria-hidden /> Scatta o carica le foto
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="relative">
            <VehiclePhoto url={corrente ? urls.data?.[corrente.storage_path] : undefined} marca={v.marca} modello={v.modello} />
            {attiva === 0 && (
              <Badge tone="accent" size="sm" className="absolute left-3 top-3 bg-white/95 shadow-card">
                Copertina
              </Badge>
            )}
            {modificabile && corrente && (
              <div className="absolute right-3 top-3 flex gap-2">
                {attiva !== 0 && (
                  <Button size="xs" variant="outline" className="bg-white/95" onClick={() => void onCopertina(corrente)} disabled={copertina.isPending}>
                    <Star aria-hidden /> Copertina
                  </Button>
                )}
                <Button size="xs" variant="outline" className="bg-white/95 text-destructive" onClick={() => void onElimina(corrente)} disabled={elimina.isPending} aria-label="Elimina foto">
                  <Trash2 aria-hidden />
                </Button>
              </div>
            )}
          </div>
          {lista.length > 1 && (
            <div className="flex gap-2 overflow-x-auto p-3 scrollbar-none">
              {lista.map((f, i) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setAttiva(i)}
                  className={cn("w-24 shrink-0 overflow-hidden rounded-md border-2", i === attiva ? "border-accent" : "border-transparent")}
                  aria-label={`Foto ${i + 1}`}
                >
                  <VehiclePhoto url={urls.data?.[f.storage_path]} marca={v.marca} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

/* ---------- Descrizione annuncio con AI ---------- */

function DescrizioneAnnuncio({ v, modificabile }: { v: VehicleView; modificabile: boolean }) {
  const [testo, setTesto] = useState(v.descrizione ?? "");
  const [generando, setGenerando] = useState(false);
  const aggiorna = useAggiornaVeicolo();
  const modificato = testo !== (v.descrizione ?? "");

  useEffect(() => setTesto(v.descrizione ?? ""), [v.descrizione]);

  async function genera() {
    if (modificato && testo && !window.confirm("Sostituire il testo attuale con una nuova proposta?")) return;
    setGenerando(true);
    try {
      setTesto(await chiediAI({ azione: "descrizione_annuncio", vehicle_id: v.id }));
      toast.success("Descrizione pronta", { description: "Rileggila e modificala prima di salvarla." });
    } catch (e) {
      mostraErrore(e, "Non sono riuscito a generare la descrizione.");
    } finally {
      setGenerando(false);
    }
  }

  async function salva() {
    try {
      await aggiorna.mutateAsync({ id: v.id, descrizione: testo.trim() || null });
      toast.success("Descrizione salvata");
    } catch (e) {
      mostraErrore(e);
    }
  }

  async function copia() {
    try {
      await navigator.clipboard.writeText(testo);
      toast.success("Testo copiato: incollalo nel portale");
    } catch {
      toast.error("Copia non riuscita: seleziona il testo e copialo a mano.");
    }
  }

  return (
    <Section
      title="Descrizione annuncio"
      action={
        modificabile && (
          <Button size="sm" variant="accent-soft" onClick={() => void genera()} disabled={generando}>
            {generando ? <Spinner className="size-4 animate-spin" /> : <Sparkles aria-hidden />}
            {generando ? "Sto scrivendo…" : "Genera con AI"}
          </Button>
        )
      }
    >
      {modificabile ? (
        <>
          <Textarea
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            placeholder="Nessuna descrizione. Premi «Genera con AI» per una proposta in pochi secondi."
            className="min-h-48"
            aria-label="Descrizione annuncio"
            disabled={generando}
          />
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => void copia()} disabled={!testo}>
              <Copy aria-hidden /> Copia
            </Button>
            <Button onClick={() => void salva()} disabled={!modificato || aggiorna.isPending}>
              {aggiorna.isPending && <Spinner />}
              Salva descrizione
            </Button>
          </div>
        </>
      ) : v.descrizione ? (
        <>
          <p className="whitespace-pre-line text-[15px] leading-relaxed">{v.descrizione}</p>
          <Button variant="outline" className="mt-3" onClick={() => void copia()}>
            <Copy aria-hidden /> Copia
          </Button>
        </>
      ) : (
        <p className="text-muted-foreground">Nessuna descrizione inserita.</p>
      )}
    </Section>
  );
}

/* ---------- Clienti potenzialmente interessati ---------- */

function ClientiCompatibili({ v, evidenza }: { v: VehicleView; evidenza?: boolean }) {
  const { profilo, organizzazione } = useSessione();
  const q = useClientiCompatibili(v.id);
  const lista = q.data ?? [];
  if (v.stato === "venduto") return null;

  const messaggio = (nome: string) =>
    `Buongiorno ${nome.split(" ")[0]}, sono ${profilo.nome} di ${organizzazione.nome}. Abbiamo appena ricevuto una ${v.marca} ${v.modello}${v.anno ? ` del ${v.anno}` : ""}${v.prezzo_vendita ? ` a ${euro(v.prezzo_vendita)}` : ""} che potrebbe interessarle. Vuole passare a vederla?`;

  return (
    <Section
      title={
        <span className="flex items-center gap-2">
          <Users className="size-5 text-accent" aria-hidden /> Clienti potenzialmente interessati
        </span>
      }
      count={q.isLoading ? undefined : lista.length}
      className={cn(evidenza && "mb-5 border-accent/40 ring-4 ring-accent/10")}
    >
      {evidenza && lista.length > 0 && (
        <p className="mb-3 text-[15px] text-muted-foreground">
          Auto appena inserita: questi clienti cercavano qualcosa di simile. Contattali ora, prima che comprino altrove.
        </p>
      )}
      {q.isLoading ? (
        <ListSkeleton rows={2} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : lista.length === 0 ? (
        <p className="text-muted-foreground">Nessun lead aperto o perso di recente cerca un'auto simile.</p>
      ) : (
        <ul className="divide-y">
          {lista.map((c) => (
            <li key={c.lead_id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <Link to={`/lead/${c.lead_id}`} className="font-semibold hover:text-accent">
                  {c.contatto}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Badge tone={STATI_LEAD[c.stato].tone} size="sm">
                    {STATI_LEAD[c.stato].label}
                  </Badge>
                  {c.budget != null && <span>Budget {euro(c.budget)}</span>}
                  {c.interesse && <span>· Cercava {c.interesse}</span>}
                </div>
                {c.motivo_match && <p className="mt-1 text-sm font-medium text-accent">{c.motivo_match}</p>}
                {c.motivo_perso && <p className="text-sm text-muted-foreground">Perso: {c.motivo_perso}</p>}
              </div>
              {c.telefono && (
                <div className="flex gap-2">
                  <Button asChild size="sm" variant="outline" className="flex-1">
                    <a href={linkTelefono(c.telefono)}>
                      <Phone aria-hidden /> Chiama
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="success" className="flex-1">
                    <a href={linkWhatsApp(c.telefono, messaggio(c.contatto))} target="_blank" rel="noopener noreferrer">
                      <MessageCircle aria-hidden /> WhatsApp
                    </a>
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/* ---------- Lead interessati a quest'auto ---------- */

function LeadInteressati({ vehicleId }: { vehicleId: string }) {
  const q = useLeadInteressati(vehicleId);
  const lista = q.data ?? [];
  return (
    <Section title="Lead su quest'auto" count={q.isLoading ? undefined : lista.length}>
      {q.isLoading ? (
        <ListSkeleton rows={2} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : lista.length === 0 ? (
        <EmptyState compact art="lead" title="Ancora nessun lead" text="Quando un cliente chiede di quest'auto lo vedrai qui." />
      ) : (
        <ul className="divide-y">
          {lista.map((l) => (
            <li key={l.id}>
              <Link to={`/lead/${l.id}`} className="flex items-center gap-3 py-3 hover:text-accent">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {l.contatto_nome} {l.contatto_cognome}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {l.assegnato_nome ?? "Non assegnato"} · {relativo(l.created_at)}
                  </span>
                </span>
                <Badge tone={STATI_LEAD[l.stato].tone} size="sm">
                  {STATI_LEAD[l.stato].label}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/* ---------- Margine (solo manager) ---------- */

function Margine({ v }: { v: VehicleView }) {
  const costo = useCostoVeicolo(v.id, true);
  const acquisto = costo.data?.prezzo_acquisto ?? null;
  const margine = acquisto != null && v.prezzo_vendita != null ? v.prezzo_vendita - acquisto : null;
  return (
    <Section title="Margine">
      {costo.isLoading ? (
        <ListSkeleton rows={1} />
      ) : (
        <dl>
          <InfoRow label="Prezzo di acquisto">{euro(acquisto)}</InfoRow>
          <InfoRow label="Prezzo di vendita">{euro(v.prezzo_vendita)}</InfoRow>
          <InfoRow label="Margine lordo">
            {margine == null ? (
              "—"
            ) : (
              <span className={margine < 0 ? "text-destructive" : "text-success"}>
                {euro(margine)}
                {v.prezzo_vendita ? ` (${Math.round((margine / v.prezzo_vendita) * 100)}%)` : ""}
              </span>
            )}
          </InfoRow>
        </dl>
      )}
      <p className="mt-2 text-sm text-muted-foreground">Visibile solo a titolare e responsabile vendite.</p>
    </Section>
  );
}

/* ---------- Storico prezzo ---------- */

function StoricoPrezzi({ vehicleId }: { vehicleId: string }) {
  const q = useStoricoPrezzi(vehicleId);
  const lista = q.data ?? [];
  return (
    <Section title="Storico prezzo">
      {q.isLoading ? (
        <ListSkeleton rows={2} />
      ) : lista.length === 0 ? (
        <p className="text-muted-foreground">Nessuna variazione registrata.</p>
      ) : (
        <ul className="space-y-3">
          {lista.map((p) => {
            const diff = p.prezzo_precedente != null && p.prezzo_nuovo != null ? p.prezzo_nuovo - p.prezzo_precedente : null;
            return (
              <li key={p.id} className="flex items-center justify-between gap-3">
                <span>
                  <span className="block font-semibold tabular-nums">{euro(p.prezzo_nuovo)}</span>
                  <span className="block text-sm text-muted-foreground">
                    {p.prezzo_precedente == null ? "Prezzo iniziale" : `prima ${euro(p.prezzo_precedente)}`} · {dataBreve(p.created_at)}
                  </span>
                </span>
                {diff != null && diff !== 0 && (
                  <Badge tone={diff < 0 ? "green" : "yellow"} size="sm" dot={false}>
                    {diff < 0 ? <ArrowDownRight className="size-3.5" aria-hidden /> : <ArrowUpRight className="size-3.5" aria-hidden />}
                    {diff > 0 ? "+" : "−"}
                    {euro(Math.abs(diff))}
                  </Badge>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
