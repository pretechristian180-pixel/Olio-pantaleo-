import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { nextProgress } from "@/lib/progress";
import { progressSchema } from "@/lib/validation";
import { afterLessonCompleted } from "@/lib/certificates";

/**
 * Battito del player (ogni ~10 s, alla pausa e all'uscita dalla pagina).
 * Le RLS garantiscono che si scriva solo il proprio avanzamento e solo su lezioni visibili.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = progressSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ errore: "Dati non validi" }, { status: 400 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub as string | undefined;
  if (!userId) return NextResponse.json({ errore: "Accesso richiesto" }, { status: 401 });

  const { lessonId, secondo, delta } = parsed.data;
  const [{ data: lesson }, { data: prev }] = await Promise.all([
    supabase.from("lessons").select("durata_sec").eq("id", lessonId).maybeSingle(),
    supabase
      .from("lesson_progress")
      .select("ultimo_secondo, secondi_visti, completata")
      .eq("user_id", userId)
      .eq("lesson_id", lessonId)
      .maybeSingle(),
  ]);
  if (!lesson) return NextResponse.json({ errore: "Lezione non disponibile" }, { status: 404 });

  // Se la durata non è ancora stata salvata (video appena caricato), usiamo quella del player.
  const durataSec = lesson.durata_sec || Math.round(parsed.data.durata ?? 0);
  const row = nextProgress(prev, { secondo, delta, durataSec });
  const { error } = await supabase.from("lesson_progress").upsert({
    user_id: userId,
    lesson_id: lessonId,
    ...row,
    completata_il: row.completata && !prev?.completata ? new Date().toISOString() : undefined,
  });
  if (error) return NextResponse.json({ errore: "Avanzamento non salvato" }, { status: 500 });
  if (row.completata && !prev?.completata) {
    const email = (auth?.claims?.email as string | undefined) ?? "";
    if (email) await afterLessonCompleted(lessonId, email);
  }
  return NextResponse.json({ completata: row.completata });
}
