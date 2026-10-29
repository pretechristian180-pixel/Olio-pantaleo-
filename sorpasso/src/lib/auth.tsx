import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/query";
import type { Organization, Profile, Ruolo } from "@/types/db";

interface AuthState {
  /** true finché non sappiamo se l'utente è collegato. */
  caricamento: boolean;
  session: Session | null;
  profilo: Profile | null;
  organizzazione: Organization | null;
  /** Utente collegato ma senza concessionaria: va completato l'onboarding. */
  senzaProfilo: boolean;
  ricarica: () => Promise<void>;
  esci: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profilo, setProfilo] = useState<Profile | null>(null);
  const [organizzazione, setOrganizzazione] = useState<Organization | null>(null);
  const [caricamento, setCaricamento] = useState(true);

  const caricaProfilo = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfilo(null);
      setOrganizzazione(null);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("*, organizations(*)")
      .eq("user_id", s.user.id)
      .maybeSingle();
    if (data && data.attivo) {
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
        // Fuori dal callback: evita blocchi del client auth.
        setTimeout(() => void caricaProfilo(s), 0);
      }
      if (evento === "SIGNED_OUT") queryClient.clear();
    });
    return () => {
      attivo = false;
      sub.subscription.unsubscribe();
    };
  }, [caricaProfilo]);

  const value = useMemo<AuthState>(
    () => ({
      caricamento,
      session,
      profilo,
      organizzazione,
      senzaProfilo: !!session && !profilo && !caricamento,
      ricarica: () => caricaProfilo(session),
      esci: async () => {
        await supabase.auth.signOut();
      },
    }),
    [caricamento, session, profilo, organizzazione, caricaProfilo],
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
