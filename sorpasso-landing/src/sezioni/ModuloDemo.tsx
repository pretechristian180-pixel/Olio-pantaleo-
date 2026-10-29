import { useState, type FormEvent, type ReactNode } from "react";
import { ctaFinale, FASCE_LEAD } from "@/contenuti";
import { Pulsante } from "@/componenti/Pulsante";
import { getSupabase } from "@/lib/supabase";
import { tracciaLead } from "@/lib/tracciamento";

type Campo = "nome" | "concessionaria" | "citta" | "telefono" | "venditori" | "lead_mese" | "consenso_privacy";
type Stato = "pronto" | "invio" | "fatto" | "errore";

function utm() {
  const p = new URLSearchParams(window.location.search);
  const v = (k: string) => p.get(k)?.slice(0, 120) || null;
  return { utm_source: v("utm_source"), utm_medium: v("utm_medium"), utm_campaign: v("utm_campaign") };
}

export function ModuloDemo() {
  const [errori, setErrori] = useState<Partial<Record<Campo, string>>>({});
  const [stato, setStato] = useState<Stato>("pronto");
  const [messaggio, setMessaggio] = useState("");

  async function invia(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // Campo trappola: le persone non lo vedono, i bot lo compilano
    if (String(fd.get("sito_web") ?? "").trim()) {
      setStato("fatto");
      return;
    }
    // Validazione caricata solo ora: la pagina resta leggera
    const { schemaDemo } = await import("@/lib/schemaDemo");
    const r = schemaDemo.safeParse({
      nome: fd.get("nome"),
      concessionaria: fd.get("concessionaria"),
      citta: fd.get("citta"),
      telefono: fd.get("telefono"),
      venditori: fd.get("venditori"),
      lead_mese: fd.get("lead_mese") ?? "",
      consenso_privacy: fd.get("consenso_privacy") === "on",
    });
    if (!r.success) {
      const e2: Partial<Record<Campo, string>> = {};
      for (const i of r.error.issues) {
        const k = i.path[0] as Campo;
        if (!e2[k]) e2[k] = i.message;
      }
      setErrori(e2);
      const primo = document.querySelector<HTMLElement>(`[name="${Object.keys(e2)[0]}"]`);
      primo?.focus();
      return;
    }
    setErrori({});
    setStato("invio");
    const supabase = await getSupabase().catch(() => null);
    if (!supabase) {
      setStato("errore");
      setMessaggio(
        import.meta.env.DEV
          ? "Modulo non collegato: compila VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY in .env.local."
          : "Il modulo non è disponibile in questo momento. Chiamaci o scrivici: trovi i contatti in fondo alla pagina.",
      );
      return;
    }
    const { error } = await supabase.from("demo_requests").insert({
      ...r.data,
      consenso_privacy_at: new Date().toISOString(),
      ...utm(),
      user_agent: navigator.userAgent.slice(0, 300),
    });
    if (error) {
      // Nessun dato personale nei log: solo il codice
      console.warn("[demo] invio non riuscito", error.code);
      setStato("errore");
      setMessaggio("Invio non riuscito. Controlla la connessione e riprova: i dati che hai scritto sono ancora qui.");
      return;
    }
    tracciaLead();
    setStato("fatto");
  }

  return (
    <section id="demo" aria-labelledby="demo-titolo" className="relative overflow-hidden py-20 sm:py-28">
      <div aria-hidden className="pointer-events-none absolute -bottom-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-accent/20 blur-[140px]" />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        <div className="rivela lg:sticky lg:top-28">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-accent-2">Demo gratuita · 20 minuti</p>
          <h2 id="demo-titolo" className="text-[34px] font-extrabold sm:text-[48px]">{ctaFinale.titolo}</h2>
          <p className="mt-5 text-[19px] text-muted">{ctaFinale.sottotitolo}</p>
          <ul className="mt-8 space-y-3 text-[17px]">
            {["Analizziamo come gestisci oggi i lead", "Vedi Sorpasso AI con le tue auto e i tuoi numeri", "Ricevi una stima delle auto in più che puoi vendere"].map((t) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-2" aria-hidden>
                  ✓
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="rivela rounded-3xl border border-line-2 bg-bg-2 p-6 shadow-2xl sm:p-9">
          {stato === "fatto" ? (
            <div role="status" className="py-10 text-center">
              <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-ok/15 text-3xl text-ok" aria-hidden>
                ✓
              </span>
              <h3 className="mt-5 text-[26px] font-extrabold">{ctaFinale.successoTitolo}</h3>
              <p className="mt-2 text-muted">{ctaFinale.successoTesto}</p>
            </div>
          ) : (
            <form noValidate onSubmit={invia} className="relative space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Campo nome="nome" etichetta="Nome e cognome" errore={errori.nome}>
                  <input name="nome" autoComplete="name" className={stileInput(errori.nome)} aria-invalid={!!errori.nome} aria-describedby={errori.nome ? "errore-nome" : undefined} />
                </Campo>
                <Campo nome="telefono" etichetta="Telefono" errore={errori.telefono}>
                  <input name="telefono" type="tel" inputMode="tel" autoComplete="tel" className={stileInput(errori.telefono)} aria-invalid={!!errori.telefono} aria-describedby={errori.telefono ? "errore-telefono" : undefined} />
                </Campo>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Campo nome="concessionaria" etichetta="Concessionaria" errore={errori.concessionaria}>
                  <input name="concessionaria" autoComplete="organization" className={stileInput(errori.concessionaria)} aria-invalid={!!errori.concessionaria} aria-describedby={errori.concessionaria ? "errore-concessionaria" : undefined} />
                </Campo>
                <Campo nome="citta" etichetta="Città" errore={errori.citta}>
                  <input name="citta" autoComplete="address-level2" className={stileInput(errori.citta)} aria-invalid={!!errori.citta} aria-describedby={errori.citta ? "errore-citta" : undefined} />
                </Campo>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Campo nome="venditori" etichetta="Numero di venditori" errore={errori.venditori}>
                  <input name="venditori" type="number" inputMode="numeric" min={1} max={500} className={stileInput(errori.venditori)} aria-invalid={!!errori.venditori} aria-describedby={errori.venditori ? "errore-venditori" : undefined} />
                </Campo>
                <Campo nome="lead_mese" etichetta="Lead al mese" errore={errori.lead_mese}>
                  <select name="lead_mese" defaultValue="" className={stileInput(errori.lead_mese)} aria-invalid={!!errori.lead_mese} aria-describedby={errori.lead_mese ? "errore-lead_mese" : undefined}>
                    <option value="" disabled>
                      Scegli una fascia
                    </option>
                    {FASCE_LEAD.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </Campo>
              </div>

              {/* Trappola anti-bot: invisibile, non raggiungibile da tastiera */}
              <div aria-hidden className="pointer-events-none absolute left-0 top-0 size-px overflow-hidden opacity-0 [clip-path:inset(50%)]">
                <label>
                  Sito web
                  <input name="sito_web" tabIndex={-1} autoComplete="off" />
                </label>
              </div>

              <div>
                <label className="flex cursor-pointer items-start gap-3 text-[15px] leading-relaxed text-muted">
                  <input
                    name="consenso_privacy"
                    type="checkbox"
                    className="mt-1 size-5 shrink-0 accent-[var(--accent)]"
                    aria-invalid={!!errori.consenso_privacy}
                    aria-describedby={errori.consenso_privacy ? "errore-consenso_privacy" : undefined}
                  />
                  <span>
                    Ho letto l'
                    <a href="/privacy" target="_blank" rel="noopener" className="text-accent-2 underline underline-offset-2">
                      informativa privacy
                    </a>{" "}
                    e acconsento a essere ricontattato per la demo. <span className="text-danger">*</span>
                  </span>
                </label>
                {errori.consenso_privacy && (
                  <p id="errore-consenso_privacy" role="alert" className="mt-1.5 text-sm font-medium text-danger">
                    {errori.consenso_privacy}
                  </p>
                )}
              </div>

              {stato === "errore" && (
                <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-[15px] text-danger">
                  {messaggio}
                </p>
              )}

              <Pulsante type="submit" misura="lg" className="w-full" disabled={stato === "invio"}>
                {stato === "invio" ? "Invio in corso…" : ctaFinale.pulsante}
              </Pulsante>
              <p className="text-center text-sm text-muted">Ti richiamiamo entro un giorno lavorativo. Nessun impegno.</p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

const stileInput = (errore?: string) =>
  `h-12 w-full rounded-xl border bg-surface px-4 text-[16px] text-text placeholder:text-muted/60 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/20 ${
    errore ? "border-danger" : "border-line-2"
  }`;

function Campo({ nome, etichetta, errore, children }: { nome: string; etichetta: string; errore?: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-[15px] font-semibold">
        {etichetta} <span className="text-danger">*</span>
        <span className="mt-2 block font-normal">{children}</span>
      </label>
      {errore && (
        <p id={`errore-${nome}`} role="alert" className="mt-1.5 text-sm font-medium text-danger">
          {errore}
        </p>
      )}
    </div>
  );
}
