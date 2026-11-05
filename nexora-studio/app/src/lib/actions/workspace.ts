"use server";

import { SECTORS, type EditStyle, type Json } from "@nexora/shared";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { FormState } from "@/components/forms/form-message";
import { ONBOARDING_STEPS } from "@/lib/onboarding";
import { HEX_RE } from "@/lib/upload/colors";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_WORKSPACE_COOKIE, assertMember, getSessionContext } from "@/lib/workspace";

/**
 * Azioni sui dati dell'azienda e del brand.
 * Le stesse azioni servono all'onboarding (mode=onboarding: avanzano di passo)
 * e alla pagina Brand (mode=settings: salvano e restano sulla pagina).
 */

const SECTOR_VALUES = new Set<string>(SECTORS.map((s) => s.value));

function str(fd: FormData, key: string, max = 2000) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function orNull(v: string) {
  return v === "" ? null : v;
}

function isOnboarding(fd: FormData) {
  return fd.get("mode") === "onboarding";
}

async function setActiveWorkspace(id: string) {
  const store = await cookies();
  store.set(ACTIVE_WORKSPACE_COOKIE, id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
}

function normalizeWebsite(v: string) {
  if (!v) return null;
  const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const url = new URL(withProto);
    return url.hostname.includes(".") ? url.toString().replace(/\/$/, "") : undefined;
  } catch {
    return undefined;
  }
}

function normalizeInstagram(v: string) {
  if (!v) return null;
  const handle = v
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/.*$/, "");
  return /^[a-zA-Z0-9._]{1,30}$/.test(handle) ? handle : undefined;
}

/** Passo 1 / sezione "Azienda". Crea il workspace se non esiste ancora. */
export async function saveCompany(_prev: FormState, fd: FormData): Promise<FormState> {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/accedi");

  const name = str(fd, "name", 120);
  const sector = str(fd, "sector");
  const city = str(fd, "city", 80);
  const website = normalizeWebsite(str(fd, "website", 200));
  const instagram = normalizeInstagram(str(fd, "instagram", 100));

  const fieldErrors: Record<string, string> = {};
  if (name.length < 2) fieldErrors.name = "Scrivi il nome della tua azienda.";
  if (!SECTOR_VALUES.has(sector)) fieldErrors.sector = "Scegli il settore.";
  if (city.length < 2) fieldErrors.city = "Scrivi la città in cui lavori.";
  if (website === undefined) fieldErrors.website = "Controlla l'indirizzo del sito.";
  if (instagram === undefined)
    fieldErrors.instagram = "Scrivi solo il nome utente, es. pizzeriadamario.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const supabase = await createClient();
  const workspaceId = str(fd, "workspace_id");

  if (!workspaceId) {
    const { data, error } = await supabase.rpc("create_workspace", {
      p_name: name,
      p_sector: sector,
      p_city: city,
      p_website: website ?? null,
      p_instagram_handle: instagram ?? null,
    });
    if (error || !data) return { error: "Non siamo riusciti a creare l'azienda. Riprova." };
    await setActiveWorkspace(data.id);
    redirect("/onboarding");
  }

  await assertMember(workspaceId, "owner");
  const { error } = await supabase
    .from("workspaces")
    .update({
      name,
      sector,
      city,
      website: website ?? null,
      instagram_handle: instagram ?? null,
      ...(isOnboarding(fd) ? { onboarding_step: ONBOARDING_STEPS.brand } : {}),
    })
    .eq("id", workspaceId);
  if (error) return { error: "Salvataggio non riuscito. Riprova." };

  if (isOnboarding(fd)) redirect("/onboarding");
  revalidatePath("/", "layout");
  return { success: "Dati dell'azienda salvati." };
}

/** Passo 2 / sezione "Brand": logo, colori, tono di voce, pubblico, servizi. */
export async function saveBrand(_prev: FormState, fd: FormData): Promise<FormState> {
  const workspaceId = str(fd, "workspace_id");
  const { membership } = await assertMember(workspaceId);

  const tone = str(fd, "tone_of_voice", 600);
  const target = str(fd, "target_audience", 600);
  const services = str(fd, "services", 1200);
  const doNotSay = str(fd, "do_not_say", 600);
  const logoPath = str(fd, "logo_path", 300);

  let colors: string[] = [];
  try {
    const parsed: unknown = JSON.parse(str(fd, "brand_colors") || "[]");
    if (Array.isArray(parsed)) {
      colors = parsed
        .filter((c): c is string => typeof c === "string" && HEX_RE.test(c))
        .slice(0, 5);
    }
  } catch {
    // colori non validi: ignorati
  }

  const fieldErrors: Record<string, string> = {};
  if (tone.length < 3)
    fieldErrors.tone_of_voice = "Descrivi in poche parole come parla la tua azienda.";
  if (target.length < 3) fieldErrors.target_audience = "Scrivi a chi ti rivolgi.";
  if (services.length < 3) fieldErrors.services = "Scrivi almeno un servizio o prodotto.";
  if (logoPath && !logoPath.startsWith(`${workspaceId}/`)) fieldErrors.logo = "Logo non valido.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const supabase = await createClient();
  const { error: brandError } = await supabase
    .from("brand_profiles")
    .update({
      tone_of_voice: tone,
      target_audience: target,
      services,
      do_not_say: orNull(doNotSay),
    })
    .eq("workspace_id", workspaceId);
  if (brandError) return { error: "Salvataggio non riuscito. Riprova." };

  // Logo e colori stanno sul workspace: li aggiorna solo il titolare.
  if (membership.role === "owner") {
    const { error } = await supabase
      .from("workspaces")
      .update({
        logo_url: orNull(logoPath),
        brand_colors: colors,
        ...(isOnboarding(fd) ? { onboarding_step: ONBOARDING_STEPS.examples } : {}),
      })
      .eq("id", workspaceId);
    if (error) return { error: "Salvataggio non riuscito. Riprova." };
  }

  if (isOnboarding(fd)) redirect("/onboarding");
  revalidatePath("/brand");
  return { success: "Brand aggiornato." };
}

/** Passo 3 / sezione "Video di esempio": percorsi già caricati nel bucket brand. */
export async function saveExamples(_prev: FormState, fd: FormData): Promise<FormState> {
  const workspaceId = str(fd, "workspace_id");
  await assertMember(workspaceId);

  let paths: string[] = [];
  try {
    const parsed: unknown = JSON.parse(str(fd, "reference_videos", 5000) || "[]");
    if (Array.isArray(parsed)) {
      paths = parsed
        .filter((p): p is string => typeof p === "string" && p.startsWith(`${workspaceId}/esempi/`))
        .slice(0, 3);
    }
  } catch {
    return { error: "Elenco dei video non valido." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("brand_profiles")
    .update({ reference_videos: paths })
    .eq("workspace_id", workspaceId);
  if (error) return { error: "Salvataggio non riuscito. Riprova." };

  if (isOnboarding(fd)) {
    await supabase
      .from("workspaces")
      .update({ onboarding_step: ONBOARDING_STEPS.publishing })
      .eq("id", workspaceId);
    redirect("/onboarding");
  }
  revalidatePath("/brand");
  return { success: "Video di esempio aggiornati." };
}

/** Passo 4 / sezione "Pubblicazione": frequenza, giorni e orario. Chiude l'onboarding. */
export async function savePublishing(_prev: FormState, fd: FormData): Promise<FormState> {
  const workspaceId = str(fd, "workspace_id");
  await assertMember(workspaceId, "owner");

  const perWeek = Number(str(fd, "posts_per_week"));
  const days = fd
    .getAll("posting_days")
    .map((d) => Number(d))
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
  const uniqueDays = [...new Set(days)].sort();
  const time = str(fd, "posting_time");

  const fieldErrors: Record<string, string> = {};
  if (![2, 3, 4].includes(perWeek)) fieldErrors.posts_per_week = "Scegli quanti video a settimana.";
  else if (uniqueDays.length !== perWeek) {
    fieldErrors.posting_days = `Scegli ${perWeek} giorni, uno per ogni video.`;
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) fieldErrors.posting_time = "Scegli un orario.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase
    .from("workspaces")
    .update({
      posts_per_week: perWeek,
      posting_days: uniqueDays,
      posting_time: time,
      ...(isOnboarding(fd) ? { onboarding_completed_at: new Date().toISOString() } : {}),
    })
    .eq("id", workspaceId);
  if (error) return { error: "Salvataggio non riuscito. Riprova." };

  if (isOnboarding(fd)) redirect("/onboarding/fatto");
  revalidatePath("/", "layout");
  return { success: "Preferenze di pubblicazione salvate." };
}

/** Sezione "Stile di montaggio". */
export async function saveEditStyle(_prev: FormState, fd: FormData): Promise<FormState> {
  const workspaceId = str(fd, "workspace_id");
  await assertMember(workspaceId);

  const pick = <T extends string>(key: string, allowed: readonly T[]): T | undefined => {
    const v = str(fd, key) as T;
    return allowed.includes(v) ? v : undefined;
  };

  const style: EditStyle = {
    pace: pick("pace", ["calmo", "medio", "veloce"] as const),
    subtitles: {
      style: pick("subtitles_style", ["pulito", "evidenziato", "karaoke"] as const),
      size: pick("subtitles_size", ["piccoli", "medi", "grandi"] as const),
    },
    music: { mood: pick("music_mood", ["energica", "rilassata", "elegante", "nessuna"] as const) },
    broll_usage: pick("broll_usage", ["nessuno", "poco", "spesso"] as const),
    logo_outro: fd.get("logo_outro") === "on",
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from("brand_profiles")
    .update({ edit_style: style as unknown as Json })
    .eq("workspace_id", workspaceId);
  if (error) return { error: "Salvataggio non riuscito. Riprova." };

  revalidatePath("/brand");
  return { success: "Stile di montaggio salvato." };
}

/** Torna a un passo precedente dell'onboarding. */
export async function goToOnboardingStep(fd: FormData) {
  const workspaceId = str(fd, "workspace_id");
  const step = Number(str(fd, "step"));
  await assertMember(workspaceId, "owner");
  if (step >= ONBOARDING_STEPS.company && step <= ONBOARDING_STEPS.publishing) {
    const supabase = await createClient();
    await supabase.from("workspaces").update({ onboarding_step: step }).eq("id", workspaceId);
  }
  redirect("/onboarding");
}

/** Cambia l'azienda attiva (utenti con più workspace). */
export async function switchWorkspace(fd: FormData) {
  const workspaceId = str(fd, "workspace_id");
  await assertMember(workspaceId);
  await setActiveWorkspace(workspaceId);
  redirect("/inizio");
}
