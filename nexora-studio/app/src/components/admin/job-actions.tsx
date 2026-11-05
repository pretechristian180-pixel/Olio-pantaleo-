"use client";

import { Loader2, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { type AdminActionResult, cancelJobAction, retryJobAction } from "@/lib/actions/admin";

/** "Riprova" (job fallito) o "Annulla" (job in coda), con esito in un avviso. */
export function JobActions({
  jobId,
  status,
  type,
}: {
  jobId: string;
  status: string;
  type: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: (id: string) => Promise<AdminActionResult>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    start(async () => {
      const res = await fn(jobId);
      if (res.error) toast.error(res.error);
      else toast.success(res.message ?? "Fatto.");
      router.refresh();
    });
  };
  if (status === "failed" && type !== "publish") {
    return (
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(retryJobAction)}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <RotateCcw aria-hidden />}{" "}
        Riprova
      </Button>
    );
  }
  if (status === "queued") {
    return (
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() =>
          run(
            cancelJobAction,
            ["transcribe", "edit", "render"].includes(type)
              ? "Annullare il montaggio? Il video va in errore e torna disponibile al cliente."
              : "Annullare questo job?",
          )
        }
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <X aria-hidden />} Annulla
      </Button>
    );
  }
  return null;
}
