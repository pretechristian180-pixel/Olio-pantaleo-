import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="mb-4 inline-flex h-10 items-center gap-1.5 rounded-lg pr-3 text-[15px] font-medium text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-5" aria-hidden />
      {label}
    </Link>
  );
}
