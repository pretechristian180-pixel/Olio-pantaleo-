import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.ts";
import { dataOra } from "../lib/formato.ts";

interface Riga { id: number; created_at: string; livello: string; operazione: string; riferimento: string | null; messaggio: string; dettagli: unknown }
const COLORI: Record<string, string> = { info: "text-slate-500", avviso: "text-amber-700", errore: "text-red-700" };

/** Registro delle operazioni: i dettagli sono già mascherati dalle Edge Functions. */
export function Registro() {
  const [righe, setRighe] = useState<Riga[]>([]);
  const [cerca, setCerca] = useState("");
  useEffect(() => {
    let q = supabase.from("operation_logs").select("*").order("id", { ascending: false }).limit(300);
    if (cerca.trim()) q = q.ilike("riferimento", `%${cerca.trim()}%`);
    q.then(({ data }) => setRighe((data ?? []) as Riga[]));
  }, [cerca]);
  return (
    <section>
      <input className="campo mb-4 max-w-sm" placeholder="Filtra per riferimento (in_…, cus_…, id job)" value={cerca} onChange={(e) => setCerca(e.target.value)} />
      <div className="scheda divide-y divide-slate-100 font-mono text-xs">
        {righe.map((r) => (
          <details key={r.id} className="px-3 py-2">
            <summary className="cursor-pointer">
              <span className="text-slate-400">{dataOra(r.created_at)}</span>{" "}
              <span className={COLORI[r.livello]}>{r.livello.toUpperCase()}</span>{" "}
              <span className="text-navy">{r.operazione}</span>{" "}
              {r.riferimento && <span className="text-slate-500">{r.riferimento} </span>}
              <span className="font-sans text-slate-700">{r.messaggio}</span>
            </summary>
            {r.dettagli != null && <pre className="mt-1 overflow-x-auto rounded bg-slate-50 p-2">{JSON.stringify(r.dettagli, null, 2)}</pre>}
          </details>
        ))}
        {!righe.length && <p className="p-6 text-center font-sans text-slate-500">Nessuna operazione registrata.</p>}
      </div>
    </section>
  );
}
