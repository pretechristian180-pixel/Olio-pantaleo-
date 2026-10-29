/** Pezzi di validazione (zod) riusati in più form, con messaggi in italiano. */
import { z } from "zod";

export const testoObbligatorio = (campo: string) => z.string().trim().min(1, `Inserisci ${campo}`);

export const telefono = z
  .string()
  .trim()
  .regex(/^\+?[\d\s./-]{6,20}$/, "Numero di telefono non valido");

export const telefonoOpzionale = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\+?[\d\s./-]{6,20}$/.test(v), "Numero di telefono non valido");

export const emailOpzionale = z
  .string()
  .trim()
  .refine((v) => v === "" || z.email().safeParse(v).success, "Email non valida");

/**
 * Legge un numero scritto all'italiana: "12.500", "12500", "12.500,50", "6,99", "€ 9.900".
 * Restituisce NaN se non è un numero.
 */
export function numeroIt(v: string): number {
  let t = v.replace(/[\s€]/g, "");
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  return t === "" ? NaN : Number(t);
}

/** Numero da <input>: stringa vuota = null. */
export const numeroOpzionale = (msg = "Inserisci un numero valido") =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || (!Number.isNaN(numeroIt(v)) && numeroIt(v) >= 0), msg);

export const aNumero = (v: string) => (v.trim() === "" ? null : numeroIt(v));
export const vuotoANull = (v: string | null | undefined) => (v && v.trim() !== "" ? v.trim() : null);

export const PIVA = /^\d{11}$/;
export const TARGA = /^[A-Z]{2}\s?\d{3}\s?[A-Z]{2}$/i;
