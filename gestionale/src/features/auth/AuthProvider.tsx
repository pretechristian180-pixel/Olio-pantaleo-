import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { authLinkType, supabase } from "@/lib/supabase";
import { loadSession, setCurrentUser } from "@/services/api";
import { emitChange } from "@/services/events";
import type { Agency, Agent } from "@/types/domain";

interface AuthState {
  /** Vero finché non sappiamo se l'utente è collegato */
  loading: boolean;
  session: Session | null;
  agent: Agent | null;
  agency: Agency | null;
  isOwner: boolean;
  /** Collegato ma senza profilo attivo (account disattivato o non ancora pronto) */
  noProfile: boolean;
  /** Arrivato da un link di invito o di recupero: deve scegliere la password */
  mustSetPassword: boolean;
  passwordSet: () => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [agency, setAgency] = useState<Agency | null>(null);
  const [loading, setLoading] = useState(true);
  const [noProfile, setNoProfile] = useState(false);
  const [mustSetPassword, setMustSetPassword] = useState(authLinkType !== null);

  const load = useCallback(async (s: Session | null) => {
    setSession(s);
    if (!s) {
      setAgent(null);
      setAgency(null);
      setNoProfile(false);
      setCurrentUser({ userId: "", agencyId: "", isOwner: false });
      setLoading(false);
      return;
    }
    try {
      const res = await loadSession(s.user.id);
      if (!res || !res.agent.active) {
        setNoProfile(true);
        setAgent(null);
        setAgency(null);
      } else {
        setNoProfile(false);
        setAgent(res.agent);
        setAgency(res.agency);
        setCurrentUser({ userId: res.agent.id, agencyId: res.agency.id, isOwner: res.agent.role === "titolare" });
      }
    } catch {
      setNoProfile(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") setMustSetPassword(true);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED" || event === "PASSWORD_RECOVERY") {
        // Fuori dal callback: supabase-js sconsiglia altre chiamate al suo interno
        setTimeout(() => load(s), 0);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [load]);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      agent,
      agency,
      isOwner: agent?.role === "titolare",
      noProfile,
      mustSetPassword,
      passwordSet: () => setMustSetPassword(false),
      refresh: async () => {
        await load((await supabase.auth.getSession()).data.session);
        emitChange();
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [loading, session, agent, agency, noProfile, mustSetPassword, load],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth fuori da AuthProvider");
  return ctx;
}
