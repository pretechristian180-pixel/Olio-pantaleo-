"use client";

import { useActionState, useState } from "react";
import { updateBrand, type BrandState } from "@/app/admin/actions";
import { contrast, readablePrimary } from "@/lib/brand";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";

type Values = {
  nome: string;
  logo_text: string;
  logo_url: string;
  tagline: string;
  primary: string;
  dark: string;
};

export function BrandForm({ initial }: { initial: Values }) {
  const [state, action, pending] = useActionState<BrandState, FormData>(updateBrand, null);
  const [v, setV] = useState(initial);
  const fields = state && !state.ok ? (state.fields ?? {}) : {};
  const valido = (c: string) => /^#[0-9a-f]{6}$/i.test(c);
  const primaryUsato = valido(v.primary) ? readablePrimary(v.primary) : initial.primary;
  const corretto = valido(v.primary) && primaryUsato !== v.primary.toLowerCase();
  const darkOk = valido(v.dark) && contrast(v.dark, "#ffffff") >= 7;
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV({ ...v, [k]: e.target.value });

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <form action={action} className="flex flex-col gap-5">
        {state?.ok && (
          <Alert tone="success">Marchio salvato: lo vedi già su tutta la tua academy.</Alert>
        )}
        {state && !state.ok && <Alert>{state.error}</Alert>}
        <Field id="nome" label="Nome dell'academy" error={fields.nome}>
          {(a) => <Input {...a} name="nome" value={v.nome} onChange={set("nome")} />}
        </Field>
        <Field
          id="logo_text"
          label="Testo del logo"
          error={fields.logo_text}
          hint="Usato se non carichi un'immagine. Meglio corto, in maiuscolo."
        >
          {(a) => (
            <Input
              {...a}
              name="logo_text"
              value={v.logo_text}
              onChange={set("logo_text")}
              maxLength={24}
            />
          )}
        </Field>
        <Field
          id="logo_url"
          label="Logo (indirizzo dell'immagine)"
          error={fields.logo_url}
          hint="Facoltativo. PNG o SVG su fondo trasparente, indirizzo https://. Il caricamento diretto arriva a breve."
        >
          {(a) => (
            <Input
              {...a}
              name="logo_url"
              value={v.logo_url}
              onChange={set("logo_url")}
              placeholder="https://…"
            />
          )}
        </Field>
        <Field
          id="tagline"
          label="Frase della home"
          error={fields.tagline}
          hint="Es. «Impara a gestire il tuo studio con metodo». Facoltativa."
        >
          {(a) => (
            <Input
              {...a}
              name="tagline"
              value={v.tagline}
              onChange={set("tagline")}
              maxLength={120}
            />
          )}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <ColorField
            id="primary"
            label="Colore principale"
            value={v.primary}
            onChange={set("primary")}
            error={fields.primary}
          />
          <ColorField
            id="dark"
            label="Colore scuro (sfondi)"
            value={v.dark}
            onChange={set("dark")}
            error={fields.dark}
          />
        </div>
        {corretto && (
          <p className="text-[13px] text-ink-muted">
            Il colore scelto è troppo chiaro per il testo bianco dei pulsanti: useremo{" "}
            {primaryUsato}, la versione leggibile più vicina.
          </p>
        )}
        {valido(v.dark) && !darkOk && (
          <p className="text-[13px] text-negative">
            Il colore scuro è troppo chiaro per il testo bianco: scegline uno più scuro, altrimenti
            useremo quello predefinito.
          </p>
        )}
        <div>
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Salvataggio…" : "Salva il marchio"}
          </Button>
        </div>
      </form>
      <aside
        aria-label="Anteprima"
        className="self-start overflow-hidden rounded-lg border border-line"
      >
        <div className="p-5" style={{ background: darkOk ? v.dark : "#1d2124" }}>
          <p className="font-display text-lg text-white">{v.logo_text.toUpperCase() || "LOGO"}</p>
          <p className="mt-6 text-sm text-white/80">{v.tagline || "La frase della tua home"}</p>
        </div>
        <div className="flex flex-col gap-3 bg-surface p-5">
          <span
            className="inline-flex h-11 items-center justify-center rounded-md text-sm font-semibold text-white"
            style={{ background: primaryUsato }}
          >
            Acquista il corso
          </span>
          <span className="h-2 w-full overflow-hidden rounded-full bg-blue-tint">
            <span
              className="block h-full w-2/3 rounded-full"
              style={{ background: primaryUsato }}
            />
          </span>
        </div>
      </aside>
    </div>
  );
}

function ColorField({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <input
          type="color"
          aria-label={`${label}: selettore`}
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
          onChange={onChange}
          className="h-13 w-14 shrink-0 cursor-pointer rounded-md border border-line bg-surface p-1"
        />
        <Input
          id={id}
          name={id}
          value={value}
          onChange={onChange}
          aria-invalid={error ? true : undefined}
        />
      </div>
      {error && <p className="mt-1.5 text-[13px] text-negative">{error}</p>}
    </div>
  );
}
