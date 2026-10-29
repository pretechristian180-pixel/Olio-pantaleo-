import { useCallback, useEffect, useMemo, useState } from "react";
import { controllaProfilo, normalizzaProfilo, type ProfiloFatturazione } from "../../../supabase/functions/_shared/validazione.ts";
import { admin, supabase } from "../lib/supabase.ts";
import { dataOra } from "../lib/formato.ts";
import { Badge } from "../Badge.tsx";
import { Finestra, Messaggio, ModuloProfilo, PROFILO_VUOTO } from "../ModuloProfilo.tsx";

type Profilo = ProfiloFatturazione & { sincronizzato_stripe_at: string | null; updated_at: string };

export function Clienti() {
  const [profili, setProfili] = useState<Profilo[]>([]);
  const [cerca, setCerca] = useState("");
  const [modifica, setModifica] = useState<{ p: ProfiloFatturazione; nuovo: boolean } | null>(null);
  const [importa, setImporta] = useState("");
  const [attesa, setAttesa] = useState<string | null>(null);
  const [messaggio, setMessaggio] = useState<{ ok: boolean; testo: string } | null>(null);

  const carica = useCallback(async () => {
    const { data, error } = await supabase.from("billing_profiles").select("*").order("ragione_sociale");
    if (error) setMessaggio({ ok: false, testo: error.message });
    setProfili((data ?? []) as Profilo[]);
  }, []);
  useEffect(() => { carica(); }, [carica]);

  const visibili = useMemo(() => {
    const c = cerca.trim().toLowerCase();
    return profili.filter((p) => !c || `${p.ragione_sociale ?? ""} ${p.partita_iva ?? ""} ${p.stripe_customer_id}`.toLowerCase().includes(c));
  }, [profili, cerca]);

  const esegui = async (chiave: string, fn: () => Promise<string>) => {
    setAttesa(chiave); setMessaggio(null);
    try { setMessaggio({ ok: true, testo: await fn() }); } catch (e) { setMessaggio({ ok: false, testo: e instanceof Error ? e.message : "Operazione non riuscita" }); }
    setAttesa(null);
    await carica();
  };
  const sincronizza = (id: string) => esegui(id, async () => {
    await admin("sincronizza_stripe", { stripe_customer_id: id });
    return "Dati copiati nei metadata del cliente Stripe.";
  });

  return (
    <section>
      <Messaggio m={messaggio} onChiudi={() => setMessaggio(null)} />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <input className="campo max-w-xs" placeholder="Cerca per nome, P.IVA o cus_…" value={cerca} onChange={(e) => setCerca(e.target.value)} />
        <div className="flex flex-wrap items-end gap-2">
          <input className="campo w-56 font-mono" placeholder="cus_… da importare" value={importa} onChange={(e) => setImporta(e.target.value.trim())} />
          <button className="btn-secondario" disabled={!/^cus_/.test(importa) || !!attesa} onClick={() => esegui("importa", async () => {
            const r = await admin<{ controllo: { ok: boolean; mancanti: string[]; errori: string[] } }>("importa_da_stripe", { stripe_customer_id: importa });
            setImporta("");
            return r.controllo.ok ? "Dati importati dai metadata Stripe: completi." : `Dati importati, ma incompleti:\n${[...r.controllo.mancanti.map((m) => `Manca: ${m}`), ...r.controllo.errori].join("\n")}`;
          })}>Importa da Stripe</button>
          <button className="btn-primario" onClick={() => setModifica({ p: { ...PROFILO_VUOTO }, nuovo: true })}>Nuovo cliente</button>
        </div>
      </div>

      <div className="scheda overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-3 py-2">Cliente</th><th className="px-3 py-2">P.IVA / CF</th><th className="px-3 py-2">Recapito SDI</th><th className="px-3 py-2">Stato</th><th className="px-3 py-2 text-right">Azioni</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibili.map((p) => {
              const esito = controllaProfilo(normalizzaProfilo(p));
              const daSincronizzare = !p.sincronizzato_stripe_at || p.sincronizzato_stripe_at < p.updated_at;
              return (
                <tr key={p.stripe_customer_id}>
                  <td className="px-3 py-2"><p className="font-medium">{p.ragione_sociale ?? "—"}</p><p className="font-mono text-xs text-slate-500">{p.stripe_customer_id}</p></td>
                  <td className="px-3 py-2 font-mono text-xs">{p.partita_iva ?? p.codice_fiscale ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{p.codice_destinatario ?? "—"}{p.pec ? ` · ${p.pec}` : ""}</td>
                  <td className="px-3 py-2">
                    {esito.ok ? <Badge testo="Completo" colore="bg-emerald-100 text-emerald-800" /> : <Badge testo="Dati mancanti" colore="bg-amber-100 text-amber-800" />}
                    <p className="mt-1 text-xs text-slate-500">{daSincronizzare ? "Da copiare su Stripe" : `Su Stripe dal ${dataOra(p.sincronizzato_stripe_at)}`}</p>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <button className="btn-secondario" onClick={() => setModifica({ p, nuovo: false })}>Modifica</button>
                      <button className="btn-secondario" disabled={!!attesa} onClick={() => sincronizza(p.stripe_customer_id)}>{attesa === p.stripe_customer_id ? "…" : "Copia su Stripe"}</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!visibili.length && <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">Nessun cliente.</td></tr>}
          </tbody>
        </table>
      </div>

      {modifica && (
        <Finestra titolo={modifica.nuovo ? "Nuovo cliente" : "Dati di fatturazione"} onChiudi={() => setModifica(null)}>
          <ModuloProfilo
            iniziale={modifica.p}
            nuovo={modifica.nuovo}
            etichettaSalva="Salva e copia su Stripe"
            onSalvato={async (p) => {
              setModifica(null);
              await sincronizza(p.stripe_customer_id);
            }}
          />
        </Finestra>
      )}
    </section>
  );
}
