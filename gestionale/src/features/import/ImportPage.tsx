import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Download, FileSpreadsheet, Plus, Sparkles, Undo2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { BackLink } from "@/components/shared/BackLink";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageHeader } from "@/components/shared/PageHeader";
import { useAuth } from "@/features/auth/AuthProvider";
import { useQuery } from "@/hooks/useQuery";
import { friendlyError } from "@/lib/errors";
import { formatRelative } from "@/lib/format";
import type { Tone } from "@/lib/labels";
import { MAX_ROWS, readSpreadsheet, type Sheet } from "@/lib/spreadsheet";
import { cn } from "@/lib/utils";
import { countContacts, createJob, discardedRows, getJob, listJobs, preview, processStep, start, suggestMapping, undo } from "@/services/imports";
import type { DuplicateOption, ImportJob, ImportPreview, ImportState, PreviewRow } from "@/types/imports";
import { fieldLabel, fields, importTypes, type ImportType } from "./fields";

const stateLabel: Record<ImportState, { label: string; tone: Tone }> = {
  caricato: { label: "Non avviata", tone: "gray" },
  mappatura: { label: "Non avviata", tone: "gray" },
  anteprima: { label: "Non avviata", tone: "gray" },
  in_corso: { label: "In corso", tone: "sky" },
  completato: { label: "Completata", tone: "green" },
  annullato: { label: "Annullata", tone: "orange" },
  errore: { label: "Non riuscita", tone: "red" },
};

const typeLabel = (t: ImportType) => importTypes.find((x) => x.id === t)?.label ?? t;
const n = (x: number) => x.toLocaleString("it-IT");
const canUndo = (j: ImportJob) => j.state === "completato" && !!j.completedAt && Date.now() - new Date(j.completedAt).getTime() < 24 * 3600_000;

type View = { kind: "lista" } | { kind: "nuova" } | { kind: "lavoro"; jobId: string };

/** Impostazioni → Importa i tuoi dati: dal vecchio gestionale o da Excel, in quattro passi */
export function ImportPage() {
  const { isOwner } = useAuth();
  const [view, setView] = useState<View>({ kind: "lista" });

  if (!isOwner)
    return (
      <div className="mx-auto max-w-3xl">
        <BackLink to="/impostazioni" label="Impostazioni" />
        <EmptyState art="persone" title="Solo il titolare può importare dati" text="Chiedi al titolare dell'agenzia di caricare il file." />
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl">
      {view.kind === "lista" ? (
        <>
          <BackLink to="/impostazioni" label="Impostazioni" />
          <PageHeader
            title="Importa i tuoi dati"
            subtitle="Porta in Mattonio contatti, richieste e immobili da un file Excel o CSV"
            action={
              <Button size="lg" onClick={() => setView({ kind: "nuova" })}>
                <Plus aria-hidden />
                Nuova importazione
              </Button>
            }
          />
          <JobList onOpen={(id) => setView({ kind: "lavoro", jobId: id })} onNew={() => setView({ kind: "nuova" })} />
        </>
      ) : view.kind === "nuova" ? (
        <Wizard onCancel={() => setView({ kind: "lista" })} onStarted={(id) => setView({ kind: "lavoro", jobId: id })} />
      ) : (
        <JobView jobId={view.jobId} onBack={() => setView({ kind: "lista" })} />
      )}
    </div>
  );
}

/* ---------- Elenco delle importazioni fatte ---------- */

function JobList({ onOpen, onNew }: { onOpen: (id: string) => void; onNew: () => void }) {
  const { data, loading, error, reload } = useQuery(listJobs);
  if (loading) return <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const jobs = (data ?? []).filter((j) => !["caricato", "mappatura", "anteprima"].includes(j.state));
  if (!jobs.length)
    return (
      <EmptyState
        art="persone"
        title="Nessuna importazione ancora"
        text="Esporta i dati dal vecchio gestionale in Excel: ti guidiamo noi passo per passo. Puoi sempre annullare entro 24 ore."
        action={
          <Button size="lg" onClick={onNew}>
            <Upload aria-hidden />
            Carica il primo file
          </Button>
        }
      />
    );
  return (
    <ul className="space-y-3">
      {jobs.map((j) => (
        <li key={j.id}>
          <button type="button" onClick={() => onOpen(j.id)} className="w-full rounded-lg border bg-card p-4 text-left shadow-card hover:border-primary/40">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-[17px] font-semibold">{typeLabel(j.type)}</span>
              <Badge tone={stateLabel[j.state].tone}>{stateLabel[j.state].label}</Badge>
            </span>
            <span className="mt-1 block truncate text-muted-foreground">
              {j.fileName} · {formatRelative(j.createdAt)}
            </span>
            {j.state !== "in_corso" && (
              <span className="mt-1 block text-[15px]">
                {n(j.imported)} importate{j.updated ? ` · ${n(j.updated)} aggiornate` : ""} · {n(j.skipped + j.discarded)} non importate
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ---------- I quattro passi ---------- */

const steps = ["Tipo", "File", "Colonne", "Controllo"];

function Wizard({ onCancel, onStarted }: { onCancel: () => void; onStarted: (id: string) => void }) {
  const [step, setStep] = useState(1);
  const [type, setType] = useState<ImportType>("contatti");
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [suggested, setSuggested] = useState<{ mapping: Record<string, string>; ai: boolean } | null>(null);

  return (
    <div>
      <button type="button" onClick={onCancel} className="mb-3 inline-flex min-h-12 items-center gap-1 text-[17px] font-medium text-primary-strong">
        <ArrowLeft className="size-5" aria-hidden />
        Torna alle importazioni
      </button>
      <PageHeader title="Nuova importazione" subtitle={step === 1 ? "Quattro passi, e puoi sempre annullare entro 24 ore" : `${typeLabel(type)}${sheet ? ` · ${n(sheet.rows.length)} righe` : ""}`} />
      <ol className="mb-6 grid grid-cols-4 gap-2" aria-label="Passaggi">
        {steps.map((l, i) => (
          <li
            key={l}
            aria-current={step === i + 1 ? "step" : undefined}
            className={cn(
              "flex h-11 items-center justify-center rounded-lg border px-1 text-center text-[15px] font-semibold",
              step === i + 1 ? "border-primary bg-primary-soft text-primary-strong" : step > i + 1 ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {step > i + 1 && <Check className="mr-1 size-4" aria-hidden />}
            {l}
          </li>
        ))}
      </ol>

      {step === 1 && <TypeStep type={type} onChange={setType} onNext={() => setStep(2)} />}
      {step === 2 && (
        <FileStep
          type={type}
          onBack={() => setStep(1)}
          onReady={(s, j, sug) => {
            setSheet(s);
            setJob(j);
            setSuggested(sug);
            setMapping(sug.mapping);
            setStep(3);
          }}
        />
      )}
      {step === 3 && sheet && suggested && (
        <MappingStep type={type} sheet={sheet} mapping={mapping} suggested={suggested} onChange={setMapping} onBack={() => setStep(2)} onNext={() => setStep(4)} />
      )}
      {step === 4 && job && sheet && <PreviewStep type={type} job={job} total={sheet.rows.length} mapping={mapping} onBack={() => setStep(3)} onStarted={() => onStarted(job.id)} />}
    </div>
  );
}

function TypeStep({ type, onChange, onNext }: { type: ImportType; onChange: (t: ImportType) => void; onNext: () => void }) {
  const contacts = useQuery(countContacts);
  const noContacts = contacts.data === 0 && type !== "contatti";
  return (
    <div className="space-y-4">
      <p className="text-[17px]">Cosa vuoi importare? Ti consigliamo quest'ordine, così tutto si collega alle persone giuste.</p>
      <div className="space-y-2" role="radiogroup" aria-label="Cosa importare">
        {importTypes.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={type === t.id}
            onClick={() => onChange(t.id)}
            className={cn(
              "flex min-h-16 w-full items-center gap-4 rounded-lg border px-4 py-3 text-left",
              type === t.id ? "border-primary bg-primary-soft text-primary-strong" : "bg-card",
            )}
          >
            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full text-[15px] font-bold", type === t.id ? "bg-primary text-primary-foreground" : "bg-muted")}>
              {t.order}
            </span>
            <span className="min-w-0">
              <span className="block text-[17px] font-semibold">{t.label}</span>
              <span className="block text-[15px] text-muted-foreground">{t.hint}</span>
            </span>
          </button>
        ))}
      </div>
      {noContacts && (
        <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-[15px] text-amber-950">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p>
            Non hai ancora contatti in Mattonio. Ti consigliamo di <strong>importare prima i contatti</strong>: {type === "richieste" ? "ogni richiesta va collegata al suo cliente, altrimenti la scartiamo." : "così colleghiamo proprietari e clienti alle persone giuste invece di crearne di nuove."}
          </p>
        </div>
      )}
      <Button size="lg" className="w-full" onClick={onNext}>
        Avanti
        <ArrowRight aria-hidden />
      </Button>
    </div>
  );
}

function FileStep({
  type,
  onBack,
  onReady,
}: {
  type: ImportType;
  onBack: () => void;
  onReady: (s: Sheet, j: ImportJob, sug: { mapping: Record<string, string>; ai: boolean }) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [pct, setPct] = useState(0);

  async function handle(file: File | undefined) {
    if (!file || busy) return;
    setBusy("Leggo il file…");
    try {
      const sheet = await readSpreadsheet(file);
      setBusy(`Carico ${n(sheet.rows.length)} righe e riconosco le colonne…`);
      const [job, sug] = await Promise.all([createJob(type, file, sheet, setPct), suggestMapping(type, sheet)]);
      onReady(sheet, job, sug);
    } catch (err) {
      toast.error("Non riesco a usare questo file", { description: err instanceof Error && !("code" in err) ? err.message : friendlyError(err) });
      setBusy(null);
      setPct(0);
    }
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handle(e.dataTransfer.files[0]);
        }}
        className={cn("flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center", drag ? "border-primary bg-primary-soft" : "bg-card")}
      >
        <FileSpreadsheet className="size-12 text-primary" aria-hidden />
        {busy ? (
          <div className="w-full max-w-sm space-y-3" aria-live="polite">
            <p className="text-[17px] font-medium">{busy}</p>
            <Progress value={pct} />
          </div>
        ) : (
          <>
            <p className="text-[17px] font-semibold">Trascina qui il file</p>
            <p className="text-muted-foreground">oppure</p>
            <Button size="lg" onClick={() => input.current?.click()}>
              <Upload aria-hidden />
              Scegli il file
            </Button>
            <p className="text-[15px] text-muted-foreground">Excel (.xlsx) o CSV · fino a {n(MAX_ROWS)} righe · la prima riga deve avere i titoli delle colonne</p>
          </>
        )}
        <input
          ref={input}
          type="file"
          accept=".xlsx,.csv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          aria-label="File da importare"
          onChange={(e) => handle(e.target.files?.[0])}
        />
      </div>
      <p className="text-[15px] text-muted-foreground">Il file resta privato nella cartella della tua agenzia e viene eliminato da solo dopo 30 giorni.</p>
      <Button variant="outline" size="lg" onClick={onBack} disabled={!!busy}>
        <ArrowLeft aria-hidden />
        Indietro
      </Button>
    </div>
  );
}

function MappingStep({
  type,
  sheet,
  mapping,
  suggested,
  onChange,
  onBack,
  onNext,
}: {
  type: ImportType;
  sheet: Sheet;
  mapping: Record<string, string>;
  suggested: { mapping: Record<string, string>; ai: boolean };
  onChange: (m: Record<string, string>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const list = fields[type];
  const used = new Set(Object.values(mapping).filter(Boolean));
  const missing = list.filter((f) => f.required && !used.has(f.key) && !(f.key === "nome" && (used.has("nome_completo") || used.has("cognome_nome"))) && !(f.key === "data" && used.has("data_ora")));
  const recognized = sheet.headers.filter((h) => mapping[h]).length;

  return (
    <div className="space-y-4">
      <p className="text-[17px]">
        {suggested.ai ? "L'assistente ha letto il file e" : "Abbiamo"} riconosciuto <strong>{recognized} colonne su {sheet.headers.length}</strong>. Controlla e correggi se serve: le colonne che non importi finiscono nelle note, non si perde nulla.
      </p>
      <ul className="space-y-3">
        {sheet.headers.map((h, c) => {
          const samples = sheet.rows.map((r) => r[c]).filter(Boolean).slice(0, 3);
          const auto = !!mapping[h] && suggested.mapping[h] === mapping[h];
          return (
            <li key={h} className="rounded-lg border bg-card p-4">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <p className="text-[17px] font-semibold">{h}</p>
                {auto && (
                  <Badge tone={suggested.ai ? "violet" : "teal"} dot={false}>
                    {suggested.ai && <Sparkles className="size-3.5" aria-hidden />}
                    {suggested.ai ? "Proposta dall'AI" : "Riconosciuta"}
                  </Badge>
                )}
              </div>
              <p className="mb-3 truncate text-[15px] text-muted-foreground">{samples.length ? `Es. ${samples.join(" · ")}` : "Colonna vuota"}</p>
              <Select aria-label={`Dove va la colonna ${h}`} value={mapping[h] ?? ""} onChange={(e) => onChange({ ...mapping, [h]: e.target.value })}>
                <option value="">Non importare (va nelle note)</option>
                {list.map((f) => (
                  <option key={f.key} value={f.key} disabled={f.key !== "note" && used.has(f.key) && mapping[h] !== f.key}>
                    {f.label}
                    {f.required ? " (obbligatorio)" : ""}
                  </option>
                ))}
              </Select>
            </li>
          );
        })}
      </ul>
      {missing.length > 0 && (
        <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-[15px] text-amber-950">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p>
            Manca {missing.map((f) => `"${f.label}"`).join(", ")}: le righe senza questo dato verranno scartate. Se il file ha la colonna, sceglila qui sopra.
          </p>
        </div>
      )}
      <div className="flex gap-3">
        <Button variant="outline" size="lg" onClick={onBack}>
          <ArrowLeft aria-hidden />
          Indietro
        </Button>
        <Button size="lg" className="flex-1" onClick={onNext}>
          Controlla i dati
          <ArrowRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}

const dupOptions: { id: DuplicateOption; label: string; hint: string }[] = [
  { id: "salta", label: "Saltali", hint: "Teniamo quelli che hai già in Mattonio (consigliato)" },
  { id: "aggiorna", label: "Completa i campi vuoti", hint: "Aggiungiamo solo i dati che mancano, senza cancellare nulla" },
  { id: "crea", label: "Creali comunque", hint: "Avrai due schede per la stessa persona o lo stesso immobile" },
];

function PreviewStep({
  type,
  job,
  total,
  mapping,
  onBack,
  onStarted,
}: {
  type: ImportType;
  job: ImportJob;
  total: number;
  mapping: Record<string, string>;
  onBack: () => void;
  onStarted: () => void;
}) {
  const [dup, setDup] = useState<DuplicateOption>("salta");
  const [data, setData] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    preview(job.id, mapping, "salta")
      .then((p) => alive && setData(p))
      .catch((e) => alive && setError(friendlyError(e)));
    return () => {
      alive = false;
    };
  }, [job.id, mapping]);

  async function go() {
    setBusy(true);
    try {
      await start(job.id, mapping, dup);
      onStarted();
    } catch (err) {
      toast.error("Importazione non avviata", { description: friendlyError(err) });
      setBusy(false);
    }
  }

  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  if (!data)
    return (
      <div className="space-y-3" aria-live="polite">
        <p className="text-[17px]">Pulisco e controllo {n(total)} righe…</p>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );

  const toImport = data.valid + (dup === "salta" ? 0 : data.duplicates);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        <Count label="Pronte" value={data.valid} tone="text-emerald-700" />
        <Count label="Già presenti" value={data.duplicates} tone="text-amber-700" />
        <Count label="Con errori" value={data.errors} tone="text-red-700" />
      </div>

      {data.duplicates > 0 && (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-[17px] font-semibold">
            {data.duplicates === 1
              ? `1 ${type === "contatti" ? "contatto" : "riga"} è già presente`
              : `${n(data.duplicates)} ${type === "contatti" ? "contatti" : "righe"} sono già presenti`}
            {type === "contatti" ? " (stesso telefono o stessa email)" : ""}. Cosa facciamo?
          </legend>
          {dupOptions.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={dup === o.id}
              onClick={() => setDup(o.id)}
              className={cn("flex min-h-12 w-full flex-col rounded-lg border px-4 py-2 text-left", dup === o.id ? "border-primary bg-primary-soft text-primary-strong" : "bg-card")}
            >
              <span className="text-[17px] font-semibold">{o.label}</span>
              <span className="text-[15px] text-muted-foreground">{o.hint}</span>
            </button>
          ))}
        </fieldset>
      )}

      <div>
        <p className="mb-2 text-[17px] font-semibold">Così diventano le prime {data.rows.length} righe</p>
        <ul className="space-y-2">
          {data.rows.map((r) => (
            <PreviewCard key={r.number} type={type} row={r} />
          ))}
        </ul>
      </div>

      {data.errors > 0 && <p className="text-[15px] text-muted-foreground">Le righe con errori non vengono importate: alla fine puoi scaricarle in Excel con il motivo, correggerle e ricaricarle.</p>}

      <div className="flex gap-3">
        <Button variant="outline" size="lg" onClick={onBack} disabled={busy}>
          <ArrowLeft aria-hidden />
          Indietro
        </Button>
        <Button size="lg" className="flex-1" onClick={go} disabled={busy || toImport === 0}>
          <Check aria-hidden />
          {busy ? "Avvio…" : `Importa ${n(toImport)} ${toImport === 1 ? "riga" : "righe"}`}
        </Button>
      </div>
    </div>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <p className={cn("text-2xl font-bold", tone)}>{n(value)}</p>
      <p className="text-[15px] text-muted-foreground">{label}</p>
    </div>
  );
}

const extraLabels: Record<string, string> = { inizio: "Quando", durata: "Durata (minuti)", immobili: "Immobile", tipo: "Tipo" };

function show(v: unknown): string {
  if (v == null || v === "") return "";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "number") return v.toLocaleString("it-IT");
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return new Date(v).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" });
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function PreviewCard({ type, row }: { type: ImportType; row: PreviewRow }) {
  const d = row.data;
  const title =
    type === "contatti"
      ? `${show(d.nome)} ${show(d.cognome)}`.trim()
      : type === "immobili" || type === "acquisizioni"
        ? show(d.indirizzo)
        : type === "richieste"
          ? show(d.contatto_nome) || show(d.contatto_telefono) || show(d.contatto_email)
          : show(d.inizio) || show(d.data_ora);
  const skip = new Set(type === "contatti" ? ["nome", "cognome", "note"] : ["indirizzo", "note"]);
  const details = Object.entries(d)
    .filter(([k, v]) => !skip.has(k) && show(v) && show(v) !== title)
    .map(([k, v]) => `${extraLabels[k] ?? fieldLabel(type, k)}: ${show(v)}`);
  return (
    <li className={cn("rounded-lg border bg-card p-3", row.error && "border-red-200 bg-red-50/50")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Riga {row.number}</span>
        <span className="font-semibold">{title || "—"}</span>
        {row.error ? <Badge tone="red">{row.error}</Badge> : row.duplicate ? <Badge tone="amber">Già presente</Badge> : <Badge tone="green">Pronta</Badge>}
      </div>
      {details.length > 0 && <p className="mt-1 text-[15px]">{details.join(" · ")}</p>}
      {row.warnings.map((w) => (
        <p key={w} className="mt-1 text-[15px] text-amber-800">
          Attenzione: {w}
        </p>
      ))}
      {row.note && <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">Nelle note: {row.note.replace(/\n/g, " · ")}</p>}
    </li>
  );
}

/* ---------- Avanzamento e riepilogo ---------- */

function JobView({ jobId, onBack }: { jobId: string; onBack: () => void }) {
  const [job, setJob] = useState<ImportJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Finché la pagina è aperta, l'app importa un blocco alla volta; chiusa la pagina continua il server (ogni minuto)
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    async function loop() {
      try {
        let j = await getJob(jobId);
        if (!alive) return;
        setJob(j);
        if (j.state === "in_corso") {
          try {
            await processStep(jobId);
          } catch {
            // ci riprova il server: qui ci limitiamo a seguire l'avanzamento
            await new Promise((r) => setTimeout(r, 3000));
          }
          j = await getJob(jobId);
          if (!alive) return;
          setJob(j);
          if (j.state === "in_corso") timer = setTimeout(loop, 200);
        }
      } catch (e) {
        if (alive) setError(friendlyError(e));
      }
    }
    loop();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [jobId]);

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-3 inline-flex min-h-12 items-center gap-1 text-[17px] font-medium text-primary-strong">
        <ArrowLeft className="size-5" aria-hidden />
        Torna alle importazioni
      </button>
      {error ? (
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      ) : !job ? (
        <Skeleton className="h-40 w-full" />
      ) : job.state === "in_corso" ? (
        <Running job={job} />
      ) : (
        <Summary job={job} onChange={setJob} />
      )}
    </div>
  );
}

function Running({ job }: { job: ImportJob }) {
  const done = job.imported + job.updated + job.skipped + job.discarded;
  const pct = job.total ? (done / job.total) * 100 : 0;
  return (
    <Card>
      <CardContent className="space-y-4 py-6">
        <h1 className="text-xl font-bold">Sto importando {typeLabel(job.type).toLowerCase()}…</h1>
        <Progress value={pct} className="h-3" />
        <p className="text-[17px]" aria-live="polite">
          {n(done)} di {n(job.total)} righe ({Math.round(pct)}%)
        </p>
        <p className="rounded-lg bg-muted px-4 py-3 text-[15px]">
          Puoi chiudere la pagina o usare l'app: l'importazione continua da sola. Durante l'importazione non partono messaggi automatici ai clienti.
        </p>
      </CardContent>
    </Card>
  );
}

function Summary({ job, onChange }: { job: ImportJob; onChange: (j: ImportJob) => void }) {
  const [busy, setBusy] = useState<"excel" | "undo" | null>(null);
  const notImported = job.skipped + job.discarded;
  const link = job.type === "contatti" || job.type === "richieste" ? "/contatti" : job.type === "immobili" ? "/immobili" : job.type === "acquisizioni" ? "/trattative/acquisizioni" : "/agenda";

  async function excel() {
    setBusy("excel");
    try {
      const rows = await discardedRows(job.id);
      const headers = [...new Set(rows.flatMap((r) => Object.keys(r.original)))];
      const { default: writeXlsxFile } = await import("write-excel-file/browser");
      const bold = { fontWeight: "bold" as const };
      await writeXlsxFile([
        [{ value: "Riga", ...bold }, { value: "Motivo", ...bold }, ...headers.map((h) => ({ value: h, ...bold }))],
        ...rows.map((r) => [{ value: r.number }, { value: r.reason }, ...headers.map((h) => ({ value: r.original[h] ?? "" }))]),
      ]).toFile(`righe-non-importate-${job.fileName.replace(/\.[^.]+$/, "")}.xlsx`);
    } catch (err) {
      toast.error("File non creato", { description: friendlyError(err) });
    }
    setBusy(null);
  }

  async function cancel() {
    if (!window.confirm(`Annullare l'importazione? Eliminiamo le ${n(job.imported)} schede create da questo file (le altre restano come sono).`)) return;
    setBusy("undo");
    try {
      const removed = await undo(job.id);
      toast.success("Importazione annullata", { description: `${n(removed)} schede eliminate` });
      onChange({ ...job, state: "annullato" });
    } catch (err) {
      toast.error("Non annullata", { description: friendlyError(err) });
    }
    setBusy(null);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 py-6">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold">{job.state === "annullato" ? "Importazione annullata" : job.state === "completato" ? "Importazione completata" : "Importazione non riuscita"}</h1>
            <Badge tone={stateLabel[job.state].tone}>{stateLabel[job.state].label}</Badge>
          </div>
          <p className="text-muted-foreground">
            {typeLabel(job.type)} da {job.fileName}
          </p>
          <ul className="space-y-1 text-[17px]">
            <li>
              <strong>{n(job.imported)}</strong> {job.state === "annullato" ? "create e poi eliminate" : "create"}
            </li>
            {job.updated > 0 && (
              <li>
                <strong>{n(job.updated)}</strong> già presenti, completate nei campi vuoti
              </li>
            )}
            {job.skipped > 0 && (
              <li>
                <strong>{n(job.skipped)}</strong> già presenti, saltate
              </li>
            )}
            {job.discarded > 0 && (
              <li>
                <strong>{n(job.discarded)}</strong> scartate per un errore
              </li>
            )}
          </ul>
          {job.type === "contatti" && job.state === "completato" && (
            <p className="text-[15px] text-muted-foreground">I contatti importati non ricevono il messaggio di benvenuto automatico.</p>
          )}
        </CardContent>
      </Card>
      {job.state === "completato" && (
        <Button size="lg" className="w-full" asChild>
          <Link to={link}>
            Vai a {typeLabel(job.type).toLowerCase()}
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      )}
      {notImported > 0 && (
        <Button variant="outline" size="lg" className="w-full" onClick={excel} disabled={!!busy}>
          <Download aria-hidden />
          {busy === "excel" ? "Preparo il file…" : `Scarica le ${n(notImported)} righe non importate (Excel)`}
        </Button>
      )}
      {canUndo(job) && (
        <>
          <Button variant="ghost" size="lg" className="w-full text-destructive" onClick={cancel} disabled={!!busy}>
            <Undo2 aria-hidden />
            {busy === "undo" ? "Annullo…" : "Annulla importazione"}
          </Button>
          <p className="text-center text-[15px] text-muted-foreground">Puoi annullare fino a 24 ore dopo la fine dell'importazione.</p>
        </>
      )}
    </div>
  );
}
