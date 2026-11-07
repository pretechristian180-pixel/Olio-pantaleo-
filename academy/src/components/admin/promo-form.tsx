"use client";

import { useActionState, useState } from "react";
import { updatePromo, type PromoState } from "@/app/admin/actions";
import type { Promo } from "@/lib/promo";
import { PromoBox } from "@/components/student/promo-box";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";

/** Modulo del riquadro nell'area studenti, con anteprima dal vivo. */
export function PromoForm({ initial }: { initial: Promo }) {
  const [state, action, pending] = useActionState<PromoState, FormData>(updatePromo, null);
  const [p, setP] = useState(initial);
  const set = (k: keyof Promo) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setP({ ...p, [k]: k === "attivo" ? (e.target as HTMLInputElement).checked : e.target.value });
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_260px]">
      <form action={action} className="space-y-4">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            name="attivo"
            checked={p.attivo}
            onChange={set("attivo")}
            className="size-5 accent-nexora-blue"
          />
          Mostra il riquadro agli studenti
        </label>
        <div>
          <Label htmlFor="promo-sopra">Titoletto</Label>
          <Input
            id="promo-sopra"
            name="sopratitolo"
            maxLength={40}
            value={p.sopratitolo}
            onChange={set("sopratitolo")}
            placeholder="Consulenza"
          />
        </div>
        <div>
          <Label htmlFor="promo-testo">Testo</Label>
          <Textarea
            id="promo-testo"
            name="testo"
            maxLength={200}
            rows={3}
            value={p.testo}
            onChange={set("testo")}
            placeholder="Vuoi mettere in pratica il corso nella tua attività? Prenota una consulenza."
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="promo-pulsante">Testo del pulsante</Label>
            <Input
              id="promo-pulsante"
              name="pulsante"
              maxLength={30}
              value={p.pulsante}
              onChange={set("pulsante")}
              placeholder="Prenota la consulenza"
            />
          </div>
          <div>
            <Label htmlFor="promo-link">Link del pulsante</Label>
            <Input
              id="promo-link"
              name="link"
              value={p.link}
              onChange={set("link")}
              placeholder="https://calendly.com/…"
            />
          </div>
        </div>
        <p className="text-xs text-ink-muted">
          Il link può essere il tuo calendario (Calendly, Google Calendar), una pagina del tuo sito,
          WhatsApp (https://wa.me/39…), un&apos;email (mailto:…) o un telefono (tel:…).
        </p>
        {state && (
          <Alert tone={state.ok ? "success" : "error"}>
            {state.ok ? "Salvato: gli studenti lo vedono subito." : state.error}
          </Alert>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Salvo…" : "Salva il riquadro"}
        </Button>
      </form>
      <div>
        <p className="mb-2 text-sm text-ink-muted">Anteprima</p>
        <div className="rounded-lg bg-graphite-deep p-4">
          {p.attivo && p.testo ? (
            <PromoBox promo={{ ...p, link: p.link.trim() ? p.link : "" }} />
          ) : (
            <p className="text-sm text-ink-inverse-muted">Riquadro spento.</p>
          )}
        </div>
      </div>
    </div>
  );
}
