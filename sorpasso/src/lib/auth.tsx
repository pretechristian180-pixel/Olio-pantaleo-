import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/query";
import type { Organization, Profile, Ruolo } from "@/types/db";

/** Perché un utente collegato non può entrare nella sua concessionaria. */
export type MotivoBlocco = "sospesa" | "disdetta" | "prova_scaduta" | "utente_disattivato";

interface StatoAccesso {
  admin_piattaforma: boolean;
  ha_profilo: boolean;
  profilo_attivo: boolean;
  stato_organizzazione: "prova" | "attiva" | "sospesa" | "disdetta" | null;
  prova_scaduta: boolean | null;
  nome_organizzazione: string | null;
}

interface AuthState {
  /** true finché non sappiamo se l'utente è collegato. */
  caricamento: boolean;
  session: Session | null;
  profilo: Profile | null;
  organizzazione: Organization | null;
  /** Utente collegato ma senza concessionaria: va completato l'onboarding. */
  senzaProfilo: boolean;
  /** Amministratore della piattaforma (team Sorpasso): accede a /piattaforma. */
  adminPiattaforma: boolean;
  /** Concessionaria sospesa/disdetta/prova scaduta o utente disattivato. */
  blocco: { motivo: MotivoBlocco; organizzazione: string | null } | null;
  ricarica: () => Promise<void>;
  esci: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profilo, setProfilo] = useState<Profile | null>(null);
  const [organizzazione, setOrganizzazione] = useState<Organization | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [accesso, setAccesso] = useState<StatoAccesso | null>(null);
  // Dopo un login la sessione arriva prima del profilo: finché non è caricato non si decide nulla
  const [caricandoProfilo, setCaricandoProfilo] = useState(false);

  const caricaProfilo = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfilo(null);
      setOrganizzazione(null);
      setAccesso(null);
      return;
    }
    const [{ data }, { data: stato }] = await Promise.all([
      supabase.from("profiles").select("*, organizations(*)").eq("user_id", s.user.id).maybeSingle(),
      supabase.rpc("stato_mio_accesso"),
    ]);
    setAccesso((stato as StatoAccesso | null) ?? null);
    // Con la concessionaria sospesa le policy nascondono l'organizzazione: niente profilo "a metà"
    if (data && data.attivo && (data as { organizations: Organization | null }).organizations) {
      const { organizations, ...p } = data as Profile & { organizations: Organization };
      setProfilo(p);
      setOrganizzazione(organizations);
    } else {
      setProfilo(null);
      setOrganizzazione(null);
    }
  }, []);

  useEffect(() => {
    let attivo = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!attivo) return;
      setSession(data.session);
      await caricaProfilo(data.session);
      if (attivo) setCaricamento(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      setSession(s);
      if (evento === "SIGNED_IN" || evento === "SIGNED_OUT" || evento === "USER_UPDATED") {
        setCaricandoProfilo(true);
        // Fuori dal callback: evita blocchi del client auth.
        setTimeout(() => void caricaProfilo(s).finally(() => setCaricandoProfilo(false)), 0);
      }
      if (evento === "SIGNED_OUT") queryClient.clear();
    });
    return () => {
      attivo = false;
      sub.subscription.unsubscribe();
    };
  }, [caricaProfilo]);

  const blocco = useMemo<AuthState["blocco"]>(() => {
    if (!accesso?.ha_profilo) return null;
    const organizzazione = accesso.nome_organizzazione;
    if (!accesso.profilo_attivo) return { motivo: "utente_disattivato", organizzazione };
    if (accesso.stato_organizzazione === "sospesa" || accesso.stato_organizzazione === "disdetta")
      return { motivo: accesso.stato_organizzazione, organizzazione };
    if (accesso.prova_scaduta) return { motivo: "prova_scaduta", organizzazione };
    return null;
  }, [accesso]);
  const adminPiattaforma = !!accesso?.admin_piattaforma;

  const value = useMemo<AuthState>(
    () => ({
      caricamento: caricamento || caricandoProfilo,
      session,
      profilo,
      organizzazione,
      senzaProfilo: !!session && !profilo && !caricamento && !caricandoProfilo && !blocco && !adminPiattaforma,
      adminPiattaforma,
      blocco,
      ricarica: () => caricaProfilo(session),
      esci: async () => {
        await supabase.auth.signOut();
      },
    }),
    [caricamento, caricandoProfilo, session, profilo, organizzazione, caricaProfilo, blocco, adminPiattaforma],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth fuori da AuthProvider");
  return ctx;
}

/**
 * Sessione di un utente già dentro l'app (profilo e organizzazione garantiti).
 * Da usare solo nelle pagine protette.
 */
export function useSessione() {
  const { profilo, organizzazione, ricarica } = useAuth();
  if (!profilo || !organizzazione) throw new Error("useSessione senza profilo");
  const ruolo = profilo.ruolo;
  return {
    profilo,
    organizzazione,
    ricarica,
    ruolo,
    userId: profilo.user_id,
    orgId: organizzazione.id,
    isTitolare: ruolo === "titolare",
    /** Titolare o responsabile vendite: vede tutto il commerciale. */
    isManager: ruolo === "titolare" || ruolo === "responsabile_vendite",
    isVenditore: ruolo === "venditore",
    isAmministrazione: ruolo === "amministrazione",
    puo: (...ruoli: Ruolo[]) => ruoli.includes(ruolo),
  };
}
