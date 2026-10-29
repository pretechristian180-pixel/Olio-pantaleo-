/** Configurazione da secrets delle Edge Function: nessuna chiave nel codice né nel client. */

export interface Config {
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  ficToken: string;
  ficCompanyId: string;
  /** Solo "true" abilita l'invio reale allo SDI; ogni altro valore = dry run */
  einvoiceLive: boolean;
  cronSecret: string;
  ficWebhookToken: string;
  functionsUrl: string;
  pannelloUrl: string;
  resendKey: string | null;
  avvisiA: string[];
  mittente: string | null;
}

const env = (k: string) => Deno.env.get(k) ?? "";

export function leggiConfig(): Config {
  const stripeSecretKey = env("STRIPE_SECRET_KEY");
  return {
    stripeSecretKey,
    stripeWebhookSecret: env("STRIPE_WEBHOOK_SECRET"),
    ficToken: env("FIC_ACCESS_TOKEN"),
    ficCompanyId: env("FIC_COMPANY_ID"),
    // Doppia sicurezza: con chiavi Stripe di test non si invia MAI davvero allo SDI.
    einvoiceLive: env("EINVOICE_LIVE") === "true" && stripeSecretKey.startsWith("sk_live_"),
    cronSecret: env("CRON_SECRET"),
    ficWebhookToken: env("FIC_WEBHOOK_TOKEN"),
    functionsUrl: env("FUNCTIONS_URL") || `${env("SUPABASE_URL")}/functions/v1`,
    pannelloUrl: env("PANNELLO_URL"),
    resendKey: env("RESEND_API_KEY") || null,
    avvisiA: env("AVVISI_EMAIL_A").split(",").map((s) => s.trim()).filter(Boolean),
    mittente: env("EMAIL_MITTENTE") || null,
  };
}
