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

/** Numero da <input>: stringa vuota = null. */
export const numeroOpzionale = (msg = "Inserisci un numero valido") =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || (!Number.isNaN(Number(v.replace(",", "."))) && Number(v.replace(",", ".")) >= 0), msg);

export const aNumero = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
export const vuotoANull = (v: string | null | undefined) => (v && v.trim() !== "" ? v.trim() : null);

export const PIVA = /^\d{11}$/;
export const TARGA = /^[A-Z]{2}\s?\d{3}\s?[A-Z]{2}$/i;
