/**
 * Meta Pixel e Google Analytics 4: predisposti ma caricati SOLO dopo il consenso.
 * Google Consent Mode v2 parte con tutto "denied". Senza ID nelle variabili d'ambiente non si carica nulla.
 */
import { consensoCorrente, type Consenso } from "./consenso";

const GA4_ID = import.meta.env.VITE_GA4_ID as string | undefined;
const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;

type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
    fbq?: ((...args: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };
    _fbq?: unknown;
  }
}

let gaCaricato = false;
let pixelCaricato = false;

function carica(src: string) {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

/** Da chiamare all'avvio: imposta i default "denied" e applica un consenso già salvato. */
export function inizializzaTracciamento() {
  if (GA4_ID) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    window.gtag("consent", "default", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
      wait_for_update: 500,
    });
  }
  applicaConsenso(consensoCorrente());
}

export function applicaConsenso(c: Consenso | null) {
  if (!c) return;
  if (GA4_ID && window.gtag) {
    window.gtag("consent", "update", {
      analytics_storage: c.statistiche ? "granted" : "denied",
      ad_storage: c.marketing ? "granted" : "denied",
      ad_user_data: c.marketing ? "granted" : "denied",
      ad_personalization: c.marketing ? "granted" : "denied",
    });
    if (c.statistiche && !gaCaricato) {
      gaCaricato = true;
      carica(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_ID)}`);
      window.gtag("js", new Date());
      window.gtag("config", GA4_ID, { anonymize_ip: true });
    }
  }
  if (PIXEL_ID && c.marketing && !pixelCaricato) {
    pixelCaricato = true;
    const fbq = function (...args: unknown[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const f = fbq as any;
      if (f.callMethod) f.callMethod(...args);
      else f.queue.push(args);
    } as NonNullable<Window["fbq"]>;
    Object.assign(fbq, { push: fbq, loaded: true, version: "2.0", queue: [] });
    window.fbq = fbq;
    window._fbq = fbq;
    carica("https://connect.facebook.net/en_US/fbevents.js");
    fbq("init", PIXEL_ID);
    fbq("track", "PageView");
  }
}

/** Conversione: richiesta demo inviata. Tracciata solo con il consenso della relativa categoria. */
export function tracciaLead() {
  const c = consensoCorrente();
  if (c?.statistiche && GA4_ID && window.gtag) window.gtag("event", "generate_lead", { form: "demo" });
  if (c?.marketing && PIXEL_ID && window.fbq) window.fbq("track", "Lead");
}
