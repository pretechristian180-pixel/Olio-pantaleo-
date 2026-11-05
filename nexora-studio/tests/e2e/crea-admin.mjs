// Crea (o promuove) un utente del team Nexora per i test locali: node tests/e2e/crea-admin.mjs email password
import { createClient } from "@supabase/supabase-js";

const [email, password] = process.argv.slice(2);
const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const key = process.env.SUPABASE_SECRET_KEY;
if (!key || !email || !password) throw new Error("Uso: SUPABASE_SECRET_KEY=... node crea-admin.mjs email password");
const db = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Team Nexora" } });
const id = data.user?.id ?? (await db.auth.admin.listUsers()).data.users.find((u) => u.email === email)?.id;
if (!id) throw error ?? new Error("utente non creato");
const { error: e2 } = await db.from("profiles").update({ is_admin: true }).eq("user_id", id);
if (e2) throw e2;
console.log("admin pronto:", email);
