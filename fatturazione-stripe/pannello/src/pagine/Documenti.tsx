import { useCallback, useEffect, useMemo, useState } from "react";
import { admin, supabase } from "../lib/supabase.ts";
import { data, dataOra, euro, SCARTATI, STATI_SDI } from "../lib/formato.ts";
import { Badge } from "../Badge.tsx";
import { Finestra, Messaggio, ModuloProfilo, PROFILO_VUOTO } from "../ModuloProfilo.tsx";
import type { ProfiloFatturazione } from "../../../supabase/functions/_shared/validazione.ts";

interface Documento {
  id: string; tipo: "fattura" | "nota_credito"; stripe_invoice_id: string; stripe_customer_id: string; numero: string | null;
  data: string | null; imponibile: number | null; iva: number | null; totale: number | null; stato_sdi: string | null;
  sdi_motivo: string | null; sdi_soluzione: string | null; sdi_codice: string | null; dry_run: boolean; inviata_at: string | null; esito_at: string | null;
}

const GRUPPI: Record<string, string[]> = {
  tutti: [],
  prova: ["not_sent"],
  in_attesa: ["attempt", "sent", "pending", "processing", "no_response"],
  consegnate: ["accepted", "manual_accepted", "not_delivered"],
  scartate: SCARTATI,
};

export function Documenti() {
  const oggi = new Date();
  const [dal, setDal] = useState(new Date(oggi.getFullYear(), oggi.getMonth() - 2, 1).toISOString().slice(0, 10));
  const [al, setAl] = useState(oggi.toISOString().slice(0, 10));
  const [cliente, setCliente] = useState("");
  const [gruppo, setGruppo] = useState("tutti");
  const [righe, setRighe] = useState<Documento[]>([]);
  const [nomi, setNomi] = useState<Record<string, string>>({});
  const [attesa, setAttesa] = useState<string | null>(null);
  const [messaggio, setMessaggio] = useState<{ ok: boolean; testo: string } | null>(null);
  const [correzione, setCorrezione] = useState<{ doc: Documento; profilo: ProfiloFatturazione } | null>(null);

  const carica = useCallback(async () => {
    let q = supabase.from("invoices").select("*").gte("data", dal).lte("data", al).order("data", { ascending: false }).limit(500);
    if (GRUPPI[gruppo]!.length) q = q.in("stato_sdi", GRUPPI[gruppo]!);
    const [{ data: docs, error }, { data: profili }] = await Promise.all([q, supabase.from("billing_profiles").select("stripe_customer_id, ragione_sociale")]);
    if (error) setMessaggio({ ok: false, testo: error.message });
    setRighe((docs ?? []) as Documento[]);
    setNomi(Object.fromEntries((profili ?? []).map((p) => [p.stripe_customer_id, p.ragione_sociale ?? p.stripe_customer_id])));
  }, [dal, al, gruppo]);
  useEffect(() => { carica(); }, [carica]);

  const visibili = useMemo(() => {
    const c = cliente.trim().toLowerCase();
    return c ? righe.filter((r) => (nomi[r.stripe_customer_id] ?? "").toLowerCase().includes(c) || r.stripe_customer_id.includes(c)) : righe;
  }, [righe, nomi, cliente]);

  const esegui = async (doc: Documento, azione: string) => {
    setAttesa(`${doc.id}:${azione}`); setMessaggio(null);
    try {
      if (azione === "pdf" || azione === "link_fic") {
        // finestra aperta subito per non farla bloccare dal browser, poi l'indirizzo
        const w = window.open("", "_blank");
        const { url } = await admin<{ url: string | null }>(azione, { invoice_id: doc.id });
        if (url && w) w.location.href = url; else { w?.close(); setMessaggio({ ok: false, testo: "PDF non ancora disponibile su Fatture in Cloud" }); }
      } else {
        const r = await admin<{ ok: boolean; prova?: boolean; errori?: string[] }>(azione, { invoice_id: doc.id });
        setMessaggio(r.ok
          ? { ok: true, testo: r.prova ? "Invio di prova eseguito (EINVOICE_LIVE è false: nulla è stato inviato allo SDI)." : "Documento inviato allo SDI." }
          : { ok: false, testo: `Il controllo XML ha trovato errori, invio annullato:\n${(r.errori ?? []).join("\n")}` });
        await carica();
      }
    } catch (e) {
      setMessaggio({ ok: false, testo: e instanceof Error ? e.message : "Operazione non riuscita" });
    }
    setAttesa(null);
  };

  const apriCorrezione = async (doc: Documento) => {
    const { data: p } = await supabase.from("billing_profiles").select("*").eq("stripe_customer_id", doc.stripe_customer_id).maybeSingle();
    setCorrezione({ doc, profilo: (p as ProfiloFatturazione | null) ?? { ...PROFILO_VUOTO, stripe_customer_id: doc.stripe_customer_id } });
  };

  return (
    <section>
      <Messaggio m={messaggio} onChiudi={() => setMessaggio(null)} />
      <div className="scheda mb-4 grid gap-3 p-4 sm:grid-cols-4">
        <div><label className="etichetta">Dal</label><input type="date" className="campo" value={dal} onChange={(e) => setDal(e.target.value)} /></div>
        <div><label className="etichetta">Al</label><input type="date" className="campo" value={al} onChange={(e) => setAl(e.target.value)} /></div>
        <div><label className="etichetta">Cliente</label><input className="campo" placeholder="Nome o cus_…" value={cliente} onChange={(e) => setCliente(e.target.value)} /></div>
        <div>
          <label className="etichetta">Stato SDI</label>
          <select className="campo" value={gruppo} onChange={(e) => setGruppo(e.target.value)}>
            <option value="tutti">Tutti</option>
            <option value="prova">Solo prova (non inviate)</option>
            <option value="in_attesa">Inviate, in attesa di esito</option>
            <option value="consegnate">Consegnate</option>
            <option value="scartate">Scartate / rifiutate</option>
          </select>
        </div>
      </div>

      <div className="scheda overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-3 py-2">Documento</th><th className="px-3 py-2">Cliente</th><th className="px-3 py-2 text-right">Totale</th><th className="px-3 py-2">Stato SDI</th><th className="px-3 py-2 text-right">Azioni</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibili.map((r) => {
              const stato = STATI_SDI[r.stato_sdi ?? ""] ?? { etichetta: r.stato_sdi ?? "—", colore: "bg-slate-100 text-slate-700" };
              const scartata = SCARTATI.includes(r.stato_sdi ?? "");
              const occupato = (a: string) => attesa === `${r.id}:${a}`;
              return (
                <tr key={r.id} className="align-top">
                  <td className="px-3 py-2">
                    <p className="font-medium">{r.tipo === "fattura" ? "Fattura" : "Nota di credito"} n. {r.numero ?? "—"}</p>
                    <p className="text-xs text-slate-500">{data(r.data)} · <span className="font-mono">{r.stripe_invoice_id}</span></p>
                  </td>
                  <td className="px-3 py-2">{nomi[r.stripe_customer_id] ?? <span className="font-mono text-xs">{r.stripe_customer_id}</span>}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {euro(r.totale)}
                    <p className="text-xs text-slate-500">imp. {euro(r.imponibile)} · IVA {euro(r.iva)}</p>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <Badge testo={stato.etichetta} colore={stato.colore} />
                      {r.dry_run && <Badge testo="Prova" colore="bg-violet-100 text-violet-800" />}
                    </div>
                    {r.inviata_at && <p className="mt-1 text-xs text-slate-500">Inviata {dataOra(r.inviata_at)}</p>}
                    {scartata && r.sdi_motivo && (
                      <p className="mt-1 max-w-xs text-xs text-red-700">{r.sdi_codice ? `[${r.sdi_codice}] ` : ""}{r.sdi_motivo}{r.sdi_soluzione ? ` — ${r.sdi_soluzione}` : ""}</p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap justify-end gap-1">
                      {scartata && <button className="btn-primario" onClick={() => apriCorrezione(r)}>Correggi e reinvia</button>}
                      <button className="btn-secondario" disabled={!!attesa} onClick={() => esegui(r, "reinvia")}>{occupato("reinvia") ? "…" : "Reinvia"}</button>
                      <button className="btn-secondario" disabled={!!attesa} onClick={() => esegui(r, "pdf")}>{occupato("pdf") ? "…" : "Scarica PDF"}</button>
                      <button className="btn-secondario" disabled={!!attesa} onClick={() => esegui(r, "link_fic")}>Apri su Fatture in Cloud</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!visibili.length && <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">Nessun documento nel periodo selezionato.</td></tr>}
          </tbody>
        </table>
      </div>

      {correzione && (
        <Finestra titolo={`Correggi e reinvia — ${correzione.doc.tipo === "fattura" ? "fattura" : "nota di credito"} n. ${correzione.doc.numero ?? ""}`} onChiudi={() => setCorrezione(null)}>
          {correzione.doc.sdi_motivo && (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">
              <p className="font-medium">Motivo dello scarto{correzione.doc.sdi_codice ? ` (codice ${correzione.doc.sdi_codice})` : ""}</p>
              <p>{correzione.doc.sdi_motivo}</p>
              {correzione.doc.sdi_soluzione && <p className="mt-1">Soluzione suggerita: {correzione.doc.sdi_soluzione}</p>}
            </div>
          )}
          <ModuloProfilo
            iniziale={correzione.profilo}
            etichettaSalva="Salva, verifica e reinvia"
            onSalvato={async () => {
              const doc = correzione.doc;
              setCorrezione(null);
              await esegui(doc, "correggi_e_reinvia");
            }}
          />
        </Finestra>
      )}
    </section>
  );
}
