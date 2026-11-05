"use client";

import { createContext, useContext, useTransition } from "react";

const PendingContext = createContext(false);

/** true mentre l'ActionForm che contiene il componente sta inviando. */
export function useActionFormPending() {
  return useContext(PendingContext);
}

/**
 * Form per le Server Action con useActionState che NON svuota i campi dopo l'invio.
 * (Con <form action> React 19 resetta i campi: dopo un errore l'utente perderebbe quanto scritto.)
 */
export function ActionForm({
  action,
  children,
  ...props
}: Omit<React.ComponentProps<"form">, "action" | "onSubmit"> & {
  action: (formData: FormData) => void;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <PendingContext.Provider value={pending}>
      <form
        {...props}
        aria-busy={pending}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(() => action(fd));
        }}
      >
        {children}
      </form>
    </PendingContext.Provider>
  );
}
