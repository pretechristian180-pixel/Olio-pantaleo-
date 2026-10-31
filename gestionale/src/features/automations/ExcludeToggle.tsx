import { useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@/hooks/useQuery";
import { friendlyError } from "@/lib/errors";
import { isExcluded, setExcluded } from "@/services/automations";

/** Sulla scheda del contatto: messaggi automatici sì / no */
export function ExcludeToggle({ contactId, canEdit }: { contactId: string; canEdit: boolean }) {
  const { data } = useQuery(() => isExcluded(contactId), [contactId]);
  const [busy, setBusy] = useState(false);
  if (data === undefined) return null;
  return (
    <p className="mt-3 flex flex-wrap items-center gap-2 text-[15px] text-muted-foreground">
      Messaggi automatici: <strong className={data ? "text-warning" : "text-success"}>{data ? "esclusi" : "attivi"}</strong>
      {canEdit && (
        <button
          type="button"
          disabled={busy}
          className="h-10 rounded-lg px-2 font-semibold text-primary-strong hover:bg-muted"
          onClick={async () => {
            setBusy(true);
            try {
              await setExcluded(contactId, !data);
              toast.success(data ? "Riceverà di nuovo i messaggi automatici" : "Non riceverà più messaggi automatici");
            } catch (err) {
              toast.error("Non salvato", { description: friendlyError(err) });
            }
            setBusy(false);
          }}
        >
          {data ? "Riattiva" : "Escludi"}
        </button>
      )}
    </p>
  );
}
