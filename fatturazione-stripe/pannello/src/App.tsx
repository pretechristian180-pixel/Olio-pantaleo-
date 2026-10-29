import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { configurato, supabase } from "./lib/supabase.ts";
import { Documenti } from "./pagine/Documenti.tsx";
import { Coda } from "./pagine/Coda.tsx";
import { Clienti } from "./pagine/Clienti.tsx";
import { Configurazione } from "./pagine/Configurazione.tsx";
import { Avvisi } from "./pagine/Avvisi.tsx";
import { Registro } from "./pagine/Registro.tsx";

const SEZIONI = [
  { id: "documenti", titolo: "Fatture e note di credito" },
  { id: "coda", titolo: "Coda di emissione" },
  { id: "avvisi", titolo: "Avvisi" },
  { id: "clienti", titolo: "Dati di fatturazione" },
  { id: "configurazione", titolo: "Configurazione fiscale" },
  { id: "registro", titolo: "Registro operazioni" },
] as const;
type Sezione = (typeof SEZIONI)[number]["id"];

export default function App() {
  const [sessione, setSessione] = useState<Session | null | undefined>(undefined);
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [sezione, setSezione] = useState<Sezione>("documenti");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessione(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSessione(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessione) { setAdmin(null); return; }
    supabase.rpc("is_admin").then(({ data }) => setAdmin(data === true));
  }, [sessione]);

  if (!configurato) return <Centro><p className="text-sm">Imposta <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> nel file <code>.env</code>.</p></Centro>;
  if (sessione === undefined) return <Centro><p className="text-sm text-slate-500">Caricamento…</p></Centro>;
  if (!sessione) return <Accesso />;
  if (admin === null) return <Centro><p className="text-sm text-slate-500">Verifica dei permessi…</p></Centro>;
  if (!admin) {
    return (
      <Centro>
        <p className="text-sm">Questo account non è amministratore della fatturazione.</p>
        <button className="btn-secondario mt-4" onClick={() => supabase.auth.signOut()}>Esci</button>
      </Centro>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-white/60">Stripe → Fatture in Cloud</p>
            <h1 className="text-lg font-semibold">Fatturazione automatica</h1>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-white/70 sm:inline">{sessione.user.email}</span>
            <button className="rounded-md border border-white/30 px-3 py-1.5 hover:bg-white/10" onClick={() => supabase.auth.signOut()}>Esci</button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4">
          {SEZIONI.map((s) => (
            <button
              key={s.id}
              onClick={() => setSezione(s.id)}
              className={`whitespace-nowrap rounded-t-md px-3 py-2 text-sm font-medium ${sezione === s.id ? "bg-slate-50 text-navy" : "text-white/75 hover:text-white"}`}
            >
              {s.titolo}
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        {sezione === "documenti" && <Documenti />}
        {sezione === "coda" && <Coda />}
        {sezione === "avvisi" && <Avvisi />}
        {sezione === "clienti" && <Clienti />}
        {sezione === "configurazione" && <Configurazione />}
        {sezione === "registro" && <Registro />}
      </main>
    </div>
  );
}

function Centro({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center p-4"><div className="scheda w-full max-w-sm p-6 text-center">{children}</div></div>;
}

function Accesso() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [attesa, setAttesa] = useState(false);
  const invia = async (e: FormEvent) => {
    e.preventDefault();
    setAttesa(true); setErrore(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setErrore("Credenziali non valide");
    setAttesa(false);
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy p-4">
      <form onSubmit={invia} className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h1 className="text-lg font-semibold text-navy">Pannello fatturazione</h1>
        <p className="mb-5 text-sm text-slate-500">Accesso riservato agli amministratori.</p>
        <label className="etichetta" htmlFor="email">Email</label>
        <input id="email" type="email" className="campo mb-3" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        <label className="etichetta" htmlFor="password">Password</label>
        <input id="password" type="password" className="campo mb-4" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        {errore && <p className="mb-3 text-sm text-red-600">{errore}</p>}
        <button className="btn-primario w-full py-2" disabled={attesa}>{attesa ? "Accesso…" : "Accedi"}</button>
      </form>
    </div>
  );
}
