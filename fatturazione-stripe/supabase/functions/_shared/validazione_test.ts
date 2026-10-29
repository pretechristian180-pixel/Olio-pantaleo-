import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";
import { codiceDestinatarioValido, codiceFiscaleValido, controllaProfilo, partitaIvaValida, type ProfiloFatturazione } from "./validazione.ts";
import { mascheraCodice, mascheraEmail, mascheraOggetto } from "./maschera.ts";

Deno.test("P.IVA: cifra di controllo", () => {
  assert(partitaIvaValida("12345678903"));
  assert(partitaIvaValida("IT12345678903"));
  assertFalse(partitaIvaValida("12345678901"), "cifra di controllo errata");
  assertFalse(partitaIvaValida("00000000000"));
  assertFalse(partitaIvaValida("1234567890"), "10 cifre");
  assertFalse(partitaIvaValida("1234567890A"));
});

Deno.test("Codice fiscale persona fisica e numerico", () => {
  assert(codiceFiscaleValido("RSSMRA80A01H501U"));
  assert(codiceFiscaleValido("rssmra80a01h501u"), "minuscole accettate");
  assertFalse(codiceFiscaleValido("RSSMRA80A01H501A"), "carattere di controllo errato");
  assertFalse(codiceFiscaleValido("RSSMRA80Z01H501U"), "mese non valido");
  assert(codiceFiscaleValido("12345678903"), "codice fiscale numerico di società");
  assertFalse(codiceFiscaleValido("12345678901"));
});

Deno.test("Codice destinatario", () => {
  assert(codiceDestinatarioValido("M5UXCR1", "azienda"));
  assertFalse(codiceDestinatarioValido("M5UXCR", "azienda"));
  assert(codiceDestinatarioValido("UFABCD", "pa"));
  assertFalse(codiceDestinatarioValido("M5UX-R1", "azienda"));
});

const base: ProfiloFatturazione = {
  stripe_customer_id: "cus_1", tipo: "azienda", ragione_sociale: "Rossi Srl", partita_iva: "12345678903", codice_fiscale: null,
  via: "Via Roma 1", cap: "70121", comune: "Bari", provincia: "BA", nazione: "IT", codice_destinatario: "M5UXCR1", pec: null,
  email_amministrativa: "amministrazione@rossi.it",
};

Deno.test("Profilo completo e casi mancanti", () => {
  assert(controllaProfilo(base).ok);
  const senzaRecapito = controllaProfilo({ ...base, codice_destinatario: null });
  assertFalse(senzaRecapito.ok);
  assertEquals(senzaRecapito.mancanti, ["Codice destinatario SDI oppure PEC"]);
  assert(controllaProfilo({ ...base, codice_destinatario: "0000000", pec: "rossi@pec.it" }).ok, "0000000 con PEC");
  assertFalse(controllaProfilo({ ...base, codice_destinatario: "0000000" }).ok, "0000000 senza PEC per un'azienda");
  assert(controllaProfilo({ ...base, tipo: "persona", partita_iva: null, codice_fiscale: "RSSMRA80A01H501U", codice_destinatario: "0000000" }).ok, "consumatore finale");
  const pivaErrata = controllaProfilo({ ...base, partita_iva: "12345678901" });
  assertEquals(pivaErrata.errori, ["Partita IVA non valida (cifra di controllo errata)"]);
  const senzaEmail = controllaProfilo({ ...base, email_amministrativa: null });
  assert(senzaEmail.ok, "l'email non blocca la fattura");
  assertEquals(senzaEmail.avvisi.length, 1);
  assertFalse(controllaProfilo({ ...base, cap: "7012" }).ok);
});

Deno.test("Mascheramento per i log", () => {
  assertEquals(mascheraCodice("12345678903"), "1234*****03");
  assertEquals(mascheraEmail("mario.rossi@azienda.it"), "m***@azienda.it");
  const m = mascheraOggetto({ partita_iva: "12345678903", email: "a@b.it", totale_cent: 100, entity: { name: "Rossi Srl" } }) as Record<string, unknown>;
  assertEquals(m.partita_iva, "1234*****03");
  assertEquals(m.totale_cent, 100);
  assertEquals((m.entity as Record<string, unknown>).name, "Ros… (9)");
});
