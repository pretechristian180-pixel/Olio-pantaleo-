// Fornitori esterni di Studio. Tutte le chiavi arrivano dai secrets della Edge Function.
//
// REGOLA: l'unico contenuto generato è l'avatar (HeyGen, su sfondo a tinta unita).
// Il montaggio riceve solo le foto REALI dell'immobile con movimenti di camera da un elenco chiuso
// (zoom lento, panoramica, parallasse leggera): nessun modello che genera o modifica gli ambienti.

/* ---------- Errori ---------- */

/** Errore con messaggio per l'utente (italiano) e indicazione se ha senso riprovare */
export class StudioError extends Error {
  constructor(
    public utente: string,
    public tecnico: string,
    public riprova: boolean,
  ) {
    super(tecnico);
  }
}

async function call(url: string, init: RequestInit, servizio: string): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
  } catch (e) {
    throw new StudioError(`Il servizio ${servizio} non risponde. Riproviamo tra poco.`, `${servizio}: rete ${String(e)}`, true);
  }
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  if (res.status === 401 || res.status === 403)
    throw new StudioError(
      `Il servizio ${servizio} non è configurato correttamente. Abbiamo avvisato l'assistenza.`,
      `${servizio}: ${res.status} ${text.slice(0, 500)}`,
      false,
    );
  if (res.status === 402)
    throw new StudioError(`Crediti esauriti sul servizio ${servizio}. Abbiamo avvisato l'assistenza.`, `${servizio}: 402 ${text.slice(0, 500)}`, false);
  if (res.status === 429 || res.status >= 500)
    throw new StudioError(`Il servizio ${servizio} è occupato. Riproviamo tra qualche minuto.`, `${servizio}: ${res.status} ${text.slice(0, 500)}`, true);
  if (!res.ok)
    throw new StudioError(`Il servizio ${servizio} ha rifiutato la richiesta.`, `${servizio}: ${res.status} ${text.slice(0, 500)}`, false);
  return body;
}

/* ---------- Avatar (HeyGen) ---------- */

export type ClipState = { stato: "in_corso" } | { stato: "pronto"; url: string; durata: number } | { stato: "errore"; dettaglio: string };

export interface AvatarProvider {
  /** Clip verticale dell'avatar che pronuncia `testo`; restituisce l'id del lavoro presso il fornitore */
  creaClip(p: { avatarId: string; voiceId: string; testo: string; sfondo: string; callbackUrl: string; rif: string }): Promise<string>;
  statoClip(id: string): Promise<ClipState>;
}

export class HeyGen implements AvatarProvider {
  constructor(private key: string) {}

  async creaClip(p: { avatarId: string; voiceId: string; testo: string; sfondo: string; callbackUrl: string; rif: string }) {
    const body = await call(
      "https://api.heygen.com/v2/video/generate",
      {
        method: "POST",
        headers: { "X-Api-Key": this.key, "Content-Type": "application/json" },
        body: JSON.stringify({
          video_inputs: [
            {
              character: { type: "avatar", avatar_id: p.avatarId, avatar_style: "normal" },
              voice: { type: "text", input_text: p.testo, voice_id: p.voiceId },
              background: { type: "color", value: p.sfondo },
            },
          ],
          dimension: { width: 1080, height: 1920 },
          callback_id: p.rif,
          callback_url: p.callbackUrl,
        }),
      },
      "HeyGen",
    );
    const id = body?.data?.video_id;
    if (!id) throw new StudioError("HeyGen non ha accettato la richiesta.", `HeyGen: risposta senza video_id ${JSON.stringify(body).slice(0, 500)}`, true);
    return String(id);
  }

  async statoClip(id: string): Promise<ClipState> {
    const body = await call(
      `https://api.heygen.com/v1/video_status.get?video_id=${encodeURIComponent(id)}`,
      { headers: { "X-Api-Key": this.key } },
      "HeyGen",
    );
    const d = body?.data ?? {};
    if (d.status === "completed" && d.video_url) return { stato: "pronto", url: d.video_url, durata: Number(d.duration) || 0 };
    if (d.status === "failed") return { stato: "errore", dettaglio: JSON.stringify(d.error ?? d).slice(0, 500) };
    return { stato: "in_corso" };
  }
}

/* ---------- Montaggio ---------- */

/** Movimenti di camera consentiti: nient'altro */
export const MOVIMENTI = ["zoom_in", "panoramica_sx", "parallasse", "zoom_out", "panoramica_dx"] as const;
export type Movimento = (typeof MOVIMENTI)[number];

export type Segmento =
  | { tipo: "avatar"; url: string; durata: number; testo: string }
  | { tipo: "foto"; url: string; durata: number; movimento: Movimento };

export interface Timeline {
  larghezza: 1080;
  altezza: 1920;
  segmenti: Segmento[];
  cartello: { agenzia: string; telefono: string | null; colore: string };
}

/** Controllo di sicurezza: solo avatar + foto dal nostro Storage, solo movimenti consentiti */
export function verificaTimeline(t: Timeline, storageOrigin: string) {
  for (const s of t.segmenti) {
    if (s.tipo === "foto") {
      if (!s.url.startsWith(`${storageOrigin}/storage/v1/object/sign/property-photos/`))
        throw new StudioError("Una foto del video non è valida.", `foto fuori dallo Storage: ${s.url.slice(0, 120)}`, false);
      if (!MOVIMENTI.includes(s.movimento)) throw new StudioError("Movimento di camera non consentito.", s.movimento, false);
    } else if (s.tipo !== "avatar") {
      throw new StudioError("Segmento non consentito.", JSON.stringify(s).slice(0, 200), false);
    }
  }
}

export type RenderState = { stato: "in_corso" } | { stato: "pronto"; url: string } | { stato: "errore"; dettaglio: string };

export interface RenderProvider {
  nome: string;
  avvia(t: Timeline, callbackUrl: string, rif: string): Promise<string>;
  stato(id: string): Promise<RenderState>;
}

/** Sottotitoli: il testo dell'avatar diviso in gruppi di 5 parole, distribuiti sulla durata della clip */
function sottotitoli(testo: string, durata: number) {
  const parole = testo.trim().split(/\s+/).filter(Boolean);
  const gruppi: string[] = [];
  for (let i = 0; i < parole.length; i += 5) gruppi.push(parole.slice(i, i + 5).join(" "));
  const passo = durata / Math.max(1, gruppi.length);
  return gruppi.map((g, i) => ({ testo: g, inizio: i * passo, durata: passo }));
}

/** Creatomate (https://creatomate.com) — RenderScript JSON */
export class Creatomate implements RenderProvider {
  nome = "creatomate";
  constructor(private key: string) {}

  private animazione(m: Movimento) {
    switch (m) {
      case "zoom_in":
        return [{ type: "scale", easing: "linear", start_scale: "100%", end_scale: "118%", fade: false }];
      case "zoom_out":
        return [{ type: "scale", easing: "linear", start_scale: "118%", end_scale: "100%", fade: false }];
      case "panoramica_sx":
        return [{ type: "pan", easing: "linear", start_scale: "118%", end_scale: "118%", start_x: "60%", end_x: "40%", fade: false }];
      case "panoramica_dx":
        return [{ type: "pan", easing: "linear", start_scale: "118%", end_scale: "118%", start_x: "40%", end_x: "60%", fade: false }];
      case "parallasse":
        return [{ type: "pan", easing: "linear", start_scale: "112%", end_scale: "122%", start_x: "48%", end_x: "52%", start_y: "52%", end_y: "48%", fade: false }];
    }
  }

  async avvia(t: Timeline, callbackUrl: string, rif: string) {
    const elements: unknown[] = [];
    let at = 0;
    for (const s of t.segmenti) {
      if (s.tipo === "avatar") {
        elements.push({ type: "video", track: 1, time: at, duration: s.durata, source: s.url, fit: "cover" });
        for (const st of sottotitoli(s.testo, s.durata))
          elements.push({
            type: "text", track: 2, time: at + st.inizio, duration: st.durata, text: st.testo,
            y: "78%", width: "86%", x_alignment: "50%", y_alignment: "50%", font_family: "Manrope", font_weight: "800",
            font_size: "6.2 vmin", fill_color: "#ffffff", stroke_color: "#000000", stroke_width: "1.2 vmin",
          });
      } else {
        elements.push({ type: "image", track: 1, time: at, duration: s.durata, source: s.url, fit: "cover", animations: this.animazione(s.movimento) });
      }
      at += s.durata;
    }
    const ultima = t.segmenti.at(-1)!;
    elements.push({
      type: "text", track: 3, time: at - Math.min(3, ultima.durata), duration: Math.min(3, ultima.durata),
      text: [t.cartello.agenzia, t.cartello.telefono].filter(Boolean).join("\n"),
      y: "38%", width: "80%", x_alignment: "50%", font_family: "Manrope", font_weight: "800", font_size: "7 vmin",
      fill_color: "#16202E", background_color: "rgba(246,244,240,0.95)", background_x_padding: "8%", background_y_padding: "10%",
      background_border_radius: "4%",
    });
    const body = await call(
      "https://api.creatomate.com/v1/renders",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          source: { output_format: "mp4", width: t.larghezza, height: t.altezza, frame_rate: 30, elements },
          webhook_url: callbackUrl,
          metadata: rif,
        }),
      },
      "Creatomate",
    );
    const r = Array.isArray(body) ? body[0] : body;
    if (!r?.id) throw new StudioError("Il montaggio non è partito.", `Creatomate: ${JSON.stringify(body).slice(0, 500)}`, true);
    return String(r.id);
  }

  async stato(id: string): Promise<RenderState> {
    const r = await call(`https://api.creatomate.com/v1/renders/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${this.key}` } }, "Creatomate");
    if (r?.status === "succeeded" && r.url) return { stato: "pronto", url: r.url };
    if (r?.status === "failed") return { stato: "errore", dettaglio: String(r.error_message ?? "failed") };
    return { stato: "in_corso" };
  }
}

/** Shotstack (https://shotstack.io) — Edit API */
export class Shotstack implements RenderProvider {
  nome = "shotstack";
  constructor(private key: string, private env: string) {}

  private effetto(m: Movimento) {
    return { zoom_in: "zoomInSlow", zoom_out: "zoomOutSlow", panoramica_sx: "slideLeftSlow", panoramica_dx: "slideRightSlow", parallasse: "slideUpSlow" }[m];
  }

  async avvia(t: Timeline, callbackUrl: string) {
    const base: unknown[] = [];
    const testi: unknown[] = [];
    let at = 0;
    for (const s of t.segmenti) {
      if (s.tipo === "avatar") {
        base.push({ asset: { type: "video", src: s.url }, start: at, length: s.durata, fit: "cover" });
        for (const st of sottotitoli(s.testo, s.durata))
          testi.push({ asset: { type: "title", text: st.testo, style: "subtitle", size: "medium" }, start: at + st.inizio, length: st.durata, position: "bottom", offset: { y: 0.12 } });
      } else {
        base.push({ asset: { type: "image", src: s.url }, start: at, length: s.durata, fit: "cover", effect: this.effetto(s.movimento) });
      }
      at += s.durata;
    }
    const ultima = t.segmenti.at(-1)!;
    testi.push({
      asset: { type: "title", text: [t.cartello.agenzia, t.cartello.telefono].filter(Boolean).join(" · "), style: "minimal", size: "medium", background: "#F6F4F0", color: "#16202E" },
      start: at - Math.min(3, ultima.durata), length: Math.min(3, ultima.durata), position: "center",
    });
    const body = await call(
      `https://api.shotstack.io/edit/${this.env}/render`,
      {
        method: "POST",
        headers: { "x-api-key": this.key, "Content-Type": "application/json" },
        body: JSON.stringify({
          timeline: { background: "#16202E", tracks: [{ clips: testi }, { clips: base }] },
          output: { format: "mp4", size: { width: t.larghezza, height: t.altezza }, fps: 30 },
          callback: callbackUrl,
        }),
      },
      "Shotstack",
    );
    const id = body?.response?.id;
    if (!id) throw new StudioError("Il montaggio non è partito.", `Shotstack: ${JSON.stringify(body).slice(0, 500)}`, true);
    return String(id);
  }

  async stato(id: string): Promise<RenderState> {
    const body = await call(`https://api.shotstack.io/edit/${this.env}/render/${encodeURIComponent(id)}`, { headers: { "x-api-key": this.key } }, "Shotstack");
    const r = body?.response ?? {};
    if (r.status === "done" && r.url) return { stato: "pronto", url: r.url };
    if (r.status === "failed") return { stato: "errore", dettaglio: String(r.error ?? "failed") };
    return { stato: "in_corso" };
  }
}

/**
 * Remotion: serve un vostro servizio di rendering (es. Remotion Lambda dietro una piccola API).
 * Contratto: POST {REMOTION_RENDER_URL} { timeline, callbackUrl } → { id };
 *            GET  {REMOTION_RENDER_URL}/{id} → { status: "in_corso" | "pronto" | "errore", url?, error? }
 */
export class Remotion implements RenderProvider {
  nome = "remotion";
  constructor(private url: string, private token: string) {}

  async avvia(t: Timeline, callbackUrl: string) {
    const body = await call(
      this.url,
      { method: "POST", headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ timeline: t, callbackUrl }) },
      "Remotion",
    );
    if (!body?.id) throw new StudioError("Il montaggio non è partito.", `Remotion: ${JSON.stringify(body).slice(0, 500)}`, true);
    return String(body.id);
  }

  async stato(id: string): Promise<RenderState> {
    const r = await call(`${this.url.replace(/\/$/, "")}/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${this.token}` } }, "Remotion");
    if (r?.status === "pronto" && r.url) return { stato: "pronto", url: r.url };
    if (r?.status === "errore") return { stato: "errore", dettaglio: String(r.error ?? "errore") };
    return { stato: "in_corso" };
  }
}

/* ---------- Configurazione ---------- */

export interface Config {
  /** false = modalità simulata (nessuna chiave HeyGen): i video si completano da soli come in Fase 1 */
  reale: boolean;
  avatar?: AvatarProvider;
  render?: RenderProvider;
  /** Messaggio se la configurazione è incompleta */
  problema?: string;
}

export function config(): Config {
  const heygen = Deno.env.get("HEYGEN_API_KEY");
  if (!heygen) return { reale: false };
  const scelta = (Deno.env.get("STUDIO_RENDER_PROVIDER") ?? "creatomate").toLowerCase();
  let render: RenderProvider | undefined;
  if (scelta === "creatomate" && Deno.env.get("CREATOMATE_API_KEY")) render = new Creatomate(Deno.env.get("CREATOMATE_API_KEY")!);
  if (scelta === "shotstack" && Deno.env.get("SHOTSTACK_API_KEY"))
    render = new Shotstack(Deno.env.get("SHOTSTACK_API_KEY")!, Deno.env.get("SHOTSTACK_ENV") === "v1" ? "v1" : "stage");
  if (scelta === "remotion" && Deno.env.get("REMOTION_RENDER_URL"))
    render = new Remotion(Deno.env.get("REMOTION_RENDER_URL")!, Deno.env.get("REMOTION_TOKEN") ?? "");
  return {
    reale: true,
    avatar: new HeyGen(heygen),
    render,
    problema: render ? undefined : `Servizio di montaggio "${scelta}" non configurato (manca la chiave).`,
  };
}
