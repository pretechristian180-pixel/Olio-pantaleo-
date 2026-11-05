import "server-only";
import { z } from "zod";

/**
 * Variabili segrete: mai importare questo file da un Client Component.
 * Sono tutte opzionali in Fase 1; ogni funzione che ne ha bisogno usa requireServerEnv().
 */
const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  BUNNY_STREAM_LIBRARY_ID: z.string().min(1).optional(),
  BUNNY_STREAM_API_KEY: z.string().min(1).optional(),
  BUNNY_STREAM_TOKEN_KEY: z.string().min(1).optional(),
  BUNNY_STREAM_CDN_HOSTNAME: z.string().min(1).optional(),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_CONNECT_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_TAX_RATE_ID: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(16).optional(),
  VERCEL_API_TOKEN: z.string().min(1).optional(),
  VERCEL_PROJECT_ID: z.string().min(1).optional(),
  VERCEL_TEAM_ID: z.string().min(1).optional(),
});

type ServerEnv = z.infer<typeof serverSchema>;

const parsed = serverSchema.parse(
  Object.fromEntries(Object.keys(serverSchema.shape).map((k) => [k, process.env[k] || undefined])),
);

export function optionalServerEnv<K extends keyof ServerEnv>(key: K): ServerEnv[K] {
  return parsed[key];
}

export function requireServerEnv<K extends keyof ServerEnv>(key: K): NonNullable<ServerEnv[K]> {
  const value = parsed[key];
  if (!value) throw new Error(`Variabile d'ambiente mancante: ${key}`);
  return value as NonNullable<ServerEnv[K]>;
}
