"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  closestCorners,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  ChevronRight,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
  Video,
  VideoOff,
} from "lucide-react";
import {
  createLesson,
  createModule,
  deleteModule,
  renameModule,
  saveProgramOrder,
} from "@/app/admin/corsi/actions";
import type { AdminLessonRow, AdminModuleRow } from "@/lib/data/admin";
import { formatTimestamp } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Mod = AdminModuleRow;
const mKey = (id: string) => `m:${id}`;
const lKey = (id: string) => `l:${id}`;

export function ProgramEditor({ courseId, initial }: { courseId: string; initial: Mod[] }) {
  const router = useRouter();
  const [modules, setModules] = useState(initial);
  const latest = useRef(initial);
  latest.current = modules;
  const [error, setError] = useState<string>();
  const [saving, start] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Se il server ha dati più recenti (dopo un'aggiunta) li prendiamo.
  const signature = initial
    .map((m) => m.id + m.titolo + m.lessons.map((l) => l.id + l.titolo).join())
    .join("|");
  const [lastSig, setLastSig] = useState(signature);
  if (signature !== lastSig) {
    setLastSig(signature);
    setModules(initial);
  }

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error);
      else {
        setError(undefined);
        router.refresh();
      }
    });

  const persist = (next: Mod[]) =>
    run(() =>
      saveProgramOrder(
        courseId,
        next.map((m) => ({ id: m.id, lessons: m.lessons.map((l) => l.id) })),
      ),
    );

  const findModuleOf = (key: string, mods: Mod[]) =>
    key.startsWith("m:")
      ? mods.find((m) => mKey(m.id) === key)
      : mods.find((m) => m.lessons.some((l) => lKey(l.id) === key));

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over || !String(active.id).startsWith("l:")) return;
    setModules((mods) => {
      const from = findModuleOf(String(active.id), mods);
      const to = findModuleOf(String(over.id), mods);
      if (!from || !to || from.id === to.id) return mods;
      const lesson = from.lessons.find((l) => lKey(l.id) === active.id)!;
      const overIndex = to.lessons.findIndex((l) => lKey(l.id) === over.id);
      const index = overIndex < 0 ? to.lessons.length : overIndex;
      return mods.map((m) =>
        m.id === from.id
          ? { ...m, lessons: m.lessons.filter((l) => l.id !== lesson.id) }
          : m.id === to.id
            ? { ...m, lessons: [...m.lessons.slice(0, index), lesson, ...m.lessons.slice(index)] }
            : m,
      );
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const a = String(active.id);
    let next = latest.current;
    if (over && a !== over.id) {
      if (a.startsWith("m:")) {
        const oi = next.findIndex((m) => mKey(m.id) === a);
        const ni = next.findIndex(
          (m) => mKey(m.id) === over.id || m.lessons.some((l) => lKey(l.id) === over.id),
        );
        if (oi >= 0 && ni >= 0) next = arrayMove(next, oi, ni);
      } else {
        const mod = findModuleOf(a, next);
        if (mod) {
          const oi = mod.lessons.findIndex((l) => lKey(l.id) === a);
          const ni = mod.lessons.findIndex((l) => lKey(l.id) === over.id);
          if (oi >= 0 && ni >= 0)
            next = next.map((m) =>
              m.id === mod.id ? { ...m, lessons: arrayMove(m.lessons, oi, ni) } : m,
            );
        }
      }
    }
    setModules(next);
    const before = JSON.stringify(initial.map((m) => [m.id, m.lessons.map((l) => l.id)]));
    const after = JSON.stringify(next.map((m) => [m.id, m.lessons.map((l) => l.id)]));
    if (before !== after) persist(next);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-muted">
        Trascina moduli e lezioni dalla maniglia{" "}
        <GripVertical aria-hidden className="inline size-4" /> per cambiarne l&apos;ordine. Da
        tastiera: Tab sulla maniglia, Spazio per prendere, frecce per spostare, Spazio per lasciare.
      </p>
      {error && <Alert>{error}</Alert>}
      <p aria-live="polite" className="sr-only">
        {saving ? "Salvataggio in corso" : ""}
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={modules.map((m) => mKey(m.id))}
          strategy={verticalListSortingStrategy}
        >
          <ol className="flex flex-col gap-4">
            {modules.map((m, i) => (
              <ModuleCard key={m.id} courseId={courseId} mod={m} numero={i + 1} run={run} />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <AddInline
        label="Nuovo modulo"
        placeholder="Titolo del modulo"
        onAdd={(t) => run(() => createModule(courseId, t))}
      />
    </div>
  );
}

function ModuleCard({
  courseId,
  mod,
  numero,
  run,
}: {
  courseId: string;
  mod: Mod;
  numero: number;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: mKey(mod.id),
  });
  const [editing, setEditing] = useState(false);
  const [titolo, setTitolo] = useState(mod.titolo);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-lg border border-line bg-surface ${isDragging ? "relative z-10 shadow-lg" : ""}`}
    >
      <div className="flex items-center gap-2 border-b border-line p-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Sposta il modulo ${numero}: ${mod.titolo}`}
          className="flex size-11 shrink-0 cursor-grab items-center justify-center rounded-md text-ink-muted hover:bg-surface-alt"
        >
          <GripVertical aria-hidden className="size-5" />
        </button>
        {editing ? (
          <form
            className="flex flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => renameModule(courseId, mod.id, titolo));
              setEditing(false);
            }}
          >
            <Input
              aria-label="Titolo del modulo"
              value={titolo}
              onChange={(e) => setTitolo(e.target.value)}
              autoFocus
              className="h-11"
            />
            <Button type="submit" size="icon" aria-label="Salva il titolo">
              <Check aria-hidden />
            </Button>
          </form>
        ) : (
          <div className="flex-1">
            <p className="eyebrow text-[11px] text-nexora-blue-bright">Modulo {numero}</p>
            <h3 className="font-semibold">{mod.titolo}</h3>
          </div>
        )}
        {!editing && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Rinomina il modulo ${numero}`}
            onClick={() => setEditing(true)}
          >
            <Pencil aria-hidden />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Elimina il modulo ${numero}`}
          onClick={() =>
            window.confirm(`Eliminare il modulo «${mod.titolo}»?`) &&
            run(() => deleteModule(courseId, mod.id))
          }
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
      <SortableContext
        items={mod.lessons.map((l) => lKey(l.id))}
        strategy={verticalListSortingStrategy}
      >
        <ul className="flex min-h-12 flex-col p-2">
          {mod.lessons.map((l) => (
            <LessonRow key={l.id} courseId={courseId} lesson={l} />
          ))}
          {mod.lessons.length === 0 && (
            <li className="px-3 py-3 text-sm text-ink-muted">
              Nessuna lezione: aggiungine una o trascinala qui.
            </li>
          )}
        </ul>
      </SortableContext>
      <div className="border-t border-line p-3">
        <AddInline
          label="Nuova lezione"
          placeholder="Titolo della lezione"
          onAdd={(t) => run(() => createLesson(courseId, mod.id, t))}
        />
      </div>
    </li>
  );
}

function LessonRow({ courseId, lesson }: { courseId: string; lesson: AdminLessonRow }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lKey(lesson.id),
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-md bg-surface ${isDragging ? "relative z-10 shadow-md" : ""}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Sposta la lezione ${lesson.titolo}`}
        className="flex size-11 shrink-0 cursor-grab items-center justify-center rounded-md text-ink-muted hover:bg-surface-alt"
      >
        <GripVertical aria-hidden className="size-4" />
      </button>
      <Link
        href={`/admin/corsi/${courseId}/lezioni/${lesson.id}`}
        className="flex min-h-11 flex-1 items-center gap-3 rounded-md px-2 text-sm hover:bg-surface-alt"
      >
        {lesson.bunny_video_id ? (
          <Video aria-label="Video caricato" className="size-4 shrink-0 text-positive" />
        ) : (
          <VideoOff aria-label="Video da caricare" className="size-4 shrink-0 text-ink-muted" />
        )}
        <span className="flex-1">{lesson.titolo}</span>
        {lesson.is_free_preview && <Badge>Gratis</Badge>}
        <span className="w-12 text-right text-xs text-ink-muted tabular-nums">
          {lesson.durata_sec ? formatTimestamp(lesson.durata_sec) : "—"}
        </span>
        <ChevronRight aria-hidden className="size-4 text-ink-muted" />
      </Link>
    </li>
  );
}

function AddInline({
  label,
  placeholder,
  onAdd,
}: {
  label: string;
  placeholder: string;
  onAdd: (titolo: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [titolo, setTitolo] = useState("");
  if (!open) {
    return (
      <div>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          <Plus aria-hidden /> {label}
        </Button>
      </div>
    );
  }
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (titolo.trim().length < 2) return;
        onAdd(titolo);
        setTitolo("");
        setOpen(false);
      }}
    >
      <Input
        aria-label={label}
        placeholder={placeholder}
        value={titolo}
        onChange={(e) => setTitolo(e.target.value)}
        autoFocus
        className="h-11"
      />
      <div className="flex gap-2">
        <Button type="submit">Aggiungi</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Annulla
        </Button>
      </div>
    </form>
  );
}
