"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage, emailSchema, fieldErrors, resetSchema } from "@/lib/validation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function ForgotPasswordForm() {
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(new FormData(e.currentTarget).get("email"));
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    setError(undefined);
    setPending(true);
    const { error: err } = await createClient().auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${location.origin}/auth/callback?next=/reimposta-password`,
    });
    setPending(false);
    if (
      err &&
      (err.code === "over_email_send_rate_limit" || err.code === "over_request_rate_limit")
    ) {
      return setError(authErrorMessage(err.code));
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-5">
        <Alert tone="success">
          Se l&apos;email è registrata ti abbiamo mandato un link per scegliere una nuova password.
          Controlla anche lo spam.
        </Alert>
        <Link
          href="/accedi"
          className="text-sm font-semibold text-nexora-blue-bright underline underline-offset-2"
        >
          Torna all&apos;accesso
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <Field id="email" label="Email" error={error}>
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
      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? "Invio in corso…" : "Mandami il link"}
      </Button>
      <Link
        href="/accedi"
        className="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-nexora-blue-bright underline underline-offset-2"
      >
        Torna all&apos;accesso
      </Link>
    </form>
  );
}

export function ResetPasswordForm({ next = "/app" }: { next?: string }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = resetSchema.safeParse({
      password: fd.get("password"),
      conferma: fd.get("conferma"),
    });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setPending(true);
    const { error } = await createClient().auth.updateUser({ password: parsed.data.password });
    setPending(false);
    if (error) {
      return setMessage(
        error.code === "session_not_found" || error.status === 401
          ? "Il link è scaduto. Chiedine uno nuovo da «Password dimenticata»."
          : authErrorMessage(error.code),
      );
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {message && <Alert>{message}</Alert>}
      <Field
        id="password"
        label="Nuova password"
        error={errors.password}
        hint="Almeno 10 caratteri."
      >
        {(a) => <Input {...a} name="password" type="password" autoComplete="new-password" />}
      </Field>
      <Field id="conferma" label="Ripeti la password" error={errors.conferma}>
        {(a) => <Input {...a} name="conferma" type="password" autoComplete="new-password" />}
      </Field>
      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? "Salvataggio…" : "Salva la nuova password"}
      </Button>
    </form>
  );
}
