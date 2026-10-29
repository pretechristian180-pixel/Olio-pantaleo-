/**
 * Sostituto del client Supabase per l'anteprima pubblicata: l'accesso è simulato
 * (si entra subito come titolare di un'agenzia di esempio; "Esci" porta al login,
 * e qualsiasi email e password fanno rientrare). Nessuna chiamata di rete.
 */
import type { Session } from "@supabase/supabase-js";

type AuthEvent = "SIGNED_IN" | "SIGNED_OUT" | "USER_UPDATED";
type Listener = (event: AuthEvent, session: Session | null) => void;

const fakeSession = {
  access_token: "anteprima",
  refresh_token: "anteprima",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: "u_1", email: "giuseppe@immobiliarelevante.it", aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "" },
} as unknown as Session;

let session: Session | null = fakeSession;
const listeners = new Set<Listener>();
const notify = (e: AuthEvent) => listeners.forEach((l) => l(e, session));
const pause = (ms = 400) => new Promise((r) => setTimeout(r, ms));

export const authLinkType: "invite" | "recovery" | null = null;
export const PHOTO_BUCKET = "property-photos";
export const LOGO_BUCKET = "agency-logos";

export const supabase = {
  auth: {
    async getSession() {
      return { data: { session } };
    },
    onAuthStateChange(cb: Listener) {
      listeners.add(cb);
      return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
    },
    async signInWithPassword(_creds: { email: string; password: string }) {
      void _creds;
      await pause();
      session = fakeSession;
      notify("SIGNED_IN");
      return { data: { session }, error: null };
    },
    async signUp(_args: unknown) {
      void _args;
      await pause();
      session = fakeSession;
      notify("SIGNED_IN");
      return { data: { session }, error: null };
    },
    async resetPasswordForEmail(_email: string, _opts?: unknown) {
      void _email;
      void _opts;
      await pause();
      return { data: {}, error: null };
    },
    async updateUser(_attrs: unknown) {
      void _attrs;
      await pause();
      return { data: { user: session?.user ?? null }, error: null };
    },
    async signOut() {
      session = null;
      notify("SIGNED_OUT");
      return { error: null };
    },
  },
};
