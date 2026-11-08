"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { createAcademy, type CreateState } from "@/app/(public)/crea-academy/actions";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/tenant-host";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/input";

type Disp = "idle" | "checking" | "ok" | "taken";

export function CreateAcademyForm({
  rootDomain,
  piani,
  pianoIniziale,
}: {
  rootDomain: string;
  piani: { codice: string; nome: string; prezzo: string }[];
  pianoIniziale: string;
}) {
  const [state, action, pending] = useActionState<CreateState, FormData>(createAcademy, null);
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [slugToccato, setSlugToccato] = useState(false);
  const [disp, setDisp] = useState<Disp>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (slug.length < 3) return setDisp("idle");
    setDisp("checking");
    timer.current = setTimeout(async () => {
      const { data } = await createClient().rpc("slug_disponibile", { p_slug: slug });
      setDisp(data ? "ok" : "taken");
    }, 400);
  }, [slug]);

  useEffect(() => {
    if (state?.ok && state.url) window.location.assign(state.url);
  }, [state]);

  if (state?.ok) {
    return (
      <Alert tone="success">
        La tua academy è pronta.{" "}
        {state.url ? (
          <>Ti stiamo portando al pannello…</>
        ) : (
          <>
            Su questo indirizzo di anteprima i sottodomini non funzionano: la trovi su{" "}
            <strong>
              {state.slug}.{rootDomain}
            </strong>
            .
          </>
        )}
      </Alert>
    );
  }

  const fields = state && !state.ok ? (state.fields ?? {}) : {};
  return (
    <form action={action} className="flex flex-col gap-6">
      {state && !state.ok && <Alert>{state.error}</Alert>}
      <Field id="nome" label="Nome della tua academy" error={fields.nome}>
        {(a) => (
          <Input
            {...a}
            name="nome"
            value={nome}
            maxLength={120}
            placeholder="Es. Academy Studio Rossi"
            onChange={(e) => {
              setNome(e.target.value);
              if (!slugToccato) setSlug(slugify(e.target.value));
            }}
          />
        )}
      </Field>
      <Field
        id="slug"
        label="Indirizzo"
        error={
          fields.slug ?? (disp === "taken" ? "Questo indirizzo non è disponibile." : undefined)
        }
        hint={
          disp === "ok"
            ? "Disponibile."
            : "Lettere minuscole, numeri e trattini. Potrai collegare il tuo dominio nei piani Pro e Business."
        }
      >
        {(a) => (
          <div className="flex items-stretch overflow-hidden rounded-md border border-line focus-within:border-nexora-blue">
            <input
              {...a}
              name="slug"
              value={slug}
              maxLength={30}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => {
                setSlugToccato(true);
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
              }}
              className="h-13 min-w-0 flex-1 bg-surface px-4 text-[15px] focus:outline-none"
            />
            <span className="flex items-center bg-surface-alt px-3 text-[13px] text-ink-muted">
              .{rootDomain}
            </span>
          </div>
        )}
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Piano dopo la prova</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {piani.map((p) => (
            <label
              key={p.codice}
              className={cn(
                "flex min-h-11 cursor-pointer flex-col rounded-md border border-line p-4 has-[:checked]:border-nexora-blue has-[:checked]:bg-blue-tint",
              )}
            >
              <input
                type="radio"
                name="piano"
                value={p.codice}
                defaultChecked={p.codice === pianoIniziale}
                className="sr-only"
              />
              <span className="font-semibold">{p.nome}</span>
              <span className="text-[13px] text-ink-muted">{p.prezzo} / mese</span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-ink-muted">
          14 giorni gratis, senza carta. Puoi cambiare piano quando vuoi.
        </p>
      </fieldset>
      <div>
        <Checkbox
          name="termini"
          label={
            <>
              Accetto le{" "}
              <Link
                href="/condizioni-servizio"
                className="font-semibold text-nexora-blue-bright underline underline-offset-2"
              >
                condizioni del servizio
              </Link>{" "}
              e l&apos;
              <Link
                href="/dpa"
                className="font-semibold text-nexora-blue-bright underline underline-offset-2"
              >
                accordo sul trattamento dei dati
              </Link>
            </>
          }
        />
        {fields.termini && <p className="mt-1 text-[13px] text-negative">{fields.termini}</p>}
      </div>
      <div>
        <Button
          type="submit"
          size="lg"
          disabled={pending || disp === "taken" || disp === "checking"}
        >
          {pending ? "Creazione in corso…" : "Crea la mia academy"}
        </Button>
      </div>
    </form>
  );
}
