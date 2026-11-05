import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { REMEMBER_COOKIE } from "@/lib/remember";
import { safeNext } from "@/lib/safe-redirect";
import { cookieOptionsFor } from "@/lib/supabase/cookie-domain";

/** Ritorno dai link email: conferma account, link di accesso, recupero password. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  if (!ok) return NextResponse.redirect(`${origin}/accedi?errore=link`);

  const response = NextResponse.redirect(`${origin}${next}`);
  response.cookies.set(REMEMBER_COOKIE, "1", {
    path: "/",
    maxAge: 31536000,
    sameSite: "lax",
    secure: origin.startsWith("https:"),
    ...cookieOptionsFor(request.headers.get("x-forwarded-host") ?? request.headers.get("host")),
  });
  return response;
}
