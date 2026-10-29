import { useCallback, useEffect, useState } from "react";
import { admin, funzione, supabase } from "../lib/supabase.ts";
import { dataOra } from "../lib/formato.ts";
import { Messaggio } from "../ModuloProfilo.tsx";

interface Avviso { id: string; tipo: string; titolo: string; testo: string; email_inviata_at: string | null; risolto_at: string | null; created_at: string }
interface Subscription { id: string; verificata: boolean; created_at: string; verificata_at: string | null }

export function Avvisi() {
  const [avvisi, setAvvisi] = useState<Avviso[]>([]);
  const [anche, setAnche] = useState(false);
  const [sub, setSub] = useState<Subscription[]>([]);
  const [attesa, setAttesa] = useState<string | null>(null);
  const [messaggio, setMessaggio] = useState<{ ok: boolean; testo: string } | null>(null);

  const carica = useCallback(async () => {
    let q = supabase.from("avvisi").select("*").order("created_at", { ascending: false }).limit(200);
    if (!anche) q = q.is("risolto_at", null);
    const [{ data }, { data: s }] = await Promise.all([q, supabase.from("fic_subscriptions").select("*").order("created_at", { ascending: false })]);
    setAvvisi((data ?? []) as Avviso[]);
    setSub((s ?? []) as Subscription[]);
  }, [anche]);
  useEffect(() => { carica(); }, [carica]);

  const esegui = async (chiave: string, fn: () => Promise<string>) => {
    setAttesa(chiave); setMessaggio(null);
    try { setMessaggio({ ok: true, testo: await fn() }); } catch (e) { setMessaggio({ ok: false, testo: e instanceof Error ? e.message : "Operazione non riuscita" }); }
    setAttesa(null);
    await carica();
  };
  const risolvi = (id: string) => esegui(id, async () => {
    const { error } = await supabase.from("avvisi").update({ risolto_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
    return "Avviso segnato come risolto.";
  });
  const verificata = sub.some((s) => s.verificata);

  return (
    <section>
      <Messaggio m={messaggio} onChiudi={() => setMessaggio(null)} />
      <div className="scheda mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-medium">Esiti SDI da Fatture in Cloud</p>
          <p className="text-xs text-slate-500">
            {sub.length === 0 ? "Non collegato: gli esiti arrivano solo dal controllo giornaliero."
              : verificata ? `Collegato e verificato (${dataOra(sub.find((s) => s.verificata)?.verificata_at)}).`
              : "Registrato, in attesa della verifica di Fatture in Cloud."}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondario" disabled={!!attesa} onClick={() => esegui("avvisi", async () => {
            const r = await admin<{ inviati: number }>("invia_avvisi");
            return `Email di avviso inviate: ${r.inviati}.`;
          })}>Invia avvisi in sospeso</button>
          <button className="btn-primario" disabled={!!attesa} onClick={() => esegui("sub", async () => {
            const r = await funzione<{ ok: boolean; verificata: boolean }>("fic-subscribe", {});
            return r.verificata ? "Notifiche di Fatture in Cloud collegate e verificate." : "Registrazione inviata: la verifica arriverà a breve.";
          })}>{attesa === "sub" ? "Collegamento…" : "Collega esiti SDI"}</button>
        </div>
      </div>

      <label className="mb-3 flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={anche} onChange={(e) => setAnche(e.target.checked)} /> Mostra anche gli avvisi risolti
      </label>

      <div className="space-y-2">
        {avvisi.map((a) => (
          <div key={a.id} className={`scheda p-4 ${a.risolto_at ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{a.titolo}</p>
                <p className="text-xs text-slate-500">
                  {dataOra(a.created_at)} · {a.tipo.replaceAll("_", " ")} · {a.email_inviata_at ? "email inviata" : "email non ancora inviata"}
                  {a.risolto_at && ` · risolto ${dataOra(a.risolto_at)}`}
                </p>
              </div>
              {!a.risolto_at && <button className="btn-secondario" disabled={!!attesa} onClick={() => risolvi(a.id)}>Segna come risolto</button>}
            </div>
            <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{a.testo}</p>
          </div>
        ))}
        {!avvisi.length && <p className="scheda p-8 text-center text-sm text-slate-500">Nessun avviso aperto.</p>}
      </div>
    </section>
  );
}
