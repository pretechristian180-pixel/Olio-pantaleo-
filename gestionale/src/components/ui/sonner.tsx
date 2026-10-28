import { Toaster as Sonner } from "sonner";

/** Notifiche toast in basso, sopra la barra di navigazione su telefono. */
export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      offset={{ bottom: 24 }}
      mobileOffset={{ bottom: "calc(88px + env(safe-area-inset-bottom))" }}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-xl !border !border-border !bg-foreground !text-white !shadow-raised !text-base !px-4 !py-3.5 !gap-3",
          description: "!text-white/75",
          success: "[&_[data-icon]]:!text-green-400",
          error: "[&_[data-icon]]:!text-red-400",
          actionButton: "!bg-white/15 !text-white !h-9 !px-3 !text-[15px] !font-semibold !rounded-md",
        },
      }}
    />
  );
}
