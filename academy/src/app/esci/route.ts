import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { REMEMBER_COOKIE } from "@/lib/remember";

/** Uscita: solo POST, così un link esterno non può disconnetterti. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  const response = NextResponse.redirect(new URL("/", request.url), { status: 303 });
  response.cookies.delete(REMEMBER_COOKIE);
  return response;
}
