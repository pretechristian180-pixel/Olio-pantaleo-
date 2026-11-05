"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage, fieldErrors, resetSchema } from "@/lib/validation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

/** Cambio password da utente collegato, senza passare dall'email. */
export function PasswordForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const parsed = resetSchema.safeParse({
      password: fd.get("password"),
      conferma: fd.get("conferma"),
    });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setPending(true);
    const { error } = await createClient().auth.updateUser({ password: parsed.data.password });
    setPending(false);
    if (error) return setMsg({ tone: "error", text: authErrorMessage(error.code) });
    form.reset();
    setMsg({ tone: "success", text: "Password aggiornata." });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-140 flex-col gap-5">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="nuova-password"
          label="Nuova password"
          error={errors.password}
          hint="Almeno 10 caratteri."
        >
          {(a) => <Input {...a} name="password" type="password" autoComplete="new-password" />}
        </Field>
        <Field id="conferma-password" label="Ripeti la password" error={errors.conferma}>
          {(a) => <Input {...a} name="conferma" type="password" autoComplete="new-password" />}
        </Field>
      </div>
      <div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Salvataggio…" : "Cambia password"}
        </Button>
      </div>
    </form>
  );
}
