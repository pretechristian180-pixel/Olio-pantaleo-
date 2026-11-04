"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, ChevronRight } from "lucide-react";
import { markLessonComplete } from "@/app/app/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LessonActions({
  lessonId,
  completata,
  nextHref,
}: {
  lessonId: string;
  completata: boolean;
  nextHref: string | null;
}) {
  const router = useRouter();
  const [done, setDone] = useState(completata);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function toggle() {
    const value = !done;
    setDone(value);
    setError(undefined);
    start(async () => {
      const res = await markLessonComplete(lessonId, value);
      if (!res.ok) {
        setDone(!value);
        setError(res.error);
      } else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3 sm:flex">
        <Button
          variant="secondary"
          size="lg"
          onClick={toggle}
          disabled={pending}
          aria-pressed={done}
          className={cn(done && "border-positive")}
        >
          <Check aria-hidden className="text-positive" />
          <span className="sm:hidden">{done ? "Completata" : "Completa"}</span>
          <span className="hidden sm:inline">{done ? "Completata" : "Segna come completata"}</span>
        </Button>
        {nextHref ? (
          <Button asChild size="lg">
            <Link href={nextHref}>
              <span className="sm:hidden">Successiva</span>
              <span className="hidden sm:inline">Lezione successiva</span>
              <ChevronRight aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button asChild size="lg" variant="dark">
            <Link href="/app">Torna alla dashboard</Link>
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-[13px] text-negative">
          {error}
        </p>
      )}
    </div>
  );
}
