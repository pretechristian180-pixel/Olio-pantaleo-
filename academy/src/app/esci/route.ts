import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { REMEMBER_COOKIE } from "@/lib/remember";
import { cookieOptionsFor } from "@/lib/supabase/cookie-domain";

/** Uscita: solo POST, così un link esterno non può disconnetterti. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  const response = NextResponse.redirect(new URL("/", request.url), { status: 303 });
  response.cookies.set(REMEMBER_COOKIE, "", {
    path: "/",
    maxAge: 0,
    ...cookieOptionsFor(request.headers.get("x-forwarded-host") ?? request.headers.get("host")),
  });
  return response;
}
