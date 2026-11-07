"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import { createTenantForClient, type CreateTenantState } from "@/app/piattaforma/actions";
import { slugify } from "@/lib/tenant-host";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { effectiveFeatures } from "@/lib/features";
import type { PlanWithFeatures } from "@/lib/data/platform";
import { FeatureFields } from "./feature-fields";
import { OfferFields } from "./offer-fields";
import { formatPrice } from "@/lib/utils";

/** Pulsante "Nuova azienda" con il modulo di creazione (super-admin). */
export function NewTenant({
  rootDomain,
  plans,
}: {
  rootDomain: string;
  plans: PlanWithFeatures[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<CreateTenantState, FormData>(
    createTenantForClient,
    null,
  );
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [piano, setPiano] = useState(
    plans.find((p) => p.codice === "pro")?.codice ?? plans[0]?.codice ?? "start",
  );
  const plan = plans.find((p) => p.codice === piano) ?? null;

  if (!open)
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden /> Nuova azienda
      </Button>
    );

  return (
    <Card className="w-full">
      <CardBody className="space-y-5 sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Nuova azienda</CardTitle>
          <Button variant="ghost" size="icon" aria-label="Chiudi" onClick={() => setOpen(false)}>
            <X aria-hidden />
          </Button>
        </div>
        {state?.ok ? (
          <div className="space-y-4">
            <Alert tone="success">{state.message}</Alert>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary">
                <Link href={`/piattaforma/${state.id}`}>Apri la scheda</Link>
              </Button>
              <Button variant="ghost" onClick={() => location.reload()}>
                Crea un&apos;altra azienda
              </Button>
            </div>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="nt-nome">Nome dell&apos;azienda</Label>
                <Input
                  id="nt-nome"
                  name="nome"
                  required
                  placeholder="Studio Rossi"
                  onChange={(e) => !slugTouched && setSlug(slugify(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="nt-slug">Indirizzo</Label>
                <Input
                  id="nt-slug"
                  name="slug"
                  required
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value.toLowerCase());
                  }}
                  aria-describedby="nt-slug-hint"
                />
                <p id="nt-slug-hint" className="mt-1 text-xs break-all text-ink-muted">
                  {slug || "indirizzo"}.{rootDomain}
                </p>
              </div>
              <div>
                <Label htmlFor="nt-email">Email del titolare</Label>
                <Input
                  id="nt-email"
                  name="email"
                  type="email"
                  required
                  placeholder="titolare@azienda.it"
                />
              </div>
              <div>
                <Label htmlFor="nt-piano">Piano di partenza</Label>
                <select
                  id="nt-piano"
                  name="piano"
                  value={piano}
                  onChange={(e) => setPiano(e.target.value)}
                  className="h-13 w-full rounded-md border border-line bg-surface px-3 text-[15px]"
                >
                  {plans.map((p) => (
                    <option key={p.codice} value={p.codice}>
                      {p.nome} · {formatPrice(p.prezzo_mese_cents, "EUR")}/mese
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <OfferFields />
            <FeatureFields key={piano} defaults={effectiveFeatures(plan, {})} />
            <p className="text-sm text-ink-muted">
              Il titolare diventa amministratore e riceve un&apos;email per entrare. Se non ha
              ancora un account, l&apos;email gli fa scegliere la password.
            </p>
            {state && !state.ok && <Alert>{state.error}</Alert>}
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Creo l'academy…" : "Crea l'academy"}
            </Button>
          </form>
        )}
      </CardBody>
    </Card>
  );
}
