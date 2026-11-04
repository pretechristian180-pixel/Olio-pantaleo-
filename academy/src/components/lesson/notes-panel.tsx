"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { deleteNote, saveNote } from "@/app/app/actions";
import type { Note } from "@/lib/data/student";
import { formatTimestamp } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { usePlayer } from "./player-context";

const AUTOSAVE_MS = 1200;
type Stato = "idle" | "saving" | "saved" | "error";

/**
 * Le note si salvano da sole mentre scrivi e restano legate al minuto del video
 * in cui le hai iniziate. Clic sul minuto = il video riparte da lì.
 */
export function NotesPanel({ lessonId, initial }: { lessonId: string; initial: Note[] }) {
  const { currentTime, seek } = usePlayer();
  const [notes, setNotes] = useState(initial);
  const [draft, setDraft] = useState("");
  const [draftId, setDraftId] = useState<string | undefined>();
  const [draftSec, setDraftSec] = useState(0);
  const [stato, setStato] = useState<Stato>("idle");
  const [errore, setErrore] = useState<string>();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef(Promise.resolve());
  const draftIdRef = useRef<string | undefined>(undefined);

  function onChange(value: string) {
    if (!draft && !draftId) setDraftSec(Math.floor(currentTime.current));
    setDraft(value);
    if (timer.current) clearTimeout(timer.current);
    if (!value.trim()) return;
    timer.current = setTimeout(() => persist(value), AUTOSAVE_MS);
  }

  function persist(testo: string) {
    // Un salvataggio alla volta, così la prima creazione dà l'id agli aggiornamenti successivi.
    saving.current = saving.current.then(async () => {
      setStato("saving");
      const secondo = draftId ? draftSec : draftSec || Math.floor(currentTime.current);
      const res = await saveNote({ lessonId, noteId: draftIdRef.current, secondo, testo });
      if (!res.ok) {
        setStato("error");
        setErrore(res.error);
        return;
      }
      const id = res.data!.id;
      draftIdRef.current = id;
      setDraftId(id);
      setStato("saved");
      setErrore(undefined);
      setNotes((all) => {
        const rest = all.filter((n) => n.id !== id);
        return [...rest, { id, secondo, testo, aggiornato_il: new Date().toISOString() }].sort(
          (a, b) => a.secondo - b.secondo,
        );
      });
    });
  }

  function newNote() {
    if (timer.current) clearTimeout(timer.current);
    if (draft.trim() && stato !== "saved") persist(draft);
    draftIdRef.current = undefined;
    setDraftId(undefined);
    setDraft("");
    setStato("idle");
  }

  function edit(n: Note) {
    draftIdRef.current = n.id;
    setDraftId(n.id);
    setDraftSec(n.secondo);
    setDraft(n.testo);
    setStato("saved");
  }

  async function remove(id: string) {
    const prev = notes;
    setNotes((all) => all.filter((n) => n.id !== id));
    if (draftIdRef.current === id) newNote();
    const res = await deleteNote(id);
    if (!res.ok) {
      setNotes(prev);
      setErrore(res.error);
    }
  }

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <div className="flex max-w-190 flex-col gap-4">
      <div>
        <label htmlFor="nota" className="mb-2 block text-sm font-semibold">
          Le tue note su questa lezione
          {(draft || draftId) && (
            <span className="ml-2 font-normal text-ink-muted">
              al minuto {formatTimestamp(draftSec)}
            </span>
          )}
        </label>
        <Textarea
          id="nota"
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Scrivi qui. Le note si salvano da sole e restano legate al minuto del video."
          aria-describedby="nota-stato"
        />
        <div className="mt-2 flex min-h-11 flex-wrap items-center justify-between gap-2">
          <p id="nota-stato" aria-live="polite" className="text-[13px] text-ink-muted">
            {stato === "saving" && "Salvataggio…"}
            {stato === "saved" && "Salvata"}
            {stato === "error" && <span className="text-negative">{errore}</span>}
          </p>
          {(draft || draftId) && (
            <Button variant="ghost" onClick={newNote}>
              <Plus aria-hidden /> Nuova nota
            </Button>
          )}
        </div>
      </div>
      {notes.length > 0 && (
        <ul className="flex flex-col gap-2">
          {notes.map((n) => (
            <li key={n.id} className="flex items-start gap-3 rounded-lg bg-surface-alt p-3">
              <button
                type="button"
                onClick={() => seek(n.secondo)}
                className="min-h-11 shrink-0 rounded-sm px-2 text-sm font-bold text-nexora-blue tabular-nums hover:underline"
                aria-label={`Vai al minuto ${formatTimestamp(n.secondo)}`}
              >
                {formatTimestamp(n.secondo)}
              </button>
              <button
                type="button"
                onClick={() => edit(n)}
                className="min-h-11 flex-1 py-2.5 text-left text-sm leading-5 whitespace-pre-line"
              >
                {n.testo}
              </button>
              <button
                type="button"
                onClick={() => remove(n.id)}
                aria-label="Elimina la nota"
                className="flex size-11 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-surface hover:text-negative"
              >
                <Trash2 aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
