/**
 * Versione "anteprima" di src/services/studio.ts: stesse funzioni, dati di esempio in memoria.
 * La generazione è simulata (qualche secondo), come nella Fase 1 reale.
 */
import { getProperty, listProperties, listTeam } from "@/services/api";
import { emitChange } from "@/services/events";
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

export const TRAINING_BUCKET = "studio-training";
export const CONSENT_BUCKET = "studio-consensi";

const wait = <T,>(value: T, ms = 300) => new Promise<T>((r) => setTimeout(() => r(value), ms));
const newId = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;
const ME = "u_1";
const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

function at(daysFromToday: number, time: string) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  const [h, m] = time.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

const brand: BrandSettings = {
  tone: "professionale",
  closingLine: "Chiamaci, ti aspettiamo in agenzia.",
  accentColor: "#C4532F",
  fixedHashtags: ["#ImmobiliareLevante", "#casabari"],
  aiDisclaimer: "Video realizzato con l'AI. Immobile mostrato con foto reali.",
  preferredTimes: { lun: ["12:30", "19:00"], mar: ["12:30", "19:00"], mer: ["12:30", "19:00"], gio: ["12:30", "19:00"], ven: ["12:30", "19:00"], sab: ["10:30"], dom: [] },
  approverId: null,
  defaultPlatforms: ["instagram", "facebook"],
};

const avatars: AvatarProfile[] = [
  {
    id: "av_1",
    profileId: ME,
    personName: "Giuseppe Lorusso",
    status: "pronto",
    consentSigned: true,
    consentSignedAt: at(-20, "10:00"),
    consentVersion: "esempio-1",
    signer: "Giuseppe Lorusso",
    consentPdfPath: null,
    trainingVideoPath: "demo/training.mp4",
  },
];

const consent: ConsentTemplate = {
  version: "esempio-1",
  text:
    "TESTO DI ESEMPIO — il testo definitivo verrà inserito dopo la revisione legale.\n\n" +
    "Il/la sottoscritto/a acconsente all'uso della propria immagine e della propria voce per creare un avatar digitale, " +
    "utilizzato esclusivamente nei video promozionali degli immobili dell'agenzia. Il consenso può essere revocato in qualsiasi momento: " +
    "in quel caso l'avatar viene bloccato subito e cancellato presso il fornitore.",
};

type DemoVideo = Omit<VideoProject, "property" | "thumbUrl"> & { readyAt?: number };

const videos: DemoVideo[] = [
  {
    id: "vid_1",
    propertyId: "p1",
    createdBy: "u_2",
    duration: 45,
    photoIds: ["p1_f0", "p1_f2", "p1_f3", "p1_f1"],
    intro: "Buongiorno, vi presento un trilocale in vendita nel quartiere Murat, a Bari: 95 metri quadri ristrutturati, al terzo piano con ascensore.",
    outro: "Il prezzo è 245.000 euro. Chiamaci, ti aspettiamo in agenzia.",
    caption: "Trilocale luminoso con balcone nel cuore del Murat, Bari. 95 mq, 3 locali, 2 bagni, classe C.",
    hashtags: ["#bari", "#murat", "#trilocale"],
    status: "da_approvare",
    videoUrl: "mock:reel",
    errorMessage: null,
    startedAt: at(0, "08:10"),
    createdAt: at(0, "08:00"),
    updatedAt: hoursFromNow(-1),
  },
  {
    id: "vid_2",
    propertyId: "p2",
    createdBy: ME,
    duration: 30,
    photoIds: ["p2_f0", "p2_f1", "p2_f2", "p2_f3"],
    intro: "Buongiorno, vi presento questa casa con vista: guardate che luce.",
    outro: "Per visitarla chiamaci, ti aspettiamo in agenzia.",
    caption: "Una casa con vista che vale una visita.",
    hashtags: ["#bari"],
    status: "programmato",
    videoUrl: "mock:reel",
    errorMessage: null,
    startedAt: at(-2, "09:00"),
    createdAt: at(-2, "08:50"),
    updatedAt: at(-1, "18:00"),
  },
  {
    id: "vid_3",
    propertyId: "p3",
    createdBy: ME,
    duration: 45,
    photoIds: ["p3_f0", "p3_f1", "p3_f2", "p3_f3"],
    intro: "Buongiorno, oggi vi porto a vedere questo immobile.",
    outro: "Chiamaci, ti aspettiamo in agenzia.",
    caption: "Nuovo immobile in agenzia.",
    hashtags: [],
    status: "pubblicato",
    videoUrl: "mock:reel",
    errorMessage: null,
    startedAt: at(-6, "09:00"),
    createdAt: at(-6, "08:50"),
    updatedAt: at(-4, "12:30"),
  },
];

const approvals: (Approval & { videoId: ID })[] = [
  { id: "ap_1", videoId: "vid_2", outcome: "approvato", note: null, via: "app", approverName: "Giuseppe Lorusso", createdAt: at(-1, "18:00") },
  { id: "ap_2", videoId: "vid_3", outcome: "approvato", note: null, via: "whatsapp", approverName: "Giuseppe Lorusso", createdAt: at(-5, "19:00") },
];

const caption = (v: DemoVideo) =>
  [v.caption, [...new Set([...v.hashtags, ...brand.fixedHashtags])].join(" "), brand.aiDisclaimer].filter(Boolean).join("\n\n");

const posts: ScheduledPost[] = [
  { id: "sp_1", videoId: "vid_2", platform: "instagram", caption: caption(videos[1]), publishAt: at(1, "12:30"), status: "in_coda", url: null, error: null },
  { id: "sp_2", videoId: "vid_2", platform: "facebook", caption: caption(videos[1]), publishAt: at(1, "12:30"), status: "in_coda", url: null, error: null },
  { id: "sp_3", videoId: "vid_3", platform: "instagram", caption: caption(videos[2]), publishAt: at(-4, "12:30"), status: "pubblicato", url: null, error: null },
];

let generatedThisMonth = 3;

async function withProperty(v: DemoVideo): Promise<VideoProject> {
  const all = await listProperties();
  const p = all.find((x) => x.id === v.propertyId);
  return {
    ...v,
    property: { id: v.propertyId, title: p?.title ?? "", address: p?.address ?? "", city: p?.city ?? "" },
    thumbUrl: undefined,
  };
}

/* ---------- Video ---------- */

export async function listVideos() {
  await tick();
  const sorted = [...videos].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return wait(await Promise.all(sorted.map(withProperty)));
}

export async function countToApprove() {
  return wait(videos.filter((v) => v.status === "da_approvare").length, 100);
}

export async function isApprover() {
  return wait(true, 50);
}

export async function getVideo(id: ID): Promise<VideoDetail | null> {
  const v = videos.find((x) => x.id === id);
  if (!v) return wait(null);
  return wait({
    video: await withProperty(v),
    photoUrls: [],
    approvals: approvals.filter((a) => a.videoId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    posts: posts.filter((p) => p.videoId === id),
    canApprove: true,
    canEdit: true,
  });
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

export async function saveVideo(draft: VideoDraft, id?: ID): Promise<ID> {
  const now = new Date().toISOString();
  const existing = id ? videos.find((v) => v.id === id) : undefined;
  const fields = { duration: draft.duration, photoIds: draft.photoIds, intro: draft.intro, outro: draft.outro, caption: draft.caption, hashtags: draft.hashtags };
  if (existing) {
    Object.assign(existing, fields, { updatedAt: now });
    return wait(existing.id);
  }
  const v: DemoVideo = {
    id: newId("vid"),
    propertyId: draft.propertyId,
    createdBy: ME,
    ...fields,
    status: "script_pronto",
    videoUrl: null,
    errorMessage: null,
    startedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  videos.push(v);
  return wait(v.id);
}

export async function startGeneration(id: ID) {
  const v = videos.find((x) => x.id === id);
  if (!v) throw new Error("Video non trovato");
  if (!avatars.some((a) => a.status === "pronto"))
    throw Object.assign(new Error("Serve un avatar pronto con il consenso firmato: completalo in Studio → Impostazioni → Avatar"), { code: "42501" });
  Object.assign(v, { status: "in_generazione", startedAt: new Date().toISOString(), readyAt: Date.now() + 8000, updatedAt: new Date().toISOString() });
  emitChange();
  return wait(undefined);
}

export async function tick() {
  let changed = false;
  for (const v of videos) {
    if (v.status === "in_generazione" && v.readyAt && v.readyAt <= Date.now()) {
      Object.assign(v, { status: "da_approvare", videoUrl: "mock:reel", readyAt: undefined, updatedAt: new Date().toISOString() });
      generatedThisMonth++;
      changed = true;
    }
  }
  for (const a of avatars) {
    if (a.status === "in_addestramento" && a.consentSignedAt && Date.parse(a.consentSignedAt) + 10_000 <= Date.now()) {
      a.status = "pronto";
      changed = true;
    }
  }
  if (changed) setTimeout(emitChange, 0);
}

export async function deleteDraft(id: ID) {
  const i = videos.findIndex((v) => v.id === id);
  if (i >= 0) videos.splice(i, 1);
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
  const d = await getProperty(propertyId);
  const p = d!.property;
  const facts = [p.sqm ? `${p.sqm} metri quadri` : null, p.rooms ? `${p.rooms} locali` : null, p.bathrooms ? `${p.bathrooms} ${p.bathrooms === 1 ? "bagno" : "bagni"}` : null]
    .filter(Boolean)
    .join(", ");
  const price = new Intl.NumberFormat("it-IT").format(p.price) + (p.contract === "affitto" ? " euro al mese" : " euro");
  const zona = p.zone.replace(/^.*–\s*/, "");
  const dove = zona === p.city ? p.city : `${zona}, ${p.city}`;
  return wait(
    {
      intro:
        duration === 30
          ? `Buongiorno! Oggi vi porto a vedere un immobile a ${dove}: ${p.title.toLowerCase()}.`
          : `Buongiorno! Oggi vi porto a vedere un immobile a ${dove}: ${p.title.toLowerCase()}. ${facts}${p.floor ? `, ${p.floor}` : ""}.`,
      outro: `${p.contract === "affitto" ? "Il canone" : "Il prezzo"} è ${price}. ${brand.closingLine}`,
      caption: `${p.title} a ${dove}. ${facts}${p.energyClass ? `, classe ${p.energyClass}` : ""}.`,
      hashtags: [`#${p.city.toLowerCase().replace(/\W/g, "")}`, `#${p.kind}`, p.contract === "affitto" ? "#affitto" : "#vendita"],
      source: "ai",
    },
    1200,
  );
}

/* ---------- Approvazione e programmazione ---------- */

function nextSlot() {
  const order = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"] as const;
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    for (const t of [...(brand.preferredTimes[order[d.getDay()]] ?? [])].sort()) {
      const [h, m] = t.split(":").map(Number);
      const c = new Date(d);
      c.setHours(h, m, 0, 0);
      if (c.getTime() > Date.now() + 15 * 60_000 && !posts.some((p) => p.publishAt === c.toISOString() && p.status !== "fallito")) return c.toISOString();
    }
  }
  return at(1, "12:30");
}

function createPosts(v: DemoVideo, publishAt: string, platforms: Platform[]) {
  for (const pl of platforms) posts.push({ id: newId("sp"), videoId: v.id, platform: pl, caption: caption(v), publishAt, status: "in_coda", url: null, error: null });
}

export async function decide(id: ID, outcome: Outcome, note: string, publishAt: string | null, platforms: Platform[]) {
  const v = videos.find((x) => x.id === id)!;
  if (v.status !== "da_approvare") throw new Error("Il video non è più in attesa di approvazione");
  approvals.push({ id: newId("ap"), videoId: id, outcome, note: note.trim() || null, via: "app", approverName: "Giuseppe Lorusso", createdAt: new Date().toISOString() });
  if (outcome === "approvato") {
    if (publishAt && platforms.length) {
      createPosts(v, publishAt, platforms);
      v.status = "programmato";
    } else v.status = "approvato";
  } else v.status = outcome === "modifiche" ? "modifiche_richieste" : "scartato";
  v.updatedAt = new Date().toISOString();
  emitChange();
  return wait(undefined);
}

export async function schedule(id: ID, publishAt: string, platforms: Platform[]) {
  const v = videos.find((x) => x.id === id)!;
  if (v.status === "approvato") {
    createPosts(v, publishAt, platforms);
    v.status = "programmato";
  } else {
    for (const p of posts) if (p.videoId === id && p.status === "in_coda") p.publishAt = publishAt;
  }
  emitChange();
  return wait(undefined);
}

export async function proposedSlot() {
  return wait(nextSlot(), 100);
}

export async function approvalLink(_id: ID) {
  void _id;
  return wait(`${window.location.origin}/approva/esempio`);
}

export async function listCalendar(from: Date, to: Date): Promise<CalendarPost[]> {
  const inRange = posts.filter((p) => p.publishAt >= from.toISOString() && p.publishAt < to.toISOString());
  const all = await listProperties();
  const out: CalendarPost[] = [];
  for (const p of inRange) {
    const v = videos.find((x) => x.id === p.videoId);
    const pr = all.find((x) => x.id === v?.propertyId);
    if (!v) continue;
    const property = { id: v.propertyId, title: pr?.title ?? "", address: pr?.address ?? "", city: pr?.city ?? "" };
    out.push({ ...p, video: { id: v.id, status: v.status, property, thumbUrl: undefined } });
  }
  return wait(out.sort((a, b) => a.publishAt.localeCompare(b.publishAt)));
}

/* ---------- Pagina pubblica ---------- */

export async function getPublicApproval(_token: string): Promise<PublicApproval> {
  void _token;
  const v = videos.find((x) => x.status === "da_approvare");
  if (!v) throw new Error("Il link non è più valido: è scaduto, è già stato usato oppure il video è cambiato.");
  const full = await withProperty(v);
  return wait({
    agencyName: "Immobiliare Levante",
    agencyPhone: "080 521 4400",
    property: full.property,
    duration: v.duration,
    intro: v.intro,
    outro: v.outro,
    caption: v.caption,
    hashtags: [...v.hashtags, ...brand.fixedHashtags],
    photoUrls: [],
    aiDisclaimer: brand.aiDisclaimer,
    platforms: brand.defaultPlatforms,
    publishAt: nextSlot(),
  });
}

export async function decideByToken(_token: string, outcome: Outcome, note: string) {
  void _token;
  const v = videos.find((x) => x.status === "da_approvare");
  if (!v) throw new Error("Il link non è più valido.");
  await decide(v.id, outcome, note, outcome === "approvato" ? nextSlot() : null, brand.defaultPlatforms);
}

/* ---------- Brand, avatar, social, utilizzo ---------- */

export async function getBrand() {
  return wait(structuredClone(brand));
}

export async function updateBrand(b: BrandSettings) {
  Object.assign(brand, structuredClone(b));
  emitChange();
  return wait(undefined);
}

export async function listAvatars() {
  await tick();
  const team = await listTeam();
  return wait(
    avatars.map((a) => {
      const m = team.members.find((x) => x.id === a.profileId);
      return { ...a, personName: m ? `${m.firstName} ${m.lastName}` : a.personName };
    }),
  );
}

export async function setupAvatar(profileId: ID) {
  let a = avatars.find((x) => x.profileId === profileId);
  if (!a) {
    a = { id: newId("av"), profileId, personName: "", status: "in_attesa_consenso", consentSigned: false, consentSignedAt: null, consentVersion: null, signer: null, consentPdfPath: null, trainingVideoPath: null };
    avatars.push(a);
  } else if (a.status === "revocato") {
    Object.assign(a, { status: "in_attesa_consenso", consentSigned: false, consentSignedAt: null, consentVersion: null, signer: null, consentPdfPath: null, trainingVideoPath: null });
  }
  emitChange();
  return wait(a.id);
}

export async function uploadTrainingVideo(_file: File) {
  void _file;
  const a = avatars.find((x) => x.profileId === ME);
  if (!a) throw new Error("Avatar non trovato: chiedi al titolare di abilitarti");
  a.trainingVideoPath = "demo/training.mp4";
  emitChange();
  return wait(undefined, 800);
}

export async function activeConsent() {
  return wait(consent);
}

const pdfs = new Map<string, string>();

export async function signConsent(version: string, signer: string, pdf: Blob) {
  const a = avatars.find((x) => x.profileId === ME);
  if (!a) throw new Error("Avatar non trovato");
  const path = newId("consenso");
  pdfs.set(path, URL.createObjectURL(pdf));
  Object.assign(a, { consentSigned: true, consentSignedAt: new Date().toISOString(), consentVersion: version, signer, consentPdfPath: path, status: "in_addestramento" });
  emitChange();
  return wait(undefined);
}

export async function consentPdfUrl(path: string) {
  return wait(pdfs.get(path) ?? null, 50);
}

export async function revokeConsent(avatarId: ID) {
  const a = avatars.find((x) => x.id === avatarId);
  if (!a) throw new Error("Avatar non trovato");
  a.status = "revocato";
  a.consentSigned = false;
  for (const v of videos)
    if (v.status === "in_generazione") Object.assign(v, { status: "errore", errorMessage: "Il consenso dell'avatar è stato revocato: il video non può essere generato." });
  emitChange();
  return wait(undefined);
}

export async function listSocialAccounts(): Promise<SocialAccount[]> {
  return wait([]);
}

export async function getUsage(): Promise<StudioUsage> {
  return wait({ month: new Date().toISOString().slice(0, 7), used: generatedThisMonth, included: 8, extra: Math.max(0, generatedThisMonth - 8), dailyLimit: 10 });
}
