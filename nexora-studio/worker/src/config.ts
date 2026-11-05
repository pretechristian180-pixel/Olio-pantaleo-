import { hostname } from "node:os";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variabile d'ambiente mancante: ${name}`);
  return value;
}

export function loadConfig() {
  return {
    supabaseUrl: required("SUPABASE_URL"),
    supabaseSecretKey: required("SUPABASE_SECRET_KEY"),
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000",
    adminAlertEmail: process.env.ADMIN_ALERT_EMAIL ?? null,
    workerId: process.env.WORKER_ID ?? `${hostname()}-${process.pid}`,
    pollIntervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS ?? 5000),
    scheduleIntervalMs: Number(process.env.WORKER_SCHEDULE_INTERVAL_MS ?? 60_000),
    /** Domenica a quest'ora (ora italiana) si generano gli script della settimana dopo. */
    generateHour: Number(process.env.SCRIPTS_GENERATE_HOUR ?? 18),
    /** Lunedì a quest'ora parte l'email "I tuoi video della settimana". */
    emailHour: Number(process.env.SCRIPTS_EMAIL_HOUR ?? 8),
  };
}

export type WorkerConfig = ReturnType<typeof loadConfig>;
