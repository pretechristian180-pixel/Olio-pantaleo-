"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCourse, setCourseStatus } from "@/app/admin/corsi/actions";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function CourseStatus({
  courseId,
  stato,
}: {
  courseId: string;
  stato: "draft" | "published";
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const pubblicato = stato === "published";
  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex items-center gap-3">
        {pubblicato ? (
          <Badge tone="positive">Pubblicato</Badge>
        ) : (
          <Badge tone="neutral">Bozza</Badge>
        )}
        <Button
          variant={pubblicato ? "secondary" : "primary"}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await setCourseStatus(courseId, pubblicato ? "draft" : "published");
              if (!r.ok) setError(r.error);
              else {
                setError(undefined);
                router.refresh();
              }
            })
          }
        >
          {pubblicato ? "Rimetti in bozza" : "Pubblica il corso"}
        </Button>
      </div>
      {error && <Alert className="max-w-sm">{error}</Alert>}
    </div>
  );
}

export function DeleteCourse({ courseId, titolo }: { courseId: string; titolo: string }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-muted">
        Elimina il corso con tutte le lezioni, i video e i materiali. Non si può annullare. Se ha
        già degli iscritti, rimettilo in bozza.
      </p>
      {error && <Alert>{error}</Alert>}
      <div>
        <Button
          variant="danger"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(`Eliminare definitivamente «${titolo}»?`)) return;
            start(async () => {
              const r = await deleteCourse(courseId);
              if (r && !r.ok) setError(r.error);
            });
          }}
        >
          {pending ? "Eliminazione…" : "Elimina il corso"}
        </Button>
      </div>
    </div>
  );
}
