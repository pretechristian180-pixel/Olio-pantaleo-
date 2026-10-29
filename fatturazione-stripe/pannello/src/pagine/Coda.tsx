import { useCallback, useEffect, useState } from "react";
import { admin, supabase } from "../lib/supabase.ts";
import { dataOra, STATI_JOB } from "../lib/formato.ts";
import { Badge } from "../Badge.tsx";
import { Messaggio } from "../ModuloProfilo.tsx";

interface Job {
  id: string; tipo: "fattura" | "nota_credito"; stripe_invoice_id: string; stripe_customer_id: string | null; stripe_refund_id: string | null;
  stato: string; tentativi: number; max_tentativi: number; prossimo_tentativo_at: string; ultimo_errore: string | null;
  dettaglio: Record<string, unknown> | null; created_at: string; updated_at: string;
}

const DA_SISTEMARE = ["errore", "dati_mancanti", "da_controllare", "scartata"];
const RIPROVABILI = ["errore", "dati_mancanti", "da_controllare"];

export function Coda() {
  const [filtro, setFiltro] = useState<"problemi" | "attivi" | "tutti">("problemi");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [attesa, setAttesa] = useState<string | null>(null);
  const [messaggio, setMessaggio] = useState<{ ok: boolean; testo: string } | null>(null);

  const carica = useCallback(async () => {
    let q = supabase.from("invoice_jobs").select("*").order("created_at", { ascending: false }).limit(300);
    if (filtro === "problemi") q = q.in("stato", DA_SISTEMARE);
    if (filtro === "attivi") q = q.in("stato", ["in_coda", "in_lavorazione"]);
    const { data, error } = await q;
    if (error) setMessaggio({ ok: false, testo: error.message });
    setJobs((data ?? []) as Job[]);
  }, [filtro]);
  useEffect(() => { carica(); }, [carica]);

  const azione = async (chiave: string, fn: () => Promise<unknown>, ok: string) => {
    setAttesa(chiave); setMessaggio(null);
    try { await fn(); setMessaggio({ ok: true, testo: ok }); } catch (e) { setMessaggio({ ok: false, testo: e instanceof Error ? e.message : "Operazione non riuscita" }); }
    setAttesa(null);
    await carica();
  };

  return (
    <section>
      <Messaggio m={messaggio} onChiudi={() => setMessaggio(null)} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-sm">
          {([["problemi", "Da sistemare"], ["attivi", "In coda"], ["tutti", "Tutti"]] as const).map(([k, t]) => (
            <button key={k} onClick={() => setFiltro(k)} className={`rounded px-3 py-1 ${filtro === k ? "bg-navy text-white" : "text-slate-600"}`}>{t}</button>
          ))}
        </div>
        <button className="btn-primario" disabled={!!attesa} onClick={() => azione("coda", () => admin("esegui_coda"), "Coda elaborata.")}>
          {attesa === "coda" ? "Elaborazione…" : "Elabora la coda adesso"}
        </button>
      </div>
      <p className="mb-3 text-xs text-slate-500">La coda viene elaborata in automatico ogni 2 minuti. Dopo 5 tentativi falliti il job passa in «errore» e arriva un avviso.</p>

      <div className="space-y-2">
        {jobs.map((j) => (
          <div key={j.id} className="scheda p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge testo={j.stato.replace("_", " ")} colore={STATI_JOB[j.stato] ?? "bg-slate-100"} />
                  <span className="text-sm font-medium">{j.tipo === "fattura" ? "Fattura" : "Nota di credito"}</span>
                  <span className="font-mono text-xs text-slate-500">{j.stripe_refund_id ?? j.stripe_invoice_id}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Creato {dataOra(j.created_at)} · tentativi {j.tentativi}/{j.max_tentativi}
                  {j.stato === "in_coda" && j.tentativi > 0 && ` · prossimo tentativo ${dataOra(j.prossimo_tentativo_at)}`}
                </p>
              </div>
              {RIPROVABILI.includes(j.stato) && (
                <button className="btn-secondario" disabled={!!attesa} onClick={() => azione(j.id, () => admin("riprova_job", { job_id: j.id }), "Job rimesso in coda ed elaborato.")}>
                  {attesa === j.id ? "…" : "Riprova"}
                </button>
              )}
            </div>
            {j.ultimo_errore && <p className="mt-2 whitespace-pre-line rounded bg-red-50 p-2 text-sm text-red-800">{j.ultimo_errore}</p>}
            {j.dettaglio && Object.keys(j.dettaglio).length > 0 && (
              <details className="mt-2 text-xs text-slate-600">
                <summary className="cursor-pointer">Dettaglio</summary>
                <pre className="mt-1 overflow-x-auto rounded bg-slate-50 p-2">{JSON.stringify(j.dettaglio, null, 2)}</pre>
              </details>
            )}
          </div>
        ))}
        {!jobs.length && <p className="scheda p-8 text-center text-sm text-slate-500">Niente da mostrare.</p>}
      </div>
    </section>
  );
}
