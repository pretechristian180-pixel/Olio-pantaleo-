import { useEffect, useState } from "react";
import { admin, supabase } from "../lib/supabase.ts";
import { Messaggio } from "../ModuloProfilo.tsx";

type Valore = string | number | boolean | null;
type Impostazioni = Record<string, Valore>;
interface TipoIva { id: number; value: number | null; description: string | null; ei_type?: string | null; is_disabled?: boolean }
interface Conto { id: number; name: string; iban?: string | null }

type Campo = { k: string; t: string; tipo?: "testo" | "numero" | "si_no" | "area"; aiuto?: string; segnaposto?: string };
const GRUPPI: { titolo: string; descrizione?: string; campi: Campo[] }[] = [
  {
    titolo: "Emittente",
    descrizione: "I dati anagrafici dell'emittente sono quelli dell'azienda su Fatture in Cloud: qui servono per i controlli e le email.",
    campi: [
      { k: "emittente_ragione_sociale", t: "Ragione sociale" },
      { k: "emittente_partita_iva", t: "Partita IVA" },
      { k: "emittente_codice_fiscale", t: "Codice fiscale" },
      { k: "emittente_indirizzo", t: "Indirizzo" },
      { k: "emittente_cap", t: "CAP" },
      { k: "emittente_comune", t: "Comune" },
      { k: "emittente_provincia", t: "Provincia" },
      { k: "emittente_iban", t: "IBAN", aiuto: "Riportato in fattura quando il pagamento è un bonifico (MP05)." },
    ],
  },
  {
    titolo: "Regime e IVA",
    descrizione: "Da concordare con il commercialista. Usa l'aliquota OPPURE la natura (con aliquota 0).",
    campi: [
      { k: "regime_fiscale", t: "Regime fiscale", segnaposto: "RF01", aiuto: "RF01 ordinario, RF19 forfettario…" },
      { k: "aliquota_iva", t: "Aliquota IVA %", tipo: "numero", segnaposto: "22" },
      { k: "natura_iva", t: "Natura (operazioni senza IVA)", segnaposto: "N2.2" },
      { k: "prezzi_stripe_ivati", t: "I prezzi su Stripe sono IVA inclusa", tipo: "si_no" },
      { k: "dicitura", t: "Dicitura obbligatoria in fattura", tipo: "area", aiuto: "Es. riferimento normativo del regime forfettario o dell'esenzione." },
    ],
  },
  {
    titolo: "Marca da bollo",
    campi: [
      { k: "bollo_applicato", t: "Applica la marca da bollo", tipo: "si_no" },
      { k: "bollo_importo", t: "Importo (€)", tipo: "numero" },
      { k: "bollo_soglia", t: "Soglia oltre la quale si applica (€)", tipo: "numero" },
      { k: "bollo_addebitato_cliente", t: "Addebitata al cliente", tipo: "si_no", aiuto: "Se sì, su Stripe deve esserci una voce con metadata bollo=true." },
    ],
  },
  {
    titolo: "Cassa previdenziale (facoltativa)",
    campi: [
      { k: "cassa_tipo", t: "Tipo cassa", segnaposto: "TC22" },
      { k: "cassa_aliquota", t: "Aliquota cassa %", tipo: "numero" },
    ],
  },
  {
    titolo: "Fatture in Cloud e pagamenti",
    campi: [
      { k: "fic_numerazione", t: "Sezionale fatture", aiuto: "Vuoto = numerazione principale." },
      { k: "fic_numerazione_note_credito", t: "Sezionale note di credito" },
      { k: "codice_pagamento_carta", t: "Modalità pagamento carta", segnaposto: "MP08" },
      { k: "codice_pagamento_sepa", t: "Modalità pagamento SEPA", segnaposto: "MP19" },
      { k: "codice_pagamento_altro", t: "Modalità pagamento altri metodi", segnaposto: "MP05" },
    ],
  },
];

export function Configurazione() {
  const [v, setV] = useState<Impostazioni | null>(null);
  const [tipi, setTipi] = useState<TipoIva[]>([]);
  const [conti, setConti] = useState<Conto[]>([]);
  const [attesa, setAttesa] = useState(false);
  const [messaggio, setMessaggio] = useState<{ ok: boolean; testo: string } | null>(null);

  useEffect(() => {
    supabase.from("fiscal_settings").select("*").eq("id", 1).single().then(({ data, error }) => {
      if (error) setMessaggio({ ok: false, testo: error.message });
      setV((data ?? {}) as Impostazioni);
    });
    admin<{ tipi_iva: TipoIva[]; conti: Conto[] }>("opzioni_fic")
      .then((r) => { setTipi(r.tipi_iva.filter((t) => !t.is_disabled)); setConti(r.conti); })
      .catch((e) => setMessaggio({ ok: false, testo: `Impossibile leggere tipi IVA e conti da Fatture in Cloud: ${e.message}` }));
  }, []);

  if (!v) return <p className="text-sm text-slate-500">Caricamento…</p>;
  const imposta = (k: string, x: Valore) => setV({ ...v, [k]: x === "" ? null : x });

  const salva = async () => {
    setAttesa(true); setMessaggio(null);
    const { id: _i, updated_at: _u, ...campi } = v;
    const { error } = await supabase.from("fiscal_settings").update(campi).eq("id", 1);
    setMessaggio(error ? { ok: false, testo: error.message } : { ok: true, testo: "Configurazione salvata. Vale dalla prossima fattura." });
    setAttesa(false);
  };

  const input = (c: Campo) => {
    const x = v[c.k];
    if (c.tipo === "si_no") {
      return (
        <select className="campo" value={x == null ? "" : String(x)} onChange={(e) => imposta(c.k, e.target.value === "" ? null : e.target.value === "true")}>
          <option value="">— da impostare —</option><option value="true">Sì</option><option value="false">No</option>
        </select>
      );
    }
    if (c.tipo === "area") return <textarea className="campo" rows={3} value={(x as string) ?? ""} onChange={(e) => imposta(c.k, e.target.value)} />;
    if (c.tipo === "numero") return <input className="campo" type="number" step="0.01" value={x == null ? "" : String(x)} placeholder={c.segnaposto} onChange={(e) => imposta(c.k, e.target.value === "" ? null : Number(e.target.value))} />;
    return <input className="campo" value={(x as string) ?? ""} placeholder={c.segnaposto} onChange={(e) => imposta(c.k, c.k.startsWith("emittente_") || c.k === "dicitura" ? e.target.value : e.target.value.toUpperCase())} />;
  };

  return (
    <section className="space-y-4">
      <Messaggio m={messaggio} onChiudi={() => setMessaggio(null)} />
      <div className="rounded-md bg-sky-50 p-3 text-sm text-sky-900">
        Nessun valore fiscale è scritto nel codice: finché i campi obbligatori non sono compilati l'agente non emette fatture e manda un avviso.
      </div>
      {GRUPPI.map((g) => (
        <div key={g.titolo} className="scheda p-4">
          <h2 className="font-semibold text-navy">{g.titolo}</h2>
          {g.descrizione && <p className="mb-3 text-xs text-slate-500">{g.descrizione}</p>}
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {g.campi.map((c) => (
              <div key={c.k} className={c.tipo === "area" ? "sm:col-span-2" : ""}>
                <label className="etichetta">{c.t}</label>
                {input(c)}
                {c.aiuto && <p className="mt-1 text-xs text-slate-500">{c.aiuto}</p>}
              </div>
            ))}
            {g.titolo === "Regime e IVA" && (
              <div>
                <label className="etichetta">Tipo IVA su Fatture in Cloud</label>
                <select className="campo" value={v.fic_vat_id == null ? "" : String(v.fic_vat_id)} onChange={(e) => imposta("fic_vat_id", e.target.value === "" ? null : Number(e.target.value))}>
                  <option value="">— scegli —</option>
                  {tipi.map((t) => <option key={t.id} value={t.id}>{t.value ?? 0}% {t.ei_type ? `(${t.ei_type}) ` : ""}{t.description ?? ""}</option>)}
                  {v.fic_vat_id != null && !tipi.some((t) => t.id === v.fic_vat_id) && <option value={String(v.fic_vat_id)}>id {String(v.fic_vat_id)}</option>}
                </select>
                <p className="mt-1 text-xs text-slate-500">Deve corrispondere all'aliquota o alla natura scelta.</p>
              </div>
            )}
            {g.titolo === "Fatture in Cloud e pagamenti" && (
              <div>
                <label className="etichetta">Conto di incasso su Fatture in Cloud</label>
                <select className="campo" value={v.fic_payment_account_id == null ? "" : String(v.fic_payment_account_id)} onChange={(e) => imposta("fic_payment_account_id", e.target.value === "" ? null : Number(e.target.value))}>
                  <option value="">— scegli —</option>
                  {conti.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  {v.fic_payment_account_id != null && !conti.some((c) => c.id === v.fic_payment_account_id) && <option value={String(v.fic_payment_account_id)}>id {String(v.fic_payment_account_id)}</option>}
                </select>
              </div>
            )}
          </div>
        </div>
      ))}
      <div className="flex justify-end">
        <button className="btn-primario px-5 py-2" disabled={attesa} onClick={salva}>{attesa ? "Salvataggio…" : "Salva configurazione"}</button>
      </div>
    </section>
  );
}
