import { useState } from "react";
import { Copy, ExternalLink, FileText, Mail, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@/hooks/useQuery";
import { friendlyError } from "@/lib/errors";
import { formatRelative, formatShortDate, whatsappLink } from "@/lib/format";
import { emailReport, listReports, markReportSent, prepareReport, reportLinks } from "@/services/reports";
import type { Contact } from "@/types/domain";
import type { OwnerReport, PreparedReport } from "@/types/reports";

const sentLabel = (r: OwnerReport) =>
  r.state !== "inviato" ? "Non ancora inviato" : r.sentVia === "automatico" ? "Inviato in automatico" : r.sentVia === "email" ? "Inviato per email" : "Inviato su WhatsApp";

/** Scheda immobile → Report al proprietario: prepara il PDF, invialo, guarda se l'ha aperto */
export function OwnerReportCard({ propertyId, address, owner }: { propertyId: string; address: string; owner: Contact | null }) {
  const { data, loading } = useQuery(() => listReports(propertyId), [propertyId]);
  const [open, setOpen] = useState(false);
  const last = data?.[0];

  async function openPdf(id: string) {
    // La finestra si apre subito (i telefoni bloccano quelle aperte dopo un'attesa)
    const w = window.open("", "_blank");
    try {
      const { pdf } = await reportLinks(id);
      if (pdf && w) w.location.href = pdf;
      else if (pdf) window.location.href = pdf;
    } catch (e) {
      w?.close();
      toast.error("PDF non disponibile", { description: friendlyError(e) });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Report al proprietario</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Skeleton className="h-16 w-full" />
        ) : last ? (
          <div className="rounded-lg bg-muted px-4 py-3">
            <p className="font-semibold">Ultimo report: {formatRelative(last.createdAt)}</p>
            <p className="text-[15px] text-muted-foreground">
              {sentLabel(last)}
              {last.openedAt ? ` · aperto ${last.opens > 1 ? `${last.opens} volte` : formatRelative(last.openedAt)}` : last.state === "inviato" ? " · non ancora aperto" : ""}
            </p>
          </div>
        ) : (
          <p className="text-[15px] text-muted-foreground">Un PDF con visite, impressioni dei visitatori e acquirenti interessati, da mandare al proprietario. Ogni 15 giorni parte anche da solo.</p>
        )}
        <Button size="lg" className="w-full" onClick={() => setOpen(true)}>
          <FileText aria-hidden />
          Prepara il report
        </Button>
        {data && data.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {data.slice(0, 5).map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => openPdf(r.id)} className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-muted/60">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      Dal {formatShortDate(r.from)} al {formatShortDate(r.to)}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {r.visits} {r.visits === 1 ? "visita" : "visite"} · {r.matches} acquirenti compatibili
                    </span>
                  </span>
                  <Badge tone={r.openedAt ? "green" : r.state === "inviato" ? "sky" : "gray"}>{r.openedAt ? "Aperto" : r.state === "inviato" ? "Inviato" : "Da inviare"}</Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Report al proprietario" description={address}>
          {open && <PrepareForm propertyId={propertyId} owner={owner} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function PrepareForm({ propertyId, owner, onDone }: { propertyId: string; owner: Contact | null; onDone: () => void }) {
  const [views, setViews] = useState("");
  const [contacts, setContacts] = useState("");
  const [saved, setSaved] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<PreparedReport | null>(null);
  const num = (v: string) => v.replace(/\D/g, "").slice(0, 7);

  async function create() {
    setBusy(true);
    try {
      setReady(await prepareReport(propertyId, comment.trim(), { visualizzazioni: views || undefined, contatti: contacts || undefined, preferiti: saved || undefined }));
    } catch (e) {
      toast.error("Report non creato", { description: friendlyError(e) });
    }
    setBusy(false);
  }

  if (ready) {
    const text = `Buongiorno ${owner?.firstName ?? ""}, ecco come sta andando il suo immobile: visite, impressioni dei visitatori e acquirenti interessati. Il report è qui: ${ready.link}`;
    return (
      <div className="space-y-3">
        <p className="rounded-lg bg-success/10 px-4 py-3 text-[17px] font-semibold text-success">Il report è pronto.</p>
        {ready.pdf && (
          <Button variant="outline" size="lg" className="w-full" asChild>
            <a href={ready.pdf} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden />
              Guarda il PDF
            </a>
          </Button>
        )}
        {owner?.phone && (
          <Button size="lg" className="w-full" asChild>
            <a
              href={`${whatsappLink(owner.phone)}?text=${encodeURIComponent(text)}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => markReportSent(ready.id, "whatsapp").catch(() => undefined)}
            >
              <MessageCircle aria-hidden />
              Invia su WhatsApp
            </a>
          </Button>
        )}
        {owner?.email && (
          <Button
            variant={owner.phone ? "outline" : "default"}
            size="lg"
            className="w-full"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const to = await emailReport(ready.id);
                toast.success("Report inviato", { description: `Email con il PDF allegato a ${to}` });
                onDone();
              } catch (e) {
                toast.error("Email non inviata", { description: friendlyError(e) });
                setBusy(false);
              }
            }}
          >
            <Mail aria-hidden />
            {busy ? "Invio…" : "Invia per email"}
          </Button>
        )}
        <Button
          variant="ghost"
          size="lg"
          className="w-full"
          onClick={() => navigator.clipboard.writeText(ready.link).then(() => toast.success("Link copiato")).catch(() => toast.error("Copia non riuscita"))}
        >
          <Copy aria-hidden />
          Copia il link
        </Button>
        {!owner && <p className="text-[15px] text-muted-foreground">Questo immobile non ha un proprietario nei tuoi contatti: copia il link e mandalo tu.</p>}
        <p className="text-sm text-muted-foreground">Quando il proprietario apre il report, lo vedi qui e nella sua scheda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[15px] text-muted-foreground">
        Visite, impressioni dei visitatori, acquirenti compatibili e richieste li mettiamo noi. Nel report non compaiono mai i nomi dei visitatori.
      </p>
      <fieldset>
        <legend className="mb-2 text-[15px] font-medium">Numeri dai portali (facoltativi, se il portale li mostra)</legend>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Visite all'annuncio" htmlFor="rp-v">
            <Input id="rp-v" inputMode="numeric" value={views} onChange={(e) => setViews(num(e.target.value))} />
          </Field>
          <Field label="Contatti" htmlFor="rp-c">
            <Input id="rp-c" inputMode="numeric" value={contacts} onChange={(e) => setContacts(num(e.target.value))} />
          </Field>
          <Field label="Preferiti" htmlFor="rp-s">
            <Input id="rp-s" inputMode="numeric" value={saved} onChange={(e) => setSaved(num(e.target.value))} />
          </Field>
        </div>
      </fieldset>
      <Field label="Il tuo commento (facoltativo)" htmlFor="rp-com">
        <Textarea id="rp-com" value={comment} maxLength={2000} onChange={(e) => setComment(e.target.value)} placeholder="Es. L'interesse è buono; due visitatori trovano il prezzo alto: ne parliamo?" />
      </Field>
      <Button size="lg" className="w-full" onClick={create} disabled={busy}>
        <FileText aria-hidden />
        {busy ? "Preparo il PDF…" : "Crea il PDF"}
      </Button>
    </div>
  );
}
