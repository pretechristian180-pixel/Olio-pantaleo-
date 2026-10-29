import { Link } from "react-router-dom";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <EmptyState
      art="ricerca"
      title="Pagina non trovata"
      text="Il collegamento potrebbe essere vecchio o l'elemento è stato eliminato."
      action={
        <Button asChild>
          <Link to="/">Torna a Oggi</Link>
        </Button>
      }
    />
  );
}
