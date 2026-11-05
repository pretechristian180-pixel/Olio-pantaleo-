import "server-only";
import { NextResponse } from "next/server";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant";

/** Per le API del pannello: utente staff dell'academy corrente e lezione di questa academy. */
export async function staffLesson(lessonId: string) {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ errore: "Accesso richiesto" }, { status: 401 }) };
  if (!isStaffRole(user.membership?.ruolo))
    return { error: NextResponse.json({ errore: "Riservato allo staff" }, { status: 403 }) };
  const tenant = await getCurrentTenant();
  const supabase = await createClient();
  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, titolo, course_id, bunny_video_id, courses!inner(tenant_id, titolo)")
    .eq("id", lessonId)
    .eq("courses.tenant_id", tenant?.id ?? "")
    .maybeSingle();
  if (!lesson || !tenant)
    return { error: NextResponse.json({ errore: "Lezione non trovata" }, { status: 404 }) };
  const l = lesson as unknown as {
    id: string;
    titolo: string;
    course_id: string;
    bunny_video_id: string | null;
    courses: { titolo: string };
  };
  return { lesson: l, tenant, supabase };
}
