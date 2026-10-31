import { useRef, useState } from "react";
import { ExternalLink, FileText, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@/hooks/useQuery";
import { friendlyError } from "@/lib/errors";
import { formatShortDate } from "@/lib/format";
import { deleteDocument, documentUrl, listDocuments, uploadDocument } from "@/services/records";
import type { DocCategory, DocumentItem, RecordRef } from "@/types/records";
import { daysTo, docCategoryLabel } from "./labels";

const MAX_MB = 20;

/** Archivio documenti di un contatto, immobile, trattativa o acquisizione */
export function DocumentsCard({ recordRef, title = "Documenti", canEdit = true }: { recordRef: RecordRef; title?: string; canEdit?: boolean }) {
  const { data, loading } = useQuery(() => listDocuments(recordRef), [JSON.stringify(recordRef)]);
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <Upload aria-hidden />
            Carica
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading || !data ? (
          <Skeleton className="h-16" />
        ) : data.length === 0 ? (
          <p className="text-muted-foreground">Nessun documento. Carica qui visure, planimetrie, incarichi, proposte e contratti.</p>
        ) : (
          <ul className="divide-y">
            {data.map((d) => (
              <DocumentRow key={d.id} doc={d} canEdit={canEdit} />
            ))}
          </ul>
        )}
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Carica un documento" description={`PDF, foto, Word o Excel, fino a ${MAX_MB} MB.`}>
          {open && <UploadForm recordRef={recordRef} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function ExpiryBadge({ date }: { date: string }) {
  const d = daysTo(date);
  if (d < 0) return <Badge tone="red">Scaduto il {formatShortDate(date)}</Badge>;
  if (d <= 30) return <Badge tone="orange">Scade il {formatShortDate(date)}</Badge>;
  return <span className="text-sm text-muted-foreground">Scade il {formatShortDate(date)}</span>;
}

function DocumentRow({ doc, canEdit }: { doc: DocumentItem; canEdit: boolean }) {
  async function open() {
    const url = await documentUrl(doc.path);
    if (url) window.open(url, "_blank", "noopener");
    else toast.error("Documento non disponibile");
  }
  async function remove() {
    if (!window.confirm(`Eliminare "${doc.name}"?`)) return;
    try {
      await deleteDocument(doc);
      toast.success("Documento eliminato");
    } catch (err) {
      toast.error("Non eliminato", { description: friendlyError(err) });
    }
  }
  return (
    <li className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
      <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{doc.name}</p>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {docCategoryLabel[doc.category]}
          {doc.expiresOn && <ExpiryBadge date={doc.expiresOn} />}
        </p>
      </div>
      <Button variant="ghost" size="sm" onClick={open}>
        <ExternalLink aria-hidden />
        Apri
      </Button>
      {canEdit && (
        <Button variant="ghost" size="sm" className="text-destructive" onClick={remove}>
          <Trash2 aria-hidden />
          Elimina
        </Button>
      )}
    </li>
  );
}

function UploadForm({ recordRef, onDone }: { recordRef: RecordRef; onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<DocCategory>("altro");
  const [expires, setExpires] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast.error("Scegli il file");
    if (file.size > MAX_MB * 1024 * 1024) return toast.error(`Il file supera i ${MAX_MB} MB`);
    setBusy(true);
    try {
      await uploadDocument(recordRef, file, { category, name: name || file.name, expiresOn: expires || null });
      toast.success("Documento caricato");
      onDone();
    } catch (err) {
      toast.error("Documento non caricato", { description: friendlyError(err) });
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <input
        ref={input}
        type="file"
        className="hidden"
        accept=".pdf,image/*,.doc,.docx,.xls,.xlsx"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          setFile(f);
          if (f && !name) setName(f.name.replace(/\.[^.]+$/, ""));
        }}
      />
      <Button type="button" variant="outline" size="lg" className="w-full" onClick={() => input.current?.click()}>
        <Upload aria-hidden />
        {file ? file.name : "Scegli il file o scatta una foto"}
      </Button>
      <Field label="Nome" htmlFor="up-name">
        <Input id="up-name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo di documento" htmlFor="up-cat">
          <Select id="up-cat" value={category} onChange={(e) => setCategory(e.target.value as DocCategory)}>
            {(Object.keys(docCategoryLabel) as DocCategory[]).map((c) => (
              <option key={c} value={c}>
                {docCategoryLabel[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Scadenza (facoltativa)" htmlFor="up-exp">
          <Input id="up-exp" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
        </Field>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? "Caricamento…" : "Carica il documento"}
      </Button>
    </form>
  );
}
