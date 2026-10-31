import { useState } from "react";
import { ChevronDown, MessageSquareQuote, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@/hooks/useQuery";
import { friendlyError } from "@/lib/errors";
import { formatPrice, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getVisitFeedback, listVisitFeedback, saveVisitFeedback } from "@/services/records";
import type { PriceOpinion, VisitFeedback, VisitIntent } from "@/types/records";
import { intentLabel, priceOpinionLabel } from "./labels";

type Visit = { appointmentId: string; contactId: string | null; propertyId: string | null; title: string };

/** "Com'è andata?": le impressioni del cliente dopo la visita, in pochi tocchi */
export function VisitFeedbackDialog({ visit, open, onOpenChange }: { visit: Visit; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Com'è andata la visita?" description={visit.title}>
        {open && <FeedbackLoader visit={visit} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function FeedbackLoader({ visit, onDone }: { visit: Visit; onDone: () => void }) {
  const { data, loading } = useQuery(() => getVisitFeedback(visit.appointmentId), [visit.appointmentId]);
  if (loading) return <Skeleton className="h-80" />;
  return <FeedbackForm visit={visit} existing={data ?? undefined} onDone={onDone} />;
}

function Choice<T extends string>({ value, options, onChange, label }: { value: T | null; options: Record<T, string>; onChange: (v: T) => void; label: string }) {
  return (
    <fieldset>
      <legend className="mb-2 text-[15px] font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(options) as T[]).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={value === k}
            onClick={() => onChange(k)}
            className={cn(
              "h-11 rounded-full border px-4 text-[15px] font-medium",
              value === k ? "border-primary bg-primary text-white" : "bg-card text-foreground/80",
            )}
          >
            {options[k]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function FeedbackForm({ visit, existing, onDone }: { visit: Visit; existing?: VisitFeedback; onDone: () => void }) {
  const [f, setF] = useState({
    liked: existing?.liked ?? "",
    disliked: existing?.disliked ?? "",
    price: (existing?.priceOpinion ?? null) as PriceOpinion | null,
    offer: existing?.offer != null ? String(existing.offer) : "",
    intent: (existing?.intent ?? null) as VisitIntent | null,
    issues: existing?.issues ?? "",
    other: existing?.otherProperties ?? "",
    rating: existing?.rating ?? null,
  });
  const [more, setMore] = useState(Boolean(existing?.issues || existing?.otherProperties || existing?.rating));
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.intent) return toast.error("Indica come vuole procedere il cliente");
    setBusy(true);
    try {
      const offer = Number(f.offer.replace(/[^\d]/g, ""));
      await saveVisitFeedback(
        {
          appointmentId: visit.appointmentId,
          contactId: visit.contactId,
          propertyId: visit.propertyId,
          rating: f.rating,
          liked: f.liked,
          disliked: f.disliked,
          issues: f.issues,
          priceOpinion: f.price,
          offer: offer || null,
          intent: f.intent,
          otherProperties: f.other,
        },
        existing?.id,
      );
      toast.success("Impressioni salvate", {
        description: f.intent === "proposta" ? "Ti abbiamo messo tra le cose da fare: prepara la proposta." : "Le trovi nella scheda del cliente e dell'immobile.",
      });
      onDone();
    } catch (err) {
      toast.error("Non salvate", { description: friendlyError(err) });
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <Choice label="Come vuole procedere?" value={f.intent} options={intentLabel} onChange={(v) => setF((x) => ({ ...x, intent: v }))} />
      <Field label="Cosa gli è piaciuto" htmlFor="fb-liked">
        <Input id="fb-liked" value={f.liked} onChange={(e) => setF((x) => ({ ...x, liked: e.target.value }))} placeholder="Es. luce, terrazzo, zona" />
      </Field>
      <Field label="Cosa non gli è piaciuto" htmlFor="fb-disliked">
        <Input id="fb-disliked" value={f.disliked} onChange={(e) => setF((x) => ({ ...x, disliked: e.target.value }))} placeholder="Es. bagno piccolo, piano basso" />
      </Field>
      <Choice label="Il prezzo gli sembra" value={f.price} options={priceOpinionLabel} onChange={(v) => setF((x) => ({ ...x, price: v }))} />
      <Field label="Quanto offrirebbe (€)" htmlFor="fb-offer" hint="Facoltativo">
        <Input id="fb-offer" inputMode="numeric" value={f.offer} onChange={(e) => setF((x) => ({ ...x, offer: e.target.value }))} />
      </Field>

      <button type="button" onClick={() => setMore((m) => !m)} className="flex h-11 items-center gap-1.5 font-semibold text-primary-strong" aria-expanded={more}>
        <ChevronDown className={cn("size-5 transition-transform", more && "rotate-180")} aria-hidden />
        Altri dettagli
      </button>
      {more && (
        <div className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-[15px] font-medium">Voto complessivo</legend>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} su 5`}
                  aria-pressed={f.rating === n}
                  onClick={() => setF((x) => ({ ...x, rating: n }))}
                  className="flex size-11 items-center justify-center rounded-lg"
                >
                  <Star className={cn("size-7", f.rating && n <= f.rating ? "fill-primary text-primary" : "text-border")} aria-hidden />
                </button>
              ))}
            </div>
          </fieldset>
          <Field label="Criticità emerse" htmlFor="fb-issues">
            <Textarea id="fb-issues" className="min-h-20" value={f.issues} onChange={(e) => setF((x) => ({ ...x, issues: e.target.value }))} placeholder="Es. umidità in cantina, rumore dalla strada" />
          </Field>
          <Field label="Altri immobili che vorrebbe vedere" htmlFor="fb-other">
            <Input id="fb-other" value={f.other} onChange={(e) => setF((x) => ({ ...x, other: e.target.value }))} />
          </Field>
        </div>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? "Salvataggio…" : "Salva le impressioni"}
      </Button>
    </form>
  );
}

/** Riepilogo delle visite di un immobile: utile al proprietario e per decidere sul prezzo */
export function FeedbackSummaryCard({ propertyId, contactId }: { propertyId?: string; contactId?: string }) {
  const { data, loading } = useQuery(() => listVisitFeedback({ propertyId, contactId }), [propertyId, contactId]);
  if (loading) return <Skeleton className="h-32" />;
  if (!data?.length) return null;
  const offers = data.map((d) => d.offer).filter((o): o is number => o != null);
  const prices = { basso: 0, giusto: 0, alto: 0 } as Record<PriceOpinion, number>;
  data.forEach((d) => d.priceOpinion && prices[d.priceOpinion]++);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{propertyId ? "Cosa dicono i visitatori" : "Impressioni dopo le visite"}</CardTitle>
        <span className="text-muted-foreground">{data.length === 1 ? "1 visita" : `${data.length} visite`}</span>
      </CardHeader>
      <CardContent className="space-y-4">
        {propertyId && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted px-4 py-3">
              <p className="text-sm text-muted-foreground">Prezzo giudicato alto</p>
              <p className="text-xl font-bold tabular-nums">
                {prices.alto} su {data.filter((d) => d.priceOpinion).length || 0}
              </p>
            </div>
            <div className="rounded-lg bg-muted px-4 py-3">
              <p className="text-sm text-muted-foreground">Offerta più alta</p>
              <p className="text-xl font-bold tabular-nums">{offers.length ? formatPrice(Math.max(...offers)) : "–"}</p>
            </div>
          </div>
        )}
        <ul className="space-y-3">
          {data.slice(0, 5).map((d) => (
            <li key={d.id} className="rounded-lg border p-3">
              <p className="flex items-center gap-2 text-[15px] text-muted-foreground">
                <MessageSquareQuote className="size-4" aria-hidden />
                {propertyId ? d.contactName ?? "Cliente" : "Visita"} · {formatRelative(d.createdAt)}
                {d.intent && <span className="font-semibold text-foreground">· {intentLabel[d.intent]}</span>}
              </p>
              {d.liked && <p className="mt-1"><span className="font-medium text-success">Piaciuto:</span> {d.liked}</p>}
              {d.disliked && <p><span className="font-medium text-warning">Non piaciuto:</span> {d.disliked}</p>}
              {d.issues && <p><span className="font-medium">Criticità:</span> {d.issues}</p>}
              {(d.priceOpinion || d.offer != null) && (
                <p className="text-[15px] text-muted-foreground">
                  {d.priceOpinion && `Prezzo: ${priceOpinionLabel[d.priceOpinion].toLowerCase()}`}
                  {d.offer != null && ` · offrirebbe ${formatPrice(d.offer)}`}
                </p>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
