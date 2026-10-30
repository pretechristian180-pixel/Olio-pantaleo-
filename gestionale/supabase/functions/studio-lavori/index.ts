// Coda di Studio: prepara i video (avatar HeyGen + montaggio delle foto reali) e gli avatar.
// Chi la chiama:
//  - pg_cron ogni minuto, con l'intestazione x-studio-cron (segreto nel Vault)        → tutte le agenzie
//  - i webhook dei fornitori: ?webhook=<fornitore>&job=<id>&t=<firma>                → solo quel lavoro
//  - l'app (utente collegato) per non aspettare il minuto successivo                 → solo la sua agenzia
// Il webhook è solo una "sveglia": lo stato vero si rilegge sempre dall'API del fornitore.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { config, MOVIMENTI, StudioError, verificaTimeline, type Segmento, type Timeline } from "./providers.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SIMULAZIONE_SECONDI = 12;
const TEMPO_MASSIMO_MIN = 60;

type Job = {
  id: string;
  agency_id: string;
  video_project_id: string | null;
  avatar_profile_id: string | null;
  tipo: string;
  stato: string;
  payload: Record<string, any>;
  tentativi: number;
  created_at: string;
  pronto_at: string | null;
};

async function hmac(secret: string, msg: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function uguali(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const traSecondi = (s: number) => new Date(Date.now() + s * 1000).toISOString();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Metodo non consentito" });

  const db = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const url = new URL(req.url);
  const webhookSecret = (await db.rpc("studio_secret", { p_name: "studio_webhook_secret" })).data as string | null;
  if (!webhookSecret) return reply(500, { error: "Configurazione mancante" });

  let agenzia: string | null = null;
  let limite = 10;

  if (url.searchParams.get("webhook")) {
    // ----- Webhook di un fornitore -----
    const job = url.searchParams.get("job") ?? "";
    const firma = url.searchParams.get("t") ?? "";
    if (!/^[0-9a-f-]{36}$/.test(job) || !uguali(firma, await hmac(webhookSecret, job))) return reply(401, { error: "Firma non valida" });
    const { data: j } = await db.from("studio_jobs").select("agency_id, stato").eq("id", job).maybeSingle();
    if (!j || !["in_coda", "in_corso"].includes(j.stato)) return reply(200, { ok: true });
    await db.from("studio_jobs").update({ pronto_at: new Date().toISOString() }).eq("id", job);
    agenzia = j.agency_id;
    limite = 3;
  } else if (req.headers.get("x-studio-cron")) {
    // ----- pg_cron -----
    const cron = (await db.rpc("studio_secret", { p_name: "studio_cron_secret" })).data as string | null;
    if (!cron || !uguali(req.headers.get("x-studio-cron")!, cron)) return reply(401, { error: "Non autorizzato" });
  } else {
    // ----- App: utente collegato, solo la sua agenzia -----
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: auth } = await db.auth.getUser(token);
    if (!auth?.user) return reply(401, { error: "Sessione scaduta: accedi di nuovo." });
    const { data: prof } = await db.from("profiles").select("agency_id, attivo").eq("id", auth.user.id).maybeSingle();
    if (!prof?.attivo) return reply(403, { error: "Account non attivo" });
    agenzia = prof.agency_id;
    limite = 3;
  }

  const { data: jobs, error } = await db.rpc("studio_claim_jobs", { p_agency: agenzia, p_limite: limite });
  if (error) return reply(500, { error: "Coda non disponibile" });

  const inizio = Date.now();
  const cfg = config();
  let fatti = 0;
  for (const job of (jobs ?? []) as Job[]) {
    if (Date.now() - inizio > 40_000) {
      await db.from("studio_jobs").update({ bloccato_fino: null }).eq("id", job.id);
      continue;
    }
    try {
      if (job.tipo === "video") await lavoraVideo(db, job, cfg, webhookSecret);
      else if (job.tipo === "avatar_training") await lavoraAvatar(db, job, cfg.reale);
      else if (job.tipo === "avatar_delete") await lavoraCancellazione(db, job, cfg.reale);
      fatti++;
    } catch (e) {
      const err = e instanceof StudioError ? e : new StudioError("Qualcosa non ha funzionato durante la preparazione del video.", String(e), true);
      console.error(`studio-lavori ${job.id}: ${err.tecnico}`);
      await db.rpc("studio_job_fail", { p_job: job.id, p_messaggio: err.utente, p_tecnico: err.tecnico, p_riprova: err.riprova, p_payload: job.payload });
    }
  }
  return reply(200, { ok: true, lavori: fatti });
});

/** Rimette il lavoro in attesa fino a `quando` */
async function rimanda(db: SupabaseClient, job: Job, quando: string, campi: Record<string, unknown> = {}) {
  const { error } = await db
    .from("studio_jobs")
    .update({ stato: "in_corso", pronto_at: quando, bloccato_fino: null, payload: job.payload, ...campi })
    .eq("id", job.id);
  if (error) throw new StudioError("Errore interno della coda.", error.message, true);
}

/* ---------- Video ---------- */

async function lavoraVideo(db: SupabaseClient, job: Job, cfg: ReturnType<typeof config>, webhookSecret: string) {
  // Modalità simulata (manca la chiave HeyGen): come in Fase 1
  if (!cfg.reale) {
    const pronto = new Date(job.created_at).getTime() + SIMULAZIONE_SECONDI * 1000;
    if (Date.now() < pronto) return rimanda(db, job, new Date(pronto).toISOString());
    const { error } = await db.rpc("studio_complete_video", { p_job: job.id, p_video_path: "mock:reel", p_thumbnail: null });
    if (error) throw new StudioError("Errore interno della coda.", error.message, true);
    return;
  }
  if (cfg.problema) throw new StudioError("Studio non è ancora pronto per creare video veri. Abbiamo avvisato l'assistenza.", cfg.problema, false);
  if (Date.now() - new Date(job.created_at).getTime() > TEMPO_MASSIMO_MIN * 60_000)
    throw new StudioError("La preparazione del video ci ha messo troppo. Premi Riprova.", "timeout complessivo", false);

  const { data: v } = await db.from("video_projects").select("*").eq("id", job.video_project_id).maybeSingle();
  if (!v || v.stato !== "in_generazione") {
    await db.from("studio_jobs").update({ stato: "completato", bloccato_fino: null }).eq("id", job.id);
    return;
  }

  // Consenso ancora valido (controllo lato server a ogni passaggio)
  const { data: ok } = await db.rpc("studio_avatar_ok", { aid: v.avatar_profile_id });
  if (!ok) throw new StudioError("Il consenso dell'avatar non è valido: il video non può essere generato.", "avatar non ok", false);
  const { data: avatar } = await db.from("avatar_profiles").select("provider_avatar_id, provider_voice_id").eq("id", v.avatar_profile_id).single();
  if (!avatar?.provider_avatar_id || !avatar?.provider_voice_id)
    throw new StudioError("L'avatar non è ancora attivo: lo stiamo attivando, riprova più tardi.", "avatar senza id HeyGen", false);

  const callback = async (fornitore: string) =>
    `${SUPABASE_URL}/functions/v1/studio-lavori?webhook=${fornitore}&job=${job.id}&t=${await hmac(webhookSecret, job.id)}`;
  const p = job.payload ?? {};

  // 1) Clip dell'avatar (inizio e chiusura)
  if (!p.fase) {
    const intro = await cfg.avatar!.creaClip({
      avatarId: avatar.provider_avatar_id, voiceId: avatar.provider_voice_id, testo: v.script_intro, sfondo: "#16202E",
      callbackUrl: await callback("heygen"), rif: `${job.id}:intro`,
    });
    const chiusura = await cfg.avatar!.creaClip({
      avatarId: avatar.provider_avatar_id, voiceId: avatar.provider_voice_id, testo: v.script_chiusura, sfondo: "#16202E",
      callbackUrl: await callback("heygen"), rif: `${job.id}:chiusura`,
    });
    job.payload = { fase: "clip", clip: { intro: { id: intro }, chiusura: { id: chiusura } } };
    return rimanda(db, job, traSecondi(90));
  }

  if (p.fase === "clip") {
    for (const k of ["intro", "chiusura"] as const) {
      const c = p.clip[k];
      if (c.url) continue;
      const s = await cfg.avatar!.statoClip(c.id);
      if (s.stato === "errore") {
        job.payload = {};
        throw new StudioError("La parte con l'avatar non è riuscita. Riproviamo.", `HeyGen ${k}: ${s.dettaglio}`, true);
      }
      if (s.stato === "pronto") p.clip[k] = { id: c.id, url: s.url, durata: s.durata };
    }
    if (!p.clip.intro.url || !p.clip.chiusura.url) {
      job.payload = p;
      return rimanda(db, job, traSecondi(45));
    }
    p.fase = "montaggio";
  }

  // 2) Montaggio: avatar + foto reali con soli movimenti di camera
  if (p.fase === "montaggio" && !p.render) {
    const timeline = await creaTimeline(db, v, p);
    verificaTimeline(timeline, SUPABASE_URL);
    const id = await cfg.render!.avvia(timeline, await callback(cfg.render!.nome), job.id);
    p.render = { fornitore: cfg.render!.nome, id };
    job.payload = p;
    return rimanda(db, job, traSecondi(60));
  }

  // 3) Attesa del montaggio, poi salvataggio nel nostro Storage
  if (p.fase === "montaggio" && p.render) {
    const s = await cfg.render!.stato(p.render.id);
    if (s.stato === "errore") {
      job.payload = { fase: "montaggio", clip: p.clip };
      throw new StudioError("Il montaggio del video non è riuscito. Riproviamo.", `${p.render.fornitore}: ${s.dettaglio}`, true);
    }
    if (s.stato === "in_corso") {
      job.payload = p;
      return rimanda(db, job, traSecondi(45));
    }
    const res = await fetch(s.url, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new StudioError("Non siamo riusciti a scaricare il video finito. Riproviamo.", `download ${res.status}`, true);
    const file = new Uint8Array(await res.arrayBuffer());
    const path = `${v.agency_id}/${v.id}/${Date.now()}.mp4`;
    const up = await db.storage.from("studio-videos").upload(path, file, { contentType: "video/mp4", upsert: true });
    if (up.error) throw new StudioError("Non siamo riusciti a salvare il video. Riproviamo.", `upload: ${up.error.message}`, true);
    const { error } = await db.rpc("studio_complete_video", { p_job: job.id, p_video_path: path, p_thumbnail: null });
    if (error) throw new StudioError("Errore interno della coda.", error.message, true);
  }
}

async function creaTimeline(db: SupabaseClient, v: Record<string, any>, p: Record<string, any>): Promise<Timeline> {
  const [{ data: foto }, { data: agenzia }] = await Promise.all([
    db.from("property_photos").select("id, url").eq("property_id", v.property_id),
    db.from("agencies").select("nome, telefono").eq("id", v.agency_id).single(),
  ]);
  // Solo le foto scelte, nell'ordine scelto, e solo se appartengono all'immobile
  const perId = new Map((foto ?? []).map((f) => [f.id, f.url as string]));
  const percorsi = (v.foto_selezionate as string[]).map((id) => perId.get(id)).filter((x): x is string => !!x);
  if (!percorsi.length) throw new StudioError("Le foto scelte non ci sono più.", "nessuna foto", false);
  const { data: firmate } = await db.storage.from("property-photos").createSignedUrls(percorsi, 6 * 3600);
  const urls = (firmate ?? []).map((f) => f.signedUrl).filter((x): x is string => !!x);
  if (urls.length !== percorsi.length) throw new StudioError("Non riusciamo a leggere alcune foto.", "firma foto", true);

  const parole = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
  const durIntro = p.clip.intro.durata || parole(v.script_intro) / 2.6;
  const durChiusura = p.clip.chiusura.durata || parole(v.script_chiusura) / 2.6;
  const perFoto = Math.min(6, Math.max(2.5, (v.durata_target - durIntro - durChiusura) / urls.length));

  const segmenti: Segmento[] = [
    { tipo: "avatar", url: p.clip.intro.url, durata: durIntro, testo: v.script_intro },
    ...urls.map((url, i): Segmento => ({ tipo: "foto", url, durata: perFoto, movimento: MOVIMENTI[i % MOVIMENTI.length] })),
    { tipo: "avatar", url: p.clip.chiusura.url, durata: durChiusura, testo: v.script_chiusura },
  ];
  return { larghezza: 1080, altezza: 1920, segmenti, cartello: { agenzia: agenzia?.nome ?? "", telefono: agenzia?.telefono ?? null, colore: "#C4532F" } };
}

/* ---------- Avatar ---------- */

async function lavoraAvatar(db: SupabaseClient, job: Job, reale: boolean) {
  if (!reale) {
    const { error } = await db.rpc("studio_avatar_ready", { p_avatar: job.avatar_profile_id, p_provider_avatar: null, p_provider_voice: null });
    if (error) await db.from("studio_jobs").update({ stato: "errore", errore: error.message, bloccato_fino: null }).eq("id", job.id);
    return;
  }
  // Reale: il gemello digitale si crea su HeyGen dal video di training; poi l'admin inserisce gli ID
  // nel pannello admin (Studio → Avatar da attivare). Fino ad allora si ricontrolla una volta al giorno.
  await db
    .from("studio_jobs")
    .update({ stato: "in_coda", pronto_at: traSecondi(86_400), bloccato_fino: null, errore: "In attesa di attivazione su HeyGen" })
    .eq("id", job.id);
}

async function lavoraCancellazione(db: SupabaseClient, job: Job, reale: boolean) {
  if (!reale || !job.payload?.provider_avatar_id) {
    await db.from("studio_jobs").update({ stato: "completato", bloccato_fino: null, errore: null }).eq("id", job.id);
    return;
  }
  // La cancellazione del gemello digitale su HeyGen si conferma dal pannello admin
  await db
    .from("studio_jobs")
    .update({ stato: "in_coda", pronto_at: traSecondi(86_400), bloccato_fino: null, errore: "Da cancellare su HeyGen e confermare nel pannello admin" })
    .eq("id", job.id);
}
