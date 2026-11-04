import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlarmClock, Check, Home, Play, Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageHeader } from "@/components/shared/PageHeader";
import { useAuth } from "@/features/auth/AuthProvider";
import { useQuery } from "@/hooks/useQuery";
import { friendlyError } from "@/lib/errors";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { listTeam, pickerOptions } from "@/services/api";
import { createTask, deleteTask, listTasks, updateTask, type TaskScope } from "@/services/team";
import type { TeamTask } from "@/types/team";

const today = () => new Date().toLocaleDateString("sv-SE");
export const isLate = (t: TeamTask) => t.state !== "fatta" && !!t.dueDate && t.dueDate < today();

function dueLabel(d: string | null) {
  if (!d) return "Senza scadenza";
  const t = today();
  const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString("sv-SE");
  if (d === t) return "Oggi";
  if (d === tomorrow) return "Domani";
  return formatShortDate(d);
}

/** Cose da fare: le mie, quelle date ai colleghi e (per il titolare) tutta la squadra */
export function TasksPage() {
  const { agent, isOwner } = useAuth();
  const me = agent?.id ?? "";
  const [params, setParams] = useSearchParams();
  const team = useQuery(listTeam);
  const members = (team.data?.members ?? []).filter((m) => m.active);
  const agentParam = params.get("agente");
  const [scopeKind, setScopeKind] = useState<"mie" | "date_da_me" | "tutte">(agentParam && isOwner ? "tutte" : "mie");
  const [agentFilter, setAgentFilter] = useState<string>(agentParam && isOwner ? agentParam : "");
  const [done, setDone] = useState(false);
  const [editing, setEditing] = useState<TeamTask | "nuova" | null>(params.get("nuova") ? "nuova" : null);
  const scope: TaskScope = scopeKind === "tutte" && agentFilter ? { kind: "agente", id: agentFilter } : { kind: scopeKind };
  const { data, loading, error, reload } = useQuery(() => listTasks(scope, me, done), [scopeKind, agentFilter, done, me]);
  const late = (data ?? []).filter(isLate);

  async function setState(t: TeamTask, state: TeamTask["state"]) {
    try {
      await updateTask(t.id, { state });
      if (state === "fatta") toast.success("Fatto!", { description: t.title, action: { label: "Annulla", onClick: () => updateTask(t.id, { state: "da_iniziare" }) } });
    } catch (e) {
      toast.error("Non salvato", { description: friendlyError(e) });
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Cose da fare"
        subtitle="Le tue, quelle che hai dato ai colleghi e quelle della squadra"
        action={
          <Button size="lg" onClick={() => setEditing("nuova")}>
            <Plus aria-hidden />
            Nuova cosa da fare
          </Button>
        }
      />

      <Segmented
        label="Di chi"
        value={scopeKind}
        onChange={(v) => {
          setScopeKind(v);
          setAgentFilter("");
          setParams({}, { replace: true });
        }}
        className="mb-3 sm:max-w-xl"
        options={[
          { value: "mie", label: "Le mie" },
          { value: "date_da_me", label: "Date ai colleghi" },
          ...(isOwner ? [{ value: "tutte" as const, label: "Squadra" }] : []),
        ]}
      />
      {scopeKind === "tutte" && members.length > 1 && (
        <Select aria-label="Quale persona" value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} className="mb-3 sm:max-w-xs">
          <option value="">Tutta la squadra</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.firstName} {m.lastName}
            </option>
          ))}
        </Select>
      )}
      <Segmented
        label="Stato"
        value={done ? "fatte" : "aperte"}
        onChange={(v) => setDone(v === "fatte")}
        className="mb-5 sm:max-w-xs"
        options={[
          { value: "aperte", label: "Da fare" },
          { value: "fatte", label: "Fatte" },
        ]}
      />

      {!done && late.length > 0 && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[15px] font-semibold text-red-800">
          <AlarmClock className="size-5 shrink-0" aria-hidden />
          {late.length === 1 ? "1 cosa da fare è in ritardo" : `${late.length} cose da fare sono in ritardo`}
        </p>
      )}

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading || !data ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : data.length === 0 ? (
        <EmptyState
          art="fatto"
          title={done ? "Ancora nulla di fatto in questo elenco" : scopeKind === "date_da_me" ? "Non hai dato cose da fare ai colleghi" : "Niente da fare: ottimo lavoro!"}
          text={!done && scopeKind === "date_da_me" ? "Con \"Nuova cosa da fare\" puoi affidare un compito a un collega e seguirlo da qui." : undefined}
        />
      ) : (
        <ul className="space-y-2">
          {data.map((t) => (
            <TaskRow key={t.id} task={t} me={me} onState={(s) => setState(t, s)} onOpen={() => setEditing(t)} />
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent title={editing === "nuova" ? "Nuova cosa da fare" : "Cosa da fare"}>
          {editing && <TaskForm task={editing === "nuova" ? null : editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaskRow({ task: t, me, onState, onOpen }: { task: TeamTask; me: string; onState: (s: TeamTask["state"]) => void; onOpen: () => void }) {
  const late = isLate(t);
  return (
    <li className={cn("rounded-lg border bg-card shadow-card", late && "border-red-300")}>
      <button type="button" onClick={onOpen} className="block w-full p-4 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("text-[17px] font-semibold", t.state === "fatta" && "text-muted-foreground line-through")}>{t.title}</span>
          {t.priority === "alta" && t.state !== "fatta" && <Badge tone="brand">Importante</Badge>}
          {t.state === "in_corso" && <Badge tone="sky">In corso</Badge>}
          {late && <Badge tone="red">In ritardo</Badge>}
        </div>
        <p className="mt-1 text-[15px] text-muted-foreground">
          {t.state === "fatta" ? `Fatta ${t.doneAt ? formatShortDate(t.doneAt) : ""}` : dueLabel(t.dueDate)}
          {t.assigneeId !== me && t.assigneeName ? ` · per ${t.assigneeName}` : ""}
          {t.creatorId && t.creatorId !== me && t.creatorName ? ` · da ${t.creatorName}` : ""}
          {t.automatic ? " · automatica" : ""}
        </p>
        {t.note && <p className="mt-1 line-clamp-2 text-[15px]">{t.note}</p>}
      </button>
      {(t.contactId || t.propertyId) && (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {t.contactId && (
            <Link to={`/contatti/${t.contactId}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-muted px-3 text-sm font-medium">
              <UserRound className="size-4" aria-hidden />
              {t.contactName ?? "Contatto"}
            </Link>
          )}
          {t.propertyId && (
            <Link to={`/immobili/${t.propertyId}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-muted px-3 text-sm font-medium">
              <Home className="size-4" aria-hidden />
              {t.propertyLabel ?? "Immobile"}
            </Link>
          )}
        </div>
      )}
      {t.state !== "fatta" && (
        <div className="grid grid-cols-2 border-t">
          <button
            type="button"
            onClick={() => onState(t.state === "in_corso" ? "da_iniziare" : "in_corso")}
            className="flex min-h-12 items-center justify-center gap-2 border-r text-[15px] font-semibold text-muted-foreground hover:bg-muted/50"
          >
            <Play className="size-4" aria-hidden />
            {t.state === "in_corso" ? "Rimetti da iniziare" : "Inizia"}
          </button>
          <button type="button" onClick={() => onState("fatta")} className="flex min-h-12 items-center justify-center gap-2 text-[15px] font-semibold text-success hover:bg-success-soft">
            <Check className="size-5" aria-hidden />
            Fatta
          </button>
        </div>
      )}
    </li>
  );
}

function TaskForm({ task, onDone }: { task: TeamTask | null; onDone: () => void }) {
  const { agent } = useAuth();
  const team = useQuery(listTeam);
  const members = (team.data?.members ?? []).filter((m) => m.active);
  const options = useQuery(pickerOptions);
  const [title, setTitle] = useState(task?.title ?? "");
  const [assignee, setAssignee] = useState(task?.assigneeId ?? agent?.id ?? "");
  const [due, setDue] = useState(task ? (task.dueDate ?? "") : today());
  const [important, setImportant] = useState(task?.priority === "alta");
  const [note, setNote] = useState(task?.note ?? "");
  const [contactId, setContactId] = useState(task?.contactId ?? "");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return toast.error("Scrivi cosa c'è da fare");
    setBusy(true);
    try {
      if (task) await updateTask(task.id, { title, assigneeId: assignee, dueDate: due || null, priority: important ? "alta" : "normale", note });
      else await createTask({ title, assigneeId: assignee, dueDate: due || null, priority: important ? "alta" : "normale", note, contactId: contactId || null });
      const who = members.find((m) => m.id === assignee);
      toast.success(task ? "Salvato" : "Cosa da fare aggiunta", { description: who && who.id !== agent?.id ? `La trova ${who.firstName} tra le sue cose da fare.` : undefined });
      onDone();
    } catch (err) {
      toast.error("Non salvato", { description: friendlyError(err) });
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Cosa c'è da fare" htmlFor="tk-title">
        <Input id="tk-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={250} placeholder="Es. Porta le chiavi in agenzia" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Per chi" htmlFor="tk-who">
          <Select id="tk-who" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id === agent?.id ? "Per me" : `${m.firstName} ${m.lastName}`}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Entro quando" htmlFor="tk-due">
          <Input id="tk-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
      </div>
      {!task && (
        <Field label="Cliente collegato (facoltativo)" htmlFor="tk-contact">
          <Select id="tk-contact" value={contactId} onChange={(e) => setContactId(e.target.value)}>
            <option value="">Nessuno</option>
            {(options.data?.contacts ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Note (facoltative)" htmlFor="tk-note">
        <Textarea id="tk-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} className="min-h-20" />
      </Field>
      <label className="flex min-h-12 items-center gap-3 rounded-lg border bg-card px-4">
        <input type="checkbox" className="size-5 accent-[var(--color-primary)]" checked={important} onChange={(e) => setImportant(e.target.checked)} />
        <span className="text-[17px]">È importante</span>
      </label>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        <Check aria-hidden />
        {busy ? "Salvo…" : task ? "Salva" : "Aggiungi"}
      </Button>
      {task && (
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="w-full text-destructive"
          onClick={async () => {
            if (!window.confirm("Eliminare questa cosa da fare?")) return;
            try {
              await deleteTask(task.id);
              toast.success("Eliminata");
              onDone();
            } catch (err) {
              toast.error("Non eliminata", { description: friendlyError(err) });
            }
          }}
        >
          <Trash2 aria-hidden />
          Elimina
        </Button>
      )}
    </form>
  );
}
