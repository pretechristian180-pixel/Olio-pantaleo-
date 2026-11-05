import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { hasSupabaseAuthCookie, REMEMBER_COOKIE } from "@/lib/remember";
import { cookieOptionsFor } from "./cookie-domain";

/** Rinnova la sessione Supabase a ogni richiesta e restituisce l'id utente (o null). */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!isSupabaseConfigured()) return { response, userId: null as string | null };

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL!,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: cookieOptionsFor(
        request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
      ),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // "Ricordami" spento e browser riaperto: chiudiamo la sessione rimasta nei cookie.
  const names = request.cookies.getAll().map((c) => c.name);
  if (hasSupabaseAuthCookie(names) && !request.cookies.has(REMEMBER_COOKIE)) {
    await supabase.auth.signOut({ scope: "local" });
    return { response, userId: null };
  }

  // Non inserire codice tra createServerClient e getClaims: serve a rinnovare i token.
  const { data } = await supabase.auth.getClaims();
  let userId = (data?.claims?.sub as string | undefined) ?? null;
  // Se il controllo veloce del token fallisce ma c'è una sessione, chiediamo al server Auth:
  // middleware e pagine devono dare la stessa risposta, altrimenti /accedi e /app si rimbalzano.
  if (!userId && hasSupabaseAuthCookie(names)) {
    const { data: u } = await supabase.auth.getUser();
    userId = u.user?.id ?? null;
  }
  return { response, userId };
}
