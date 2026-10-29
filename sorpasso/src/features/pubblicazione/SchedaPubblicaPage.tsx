import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CalendarDays,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cog,
  Fuel,
  Gauge,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/shared/States";
import { Skeleton } from "@/components/ui/skeleton";
import { ALIMENTAZIONI, CAMBI, TIPI_VEICOLO } from "@/lib/labels";
import { kwInCv } from "@/lib/optional";
import { euro, toDateTimeLocal } from "@/lib/format";
import { linkTelefono } from "@/lib/messaggi";
import { ErroreLeggibile, mostraErrore } from "@/lib/errors";
import { telefono, testoObbligatorio } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { datiChiave, optionalRaggruppati, type AutoPubblica } from "./datiAuto";

/* ---------- Dati ---------- */

interface Salone {
  nome: string;
  logo_url: string | null;
  telefono: string | null;
  whatsapp: string | null;
  indirizzo: string | null;
  comune: string | null;
}
interface SchedaPubblica {
  auto: AutoPubblica;
  salone: Salone;
  foto: string[];
}

const URL_FUNZIONE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scheda-pubblica`;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const HEADERS = { apikey: ANON, Authorization: `Bearer ${ANON}` };

class SchedaNonTrovata extends Error {}

async function caricaScheda(token: string): Promise<SchedaPubblica> {
  const res = await fetch(`${URL_FUNZIONE}?t=${encodeURIComponent(token)}`, { headers: HEADERS });
  if (res.status === 404) throw new SchedaNonTrovata();
  if (!res.ok) throw new ErroreLeggibile("Non riusciamo a caricare la scheda. Riprova tra poco.");
  return res.json();
}

async function inviaRichiesta(body: Record<string, unknown>): Promise<{ ok: boolean; whatsapp: string | null }> {
  let res: Response;
  try {
    res = await fetch(URL_FUNZIONE, { method: "POST", headers: { ...HEADERS, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new ErroreLeggibile("Connessione assente. Controlla la rete e riprova.");
  }
  const dati = await res.json().catch(() => null);
  if (!res.ok) throw new ErroreLeggibile(dati?.error ?? "Invio non riuscito. Riprova tra poco.");
  return dati;
}

/* ---------- Pagina ---------- */

/**
 * Scheda pubblica dell'auto (/v/:token): vetrina per il cliente, senza login e senza dati interni.
 * "Scrivici su WhatsApp" e "Prenota test drive" creano un lead collegato all'auto.
 */
export default function SchedaPubblicaPage() {
  const { token = "" } = useParams();
  const scheda = useQuery({ queryKey: ["scheda-pubblica", token], queryFn: () => caricaScheda(token), retry: (n, e) => !(e instanceof SchedaNonTrovata) && n < 2 });
  const [modulo, setModulo] = useState<"whatsapp" | "test_drive" | null>(null);

  useEffect(() => {
    const d = scheda.data;
    document.title = d ? `${d.auto.marca} ${d.auto.modello}${d.auto.versione ? ` ${d.auto.versione}` : ""} – ${d.salone.nome}` : "Scheda auto";
  }, [scheda.data]);

  if (scheda.isLoading) return <Caricamento />;
  if (scheda.isError || !scheda.data) {
    return (
      <Messaggio
        titolo={scheda.error instanceof SchedaNonTrovata ? "Scheda non disponibile" : "Qualcosa non ha funzionato"}
        testo={
          scheda.error instanceof SchedaNonTrovata
            ? "Questa auto non è più pubblicata oppure il link non è corretto."
            : "Non riusciamo a caricare la scheda in questo momento."
        }
        azione={!(scheda.error instanceof SchedaNonTrovata) ? <Button onClick={() => void scheda.refetch()}>Riprova</Button> : undefined}
      />
    );
  }

  const { auto, salone, foto } = scheda.data;
  const venduta = auto.stato === "venduto";
  const titolo = `${auto.marca} ${auto.modello}`;

  return (
    <div className="min-h-dvh bg-muted pb-28 lg:pb-12">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          {salone.logo_url ? (
            <img src={salone.logo_url} alt={salone.nome} className="h-10 max-w-48 object-contain" />
          ) : (
            <span className="truncate text-lg font-bold text-primary">{salone.nome}</span>
          )}
          {salone.telefono && (
            <a href={linkTelefono(salone.telefono)} className="flex h-11 items-center gap-2 rounded-lg border px-3 text-[15px] font-medium hover:bg-muted">
              <Phone className="size-5" aria-hidden />
              <span className="hidden sm:inline">{salone.telefono}</span>
              <span className="sm:hidden">Chiama</span>
            </a>
          )}
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_380px] lg:py-8">
        <div className="min-w-0 space-y-6">
          <Galleria foto={foto} titolo={titolo} />

          <section className="rounded-xl border bg-card p-5 shadow-card lg:hidden">
            <Intestazione auto={auto} />
          </section>

          <DatiPrincipali auto={auto} />

          {auto.descrizione && (
            <section className="rounded-xl border bg-card p-5 shadow-card sm:p-6">
              <h2 className="mb-3 text-xl font-semibold">Descrizione</h2>
              <p className="whitespace-pre-line leading-relaxed text-foreground/90">{auto.descrizione}</p>
            </section>
          )}

          <Optional auto={auto} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <section className="hidden rounded-xl border bg-card p-5 shadow-card lg:block">
            <Intestazione auto={auto} />
            {!venduta && (
              <div className="mt-5 grid gap-2">
                <Button variant="success" size="lg" onClick={() => setModulo("whatsapp")}>
                  <MessageCircle aria-hidden />
                  Scrivici su WhatsApp
                </Button>
                <Button variant="accent" size="lg" onClick={() => setModulo("test_drive")}>
                  <CalendarDays aria-hidden />
                  Prenota test drive
                </Button>
              </div>
            )}
          </section>
          {venduta && (
            <section className="rounded-xl border border-warning/30 bg-warning-soft p-5 text-warning">
              <h2 className="font-semibold">Questa auto è stata venduta</h2>
              <p className="mt-1 text-[15px]">Contattaci: possiamo proporti un'alternativa simile.</p>
            </section>
          )}
          <Contatti salone={salone} />
        </aside>
      </main>

      {/* Barra fissa su telefono: le due azioni sempre a portata di pollice */}
      {!venduta && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
          <div className="mx-auto grid max-w-lg grid-cols-2 gap-2">
            <Button variant="success" onClick={() => setModulo("whatsapp")}>
              <MessageCircle aria-hidden />
              WhatsApp
            </Button>
            <Button variant="accent" onClick={() => setModulo("test_drive")}>
              <CalendarDays aria-hidden />
              Test drive
            </Button>
          </div>
        </div>
      )}

      <ModuloRichiesta token={token} tipo={modulo} auto={titolo} onClose={() => setModulo(null)} />
    </div>
  );
}

/* ---------- Sezioni ---------- */

function Intestazione({ auto }: { auto: AutoPubblica }) {
  return (
    <>
      <p className="text-sm font-medium uppercase tracking-wide text-accent">{TIPI_VEICOLO[auto.tipo]}</p>
      <h1 className="mt-1 text-[26px] font-bold leading-tight">
        {auto.marca} {auto.modello}
      </h1>
      {(auto.versione || auto.allestimento) && (
        <p className="mt-1 text-muted-foreground">{[auto.versione, auto.allestimento].filter(Boolean).join(" · ")}</p>
      )}
      <p className="mt-4 text-[32px] font-bold leading-none tabular-nums text-primary">
        {auto.prezzo_vendita != null ? euro(auto.prezzo_vendita) : "Prezzo su richiesta"}
      </p>
      {auto.garanzia_mesi ? (
        <p className="mt-3 flex items-center gap-2 text-[15px] text-success">
          <ShieldCheck className="size-5" aria-hidden />
          Garanzia {auto.garanzia_mesi} mesi{auto.garanzia_tipo ? ` · ${auto.garanzia_tipo}` : ""}
        </p>
      ) : null}
    </>
  );
}

function DatiPrincipali({ auto }: { auto: AutoPubblica }) {
  const icone = [
    { icona: CalendarDays, valore: auto.anno ? `${auto.mese_immatricolazione ? `${String(auto.mese_immatricolazione).padStart(2, "0")}/` : ""}${auto.anno}` : null, label: "Immatricolazione" },
    { icona: Gauge, valore: `${new Intl.NumberFormat("it-IT").format(auto.km)} km`, label: "Chilometri" },
    { icona: Fuel, valore: auto.alimentazione ? ALIMENTAZIONI[auto.alimentazione] : null, label: "Alimentazione" },
    { icona: Zap, valore: auto.potenza_kw ? `${kwInCv(auto.potenza_kw)} CV` : null, label: "Potenza" },
    { icona: Cog, valore: auto.cambio ? CAMBI[auto.cambio] : null, label: "Cambio" },
    { icona: Car, valore: auto.carrozzeria, label: "Carrozzeria" },
  ].filter((x) => x.valore);
  const tutti = datiChiave(auto);

  return (
    <section className="rounded-xl border bg-card p-5 shadow-card sm:p-6">
      <h2 className="mb-4 text-xl font-semibold">In breve</h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {icone.map(({ icona: Icona, valore, label }) => (
          <li key={label} className="flex items-center gap-3 rounded-lg bg-muted/70 p-3">
            <Icona className="size-6 shrink-0 text-accent" aria-hidden />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{valore}</span>
              <span className="block truncate text-sm text-muted-foreground">{label}</span>
            </span>
          </li>
        ))}
      </ul>
      <h3 className="mb-2 mt-6 text-lg font-semibold">Scheda tecnica</h3>
      <dl className="grid gap-x-8 sm:grid-cols-2">
        {tutti.map((d) => (
          <div key={d.etichetta} className="flex items-baseline justify-between gap-4 border-b py-2.5">
            <dt className="text-[15px] text-muted-foreground">{d.etichetta}</dt>
            <dd className="text-right text-[15px] font-medium">{d.valore}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Optional({ auto }: { auto: AutoPubblica }) {
  const gruppi = optionalRaggruppati(auto);
  if (!gruppi.length) return null;
  return (
    <section className="rounded-xl border bg-card p-5 shadow-card sm:p-6">
      <h2 className="mb-4 text-xl font-semibold">Optional ed equipaggiamenti</h2>
      <div className="space-y-5">
        {gruppi.map((g) => (
          <div key={g.categoria}>
            <h3 className="mb-2 text-[15px] font-semibold text-accent">{g.categoria}</h3>
            <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {g.voci.map((v) => (
                <li key={v} className="flex items-start gap-2 text-[15px]">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  {v}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function Contatti({ salone }: { salone: Salone }) {
  const indirizzo = [salone.indirizzo, salone.comune].filter(Boolean).join(", ");
  return (
    <section className="rounded-xl border bg-card p-5 shadow-card">
      <h2 className="font-semibold">{salone.nome}</h2>
      <ul className="mt-3 space-y-2 text-[15px]">
        {indirizzo && (
          <li>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${salone.nome} ${indirizzo}`)}`}
              target="_blank"
              rel="noopener"
              className="flex items-start gap-2 hover:text-accent"
            >
              <MapPin className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
              {indirizzo}
            </a>
          </li>
        )}
        {salone.telefono && (
          <li>
            <a href={linkTelefono(salone.telefono)} className="flex items-center gap-2 hover:text-accent">
              <Phone className="size-5 text-muted-foreground" aria-hidden />
              {salone.telefono}
            </a>
          </li>
        )}
      </ul>
    </section>
  );
}

/* ---------- Galleria ---------- */

function Galleria({ foto, titolo }: { foto: string[]; titolo: string }) {
  const [i, setI] = useState(0);
  const tocco = useRef<number | null>(null);
  const miniature = useRef<HTMLDivElement>(null);
  const n = foto.length;
  const vai = useCallback((k: number) => setI((k + n) % n), [n]);

  useEffect(() => {
    miniature.current?.querySelector<HTMLElement>(`[data-i="${i}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [i]);

  if (n === 0) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-gradient-to-br from-primary-soft to-accent-soft text-primary/70">
        <div className="flex flex-col items-center gap-2">
          <Car className="size-14" strokeWidth={1.4} aria-hidden />
          <span className="text-sm font-medium">Foto in arrivo</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        className="relative aspect-[4/3] overflow-hidden rounded-xl bg-black"
        onTouchStart={(e) => (tocco.current = e.touches[0]!.clientX)}
        onTouchEnd={(e) => {
          if (tocco.current == null) return;
          const dx = e.changedTouches[0]!.clientX - tocco.current;
          if (Math.abs(dx) > 40) vai(i + (dx < 0 ? 1 : -1));
          tocco.current = null;
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") vai(i + 1);
          if (e.key === "ArrowLeft") vai(i - 1);
        }}
        tabIndex={0}
        role="region"
        aria-roledescription="galleria"
        aria-label={`Foto ${i + 1} di ${n}`}
      >
        <img src={foto[i]} alt={`${titolo}, foto ${i + 1}`} className="size-full object-contain" />
        {n > 1 && (
          <>
            <button
              type="button"
              onClick={() => vai(i - 1)}
              className="absolute left-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-foreground shadow hover:bg-white"
              aria-label="Foto precedente"
            >
              <ChevronLeft className="size-6" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => vai(i + 1)}
              className="absolute right-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-foreground shadow hover:bg-white"
              aria-label="Foto successiva"
            >
              <ChevronRight className="size-6" aria-hidden />
            </button>
            <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2.5 py-1 text-sm font-medium tabular-nums text-white">
              {i + 1} / {n}
            </span>
          </>
        )}
      </div>
      {n > 1 && (
        <div ref={miniature} className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {foto.map((f, k) => (
            <button
              key={f}
              type="button"
              data-i={k}
              onClick={() => setI(k)}
              className={cn("h-16 w-20 shrink-0 overflow-hidden rounded-md border-2", k === i ? "border-accent" : "border-transparent opacity-70 hover:opacity-100")}
              aria-label={`Mostra foto ${k + 1}`}
              aria-current={k === i}
            >
              <img src={f} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Modulo richiesta (WhatsApp / test drive) ---------- */

const schemaBase = z.object({
  nome: testoObbligatorio("il tuo nome"),
  telefono,
  data_preferita: z.string(),
  messaggio: z.string().trim().max(1000, "Massimo 1000 caratteri"),
  consenso_privacy: z.boolean().refine((v) => v, "Serve il consenso per poterti ricontattare"),
  // Campo trappola per i bot: invisibile alle persone
  sito: z.string(),
});
const schemaTestDrive = schemaBase.refine((v) => v.data_preferita && new Date(v.data_preferita).getTime() > Date.now(), {
  path: ["data_preferita"],
  message: "Scegli un giorno e un orario futuri",
});
type ValoriModulo = z.infer<typeof schemaBase>;

function domaniAlle10() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return toDateTimeLocal(d);
}

function ModuloRichiesta({ token, tipo, auto, onClose }: { token: string; tipo: "whatsapp" | "test_drive" | null; auto: string; onClose: () => void }) {
  const [inviato, setInviato] = useState<{ whatsapp: string | null } | null>(null);
  const form = useForm<ValoriModulo>({
    resolver: zodResolver(tipo === "test_drive" ? schemaTestDrive : schemaBase),
    defaultValues: { nome: "", telefono: "", data_preferita: "", messaggio: "", consenso_privacy: false, sito: "" },
  });
  const err = form.formState.errors;

  useEffect(() => {
    if (!tipo) return;
    setInviato(null);
    form.reset({ ...form.getValues(), data_preferita: tipo === "test_drive" ? domaniAlle10() : "", consenso_privacy: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo]);

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      const r = await inviaRichiesta({
        t: token,
        azione: tipo,
        nome: v.nome,
        telefono: v.telefono,
        data_preferita: tipo === "test_drive" && v.data_preferita ? new Date(v.data_preferita).toISOString() : undefined,
        messaggio: v.messaggio || undefined,
        consenso_privacy: v.consenso_privacy,
        sito: v.sito,
      });
      setInviato({ whatsapp: r.whatsapp });
      if (tipo === "whatsapp" && r.whatsapp) window.open(r.whatsapp, "_blank", "noopener");
    } catch (e) {
      mostraErrore(e, "Invio non riuscito. Riprova tra poco.");
    }
  });

  const titolo = tipo === "test_drive" ? "Prenota un test drive" : "Scrivici su WhatsApp";
  return (
    <Dialog open={!!tipo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={titolo} description={auto}>
        {inviato ? (
          <div className="flex flex-col items-center py-4 text-center">
            <CheckCircle2 className="size-14 text-success" aria-hidden />
            {tipo === "test_drive" ? (
              <>
                <h3 className="mt-4 text-xl font-semibold">Richiesta ricevuta</h3>
                <p className="mt-2 max-w-sm text-muted-foreground">Ti ricontattiamo entro poco per confermare giorno e orario del test drive.</p>
              </>
            ) : (
              <>
                <h3 className="mt-4 text-xl font-semibold">Ci siamo quasi</h3>
                <p className="mt-2 max-w-sm text-muted-foreground">
                  {inviato.whatsapp ? "Apri WhatsApp e invia il messaggio già pronto." : "Abbiamo ricevuto i tuoi dati: ti ricontattiamo entro poco."}
                </p>
                {inviato.whatsapp && (
                  <Button variant="success" size="lg" className="mt-5 w-full max-w-xs" asChild>
                    <a href={inviato.whatsapp} target="_blank" rel="noopener">
                      <MessageCircle aria-hidden />
                      Apri WhatsApp
                    </a>
                  </Button>
                )}
              </>
            )}
            <Button variant="ghost" className="mt-3" onClick={onClose}>
              Chiudi
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <Field label="Nome e cognome" htmlFor="sp-nome" required error={err.nome?.message}>
              <Input id="sp-nome" autoComplete="name" aria-invalid={!!err.nome} {...form.register("nome")} />
            </Field>
            <Field label="Telefono" htmlFor="sp-tel" required error={err.telefono?.message} hint="Ti contattiamo solo per questa richiesta.">
              <Input id="sp-tel" type="tel" inputMode="tel" autoComplete="tel" aria-invalid={!!err.telefono} {...form.register("telefono")} />
            </Field>
            {tipo === "test_drive" && (
              <Field label="Quando preferisci?" htmlFor="sp-data" required error={err.data_preferita?.message}>
                <Input id="sp-data" type="datetime-local" step={1800} aria-invalid={!!err.data_preferita} {...form.register("data_preferita")} />
              </Field>
            )}
            {tipo === "test_drive" && (
              <Field label="Messaggio (facoltativo)" htmlFor="sp-msg" error={err.messaggio?.message}>
                <Textarea id="sp-msg" className="min-h-20" placeholder="Es. ho un'auto da dare in permuta" {...form.register("messaggio")} />
              </Field>
            )}
            {/* Campo trappola: nascosto a persone e lettori di schermo */}
            <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label htmlFor="sp-sito">Sito web</label>
              <input id="sp-sito" tabIndex={-1} autoComplete="off" {...form.register("sito")} />
            </div>
            <div>
              <label className="flex min-h-12 cursor-pointer items-start gap-3 text-[15px]">
                <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]" {...form.register("consenso_privacy")} />
                <span>Acconsento al trattamento dei miei dati per essere ricontattato in merito a questa auto.</span>
              </label>
              {err.consenso_privacy && (
                <p role="alert" className="mt-1 text-sm font-medium text-destructive">
                  {err.consenso_privacy.message}
                </p>
              )}
            </div>
            <Button type="submit" size="lg" variant={tipo === "test_drive" ? "accent" : "success"} className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Spinner /> : tipo === "test_drive" ? <CalendarDays aria-hidden /> : <MessageCircle aria-hidden />}
              {tipo === "test_drive" ? "Invia richiesta" : "Continua su WhatsApp"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Stati ---------- */

function Caricamento() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6" aria-busy="true" aria-label="Caricamento">
      <Skeleton className="h-10 w-48" />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Skeleton className="aspect-[4/3] w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}

function Messaggio({ titolo, testo, azione }: { titolo: string; testo: string; azione?: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted p-6">
      <div className="max-w-md rounded-xl border bg-card p-8 text-center shadow-card">
        <Car className="mx-auto size-12 text-muted-foreground" strokeWidth={1.4} aria-hidden />
        <h1 className="mt-4 text-2xl font-bold">{titolo}</h1>
        <p className="mt-2 text-muted-foreground">{testo}</p>
        {azione && <div className="mt-6">{azione}</div>}
      </div>
    </div>
  );
}
