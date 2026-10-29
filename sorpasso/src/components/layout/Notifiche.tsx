import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { useNotifiche, useSegnaNotificheLette } from "@/lib/queries";
import { relativo } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Campanella con le notifiche in app (es. lead non contattato in tempo). */
export function Notifiche() {
  const { data = [] } = useNotifiche();
  const segna = useSegnaNotificheLette();
  const navigate = useNavigate();
  const nonLette = data.filter((n) => !n.letta_at).length;

  return (
    <DropdownMenu onOpenChange={(open) => !open && nonLette > 0 && segna.mutate()}>
      <DropdownMenuTrigger
        className="relative flex size-11 items-center justify-center rounded-lg border bg-background hover:bg-muted"
        aria-label={nonLette ? `Notifiche, ${nonLette} da leggere` : "Notifiche"}
      >
        <Bell className="size-5" aria-hidden />
        {nonLette > 0 && (
          <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-white">
            {nonLette > 9 ? "9+" : nonLette}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(92vw,380px)]">
        <DropdownMenuLabel>Notifiche</DropdownMenuLabel>
        {data.length === 0 && <p className="px-3 pb-3 text-[15px] text-muted-foreground">Nessuna notifica. Tutto sotto controllo.</p>}
        <div className="max-h-[60vh] overflow-y-auto">
          {data.map((n) => (
            <DropdownMenuItem
              key={n.id}
              onSelect={() => n.link && navigate(n.link)}
              className={cn("items-start py-2.5", !n.letta_at && "bg-accent-soft/60")}
            >
              <span className={cn("mt-2 size-2 shrink-0 rounded-full", n.letta_at ? "bg-transparent" : "bg-destructive")} aria-hidden />
              <span className="min-w-0">
                <span className="block font-semibold">{n.titolo}</span>
                {n.testo && <span className="block text-sm text-muted-foreground">{n.testo}</span>}
                <span className="block text-xs text-muted-foreground">{relativo(n.created_at)}</span>
              </span>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
