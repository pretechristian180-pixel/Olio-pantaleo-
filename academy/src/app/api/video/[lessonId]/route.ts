import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { embedForLesson } from "@/lib/video";

/** Nuovo URL embed firmato (es. quando quello della pagina sta per scadere). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const { lessonId } = await params;
  if (!z.string().uuid().safeParse(lessonId).success) {
    return NextResponse.json({ errore: "Lezione non valida" }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub)
    return NextResponse.json({ errore: "Accesso richiesto" }, { status: 401 });

  // La select passa dalle RLS: se non hai accesso alla lezione non torna nulla.
  const { data: lesson } = await supabase
    .from("lessons")
    .select("bunny_video_id")
    .eq("id", lessonId)
    .maybeSingle();
  if (!lesson) return NextResponse.json({ errore: "Lezione non disponibile" }, { status: 403 });

  const embed = embedForLesson(lesson.bunny_video_id);
  if (!embed) return NextResponse.json({ errore: "Video non ancora disponibile" }, { status: 404 });
  return NextResponse.json(embed, { headers: { "Cache-Control": "private, no-store" } });
}
