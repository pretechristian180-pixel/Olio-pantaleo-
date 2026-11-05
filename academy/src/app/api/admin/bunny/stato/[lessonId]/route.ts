import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { staffLesson } from "@/lib/admin-api";
import { BUNNY_STATUS } from "@/lib/bunny-status";
import { getBunnyVideo } from "@/lib/bunny-admin";

/** Stato di elaborazione del video; quando è pronto salva la durata sulla lezione. */
export async function GET(_r: NextRequest, { params }: { params: Promise<{ lessonId: string }> }) {
  const ctx = await staffLesson((await params).lessonId);
  if ("error" in ctx) return ctx.error;
  const { lesson, supabase } = ctx;
  if (!lesson.bunny_video_id) return NextResponse.json({ stato: "nessuno" });
  try {
    const v = await getBunnyVideo(lesson.bunny_video_id);
    const info = BUNNY_STATUS[v.status] ?? { label: "Sconosciuto", done: false, failed: false };
    if (info.done && v.durataSec > 0) {
      await supabase.from("lessons").update({ durata_sec: v.durataSec }).eq("id", lesson.id);
      revalidatePath(`/admin/corsi/${lesson.course_id}`, "layout");
    }
    return NextResponse.json(
      { ...info, durataSec: v.durataSec, progress: v.progress },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ errore: "Stato non disponibile" }, { status: 502 });
  }
}
