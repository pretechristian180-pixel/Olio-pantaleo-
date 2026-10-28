import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";

export function NotFoundPage() {
  return (
    <EmptyState
      art="ricerca"
      title="Pagina non trovata"
      text="Forse il link è sbagliato o la pagina è stata spostata."
      action={
        <Button asChild>
          <Link to="/">Torna a Oggi</Link>
        </Button>
      }
    />
  );
}
