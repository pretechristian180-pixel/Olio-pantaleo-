"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { rememberCookie } from "@/lib/remember";
import { cookieOptionsFor } from "@/lib/supabase/cookie-domain";
import { authErrorMessage, emailSchema, fieldErrors, loginSchema } from "@/lib/validation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/input";

/**
 * Il login avviene dal browser: così i limiti di Supabase Auth contro i tentativi ripetuti
 * valgono per l'indirizzo IP di chi prova, non per quello del server.
 */
export function LoginForm({ next, linkError }: { next: string; linkError?: boolean }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(
    linkError
      ? { tone: "error", text: "Il link non è più valido o è già stato usato. Chiedine uno nuovo." }
      : null,
  );
  const [pending, setPending] = useState<"password" | "link" | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = loginSchema.safeParse({
      email: fd.get("email"),
      password: fd.get("password"),
      ricordami: fd.get("ricordami") === "on",
    });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setMessage(null);
    setPending("password");
    const { error } = await createClient().auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) {
      setPending(null);
      return setMessage({ tone: "error", text: authErrorMessage(error.code) });
    }
    document.cookie = rememberCookie(parsed.data.ricordami, cookieOptionsFor(location.host).domain);
    router.replace(next);
    router.refresh();
  }

  async function sendMagicLink() {
    const input = document.getElementById("email") as HTMLInputElement | null;
    const parsed = emailSchema.safeParse(input?.value ?? "");
    if (!parsed.success) {
      input?.focus();
      return setErrors({ email: parsed.error.issues[0]?.message ?? "Scrivi la tua email." });
    }
    setErrors({});
    setPending("link");
    const redirect = `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await createClient().auth.signInWithOtp({
      email: parsed.data,
      options: { emailRedirectTo: redirect, shouldCreateUser: false },
    });
    setPending(null);
    // Stesso messaggio che l'account esista o no: non riveliamo chi è registrato.
    if (
      error &&
      (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit")
    ) {
      return setMessage({ tone: "error", text: authErrorMessage(error.code) });
    }
    setMessage({
      tone: "success",
      text: "Se l'email è registrata ti abbiamo mandato un link di accesso. Aprilo da questo dispositivo.",
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <Field id="email" label="Email" error={errors.email}>
        {(a) => (
          <Input
            {...a}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="nome@azienda.it"
          />
        )}
      </Field>
      <Field id="password" label="Password" error={errors.password}>
        {(a) => (
          <Input
            {...a}
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="La tua password"
          />
        )}
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Checkbox name="ricordami" label="Ricordami" defaultChecked className="items-center" />
        <Link
          href="/password-dimenticata"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-nexora-blue-bright underline underline-offset-2 hover:text-nexora-blue-bright"
        >
          Password dimenticata?
        </Link>
      </div>
      <Button type="submit" size="lg" block disabled={pending !== null}>
        {pending === "password" ? "Accesso in corso…" : "Accedi"}
      </Button>
      <div className="flex items-center gap-3 text-[13px] text-ink-muted" aria-hidden>
        <span className="h-px flex-1 bg-line" />
        oppure
        <span className="h-px flex-1 bg-line" />
      </div>
      <Button
        type="button"
        variant="secondary"
        size="lg"
        block
        onClick={sendMagicLink}
        disabled={pending !== null}
        className="h-auto min-h-13 py-3 text-center whitespace-normal"
      >
        <Mail aria-hidden />
        {pending === "link" ? "Invio in corso…" : "Ricevi un link di accesso via email"}
      </Button>
      <p className="text-center text-sm text-ink-muted">
        Non hai ancora un account?{" "}
        <Link
          href={`/registrati?next=${encodeURIComponent(next)}`}
          className="font-semibold text-nexora-blue-bright underline underline-offset-2"
        >
          Registrati
        </Link>{" "}
        o{" "}
        <Link href="/corsi" className="font-semibold text-nexora-blue-bright underline underline-offset-2">
          guarda il catalogo
        </Link>
      </p>
    </form>
  );
}
