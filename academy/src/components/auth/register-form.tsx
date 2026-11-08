"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { rememberCookie } from "@/lib/remember";
import { cookieOptionsFor } from "@/lib/supabase/cookie-domain";
import { authErrorMessage, fieldErrors, registerSchema } from "@/lib/validation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/input";

export function RegisterForm({ next, tenantSlug }: { next: string; tenantSlug: string }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = registerSchema.safeParse({
      nome: fd.get("nome"),
      cognome: fd.get("cognome"),
      email: fd.get("email"),
      password: fd.get("password"),
      privacy: fd.get("privacy") === "on",
      marketing: fd.get("marketing") === "on",
    });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setMessage(null);
    setPending(true);
    const { nome, cognome, email, password, marketing } = parsed.data;
    const { data, error } = await createClient().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        data: {
          nome,
          cognome,
          consenso_marketing: marketing,
          tenant: tenantSlug,
        },
      },
    });
    setPending(false);
    if (error) return setMessage({ tone: "error", text: authErrorMessage(error.code) });
    if (data.session) {
      // Conferma email disattivata: sei già dentro.
      document.cookie = rememberCookie(true, cookieOptionsFor(location.host).domain);
      router.replace(next);
      router.refresh();
      return;
    }
    setMessage({
      tone: "success",
      text: `Ci siamo quasi: ti abbiamo mandato un'email a ${email}. Apri il link per confermare l'account.`,
    });
    e.currentTarget?.reset?.();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="nome" label="Nome" error={errors.nome}>
          {(a) => <Input {...a} name="nome" autoComplete="given-name" />}
        </Field>
        <Field id="cognome" label="Cognome" error={errors.cognome}>
          {(a) => <Input {...a} name="cognome" autoComplete="family-name" />}
        </Field>
      </div>
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
      <Field id="password" label="Password" error={errors.password} hint="Almeno 10 caratteri.">
        {(a) => <Input {...a} name="password" type="password" autoComplete="new-password" />}
      </Field>
      <div>
        <Checkbox
          name="privacy"
          aria-invalid={errors.privacy ? true : undefined}
          label={
            <>
              Ho letto l&apos;
              <Link
                href="/privacy"
                className="font-semibold text-nexora-blue-bright underline underline-offset-2"
              >
                informativa privacy
              </Link>{" "}
              (obbligatorio)
            </>
          }
        />
        {errors.privacy && <p className="mt-1 text-[13px] text-negative">{errors.privacy}</p>}
        <Checkbox
          name="marketing"
          label="Voglio ricevere via email consigli pratici e novità sui corsi di Christian Prete (facoltativo)"
        />
      </div>
      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? "Creazione in corso…" : "Crea il tuo account"}
      </Button>
      <p className="text-center text-sm text-ink-muted">
        Hai già un account?{" "}
        <Link
          href={`/accedi?next=${encodeURIComponent(next)}`}
          className="font-semibold text-nexora-blue-bright underline underline-offset-2"
        >
          Accedi
        </Link>
      </p>
    </form>
  );
}
