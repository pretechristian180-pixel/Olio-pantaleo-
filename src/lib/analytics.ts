export type AnalyticsEvent =
  | { name: "view_product"; params: { slug: string; nome: string; categoria: string } }
  | { name: "add_to_cart"; params: { slug: string; variantId: string; prezzo: number; quantita: number } }
  | { name: "begin_checkout"; params: { valore: number; articoli: number } }
  | { name: "purchase"; params: { ordineId: string; valore: number; articoli: number } }
  | { name: "newsletter_signup"; params: { origine: string } }
  | { name: "quiz_start"; params: Record<string, never> }
  | { name: "quiz_complete"; params: { risultato: string } }
  | { name: "contact_b2b"; params: { azienda: string } }
  | { name: "recipe_view"; params: { slug: string } }
  | { name: "search"; params: { query: string; risultati: number } }
  | { name: "filter_product"; params: { filtro: string; valore: string } };

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export function track(event: AnalyticsEvent): void {
  if (typeof window === "undefined") return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: event.name, ...event.params });

  if (process.env.NODE_ENV !== "production") {
    console.debug("[analytics]", event.name, event.params);
  }
}
