import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { Json, Tables } from "@nexora/shared";
import {
  type AdminDb,
  brandedEmail,
  type BrollProvider,
  createBrollProvider,
  createTranscriptionProvider,
  type EditStyle,
  getEmailProvider,
  LLMError,
  recordCosts,
  type Transcript,
  type TranscriptionProvider,
} from "@nexora/shared/server";
import {
  detectFaces,
  type EditSpec,
  EditSpecSchema,
  extractAudioForTranscription,
  extractThumbnail,
  type FaceSample,
  loadMusicLibrary,
  type MusicTrack,
  probeVideo,
  renderVideo,
  type SourceInfo,
} from "@nexora/video-engine";

import type { HandlerDeps, Job } from "../handlers.js";
import { log } from "../log.js";
import { type EditPlan, planEdit, planToSpec } from "./plan.js";
import { downloadToFile, uploadFile } from "./storage.js";

/** Durata massima del girato (requisito: 10 minuti). */
export const MAX_RAW_SECONDS = 10 * 60;
/** Stima del costo di calcolo del render (USD per minuto di video montato), per il costo per video. */
const RENDER_USD_PER_MIN = Number(process.env.RENDER_USD_PER_MIN ?? 0.004);

const workDir = () => process.env.WORK_DIR ?? join(process.env.TMPDIR ?? "/tmp", "nexora-work");

let transcriber: TranscriptionProvider | null = null;
let musicLibrary: MusicTrack[] | null = null;

async function music(): Promise<MusicTrack[]> {
  if (musicLibrary) return musicLibrary;
  const dir = process.env.MUSIC_DIR;
  musicLibrary = dir ? await loadMusicLibrary(dir).catch(() => []) : [];
  if (!musicLibrary.length) log("warn", "libreria musicale vuota: video senza musica", { dir });
  return musicLibrary;
}

/** Errore definitivo: non ha senso ritentare (es. video troppo lungo). */
export class PermanentError extends Error {}

function payload(job: Job) {
  return (job.payload ?? {}) as Record<string, unknown>;
}

async function loadVideo(db: AdminDb, id: string) {
  const { data, error } = await db
    .from("videos")
    .select("*, raw:raw_uploads(*), script:scripts(title, hook, body)")
    .eq("id", id)
    .single();
  if (error || !data) throw new PermanentError(`Video ${id} non trovato`);
  return data as Tables<"videos"> & {
    raw: Tables<"raw_uploads">;
    script: { title: string; hook: string; body: string } | null;
  };
}

async function sourceFile(db: AdminDb, raw: Tables<"raw_uploads">) {
  const ext = raw.storage_path.split(".").pop()?.toLowerCase() ?? "mp4";
  return downloadToFile(db, "raw", raw.storage_path, join(workDir(), raw.id, `source.${ext}`));
}

// ─────────────────────────────────────────────────────────────────────────
// 1. Trascrizione
// ─────────────────────────────────────────────────────────────────────────
export async function transcribeJob(job: Job, deps: HandlerDeps) {
  const video = await loadVideo(deps.db, String(payload(job).video_id));
  const raw = video.raw;
  await deps.db.from("videos").update({ status: "editing", error: null }).eq("id", video.id);
  await deps.db.from("raw_uploads").update({ status: "processing" }).eq("id", raw.id);

  const src = await sourceFile(deps.db, raw);
  const info = await probeVideo(src);
  await deps.db
    .from("raw_uploads")
    .update({ duration_s: info.durationS, width: info.width, height: info.height, orientation: info.orientation })
    .eq("id", raw.id);
  if (info.durationS > MAX_RAW_SECONDS + 1) {
    throw new PermanentError("Il video supera i 10 minuti: caricane uno più breve.");
  }

  let transcript = raw.transcript as unknown as Transcript | null;
  if (!transcript) {
    transcriber ??= createTranscriptionProvider();
    if (info.hasAudio) {
      const audio = join(workDir(), raw.id, "audio.mp3");
      await extractAudioForTranscription(src, audio);
      const res = await transcriber.transcribe({
        filePath: audio,
        durationS: info.durationS,
        language: "it",
        hintText: video.script?.body,
      });
      transcript = res.transcript;
      await recordCosts(deps.db, [res.cost], { workspaceId: video.workspace_id, jobId: job.id, videoId: video.id, operation: "transcribe" });
    } else {
      transcript = { language: "it", text: "", words: [], durationS: info.durationS };
    }
    await deps.db
      .from("raw_uploads")
      .update({ transcript: transcript as unknown as Json, status: "ready" })
      .eq("id", raw.id);
  }

  await deps.db.rpc("enqueue_job", {
    p_type: "edit",
    p_workspace_id: video.workspace_id,
    p_payload: { video_id: video.id },
    p_dedupe_key: `edit:${video.id}:1`,
  });
  log("info", "trascrizione pronta", { video: video.id, words: transcript.words.length, seconds: info.durationS });
}

// ─────────────────────────────────────────────────────────────────────────
// 2. Decisioni di montaggio (LLM → edit_spec)
// ─────────────────────────────────────────────────────────────────────────
export async function editJob(job: Job, deps: HandlerDeps) {
  const p = payload(job);
  const video = await loadVideo(deps.db, String(p.video_id));
  const raw = video.raw;
  const transcript = raw.transcript as unknown as Transcript | null;
  if (!transcript || raw.duration_s == null) throw new Error("Trascrizione non ancora pronta");

  const [{ data: ws }, { data: brand }, { data: versions }] = await Promise.all([
    deps.db.from("workspaces").select("name, city, logo_url, brand_colors").eq("id", video.workspace_id).single(),
    deps.db.from("brand_profiles").select("tone_of_voice, do_not_say, edit_style").eq("workspace_id", video.workspace_id).single(),
    deps.db.from("video_versions").select("id, version, edit_spec, status").eq("video_id", video.id).order("version"),
  ]);

  const feedbackId = typeof p.feedback_id === "string" ? p.feedback_id : null;
  let previous: { plan: EditPlan; feedback: string } | undefined;
  let previousSpec: EditSpec | null = null;
  const last = versions?.[versions.length - 1];
  if (feedbackId) {
    const { data: fb } = await deps.db.from("video_feedback").select("message").eq("id", feedbackId).single();
    const prevStored = (last?.edit_spec ?? null) as (EditSpec & { _plan?: EditPlan }) | null;
    if (fb && prevStored?._plan) previous = { plan: prevStored._plan, feedback: fb.message };
    previousSpec = prevStored ? EditSpecSchema.parse(stripPlan(prevStored)) : null;
  }

  // Idempotenza: se questa richiesta ha già una versione, non rifare la chiamata all'AI.
  const existing = versions?.find((v) => (feedbackId ? false : v.version === 1));
  if (existing) {
    await enqueueRender(deps, video.workspace_id, existing.id);
    return;
  }

  const editStyle = (brand?.edit_style ?? {}) as EditStyle;
  const { plan, cost } = await planEdit(deps.llm(), {
    brand: {
      companyName: ws?.name ?? "",
      city: ws?.city ?? null,
      toneOfVoice: brand?.tone_of_voice ?? null,
      doNotSay: brand?.do_not_say ?? null,
      editStyle,
    },
    script: video.script,
    words: transcript.words,
    previous,
  });
  await recordCosts(deps.db, [cost], { workspaceId: video.workspace_id, jobId: job.id, videoId: video.id, operation: "edit_plan" });

  const source: SourceInfo = {
    durationS: Number(raw.duration_s),
    width: raw.width ?? 1080,
    height: raw.height ?? 1920,
    fps: 30,
    hasAudio: true,
    orientation: raw.orientation ?? "portrait",
  };
  const colors = Array.isArray(ws?.brand_colors) ? (ws.brand_colors as string[]) : [];
  const spec = planToSpec({
    plan,
    words: transcript.words,
    source,
    editStyle,
    brandColor: colors[0] ?? null,
    music: await music(),
    seed: video.id,
    hasLogo: Boolean(ws?.logo_url && !ws.logo_url.endsWith(".svg")),
    previousSpec,
  });

  await attachBroll(deps, spec, previousSpec, video.workspace_id, video.id, job.id);

  const nextVersion = (last?.version ?? 0) + 1;
  const { data: version, error } = await deps.db
    .from("video_versions")
    .insert({
      video_id: video.id,
      workspace_id: video.workspace_id,
      version: nextVersion,
      edit_spec: { ...spec, _plan: plan } as unknown as Json,
      feedback_id: feedbackId,
    })
    .select("id")
    .single();
  if (error || !version) throw new Error(`Versione non creata: ${error?.message}`);

  // Didascalia e hashtag: proposti alla prima versione (poi li gestisce il cliente).
  if (nextVersion === 1) {
    await deps.db
      .from("videos")
      .update({ caption: plan.caption, hashtags: plan.hashtags.map((h) => h.replace(/^#/, "").replace(/\s+/g, "")) })
      .eq("id", video.id);
  }
  await enqueueRender(deps, video.workspace_id, version.id);
  log("info", "montaggio deciso", { video: video.id, version: nextVersion, segments: spec.segments.length, notes: plan.notes });
}

let broll: BrollProvider | null | undefined;

/**
 * Cerca e salva le clip b-roll (bucket "output", accanto al video). Le clip di una versione
 * precedente con la stessa ricerca vengono riusate. Senza provider, o se una ricerca fallisce,
 * quella clip viene tolta: il video esce comunque.
 */
async function attachBroll(
  deps: HandlerDeps,
  spec: EditSpec,
  previousSpec: EditSpec | null,
  workspaceId: string,
  videoId: string,
  jobId: string,
) {
  if (!spec.broll.length) return;
  if (broll === undefined) broll = createBrollProvider();
  if (!broll) {
    spec.broll = [];
    return;
  }
  const kept: EditSpec["broll"] = [];
  const used: string[] = [];
  let creditsUsed = 0;
  let creditsLeft = true;
  for (const b of spec.broll) {
    const reuse = previousSpec?.broll.find((p) => p.query === b.query && p.storagePath);
    if (reuse) {
      kept.push({ ...b, storagePath: reuse.storagePath });
      continue;
    }
    // Ogni clip nuova consuma un credito b-roll del piano; finiti i crediti il video esce senza.
    if (!creditsLeft) continue;
    const { data: granted } = await deps.db.rpc("use_broll_credits", { p_workspace_id: workspaceId, p_count: 1 });
    if (!granted) {
      creditsLeft = false;
      log("info", "crediti b-roll finiti", { video: videoId });
      continue;
    }
    creditsUsed += 1;
    try {
      const { clip, cost } = await broll.find({ query: b.query, durationS: b.duration, aspectRatio: "9:16", source: "stock", excludeIds: used });
      await recordCosts(deps.db, [cost], { workspaceId, jobId, videoId, operation: "broll" });
      if (!clip) continue;
      used.push(clip.id);
      const local = join(workDir(), videoId, `broll-${kept.length}.mp4`);
      await mkdir(join(workDir(), videoId), { recursive: true });
      if (clip.downloadUrl.startsWith("demo:")) {
        await execDemoClip(local, b.duration + 1);
      } else {
        const res = await fetch(clip.downloadUrl);
        if (!res.ok) continue;
        await writeFile(local, Buffer.from(await res.arrayBuffer()));
      }
      const path = `${workspaceId}/${videoId}/broll/${clip.id.replace(/[^a-z0-9]+/gi, "-")}.mp4`;
      await uploadFile(deps.db, "output", path, local, "video/mp4");
      kept.push({ ...b, storagePath: path });
    } catch (e) {
      log("warn", "b-roll non trovato", { video: videoId, query: b.query, error: String(e) });
    }
  }
  spec.broll = kept;
  if (creditsUsed) {
    const { data: v } = await deps.db.from("videos").select("broll_credits_used").eq("id", videoId).single();
    await deps.db.from("videos").update({ broll_credits_used: (v?.broll_credits_used ?? 0) + creditsUsed }).eq("id", videoId);
  }
}

async function execDemoClip(out: string, seconds: number) {
  const { execFile } = await import("node:child_process");
  await new Promise<void>((resolve, reject) =>
    execFile(
      "ffmpeg",
      ["-y", "-v", "error", "-f", "lavfi", "-i", `testsrc2=s=1080x1920:d=${seconds}:r=30`, "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", out],
      (err) => (err ? reject(err) : resolve()),
    ),
  );
}

function stripPlan(spec: EditSpec & { _plan?: unknown }) {
  const { _plan, ...rest } = spec;
  void _plan;
  return rest;
}

async function enqueueRender(deps: HandlerDeps, workspaceId: string, versionId: string) {
  await deps.db.rpc("enqueue_job", {
    p_type: "render",
    p_workspace_id: workspaceId,
    p_payload: { version_id: versionId },
    p_dedupe_key: `render:${versionId}`,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// 3. Render (FFmpeg) → output, copertina, stato "da approvare"
// ─────────────────────────────────────────────────────────────────────────
export async function renderJob(job: Job, deps: HandlerDeps) {
  const versionId = String(payload(job).version_id);
  const { data: version } = await deps.db.from("video_versions").select("*").eq("id", versionId).single();
  if (!version) throw new PermanentError("Versione non trovata");
  if (version.status === "ready") return;

  const video = await loadVideo(deps.db, version.video_id);
  const raw = video.raw;
  const transcript = raw.transcript as unknown as Transcript;
  const spec = EditSpecSchema.parse(stripPlan(version.edit_spec as EditSpec & { _plan?: unknown }));

  const dir = join(workDir(), raw.id);
  const out = join(workDir(), version.id);
  await mkdir(out, { recursive: true });
  try {
    const src = await sourceFile(deps.db, raw);
    const info = await probeVideo(src);

    // Volti: calcolati una volta per girato e tenuti in cache sul worker
    const facesFile = join(dir, "faces.json");
    let faces: FaceSample[];
    try {
      faces = JSON.parse(await readFile(facesFile, "utf8")) as FaceSample[];
    } catch {
      faces = await detectFaces(src, { fps: 2 });
      await writeFile(facesFile, JSON.stringify(faces));
    }

    const { data: ws } = await deps.db.from("workspaces").select("name, logo_url, manual_review").eq("id", video.workspace_id).single();
    let logoPath: string | null = null;
    if (spec.outroLogo && ws?.logo_url) {
      logoPath = await downloadToFile(deps.db, "brand", ws.logo_url, join(out, `logo.${ws.logo_url.split(".").pop()}`)).catch(() => null);
    }
    const track = spec.music ? (await music()).find((t) => t.id === spec.music!.trackId) : null;
    const brollPaths = await Promise.all(
      spec.broll.map((b, i) =>
        b.storagePath
          ? downloadToFile(deps.db, "output", b.storagePath, join(out, `broll-${i}.mp4`)).catch(() => null)
          : Promise.resolve(null),
      ),
    );

    const outputFile = join(out, "video.mp4");
    const res = await renderVideo({
      workDir: out,
      sourcePath: src,
      source: info,
      words: transcript.words,
      faces,
      spec,
      outputPath: outputFile,
      musicPath: track?.path ?? null,
      logoPath,
      brollPaths,
    });
    const thumbFile = join(out, "thumb.jpg");
    await extractThumbnail(outputFile, thumbFile, spec.hookOverlay ? 1.2 : 0.8);

    const base = `${video.workspace_id}/${video.id}/v${version.version}`;
    await uploadFile(deps.db, "output", `${base}.mp4`, outputFile, "video/mp4");
    await uploadFile(deps.db, "output", `${base}.jpg`, thumbFile, "image/jpeg");

    await deps.db
      .from("video_versions")
      .update({
        status: "ready",
        output_path: `${base}.mp4`,
        thumbnail_path: `${base}.jpg`,
        duration_s: Math.round(res.durationS * 100) / 100,
        render_ms: res.renderMs,
      })
      .eq("id", version.id);

    const nextStatus = ws?.manual_review ? "internal_review" : "review";
    await deps.db
      .from("videos")
      .update({ status: nextStatus, current_version: version.version, error: null })
      .eq("id", video.id);

    await recordCosts(
      deps.db,
      [{ provider: "render", model: "ffmpeg", costUsd: (res.durationS / 60) * RENDER_USD_PER_MIN, units: { output_seconds: Math.round(res.durationS), render_ms: res.renderMs } }],
      { workspaceId: video.workspace_id, jobId: job.id, videoId: video.id, operation: "render" },
    );

    log("info", "video montato", { video: video.id, version: version.version, seconds: res.durationS, renderMs: res.renderMs, status: nextStatus });
    if (nextStatus === "review") await notifyReady(deps, video.workspace_id, video.id, ws?.name ?? "");
    else await notifyInternalReview(deps, video.id, ws?.name ?? "");
  } finally {
    await rm(out, { recursive: true, force: true });
  }
}

async function memberEmails(db: AdminDb, workspaceId: string) {
  const { data: members } = await db.from("workspace_members").select("user_id").eq("workspace_id", workspaceId);
  const emails: string[] = [];
  for (const m of members ?? []) {
    const { data } = await db.auth.admin.getUserById(m.user_id);
    if (data.user?.email) emails.push(data.user.email);
  }
  return emails;
}

/** Email "Il tuo video è pronto da approvare" ai membri dell'azienda. */
export async function notifyReady(deps: HandlerDeps, workspaceId: string, videoId: string, companyName: string) {
  const email = getEmailProvider();
  if (email.name === "disabled") return;
  const { html, text } = brandedEmail({
    title: "Il tuo video è pronto",
    intro: `Abbiamo montato un nuovo video per ${companyName}. Guardalo, modifica la didascalia se vuoi e approvalo: poi lo programmiamo sui tuoi social.`,
    ctaLabel: "Guarda e approva",
    ctaUrl: `${deps.config.appUrl}/video/${videoId}`,
    outro: "Se qualcosa non ti convince puoi chiedere una modifica a parole tue: sono inclusi 2 giri di modifiche.",
  });
  for (const to of await memberEmails(deps.db, workspaceId)) {
    await email.send({ to, subject: "Il tuo video è pronto da approvare", html, text });
  }
}

async function notifyInternalReview(deps: HandlerDeps, videoId: string, companyName: string) {
  if (!deps.config.adminAlertEmail) return;
  const { html, text } = brandedEmail({
    title: "Video da controllare",
    intro: `Nuovo video di ${companyName} in attesa di controllo prima dell'invio al cliente.`,
    ctaLabel: "Apri la revisione",
    ctaUrl: `${deps.config.appUrl}/admin/revisione`,
  });
  await getEmailProvider().send({ to: deps.config.adminAlertEmail, subject: `[Nexora Studio] Video da controllare: ${companyName}`, html, text });
}

/** Fallimento definitivo di un job video: stato errore e video restituito alla quota. */
export async function onVideoJobFailed(job: Job, deps: HandlerDeps, error: string) {
  const p = payload(job);
  let videoId = typeof p.video_id === "string" ? p.video_id : null;
  if (!videoId && typeof p.version_id === "string") {
    const { data } = await deps.db.from("video_versions").select("video_id").eq("id", p.version_id).maybeSingle();
    videoId = data?.video_id ?? null;
    await deps.db.from("video_versions").update({ status: "error" }).eq("id", p.version_id);
  }
  if (!videoId) return;
  const { data: video } = await deps.db.from("videos").select("workspace_id, current_version, raw_upload_id").eq("id", videoId).single();
  if (!video) return;
  const userMessage = error.startsWith("Il video") ? error : "Il montaggio non è riuscito. Il nostro team è stato avvisato.";
  if (video.current_version > 0) {
    // Modifica extra a pagamento non riuscita: il video preso dalla quota torna al cliente.
    let feedbackId = typeof p.feedback_id === "string" ? p.feedback_id : null;
    if (!feedbackId && typeof p.version_id === "string") {
      const { data } = await deps.db.from("video_versions").select("feedback_id").eq("id", p.version_id).maybeSingle();
      feedbackId = data?.feedback_id ?? null;
    }
    if (feedbackId) await deps.db.rpc("release_feedback_quota", { p_feedback_id: feedbackId });
    // C'era già una versione pronta: il cliente la ritrova, la modifica non è riuscita.
    await deps.db.from("videos").update({ status: "review", error: "La modifica non è riuscita: riprova o scrivici." }).eq("id", videoId);
  } else {
    await deps.db.from("videos").update({ status: "error", error: userMessage }).eq("id", videoId);
    await deps.db.from("raw_uploads").update({ status: "error", error: userMessage }).eq("id", video.raw_upload_id);
    await deps.db.rpc("release_video", { p_video_id: videoId });
  }
}

export function isRetryable(e: unknown) {
  if (e instanceof PermanentError) return false;
  if (e instanceof LLMError) return e.retryable;
  return true;
}
