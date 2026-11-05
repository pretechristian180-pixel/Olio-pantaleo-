import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { staffLesson } from "@/lib/admin-api";
import { createBunnyUpload, deleteBunnyVideo, isBunnyConfigured } from "@/lib/bunny-admin";

/**
 * Prepara il caricamento di un video: crea il video su Bunny, lo collega alla lezione
 * e restituisce la firma TUS temporanea. Il file va dal browser a Bunny, non passa dal server.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = z.object({ lessonId: z.string().uuid() }).safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ errore: "Richiesta non valida" }, { status: 400 });
  if (!isBunnyConfigured()) {
    return NextResponse.json(
      { errore: "Il caricamento video non è ancora attivo: mancano le chiavi Bunny Stream." },
      { status: 503 },
    );
  }
  const ctx = await staffLesson(parsed.data.lessonId);
  if ("error" in ctx) return ctx.error;
  const { lesson, tenant, supabase } = ctx;

  try {
    const upload = await createBunnyUpload(
      `${tenant.slug} · ${lesson.courses.titolo} · ${lesson.titolo}`,
    );
    const { error } = await supabase
      .from("lessons")
      .update({ bunny_video_id: upload.videoId, durata_sec: 0 })
      .eq("id", lesson.id);
    if (error) {
      await deleteBunnyVideo(upload.videoId);
      return NextResponse.json(
        { errore: "Non siamo riusciti a collegare il video alla lezione." },
        { status: 500 },
      );
    }
    // Il video precedente non serve più.
    if (lesson.bunny_video_id) await deleteBunnyVideo(lesson.bunny_video_id);
    return NextResponse.json(upload, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { errore: "Bunny Stream non risponde. Riprova tra poco." },
      { status: 502 },
    );
  }
}
