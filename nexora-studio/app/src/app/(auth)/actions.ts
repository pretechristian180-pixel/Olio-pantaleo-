"use server";

import { redirect } from "next/navigation";

import type { FormState } from "@/components/forms/form-message";
import { authErrorMessage } from "@/lib/auth-errors";
import { publicEnv } from "@/lib/env";
import { safeNext } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function validatePassword(password: string) {
  if (password.length < 8) return "Usa almeno 8 caratteri.";
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) return "Usa lettere e numeri.";
  return null;
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const fullName = str(formData, "full_name");
  const email = str(formData, "email").toLowerCase();
  const password = formData.get("password")?.toString() ?? "";
  const accepted = formData.get("terms") === "on";

  const fieldErrors: Record<string, string> = {};
  if (fullName.length < 2) fieldErrors.full_name = "Scrivi nome e cognome.";
  if (!EMAIL_RE.test(email)) fieldErrors.email = "Controlla l'indirizzo email.";
  const pwError = validatePassword(password);
  if (pwError) fieldErrors.password = pwError;
  if (!accepted) fieldErrors.terms = "Serve il consenso per creare l'account.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const next = safeNext(formData.get("next"), "/onboarding");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${publicEnv.appUrl}/auth/conferma?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { error: authErrorMessage(error) };

  // Conferma email disattivata (sviluppo): la sessione c'è già.
  if (data.session) redirect(next);

  return {
    success: `Ti abbiamo mandato un'email a ${email}. Apri il link per confermare l'account e continuare.`,
  };
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = str(formData, "email").toLowerCase();
  const password = formData.get("password")?.toString() ?? "";
  if (!EMAIL_RE.test(email) || !password) {
    return { error: "Inserisci email e password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: authErrorMessage(error) };

  redirect(safeNext(formData.get("next")));
}

export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = str(formData, "email").toLowerCase();
  if (!EMAIL_RE.test(email)) return { fieldErrors: { email: "Controlla l'indirizzo email." } };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${publicEnv.appUrl}/auth/conferma?next=/reimposta-password`,
  });
  // Non riveliamo se l'email esiste: stessa risposta in ogni caso (salvo limiti di invio).
  if (error && error.code?.startsWith("over_")) return { error: authErrorMessage(error) };

  return {
    success: `Se esiste un account con ${email}, riceverai un'email con il link per scegliere una nuova password.`,
  };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = formData.get("password")?.toString() ?? "";
  const pwError = validatePassword(password);
  if (pwError) return { fieldErrors: { password: pwError } };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Il link è scaduto. Richiedi di nuovo il cambio password." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: authErrorMessage(error) };

  redirect("/inizio");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/accedi");
}
