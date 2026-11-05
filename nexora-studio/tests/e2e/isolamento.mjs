import { createClient } from "@supabase/supabase-js";
// Valori di default: Supabase locale avviato con `npx supabase start` (chiavi demo della CLI).
const URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const PUB = process.env.SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;
if (!PUB || !SECRET) throw new Error("Imposta SUPABASE_PUBLISHABLE_KEY e SUPABASE_SECRET_KEY (da `npx supabase status`).");
const [aEmail, bEmail] = process.argv.slice(2);
let fails = 0;
const check = (label, ok, extra = "") => { console.log(`${ok ? "✓" : "✗"} ${label}${extra ? " — " + extra : ""}`); if (!ok) fails++; };

const admin = createClient(URL, SECRET, { auth: { persistSession: false } });
const cEmail = `carla.${Date.now()}@test.it`;
await admin.auth.admin.createUser({ email: cEmail, password: "Carla2026!", email_confirm: true, user_metadata: { full_name: "Carla Verdi" } });

async function login(email, pw) {
  const c = createClient(URL, PUB, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: pw });
  if (error) throw error;
  return c;
}
const A = await login(aEmail, "Pizza2026!");
const B = await login(bEmail, "Giulia2026!");
const C = await login(cEmail, "Carla2026!");

const { data: wsC } = await C.rpc("create_workspace", { p_name: "Bar Carla", p_sector: "ristorazione", p_city: "Lecce" });
const { data: wsAList } = await A.from("workspaces").select("id, name");
const wsA = wsAList[0];
console.log(`A: ${wsA.name} · C: ${wsC.name}\n`);

// C (altra azienda)
let r = await C.from("workspaces").select("id, name");
check("C vede solo la propria azienda", r.data.length === 1 && r.data[0].id === wsC.id, r.data.map(w => w.name).join(", "));
r = await C.from("brand_profiles").select("workspace_id").eq("workspace_id", wsA.id);
check("C non legge il brand di A", r.data.length === 0);
r = await C.from("workspace_members").select("user_id").eq("workspace_id", wsA.id);
check("C non vede i membri di A", r.data.length === 0);
r = await C.from("profiles").select("full_name");
check("C vede solo il proprio profilo", r.data.length === 1, r.data.map(p => p.full_name).join(", "));
r = await C.from("workspaces").update({ name: "Hack" }).eq("id", wsA.id).select();
check("C non modifica l'azienda di A", (r.data ?? []).length === 0);
r = await C.from("workspace_invitations").insert({ workspace_id: wsA.id, email: "x@x.it", invited_by: (await C.auth.getUser()).data.user.id });
check("C non crea inviti per A", !!r.error, r.error?.code);
r = await C.storage.from("brand").list(`${wsA.id}/esempi`);
check("C non vede i file di A", (r.data ?? []).length === 0);
r = await C.storage.from("brand").upload(`${wsA.id}/esempi/intruso.mp4`, new Blob(["x"], { type: "video/mp4" }));
check("C non carica file nella cartella di A", !!r.error);
const { data: anyFile } = await A.storage.from("brand").list(`${wsA.id}/esempi`);
r = await C.storage.from("brand").createSignedUrl(`${wsA.id}/esempi/${anyFile[0].name}`, 60);
check("C non ottiene link firmati ai video di A", !!r.error);

// B (collaboratore di A)
r = await B.from("workspaces").select("id");
check("B vede l'azienda di A", r.data.some(w => w.id === wsA.id));
r = await B.from("workspaces").update({ name: "Hack" }).eq("id", wsA.id).select();
check("B (collaboratore) non modifica i dati azienda", (r.data ?? []).length === 0);
r = await B.from("workspaces").update({ trial_videos_left: 99 }).eq("id", wsA.id);
check("B non si regala video di prova", !!r.error, r.error?.code);
r = await B.from("workspace_members").update({ role: "owner" }).eq("workspace_id", wsA.id).select();
check("B non si promuove titolare", (r.data ?? []).length === 0);
r = await B.from("profiles").update({ is_admin: true }).eq("user_id", (await B.auth.getUser()).data.user.id);
check("B non si rende admin", !!r.error, r.error?.code);
r = await B.from("brand_profiles").update({ services: "Pizza e focacce" }).eq("workspace_id", wsA.id).select();
check("B aggiorna il brand (permesso)", (r.data ?? []).length === 1);
r = await B.from("audit_log").select("id");
check("B non legge il registro attività", r.data.length === 0);
r = await B.storage.from("brand").createSignedUrl(`${wsA.id}/esempi/${anyFile[0].name}`, 60);
check("B apre i video di esempio di A", !r.error);

// A (titolare)
r = await A.from("workspaces").update({ plan_id: "business" }).eq("id", wsA.id);
check("A non si cambia il piano da solo", !!r.error, r.error?.code);
r = await A.from("audit_log").select("action").eq("workspace_id", wsA.id);
check("A legge il registro attività", r.data.length >= 2, r.data.map(x => x.action).join(", "));
r = await A.from("plans").select("id, price_monthly_cents");
check("I piani sono leggibili", r.data.length === 3, r.data.map(p => `${p.id} ${p.price_monthly_cents / 100}€`).join(", "));
const anon = createClient(URL, PUB, { auth: { persistSession: false } });
r = await anon.from("workspaces").select("id");
check("Un visitatore anonimo non vede aziende", (r.data ?? []).length === 0);

console.log(fails ? `\n${fails} CONTROLLI FALLITI` : "\nTUTTI I CONTROLLI OK");
process.exit(fails ? 1 : 0);
