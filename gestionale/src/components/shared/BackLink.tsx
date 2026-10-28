import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="-ml-2 mb-4 inline-flex h-11 items-center gap-2 rounded-lg px-2 text-[16px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <ArrowLeft className="size-5" aria-hidden />
      {label}
    </Link>
  );
}
