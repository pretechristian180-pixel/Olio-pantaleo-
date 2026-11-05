function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variabile d'ambiente mancante: ${name}`);
  return value;
}

export function loadConfig() {
  return {
    supabaseUrl: required("SUPABASE_URL"),
    supabaseSecretKey: required("SUPABASE_SECRET_KEY"),
    pollIntervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS ?? 5000),
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 1),
  };
}

export type WorkerConfig = ReturnType<typeof loadConfig>;
