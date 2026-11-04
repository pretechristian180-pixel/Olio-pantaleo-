import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/** Scarica un materiale: URL firmato di 5 minuti, solo se la lezione è visibile all'utente. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return new NextResponse("Non trovato", { status: 404 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) {
    return NextResponse.redirect(
      new URL(`/accedi?next=${encodeURIComponent(request.nextUrl.pathname)}`, request.url),
    );
  }

  const { data: res } = await supabase
    .from("lesson_resources")
    .select("nome, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!res) return new NextResponse("Materiale non disponibile", { status: 403 });

  const { data, error } = await supabase.storage
    .from("materiali")
    .createSignedUrl(res.storage_path, 300, { download: res.nome });
  if (error || !data) return new NextResponse("Materiale non disponibile", { status: 404 });
  return NextResponse.redirect(data.signedUrl, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
