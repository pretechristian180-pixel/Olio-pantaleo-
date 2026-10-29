import { useMemo, useState } from "react";
import { controllaProfilo, normalizzaProfilo, type ProfiloFatturazione } from "../../supabase/functions/_shared/validazione.ts";
import { supabase } from "./lib/supabase.ts";

export const PROFILO_VUOTO: ProfiloFatturazione = {
  stripe_customer_id: "", tipo: "azienda", ragione_sociale: null, partita_iva: null, codice_fiscale: null, via: null, cap: null,
  comune: null, provincia: null, nazione: "IT", codice_destinatario: null, pec: null, email_amministrativa: null,
};

const CAMPI: { chiave: keyof ProfiloFatturazione; etichetta: string; largo?: boolean; aiuto?: string }[] = [
  { chiave: "ragione_sociale", etichetta: "Ragione sociale / Nome e cognome", largo: true },
  { chiave: "partita_iva", etichetta: "Partita IVA" },
  { chiave: "codice_fiscale", etichetta: "Codice fiscale" },
  { chiave: "via", etichetta: "Indirizzo", largo: true },
  { chiave: "cap", etichetta: "CAP" },
  { chiave: "comune", etichetta: "Comune" },
  { chiave: "provincia", etichetta: "Provincia (sigla)" },
  { chiave: "nazione", etichetta: "Nazione (ISO, es. IT)" },
  { chiave: "codice_destinatario", etichetta: "Codice destinatario SDI", aiuto: "7 caratteri (6 per la PA). 0000000 se c'è solo la PEC o per un privato." },
  { chiave: "pec", etichetta: "PEC" },
  { chiave: "email_amministrativa", etichetta: "Email amministrativa (copia di cortesia)", largo: true },
];

/** Modulo dei dati di fatturazione con la stessa validazione usata dall'agente. */
export function ModuloProfilo({ iniziale, nuovo, onSalvato, etichettaSalva = "Salva" }: {
  iniziale: ProfiloFatturazione; nuovo?: boolean; onSalvato: (p: ProfiloFatturazione) => void | Promise<void>; etichettaSalva?: string;
}) {
  const [p, setP] = useState<ProfiloFatturazione>(iniziale);
  const [errore, setErrore] = useState<string | null>(null);
  const [attesa, setAttesa] = useState(false);
  const normalizzato = useMemo(() => normalizzaProfilo(p), [p]);
  const esito = useMemo(() => controllaProfilo(normalizzato), [normalizzato]);
  const imposta = (k: keyof ProfiloFatturazione, v: string) => setP({ ...p, [k]: v === "" ? null : v });

  const salva = async () => {
    setAttesa(true); setErrore(null);
    if (!/^cus_/.test(normalizzato.stripe_customer_id)) { setErrore("L'id del cliente Stripe inizia con cus_"); setAttesa(false); return; }
    const { fic_client_id: _f, ...riga } = normalizzato;
    const { error } = await supabase.from("billing_profiles").upsert({ ...riga, updated_at: new Date().toISOString() }, { onConflict: "stripe_customer_id" });
    if (error) setErrore(error.message);
    else await onSalvato(normalizzato);
    setAttesa(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="etichetta">Cliente Stripe (cus_…)</label>
          <input className="campo font-mono" value={p.stripe_customer_id} disabled={!nuovo} onChange={(e) => setP({ ...p, stripe_customer_id: e.target.value.trim() })} />
        </div>
        <div>
          <label className="etichetta">Tipo</label>
          <select className="campo" value={p.tipo} onChange={(e) => setP({ ...p, tipo: e.target.value as ProfiloFatturazione["tipo"] })}>
            <option value="azienda">Azienda / professionista</option>
            <option value="persona">Privato (consumatore)</option>
            <option value="pa">Pubblica amministrazione</option>
          </select>
        </div>
        {CAMPI.map((c) => (
          <div key={c.chiave} className={c.largo ? "sm:col-span-2" : ""}>
            <label className="etichetta">{c.etichetta}</label>
            <input className="campo" value={(p[c.chiave] as string | null) ?? ""} onChange={(e) => imposta(c.chiave, e.target.value)} />
            {c.aiuto && <p className="mt-1 text-xs text-slate-500">{c.aiuto}</p>}
          </div>
        ))}
      </div>
      <div className={`rounded-md p-3 text-sm ${esito.ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
        {esito.ok ? <p>Dati completi: la fattura elettronica può essere emessa.</p> : <p className="font-medium">La fattura non può essere emessa finché non correggi:</p>}
        <ul className="mt-1 list-disc pl-5">
          {esito.mancanti.map((m) => <li key={m}>Manca: {m}</li>)}
          {esito.errori.map((m) => <li key={m}>{m}</li>)}
          {esito.avvisi.map((m) => <li key={m} className="text-slate-600">{m}</li>)}
        </ul>
      </div>
      {errore && <p className="text-sm text-red-600">{errore}</p>}
      <div className="flex justify-end">
        <button className="btn-primario" disabled={attesa || !esito.ok} onClick={salva}>{attesa ? "Salvataggio…" : etichettaSalva}</button>
      </div>
    </div>
  );
}

export function Finestra({ titolo, onChiudi, children }: { titolo: string; onChiudi: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy/60 p-4" onClick={onChiudi}>
      <div className="scheda my-8 w-full max-w-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-navy">{titolo}</h2>
          <button className="btn-secondario" onClick={onChiudi} aria-label="Chiudi">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Messaggio({ m, onChiudi }: { m: { ok: boolean; testo: string } | null; onChiudi: () => void }) {
  if (!m) return null;
  return (
    <div className={`mb-4 flex items-start justify-between gap-3 rounded-md p-3 text-sm ${m.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
      <p className="whitespace-pre-line">{m.testo}</p>
      <button onClick={onChiudi} aria-label="Chiudi">✕</button>
    </div>
  );
}
