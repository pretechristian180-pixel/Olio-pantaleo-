import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { zipSync } from "fflate";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  Download,
  ExternalLink,
  Eye,
  Loader2,
  MessageSquare,
  RefreshCw,
  Rocket,
  Tag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Switch } from "@/components/ui/input";
import { Section } from "@/components/shared/Section";
import { ListSkeleton, Spinner } from "@/components/shared/States";
import { useSessione } from "@/lib/auth";
import { mostraErrore } from "@/lib/errors";
import { euro, km, relativo } from "@/lib/format";
import { ALIMENTAZIONI, AZIONI_MANUALI, CAMBI, MODALITA_PORTALE, STATI_ANNUNCIO } from "@/lib/labels";
import { aNumero, numeroIt } from "@/lib/schemas";
import { BUCKET_FOTO, supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { ControlloQualita, Portal, SyncJob, VehicleListing, VehicleView } from "@/types/db";
import { copia } from "./api";
import {
  useAnnunciVeicolo,
  useCatalogoPortali,
  useCodaVeicolo,
  useConfermaManuale,
  useControlloQualita,
  useInterruttoreAnnuncio,
  usePortaliOrg,
  usePrezzoPortale,
  usePubblicaOvunque,
  useRiprovaPortale,
  type PortaleOrg,
} from "./portaliApi";

const OPERAZIONI: Record<SyncJob["operazione"], string> = {
  publish: "Pubblicazione in corso…",
  update: "Aggiornamento in corso…",
  suspend: "Sospensione in corso…",
  remove: "Rimozione in corso…",
  stats: "Lettura statistiche…",
};

/**
 * Sezione "Portali" della tab Pubblicazione: pubblica l'auto ovunque, controlla cosa manca,
 * mostra lo stato per portale e guida le operazioni manuali.
 */
export function SezionePortali({ veicolo }: { veicolo: VehicleView }) {
  const { isManager } = useSessione();
  const catalogo = useCatalogoPortali();
  const portaliOrg = usePortaliOrg(isManager);
  const [inCorso, setInCorso] = useState(false);
  const annunci = useAnnunciVeicolo(veicolo.id, inCorso);
  const ids = useMemo(() => (annunci.data ?? []).map((a) => a.id), [annunci.data]);
  const coda = useCodaVeicolo(veicolo.id, ids, isManager);
  const qualita = useControlloQualita(veicolo.id, isManager);
  const pubblica = usePubblicaOvunque();

  const jobs = coda.data ?? [];
  const attivo = jobs.length > 0 || annunci.data?.some((a) => a.stato === "in_pubblicazione" && !a.azione_manuale);
  useEffect(() => setInCorso(!!attivo), [attivo]);

  // Righe da mostrare: per i manager i portali attivi della concessionaria (più quelli con un annuncio);
  // per gli altri ruoli solo gli annunci esistenti, in sola lettura.
  const righe = useMemo(() => {
    const perPortale = new Map((annunci.data ?? []).map((a) => [a.portal_id, a]));
    const catalogoPerId = new Map((catalogo.data ?? []).map((p) => [p.id, p]));
    if (isManager) {
      return (portaliOrg.data ?? [])
        .filter((op) => op.attivo || perPortale.has(op.portal_id))
        .map((op) => ({ portale: op.portals, org: op as PortaleOrg | undefined, annuncio: perPortale.get(op.portal_id) }));
    }
    return (annunci.data ?? [])
      .filter((a) => catalogoPerId.has(a.portal_id))
      .map((a) => ({ portale: catalogoPerId.get(a.portal_id)!, org: undefined, annuncio: a as VehicleListing | undefined }))
      .sort((x, y) => x.portale.ordine - y.portale.ordine);
  }, [annunci.data, catalogo.data, portaliOrg.data, isManager]);

  const venduta = veicolo.stato === "venduto";

  async function pubblicaOvunque() {
    try {
      const esito = await pubblica.mutateAsync(veicolo.id);
      const avviati = esito.filter((e) => e.avviata).length;
      const saltati = esito.filter((e) => !e.avviata).length;
      if (!esito.length) toast.info("Nessun portale attivo: attivali in Impostazioni → Portali.");
      else if (!saltati) toast.success(`Pubblicazione avviata su ${avviati} ${avviati === 1 ? "portale" : "portali"}`);
      else toast.warning(`Avviata su ${avviati}, saltata su ${saltati}: completa i dati indicati qui sotto.`);
    } catch (e) {
      mostraErrore(e, "Non sono riuscito ad avviare la pubblicazione.");
    }
  }

  const caricamento = annunci.isLoading || catalogo.isLoading || (isManager && portaliOrg.isLoading);

  return (
    <Section
      title="Portali"
      action={
        isManager && !venduta ? (
          <Button size="sm" variant="accent" onClick={pubblicaOvunque} disabled={pubblica.isPending || !righe.length}>
            {pubblica.isPending ? <Spinner /> : <Rocket aria-hidden />}
            Pubblica ovunque
          </Button>
        ) : undefined
      }
    >
      <p className="mb-4 text-[15px] text-muted-foreground">
        Carichi l'auto una volta: prezzo, foto e stato restano allineati su tutti i portali.
        {venduta && " L'auto è venduta: gli annunci vengono tolti da tutti i portali."}
      </p>

      {isManager && !venduta && <ControlloQualitaBox veicolo={veicolo} righe={qualita.data} caricamento={qualita.isLoading} />}

      {caricamento ? (
        <ListSkeleton rows={3} />
      ) : righe.length === 0 ? (
        <div className="rounded-lg border border-dashed p-5 text-center text-[15px] text-muted-foreground">
          {isManager ? (
            <>
              Nessun portale attivo.{" "}
              <Link to="/impostazioni?tab=portali" className="font-semibold text-accent hover:underline">
                Attiva i portali in Impostazioni
              </Link>
            </>
          ) : (
            "Quest'auto non è ancora pubblicata sui portali."
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {righe.map(({ portale, org, annuncio }) => (
            <RigaPortale
              key={portale.id}
              veicolo={veicolo}
              portale={portale}
              org={org}
              annuncio={annuncio}
              job={jobs.find((j) => j.listing_id === annuncio?.id)}
              problemi={qualita.data?.find((q) => q.portal_id === portale.id)}
              modificabile={isManager}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}

/* ---------- Controllo qualità ---------- */

function ControlloQualitaBox({ veicolo, righe, caricamento }: { veicolo: VehicleView; righe?: ControlloQualita[]; caricamento: boolean }) {
  if (caricamento || !righe?.length) return null;
  const daSistemare = righe.filter((r) => r.problemi.length);
  if (!daSistemare.length) {
    return (
      <p className="mb-4 flex items-center gap-2 rounded-lg bg-success-soft px-4 py-3 text-[15px] font-medium text-success">
        <CheckCircle2 className="size-5 shrink-0" aria-hidden />
        Scheda completa: l'auto è pronta per tutti i portali attivi.
      </p>
    );
  }
  // Raggruppa per problema: "Servono almeno 4 foto" → AutoScout24, Subito
  const perProblema = new Map<string, { portali: string[]; bloccante: boolean }>();
  for (const r of daSistemare) {
    for (const p of r.problemi) {
      const voce = perProblema.get(p) ?? { portali: [], bloccante: !r.pronto };
      voce.portali.push(r.portale);
      perProblema.set(p, voce);
    }
  }
  const manca = (testo: string) => /foto/i.test(testo) ? "foto" : /descrizione/i.test(testo) ? "descrizione" : "dati";
  return (
    <div className="mb-4 rounded-lg border border-warning/30 bg-warning-soft p-4">
      <p className="flex items-center gap-2 font-semibold text-warning">
        <AlertTriangle className="size-5 shrink-0" aria-hidden />
        Prima di pubblicare
      </p>
      <ul className="mt-2 space-y-2 text-[15px]">
        {[...perProblema.entries()].map(([problema, { portali }]) => (
          <li key={problema} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span>
              <span className="font-medium">{problema}</span>
              <span className="text-muted-foreground"> · {portali.join(", ")}</span>
            </span>
            {manca(problema) === "foto" ? (
              <Link to={`/stock/${veicolo.id}?tab=scheda`} className="text-sm font-semibold text-accent hover:underline">
                Aggiungi foto
              </Link>
            ) : manca(problema) === "descrizione" ? (
              <a href="#descrizioni-annuncio" className="text-sm font-semibold text-accent hover:underline">
                Scrivi o genera la descrizione
              </a>
            ) : (
              <Link to={`/stock/${veicolo.id}/modifica`} className="text-sm font-semibold text-accent hover:underline">
                Completa la scheda
              </Link>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-muted-foreground">
        «Pubblica ovunque» pubblica sui portali pronti e salta gli altri finché non completi i dati.
      </p>
    </div>
  );
}

/* ---------- Riga portale ---------- */

function RigaPortale({
  veicolo,
  portale,
  org,
  annuncio,
  job,
  problemi,
  modificabile,
}: {
  veicolo: VehicleView;
  portale: Portal;
  org?: PortaleOrg;
  annuncio?: VehicleListing;
  job?: SyncJob;
  problemi?: ControlloQualita;
  modificabile: boolean;
}) {
  const interruttore = useInterruttoreAnnuncio();
  const riprova = useRiprovaPortale();
  const stato = annuncio && annuncio.attivo ? STATI_ANNUNCIO[annuncio.stato] : STATI_ANNUNCIO.bozza;
  const modalita = org?.modalita;
  const acceso = !!annuncio?.attivo;
  const venduta = veicolo.stato === "venduto";

  async function cambia(attivo: boolean) {
    try {
      await interruttore.mutateAsync({ vehicleId: veicolo.id, portalId: portale.id, attivo, esistente: annuncio });
      toast.success(attivo ? `Pubblicazione su ${portale.nome} avviata` : `Annuncio su ${portale.nome} in rimozione`);
    } catch (e) {
      mostraErrore(e);
    }
  }

  async function aggiornaOra() {
    try {
      await riprova.mutateAsync({ vehicleId: veicolo.id, portalId: portale.id });
      toast.success(`Richiesta inviata a ${portale.nome}`);
    } catch (e) {
      mostraErrore(e);
    }
  }

  return (
    <li className={cn("rounded-lg border p-4", annuncio?.stato === "errore" && acceso && "border-destructive/40")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-[16px] font-semibold">{portale.nome}</span>
            <Badge tone={stato.tone} size="sm">{stato.label}</Badge>
            {annuncio?.prezzo_portale != null && acceso && (
              <Badge tone="blue" size="sm" dot={false}>
                <Tag className="size-3" aria-hidden /> {euro(annuncio.prezzo_portale)}
              </Badge>
            )}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {modalita ? MODALITA_PORTALE[modalita].label : "—"}
            {annuncio?.ultimo_sync_at && ` · aggiornato ${relativo(annuncio.ultimo_sync_at)}`}
          </p>
        </div>
        {modificabile && (
          <Switch
            id={`portale-${portale.id}`}
            checked={acceso}
            onChange={cambia}
            label={acceso ? "Attivo" : "Spento"}
          />
        )}
      </div>

      {job && (
        <p className="mt-3 flex items-center gap-2 text-sm font-medium text-accent">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {OPERAZIONI[job.operazione]}
          {job.tentativi > 0 && job.errore && <span className="text-muted-foreground">(nuovo tentativo, {job.tentativi}°)</span>}
        </p>
      )}

      {acceso && annuncio?.stato === "errore" && annuncio.errore_messaggio && (
        <div className="mt-3 flex flex-col gap-2 rounded-md bg-destructive-soft px-3 py-2.5 text-[15px] text-destructive sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {annuncio.errore_messaggio}
          </span>
          {modificabile && (
            <Button size="xs" variant="outline" onClick={aggiornaOra} disabled={riprova.isPending}>
              <RefreshCw aria-hidden /> Riprova
            </Button>
          )}
        </div>
      )}

      {acceso && problemi && !problemi.pronto && annuncio?.stato !== "pubblicato" && (
        <p className="mt-2 text-sm text-warning">Da completare: {problemi.problemi.join(" · ")}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {annuncio?.url && (
          <a href={annuncio.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">
            <ExternalLink className="size-4" aria-hidden /> Apri l'annuncio
          </a>
        )}
        {annuncio?.visualizzazioni != null && (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Eye className="size-4" aria-hidden /> {annuncio.visualizzazioni.toLocaleString("it-IT")} visite
          </span>
        )}
        {annuncio?.contatti != null && (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <MessageSquare className="size-4" aria-hidden /> {annuncio.contatti} contatti
          </span>
        )}
        {modificabile && acceso && modalita !== "manuale" && annuncio?.stato === "pubblicato" && !job && (
          <button type="button" onClick={aggiornaOra} disabled={riprova.isPending} className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground">
            <RefreshCw className="size-4" aria-hidden /> Aggiorna ora
          </button>
        )}
      </div>

      {modificabile && acceso && annuncio && !venduta && <PrezzoPortale veicolo={veicolo} annuncio={annuncio} />}

      {modificabile && annuncio && (annuncio.azione_manuale || (modalita === "manuale" && acceso && annuncio.stato === "in_pubblicazione")) && (
        <ManualeBox veicolo={veicolo} portale={portale} annuncio={annuncio} />
      )}
    </li>
  );
}

/* ---------- Prezzo per portale ---------- */

function PrezzoPortale({ veicolo, annuncio }: { veicolo: VehicleView; annuncio: VehicleListing }) {
  const salva = usePrezzoPortale();
  const [aperto, setAperto] = useState(annuncio.prezzo_portale != null);
  const [valore, setValore] = useState(annuncio.prezzo_portale != null ? String(annuncio.prezzo_portale) : "");
  const listino = veicolo.prezzo_vendita ?? 0;
  const numero = valore.trim() === "" ? null : numeroIt(valore);
  const valido = numero === null || (Number.isFinite(numero) && numero > 0);
  const differenza = numero != null && valido ? numero - listino : 0;

  async function conferma() {
    if (!valido) return toast.error("Prezzo non valido");
    try {
      await salva.mutateAsync({ listingId: annuncio.id, prezzo: aNumero(valore) });
      toast.success(numero == null ? "Torna al prezzo di listino" : "Prezzo del portale salvato: l'annuncio verrà aggiornato");
    } catch (e) {
      mostraErrore(e);
    }
  }

  if (!aperto) {
    return (
      <button type="button" onClick={() => setAperto(true)} className="mt-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        Prezzo diverso su questo portale…
      </button>
    );
  }
  return (
    <div className="mt-3 flex flex-wrap items-end gap-2">
      <label className="min-w-0 flex-1 basis-40 text-sm">
        <span className="mb-1 block font-medium">Prezzo su questo portale</span>
        <Input
          id={`prezzo-${annuncio.id}`}
          inputMode="decimal"
          className="h-10"
          placeholder={`Listino: ${euro(listino)}`}
          value={valore}
          onChange={(e) => setValore(e.target.value)}
          aria-invalid={!valido}
        />
      </label>
      <span className={cn("pb-2.5 text-sm tabular-nums", differenza > 0 ? "text-success" : differenza < 0 ? "text-warning" : "text-muted-foreground")}>
        {numero == null ? "= listino" : valido ? `${differenza >= 0 ? "+" : "−"}${euro(Math.abs(differenza))} sul listino` : "non valido"}
      </span>
      <Button size="sm" variant="outline" onClick={conferma} disabled={salva.isPending || !valido}>
        {salva.isPending && <Spinner className="size-4 animate-spin" />}
        Salva
      </Button>
    </div>
  );
}

/* ---------- Modalità manuale assistita ---------- */

function testoAnnuncio(v: VehicleView) {
  const dati = [
    v.anno && `Anno: ${v.mese_immatricolazione ? `${String(v.mese_immatricolazione).padStart(2, "0")}/` : ""}${v.anno}`,
    `Chilometri: ${km(v.km)}`,
    v.alimentazione && `Alimentazione: ${ALIMENTAZIONI[v.alimentazione]}`,
    v.cambio && `Cambio: ${CAMBI[v.cambio]}`,
    v.potenza_kw && `Potenza: ${v.potenza_kw} kW (${Math.round(v.potenza_kw * 1.35962)} CV)`,
    v.colore && `Colore: ${v.colore}`,
  ].filter(Boolean);
  return [titoloAnnuncio(v), `Prezzo: ${euro(v.prezzo_vendita)}`, "", ...dati, "", descrizioneAnnuncio(v)].join("\n");
}
const titoloAnnuncio = (v: VehicleView) => [v.marca, v.modello, v.versione].filter(Boolean).join(" ");
const descrizioneAnnuncio = (v: VehicleView) => `${(v.descrizione ?? "").trim()}\n\nRif. ${v.riferimento}`.trim();

async function copiaConAvviso(testo: string, cosa: string) {
  if (await copia(testo)) toast.success(`${cosa} copiato`);
  else toast.error("Non riesco a copiare: seleziona il testo e copialo a mano.");
}

function ManualeBox({ veicolo, portale, annuncio }: { veicolo: VehicleView; portale: Portal; annuncio: VehicleListing }) {
  const conferma = useConfermaManuale();
  const azione = annuncio.azione_manuale ?? "pubblica";
  const info = AZIONI_MANUALI[azione];
  const [url, setUrl] = useState(annuncio.url ?? "");
  const [zip, setZip] = useState(false);
  const serveUrl = azione === "pubblica" && !annuncio.url;
  const urlValido = !url.trim() || /^https?:\/\/\S+$/i.test(url.trim());

  async function fatto() {
    if (serveUrl && !url.trim()) return toast.error("Incolla l'indirizzo dell'annuncio pubblicato sul portale");
    if (!urlValido) return toast.error("Indirizzo non valido: deve iniziare con https://");
    try {
      await conferma.mutateAsync({ listingId: annuncio.id, url: url.trim() && url.trim() !== annuncio.url ? url : undefined });
      toast.success(azione === "rimuovi" ? `Annuncio tolto da ${portale.nome}` : `${portale.nome} aggiornato`);
    } catch (e) {
      mostraErrore(e);
    }
  }

  async function scaricaFoto() {
    setZip(true);
    try {
      const { data: foto, error } = await supabase.from("vehicle_photos").select("storage_path").eq("vehicle_id", veicolo.id).order("ordine").order("created_at");
      if (error) throw error;
      if (!foto?.length) {
        toast.error("Quest'auto non ha foto: caricale dalla Scheda tecnica.");
        return;
      }
      const limite = foto.slice(0, portale.foto_max);
      const { data: firmati, error: e2 } = await supabase.storage.from(BUCKET_FOTO).createSignedUrls(limite.map((f) => f.storage_path), 600);
      if (e2) throw e2;
      const file: Record<string, Uint8Array> = {};
      let n = 0;
      for (const f of firmati ?? []) {
        if (!f.signedUrl) continue;
        const res = await fetch(f.signedUrl);
        if (!res.ok) continue;
        n++;
        file[`${String(n).padStart(2, "0")}.jpg`] = new Uint8Array(await res.arrayBuffer());
      }
      if (!n) {
        toast.error("Non sono riuscito a scaricare le foto. Riprova tra poco.");
        return;
      }
      const blob = new Blob([zipSync(file, { level: 0 }) as BlobPart], { type: "application/zip" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${titoloAnnuncio(veicolo).replace(/[^\w-]+/g, "-")}-foto.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
      toast.success(`${n} foto pronte da caricare su ${portale.nome}`);
    } catch (e) {
      mostraErrore(e, "Download delle foto non riuscito.");
    } finally {
      setZip(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-accent/30 bg-accent-soft p-4">
      <p className="font-semibold text-accent">Da fare: {info.label.toLowerCase()} su {portale.nome}</p>
      <p className="mt-1 text-[15px]">{info.istruzione}</p>
      {azione !== "rimuovi" && azione !== "sospendi" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => copiaConAvviso(testoAnnuncio(veicolo), "Annuncio")}>
            <ClipboardCopy aria-hidden /> Copia annuncio
          </Button>
          <Button size="sm" variant="ghost" onClick={() => copiaConAvviso(titoloAnnuncio(veicolo), "Titolo")}>
            Copia titolo
          </Button>
          <Button size="sm" variant="ghost" onClick={() => copiaConAvviso(descrizioneAnnuncio(veicolo), "Descrizione")}>
            Copia descrizione
          </Button>
          <Button size="sm" variant="outline" onClick={scaricaFoto} disabled={zip}>
            {zip ? <Spinner className="size-4 animate-spin" /> : <Download aria-hidden />}
            Scarica foto (zip)
          </Button>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        {azione !== "rimuovi" && (
          <label className="min-w-0 flex-1 basis-56 text-sm">
            <span className="mb-1 block font-medium">Indirizzo dell'annuncio{serveUrl ? "" : " (facoltativo)"}</span>
            <Input
              id={`url-${annuncio.id}`}
              type="url"
              inputMode="url"
              className="h-10"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              aria-invalid={!urlValido}
            />
          </label>
        )}
        <Button size="sm" onClick={fatto} disabled={conferma.isPending}>
          {conferma.isPending && <Spinner className="size-4 animate-spin" />}
          Fatto
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Il riferimento {veicolo.riferimento} nella descrizione collega in automatico all'auto i contatti che arrivano dal portale.</p>
    </div>
  );
}
