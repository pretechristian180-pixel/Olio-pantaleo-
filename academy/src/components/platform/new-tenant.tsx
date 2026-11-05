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

const PIANI = [
  { codice: "start", nome: "Start · 29 €" },
  { codice: "pro", nome: "Pro · 59 €" },
  { codice: "business", nome: "Business · 129 €" },
];

/** Pulsante "Nuova azienda" con il modulo di creazione (super-admin). */
export function NewTenant({ rootDomain }: { rootDomain: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<CreateTenantState, FormData>(
    createTenantForClient,
    null,
  );
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="nt-piano">Piano</Label>
                  <select
                    id="nt-piano"
                    name="piano"
                    defaultValue="pro"
                    className="h-13 w-full rounded-md border border-line bg-surface px-3 text-[15px]"
                  >
                    {PIANI.map((p) => (
                      <option key={p.codice} value={p.codice}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="nt-giorni">Giorni di prova</Label>
                  <Input
                    id="nt-giorni"
                    name="giorni"
                    type="number"
                    min={1}
                    max={365}
                    defaultValue={14}
                    required
                  />
                </div>
              </div>
            </div>
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
