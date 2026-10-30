import { useNavigate } from "react-router-dom";
import { CalendarPlus, ChevronRight, House, KeyRound, UserPlus } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAppointmentDialog } from "@/features/agenda/AppointmentDialog";

/** Foglio del pulsante "+": quattro scelte grandi e chiare. */
export function QuickAddSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const { openAppointment } = useAppointmentDialog();

  const choices = [
    {
      label: "Un immobile",
      hint: "Foto, dati, prezzo e proprietario",
      icon: House,
      run: () => navigate("/immobili/nuovo"),
    },
    {
      label: "Una segnalazione",
      hint: "Un proprietario che forse vende: indirizzo, nome, telefono",
      icon: KeyRound,
      run: () => navigate("/trattative/acquisizioni?nuova=1"),
    },
    {
      label: "Un contatto",
      hint: "Acquirente o proprietario",
      icon: UserPlus,
      run: () => navigate("/contatti/nuovo"),
    },
    {
      label: "Un appuntamento",
      hint: "Visita, valutazione o firma",
      icon: CalendarPlus,
      run: () => openAppointment(),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Cosa vuoi aggiungere?">
        <div className="space-y-3">
          {choices.map(({ label, hint, icon: Icon, run }) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                onOpenChange(false);
                run();
              }}
              className="flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary-soft/40"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-strong">
                <Icon className="size-6" aria-hidden />
              </span>
              <span className="flex-1">
                <span className="block text-[17px] font-semibold">{label}</span>
                <span className="block text-muted-foreground">{hint}</span>
              </span>
              <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
