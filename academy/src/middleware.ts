import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PROTETTE = ["/app", "/admin"];

export async function middleware(request: NextRequest) {
  // Il layout ha bisogno del percorso per sapere cosa mostrare se l'academy è sospesa.
  request.headers.set("x-nx-path", request.nextUrl.pathname);
  const { response, userId } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  const protetta = PROTETTE.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (protetta && !userId) {
    const url = request.nextUrl.clone();
    url.pathname = "/accedi";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    const redirect = NextResponse.redirect(url);
    // Conserva eventuali cookie aggiornati (es. sessione chiusa).
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/stripe/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
