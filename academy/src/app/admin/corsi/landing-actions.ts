"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { getCourseBySlug } from "@/lib/data/courses";
import {
  AI_MODEL,
  AiUnavailableError,
  generateLandingCopy,
  regenerateSectionCopy,
} from "@/lib/landing/generate";
import {
  briefSchema,
  cleanData,
  parseSections,
  REGEN_MODES,
  sectionsFromAi,
  type Brief,
  type RegenMode,
  type Section,
} from "@/lib/landing/sections";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant";

type Result<T = undefined> =
  { ok: true; data?: T } | { ok: false; error: string; fields?: Record<string, string> };

async function ctx(courseId: string) {
  const user = await requireStaff();
  const tenant = await getCurrentTenant();
  if (!tenant) throw new Error("Academy non trovata");
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select("slug")
    .eq("id", courseId)
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  const course = data?.slug ? await getCourseBySlug(data.slug) : null;
  return { user, tenant, supabase, course };
}

/** Generazioni usate questo mese e limite del piano (null = illimitate). */
export async function aiUsage(tipo: "landing" | "sezione") {
  const tenant = await getCurrentTenant();
  if (!tenant) return { usate: 0, limite: 0 };
  const supabase = await createClient();
  const inizio = new Date();
  inizio.setUTCDate(1);
  inizio.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("ai_generations")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenant.id)
    .eq("tipo", tipo)
    .gte("creato_il", inizio.toISOString());
  // Funzioni effettive dell'academy: piano + eccezioni decise da Christian Prete Academy. IA spenta = limite 0.
  const f = tenant.funzioni;
  const limite = !f.landing_ia
    ? 0
    : tipo === "landing"
      ? f.max_landing_ai_mese
      : f.max_sezioni_ai_mese;
  return { usate: count ?? 0, limite: limite as number | null };
}

function aiError(e: unknown): string {
  if (e instanceof AiUnavailableError) return e.message;
  if (e instanceof Error && /IA/.test(e.message)) return e.message;
  return "L'IA non ha risposto in tempo. Riprova tra qualche secondo.";
}

export async function generateLanding(courseId: string, input: unknown): Promise<Result> {
  const { user, tenant, supabase, course } = await ctx(courseId);
  if (!course) return { ok: false, error: "Corso non trovato." };
  const parsed = briefSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Completa i campi evidenziati.", fields };
  }
  const { usate, limite } = await aiUsage("landing");
  if (limite !== null && usate >= limite) {
    return {
      ok: false,
      error: `Hai usato tutte le ${limite} generazioni di landing di questo mese. Passa a un piano superiore o modifica i testi a mano.`,
    };
  }
  if (course.outline.totaleLezioni === 0)
    return {
      ok: false,
      error: "Aggiungi prima moduli e lezioni: l'IA li usa per scrivere la landing.",
    };

  try {
    const { data, usage, model } = await generateLandingCopy(course, tenant.nome, parsed.data);
    const sezioni = sectionsFromAi(data);
    const { error } = await supabase.from("landing_pages").upsert(
      {
        course_id: courseId,
        tenant_id: tenant.id,
        brief: parsed.data,
        sezioni,
        generata_il: new Date().toISOString(),
      },
      { onConflict: "course_id" },
    );
    if (error) return { ok: false, error: "Landing generata ma non salvata. Riprova." };
    await supabase.from("ai_generations").insert({
      tenant_id: tenant.id,
      user_id: user.id,
      tipo: "landing",
      modello: model ?? AI_MODEL,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
    });
    revalidatePath(`/admin/corsi/${courseId}/landing`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: aiError(e) };
  }
}

export async function regenerateSection(
  courseId: string,
  sectionId: string,
  mode: RegenMode,
): Promise<Result<Section>> {
  const { user, tenant, supabase, course } = await ctx(courseId);
  if (!course || !(mode in REGEN_MODES)) return { ok: false, error: "Richiesta non valida." };
  const { data: landing } = await supabase
    .from("landing_pages")
    .select("brief, sezioni")
    .eq("course_id", courseId)
    .maybeSingle();
  if (!landing) return { ok: false, error: "Genera prima la landing." };
  const sezioni = parseSections(landing.sezioni);
  const target = sezioni.find((s) => s.id === sectionId);
  if (!target) return { ok: false, error: "Sezione non trovata: salva e riprova." };
  const brief = briefSchema.safeParse(landing.brief);
  if (!brief.success) return { ok: false, error: "Il brief è incompleto: rigenera la landing." };
  const { usate, limite } = await aiUsage("sezione");
  if (limite !== null && usate >= limite)
    return {
      ok: false,
      error: `Hai usato tutte le ${limite} riscritture di sezioni di questo mese.`,
    };

  try {
    const { data, usage, model } = await regenerateSectionCopy(
      course,
      tenant.nome,
      brief.data as Brief,
      target,
      mode,
    );
    const updated = { ...target, dati: cleanData(target.tipo, data) } as Section;
    const next = sezioni.map((s) => (s.id === sectionId ? updated : s));
    const { error } = await supabase
      .from("landing_pages")
      .update({ sezioni: next })
      .eq("course_id", courseId);
    if (error) return { ok: false, error: "Sezione riscritta ma non salvata. Riprova." };
    await supabase.from("ai_generations").insert({
      tenant_id: tenant.id,
      user_id: user.id,
      tipo: "sezione",
      modello: model ?? AI_MODEL,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
    });
    revalidatePath(`/corsi/${course.slug}`);
    return { ok: true, data: updated };
  } catch (e) {
    return { ok: false, error: aiError(e) };
  }
}

export async function saveLanding(courseId: string, sezioni: unknown): Promise<Result> {
  const { supabase, course } = await ctx(courseId);
  const clean = parseSections(sezioni);
  if (!clean.length) return { ok: false, error: "La landing non può essere vuota." };
  const { error } = await supabase
    .from("landing_pages")
    .update({ sezioni: clean })
    .eq("course_id", courseId);
  if (error) return { ok: false, error: "Non siamo riusciti a salvare. Riprova." };
  if (course) revalidatePath(`/corsi/${course.slug}`);
  return { ok: true };
}

export async function setLandingStatus(
  courseId: string,
  stato: "draft" | "published",
): Promise<Result> {
  const { supabase, course } = await ctx(courseId);
  const parsed = z.enum(["draft", "published"]).safeParse(stato);
  if (!parsed.success) return { ok: false, error: "Stato non valido." };
  const { error } = await supabase
    .from("landing_pages")
    .update({ stato: parsed.data })
    .eq("course_id", courseId);
  if (error) return { ok: false, error: "Non siamo riusciti a salvare. Riprova." };
  if (course) revalidatePath(`/corsi/${course.slug}`);
  revalidatePath(`/admin/corsi/${courseId}/landing`);
  return { ok: true };
}
