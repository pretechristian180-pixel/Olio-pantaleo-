import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Fase 1: rinnovo della sessione. La protezione di /app e /admin arriva in Fase 2.
  const { response } = await updateSession(request);
  return response;
}

export const config = {
  matcher: [
    // Tutto tranne file statici e immagini.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
