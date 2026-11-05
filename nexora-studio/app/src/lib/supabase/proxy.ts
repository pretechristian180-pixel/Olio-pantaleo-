import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isSupabaseConfigured, publicEnv } from "@/lib/env";

/** Pagine che richiedono l'accesso. */
const PROTECTED_PREFIXES = [
  "/inizio",
  "/script",
  "/video",
  "/calendario",
  "/brand",
  "/social",
  "/piano",
  "/team",
  "/onboarding",
  "/admin",
];

/** Pagine di accesso: chi è già dentro va alla Home. */
const AUTH_PAGES = ["/accedi", "/registrati", "/password-dimenticata"];

function matches(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Rinnova la sessione Supabase a ogni richiesta, riscrive i cookie aggiornati
 * e fa un primo controllo ottimistico sulle pagine riservate.
 * Il controllo vero resta nelle pagine e nelle Server Action (getUser / RLS).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured()) return response;

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
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
  });

  // Non inserire codice tra createServerClient e getClaims: serve a validare il token.
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    if (path === "/accedi") url.searchParams.set("next", `${pathname}${search}`);
    const redirect = NextResponse.redirect(url);
    // Conserva i cookie di sessione appena rinnovati.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (!isLoggedIn && matches(pathname, PROTECTED_PREFIXES)) return redirectTo("/accedi");
  if (isLoggedIn && matches(pathname, AUTH_PAGES)) return redirectTo("/inizio");

  return response;
}
