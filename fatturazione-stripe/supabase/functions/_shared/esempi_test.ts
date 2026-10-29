/** Dati di esempio condivisi dai test (forma reale degli oggetti Stripe, versione 2025-02-24.acacia). */
import type { ImpostazioniFiscali } from "./mappatura.ts";
import type { ProfiloFatturazione } from "./validazione.ts";

// 1 novembre 2026 00:00 e 1 dicembre 2026 00:00, ora italiana
export const INIZIO = Date.UTC(2026, 9, 31, 23, 0, 0) / 1000;
export const FINE = Date.UTC(2026, 10, 30, 23, 0, 0) / 1000;
export const PAGATA = Date.UTC(2026, 10, 1, 9, 30, 0) / 1000;

/** Abbonamento 49,00 € + configurazione 150,00 €, coupon 10% → 179,10 € (prezzi IVA inclusa). */
// deno-lint-ignore no-explicit-any
export function fatturaStripe(over: Record<string, any> = {}): any {
  return {
    id: "in_test_1",
    object: "invoice",
    number: "ABC-0001",
    status: "paid",
    currency: "eur",
    customer: "cus_test_1",
    subtotal: 19900,
    total: 17910,
    tax: null,
    amount_paid: 17910,
    status_transitions: { paid_at: PAGATA },
    charge: { id: "ch_test_1", payment_method_details: { type: "sepa_debit" } },
    total_discount_amounts: [{ amount: 1990, discount: { id: "di_1", coupon: { id: "BENV10", name: "Benvenuto 10%" } } }],
    lines: {
      has_more: false,
      data: [
        {
          id: "il_1", type: "subscription", amount: 4900, description: "1 × Sorpasso Pro (at €49.00 / month)", quantity: 1,
          period: { start: INIZIO, end: FINE }, proration: false, price: { product: { name: "Sorpasso Pro" } },
          discount_amounts: [{ amount: 490, discount: "di_1" }], metadata: {},
        },
        {
          id: "il_2", type: "invoiceitem", amount: 15000, description: "Configurazione iniziale e formazione", quantity: 1,
          period: { start: PAGATA, end: PAGATA }, proration: false, price: { product: { name: "Setup" } },
          discount_amounts: [{ amount: 1500, discount: "di_1" }], metadata: {},
        },
      ],
    },
    ...over,
  };
}

export const impostazioniLordo: ImpostazioniFiscali = {
  emittente_ragione_sociale: "Nexora Gruppo Digitale Srl",
  emittente_partita_iva: "12345678903",
  emittente_iban: "IT60X0542811101000000123456",
  regime_fiscale: "RF01",
  aliquota_iva: 22,
  natura_iva: null,
  fic_vat_id: 0,
  dicitura: null,
  prezzi_stripe_ivati: true,
  bollo_applicato: false,
  bollo_importo: null,
  bollo_soglia: null,
  bollo_addebitato_cliente: null,
  cassa_tipo: null,
  cassa_aliquota: null,
  fic_numerazione: null,
  fic_numerazione_note_credito: null,
  fic_payment_account_id: 111,
  codice_pagamento_carta: "MP08",
  codice_pagamento_sepa: "MP19",
  codice_pagamento_altro: "MP05",
};

export const profilo: ProfiloFatturazione = {
  stripe_customer_id: "cus_test_1", tipo: "azienda", ragione_sociale: "Autosalone Levante Srl", partita_iva: "12345678903",
  codice_fiscale: null, via: "Via Napoli 128", cap: "70123", comune: "Bari", provincia: "BA", nazione: "IT",
  codice_destinatario: "M5UXCR1", pec: null, email_amministrativa: "amministrazione@levante.it",
};
