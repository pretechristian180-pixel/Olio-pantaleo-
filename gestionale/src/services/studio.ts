/**
 * Livello dati del modulo Studio.
 * Le scritture "delicate" (avvio generazione, approvazioni, programmazione, consenso)
 * passano solo dalle funzioni del database: i controlli sono lato server.
 * Nessuna chiave di servizi esterni qui: lo script AI lo scrive la Edge Function "studio-script".
 */
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { PHOTO_BUCKET, supabase } from "@/lib/supabase";
import type { ID } from "@/types/domain";
import type {
  Approval,
  AvatarProfile,
  BrandSettings,
  CalendarPost,
  ConsentTemplate,
  Duration,
  Outcome,
  Platform,
  PublicApproval,
  ScheduledPost,
  SocialAccount,
  StudioUsage,
  VideoDetail,
  VideoProject,
} from "@/types/studio";
import { emitChange } from "./events";

// Le tabelle di Studio non sono nei tipi generati di src/types/database.ts: client senza tipi
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as SupabaseClient<any>;
/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export const TRAINING_BUCKET = "studio-training";
export const CONSENT_BUCKET = "studio-consensi";

function ok<T>(res: { data: T; error: PostgrestError | null }): NonNullable<T> {
  if (res.error) throw res.error;
  return res.data as NonNullable<T>;
}

async function myIds() {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id ?? "";
  const prof = ok(await db.from("profiles").select("agency_id, ruolo").eq("id", uid).single()) as Row;
  return { uid, agencyId: prof.agency_id as string, isOwner: prof.ruolo === "titolare" };
}

async function sign(paths: string[]) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return new Map<string, string>();
  const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(unique, 3600);
  const out = new Map<string, string>();
  for (const d of data ?? []) if (d.path && d.signedUrl) out.set(d.path, d.signedUrl);
  return out;
}

/* ---------- Conversione righe ---------- */

const VIDEO_SELECT =
  "*, property:properties(id, titolo, indirizzo, citta, property_photos(id, url, ordine))";

function toVideo(r: Row, signed?: Map<string, string>): VideoProject {
  const photos: Row[] = r.property?.property_photos ?? [];
  const first = photos.find((p) => p.id === r.foto_selezionate?.[0]) ?? [...photos].sort((a, b) => a.ordine - b.ordine)[0];
  return {
    id: r.id,
    propertyId: r.property_id,
    createdBy: r.creato_da,
    duration: r.durata_target,
    photoIds: r.foto_selezionate ?? [],
    intro: r.script_intro ?? "",
    outro: r.script_chiusura ?? "",
    caption: r.caption ?? "",
    hashtags: r.hashtag ?? [],
    status: r.stato,
    videoUrl: r.video_url,
    errorMessage: r.errore_messaggio,
    startedAt: r.generazione_avviata_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    property: {
      id: r.property?.id ?? r.property_id,
      title: r.property?.titolo ?? "",
      address: r.property?.indirizzo ?? "",
      city: r.property?.citta ?? "",
    },
    thumbUrl: first ? signed?.get(first.url) : undefined,
  };
}

async function videosFrom(rows: Row[]) {
  const signed = await sign(
    rows.map((r) => {
      const photos: Row[] = r.property?.property_photos ?? [];
      const first = photos.find((p) => p.id === r.foto_selezionate?.[0]) ?? [...photos].sort((a, b) => a.ordine - b.ordine)[0];
      return first?.url;
    }),
  );
  return rows.map((r) => toVideo(r, signed));
}

function toPost(r: Row): ScheduledPost {
  return {
    id: r.id,
    videoId: r.video_project_id,
    platform: r.piattaforma,
    caption: r.caption,
    publishAt: r.pubblica_alle,
    status: r.stato,
    url: r.url_post,
    error: r.errore,
  };
}

/* ---------- Video ---------- */

export async function listVideos(): Promise<VideoProject[]> {
  const rows = ok(await db.from("video_projects").select(VIDEO_SELECT).order("updated_at", { ascending: false })) as Row[];
  return videosFrom(rows);
}

export async function countToApprove(): Promise<number> {
  const { count, error } = await db.from("video_projects").select("id", { count: "exact", head: true }).eq("stato", "da_approvare");
  if (error) throw error;
  return count ?? 0;
}

export async function isApprover(): Promise<boolean> {
  return Boolean(ok(await db.rpc("studio_is_approver")));
}

export async function getVideo(id: ID): Promise<VideoDetail | null> {
  const row = ok(await db.from("video_projects").select(VIDEO_SELECT).eq("id", id).maybeSingle()) as Row | null;
  if (!row) return null;
  const [approvals, posts, approver, me] = await Promise.all([
    db
      .from("video_approvals")
      .select("id, esito, nota, via, created_at, approvatore:profiles(nome, cognome)")
      .eq("video_project_id", id)
      .not("esito", "is", null)
      .order("created_at", { ascending: false }),
    db.from("scheduled_posts").select("*").eq("video_project_id", id).order("pubblica_alle"),
    isApprover(),
    myIds(),
  ]);
  const photos: Row[] = row.property?.property_photos ?? [];
  const byId = new Map(photos.map((p) => [p.id, p.url as string]));
  const paths = (row.foto_selezionate as string[]).map((pid) => byId.get(pid)).filter((x): x is string => !!x);
  const signed = await sign(paths);
  return {
    video: toVideo(row, signed),
    photoUrls: paths.map((p) => signed.get(p)).filter((x): x is string => !!x),
    approvals: (ok(approvals) as Row[]).map(
      (a): Approval => ({
        id: a.id,
        outcome: a.esito,
        note: a.nota,
        via: a.via,
        approverName: a.approvatore ? `${a.approvatore.nome} ${a.approvatore.cognome}`.trim() : null,
        createdAt: a.created_at,
      }),
    ),
    posts: (ok(posts) as Row[]).map(toPost),
    canApprove: approver,
    canEdit: me.isOwner || row.creato_da === me.uid,
  };
}

export interface VideoDraft {
  propertyId: ID;
  duration: Duration;
  photoIds: ID[];
  intro: string;
  outro: string;
  caption: string;
  hashtags: string[];
}

/** Crea (o aggiorna, se `id` c'è) il progetto e restituisce il suo id */
export async function saveVideo(draft: VideoDraft, id?: ID): Promise<ID> {
  const cols = {
    durata_target: draft.duration,
    foto_selezionate: draft.photoIds,
    script_intro: draft.intro.trim(),
    script_chiusura: draft.outro.trim(),
    caption: draft.caption.trim(),
    hashtag: draft.hashtags,
  };
  if (id) {
    const rows = ok(await db.from("video_projects").update(cols).eq("id", id).select("id")) as Row[];
    if (!rows.length) throw Object.assign(new Error("permission denied"), { code: "42501" });
    return id;
  }
  const row = ok(await db.from("video_projects").insert({ ...cols, property_id: draft.propertyId }).select("id").single()) as Row;
  return row.id;
}

export async function startGeneration(id: ID) {
  ok(await db.rpc("studio_start_generation", { pid: id }));
  emitChange();
}

/** Fase 1: fa avanzare i lavori simulati (la Fase 2 userà i webhook dei provider) */
export async function tick() {
  ok(await db.rpc("studio_tick"));
}

export async function deleteDraft(id: ID) {
  ok(await db.from("video_projects").delete().eq("id", id));
  emitChange();
}

export interface ScriptProposal {
  intro: string;
  outro: string;
  caption: string;
  hashtags: string[];
  source: "ai" | "modello";
  warning?: string;
}

export async function generateScript(propertyId: ID, duration: Duration): Promise<ScriptProposal> {
  const { data, error } = await supabase.functions.invoke<{
    intro: string;
    chiusura: string;
    caption: string;
    hashtag: string[];
    fonte: "ai" | "modello";
    avviso?: string;
    error?: string;
  }>("studio-script", { body: { property_id: propertyId, durata: duration } });
  if (error || !data || data.error) throw new Error(data?.error ?? "Non siamo riusciti a scrivere il testo. Riprova tra poco.");
  return { intro: data.intro, outro: data.chiusura, caption: data.caption, hashtags: data.hashtag, source: data.fonte, warning: data.avviso };
}

/* ---------- Approvazione e programmazione ---------- */

export async function decide(id: ID, outcome: Outcome, note: string, publishAt: string | null, platforms: Platform[]) {
  ok(
    await db.rpc("studio_decide", {
      pid: id,
      p_esito: outcome,
      p_nota: note,
      p_pubblica_alle: publishAt,
      p_piattaforme: platforms,
    }),
  );
  emitChange();
}

export async function schedule(id: ID, publishAt: string, platforms: Platform[]) {
  ok(await db.rpc("studio_schedule", { pid: id, p_pubblica_alle: publishAt, p_piattaforme: platforms }));
  emitChange();
}

export async function proposedSlot(): Promise<string> {
  return ok(await db.rpc("studio_proposed_slot")) as string;
}

/** Crea il link monouso (7 giorni) per approvare da WhatsApp senza login */
export async function approvalLink(id: ID): Promise<string> {
  const token = ok(await db.rpc("studio_approval_link", { pid: id })) as string;
  return `${window.location.origin}/approva/${token}`;
}

export async function listCalendar(from: Date, to: Date): Promise<CalendarPost[]> {
  const rows = ok(
    await db
      .from("scheduled_posts")
      .select(`*, video:video_projects(${VIDEO_SELECT})`)
      .gte("pubblica_alle", from.toISOString())
      .lt("pubblica_alle", to.toISOString())
      .order("pubblica_alle"),
  ) as Row[];
  const videos = await videosFrom(rows.map((r) => r.video).filter(Boolean));
  const byId = new Map(videos.map((v) => [v.id, v]));
  return rows
    .filter((r) => byId.has(r.video_project_id))
    .map((r) => {
      const v = byId.get(r.video_project_id)!;
      return { ...toPost(r), video: { id: v.id, status: v.status, property: v.property, thumbUrl: v.thumbUrl } };
    });
}

/* ---------- Pagina pubblica (link WhatsApp, senza login) ---------- */

async function callApproval<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T & { error?: string }>("studio-approvazione", { body });
  if (data && (data as { error?: string }).error) throw new Error((data as { error?: string }).error);
  if (error) {
    // Il messaggio dell'Edge Function è nel corpo della risposta
    const ctx = (error as { context?: Response }).context;
    const msg = ctx && typeof ctx.json === "function" ? await ctx.json().then((j: { error?: string }) => j.error).catch(() => null) : null;
    throw new Error(msg ?? "Il link non è più valido oppure c'è un problema di connessione.");
  }
  return data as T;
}

export async function getPublicApproval(token: string): Promise<PublicApproval> {
  const d = await callApproval<Row>({ token });
  return {
    agencyName: d.agenzia,
    agencyPhone: d.telefono,
    property: { title: d.immobile?.titolo ?? "", address: d.immobile?.indirizzo ?? "", city: d.immobile?.citta ?? "" },
    duration: d.video.durata,
    intro: d.video.intro ?? "",
    outro: d.video.chiusura ?? "",
    caption: d.video.caption ?? "",
    hashtags: d.video.hashtag ?? [],
    photoUrls: d.video.foto ?? [],
    aiDisclaimer: d.dicitura_ai,
    platforms: d.piattaforme ?? [],
    publishAt: d.pubblica_alle,
  };
}

export async function decideByToken(token: string, outcome: Outcome, note: string) {
  await callApproval({ token, esito: outcome, nota: note });
}

/* ---------- Brand ---------- */

export async function getBrand(): Promise<BrandSettings> {
  const r = ok(await db.from("brand_settings").select("*").single()) as Row;
  return {
    tone: r.tono,
    closingLine: r.frase_chiusura ?? "",
    accentColor: r.colore_accento,
    fixedHashtags: r.hashtag_fissi ?? [],
    aiDisclaimer: r.dicitura_ai,
    preferredTimes: r.orari_preferiti,
    approverId: r.approvatore_id,
    defaultPlatforms: r.piattaforme_predefinite ?? [],
  };
}

export async function updateBrand(b: BrandSettings) {
  const { agencyId } = await myIds();
  const rows = ok(
    await db
      .from("brand_settings")
      .update({
        tono: b.tone,
        frase_chiusura: b.closingLine.trim() || null,
        colore_accento: b.accentColor,
        hashtag_fissi: b.fixedHashtags,
        dicitura_ai: b.aiDisclaimer.trim(),
        orari_preferiti: b.preferredTimes,
        approvatore_id: b.approverId,
        piattaforme_predefinite: b.defaultPlatforms,
      })
      .eq("agency_id", agencyId)
      .select("agency_id"),
  ) as Row[];
  if (!rows.length) throw Object.assign(new Error("permission denied"), { code: "42501" });
  emitChange();
}

/* ---------- Avatar e consenso ---------- */

function toAvatar(r: Row): AvatarProfile {
  return {
    id: r.id,
    profileId: r.profile_id,
    personName: r.persona ? `${r.persona.nome} ${r.persona.cognome}`.trim() : "",
    status: r.stato,
    consentSigned: r.consenso_firmato,
    consentSignedAt: r.consenso_firmato_at,
    consentVersion: r.consenso_versione,
    signer: r.consenso_firmatario,
    consentPdfPath: r.consenso_pdf_url,
    trainingVideoPath: r.training_video_url,
  };
}

export async function listAvatars(): Promise<AvatarProfile[]> {
  await tick().catch(() => undefined);
  const rows = ok(
    await db.from("avatar_profiles").select("*, persona:profiles!avatar_profiles_profile_id_agency_id_fkey(nome, cognome)").order("created_at"),
  ) as Row[];
  return rows.map(toAvatar);
}

export async function setupAvatar(profileId: ID): Promise<ID> {
  const id = ok(await db.rpc("studio_avatar_setup", { p_profile: profileId })) as string;
  emitChange();
  return id;
}

export async function uploadTrainingVideo(file: File) {
  const { uid, agencyId } = await myIds();
  const ext = (file.name.split(".").pop() ?? "mp4").toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
  const path = `${agencyId}/${uid}/training-${Date.now()}.${ext}`;
  const up = await supabase.storage.from(TRAINING_BUCKET).upload(path, file, { contentType: file.type || "video/mp4" });
  if (up.error) throw up.error;
  ok(await db.rpc("studio_avatar_training", { p_path: path }));
  emitChange();
}

export async function activeConsent(): Promise<ConsentTemplate | null> {
  const r = ok(await db.from("consent_templates").select("versione, testo").eq("attivo", true).maybeSingle()) as Row | null;
  return r ? { version: r.versione, text: r.testo } : null;
}

export async function signConsent(version: string, signer: string, pdf: Blob) {
  const { uid, agencyId } = await myIds();
  const path = `${agencyId}/${uid}/consenso-${version.replace(/[^\w.-]/g, "_")}-${Date.now()}.pdf`;
  const up = await supabase.storage.from(CONSENT_BUCKET).upload(path, pdf, { contentType: "application/pdf" });
  if (up.error) throw up.error;
  ok(await db.rpc("studio_sign_consent", { p_versione: version, p_nome: signer, p_pdf_path: path }));
  emitChange();
}

export async function consentPdfUrl(path: string) {
  const { data } = await supabase.storage.from(CONSENT_BUCKET).createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

export async function revokeConsent(avatarId: ID) {
  ok(await db.rpc("studio_revoke_consent", { p_avatar: avatarId }));
  emitChange();
}

/* ---------- Social e utilizzo ---------- */

export async function listSocialAccounts(): Promise<SocialAccount[]> {
  const rows = ok(await db.from("social_accounts").select("*").order("connected_at")) as Row[];
  return rows.map((r) => ({
    id: r.id,
    platform: r.piattaforma,
    name: r.nome_account,
    status: r.stato,
    connectedAt: r.connected_at,
    expiresAt: r.scade_at,
  }));
}

export async function getUsage(): Promise<StudioUsage> {
  const { agencyId } = await myIds();
  const month = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" }).slice(0, 7);
  const [agency, usage, limits] = await Promise.all([
    db.from("agencies").select("piano").eq("id", agencyId).single(),
    db.from("studio_usage").select("*").eq("mese", month).maybeSingle(),
    db.from("plan_limits").select("*"),
  ]);
  const plan = (ok(agency) as Row).piano;
  const limit = ((ok(limits) as Row[]) ?? []).find((l) => l.piano === plan);
  const u = (usage.data as Row | null) ?? null;
  return {
    month,
    used: u?.video_generati ?? 0,
    included: limit?.video_mese_inclusi ?? u?.video_inclusi ?? 0,
    extra: u?.video_extra ?? 0,
    dailyLimit: limit?.generazioni_giorno ?? 0,
  };
}
