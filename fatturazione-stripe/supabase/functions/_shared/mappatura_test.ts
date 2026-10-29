import { assert, assertEquals } from "jsr:@std/assert@1";
import { calcolaBollo, costruisciDocumento, dataIso, type ImpostazioniFiscali } from "./mappatura.ts";
import { normalizzaFattura } from "./stripe.ts";
import { fatturaStripe, impostazioniLordo, PAGATA, profilo } from "./esempi_test.ts";

// deno-lint-ignore no-explicit-any
const voci = (doc: any) => doc.items_list as any[];

Deno.test("Fattura con canone, voce una tantum e coupon (prezzi IVA inclusa)", () => {
  const fs = normalizzaFattura(fatturaStripe());
  const m = costruisciDocumento({ fattura: fs, impostazioni: impostazioniLordo, profilo, ficClientId: 77 });
  assertEquals(m.problemi, []);
  assertEquals(m.totaleCent, 17910);
  const doc = m.documento!;
  assertEquals(doc.type, "invoice");
  assertEquals(doc.e_invoice, true);
  assertEquals(doc.use_gross_prices, true);
  assertEquals(doc.date, dataIso(PAGATA));
  assertEquals(doc.date, "2026-11-01");
  const r = voci(doc);
  assertEquals(r.length, 3);
  assertEquals(r[0].name, "Canone abbonamento Sorpasso Pro dal 01/11/2026 al 30/11/2026");
  assertEquals(r[0].gross_price, 49);
  assertEquals(r[1].name, "Configurazione iniziale e formazione");
  assertEquals(r[1].gross_price, 150);
  assertEquals(r[2].name, "Sconto Benvenuto 10%");
  assertEquals(r[2].gross_price, -19.9);
  // pagamento già saldato, metodo SEPA da configurazione, data di incasso
  // deno-lint-ignore no-explicit-any
  const pag = (doc.payments_list as any[])[0];
  assertEquals(pag, { amount: 179.1, due_date: "2026-11-01", paid_date: "2026-11-01", status: "paid", payment_account: { id: 111 } });
  // deno-lint-ignore no-explicit-any
  assertEquals((doc.ei_data as any).payment_method, "MP19");
  // deno-lint-ignore no-explicit-any
  assertEquals((doc.entity as any).id, 77);
  // deno-lint-ignore no-explicit-any
  assertEquals((doc.entity as any).ei_code, "M5UXCR1");
  // IVA scorporata: 179,10 / 1,22 = 146,80 + 32,30
  assertEquals(m.imponibileCent + m.ivaCent, 17910);
  assertEquals(m.imponibileCent, 14680);
});

Deno.test("Prezzi netti con IVA calcolata da Stripe: importi identici", () => {
  const imp = { ...impostazioniLordo, prezzi_stripe_ivati: false };
  const fs = normalizzaFattura(fatturaStripe({ tax: 3940, total: 21850, amount_paid: 21850, charge: { id: "ch", payment_method_details: { type: "card" } } }));
  const m = costruisciDocumento({ fattura: fs, impostazioni: imp, profilo });
  assertEquals(m.problemi, []);
  assertEquals(m.imponibileCent, 17910);
  assertEquals(m.ivaCent, 3940);
  assertEquals(voci(m.documento)[0].net_price, 49);
  // deno-lint-ignore no-explicit-any
  assertEquals((m.documento!.ei_data as any).payment_method, "MP08");
});

Deno.test("Importi che non tornano al centesimo: nessun documento", () => {
  const imp = { ...impostazioniLordo, prezzi_stripe_ivati: false };
  const fs = normalizzaFattura(fatturaStripe({ tax: 3941, total: 21851 }));
  const m = costruisciDocumento({ fattura: fs, impostazioni: imp, profilo });
  assertEquals(m.documento, null);
  assert(m.problemi[0]!.startsWith("Importi non coerenti"));
});

Deno.test("Nota di credito per rimborso parziale (lordo) collegata alla fattura", () => {
  const fs = normalizzaFattura(fatturaStripe());
  const m = costruisciDocumento({
    fattura: fs, impostazioni: impostazioniLordo, profilo,
    rimborso: { id: "re_1", importo: 5000, creatoIl: PAGATA + 86400 * 3 },
    originale: { numero: "12", data: "2026-11-01" },
  });
  assertEquals(m.problemi, []);
  const doc = m.documento!;
  assertEquals(doc.type, "credit_note");
  assertEquals(doc.date, "2026-11-04");
  assertEquals(voci(doc).length, 1);
  assertEquals(voci(doc)[0].name, "Rimborso parziale relativo alla fattura n. 12 del 01/11/2026");
  assertEquals(voci(doc)[0].gross_price, 50);
  // deno-lint-ignore no-explicit-any
  assertEquals((doc.ei_data as any).invoice_number, "12");
  assertEquals(m.totaleCent, 5000);
});

Deno.test("Nota di credito parziale con prezzi netti: scorporo esatto", () => {
  const imp = { ...impostazioniLordo, prezzi_stripe_ivati: false };
  const fs = normalizzaFattura(fatturaStripe({ tax: 3940, total: 21850 }));
  const m = costruisciDocumento({ fattura: fs, impostazioni: imp, profilo, rimborso: { id: "re_2", importo: 6100, creatoIl: PAGATA } });
  assertEquals(m.problemi, []);
  assertEquals(voci(m.documento)[0].net_price, 50); // 50,00 + 22% = 61,00
  assertEquals(m.totaleCent, 6100);
});

Deno.test("Nota di credito per rimborso totale: stesse righe della fattura", () => {
  const fs = normalizzaFattura(fatturaStripe());
  const m = costruisciDocumento({ fattura: fs, impostazioni: impostazioniLordo, profilo, rimborso: { id: "re_3", importo: 17910, creatoIl: PAGATA } });
  assertEquals(m.problemi, []);
  assertEquals(voci(m.documento).length, 3);
});

const esente: ImpostazioniFiscali = {
  ...impostazioniLordo, aliquota_iva: 0, natura_iva: "N2.2", dicitura: "Operazione senza applicazione dell'IVA (regime forfettario)",
  bollo_applicato: true, bollo_importo: 2, bollo_soglia: 77.47, bollo_addebitato_cliente: false,
};

Deno.test("Marca da bollo: sopra e sotto soglia", () => {
  assertEquals(calcolaBollo(esente, 7748), { applica: true, importoCent: 200, addebitato: false });
  assertEquals(calcolaBollo(esente, 7747).applica, false, "uguale alla soglia: non si applica");
  assertEquals(calcolaBollo({ ...esente, natura_iva: null, aliquota_iva: 22 }, 50000).applica, false, "con IVA: no bollo");
  const fs = normalizzaFattura(fatturaStripe());
  const m = costruisciDocumento({ fattura: fs, impostazioni: esente, profilo });
  assertEquals(m.problemi, []);
  assertEquals(m.documento!.stamp_duty, 2);
  assertEquals(m.documento!.notes, esente.dicitura);
  const piccola = normalizzaFattura(fatturaStripe({
    total: 4900, subtotal: 4900, total_discount_amounts: [],
    lines: { has_more: false, data: [{ ...fatturaStripe().lines.data[0], discount_amounts: [] }] },
  }));
  const m2 = costruisciDocumento({ fattura: piccola, impostazioni: esente, profilo });
  assertEquals(m2.problemi, []);
  assertEquals(m2.documento!.stamp_duty, undefined);
});

Deno.test("Bollo addebitato al cliente: deve esserci la voce Stripe", () => {
  const imp = { ...esente, bollo_addebitato_cliente: true };
  const fs = normalizzaFattura(fatturaStripe());
  assert(costruisciDocumento({ fattura: fs, impostazioni: imp, profilo }).problemi.some((p) => p.includes("Marca da bollo")));
  const conBollo = fatturaStripe({ total: 18110, subtotal: 20100 });
  conBollo.lines.data.push({ id: "il_b", type: "invoiceitem", amount: 200, description: "Imposta di bollo", quantity: 1, period: null, proration: false, price: null, discount_amounts: [], metadata: { bollo: "true" } });
  const m = costruisciDocumento({ fattura: normalizzaFattura(conBollo), impostazioni: imp, profilo });
  assertEquals(m.problemi, []);
  assertEquals(voci(m.documento).length, 3, "la voce di bollo non diventa una riga ma stamp_duty");
  assertEquals(m.documento!.stamp_duty, 2);
});

Deno.test("Configurazione incompleta: nessun documento", () => {
  const fs = normalizzaFattura(fatturaStripe());
  const m = costruisciDocumento({ fattura: fs, impostazioni: { ...impostazioniLordo, fic_vat_id: null, codice_pagamento_sepa: null }, profilo });
  assertEquals(m.documento, null);
  assert(m.problemi[0]!.includes("Tipo IVA di Fatture in Cloud"));
  assert(m.problemi[0]!.includes("SEPA"));
});

Deno.test("Quantità e importi non divisibili: nessun arrotondamento", () => {
  const f = fatturaStripe({ total: 1000, subtotal: 1000, total_discount_amounts: [] });
  f.lines.data = [{ ...f.lines.data[1], amount: 1000, quantity: 3, discount_amounts: [] }];
  const m = costruisciDocumento({ fattura: normalizzaFattura(f), impostazioni: impostazioniLordo, profilo });
  assertEquals(voci(m.documento)[0].qty, 1);
  assertEquals(voci(m.documento)[0].gross_price, 10);
  assert(voci(m.documento)[0].name.endsWith("(quantità 3)"));
});
